// התבודדות — the session's one breathing rhythm. The golden ring at the bottom of the session breathes with it, and on
// the Tehillim screen the candle's light breathes with it too: it gently widens and brightens on the in-breath and
// settles on the out-breath — one slow, smooth sine of 4.4 s (≈ 0.23 Hz, nowhere near a flash rate; no flicker).
// Both are CSS animations of the same length (--hb-breath in styles/hitbodedut.css); each element is given a negative
// delay from the one clock at its mount (breathDelay), so whenever it appears its phase is the clock's phase and the
// ring and the candle breathe as one. Reduced motion (the device's or נגישות's): no breathing — the light stays still.
export const BREATH_MS = 4400;

// The animation-delay that puts an animation started now on the shared phase: -(now mod BREATH_MS).
export function breathDelay(now = (globalThis.performance?.now?.() ?? Date.now())) {
  const t = Number(now);
  const ms = Number.isFinite(t) ? ((t % BREATH_MS) + BREATH_MS) % BREATH_MS : 0;
  return `${-Math.round(ms)}ms`;
}
