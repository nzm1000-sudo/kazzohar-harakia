// Content packs: checksum-verified loading and per-book offline download.
// Downloads live in their own Cache Storage bucket (not the app-shell cache), so shell updates never evict them.
import { checksum } from '../prayer/checksum.mjs';

export const LIBRARY_CACHE = 'kzlib-v1';
const DOWNLOADS_KEY = 'kz-library-downloads-v1';
const memory = new Map();

const base = () => {
  try { return import.meta.env?.BASE_URL || '/'; } catch { return '/'; }
};
export const packUrl = edition => `${base()}library/packs/${edition.packId}/${edition.file}?v=${edition.checksum}`;

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

async function cachedText(url) {
  if (typeof caches === 'undefined') return null;
  const hit = await (await caches.open(LIBRARY_CACHE)).match(url);
  return hit ? hit.text() : null;
}

export async function loadEditionChunk(edition, { fetchImpl = globalThis.fetch } = {}) {
  if (memory.has(edition.editionId)) return memory.get(edition.editionId);
  const url = packUrl(edition);
  let text = await cachedText(url).catch(() => null);
  if (text === null) {
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error('הספר אינו זמין כרגע במכשיר.');
    text = await response.text();
  }
  const chunk = verifyChunkText(text, edition);
  if (memory.size > 6) memory.delete(memory.keys().next().value);
  memory.set(edition.editionId, chunk);
  return chunk;
}

// Atomic: the downloaded file is verified before it replaces anything; a failed update keeps the previous copy.
export async function downloadEdition(edition, { fetchImpl = globalThis.fetch, store = storage() } = {}) {
  if (typeof caches === 'undefined') throw new Error('המכשיר אינו תומך בשמירה לקריאה ללא אינטרנט.');
  const url = packUrl(edition);
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('ההורדה נכשלה; העותק הקודם נשמר.');
  const text = await response.text();
  verifyChunkText(text, edition);
  const cache = await caches.open(LIBRARY_CACHE);
  const previous = readDownloads(store)[edition.editionId];
  await cache.put(url, new Response(text, { headers: { 'Content-Type': 'application/json' } }));
  if (previous && previous.url !== url) await cache.delete(previous.url);
  writeDownloads({ ...readDownloads(store), [edition.editionId]: { url, checksum: edition.checksum, bytes: text.length, at: new Date().toISOString() } }, store);
  return true;
}

// Removes only the content copy; favorites, bookmarks, positions and history are stored separately and stay.
export async function removeEdition(edition, { store = storage() } = {}) {
  const entry = readDownloads(store)[edition.editionId];
  if (entry && typeof caches !== 'undefined') await (await caches.open(LIBRARY_CACHE)).delete(entry.url);
  const next = { ...readDownloads(store) };
  delete next[edition.editionId];
  writeDownloads(next, store);
  memory.delete(edition.editionId);
}

export function downloadState(edition, store = storage()) {
  const entry = readDownloads(store)[edition.editionId];
  if (!entry) return 'none';
  return entry.checksum === edition.checksum ? 'current' : 'outdated';
}
