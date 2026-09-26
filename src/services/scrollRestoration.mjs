// Lightweight scroll-position restoration keyed by page id, backed by sessionStorage
// so "Books -> open a book -> Back" returns to the exact previous scroll position
// instead of resetting to the top. No timeouts: read/write happen synchronously
// around the real navigation events (before opening a source, after remounting).
const PREFIX = 'kz-scroll-v1:';

export function saveScrollPosition(key, storage = globalThis.sessionStorage) {
  try { storage?.setItem(PREFIX + key, String(window.scrollY || 0)); } catch { /* storage unavailable */ }
}

// Reads and clears the saved position in one step, so a later ordinary navigation
// to the same page starts fresh instead of re-using a stale restoration point.
export function consumeScrollPosition(key, storage = globalThis.sessionStorage) {
  try {
    const raw = storage?.getItem(PREFIX + key);
    if (raw === null || raw === undefined) return null;
    storage.removeItem(PREFIX + key);
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-history-entry restoration (native-style Back).
// Every history entry carries a unique `kzKey`. While an entry is current, its scroll
// position and any page state registered with `useRouteState` are remembered under that
// key. Back/Forward returns to an entry and restores both; a fresh navigation starts clean.
// The store is in-memory and bounded, so it cannot grow without limit.
const MAX_ENTRIES = 80;
const entries = new Map();
let restoring = false;

export const newEntryKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const currentEntryKey = () => { try { return globalThis.history?.state?.kzKey || null; } catch { return null; } };

export function entryRecord(key, create = false) {
  if (!key) return null;
  let record = entries.get(key);
  if (!record && create) {
    record = { scrollY: 0, state: {} };
    entries.set(key, record);
    while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
  }
  return record || null;
}

export function rememberScroll(key = currentEntryKey(), y = globalThis.scrollY || 0) {
  if (restoring) return;
  const record = entryRecord(key, true);
  if (record) record.scrollY = y;
}

export const isRestoring = () => restoring;
export const beginRestore = () => { restoring = true; };

// Content often arrives asynchronously, so the page may be too short on the first frame.
// Keep trying for a short while; stop as soon as the user touches/scrolls themselves.
export function restoreScroll(key, { win = globalThis.window, maxMs = 2000 } = {}) {
  const target = entryRecord(key)?.scrollY ?? 0;
  restoring = true;
  if (!win) { restoring = false; return () => {}; }
  const started = Date.now();
  let frame = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    restoring = false;
    win.cancelAnimationFrame?.(frame);
    for (const type of ['touchstart', 'wheel', 'keydown']) win.removeEventListener?.(type, finish);
  };
  for (const type of ['touchstart', 'wheel', 'keydown']) win.addEventListener?.(type, finish, { passive: true, once: true });
  const step = () => {
    if (done) return;
    const doc = win.document?.scrollingElement || win.document?.documentElement;
    const max = Math.max(0, (doc?.scrollHeight || 0) - (win.innerHeight || 0));
    win.scrollTo(0, Math.min(target, max));
    if (max >= target || Date.now() - started > maxMs) finish();
    else frame = win.requestAnimationFrame(step);
  };
  step();
  return finish;
}

export function readRouteState(key, name) {
  const record = entryRecord(key);
  return record && Object.prototype.hasOwnProperty.call(record.state, name) ? { value: record.state[name] } : null;
}

export function writeRouteState(key, name, value) {
  const record = entryRecord(key, true);
  if (record) record.state[name] = value;
}

export function _resetEntries() { entries.clear(); restoring = false; }

// Remember which screen (hash) an entry was opened from, so an on-screen "חזרה" to that
// same screen can be a real Back (restoring its state) instead of a new forward push.
const normalizeHash = hash => {
  const raw = String(hash || '').replace(/^#/, '') || 'today';
  try { return decodeURIComponent(raw); } catch { return raw; }
};
export function linkEntry(key, fromHash) {
  const record = entryRecord(key, true);
  if (record) record.prevHash = normalizeHash(fromHash);
}
export function backTo(target, navigate, { win = globalThis.window } = {}) {
  const record = entryRecord(currentEntryKey());
  if (record?.prevHash && record.prevHash === normalizeHash(target) && Number(win?.history?.state?.kzDepth) > 0) win.history.back();
  else navigate();
}
