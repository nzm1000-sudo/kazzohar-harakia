const STORAGE_KEY = 'kz-content-cache-v1';
const LIMITS = { tehillim: 5, talmud: 5, source: 10, siddur: 5 };

function readStore() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* Storage may be unavailable or full. */ }
}

function cacheKey(type, key) { return `${type}:${key}`; }

export function canCacheContent(record) {
  const license = [record?.license, record?.baseVersion?.license, record?.steinsaltzVersion?.license, ...(record?.licenses || [])].filter(Boolean).join(' ').toLowerCase();
  return !/(all rights reserved|no redistribution|do not redistribute|לא להפצה|זכויות שמורות בלבד|restricted)/i.test(license);
}

export function readContentCache(type, key) {
  const item = readStore()[cacheKey(type, key)];
  return item ? { ...item.data, offlineCached: true } : null;
}

export function writeContentCache(type, key, data) {
  if (!data || !canCacheContent(data)) return;
  const store = readStore();
  const nextOrder = Object.values(store).reduce((max, item) => Math.max(max, Number(item?.order) || 0), 0) + 1;
  store[cacheKey(type, key)] = { data, savedAt: Date.now(), order: nextOrder };
  const entries = Object.entries(store)
    .filter(([, item]) => item?.data)
    .sort(([, a], [, b]) => (b.savedAt || 0) - (a.savedAt || 0) || (b.order || 0) - (a.order || 0));
  const kept = {};
  for (const [entryKey, item] of entries) {
    const entryType = entryKey.split(':', 1)[0];
    const limit = LIMITS[entryType] || 0;
    const count = Object.keys(kept).filter(k => k.startsWith(`${entryType}:`)).length;
    if (limit && count < limit) kept[entryKey] = item;
  }
  writeStore(kept);
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

export const contentCacheLimits = { ...LIMITS };