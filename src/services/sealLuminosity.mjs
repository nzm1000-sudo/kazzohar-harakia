// The seal's luminosity — how much colour and life the seal of "מעגלי עולם" carries for a lifetime count. Pure and
// deterministic, applied on top of the geometry (sealGeometry.mjs) without changing a single shape. The theme's gold is
// always the anchor; four more hues join it one by one as the ranks rise, each fading in over the stretch before the rank
// that brings it, so the colour grows as smoothly as the geometry does:
//   gold (from the first light) → violet (נצח, 50) → sky-blue / תכלת (גבורה, 150) → rose (חכמה, 400)
//   → phosphorescent green (אור הגנוז, 750).
// The effect level (0–5) says which motions an alive seal may use; it never carries meaning (the words beside it do).
import { RANKS } from './spiritualCircle.mjs';
import { layerGrowth } from './sealGeometry.mjs';

// Each added hue and the rank (index in RANKS) that completes it; it fades in from the previous rank.
export const SEAL_HUES = Object.freeze([
  Object.freeze({ name: 'violet', rank: 3 }), // נצח
  Object.freeze({ name: 'sky', rank: 5 }), // גבורה
  Object.freeze({ name: 'rose', rank: 8 }), // חכמה
  Object.freeze({ name: 'green', rank: 11 }), // אור הגנוז
]);

// Effect levels by ranks reached: 0 faint breathing · 1 + a sheen sweeping the boundary, a warmer halo · 2 + the hues
// turning through the lines and a pulsing coloured halo · 3 + glints on the nodes, a second travelling light, a parallax
// depth · 4 + a third light, deeper breathing · 5 (אור אין סוף) everything, fullest.
export const SEAL_EFFECTS = Object.freeze(['breath', 'sheen', 'iris', 'glints', 'deep', 'infinite']);
const effectFor = reached => (reached >= 15 ? 5 : reached >= 12 ? 4 : reached >= 9 ? 3 : reached >= 6 ? 2 : reached >= 3 ? 1 : 0);

export function sealLuminosity(count) {
  const growth = layerGrowth(count);
  const reached = growth.filter(t => t >= 1).length;
  // 0 before the first light, 1 at אור אין סוף; continuous between the ranks.
  const intensity = Math.round((growth.reduce((sum, t) => sum + t, 0) / RANKS.length) * 1000) / 1000;
  const weights = { gold: 1 };
  for (const hue of SEAL_HUES) weights[hue.name] = growth[hue.rank];
  const hues = 1 + SEAL_HUES.filter(hue => weights[hue.name] >= 1).length;
  return { intensity, hues, weights, effect: effectFor(reached), reached };
}
