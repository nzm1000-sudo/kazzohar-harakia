// One heart everywhere: a saved item is both a favourite and a bookmark, kept on the device only.
// Each item knows how to reopen itself: { key, kind, title, subtitle?, open: { type: 'source' | 'psalm' | 'route', ... }, at }.
// The earlier separate hearts (Tehillim chapters, texts "saved to the library") are carried over once.
import { tehillimTitle } from './tehillimPresentation.mjs';

const KEY = 'kz-favorites-v1';
const MIGRATED = 'kz-favorites-migrated-v1';
const EVENT = 'kz-favorites-change';

const storage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const readJSON = (store, key, fallback) => { try { const value = JSON.parse(store?.getItem(key) ?? 'null'); return value ?? fallback; } catch { return fallback; } };

export const psalmFavorite = chapter => ({ key: `psalm:${chapter}`, kind: 'tehillim', title: tehillimTitle(chapter), open: { type: 'psalm', chapter } });
export const sourceFavorite = (reference, title, mode = 'nikud') => ({ key: `source:${reference}`, kind: /^(?:Weekday |Shabbat )?Siddur |^Haggadah |^Selichot /.test(reference) ? 'prayer' : 'source', title: title || reference, open: { type: 'source', reference, title: title || reference, mode } });
export const routeFavorite = (kind, route, title, subtitle) => ({ key: `route:${route}`, kind, title, subtitle, open: { type: 'route', route } });

function migrate(store) {
  if (!store || store.getItem(MIGRATED)) return;
  const current = readJSON(store, KEY, []);
  const have = new Set(current.map(item => item.key));
  const legacy = [
    ...readJSON(store, 'tehillim-favorites-v1', []).filter(Number.isInteger).map(psalmFavorite),
    ...readJSON(store, 'source-favorites', []).filter(ref => typeof ref === 'string').map(ref => sourceFavorite(ref, ref)),
  ].filter(item => !have.has(item.key)).map(item => ({ ...item, at: new Date(0).toISOString() }));
  try {
    store.setItem(KEY, JSON.stringify([...current, ...legacy]));
    store.setItem(MIGRATED, '1');
  } catch { /* storage full or private mode: try again next time */ }
}

export function readFavorites(store = storage()) {
  migrate(store);
  const items = readJSON(store, KEY, []);
  return Array.isArray(items) ? items.filter(item => item && item.key && item.open) : [];
}

function write(items, store) {
  try { store?.setItem(KEY, JSON.stringify(items)); } catch { /* keep the in-memory answer */ }
  try { globalThis.dispatchEvent?.(new Event(EVENT)); } catch { /* no window (tests) */ }
  return items;
}

export const isFavorite = (key, store = storage()) => readFavorites(store).some(item => item.key === key);

export function toggleFavorite(item, store = storage(), now = new Date()) {
  const items = readFavorites(store);
  return write(items.some(entry => entry.key === item.key) ? items.filter(entry => entry.key !== item.key) : [{ ...item, at: now.toISOString() }, ...items], store);
}

export const removeFavorite = (key, store = storage()) => write(readFavorites(store).filter(item => item.key !== key), store);

export function onFavoritesChange(listener) {
  const handler = () => listener();
  globalThis.addEventListener?.(EVENT, handler);
  globalThis.addEventListener?.('storage', handler);
  return () => { globalThis.removeEventListener?.(EVENT, handler); globalThis.removeEventListener?.('storage', handler); };
}

export const FAVORITE_GROUPS = [
  ['prayer', 'תפילות'],
  ['tehillim', 'תהילים'],
  ['library', 'ספרים'],
  ['talmud', 'תלמוד'],
  ['source', 'מקורות'],
  ['tradition', 'המסורת שלי'],
  ['halacha', 'הלכה'],
  ['shalom-rav', 'שלום רב'],
  ['torat-shai', 'תורת ש״י'],
  ['torah', 'דברי תורה'],
];
