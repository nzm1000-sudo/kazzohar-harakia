// לעצמי — the shared helpers of its local stores. Everything stays on the device (localStorage, like the rest of the
// app); every store is versioned, migrates what it finds, and never throws on a broken or missing value.
export const defaultStorage = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export function readJSON(storage, key, fallback) {
  try {
    const raw = storage?.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch { return fallback; }
}

export function writeJSON(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function emit(name) {
  try { globalThis.dispatchEvent?.(new Event(name)); } catch { /* no window (tests) */ }
}

export function subscribe(name, listener) {
  const handler = () => listener();
  globalThis.addEventListener?.(name, handler);
  globalThis.addEventListener?.('storage', handler);
  return () => { globalThis.removeEventListener?.(name, handler); globalThis.removeEventListener?.('storage', handler); };
}

export const newId = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const toIso = value => (value instanceof Date ? value : new Date(value ?? Date.now())).toISOString();
export const toMs = value => (value instanceof Date ? value.getTime() : typeof value === 'number' ? value : value ? Date.parse(value) : Date.now());

// Hebrew search: nikud, te'amim, punctuation and final letters folded, so "בראשית" finds "בְּרֵאשִׁית".
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
export function foldHebrew(text) {
  return String(text || '')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, letter => FINALS[letter])
    .replace(/[׳״"'`׳״.,;:!?()[\]{}\-–—_/\\]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
