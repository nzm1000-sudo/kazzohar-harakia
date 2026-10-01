// Which divrei torah this device has read (an article opened and read to its end, or studied a full minute). Kept on the
// device only — ids and dates, nothing else — so the weekly selection can prefer what has not been read yet.
const KEY = 'kz-torah-read-v1';
const LIMIT = 600;
const storage = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export function readTorahHistory(store = storage()) {
  try { const list = JSON.parse(store?.getItem(KEY) || '[]'); return Array.isArray(list) ? list.filter(entry => entry && typeof entry.id === 'string') : []; } catch { return []; }
}
export const readTorahIds = (store = storage()) => readTorahHistory(store).map(entry => entry.id);
export const isTorahRead = (id, store = storage()) => readTorahIds(store).includes(id);

export function markTorahRead(id, { store = storage(), now = new Date() } = {}) {
  if (!id) return readTorahHistory(store);
  const list = [{ id, at: now.toISOString() }, ...readTorahHistory(store).filter(entry => entry.id !== id)].slice(0, LIMIT);
  try { store?.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or private mode */ }
  return list;
}
