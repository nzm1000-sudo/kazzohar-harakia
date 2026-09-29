// Previous searches, on this device only (never sent anywhere, no analytics): a query is remembered when one of its
// results is opened, at most eight, newest first — offered as suggestions that begin with what is being typed.
const KEY = 'kz-search-recent-v1';
const MAX = 8;
const storage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export function recentSearches(store = storage()) {
  try { const list = JSON.parse(store?.getItem(KEY) || '[]'); return Array.isArray(list) ? list.filter(item => typeof item === 'string') : []; } catch { return []; }
}
export function rememberSearch(query, store = storage()) {
  const text = String(query || '').trim().replace(/\s+/g, ' ');
  if (text.length < 2) return;
  const next = [text, ...recentSearches(store).filter(item => item !== text)].slice(0, MAX);
  try { store?.setItem(KEY, JSON.stringify(next)); } catch { /* storage full or private mode */ }
}
export function suggestSearches(query, store = storage()) {
  const text = String(query || '').trim();
  if (!text) return [];
  return recentSearches(store).filter(item => item !== text && item.startsWith(text)).slice(0, 4);
}
