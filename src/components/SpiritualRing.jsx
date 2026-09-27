import { useId } from 'react';
import { RING_GEOMETRY, RING_VIEWBOX, clampProgress, pt, ribbonPath, tipPoint } from '../services/ringGeometry.mjs';

// "המעגל הרוחני" — the ONE ring component (small around the logo, large on Today). It renders only:
// it never reads the journal, counts anything, or works out day or night itself. Fixed colours, not theme-derived.
// Alive, quietly: the centre dot breathes, a soft aura breathes around the ring, a spark twinkles at the tip.
// All motion stops under prefers-reduced-motion (base.css).
const RIBBON = { from: '#e0b955', to: '#ffd98a' };
const DOT = {
  day: { core: '#b8ffe0', glow: 'rgba(90,255,190,0.9)', haloFrom: 'rgba(100,255,190,0.9)', haloTo: 'rgba(40,200,150,0.4)' },
  // Night blue sampled from the logo's sphere (public/branding/kazzohar-logo-original.jpg, x=1160): centre #CAE7F7,
  // mid #99C5EC, rim #3D79B7 — same stops and opacities as before, only the hue changes.
  night: { core: '#3D79B7', glow: 'rgba(153,197,236,0.9)', haloFrom: 'rgba(202,231,247,0.9)', haloTo: 'rgba(61,121,183,0.4)' },
};
// Long-term rhythm changes luminosity and aura — never the fill.
const LUMINOSITY = {
  dim: { opacity: 0.78, filter: 'none', aura: 0.42 },
  glowing: { opacity: 0.92, filter: 'drop-shadow(0 0 1.5px rgba(255,217,138,0.75))', aura: 0.54 },
  bright: { opacity: 1, filter: 'drop-shadow(0 0 2.5px rgba(255,217,138,0.95)) drop-shadow(0 0 6px rgba(224,185,85,0.55))', aura: 0.7 },
};
const SIZES = { small: 46, large: 132 };

export default function SpiritualRing({ size = 'large', todayProgress = 0, presenceLevel = 'dim', dayOrNight = 'day', showCenterDot = true, className = '' }) {
  const id = useId().replace(/:/g, '');
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.large;
  const progress = clampProgress(todayProgress);
  const path = ribbonPath(progress);
  const { cx, cy, r, halfWidth } = RING_GEOMETRY;
  const start = pt(0, r);
  const tip = tipPoint(progress);
  const night = dayOrNight === 'night';
  const dot = DOT[night ? 'night' : 'day'];
  const look = LUMINOSITY[presenceLevel] || LUMINOSITY.dim;
  const state = progress >= 1 ? 'full' : progress > 0 ? 'partial' : 'empty';
  return <svg className={`spiritual-ring is-${state} is-${night ? 'night' : 'day'} ${className}`.trim()} width={px} height={px} viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`} aria-hidden="true" focusable="false" data-progress-state={state} style={{ overflow: 'visible', display: 'block' }}>
    <defs>
      <linearGradient id={`ribbon-${id}`} gradientUnits="userSpaceOnUse" x1={start.x} y1={start.y} x2={tip.x} y2={tip.y}>
        <stop offset="0" stopColor={RIBBON.from} />
        <stop offset="1" stopColor={RIBBON.to} />
      </linearGradient>
      <radialGradient id={`halo-${id}`}>
        <stop offset="0" stopColor={dot.haloFrom} />
        <stop offset="1" stopColor={dot.haloTo} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`spark-${id}`}>
        <stop offset="0" stopColor="#fffdf2" />
        <stop offset="0.35" stopColor="#ffe9b0" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
      </radialGradient>
      <filter id={`aura-${id}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.6" /></filter>
    </defs>
    {/* Soft breathing aura around the whole ring (at night the logo's mid blue, one family with the dot). */}
    <circle className="ring-aura" cx={cx} cy={cy} r={r} fill="none" stroke={night ? '#99C5EC' : RIBBON.to} strokeWidth={halfWidth * 4} opacity={look.aura} filter={`url(#aura-${id})`} />
    {/* Dim track: the ring is never fully invisible, even when empty. */}
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={RIBBON.from} strokeOpacity="0.2" strokeWidth={halfWidth * 2} />
    {path && <path className="ring-ribbon" d={path} fill={`url(#ribbon-${id})`} fillRule="evenodd" style={{ opacity: look.opacity, filter: look.filter }} />}
    {state === 'partial' && <circle className="ring-spark" cx={tip.x} cy={tip.y} r="5.5" fill={`url(#spark-${id})`} />}
    {showCenterDot && <g>
      <circle className="ring-dot-halo" cx={cx} cy={cy} r="15" fill={`url(#halo-${id})`} />
      <circle className="ring-dot" cx={cx} cy={cy} r="5" fill={dot.core} style={{ filter: `drop-shadow(0 0 8px ${dot.glow}) drop-shadow(0 0 2px ${dot.glow})` }} />
    </g>}
  </svg>;
}
