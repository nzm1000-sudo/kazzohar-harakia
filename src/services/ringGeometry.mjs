// Geometry of "מעגל הרוחני": one filled SVG ribbon. The concave notch (fixed, at 0°/top) and the
// pointed tip (moving, at the progress angle) belong to the SAME path. Pure; no DOM.
export const RING_VIEWBOX = 120;
export const RING_GEOMETRY = Object.freeze({ cx: 60, cy: 60, r: 50, halfWidth: 2.75, notchDeg: 5 });

const round = value => Math.round(value * 1000) / 1000;
export function pt(angleDeg, radius, { cx, cy } = RING_GEOMETRY) {
  const t = (angleDeg * Math.PI) / 180;
  return { x: round(cx + radius * Math.sin(t)), y: round(cy - radius * Math.cos(t)) };
}

// Below this sweep the tip would overlap its own notch; a started ring is shown at least this long.
export const MIN_VISIBLE_DEG = RING_GEOMETRY.notchDeg * 2;

export const clampProgress = value => (Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : 0);

// The reference ribbonPath, hardened: no ribbon at 0, a minimum sweep once started, and a deliberate
// full-circle path at 100% (two arcs per edge — a single arc cannot start and end at the same point).
export function ribbonPath(progress, geometry = RING_GEOMETRY) {
  const p = clampProgress(progress);
  const { r, halfWidth, notchDeg } = geometry;
  const rOut = r + halfWidth;
  const rIn = r - halfWidth;
  if (p <= 0) return null;
  if (p >= 1) {
    // Closed ring: outer circle clockwise, inner circle counter-clockwise (one path, evenodd).
    const o0 = pt(0, rOut, geometry); const o180 = pt(180, rOut, geometry);
    const i0 = pt(0, rIn, geometry); const i180 = pt(180, rIn, geometry);
    return `M ${o0.x} ${o0.y} A ${rOut} ${rOut} 0 1 1 ${o180.x} ${o180.y} A ${rOut} ${rOut} 0 1 1 ${o0.x} ${o0.y} Z `
      + `M ${i0.x} ${i0.y} A ${rIn} ${rIn} 0 1 0 ${i180.x} ${i180.y} A ${rIn} ${rIn} 0 1 0 ${i0.x} ${i0.y} Z`;
  }
  // The tip may never pass the notch it is closing on: stop the sweep one notch short of 360°.
  const thetaDeg = Math.min(Math.max(p * 360, MIN_VISIBLE_DEG), 360 - notchDeg);
  const outerStart = pt(0, rOut, geometry);
  const outerEnd = pt(thetaDeg, rOut, geometry);
  const innerEnd = pt(thetaDeg, rIn, geometry);
  const innerStart = pt(0, rIn, geometry);
  const tipVertex = pt(thetaDeg + notchDeg, r, geometry);
  const notchVertex = pt(notchDeg, r, geometry);
  const largeArc = thetaDeg > 180 ? 1 : 0;
  return `M ${outerStart.x} ${outerStart.y} A ${rOut} ${rOut} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} `
    + `L ${tipVertex.x} ${tipVertex.y} L ${innerEnd.x} ${innerEnd.y} `
    + `A ${rIn} ${rIn} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} L ${notchVertex.x} ${notchVertex.y} Z`;
}

// Where the leading tip is (the gradient brightens toward it).
export function tipPoint(progress, geometry = RING_GEOMETRY) {
  const p = clampProgress(progress);
  const deg = p >= 1 ? 360 : Math.min(Math.max(p * 360, MIN_VISIBLE_DEG), 360 - geometry.notchDeg) + geometry.notchDeg;
  return pt(deg, geometry.r, geometry);
}

// ---- Inscription around the ring: exactly three quarters (270°), centred on the top; the free
// quarter is at the bottom. The arc runs clockwise so the letters stand upright on the outside.
export const INSCRIPTION = Object.freeze({ radius: 58.5, sweepDeg: 270, pad: 18, fontSize: 11.5 });
// Letters stay together; only the gaps between words grow so the words fill the arc exactly.
export const inscriptionWordSpacing = (arcLength, naturalLength, words) => (words > 1 && naturalLength > 0 ? Math.max(0, (arcLength - naturalLength) / (words - 1)) : 0);
export function inscriptionArc(geometry = RING_GEOMETRY, { radius, sweepDeg } = INSCRIPTION) {
  const half = sweepDeg / 2;
  const from = pt(-half, radius, geometry);
  const to = pt(half, radius, geometry);
  return { d: `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${to.x} ${to.y}`, length: round((2 * Math.PI * radius * sweepDeg) / 360) };
}
// Hebrew along an SVG path is laid out differently by each engine's bidi. To read right-to-left
// identically everywhere, the letters are placed in visual order (left→right) with bidi override:
// each letter keeps its own vowel marks (they never separate from their base letter).
export function visualOrderHebrew(text) {
  const clusters = String(text).match(/[^\u0591-\u05C7][\u0591-\u05C7]*/g) || [];
  return clusters.reverse().join('');
}

