const STORAGE_KEY = 'kz-content-cache-v1';
const LIMITS = { tehillim: 5, talmud: 5, commentary: 60, source: 10, siddur: 5, scan: 2 };
const PIN_LIMIT = 30;
const MAX_CACHE_BYTES = 4 * 1024 * 1024;
const DEBUG_KEY = 'kz-content-cache-debug-v1';

function readDiagnostics() {
  try { return JSON.parse(localStorage.getItem(DEBUG_KEY) || '{}'); } catch { return {}; }
}

function recordDiagnostics(update) {
  try {
    const current = readDiagnostics();
    localStorage.setItem(DEBUG_KEY, JSON.stringify({ ...current, ...update, updatedAt: new Date().toISOString() }));
  } catch {}
}

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
  try {
    const serialized = JSON.stringify(store);
    localStorage.setItem(STORAGE_KEY, serialized);
    const verified = localStorage.getItem(STORAGE_KEY) === serialized;
    if (!verified) recordDiagnostics({ lastWriteResult: false, lastWriteVerification: false, lastWriteError: 'read-back mismatch' });
    return verified;
  } catch (error) {
    recordDiagnostics({ lastWriteResult: false, lastWriteVerification: false, lastWriteError: String(error?.message || error) });
    return false;
  }
}

function cacheKey(type, key) { return `${type}:${key}`; }
function serializedBytes(entries) { return new TextEncoder().encode(JSON.stringify({ entries })).length; }

function pruneEntries(entries) {
  const sorted = Object.entries(entries)
    .filter(([, item]) => item?.data)
    .sort(([, a], [, b]) => (b.savedAt || 0) - (a.savedAt || 0) || (b.order || 0) - (a.order || 0));
  const kept = {};
  for (const [entryKey, item] of sorted) {
    const entryType = entryKey.split(':', 1)[0];
    const limit = LIMITS[entryType] || 0;
    const count = Object.entries(kept).filter(([k, keptItem]) => k.startsWith(`${entryType}:`) && !keptItem.pinned).length;
    if (item.pinned || (limit && count < limit)) kept[entryKey] = item;
  }
  while (serializedBytes(kept) > MAX_CACHE_BYTES) {
    const removable = Object.entries(kept)
      .filter(([, item]) => !item.pinned)
      .sort(([, a], [, b]) => (a.savedAt || 0) - (b.savedAt || 0) || (a.order || 0) - (b.order || 0))[0];
    if (!removable) return null;
    delete kept[removable[0]];
  }
  return kept;
}

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

export function getContentCacheDiagnostics() {
  const diagnostics = readDiagnostics();
  const stats = contentCacheStats();
  return {
    ...diagnostics,
    slotCount: LIMITS.talmud,
    autoEntryCount: stats.entries.filter(entry => entry.type === 'talmud' && !entry.pinned).length,
    keys: stats.entries.filter(entry => entry.type === 'talmud').map(entry => `${entry.pinned ? 'pinned:' : 'auto:'}${entry.key}`),
    bytesByEntry: stats.entries.filter(entry => entry.type === 'talmud').map(entry => ({ key: entry.key, pinned: entry.pinned, bytes: entry.bytes })),
    totalBytes: stats.serializedBytes,
    ceilingBytes: MAX_CACHE_BYTES,
  };
}

export function isContentPinned(type, key) {
  return Boolean(readStore().entries[cacheKey(type, key)]?.pinned);
}

export function writeContentCache(type, key, data, { pinned = false } = {}) {
  if (!data || !canCacheContent(data)) return false;
  const store = readStore();
  const entryKey = cacheKey(type, key);
  const existing = store.entries[entryKey];
  const cacheData = existing?.pinned && existing.data?.commentaryCache && !data.commentaryCache
    ? { ...data, commentaryCache: existing.data.commentaryCache }
    : data;
  const alreadyPinned = Boolean(store.entries[entryKey]?.pinned);
  const pinCount = Object.values(store.entries).filter(item => item?.pinned).length;
  if (pinned && !alreadyPinned && pinCount >= PIN_LIMIT) return false;
  const nextOrder = Object.values(store.entries).reduce((max, item) => Math.max(max, Number(item?.order) || 0), 0) + 1;
  store.entries[entryKey] = { data: cacheData, savedAt: Date.now(), order: nextOrder, pinned: pinned || alreadyPinned };
  const kept = pruneEntries(store.entries);
  if (!kept) {
    recordDiagnostics({ lastWriteResult: false, lastWriteVerification: false, lastWriteKey: entryKey, lastEvictionReason: 'cache ceiling: only pinned entries could be retained' });
    return false;
  }
  const evicted = Object.keys(store.entries).filter(key => !kept[key]);
  const writeResult = writeStore({ entries: kept });
  recordDiagnostics({
    lastWriteResult: writeResult,
    lastWriteVerification: writeResult,
    lastWriteKey: entryKey,
    lastEvictionReason: evicted.length ? `evicted: ${evicted.join(', ')}` : 'none',
    lastWriteError: writeResult ? null : readDiagnostics().lastWriteError || 'write failed',
  });
  return writeResult;
}

export function pinContent(type, key, data) {
  return writeContentCache(type, key, data, { pinned: true });
}

export function unpinContent(type, key) {
  const store = readStore();
  const item = store.entries[cacheKey(type, key)];
  if (!item) return false;
  item.pinned = false;
  const kept = pruneEntries(store.entries);
  if (!kept) {
    item.pinned = true;
    return false;
  }
  return writeStore({ entries: kept });
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
  const serialized = entry => new TextEncoder().encode(JSON.stringify(entry.data)).length;
  return {
    entries: entries.map(entry => ({ ...entry, bytes: serialized(entry) })),
    bytes: entries.reduce((sum, entry) => sum + serialized(entry), 0),
    serializedBytes: entries.reduce((sum, entry) => sum + serialized(entry), 0),
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