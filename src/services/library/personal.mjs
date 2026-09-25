// Personal library state. Never mixed with canonical text and never touched by content updates or removal.
const KEY = 'kz-library-personal-v1';
const HISTORY_LIMIT = 30;
const EMPTY = () => ({ favorites: [], positions: {}, bookmarks: [], history: [] });

const storage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export function readPersonal(store = storage()) {
  try {
    const value = JSON.parse(store?.getItem(KEY) || 'null');
    return value && typeof value === 'object' ? { ...EMPTY(), ...value } : EMPTY();
  } catch { return EMPTY(); }
}
function write(value, store) {
  try { store?.setItem(KEY, JSON.stringify(value)); } catch { /* storage full or private mode */ }
  return value;
}

export function toggleFavorite(workId, store = storage()) {
  const state = readPersonal(store);
  const favorites = state.favorites.includes(workId) ? state.favorites.filter(id => id !== workId) : [workId, ...state.favorites];
  return write({ ...state, favorites }, store);
}

export function rememberPosition(workId, node, unit = null, store = storage(), now = new Date()) {
  const state = readPersonal(store);
  const at = now.toISOString();
  const history = [{ workId, node, at }, ...state.history.filter(item => item.workId !== workId)].slice(0, HISTORY_LIMIT);
  return write({ ...state, positions: { ...state.positions, [workId]: { node, unit, at } }, history }, store);
}

export function toggleBookmark(workId, node, unit, store = storage(), now = new Date()) {
  const state = readPersonal(store);
  const same = item => item.workId === workId && item.node === node && item.unit === unit;
  const bookmarks = state.bookmarks.some(same) ? state.bookmarks.filter(item => !same(item)) : [{ workId, node, unit, at: now.toISOString() }, ...state.bookmarks];
  return write({ ...state, bookmarks }, store);
}

export const isBookmarked = (state, workId, node, unit) => state.bookmarks.some(item => item.workId === workId && item.node === node && item.unit === unit);
