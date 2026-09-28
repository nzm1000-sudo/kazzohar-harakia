// Personal collections ("האוספים שלי"): named groups of saved items, on the device only. An item is the same shape
// favorites use ({ key, kind, title, subtitle?, open }), so anything with a heart can also go into a collection, and
// one item may sit in several collections. Favorites themselves are untouched (kz-favorites-v1).
const KEY = 'kz-collections-v1';
const EVENT = 'kz-collections-change';
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const read = storage => { try { const value = JSON.parse(storage?.getItem(KEY) || '[]'); return Array.isArray(value) ? value.filter(item => item?.id && item.name) : []; } catch { return []; } };
function write(list, storage) {
  try { storage?.setItem(KEY, JSON.stringify(list)); } catch { /* keep the in-memory answer */ }
  try { globalThis.dispatchEvent?.(new Event(EVENT)); } catch { /* no window */ }
  return list;
}
const slug = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const SUGGESTED_COLLECTIONS = ['שבת', 'תפילה', 'ברכות', 'ללמוד', 'לזכור', 'נסיעות', 'למשפחה'];
export const readCollections = (storage = store()) => read(storage);
export const collectionById = (id, storage = store()) => read(storage).find(item => item.id === id) || null;

export function createCollection(name, storage = store(), now = new Date()) {
  const clean = String(name || '').trim().slice(0, 40);
  if (!clean) return null;
  const list = read(storage);
  const existing = list.find(item => item.name === clean);
  if (existing) return existing;
  const collection = { id: slug(), name: clean, items: [], createdAt: now.toISOString() };
  write([...list, collection], storage);
  return collection;
}
export function renameCollection(id, name, storage = store()) {
  const clean = String(name || '').trim().slice(0, 40);
  if (!clean) return read(storage);
  return write(read(storage).map(item => item.id === id ? { ...item, name: clean } : item), storage);
}
export const deleteCollection = (id, storage = store()) => write(read(storage).filter(item => item.id !== id), storage);
export const inCollection = (id, key, storage = store()) => Boolean(collectionById(id, storage)?.items.some(item => item.key === key));
export function toggleInCollection(id, item, storage = store(), now = new Date()) {
  return write(read(storage).map(collection => {
    if (collection.id !== id) return collection;
    const has = collection.items.some(entry => entry.key === item.key);
    return { ...collection, items: has ? collection.items.filter(entry => entry.key !== item.key) : [{ ...item, at: now.toISOString() }, ...collection.items] };
  }), storage);
}
export const collectionsFor = (key, storage = store()) => read(storage).filter(collection => collection.items.some(item => item.key === key));
export function onCollectionsChange(listener) {
  const handler = () => listener();
  globalThis.addEventListener?.(EVENT, handler);
  globalThis.addEventListener?.('storage', handler);
  return () => { globalThis.removeEventListener?.(EVENT, handler); globalThis.removeEventListener?.('storage', handler); };
}
