// Loading the full-text index: the manifest (a small generated module, imported lazily so it never weighs on the first
// paint), the document table and the term shards — each file fetched once, checksum-verified, decoded into typed arrays
// and kept in a small LRU. The files ship inside the app bundle (public/torah-index), so on the phone every search
// works with Wi-Fi and cellular off; on the web the service worker keeps what was fetched.
import { gunzipBytes } from '../library/inflate.mjs';
import { bytesChecksum, decodeDocs, decodeShard } from './indexFormat.mjs';
import { shardOf } from './hebrew.mjs';

const base = () => { try { return import.meta.env?.BASE_URL || '/'; } catch { return '/'; } };
export const indexUrl = (file, sum) => `${base()}torah-index/${file}?v=${sum}`;

async function defaultLoad(file, sum) {
  const response = await fetch(indexUrl(file, sum));
  if (!response.ok) throw new Error('INDEX_UNAVAILABLE');
  return new Uint8Array(await response.arrayBuffer());
}
let load = defaultLoad;
let manifestSource = () => import('../../data/torah/searchIndex.mjs').then(module => module.default);

async function inflate(bytes) {
  if (!(bytes[0] === 0x1f && bytes[1] === 0x8b)) return bytes;
  if (typeof DecompressionStream !== 'undefined') return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  return gunzipBytes(bytes);
}

let manifest = null;
let docs = null;
const shards = new Map();
const SHARD_CACHE = 48;

// Tests (and tools) read the files from disk: configureIndexLoader({ load: async file => bytes }).
export function configureIndexLoader({ load: loader = defaultLoad, manifest: source = null } = {}) {
  load = loader;
  if (source) manifestSource = source;
  manifest = null;
  docs = null;
  shards.clear();
}

export async function loadManifest() {
  if (!manifest) manifest = manifestSource().catch(error => { manifest = null; throw error; });
  return manifest;
}

async function verified(file, sum) {
  const bytes = await inflate(await load(file, sum));
  if (bytesChecksum(bytes) !== sum) throw new Error('INDEX_CHECKSUM');
  return bytes;
}

export async function loadDocs() {
  if (!docs) {
    docs = loadManifest().then(async data => ({ ...decodeDocs(await verified(data.docs.file, data.docs.checksum)), manifest: data })).catch(error => { docs = null; throw error; });
  }
  return docs;
}

export async function loadShard(index) {
  if (shards.has(index)) {
    const hit = shards.get(index);
    shards.delete(index);
    shards.set(index, hit);
    return hit;
  }
  const promise = loadManifest().then(async data => {
    const [file, , sum] = data.shards[index];
    return decodeShard(await verified(file, sum));
  });
  shards.set(index, promise);
  promise.catch(() => shards.delete(index));
  if (shards.size > SHARD_CACHE) shards.delete(shards.keys().next().value);
  return promise;
}
export const loadShardFor = term => loadShard(shardOf(term));

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
