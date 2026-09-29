// The offline pack manager: what can be downloaded, what is on the device, and the one safe way from one to the other.
//
// Install (and update, and resume) is one procedure:
//   1 the manifest is fetched and checked against the catalog's SHA-256, then validated (schema, app version, rights,
//     index compatibility) — an incompatible pack is refused before a byte of it is stored
//   2 every file is downloaded into the pack's new version directory and verified (size + SHA-256) before it is written;
//     a file already there and verified (an interrupted download) is kept — that is the resume
//   3 only when every file is present and verified does the registry switch to the new version (one write), the index
//     is registered for search, and the previous version's files are deleted
// Any failure (no network, a wrong hash, no space, a pause) leaves the registry as it was: the previous version stays
// usable, a partial download is never registered. Removing a pack unregisters its index first — its full-text results
// vanish from the next search at once — then deletes its files. Nothing here sends anything about the user.
import BUNDLED_CATALOG from '../../data/torah/packCatalog.mjs';
import { SHELF_PACKS } from './inventory.mjs';
import { APP_VERSION, sha256Hex, validateManifest } from './packFormat.mjs';
import { defaultPackStore } from './packStore.mjs';
import { indexIncompatibility, loadManifest, registerIndex, registeredPacks, unregisterIndex } from './searchIndex.mjs';

export const PACK_EVENT = 'kz-torah-packs-change';
const REGISTRY_KEY = 'kz-torah-packs-v1';
const PAGES_HOST = 'https://nzm1000-sudo.github.io/kazzohar-harakia/torah-packs/';
const DOWNLOAD_PARALLEL = 6;

const env = {
  store: null,
  fetch: (...args) => globalThis.fetch(...args),
  storage: () => { try { return globalThis.localStorage || null; } catch { return null; } },
  online: () => { try { return globalThis.navigator?.onLine !== false; } catch { return true; } },
  connection: async () => {
    const cap = globalThis.Capacitor;
    if (cap?.isNativePlatform?.() && cap.isPluginAvailable?.('Network')) {
      try { const { Network } = await import('@capacitor/network'); const status = await Network.getStatus(); return status.connected ? status.connectionType : 'none'; } catch { /* unknown */ }
    }
    return globalThis.navigator?.connection?.type || 'unknown';
  },
  estimate: async () => { try { return await globalThis.navigator?.storage?.estimate?.(); } catch { return null; } },
  host: null,
  appVersion: APP_VERSION,
};
// Tests: configurePackManager({ store, fetch, storage, online, connection, estimate, host }).
export function configurePackManager(options = {}) {
  Object.assign(env, options);
  restored = null;
  remoteCatalog = null;
  progress.clear();
}

// Where packs are hosted: the web app's own site (same origin) on the web, the project's GitHub Pages in the app.
// A developer may point the app at another host (localStorage 'kz-pack-host') — never set by the app itself.
export function packHost() {
  if (env.host) return env.host;
  try { const override = env.storage()?.getItem('kz-pack-host'); if (override) return override.endsWith('/') ? override : `${override}/`; } catch { /* ignore */ }
  const native = globalThis.Capacitor?.isNativePlatform?.() === true;
  if (native) return PAGES_HOST;
  try { return `${import.meta.env?.BASE_URL || '/'}torah-packs/`; } catch { return '/torah-packs/'; }
}

// ---------- The registry (installed versions, preferences) — one localStorage record, replaced in one write ----------
function readRegistry() {
  try { const value = JSON.parse(env.storage()?.getItem(REGISTRY_KEY) || '{}'); return { installed: value.installed || {}, prefs: { wifiOnly: false, ...(value.prefs || {}) } }; } catch { return { installed: {}, prefs: { wifiOnly: false } }; }
}
function writeRegistry(registry) {
  try { env.storage()?.setItem(REGISTRY_KEY, JSON.stringify(registry)); } catch { /* storage full: the previous registry stays */ }
  emit();
}
export const getPackPrefs = () => readRegistry().prefs;
export function setPackPrefs(prefs) { const registry = readRegistry(); registry.prefs = { ...registry.prefs, ...prefs }; writeRegistry(registry); }
export const installedPacks = () => readRegistry().installed;

const progress = new Map(); // packId → { state: 'queued'|'downloading'|'paused'|'error', done, total, error, controller }
function emit() { try { globalThis.dispatchEvent?.(new Event(PACK_EVENT)); } catch { /* no event target */ } }
const setProgress = (packId, value) => { if (value) progress.set(packId, { ...(progress.get(packId) || {}), ...value }); else progress.delete(packId); emit(); };

// ---------- The catalog ----------
let remoteCatalog = null;
// The app knows its packs (bundled); online, the site's catalog may announce a newer version (no app update needed).
export async function refreshCatalog() {
  if (!env.online()) return catalogNow();
  try {
    const response = await env.fetch(`${packHost()}catalog.json`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data?.schemaVersion === BUNDLED_CATALOG.schemaVersion && Array.isArray(data.packs)) remoteCatalog = data;
    }
  } catch { /* offline or not published yet: the bundled catalog stands */ }
  return catalogNow();
}
export function catalogNow() {
  const source = remoteCatalog && remoteCatalog.stopTermsHash === BUNDLED_CATALOG.stopTermsHash ? remoteCatalog : BUNDLED_CATALOG;
  return { ...source, source: source === BUNDLED_CATALOG ? 'bundled' : 'remote' };
}
const catalogEntry = packId => catalogNow().packs.find(pack => pack.packId === packId) || null;

// ---------- Status for the UI ----------
// installed · available · downloading · queued · paused · update · error · stale
export function packStatuses() {
  const { installed } = readRegistry();
  const registered = new Set(registeredPacks().map(pack => pack.id));
  return catalogNow().packs.map(entry => {
    const have = installed[entry.packId] || null;
    const live = progress.get(entry.packId) || null;
    const shelf = SHELF_PACKS.find(pack => pack.packId === entry.packId);
    let status = have ? (have.version === entry.version ? 'installed' : 'update') : 'available';
    if (have && have.stale) status = 'update';
    if (live?.state) status = live.state;
    return {
      packId: entry.packId, title: shelf?.title || entry.title, displayName: entry.displayName, family: entry.family, works: entry.works, documents: entry.documents,
      size: entry.totalDownloadSize, installedBytes: have?.bytes || 0, installedVersion: have?.version || null, availableVersion: entry.version,
      status, searchable: registered.has(entry.packId), done: live?.done || 0, total: live?.total || entry.totalDownloadSize, error: live?.error || null,
    };
  });
}

// ---------- Restoring installed packs at start (no network; lazy file reads) ----------
let restored = null;
export function restoreInstalledPacks() {
  if (!restored) restored = (async () => {
    const registry = readRegistry();
    const store = env.store || await defaultPackStore();
    const core = await loadManifest().catch(() => null);
    let changed = false;
    for (const [packId, entry] of Object.entries(registry.installed)) {
      const stale = indexIncompatibility(entry.index, core);
      if (stale) { if (!entry.stale) { entry.stale = stale; changed = true; } unregisterIndex(packId); continue; }
      if (entry.stale) { delete entry.stale; changed = true; }
      await registerIndex(packId, { manifest: entry.index, version: entry.version, title: entry.title, family: entry.index.family, load: fileLoader(store, packId, entry.version) }).catch(() => {});
    }
    if (changed) writeRegistry(registry);
  })();
  return restored;
}
const fileLoader = (store, packId, version) => async file => {
  const bytes = await store.read(`${packId}/${version}/${file}`);
  if (!bytes) throw new Error('INDEX_UNAVAILABLE');
  return bytes;
};

// ---------- Install / update / resume ----------
const errorCode = error => (error?.code ? error.code : error?.name === 'AbortError' ? 'PAUSED' : error?.name === 'QuotaExceededError' || /space|quota|full/i.test(error?.message || '') ? 'NO_SPACE' : error?.name === 'TypeError' ? 'NETWORK' : 'FAILED');
const fail = (code, message) => { const error = new Error(message || code); error.code = code; return error; };

// The current connection: 'wifi' | 'cellular' | 'none' | 'unknown' (the native Network plugin, else the browser's hint).
export const connectionType = () => env.connection();
// May a download start now? { ok } or { ok: false, reason: 'offline' | 'cellular' }.
// allowCellular: the person was asked, on this cellular connection, and chose to download anyway (the Wi‑Fi‑only
// preference itself is left as it is).
export async function canDownloadNow({ allowCellular = false } = {}) {
  if (!env.online()) return { ok: false, reason: 'offline' };
  if (getPackPrefs().wifiOnly && !allowCellular) {
    const type = await env.connection();
    if (type === 'cellular') return { ok: false, reason: 'cellular' };
  }
  return { ok: true };
}

export async function installPack(packId, { signal = null, allowCellular = false } = {}) {
  const entry = catalogEntry(packId);
  if (!entry) throw fail('UNKNOWN_PACK');
  const controller = new AbortController();
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  setProgress(packId, { state: 'downloading', done: 0, total: entry.totalDownloadSize, error: null, controller });
  const allowed = await canDownloadNow({ allowCellular });
  if (!allowed.ok) { setProgress(packId, { state: 'error', error: allowed.reason === 'offline' ? 'OFFLINE' : 'WIFI_ONLY', controller: null }); throw fail(allowed.reason === 'offline' ? 'OFFLINE' : 'WIFI_ONLY'); }
  const store = env.store || await defaultPackStore();
  let dir = null;
  try {
    const host = packHost();
    // 1 The manifest, as the catalog describes it.
    const manifestResponse = await env.fetch(`${host}${packId}/manifest.json?v=${entry.version}`, { cache: 'no-store', signal: controller.signal });
    if (!manifestResponse.ok) throw fail('NOT_PUBLISHED', `manifest ${manifestResponse.status}`);
    const manifestBytes = new Uint8Array(await manifestResponse.arrayBuffer());
    if (entry.manifestSha256 && await sha256Hex(manifestBytes) !== entry.manifestSha256) throw fail('CORRUPT', 'manifest hash');
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    const core = await loadManifest();
    const valid = validateManifest(manifest, { core, appVersion: env.appVersion });
    if (!valid.ok) throw fail(valid.code, valid.reason);
    if (manifest.packId !== packId || manifest.version !== entry.version) throw fail('CORRUPT', 'manifest does not match the catalog');
    const stale = indexIncompatibility(manifest.index, core);
    if (stale) throw fail('STALE', stale);
    // Low storage: refuse early when the device says there is not room (the previous version stays).
    const estimate = await env.estimate();
    if (estimate?.quota && estimate.quota - (estimate.usage || 0) < manifest.totalDownloadSize * 1.1) throw fail('NO_SPACE');
    // 2 Every file, verified before it is written; a file already there and verified is kept (resume).
    dir = `${packId}/${manifest.version}`;
    let done = 0;
    const fetchFile = async file => {
      if (controller.signal.aborted) throw fail('PAUSED');
      const existing = await store.read(`${dir}/${file.path}`);
      if (existing && existing.length === file.bytes && await sha256Hex(existing) === file.sha256) { done += file.bytes; setProgress(packId, { done }); return; }
      const response = await env.fetch(`${host}${packId}/${file.path}?v=${file.sha256.slice(0, 12)}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw fail('NOT_PUBLISHED', `${file.path} ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== file.bytes || await sha256Hex(bytes) !== file.sha256) throw fail('CORRUPT', `${file.path} hash`);
      await store.write(`${dir}/${file.path}`, bytes);
      done += file.bytes;
      setProgress(packId, { done });
    };
    // A few files at a time (small shards: the round trip, not the bandwidth, is the cost).
    // Every file of a batch settles before a failure is reported, so nothing is still being written when a partial
    // version is cleaned up.
    for (let i = 0; i < manifest.files.length; i += DOWNLOAD_PARALLEL) {
      const settled = await Promise.allSettled(manifest.files.slice(i, i + DOWNLOAD_PARALLEL).map(fetchFile));
      const failed = settled.find(item => item.status === 'rejected');
      if (failed) throw failed.reason;
    }
    // 3 Commit: one registry write; then the index is registered and the previous version removed.
    const registry = readRegistry();
    const previous = registry.installed[packId] || null;
    registry.installed[packId] = { version: manifest.version, contentHash: manifest.contentHash, title: SHELF_PACKS.find(pack => pack.packId === packId)?.title || manifest.displayName, bytes: manifest.totalDownloadSize, installedAt: new Date().toISOString(), rightsState: manifest.rightsState, includedWorks: manifest.includedWorks, index: manifest.index };
    writeRegistry(registry);
    await registerIndex(packId, { manifest: manifest.index, version: manifest.version, title: registry.installed[packId].title, family: manifest.index.family, load: fileLoader(store, packId, manifest.version) });
    if (previous && previous.version !== manifest.version) await store.removeDir(`${packId}/${previous.version}`).catch(() => {});
    setProgress(packId, null);
    return { ok: true, version: manifest.version };
  } catch (error) {
    const code = errorCode(error);
    // No space or a corrupt file: the partial new version is deleted (a pause or a lost connection keeps it to resume).
    if (dir && (code === 'NO_SPACE' || code === 'CORRUPT') && readRegistry().installed[packId]?.version !== dir.split('/')[1]) await store.removeDir(dir).catch(() => {});
    setProgress(packId, { state: code === 'PAUSED' ? 'paused' : 'error', error: code, controller: null });
    throw fail(code, error?.message);
  }
}
export const updatePack = installPack;

export function pausePack(packId) {
  const live = progress.get(packId);
  live?.controller?.abort();
}

export async function removePack(packId) {
  pausePack(packId);
  unregisterIndex(packId);
  const registry = readRegistry();
  const entry = registry.installed[packId];
  delete registry.installed[packId];
  writeRegistry(registry);
  const store = env.store || await defaultPackStore();
  await store.removeDir(packId).catch(() => {});
  setProgress(packId, null);
  return Boolean(entry);
}

// Every pack not on the device (or needing an update), one after another; the rest wait as "queued".
export async function installAllPacks({ allowCellular = false } = {}) {
  const todo = packStatuses().filter(pack => pack.status !== 'installed' && pack.status !== 'downloading');
  for (const pack of todo) setProgress(pack.packId, { state: 'queued', error: null });
  const results = [];
  for (const pack of todo) {
    try { results.push({ packId: pack.packId, ...(await installPack(pack.packId, { allowCellular })) }); } catch (error) {
      results.push({ packId: pack.packId, ok: false, code: error.code });
      if (error.code === 'OFFLINE' || error.code === 'WIFI_ONLY' || error.code === 'NO_SPACE') { for (const rest of todo) if (progress.get(rest.packId)?.state === 'queued') setProgress(rest.packId, null); break; }
    }
  }
  return results;
}

export async function packStorageUsed() {
  const store = env.store || await defaultPackStore();
  return store.usage().catch(() => Object.values(readRegistry().installed).reduce((sum, entry) => sum + (entry.bytes || 0), 0));
}
