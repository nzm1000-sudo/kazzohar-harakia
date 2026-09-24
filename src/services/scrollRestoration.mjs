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
