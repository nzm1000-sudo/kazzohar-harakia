// CLAY · light follows the sun. The material's one light (its halos, shadows and bright edges) turns very slightly with
// the sun of the app's own zmanim: from the upper right (east) in the morning, from above at noon, from the upper left
// (west) towards evening; after sunset and before sunrise it rests at the upper left and the copper is a little cooler
// and dimmer (styles/clay/tokens.css › night). Only CSS custom properties change — box-shadow offsets, never a size or a
// position — so nothing moves in the layout; it is updated at most every few minutes and never animates.
// Reduced motion (the device's, or נגישות › הפחתת תנועה) and anything unknown: the fixed upper-left light.
export const CLAY_LIGHT_FIXED = Object.freeze({ lx: 1, ly: 1, phase: 'fixed' });
export const CLAY_SUN_INTERVAL_MS = 5 * 60 * 1000;

const time = value => { const at = value instanceof Date ? value.getTime() : Date.parse(value); return Number.isFinite(at) ? at : NaN; };
const round = value => Math.round(value * 100) / 100;

// lx: 1 = light from the left (shadows fall right), -1 = from the right; ly: 1 = from above at the usual height.
export function sunLight(now, times, { reducedMotion = false } = {}) {
  if (reducedMotion) return CLAY_LIGHT_FIXED;
  const at = time(now); const rise = time(times?.sunrise); const set = time(times?.sunset);
  if (!Number.isFinite(at) || !Number.isFinite(rise) || !Number.isFinite(set) || set <= rise) return CLAY_LIGHT_FIXED;
  if (at < rise || at >= set) return { lx: 1, ly: 1, phase: 'night' };
  const p = (at - rise) / (set - rise);
  // Subtle by design: the light travels from x = -0.5 (east) to x = 1 (west); at noon it stands a little higher, so
  // the shadows are a little shorter (ly 0.82).
  const lx = round(-0.5 + 1.5 * p);
  const ly = round(1 - 0.18 * Math.sin(Math.PI * p));
  return { lx, ly, phase: p < 0.2 ? 'morning' : p > 0.8 ? 'evening' : 'day' };
}

export function applySunLight(light, root = typeof document === 'undefined' ? null : document.documentElement) {
  if (!root) return;
  const style = root.style;
  if (style.getPropertyValue('--clay-lx') !== String(light.lx)) style.setProperty('--clay-lx', String(light.lx));
  if (style.getPropertyValue('--clay-ly') !== String(light.ly)) style.setProperty('--clay-ly', String(light.ly));
  if (root.dataset.claySun !== light.phase) root.dataset.claySun = light.phase;
}

export function clearSunLight(root = typeof document === 'undefined' ? null : document.documentElement) {
  if (!root) return;
  root.style.removeProperty('--clay-lx');
  root.style.removeProperty('--clay-ly');
  delete root.dataset.claySun;
}

// The device's reduced motion or the app's own setting (נגישות sets html[data-a11y-motion]).
export function prefersStillLight(win = globalThis) {
  try {
    if (win.document?.documentElement?.hasAttribute('data-a11y-motion')) return true;
    return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch { return false; }
}
