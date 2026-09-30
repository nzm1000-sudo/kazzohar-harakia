// Back after a search result returns to the results — one mechanism for every search in the app.
//
// A search's text (and the filters that go with it) is page state kept per history entry (useRouteState). While a
// search is shown, typing only updates that in-memory state: no history entry, no storage write per keystroke.
// When the reader then leaves the page — a result tapped, or any other navigation — the entry is split in two just
// before the new one is pushed:
//   [screen before the search] [the results: same address, text, filters, "more results", scroll] [the opened result]
// so Back from the result shows the results as they were, and Back once more the screen as it was before the search.
// An entry that already is a results entry (the reader came back to the results and opens another) is not split again.
import { entryRecord, newEntryKey } from './scrollRestoration.mjs';

// name → the value that means "no search" (what the screen before the search shows).
const SEARCH_STATES = new Map();
export function registerSearchState(name, empty = '') { SEARCH_STATES.set(name, empty); }
export const isSearchValue = value => (typeof value === 'string' ? value.trim().length > 0 : Boolean(value));

const own = (object, name) => Object.prototype.hasOwnProperty.call(object, name);
export function activeSearchNames(key) {
  const record = entryRecord(key);
  if (!record) return [];
  return [...SEARCH_STATES.keys()].filter(name => own(record.state, name) && isSearchValue(record.state[name]) && record.state[name] !== SEARCH_STATES.get(name));
}

// The first letter of a search remembers where the screen was scrolled before it, so the entry split off as "the
// screen before the search" returns to that place (the results scroll the same entry meanwhile). Cleared with the search.
export function noteSearchValue(key, value, { scrollY = globalThis.scrollY || 0 } = {}) {
  const record = entryRecord(key, Boolean(key));
  if (!record) return;
  if (!isSearchValue(value)) { if (!activeSearchNames(key).length) delete record.searchBaseScroll; return; }
  if (record.searchBaseScroll === undefined) record.searchBaseScroll = record.scrollY ?? scrollY;
}

// Copies the entry's page state to a new results entry and returns the screen-before-search state to the base entry.
function splitRecords(baseKey, resultsKey, scrollY) {
  const names = activeSearchNames(baseKey);
  const base = entryRecord(baseKey);
  const results = entryRecord(resultsKey, true);
  results.state = { ...base.state };
  results.scrollY = scrollY;
  for (const name of names) base.state[name] = SEARCH_STATES.get(name);
  base.scrollY = base.searchBaseScroll ?? 0;
  delete base.searchBaseScroll;
}

// Before a navigation that pushes a new entry (NewApp's pushRoute). Returns the results entry's key, or null.
export function splitSearchEntry({ win = globalThis.window, newKey = newEntryKey } = {}) {
  const history = win?.history;
  const state = history?.state || null;
  const key = state?.kzKey;
  if (!key || state.kzResults || !activeSearchNames(key).length) return null;
  const resultsKey = newKey();
  splitRecords(key, resultsKey, win.scrollY || 0);
  history.pushState({ ...state, kzKey: resultsKey, kzDepth: Number(state.kzDepth || 0) + 1, kzResults: true }, '', win.location.href);
  return resultsKey;
}

// A plain link or `location.hash = …` has already added the new entry when the app hears of it (hashchange). The new
// entry becomes the results entry (at the previous address) and the destination is pushed after it — the same three
// entries as above. Returns the depth for the destination entry, or null when there was no search to keep.
export function splitAfterHashNavigation({ win = globalThis.window, fromKey, fromURL, fromDepth = 0, newKey = newEntryKey } = {}) {
  if (!fromKey || !activeSearchNames(fromKey).length) return null;
  const history = win.history;
  const destination = win.location.href;
  const resultsKey = newKey();
  splitRecords(fromKey, resultsKey, entryRecord(fromKey)?.scrollY ?? 0);
  // (The results keep the scroll the entry had while they were shown; the base returns to its place before the search.)
  history.replaceState({ source: null, kzDepth: fromDepth + 1, kzKey: resultsKey, kzResults: true }, '', fromURL);
  return { resultsKey, depth: fromDepth + 2, destination };
}

// After Back/Forward to a results entry, the results take the focus (never the search field: no keyboard on a phone).
// Returns true when a results region was found.
export function focusSearchResults(doc = globalThis.document) {
  const region = doc?.querySelector?.('[data-kz-results]');
  if (!region) return false;
  const target = region.querySelector('h1, h2, [role="heading"]') || region;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  try { target.focus({ preventScroll: true }); } catch { target.focus(); }
  return true;
}

export function _resetSearchStates() { SEARCH_STATES.clear(); }
