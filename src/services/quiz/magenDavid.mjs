// בחן אותי — the evolving Magen David: the quiz's identity and its progress display. Pure and deterministic: points in,
// a list of SVG primitives out (no DOM, no randomness). The same family as the spiritual circle's seal
// (services/sealGeometry.mjs): thin palette lines, a central light, six-fold geometry only — never a four-fold
// (vertical + horizontal) composition, no stroke through the centre. It begins as two faint triangles; each of the
// fifteen stages adds ONE layer, and every layer grows in proportion as the points approach its stage (drawn-on
// strokes, opacity, nodes appearing), so the shape changes a little with every session.
// Points never fill the ring: this module is the only place they are drawn.

export const MAGEN_VIEWBOX = 128;
const C = 64;
const R = 40; // the star's vertices
const NOTCH = R / Math.sqrt(3); // the star's inner corners (the inner hexagon)
const round = v => Math.round(v * 100) / 100;
const clamp01 = v => Math.min(1, Math.max(0, v));
const pt = (deg, r) => { const t = (deg * Math.PI) / 180; return [round(C + r * Math.sin(t)), round(C - r * Math.cos(t))]; };
const SIX = [0, 60, 120, 180, 240, 300];
const NOTCHES = SIX.map(d => d + 30);

// The fifteen stages: the points at which each is complete, and its name (shown under the star).
export const STAGES = [
  { at: 0, name: 'ניצוץ' },
  { at: 40, name: 'שני משולשים' },
  { at: 120, name: 'מעגל' },
  { at: 240, name: 'משושה' },
  { at: 400, name: 'שש נקודות' },
  { at: 600, name: 'טבעת פנימית' },
  { at: 850, name: 'קו כפול' },
  { at: 1150, name: 'קרני אור' },
  { at: 1500, name: 'מגן פנימי' },
  { at: 1900, name: 'קצב' },
  { at: 2400, name: 'קשתות' },
  { at: 3000, name: 'זרע החיים' },
  { at: 3700, name: 'עומק' },
  { at: 4500, name: 'כתר' },
  { at: 5500, name: 'זוהר' },
];
export const STAGE_COUNT = STAGES.length;

// The stage reached, the next one, and how far along the way to it (0–1).
export function stageOf(points) {
  const n = Math.max(0, Number(points) || 0);
  let stage = 0;
  STAGES.forEach((s, i) => { if (n >= s.at) stage = i; });
  const next = stage + 1 < STAGES.length ? stage + 1 : null;
  const toNext = next === null ? 1 : clamp01((n - STAGES[stage].at) / (STAGES[next].at - STAGES[stage].at));
  return { stage, name: STAGES[stage].name, next, nextAt: next === null ? null : STAGES[next].at, toNext };
}

// How far each layer has grown (index = stage; layer 0 is always present).
export function layerGrowth(points) {
  const n = Math.max(0, Number(points) || 0);
  return STAGES.map((s, i) => (i === 0 ? 1 : clamp01((n - STAGES[i - 1].at) / (s.at - STAGES[i - 1].at))));
}

// The cosmetic variations ("הפתעות גאומטריות"), each opened by a stage — forms of the same Magen David, nothing else.
export const VARIANTS = [
  { id: 'classic', name: 'קלאסי', stage: 0 },
  { id: 'woven', name: 'שזור', stage: 6 },
  { id: 'starry', name: 'כוכבי', stage: 10 },
];
export const variantUnlocked = (id, points) => { const v = VARIANTS.find(x => x.id === id); return Boolean(v) && stageOf(points).stage >= v.stage; };

const polyD = pts => `M ${pts.map(p => p.join(' ')).join(' L ')} Z`;
const triangle = (rot, r) => [0, 120, 240].map(d => pt(d + rot, r));
const edgesOf = pts => pts.map((p, i) => [...p, ...pts[(i + 1) % pts.length]]);
// A closed polygon drawn on progressively (dash), with its straight segments listed for the geometry checks.
const polygon = (key, pts, w, o, extra = {}) => ({ kind: 'path', key, d: polyD(pts), w, o, segs: edgesOf(pts), join: 'round', ...extra });
const ringAt = (key, r, t, w, o, extra = {}) => {
  if (t <= 0.004) return null;
  if (t >= 0.999) return { kind: 'circle', key, r, w, o, ...extra };
  // Symmetric about the vertical axis: drawn from the top down both sides at once.
  const half = 180 * t;
  const [lx, ly] = pt(-half, r); const [tx, ty] = pt(0, r); const [rx, ry] = pt(half, r);
  return { kind: 'path', key, d: `M ${lx} ${ly} A ${r} ${r} 0 0 1 ${tx} ${ty} A ${r} ${r} 0 0 1 ${rx} ${ry}`, w, o, ...extra };
};
const line = (key, deg, r1, r2, w, o, extra = {}) => {
  if (r2 - r1 < 0.2) return null;
  const [x1, y1] = pt(deg, r1); const [x2, y2] = pt(deg, r2);
  return { kind: 'line', key, at: deg, x1, y1, x2, y2, w, o, segs: [[x1, y1, x2, y2]], ...extra };
};
const dot = (key, deg, r, size, o, extra = {}) => { const [cx, cy] = pt(deg, r); return { kind: 'dot', key, at: deg, cx, cy, r: round(size), o, ...extra }; };
function arc(key, deg, span, r, w, o, extra = {}) {
  if (span <= 0.3) return null;
  const [x1, y1] = pt(deg - span / 2, r); const [x2, y2] = pt(deg + span / 2, r);
  return { kind: 'path', key, at: deg, d: `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`, w, o, ...extra };
}

// The woven form: each triangle passes over and under the other in turn; a small gap where it passes under.
function wovenTriangle(key, rot, under, w, o) {
  const pts = triangle(rot, R);
  const gap = 3.2;
  const parts = [];
  edgesOf(pts).forEach(([x1, y1, x2, y2]) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    // Crossings at a third and two thirds of each edge (the inner corners); at the even corners the upward triangle
    // passes under, at the odd ones the downward — so along every line it is over, under, over, under.
    const cuts = [1 / 3, 2 / 3].filter(t => {
      const x = x1 + (x2 - x1) * t; const y = y1 + (y2 - y1) * t;
      const deg = ((Math.atan2(x - C, C - y) * 180) / Math.PI + 360) % 360;
      return under(Math.round((deg - 30) / 60) % 6);
    }).map(t => [t - gap / len, t + gap / len]);
    let from = 0;
    for (const [a, b] of [...cuts, [1, 1]]) {
      if (a > from + 0.001) parts.push([round(x1 + (x2 - x1) * from), round(y1 + (y2 - y1) * from), round(x1 + (x2 - x1) * a), round(y1 + (y2 - y1) * a)]);
      from = b;
    }
  });
  return { kind: 'path', key, d: parts.map(([a, b, c, d]) => `M ${a} ${b} L ${c} ${d}`).join(' '), w, o, segs: parts, join: 'round' };
}

// The primitives. Strokes are in viewBox units; `tone: 'accent'` marks the depth layers (the theme's accent), the
// rest are the theme's gold (currentColor). `dash` (0–1) draws a stroke on progressively; `drift` marks the fine outer
// rhythm the component may turn very slowly; `glint` marks the nodes that may shimmer when alive.
export function magenPrimitives(points, variant = 'classic') {
  const g = layerGrowth(points);
  const [, firm, circle, hexagon, nodes, innerRing, doubled, rays, innerStar, rhythm, arcs, seed, depth, crown, radiance] = g;
  const total = clamp01((Math.max(0, Number(points) || 0)) / STAGES[STAGES.length - 1].at);
  const items = [];
  const push = item => { if (item) items.push(item); };
  const woven = variant === 'woven' && variantUnlocked('woven', points);
  const starry = variant === 'starry' && variantUnlocked('starry', points);

  // The central light, growing with the whole journey.
  push({ kind: 'glow', key: 'glow', r: round(16 + 18 * total + 4 * radiance), o: round(0.24 + 0.26 * total + 0.1 * radiance) });

  // 0–1 · the two triangles: faint outlines at first, firm by the second stage.
  const tw = round(0.7 + 0.55 * firm); const to = round(0.34 + 0.58 * firm);
  if (woven) {
    push(wovenTriangle('tri-up', 0, (k) => k % 2 === 0, tw, to));
    push(wovenTriangle('tri-down', 60, (k) => k % 2 === 1, tw, to));
  } else {
    push(polygon('tri-up', triangle(0, R), tw, to));
    push(polygon('tri-down', triangle(60, R), tw, to));
  }

  // 2 · the enclosing circle.
  push(ringAt('ring-outer', 50, circle, 0.7, round(0.3 + 0.4 * circle)));

  // 3 · a hexagon within the star's heart, its corners toward the six points.
  if (hexagon > 0) push(polygon('hex-inner', SIX.map(d => pt(d, NOTCH - 3)), 0.55, round(0.25 + 0.45 * hexagon), { dash: round(hexagon) }));

  // 4 · nodes on the six points (small stars in the starry form).
  if (nodes > 0) SIX.forEach((d, i) => {
    if (starry) {
      const [cx, cy] = pt(d, R);
      const s = 3.4 * nodes;
      const mini = rot => [0, 120, 240].map(a => { const t = ((a + rot) * Math.PI) / 180; return [round(cx + s * Math.sin(t)), round(cy - s * Math.cos(t))]; });
      push(polygon(`node-${i}a`, mini(0), 0.45, round(0.8 * nodes), { at: d }));
      push(polygon(`node-${i}b`, mini(60), 0.45, round(0.8 * nodes), { at: d }));
    } else push(dot(`node-${i}`, d, R, 1.7 * nodes, round(0.9 * nodes), { glint: true }));
  });

  // 5 · the inner ring, inscribed in the hexagon.
  push(ringAt('ring-inner', round(NOTCH * Math.cos(Math.PI / 6)), innerRing, 0.5, round(0.25 + 0.4 * innerRing)));

  // 6 · a second, inner outline of each triangle in the accent (the double line).
  if (doubled > 0) {
    push(polygon('dbl-up', triangle(0, R - 5), 0.4, round(0.5 * doubled), { tone: 'accent', dash: round(doubled) }));
    push(polygon('dbl-down', triangle(60, R - 5), 0.4, round(0.5 * doubled), { tone: 'accent', dash: round(doubled) }));
  }

  // 7 · fine rays from the six inner corners outward to the circle (never through the centre).
  if (rays > 0) NOTCHES.forEach((d, i) => push(line(`ray-${i}`, d, NOTCH + 3, NOTCH + 3 + 21 * rays, 0.35, round(0.55 * rays))));

  // 8 · a small Magen David within, turned so its points face the inner corners.
  if (innerStar > 0) {
    push(polygon('inner-up', triangle(30, 12), 0.45, round(0.7 * innerStar), { dash: round(innerStar) }));
    push(polygon('inner-down', triangle(90, 12), 0.45, round(0.7 * innerStar), { dash: round(innerStar) }));
  }

  // 9 · a twelve-fold rhythm of fine ticks outside the circle.
  if (rhythm > 0) for (let i = 0; i < 12; i += 1) push(line(`tick-${i}`, i * 30, 53, 53 + 3.2 * rhythm, 0.45, round(0.6 * rhythm), { drift: true }));

  // 10 · arcs over the six inner corners, outside the circle.
  if (arcs > 0) NOTCHES.forEach((d, i) => push(arc(`arc-${i}`, d, 36 * arcs, 57, 0.5, round(0.55 * arcs))));

  // 11 · the seed of life, faint, at the heart.
  if (seed > 0) {
    push({ kind: 'circle', key: 'seed-c', r: 9, w: 0.3, o: round(0.4 * seed) });
    SIX.forEach((d, i) => { const [cx, cy] = pt(d, 9); push({ kind: 'circle', key: `seed-${i}`, at: d, cx, cy, r: 9, w: 0.3, o: round(0.32 * seed) }); });
  }

  // 12 · depth: the hexagon of the six points, in the accent.
  if (depth > 0) push(polygon('hex-outer', SIX.map(d => pt(d, R)), 0.45, round(0.38 * depth), { tone: 'accent', dash: round(depth) }));

  // 13 · a crown of twenty-four points.
  if (crown > 0) for (let i = 0; i < 24; i += 1) push(dot(`crown-${i}`, i * 15 + 7.5, 61, (i % 2 ? 0.6 : 0.95) * crown, round(0.75 * crown)));

  // 14 · radiance: a last fine ring and light on the twelve nodes.
  push(ringAt('ring-halo', 63, radiance, 0.3, round(0.4 * radiance), { tone: 'accent' }));
  if (radiance > 0) NOTCHES.forEach((d, i) => push(dot(`light-${i}`, d, NOTCH, 1.3 * radiance, round(0.85 * radiance), { glint: true })));

  push({ kind: 'core', key: 'core', r: round(1.6 + 1.4 * total) });
  return items;
}
