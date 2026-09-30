// נגישות — one store for the reader's accessibility preferences, the device's own settings, and what the app does with
// them. By default everything follows the device (התאמה אוטומטית למכשיר): the app looks exactly as it always did
// unless the device asks for something (larger text, reduced motion, more contrast, less transparency).
// Pure logic here (tested in Node); applyToDocument() writes the result on <html> as data attributes and CSS variables
// that src/styles/accessibility.css reads. Nothing in the visible design changes for a reader who changes nothing.

export const STORE_KEY = 'kz-accessibility-v1';
export const CHANGE_EVENT = 'kz-accessibility-change';

// "system" follows the device (iOS Dynamic Type through -apple-system-body; the browser's own setting elsewhere).
export const TEXT_SIZES = Object.freeze([
  ['system', 'מערכת'], ['100', '100%'], ['115', '115%'], ['130', '130%'], ['150', '150%'], ['175', '175%'], ['200', '200%'],
]);
export const LINE_SPACINGS = Object.freeze([['normal', 'רגיל'], ['comfortable', 'נוח'], ['wide', 'רחב']]);
// Line height multipliers: nikud and te'amim need room above and below the letters; letter spacing is never touched
// (it would pull the marks away from their letters).
export const LINE_FACTORS = Object.freeze({ normal: 1, comfortable: 1.12, wide: 1.25 });

export const DEFAULTS = Object.freeze({
  auto: true, // התאמה אוטומטית למכשיר
  textSize: 'system',
  lineSpacing: 'normal',
  bold: false,
  // Each of these is also turned on by the device's own setting while התאמה אוטומטית is on; the switch turns it on
  // regardless (the device's reduce-motion request is always honoured — the CSS reads it directly).
  contrast: false,
  transparency: false,
  motion: false,
  haptics: true, // non-essential haptics
  focusedReading: false, // קריאה ממוקדת
});

const VALID = {
  textSize: new Set(TEXT_SIZES.map(([id]) => id)),
  lineSpacing: new Set(LINE_SPACINGS.map(([id]) => id)),
};

// Anything stored that is not a known value falls back to its default (an old or damaged record never breaks the app).
export function normalizePreferences(value) {
  const input = value && typeof value === 'object' ? value : {};
  const out = { ...DEFAULTS };
  for (const key of ['auto', 'bold', 'contrast', 'transparency', 'motion', 'haptics', 'focusedReading']) if (typeof input[key] === 'boolean') out[key] = input[key];
  for (const key of Object.keys(VALID)) if (VALID[key].has(input[key])) out[key] = input[key];
  return out;
}

function storage() { try { return globalThis.localStorage || null; } catch { return null; } }
export function readPreferences() {
  try { return normalizePreferences(JSON.parse(storage()?.getItem(STORE_KEY) || 'null')); } catch { return { ...DEFAULTS }; }
}
export function writePreferences(next) {
  const value = normalizePreferences(next);
  try { storage()?.setItem(STORE_KEY, JSON.stringify(value)); } catch { /* private browsing: the choice lives for this session */ }
  current = value;
  try { globalThis.dispatchEvent?.(new CustomEvent(CHANGE_EVENT, { detail: value })); } catch { /* no DOM (tests) */ }
  return value;
}
export const resetPreferences = () => writePreferences(DEFAULTS);

let current = null;
export const getPreferences = () => (current ||= readPreferences());

// The device's settings, as the web view reports them. Each is false when unknown.
export function readSystem(win = globalThis) {
  const query = q => { try { return Boolean(win.matchMedia?.(q).matches); } catch { return false; } };
  return {
    reduceMotion: query('(prefers-reduced-motion: reduce)'),
    moreContrast: query('(prefers-contrast: more)') || query('(forced-colors: active)'),
    reduceTransparency: query('(prefers-reduced-transparency: reduce)'),
    dark: query('(prefers-color-scheme: dark)'),
  };
}

// What the app does: the reader's switch, or (with התאמה אוטומטית on) the device asking for it.
export function resolvePreferences(prefs = DEFAULTS, system = {}) {
  const p = normalizePreferences(prefs);
  const follow = value => (p.auto ? Boolean(value) : false);
  return {
    textScale: p.textSize === 'system' ? null : Number(p.textSize) / 100,
    followSystemText: p.textSize === 'system' && p.auto,
    lineFactor: LINE_FACTORS[p.lineSpacing] || 1,
    bold: p.bold,
    highContrast: p.contrast || follow(system.moreContrast),
    reduceTransparency: p.transparency || follow(system.reduceTransparency),
    // Reduced motion requested by the device applies whatever this switch says (see accessibility.css).
    reduceMotion: p.motion || Boolean(system.reduceMotion),
    haptics: p.haptics,
    focusedReading: p.focusedReading,
  };
}

// iOS reports the reader's Dynamic Type through -apple-system-body (17px at the default size). The app's layout is
// drawn for the default; a larger setting scales the text by the same ratio (never below the default: a smaller system
// size keeps the app's own sizes, which already keep 15px as the smallest text).
export const DYNAMIC_TYPE_DEFAULT_PX = 17;
// The header and the tab bar stop growing here (their labels would otherwise break inside words).
export const CHROME_MAX_SCALE = 1.3;
export function systemTextScale(bodyPx) {
  const px = Number(bodyPx);
  if (!Number.isFinite(px) || px <= 0) return 1;
  // The largest accessibility sizes are held at 200% — the largest size offered in the settings, and the largest at
  // which every screen was checked to re-flow without breaking words.
  return Math.min(2, Math.max(1, Math.round((px / DYNAMIC_TYPE_DEFAULT_PX) * 100) / 100));
}

// Non-essential haptics (a switch's tick) ask here first. Essential feedback (the prayer compass finding the direction
// for a reader who cannot see it) does not.
export const hapticsAllowed = () => resolvePreferences(getPreferences(), {}).haptics;

// Writes the effective settings on <html>. data-* attributes are set only when something differs from the app's own
// look, so a reader who changed nothing gets exactly the page as it was.
export function applyToDocument(doc = globalThis.document, win = globalThis) {
  if (!doc?.documentElement) return null;
  const root = doc.documentElement;
  const effective = resolvePreferences(getPreferences(), readSystem(win));
  let scale = effective.textScale;
  if (scale === null && effective.followSystemText) {
    const probe = doc.getElementById('kz-dynamic-type-probe');
    scale = probe ? systemTextScale(parseFloat(win.getComputedStyle(probe).fontSize)) : 1;
  }
  const set = (name, on) => { if (on) root.setAttribute(name, ''); else root.removeAttribute(name); };
  // Phones and tablets scale text itself (-webkit-text-size-adjust: the text grows and the lines re-flow; images and
  // layout stay). A desktop browser, which ignores it, zooms the page instead (see accessibility.css).
  const nav = win.navigator || {};
  const touch = /iPhone|iPad|iPod|Android/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  if (scale && scale !== 1) {
    const percent = `${Math.round(scale * 100)}%`;
    root.style.setProperty('--a11y-text-scale', String(scale));
    root.style.setProperty('--a11y-chrome-scale', String(Math.min(scale, CHROME_MAX_SCALE)));
    root.style.setProperty('--a11y-chrome-adjust', `${Math.round(Math.min(scale, CHROME_MAX_SCALE) * 100)}%`);
    root.setAttribute('data-a11y-text', touch ? 'adjust' : 'zoom');
    if (touch) { root.style.setProperty('-webkit-text-size-adjust', percent); root.style.setProperty('text-size-adjust', percent); }
    else { root.style.removeProperty('-webkit-text-size-adjust'); root.style.removeProperty('text-size-adjust'); }
  } else {
    for (const name of ['--a11y-text-scale', '--a11y-chrome-scale', '--a11y-chrome-adjust', '-webkit-text-size-adjust', 'text-size-adjust']) root.style.removeProperty(name);
    root.removeAttribute('data-a11y-text');
  }
  if (effective.lineFactor !== 1) root.style.setProperty('--a11y-line-factor', String(effective.lineFactor)); else root.style.removeProperty('--a11y-line-factor');
  set('data-a11y-spacing', effective.lineFactor !== 1);
  set('data-a11y-bold', effective.bold);
  set('data-a11y-contrast', effective.highContrast);
  set('data-a11y-transparency', effective.reduceTransparency);
  set('data-a11y-motion', effective.reduceMotion);
  set('data-a11y-focus-reading', effective.focusedReading);
  return { ...effective, textScale: scale || 1 };
}
