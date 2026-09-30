// "חותם מעגלי עולם" — the seal of the circles completed over a lifetime. Pure and deterministic: a lifetime count in,
// a list of SVG primitives out (no DOM, no randomness). The seal is the spiritual circle matured: a central light, thin
// rings, marks and arcs in radial symmetry, always circular. Its vocabulary is six-fold (hexagon, seed of life, a
// refined Magen David) with twelve-fold rhythms around it: nothing is ever set on a vertical-plus-horizontal pair of
// axes, no long stroke passes through the centre, and no layer is four marks on the axes — nothing reads as a cross. Each of the fifteen ranks adds ONE layer to the same
// geometric system, and each layer grows in proportion as the count moves toward its rank (arc completion, stroke
// growth, opacity, nodes appearing) — so 325 is visibly a quarter of the way from בינה (300) to חכמה (400).
import { RANKS } from './spiritualCircle.mjs';

export const SEAL_VIEWBOX = 128;
const C = 64;
const R = 44; // the seal's own boundary ring
const round = v => Math.round(v * 100) / 100;
const clamp01 = v => Math.min(1, Math.max(0, v));
const pt = (deg, r) => { const t = (deg * Math.PI) / 180; return [round(C + r * Math.sin(t)), round(C - r * Math.cos(t))]; };
const line = (deg, r1, r2, w, o, key) => { if (Math.abs(r2 - r1) < 0.15) return null; const [x1, y1] = pt(deg, r1); const [x2, y2] = pt(deg, r2); return { kind: 'line', key, x1, y1, x2, y2, w, o }; };
const dot = (deg, r, size, o, key) => { const [cx, cy] = pt(deg, r); return { kind: 'dot', key, cx, cy, r: size, o }; };
// An arc centred on `deg`, `span` degrees wide, drawn symmetrically about its centre.
function arc(deg, span, r, w, o, key) {
  if (span <= 0.2) return null;
  const [x1, y1] = pt(deg - span / 2, r); const [x2, y2] = pt(deg + span / 2, r);
  return { kind: 'path', key, at: deg, d: `M ${x1} ${y1} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${x2} ${y2}`, w, o };
}
// A ring drawn from the top down both sides at once (symmetric about the vertical axis), `t` of the way round.
function ring(r, t, w, o, key) {
  if (t >= 0.999) return { kind: 'circle', key, r, w, o };
  const half = 180 * t;
  if (half <= 0.5) return null;
  const [lx, ly] = pt(-half, r); const [top, topY] = pt(0, r); const [rx, ry] = pt(half, r);
  return { kind: 'path', key, d: `M ${lx} ${ly} A ${r} ${r} 0 0 1 ${top} ${topY} A ${r} ${r} 0 0 1 ${rx} ${ry}`, w, o };
}
// A hexagon (a vertex at the top); `bulge` bows each edge outward (0: straight, sharp; >0: softened, opened).
function hexagon(r, bulge, w, o, key) {
  const v = [0, 60, 120, 180, 240, 300].map(deg => pt(deg, r));
  let d = `M ${v[0][0]} ${v[0][1]}`;
  for (let i = 0; i < 6; i += 1) {
    const [x2, y2] = v[(i + 1) % 6];
    if (bulge > 0.05) { const [qx, qy] = pt(i * 60 + 30, r * Math.cos(Math.PI / 6) + bulge * 2); d += ` Q ${qx} ${qy} ${x2} ${y2}`; }
    else d += ` L ${x2} ${y2}`;
  }
  return { kind: 'path', key, d: `${d} Z`, w, o, join: bulge > 0.05 ? 'round' : 'miter' };
}
const SYMMETRIC = count => Array.from({ length: count }, (_, i) => (360 / count) * i);

// How far each of the fifteen layers has grown for a count: 1 when its rank is reached, the fraction of the way there
// while the count is between the previous rank and it, 0 before.
export function layerGrowth(count) {
  const n = Math.max(0, Number(count) || 0);
  return RANKS.map((rank, i) => { const from = i ? RANKS[i - 1].at : 0; return clamp01((n - from) / (rank.at - from)); });
}

// The six directions of the hexagon's vertices (one at the top) and the six between them.
const VERTEX = SYMMETRIC(6);
const BETWEEN = VERTEX.map(deg => deg + 30);

// The primitives of the seal. Stroke widths are in viewBox units (the component thickens them for a small seal).
// Primitives with `drift: true` form the fine outer tick rhythm, the one layer the component may turn very slowly.
export function sealPrimitives(count) {
  const g = layerGrowth(count);
  const [malchut, yesod, hod, netzach, tiferet, gevura, chesed, bina, chochma, keter, luchot, ganuz, etz, shechina, einSof] = g;
  const rankReached = g.filter(t => t >= 1).length; // 0–15
  const out = [];
  const add = item => { if (item && item.o > 0.01) out.push(item); };
  // The light at the heart (strengthening slowly with the ranks) and the boundary ring — present from the first circle.
  out.push({ kind: 'glow', key: 'glow', r: 15 + rankReached * 0.35, o: 0.34 + rankReached * 0.018 });
  add(ring(R, 1, 0.9, 0.8, 'boundary'));
  // מלכות — six fine radial marks on the hexagon's directions, growing inward from the boundary.
  for (const deg of VERTEX) add(line(deg, R - 2.2, R - 2.2 - 4.4 * malchut, 0.9, 0.35 + 0.6 * malchut, `m-${deg}`));
  // יסוד — a second, inner ring.
  add(ring(34, yesod, 0.7, 0.75, 'yesod'));
  // הוד — six small nodes between the marks: the boundary becomes a twelve-part rhythm.
  for (const deg of BETWEEN) add(dot(deg, R - 4.4, 0.55 + 0.35 * hod, 0.85 * hod, `h-${deg}`));
  // נצח — six equal soft arcs on the middle ring, the gaps between them on the in-between directions.
  for (const deg of VERTEX) add(arc(deg, 40 * netzach, 28, 1.05, 0.8, `n-${deg}`));
  // תפארת — the seed of life: six fine interlocking circles (quieter once the tablets stand in the centre).
  const rosette = tiferet * (1 - 0.6 * luchot) * (1 - 0.6 * ganuz);
  for (const deg of VERTEX) { const [cx, cy] = pt(deg, 6.2); add({ kind: 'circle', key: `t-${deg}`, cx, cy, r: round(6.2 * (0.55 + 0.45 * tiferet)), w: 0.45, o: 0.7 * rosette }); }
  // גבורה — a six-fold structure, sharp; חסד — the same structure softening and opening outward.
  if (gevura > 0) {
    out.push({ ...hexagon(17, 0.95 * chesed, 0.75, 0.85 - 0.2 * chesed, 'gevura'), dash: gevura < 1 ? gevura : null });
    for (const deg of BETWEEN) add(dot(deg, 21.5, 0.9, 0.8 * chesed, `c-${deg}`));
  }
  // בינה — a third delicate ring with six balanced nodes.
  add(ring(23.5, bina, 0.55, 0.7, 'bina'));
  for (const deg of VERTEX) add(dot(deg, 23.5, 1.15, 0.9 * bina, `b-${deg}`));
  // חכמה — twelve fine elements around the boundary, between the axes (never on them).
  for (const deg of SYMMETRIC(12)) add({ ...line(deg + 15, R + 2.4, R + 2.4 + 3.2 * chochma, 0.5, 0.25 + 0.6 * chochma, `k-${deg}`), drift: true });
  // כתר — a quiet articulation above: a short arc and three nodes, symmetric about the vertical axis.
  add(arc(0, 52 * keter, 51, 0.6, 0.8, 'keter-arc'));
  for (const [deg, size] of [[-22, 0.9], [0, 1.35], [22, 0.9]]) add(dot(deg, 51, size, 0.95 * keter, `kt-${deg}`));
  // לוחות הברית — two minimal arched forms at the centre, rising from the middle; the light stands between them.
  if (luchot > 0) {
    const h = 11 * luchot;
    if (h > 3.8) for (const x of [C - 4.6, C + 1.2]) out.push({ kind: 'path', key: `l-${x}`, d: tablet(x, 3.4, h), w: 0.6, o: 0.9 * Math.min(1, luchot * 1.4) });
  }
  // אור הגנוז — the hidden light: a refined Magen David inscribed in the hexagon, the tablets resting in its heart,
  // drawn in from its points (both sides at once) while a soft inner light gathers.
  if (ganuz > 0) {
    add({ kind: 'glow', key: 'ganuz-glow', r: 10, o: 0.28 * ganuz });
    for (const [apex, a, b] of [[0, 240, 120], [180, 60, 300]]) {
      const [x0, y0] = pt(apex, 17); const [xa, ya] = pt(a, 17); const [xb, yb] = pt(b, 17);
      const mx = round((xa + xb) / 2); const my = round((ya + yb) / 2);
      for (const [side, x, y] of [['a', xa, ya], ['b', xb, yb]]) out.push({ kind: 'path', key: `g-${apex}-${side}`, d: `M ${x0} ${y0} L ${x} ${y} L ${mx} ${my}`, w: 0.45, o: 0.3 + 0.3 * ganuz, dash: ganuz < 1 ? ganuz : null, join: 'miter' });
    }
  }
  // עץ החיים — six slender leaves, softly filled, growing outward in the gaps of נצח until they reach the ring of יסוד.
  if (etz > 0) for (const deg of BETWEEN) add({ ...leaf(deg, 25, 25 + 8.4 * etz, 1.6 * etz, 0.5, 0.75 * etz, `e-${deg}`), fill: 0.3 * etz });
  // אור השכינה — a second, very soft halo outside the seal.
  add({ kind: 'circle', key: 'shechina-soft', r: 54, w: 3.2, o: 0.1 * shechina });
  add(ring(54, shechina, 0.4, 0.45 * shechina, 'shechina'));
  // אור אין סוף — ultra-thin outer rings fading outward, and the twelve fine elements of חכמה continuing as faint rays.
  [57.5, 60, 62].forEach((r, i) => add(ring(r, einSof, 0.3, [0.4, 0.26, 0.14][i] * einSof, `es-${i}`)));
  for (const deg of SYMMETRIC(12)) add({ ...line(deg + 15, R + 6.8, R + 6.8 + 8 * einSof, 0.3, 0.32 * einSof, `ex-${deg}`), drift: true });
  // The core dot last, over everything.
  out.push({ kind: 'core', key: 'core', r: 2.3 + rankReached * 0.04, o: 1 });
  return out.filter(item => item && item.kind);
}
// A tablet: a slender upright form with an arched top, rising from the centre line; `h` its height.
function tablet(x, width, h) {
  const top = round(C - h / 2); const bottom = round(C + h / 2); const r = width / 2;
  return `M ${round(x)} ${bottom} L ${round(x)} ${round(top + r)} A ${r} ${r} 0 0 1 ${round(x + width)} ${round(top + r)} L ${round(x + width)} ${bottom} Z`;
}
// A leaf (a vesica) along the direction `deg`, from radius r1 to r2, `half` its half-width at the middle.
function leaf(deg, r1, r2, half, w, o, key) {
  if (r2 - r1 < 0.6 || half < 0.2) return null;
  const [x1, y1] = pt(deg, r1); const [x2, y2] = pt(deg, r2);
  const chord = r2 - r1; const radius = round((chord * chord / 4 + half * half) / (2 * half));
  return { kind: 'path', key, at: deg, d: `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} A ${radius} ${radius} 0 0 1 ${x1} ${y1} Z`, w, o };
}
