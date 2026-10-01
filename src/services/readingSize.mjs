// גודל טקסט בקריאה — one reading-text size for every reader in the app (docs/design-system.md › TextSizeControl).
//
// Two settings, two jobs:
//   • הגדרות › נגישות › גודל טקסט (services/accessibility/preferences.mjs) scales the WHOLE app (and follows the device).
//   • This one is the reader's "−  גודל טקסט  +": it scales only the reading text (prayer, Tanakh, Talmud, Torah…),
//     on top of the accessibility scale. It is one value for all readers, so a reader who enlarges the siddur finds
//     Tehillim, the Talmud and the divrei torah at the same comfortable size.
// Each reader keeps its own designed base size (siddur 25px, Tehillim 22px…); this is a factor on that base, so at
// 100% every reader looks exactly as designed.
// Pure logic here (tested in Node); the React hook and the control are in components/ui/TextSizeControl.jsx.

export const READING_SIZE_KEY = 'kz-reading-size-v1';
export const READING_SIZE_EVENT = 'kz-reading-size-change';
export const READING_SCALE = Object.freeze({ min: 0.8, max: 1.6, step: 0.1, initial: 1 });

// The readers' own sizes before this setting existed (px, with the base each was drawn for). The first time the
// shared size is read, the reader's earlier choice carries over (the siddur's first: it is the most read).
export const LEGACY_READER_SIZES = Object.freeze([
  ['source-font', 25], ['tehillim-font-v1', 22], ['library-font-v1', 24], ['talmud-font-v1', 21],
  ['zemirot-font-v1', 24], ['shalom-rav-font-v1', 22],
]);

const round = value => Math.round(value * 10) / 10;
export function clampScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return READING_SCALE.initial;
  return round(Math.min(READING_SCALE.max, Math.max(READING_SCALE.min, round(n))));
}
export const stepScale = (scale, direction) => clampScale(clampScale(scale) + (direction > 0 ? READING_SCALE.step : -READING_SCALE.step));
export const canGrow = scale => clampScale(scale) < READING_SCALE.max;
export const canShrink = scale => clampScale(scale) > READING_SCALE.min;
export const scaledSize = (base, scale) => Math.round(Number(base) * clampScale(scale));
export const percentLabel = scale => `${Math.round(clampScale(scale) * 100)}%`;

function store(storage) { if (storage !== undefined) return storage; try { return globalThis.localStorage || null; } catch { return null; } }

export function legacyScale(storage) {
  const s = store(storage);
  if (!s) return null;
  for (const [key, base] of LEGACY_READER_SIZES) {
    try {
      const raw = s.getItem(key);
      if (raw === null) continue;
      const px = Number(JSON.parse(raw));
      if (Number.isFinite(px) && px > 0) return clampScale(px / base);
    } catch { /* a damaged record is skipped */ }
  }
  return null;
}

export function readScale(storage) {
  const s = store(storage);
  try {
    const raw = s?.getItem(READING_SIZE_KEY);
    if (raw !== null && raw !== undefined) return clampScale(JSON.parse(raw));
  } catch { /* fall through */ }
  return legacyScale(s) ?? READING_SCALE.initial;
}

export function writeScale(value, storage) {
  const scale = clampScale(value);
  try { store(storage)?.setItem(READING_SIZE_KEY, JSON.stringify(scale)); } catch { /* private browsing: kept for the session */ }
  try { globalThis.dispatchEvent?.(new CustomEvent(READING_SIZE_EVENT, { detail: scale })); } catch { /* no DOM (tests) */ }
  return scale;
}
