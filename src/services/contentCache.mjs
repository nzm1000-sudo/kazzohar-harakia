const STORAGE_KEY = 'kz-content-cache-v1';
const LIMITS = { tehillim: 5, talmud: 12, commentary: 60, source: 10, siddur: 5, scan: 2 };
const PIN_LIMIT = 30;
const MAX_CACHE_BYTES = 4 * 1024 * 1024;

function readStore() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (value?.entries && typeof value.entries === 'object') return { entries: value.entries };
    const entries = Object.fromEntries(Object.entries(value || {}).map(([key, item]) => [key, { ...item, pinned: false }]));
    return { entries };
  } catch {
    return { entries: {} };
  }
}

function writeStore(store) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* Storage may be unavailable or full. */ }
}

function cacheKey(type, key) { return `${type}:${key}`; }
function serializedBytes(entries) { return JSON.stringify({ entries }).length; }

export function canCacheContent(record) {
  const license = [record?.license, record?.baseVersion?.license, record?.steinsaltzVersion?.license, ...(record?.licenses || [])].filter(Boolean).join(' ').toLowerCase();
  if (!license) return false;
  if (/(all rights reserved|no redistribution|do not redistribute|לא להפצה|זכויות שמורות בלבד|restricted)/i.test(license)) return false;
  return /(cc0|cc-by|public domain|נחלת הציבור)/i.test(license);
}

export function readContentCache(type, key) {
  const item = readStore().entries[cacheKey(type, key)];
  return item ? { ...item.data, offlineCached: true } : null;
}

export function isContentPinned(type, key) {
  return Boolean(readStore().entries[cacheKey(type, key)]?.pinned);
}

export function writeContentCache(type, key, data, { pinned = false } = {}) {
  if (!data || !canCacheContent(data)) return false;
  const store = readStore();
  const entryKey = cacheKey(type, key);
  const alreadyPinned = Boolean(store.entries[entryKey]?.pinned);
  const pinCount = Object.values(store.entries).filter(item => item?.pinned).length;
  if (pinned && !alreadyPinned && pinCount >= PIN_LIMIT) return false;
  const nextOrder = Object.values(store.entries).reduce((max, item) => Math.max(max, Number(item?.order) || 0), 0) + 1;
  store.entries[entryKey] = { data, savedAt: Date.now(), order: nextOrder, pinned: pinned || alreadyPinned };
  const entries = Object.entries(store.entries)
    .filter(([, item]) => item?.data)
    .sort(([, a], [, b]) => (b.savedAt || 0) - (a.savedAt || 0) || (b.order || 0) - (a.order || 0));
  const kept = {};
  for (const [entryKey, item] of entries) {
    const entryType = entryKey.split(':', 1)[0];
    const limit = LIMITS[entryType] || 0;
    const count = Object.keys(kept).filter(k => k.startsWith(`${entryType}:`)).length;
    if (item.pinned || (limit && count < limit)) kept[entryKey] = item;
  }
  while (serializedBytes(kept) > MAX_CACHE_BYTES) {
    const removable = Object.entries(kept)
      .filter(([, item]) => !item.pinned)
      .sort(([, a], [, b]) => (a.savedAt || 0) - (b.savedAt || 0) || (a.order || 0) - (b.order || 0))[0];
    if (!removable) return false;
    delete kept[removable[0]];
  }
  writeStore({ entries: kept });
  return true;
}

export function pinContent(type, key, data) {
  return writeContentCache(type, key, data, { pinned: true });
}

export function unpinContent(type, key) {
  const store = readStore();
  const item = store.entries[cacheKey(type, key)];
  if (!item) return false;
  item.pinned = false;
  writeStore(store);
  return true;
}

export function listContentCache() {
  return Object.entries(readStore().entries).map(([entryKey, item]) => {
    const split = entryKey.indexOf(':');
    return { type: entryKey.slice(0, split), key: entryKey.slice(split + 1), data: item.data, pinned: Boolean(item.pinned), savedAt: item.savedAt || 0 };
  }).sort((a, b) => b.savedAt - a.savedAt);
}

export function clearRecentCache() {
  const store = readStore();
  store.entries = Object.fromEntries(Object.entries(store.entries).filter(([, item]) => item.pinned));
  writeStore(store);
}

export function contentCacheStats() {
  const entries = listContentCache();
  const serialized = entry => JSON.stringify(entry.data).length;
  return {
    entries,
    bytes: entries.reduce((sum, entry) => sum + serialized(entry), 0),
    pinnedBytes: entries.filter(entry => entry.pinned).reduce((sum, entry) => sum + serialized(entry), 0),
    recentBytes: entries.filter(entry => !entry.pinned).reduce((sum, entry) => sum + serialized(entry), 0),
    limits: { ...LIMITS },
    pinLimit: PIN_LIMIT,
    maxBytes: MAX_CACHE_BYTES,
  };
}

export async function withContentCache(type, key, loader) {
  if (navigator.onLine === false) {
    const cached = readContentCache(type, key);
    if (cached) return cached;
    throw new Error('אין חיבור לאינטרנט והתוכן הזה עדיין לא נשמר במכשיר');
  }
  try {
    const data = await loader();
    writeContentCache(type, key, data);
    return data;
  } catch (error) {
    const cached = readContentCache(type, key);
    if (cached) return cached;
    throw error;
  }
}

export const contentCacheLimits = { ...LIMITS, pinLimit: PIN_LIMIT, maxBytes: MAX_CACHE_BYTES };