// Loading the full-text indexes: the built-in index ("core" — its manifest a small generated module imported lazily so
// it never weighs on the first paint; its files inside the app bundle, public/torah-index) and any installed pack's
// index (its files in the device's pack storage). Each file is fetched once, checksum-verified, decoded into typed arrays
// and kept in a small LRU per index. On the phone every search works with Wi-Fi and cellular off.
//
// Dynamic registration: an installed pack registers its index (registerIndex) and the next search includes it; a
// removed pack is unregistered and its results vanish at once. A pack whose index was built against another normalizer,
// binary format, stop-word list or another edition of a text is refused (INDEX_STALE) — never half-used.
import { workById } from '../../data/library/registry.mjs';
import { gunzipBytes } from '../library/inflate.mjs';
import { FORMAT_VERSION, bytesChecksum, decodeDocs, decodeShard } from './indexFormat.mjs';
import { NORMALIZER_VERSION, shardOf } from './hebrew.mjs';
import { stopTermsHash } from './packFormat.mjs';

const base = () => { try { return import.meta.env?.BASE_URL || '/'; } catch { return '/'; } };
export const indexUrl = (file, sum) => `${base()}torah-index/${file}?v=${sum}`;
export const INDEX_CHANGE_EVENT = 'kz-torah-index-change';

async function defaultLoad(file, sum) {
  const response = await fetch(indexUrl(file, sum));
  if (!response.ok) throw new Error('INDEX_UNAVAILABLE');
  return new Uint8Array(await response.arrayBuffer());
}

async function inflate(bytes) {
  if (!(bytes[0] === 0x1f && bytes[1] === 0x8b)) return bytes;
  if (typeof DecompressionStream !== 'undefined') return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  return gunzipBytes(bytes);
}

const SHARD_CACHE = 48;
const PACK_SHARD_CACHE = 16;
// One index: { id, title, manifest source, loader, the decoded docs, an LRU of decoded shards }.
function createHandle(id, { manifest, load, title = null, family = null, version = '', shardCache = SHARD_CACHE }) {
  return { id, title, family, version, source: typeof manifest === 'function' ? manifest : () => Promise.resolve(manifest), load, manifest: null, docs: null, shards: new Map(), shardCache };
}

const core = createHandle('core', { manifest: () => import('../../data/torah/searchIndex.mjs').then(module => module.default), load: defaultLoad });
const packs = new Map(); // id → handle, in registration order

// Tests (and tools) read the built-in files from disk: configureIndexLoader({ load: async file => bytes }).
export function configureIndexLoader({ load: loader = defaultLoad, manifest: source = null } = {}) {
  core.load = loader;
  if (source) core.source = source;
  core.manifest = null;
  core.docs = null;
  core.shards.clear();
}

async function handleManifest(handle) {
  if (!handle.manifest) handle.manifest = Promise.resolve().then(handle.source).catch(error => { handle.manifest = null; throw error; });
  return handle.manifest;
}
async function verified(handle, file, sum) {
  const bytes = await inflate(await handle.load(file, sum));
  if (bytesChecksum(bytes) !== sum) throw new Error('INDEX_CHECKSUM');
  return bytes;
}
export async function handleDocs(handle) {
  if (!handle.docs) {
    handle.docs = handleManifest(handle).then(async data => ({ ...decodeDocs(await verified(handle, data.docs.file, data.docs.checksum)), manifest: data, handle })).catch(error => { handle.docs = null; throw error; });
  }
  return handle.docs;
}
export async function handleShard(handle, index) {
  if (handle.shards.has(index)) {
    const hit = handle.shards.get(index);
    handle.shards.delete(index);
    handle.shards.set(index, hit);
    return hit;
  }
  const promise = handleManifest(handle).then(async data => {
    const [file, , sum] = data.shards[index];
    return decodeShard(await verified(handle, file, sum));
  });
  handle.shards.set(index, promise);
  promise.catch(() => handle.shards.delete(index));
  if (handle.shards.size > handle.shardCache) handle.shards.delete(handle.shards.keys().next().value);
  return promise;
}

// ---------- The built-in index (Stage 0 API, unchanged) ----------
export const loadManifest = () => handleManifest(core);
export const loadDocs = () => handleDocs(core);
export const loadShard = index => handleShard(core, index);
export const loadShardFor = term => loadShard(shardOf(term));
export const coreHandle = () => core;

// ---------- Installed packs ----------
// Is this pack's index usable with this app's built-in index and texts? → null, or the reason it is stale.
export function indexIncompatibility(indexManifest, coreManifest) {
  if (!indexManifest) return 'no index';
  if (indexManifest.normalizerVersion !== NORMALIZER_VERSION) return 'normalizer';
  if (indexManifest.formatVersion !== FORMAT_VERSION) return 'format';
  if (coreManifest && indexManifest.stopTermsHash !== stopTermsHash(coreManifest.stopTerms.map(([term]) => term))) return 'stop terms';
  // The index points at units of the app's own editions: a different edition of any text makes it stale.
  for (const [id, , , , sig, store] of indexManifest.works) if (store === 'pack' && workById(id)?.editions?.[0]?.checksum !== sig) return `edition of ${id}`;
  return null;
}
// registerIndex(id, { manifest (the pack's index manifest), load: async (file, sum) → bytes, title, family, version })
export async function registerIndex(id, { manifest, load, title = null, family = null, version = '' }) {
  if (id === 'core') throw new Error('INDEX_ID');
  const stale = indexIncompatibility(manifest, await loadManifest().catch(() => null));
  if (stale) { const error = new Error(`INDEX_STALE: ${stale}`); error.code = 'INDEX_STALE'; throw error; }
  packs.set(id, createHandle(id, { manifest, load, title, version, family: family || manifest.family || null, shardCache: PACK_SHARD_CACHE }));
  announce();
  return true;
}
export function unregisterIndex(id) {
  const had = packs.delete(id);
  if (had) announce();
  return had;
}
export const registeredPacks = () => [...packs.values()].map(handle => ({ id: handle.id, title: handle.title, family: handle.family }));
// Every index a search runs over: the built-in one first, then each installed pack.
export const activeHandles = () => [core, ...packs.values()];
export const handlesSignature = () => [...packs.values()].map(handle => `${handle.id}@${handle.version}`).join(',');
function announce() {
  try { globalThis.dispatchEvent?.(new Event(INDEX_CHANGE_EVENT)); } catch { /* no event target (tests) */ }
}

// Binary search of a term in a decoded shard → index or -1.
export function findTerm(shard, term) {
  let lo = 0;
  let hi = shard.terms.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const value = shard.terms[mid];
    if (value === term) return mid;
    if (value < term) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}
