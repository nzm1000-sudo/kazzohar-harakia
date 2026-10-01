// התבודדות — the dimming steps of the session screen, chosen with − / + (and the moon button) while it runs.
// Each step changes two things at once, so every press is visible on every device:
//   · the native screen brightness (KZHitbodedut.dim), where the plugin exists — never above the person's own;
//   · the software dimming layer over the session (on the web it is the only dimming, so it is stronger there).
// Step 0 is "no dimming": the person's own brightness and a clear layer. Pure (tests/hitbodedutDim.test.mjs).

export const DIM_STEP_NAMES = Object.freeze(['ללא עמעום', 'עמעום קל', 'עמעום', 'עמעום חזק', 'הכי כהה']);
export const DIM_STEP_COUNT = DIM_STEP_NAMES.length;
export const DEFAULT_DIM_STEP = 2;

// The native brightness of each step (0–1; null = the person's own). Reading Tehillim needs more light than a clock.
// Step 2 is the level the session always used (0.12 for the clock, 0.3 for Tehillim).
export const NATIVE_DIM_LEVELS = Object.freeze({
  timer: Object.freeze([null, 0.3, 0.12, 0.07, 0.03]),
  tehillim: Object.freeze([null, 0.5, 0.3, 0.2, 0.12]),
});
// The software layer's opacity at each step: lighter where the native brightness already dims, stronger on the web.
export const OVERLAY_LEVELS = Object.freeze({
  native: Object.freeze([0, 0.12, 0.24, 0.36, 0.48]),
  web: Object.freeze([0, 0.22, 0.38, 0.52, 0.64]),
});

export const clampDimStep = value => {
  const number = Number(value);
  return Math.min(DIM_STEP_COUNT - 1, Math.max(0, Math.round(Number.isFinite(number) ? number : DEFAULT_DIM_STEP)));
};
export const nativeDimLevel = (display, step) => (display === 'tehillim' ? NATIVE_DIM_LEVELS.tehillim : NATIVE_DIM_LEVELS.timer)[clampDimStep(step)];
export const overlayOpacity = (step, { native = false } = {}) => (native ? OVERLAY_LEVELS.native : OVERLAY_LEVELS.web)[clampDimStep(step)];
// The step a session starts at: the remembered step when dimming is on (a remembered "none" with the switch turned on
// again starts at the usual step), else none.
export function startDimStep(prefs) {
  if (prefs?.dim === false) return 0;
  const step = clampDimStep(prefs?.dimStep ?? DEFAULT_DIM_STEP);
  return step === 0 ? DEFAULT_DIM_STEP : step;
}
