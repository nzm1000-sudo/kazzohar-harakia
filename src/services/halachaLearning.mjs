// "למדתי" and light recall. Learning marks and recall times stay on the device. Recall is optional and spaced
// (after 2, 7 and 30 days), one prompt at a time, with no streaks, scores or pressure.
const KEY = 'kz-halacha-learned-v1';
const DAY = 24 * 60 * 60 * 1000;
export const RECALL_INTERVALS = [2, 7, 30];
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const read = storage => { try { const value = JSON.parse(storage?.getItem(KEY) || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; } };
const write = (value, storage) => { try { storage?.setItem(KEY, JSON.stringify(value)); } catch { /* ignore */ } return value; };

export const readLearned = (storage = store()) => read(storage);
export const isLearned = (id, storage = store()) => Boolean(read(storage)[id]);
export function toggleLearned(id, storage = store(), now = Date.now()) {
  const all = read(storage);
  if (all[id]) { delete all[id]; return write(all, storage); }
  return write({ ...all, [id]: { at: now, recalls: 0, next: now + RECALL_INTERVALS[0] * DAY } }, storage);
}
// The one entry due for a recall prompt now (oldest due first), or null.
export function dueRecall(storage = store(), now = Date.now(), exists = () => true) {
  const due = Object.entries(read(storage)).filter(([id, item]) => item.next && item.next <= now && exists(id)).sort((a, b) => a[1].next - b[1].next)[0];
  return due ? due[0] : null;
}
// After a recall (or "later"), schedule the next one; after the last interval the entry is simply learned.
export function recalled(id, storage = store(), now = Date.now(), { later = false } = {}) {
  const all = read(storage);
  const item = all[id];
  if (!item) return all;
  if (later) { all[id] = { ...item, next: now + DAY }; return write(all, storage); }
  const recalls = item.recalls + 1;
  all[id] = { ...item, recalls, next: recalls < RECALL_INTERVALS.length ? now + RECALL_INTERVALS[recalls] * DAY : null };
  return write(all, storage);
}
export function trackProgress(track, storage = store()) {
  const learned = read(storage);
  const done = track.entryIds.filter(id => learned[id]).length;
  return { done, total: track.entryIds.length, nextId: track.entryIds.find(id => !learned[id]) || null };
}
