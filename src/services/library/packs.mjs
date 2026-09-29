// Content packs: checksum-verified loading and per-book offline download.
// Downloads live in their own Cache Storage bucket (not the app-shell cache), so shell updates never evict them.
import { checksum } from '../prayer/checksum.mjs';
import { gunzipBytes } from './inflate.mjs';

export const LIBRARY_CACHE = 'kzlib-v1';
const DOWNLOADS_KEY = 'kz-library-downloads-v1';
const memory = new Map();

const base = () => {
  try { return import.meta.env?.BASE_URL || '/'; } catch { return '/'; }
};
export const packUrl = edition => `${base()}library/packs/${edition.packId}/${edition.file}?v=${edition.checksum}`;

// Native builds ship every pack inside the app bundle, so they are always readable offline.
// (iOS serves from capacitor://, which Cache Storage rejects, so "download" could never work there.)
export const packsBundledWithApp = () => {
  try { return globalThis.Capacitor?.isNativePlatform?.() === true; } catch { return false; }
};

const storage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export function readDownloads(store = storage()) {
  try { return JSON.parse(store?.getItem(DOWNLOADS_KEY) || '{}') || {}; } catch { return {}; }
}
function writeDownloads(value, store = storage()) {
  try { store?.setItem(DOWNLOADS_KEY, JSON.stringify(value)); } catch { /* storage full or private mode */ }
}

export function verifyChunkText(text, edition) {
  if (checksum(text) !== edition.checksum) throw new Error('חבילת התוכן אינה תואמת לחתימה שלה ולכן לא נפתחה.');
  const chunk = JSON.parse(text);
  if (chunk.editionId !== edition.editionId) throw new Error('חבילת התוכן שייכת למהדורה אחרת.');
  return chunk;
}

// A pack file is plain JSON or gzip-compressed JSON (recognised by its magic bytes, whatever the server's headers).
// Where the WebView has no DecompressionStream (iOS before 16.4) the same bytes are inflated in JavaScript.
export async function packBytesToText(bytes, { native = typeof DecompressionStream !== 'undefined' } = {}) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data[0] === 0x1f && data[1] === 0x8b) {
    if (native) return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    try { return new TextDecoder().decode(gunzipBytes(data)); } catch { throw new Error('המכשיר אינו תומך בפתיחת ספר דחוס.'); }
  }
  return new TextDecoder().decode(data);
}

async function cachedText(url) {
  if (typeof caches === 'undefined') return null;
  const hit = await (await caches.open(LIBRARY_CACHE)).match(url);
  return hit ? packBytesToText(await hit.arrayBuffer()) : null;
}

// A large work may be stored in files by node range (the Shulchan Arukh's commentaries, by siman): each file is a chunk of
// the same edition with its own checksum, and a node loads only the file that holds it.
export const editionPartFor = (edition, node) => (edition.parts?.length ? edition.parts.find(part => node >= part.from && node <= part.to) || edition.parts[0] : null);
const fileEdition = (edition, part) => (part ? { ...edition, file: part.file, checksum: part.checksum } : edition);
export const editionFiles = edition => (edition.parts?.length ? edition.parts.map(part => fileEdition(edition, part)) : [edition]);

export async function loadEditionChunk(edition, { fetchImpl = globalThis.fetch, node = 1 } = {}) {
  const part = editionPartFor(edition, node);
  const target = fileEdition(edition, part);
  const key = part ? `${edition.editionId}#${part.file}` : edition.editionId;
  if (memory.has(key)) {
    // Least recently used goes first: a hit moves the chunk to the end (an amud keeps its tractate's files at hand).
    const hit = memory.get(key);
    memory.delete(key);
    memory.set(key, hit);
    return hit;
  }
  const url = packUrl(target);
  let text = await cachedText(url).catch(() => null);
  if (text === null) {
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error('הספר אינו זמין כרגע במכשיר.');
    text = await packBytesToText(await response.arrayBuffer());
  }
  const chunk = verifyChunkText(text, target);
  if (memory.size > 6) memory.delete(memory.keys().next().value);
  memory.set(key, chunk);
  return chunk;
}

// The whole edition as one chunk (every range file, in order): for validation, never for reading.
export async function loadWholeEdition(edition, options = {}) {
  if (!edition.parts?.length) return loadEditionChunk(edition, options);
  const chunks = [];
  for (const part of edition.parts) chunks.push(await loadEditionChunk(edition, { ...options, node: part.from }));
  const { range, ...first } = chunks[0];
  return { ...first, nodes: chunks.flatMap(chunk => chunk.nodes) };
}

// A side file of a pack (a layer's anchors…): checksum-verified like a chunk, cached in memory.
const sideFiles = new Map();
export async function loadPackJson({ packId, file, checksum: expected }, { fetchImpl = globalThis.fetch } = {}) {
  const key = `${packId}/${file}`;
  if (sideFiles.has(key)) return sideFiles.get(key);
  const url = `${base()}library/packs/${packId}/${file}?v=${expected}`;
  let text = await cachedText(url).catch(() => null);
  if (text === null) {
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error('הקובץ אינו זמין כרגע במכשיר.');
    text = await packBytesToText(await response.arrayBuffer());
  }
  if (checksum(text) !== expected) throw new Error('חבילת התוכן אינה תואמת לחתימה שלה ולכן לא נפתחה.');
  const data = JSON.parse(text);
  sideFiles.set(key, data);
  return data;
}

// Atomic: the downloaded file is verified before it replaces anything; a failed update keeps the previous copy.
// Every file of the edition (one, or one per node range) is fetched and verified before any of them is stored.
export async function downloadEdition(edition, { fetchImpl = globalThis.fetch, store = storage() } = {}) {
  if (typeof caches === 'undefined') throw new Error('המכשיר אינו תומך בשמירה לקריאה ללא אינטרנט.');
  const files = [];
  for (const target of editionFiles(edition)) {
    const url = packUrl(target);
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('ההורדה נכשלה; העותק הקודם נשמר.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    verifyChunkText(await packBytesToText(bytes), target);
    files.push({ url, bytes, gz: /\.gz$/.test(target.file) });
  }
  const cache = await caches.open(LIBRARY_CACHE);
  const previous = readDownloads(store)[edition.editionId];
  // The copy on the device stays as it arrived (compressed packs stay compressed).
  for (const file of files) await cache.put(file.url, new Response(file.bytes, { headers: { 'Content-Type': file.gz ? 'application/gzip' : 'application/json' } }));
  const urls = files.map(file => file.url);
  for (const old of previous ? previous.urls || [previous.url] : []) if (!urls.includes(old)) await cache.delete(old);
  writeDownloads({ ...readDownloads(store), [edition.editionId]: { url: urls[0], ...(urls.length > 1 ? { urls } : {}), checksum: edition.checksum, bytes: files.reduce((total, file) => total + file.bytes.length, 0), at: new Date().toISOString() } }, store);
  return true;
}

// Removes only the content copy; favorites, bookmarks, positions and history are stored separately and stay.
export async function removeEdition(edition, { store = storage() } = {}) {
  const entry = readDownloads(store)[edition.editionId];
  if (entry && typeof caches !== 'undefined') { const cache = await caches.open(LIBRARY_CACHE); for (const url of entry.urls || [entry.url]) await cache.delete(url); }
  const next = { ...readDownloads(store) };
  delete next[edition.editionId];
  writeDownloads(next, store);
  for (const key of [...memory.keys()]) if (key === edition.editionId || key.startsWith(`${edition.editionId}#`)) memory.delete(key);
}

export function downloadState(edition, store = storage()) {
  if (packsBundledWithApp()) return 'current';
  const entry = readDownloads(store)[edition.editionId];
  if (!entry) return 'none';
  return entry.checksum === edition.checksum ? 'current' : 'outdated';
}
