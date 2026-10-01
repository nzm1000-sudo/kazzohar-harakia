// הורדה לשימוש ללא רשת — optional audio packs (e.g. future Tehillim recordings) that the person may download to the
// device. None exists yet: the catalogue (packCatalog.mjs) is empty, and the screen shows this section only when at
// least one pack is listed. The manager is ready for them:
//   · nothing is downloaded without an explicit consent (download() refuses without { consent: true }),
//   · the manifest is validated before anything is shown (https only, safe file names, honest sizes, a licence),
//   · progress, the space each pack takes, the total used, and delete,
//   · files live in the app's private data directory (@capacitor/filesystem, Directory.Data) under audio-packs/<id>/.
// The manifest format is documented in docs/leatzmi/offline-audio-packs.md. Pure over injected fs / fetch / storage
// (tests/hitbodedutPacks.test.mjs).

export const PACKS_STATE_KEY = 'kz-audio-packs-v1';
export const PACKS_ROOT = 'audio-packs';
export const MANIFEST_VERSION = 1;
const ID = /^[a-z0-9][a-z0-9-]{1,47}$/;
const SAFE_PATH = /^(?!.*\.\.)(?!\/)[A-Za-z0-9._/-]{1,120}$/;
const AUDIO_EXT = /\.(m4a|mp3|aac|ogg|opus|wav|caf)$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_PACK_BYTES = 600 * 1024 * 1024;

// Returns { ok, errors, packs } — `packs` only the valid ones (an invalid pack is left out, never half-shown).
export function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest: not an object'], packs: [] };
  if (manifest.version !== MANIFEST_VERSION) errors.push(`manifest: version must be ${MANIFEST_VERSION}`);
  if (!Array.isArray(manifest.packs)) return { ok: false, errors: [...errors, 'manifest: packs must be an array'], packs: [] };
  const seen = new Set();
  const packs = [];
  manifest.packs.forEach((pack, index) => {
    const where = `packs[${index}]`;
    const problems = [];
    if (!pack || typeof pack !== 'object') { errors.push(`${where}: not an object`); return; }
    if (!ID.test(String(pack.id || ''))) problems.push('id: lowercase letters, digits and dashes');
    if (seen.has(pack.id)) problems.push('id: duplicate');
    if (!String(pack.title || '').trim()) problems.push('title: required');
    if (!String(pack.license || '').trim()) problems.push('license: required');
    if (!/^\d+\.\d+\.\d+$/.test(String(pack.version || ''))) problems.push('version: x.y.z');
    if (!Array.isArray(pack.files) || !pack.files.length) problems.push('files: at least one');
    let total = 0;
    const paths = new Set();
    (Array.isArray(pack.files) ? pack.files : []).forEach((file, fileIndex) => {
      const at = `files[${fileIndex}]`;
      if (!SAFE_PATH.test(String(file?.path || '')) || !AUDIO_EXT.test(String(file?.path || ''))) problems.push(`${at}.path: a safe relative audio file name`);
      if (paths.has(file?.path)) problems.push(`${at}.path: duplicate`);
      paths.add(file?.path);
      let url = null;
      try { url = new URL(String(file?.url || '')); } catch {}
      if (!url || url.protocol !== 'https:') problems.push(`${at}.url: https only`);
      if (!Number.isInteger(file?.bytes) || file.bytes <= 0) problems.push(`${at}.bytes: a positive whole number`);
      else total += file.bytes;
      if (file?.sha256 != null && !SHA256.test(String(file.sha256))) problems.push(`${at}.sha256: 64 hex characters`);
    });
    if (total > MAX_PACK_BYTES) problems.push('files: the pack is too large');
    if (Number.isInteger(pack.bytes) && pack.bytes !== total) problems.push('bytes: must equal the sum of the files');
    if (problems.length) { errors.push(...problems.map(problem => `${where} ${problem}`)); return; }
    seen.add(pack.id);
    packs.push({ ...pack, bytes: total });
  });
  return { ok: errors.length === 0, errors, packs };
}

// "12.4 מ״ב" / "820 ק״ב" — a size in Hebrew units.
export function formatBytes(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} ג״ב`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} מ״ב`;
  if (value >= 1024) return `${Math.round(value / 1024)} ק״ב`;
  return `${value} בתים`;
}

const readState = storage => {
  try { const raw = storage?.getItem(PACKS_STATE_KEY); const state = raw ? JSON.parse(raw) : null; return state && typeof state.installed === 'object' ? state : { installed: {} }; } catch { return { installed: {} }; }
};
const writeState = (storage, state) => { try { storage?.setItem(PACKS_STATE_KEY, JSON.stringify(state)); } catch {} };

async function sha256Hex(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// fs: { write(path, Uint8Array), remove(dir), exists?(path) } — capacitorFs.mjs in the app, a Map in the tests.
// fetcher: (url, { signal }) → Response-like { ok, status, arrayBuffer() } (or a body stream with getReader()).
export function createPackManager({ manifest = { version: MANIFEST_VERSION, packs: [] }, fs = null, fetcher = globalThis.fetch?.bind(globalThis), storage = null, verify = sha256Hex } = {}) {
  const { packs, errors } = validateManifest(manifest);
  const byId = new Map(packs.map(pack => [pack.id, pack]));
  const downloads = new Map();

  const manager = {
    errors,
    // True when there is anything to offer (the screen hides the whole section otherwise).
    get hasPacks() { return packs.length > 0; },

    list() {
      const state = readState(storage);
      return packs.map(pack => {
        const installed = state.installed[pack.id] || null;
        return {
          id: pack.id, title: pack.title, description: pack.description || '', license: pack.license, version: pack.version,
          bytes: pack.bytes, sizeText: formatBytes(pack.bytes), files: pack.files.length,
          installed: Boolean(installed), installedVersion: installed?.version || null,
          updateAvailable: Boolean(installed && installed.version !== pack.version),
          downloading: downloads.has(pack.id),
        };
      });
    },

    // The space the downloaded packs take (only what this manager wrote), and per pack.
    storageUsed() {
      const state = readState(storage);
      const entries = Object.entries(state.installed);
      const total = entries.reduce((sum, [, info]) => sum + (Number(info.bytes) || 0), 0);
      return { bytes: total, text: formatBytes(total), packs: entries.map(([id, info]) => ({ id, bytes: info.bytes })) };
    },

    // Downloads one pack. Requires { consent: true } — the person's explicit tap on "הורדה" after seeing the size.
    async download(id, { consent = false, onProgress = () => {}, signal } = {}) {
      if (consent !== true) throw new Error('consent-required');
      const pack = byId.get(id);
      if (!pack) throw new Error('unknown-pack');
      if (!fs || !fetcher) throw new Error('unavailable');
      if (downloads.has(id)) return downloads.get(id);
      const job = (async () => {
        let received = 0;
        const report = () => onProgress({ id, received, total: pack.bytes, fraction: pack.bytes ? Math.min(1, received / pack.bytes) : 0 });
        report();
        try {
          for (const file of pack.files) {
            const response = await fetcher(file.url, { signal });
            if (!response?.ok) throw new Error(`http-${response?.status || 0}`);
            const before = received;
            let bytes;
            if (response.body?.getReader) {
              const reader = response.body.getReader();
              const chunks = [];
              let length = 0;
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                length += value.length;
                received = before + length;
                report();
              }
              bytes = new Uint8Array(length);
              let offset = 0;
              for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
            } else {
              bytes = new Uint8Array(await response.arrayBuffer());
            }
            if (bytes.length !== file.bytes) throw new Error('size-mismatch');
            if (file.sha256 && verify) {
              const hash = await verify(bytes);
              if (hash && hash !== file.sha256) throw new Error('checksum-mismatch');
            }
            await fs.write(`${PACKS_ROOT}/${id}/${file.path}`, bytes);
            received = before + bytes.length;
            report();
          }
          const state = readState(storage);
          state.installed[id] = { version: pack.version, bytes: pack.bytes, at: Date.now() };
          writeState(storage, state);
          return manager.list().find(item => item.id === id);
        } catch (error) {
          // A failed or cancelled download leaves nothing half-written behind.
          try { await fs.remove(`${PACKS_ROOT}/${id}`); } catch {}
          throw error;
        } finally {
          downloads.delete(id);
        }
      })();
      downloads.set(id, job);
      return job;
    },

    async remove(id) {
      const state = readState(storage);
      if (fs) { try { await fs.remove(`${PACKS_ROOT}/${id}`); } catch {} }
      delete state.installed[id];
      writeState(storage, state);
      return manager.storageUsed();
    },

    // The local path of an installed pack's file (for a future player), or null.
    filePath(id, path) {
      const state = readState(storage);
      const pack = byId.get(id);
      if (!state.installed[id] || !pack?.files.some(file => file.path === path)) return null;
      return `${PACKS_ROOT}/${id}/${path}`;
    },
  };
  return manager;
}
