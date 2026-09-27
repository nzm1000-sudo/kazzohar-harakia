import { useId } from 'react';
import { RING_GEOMETRY, RING_VIEWBOX, pt, ribbonPath, tipPoint, clampProgress } from '../services/ringGeometry.mjs';

// "מעגל הרוחני" — the ONE ring component (small around the logo, large on Today). It renders only:
// it never reads the journal, counts anything, or works out day or night itself. Fixed colours, not theme-derived.
const RIBBON = { from: '#e0b955', to: '#ffd98a' };
const DOT = {
  day: { core: '#b8ffe0', glow: 'rgba(90,255,190,0.9)', haloFrom: 'rgba(100,255,190,0.9)', haloTo: 'rgba(40,200,150,0.4)' },
  night: { core: '#c9c2ff', glow: 'rgba(150,130,255,0.9)', haloFrom: 'rgba(150,130,255,0.9)', haloTo: 'rgba(110,70,255,0.4)' },
};
// Long-term rhythm only changes luminosity — never the fill.
const LUMINOSITY = {
  dim: { opacity: 0.72, filter: 'none' },
  glowing: { opacity: 0.9, filter: 'drop-shadow(0 0 1.5px rgba(255,217,138,0.75))' },
  bright: { opacity: 1, filter: 'drop-shadow(0 0 2.5px rgba(255,217,138,0.95)) drop-shadow(0 0 6px rgba(224,185,85,0.55))' },
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
  const dot = DOT[dayOrNight === 'night' ? 'night' : 'day'];
  const look = LUMINOSITY[presenceLevel] || LUMINOSITY.dim;
  return <svg className={`spiritual-ring ${className}`.trim()} width={px} height={px} viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`} aria-hidden="true" focusable="false" data-progress-state={progress >= 1 ? 'full' : progress > 0 ? 'partial' : 'empty'} style={{ overflow: 'visible', display: 'block' }}>
    <defs>
      <linearGradient id={`ribbon-${id}`} gradientUnits="userSpaceOnUse" x1={start.x} y1={start.y} x2={tip.x} y2={tip.y}>
        <stop offset="0" stopColor={RIBBON.from} />
        <stop offset="1" stopColor={RIBBON.to} />
      </linearGradient>
      <radialGradient id={`halo-${id}`}>
        <stop offset="0" stopColor={dot.haloFrom} />
        <stop offset="1" stopColor={dot.haloTo} stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* Dim track: the ring is never fully invisible, even when empty. */}
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={RIBBON.from} strokeOpacity="0.2" strokeWidth={halfWidth * 2} />
    {path && <path d={path} fill={`url(#ribbon-${id})`} fillRule="evenodd" style={{ opacity: look.opacity, filter: look.filter }} />}
    {showCenterDot && <g>
      <circle cx={cx} cy={cy} r="14" fill={`url(#halo-${id})`} />
      <circle cx={cx} cy={cy} r="5" fill={dot.core} style={{ filter: `drop-shadow(0 0 8px ${dot.glow}) drop-shadow(0 0 2px ${dot.glow})` }} />
    </g>}
  </svg>;
}
