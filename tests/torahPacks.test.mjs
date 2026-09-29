// Offline packs · the registry, install, remove, update, integrity, resume, stale / incompatible refusal, the rights gate,
// dynamic shard registration and a cold start without network. The packs are the real ones (public/torah-packs), served
// by a fake host from disk — no test depends on the network or on the site being deployed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { installDiskAssets, diskFetch } from './helpers/diskAssets.mjs';
import { searchTorah } from '../src/services/torah/search.mjs';
import { getSegment } from '../src/services/torah/engine.mjs';
import { registerIndex, registeredPacks, unregisterIndex } from '../src/services/torah/searchIndex.mjs';
import { memoryStore } from '../src/services/torah/packStore.mjs';
import { PACK_SCHEMA_VERSION, sha256Hex, sha256Sync, stopTermsHash, validateManifest } from '../src/services/torah/packFormat.mjs';
import { catalogNow, configurePackManager, installAllPacks, installPack, installedPacks, packStatuses, pausePack, refreshCatalog, removePack, restoreInstalledPacks, setPackPrefs } from '../src/services/torah/packManager.mjs';
import { RIGHTS, SEARCHABLE_RIGHTS, SHELF_PACKS, capabilitiesOf, packWorks, rightsOf } from '../src/services/torah/inventory.mjs';
import { WORKS, workById } from '../src/data/library/registry.mjs';
import CORE from '../src/data/torah/searchIndex.mjs';
import CATALOG from '../src/data/torah/packCatalog.mjs';

installDiskAssets();
const HOST = 'https://packs.test/torah-packs/';
const disk = path => readFileSync(new URL(`../public/torah-packs/${path}`, import.meta.url));
const manifestOf = id => JSON.parse(disk(`${id}/manifest.json`).toString('utf8'));

function fakeStorage() { const map = new Map(); return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map }; }
// A host that serves the pack directory, counts requests, and can be told to corrupt, fail or rewrite a file.
function host({ corrupt = null, failAfter = Infinity, rewrite = null } = {}) {
  const state = { requests: [], served: 0 };
  state.fetch = async (url, options = {}) => {
    const text = String(url);
    if (!text.startsWith(HOST)) return diskFetch(url, options);
    if (options.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    const path = text.slice(HOST.length).split('?')[0];
    state.requests.push(path);
    if (state.served >= failAfter) throw new TypeError('Load failed');
    state.served += 1;
    let bytes;
    try { bytes = new Uint8Array(disk(path)); } catch { return new Response('not found', { status: 404 }); }
    if (rewrite?.[path]) bytes = rewrite[path](bytes);
    if (corrupt === path) { bytes = new Uint8Array(bytes); bytes[bytes.length - 1] ^= 0xff; }
    return new Response(bytes);
  };
  return state;
}
function setup(options = {}) {
  for (const pack of registeredPacks()) unregisterIndex(pack.id);
  const storage = fakeStorage();
  const store = options.store || memoryStore();
  const served = host(options);
  configurePackManager({ store, storage: () => storage, fetch: served.fetch, host: HOST, online: () => options.online ?? true, connection: async () => options.connection || 'wifi', estimate: async () => options.estimate || null });
  return { storage, store, served };
}
const packHits = async (query, pack) => (await searchTorah(query, { limit: 20 })).results.filter(hit => hit.pack === pack);

test('pack format: catalog ↔ manifests ↔ files agree (sizes, SHA-256), schema and rights recorded', async () => {
  assert.equal(CATALOG.schemaVersion, PACK_SCHEMA_VERSION);
  assert.equal(CATALOG.stopTermsHash, stopTermsHash(CORE.stopTerms.map(([term]) => term)), 'packs are built against this built-in index');
  assert.deepEqual(CATALOG.packs.map(pack => pack.packId), SHELF_PACKS.map(pack => pack.packId));
  for (const entry of CATALOG.packs) {
    const text = disk(`${entry.packId}/manifest.json`);
    assert.equal(createHash('sha256').update(text).digest('hex'), entry.manifestSha256, entry.packId);
    const manifest = JSON.parse(text.toString('utf8'));
    for (const field of ['packId', 'displayName', 'version', 'schemaVersion', 'contentVersion', 'contentHash', 'rightsState', 'source', 'provider', 'attribution', 'commercialRestrictions', 'includedWorks', 'includedCommentaries', 'textSize', 'lexicalIndexSize', 'semanticIndexSize', 'totalDownloadSize', 'minimumAppVersion', 'dependencies', 'createdAt']) assert.ok(field in manifest, `${entry.packId}: ${field}`);
    assert.equal(validateManifest(manifest, { core: CORE }).ok, true, entry.packId);
    assert.equal(manifest.totalDownloadSize, manifest.files.reduce((sum, file) => sum + file.bytes, 0));
    const onDisk = readdirSync(new URL(`../public/torah-packs/${entry.packId}/`, import.meta.url)).filter(name => name !== 'manifest.json').sort();
    assert.deepEqual(onDisk, manifest.files.map(file => file.path).sort(), `${entry.packId}: exactly the listed files`);
    for (const file of manifest.files.filter((_, i) => i % 40 === 0)) assert.equal(createHash('sha256').update(disk(`${entry.packId}/${file.path}`)).digest('hex'), file.sha256, file.path);
  }
});

test('rights gate: packs hold only rights-cleared works; unknown / pending never; every packable work is in exactly one pack', () => {
  const inPacks = new Map();
  for (const entry of CATALOG.packs) for (const id of manifestOf(entry.packId).includedWorks) { assert.ok(!inPacks.has(id), `${id} in two packs`); inPacks.set(id, entry.packId); }
  for (const [id] of inPacks) {
    const work = workById(id);
    assert.ok(SEARCHABLE_RIGHTS.has(rightsOf(work)), `${id}: ${rightsOf(work)}`);
    assert.notEqual(capabilitiesOf(work).globalSearch, 'full-text', `${id} is already in the built-in index`);
  }
  for (const work of WORKS) {
    const rights = rightsOf(work);
    if (rights === RIGHTS.UNKNOWN || rights === RIGHTS.PENDING_PERMISSION) assert.ok(!inPacks.has(work.workId), work.workId);
    if (capabilitiesOf(work).fullTextPack) assert.equal(inPacks.get(work.workId), capabilitiesOf(work).fullTextPack, work.workId);
  }
  for (const shelf of SHELF_PACKS) assert.equal(packWorks(shelf.packId).length, manifestOf(shelf.packId).includedWorks.length);
  const nc = manifestOf('chassidut');
  assert.equal(nc.rightsState, RIGHTS.NONCOMMERCIAL_ONLY, 'Tanya (CC BY-NC) keeps its non-commercial state');
  assert.ok(nc.commercialRestrictions.works.includes('Tanya'));
  assert.equal(validateManifest({ ...nc, rightsState: RIGHTS.UNKNOWN }, { core: CORE }).code, 'RIGHTS');
  assert.equal(validateManifest({ ...nc, rightsState: RIGHTS.PENDING_PERMISSION }, { core: CORE }).code, 'RIGHTS');
});

test('incompatible or stale packs are refused: schema, app version, normalizer, stop words, an edition changed', async () => {
  const manifest = manifestOf('midrash');
  assert.equal(validateManifest({ ...manifest, schemaVersion: 2 }, { core: CORE }).code, 'SCHEMA');
  assert.equal(validateManifest({ ...manifest, minimumAppVersion: '9.0.0' }, { core: CORE }).code, 'APP_TOO_OLD');
  assert.equal(validateManifest({ ...manifest, index: { ...manifest.index, normalizerVersion: 99 } }, { core: CORE }).code, 'STALE');
  assert.equal(validateManifest({ ...manifest, index: { ...manifest.index, stopTermsHash: '00000000' } }, { core: CORE }).code, 'STALE');
  assert.equal(validateManifest({ ...manifest, files: [{ path: '../evil', sha256: 'x', bytes: 1 }] }, { core: CORE }).code, 'CORRUPT');
  const edited = { ...manifest.index, works: manifest.index.works.map((row, i) => (i ? row : [row[0], row[1], row[2], row[3], 'deadbeef', row[5]])) };
  await assert.rejects(registerIndex('midrash', { manifest: edited, load: async () => null }), error => error.code === 'INDEX_STALE');
  assert.ok(!registeredPacks().some(pack => pack.id === 'midrash'));
});

test('SHA-256: the pure implementation equals WebCrypto (the WebView fallback)', async () => {
  for (const bytes of [new Uint8Array(0), new TextEncoder().encode('abc'), new Uint8Array(disk('midrash/s000.bin.gz'))]) {
    assert.equal(sha256Sync(bytes), createHash('sha256').update(bytes).digest('hex'));
    assert.equal(await sha256Hex(bytes), sha256Sync(bytes));
  }
});

test('install → the pack\'s full text joins the same global search; remove → its results vanish at once', { timeout: 120000 }, async () => {
  const { served, store } = setup();
  assert.equal((await packHits('ילמדנו רבינו', 'responsa')).length, 0, 'before: nothing from a pack that is not installed');
  assert.equal(packStatuses().find(pack => pack.packId === 'responsa').status, 'available');
  const result = await installPack('responsa');
  assert.equal(result.version, manifestOf('responsa').version);
  assert.equal(packStatuses().find(pack => pack.packId === 'responsa').status, 'installed');
  assert.equal(served.requests.length, 1 + manifestOf('responsa').files.length);
  const hits = await packHits('ילמדנו רבינו', 'responsa');
  assert.ok(hits.length >= 2, 'responsa results in the global search');
  for (const hit of hits) {
    assert.match(hit.target.route, /^books\/r\//, 'an exact deep link');
    const unit = await getSegment({ workId: hit.workId, section: hit.place.node, segment: hit.place.unit });
    assert.match(unit.text, /ילמדנו רבינו/, `${hit.displayRef}: the destination is the text found`);
  }
  // Filters: the pack's family is a filter of its own.
  const only = await searchTorah('ילמדנו רבינו', { family: 'responsa', limit: 5 });
  assert.ok(only.results.length && only.results.every(hit => hit.family === 'responsa'));
  await removePack('responsa');
  assert.equal((await packHits('ילמדנו רבינו', 'responsa')).length, 0, 'removed: no results from it');
  assert.equal(await store.usage(), 0, 'its files are gone');
  assert.deepEqual(installedPacks(), {});
});

test('a corrupt file is refused; nothing registered; the previous version stays usable (update N → N+1 fails safely)', { timeout: 120000 }, async () => {
  const { storage, store } = setup();
  await installPack('midrash');
  const before = (await packHits('ילמדנו רבינו', 'midrash')).length;
  // The site now announces version N+1 whose shard is corrupt.
  const manifest = manifestOf('midrash');
  const next = { ...manifest, version: 'nextversion1', contentHash: 'f'.repeat(64) };
  const nextText = new TextEncoder().encode(JSON.stringify(next));
  const catalog = { ...CATALOG, packs: CATALOG.packs.map(pack => (pack.packId === 'midrash' ? { ...pack, version: next.version, manifestSha256: sha256Sync(nextText) } : pack)) };
  const served = host({ corrupt: `midrash/${manifest.files[5].path}`, rewrite: { 'midrash/manifest.json': () => nextText, 'catalog.json': () => new TextEncoder().encode(JSON.stringify(catalog)) } });
  configurePackManager({ store, storage: () => storage, fetch: served.fetch, host: HOST, online: () => true, connection: async () => 'wifi', estimate: async () => null });
  await refreshCatalog();
  assert.equal(packStatuses().find(pack => pack.packId === 'midrash').status, 'update', 'N+1 announced online, no app update');
  await restoreInstalledPacks();
  await assert.rejects(installPack('midrash'), error => error.code === 'CORRUPT');
  assert.equal(installedPacks().midrash.version, manifest.version, 'the registry still points at N');
  assert.equal((await packHits('ילמדנו רבינו', 'midrash')).length, before, 'N still searchable');
  assert.equal(await store.usage('midrash/nextversion1'), 0, 'the partial N+1 is deleted');
});

test('update N → N+1: new version registered, old files deleted, no duplicate or stale results', { timeout: 120000 }, async () => {
  const { storage, store } = setup();
  await installPack('midrash');
  const first = (await searchTorah('ילמדנו רבינו', { limit: 50 })).total;
  const manifest = manifestOf('midrash');
  const next = { ...manifest, version: 'nextversion2', contentHash: 'e'.repeat(64) };
  const nextText = new TextEncoder().encode(JSON.stringify(next));
  const catalog = { ...CATALOG, packs: CATALOG.packs.map(pack => (pack.packId === 'midrash' ? { ...pack, version: next.version, manifestSha256: sha256Sync(nextText) } : pack)) };
  const served = host({ rewrite: { 'midrash/manifest.json': () => nextText, 'catalog.json': () => new TextEncoder().encode(JSON.stringify(catalog)) } });
  configurePackManager({ store, storage: () => storage, fetch: served.fetch, host: HOST, online: () => true, connection: async () => 'wifi', estimate: async () => null });
  await refreshCatalog();
  await restoreInstalledPacks();
  await installPack('midrash');
  assert.equal(installedPacks().midrash.version, 'nextversion2');
  assert.equal(await store.usage(`midrash/${manifest.version}`), 0, 'N deleted');
  assert.ok(await store.usage('midrash/nextversion2') > 0);
  assert.equal(registeredPacks().filter(pack => pack.id === 'midrash').length, 1);
  const again = await searchTorah('ילמדנו רבינו', { limit: 50 });
  assert.equal(again.total, first, 'the same places, once each');
  assert.equal(new Set(again.results.map(hit => hit.id)).size, again.results.length);
});

test('interrupted download: nothing registered; the next attempt resumes (verified files are not fetched again)', { timeout: 120000 }, async () => {
  const { storage, store } = setup({ failAfter: 60 });
  await assert.rejects(installPack('midrash'), error => error.code === 'NETWORK');
  assert.deepEqual(installedPacks(), {});
  assert.equal(packStatuses().find(pack => pack.packId === 'midrash').status, 'error');
  assert.equal((await packHits('ילמדנו רבינו', 'midrash')).length, 0, 'a partial pack is never searched');
  const kept = await store.usage();
  assert.ok(kept > 0, 'the verified files were kept');
  const served = host();
  configurePackManager({ store, storage: () => storage, fetch: served.fetch, host: HOST, online: () => true, connection: async () => 'wifi', estimate: async () => null });
  await installPack('midrash');
  const files = manifestOf('midrash').files.length;
  assert.ok(served.requests.length < files, `resumed: ${served.requests.length} requests for ${files} files`);
  assert.ok((await packHits('ילמדנו רבינו', 'midrash')).length > 0);
});

test('pause, offline, Wi-Fi only, low storage: graceful refusals, nothing half-installed', { timeout: 60000 }, async () => {
  let env = setup({ online: false });
  await assert.rejects(installPack('midrash'), error => error.code === 'OFFLINE');
  assert.equal(env.served.requests.length, 0, 'offline: no request at all');
  env = setup({ connection: 'cellular' });
  setPackPrefs({ wifiOnly: true });
  await assert.rejects(installPack('midrash'), error => error.code === 'WIFI_ONLY');
  env = setup({ estimate: { quota: 1000000, usage: 0 } });
  await assert.rejects(installPack('midrash'), error => error.code === 'NO_SPACE');
  env = setup({ store: memoryStore({ capacity: 200000 }) });
  await assert.rejects(installPack('midrash'), error => error.code === 'NO_SPACE');
  assert.equal(await env.store.usage(), 0, 'the partial files are removed when the device is full');
  env = setup();
  const pending = installPack('midrash');
  pausePack('midrash');
  await assert.rejects(pending, error => error.code === 'PAUSED');
  assert.equal(packStatuses().find(pack => pack.packId === 'midrash').status, 'paused');
  assert.deepEqual(installedPacks(), {});
});

test('download all → every pack searchable; cold start with no network restores them from the device', { timeout: 240000 }, async () => {
  const { storage, store } = setup();
  const results = await installAllPacks();
  assert.deepEqual(results.map(result => result.ok), CATALOG.packs.map(() => true));
  assert.ok(packStatuses().every(pack => pack.status === 'installed'));
  // Cold start: a fresh process state (nothing registered), airplane mode (every remote request fails).
  for (const pack of registeredPacks()) unregisterIndex(pack.id);
  configurePackManager({ store, storage: () => storage, fetch: async url => { if (/^https?:/.test(String(url))) throw new TypeError('Load failed'); return diskFetch(url); }, host: HOST, online: () => false, connection: async () => 'none', estimate: async () => null });
  const data = await searchTorah('צדיק יסוד עולם', { limit: 20 });
  assert.deepEqual([...data.packs].sort(), CATALOG.packs.map(pack => pack.packId).sort(), 'restored before the first search');
  assert.ok(data.results.some(hit => hit.pack === 'chassidut'));
  assert.ok(data.results.some(hit => hit.pack === 'machshava'));
  assert.equal(catalogNow().source, 'bundled');
  for (const pack of CATALOG.packs) await removePack(pack.packId);
});

test('a pack left stale by an app update is not searched and is marked "update needed"', async () => {
  const { storage, store } = setup();
  await installPack('midrash');
  const registry = JSON.parse(storage.getItem('kz-torah-packs-v1'));
  registry.installed.midrash.index.stopTermsHash = '00000000';
  storage.setItem('kz-torah-packs-v1', JSON.stringify(registry));
  unregisterIndex('midrash');
  configurePackManager({ store, storage: () => storage, fetch: host().fetch, host: HOST, online: () => false, connection: async () => 'none', estimate: async () => null });
  await restoreInstalledPacks();
  assert.ok(!registeredPacks().some(pack => pack.id === 'midrash'));
  assert.equal(packStatuses().find(pack => pack.packId === 'midrash').status, 'update');
  await removePack('midrash');
});
