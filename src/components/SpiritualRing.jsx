import { useId } from 'react';
import { RING_GEOMETRY, RING_VIEWBOX, clampProgress, pt, ribbonPath, tipPoint } from '../services/ringGeometry.mjs';
import { clayBuildEnabled } from '../services/clayExperiment.mjs';

// "המעגל הרוחני" — the ONE ring component (small around the logo, large on Today). It renders only:
// it never reads the journal, counts anything, or works out day or night itself. Fixed colours, not theme-derived.
// Alive, quietly: the centre dot breathes, a soft aura breathes around the ring, a spark twinkles at the tip.
// All motion stops under prefers-reduced-motion (base.css).
const RIBBON = { from: '#e0b955', to: '#ffd98a' };
const DOT = {
  day: { core: '#b8ffe0', glow: 'rgba(90,255,190,0.9)', haloFrom: 'rgba(100,255,190,0.9)', haloTo: 'rgba(40,200,150,0.4)' },
  night: { core: '#c9c2ff', glow: 'rgba(150,130,255,0.9)', haloFrom: 'rgba(150,130,255,0.9)', haloTo: 'rgba(110,70,255,0.4)' },
};
// CLAY (owner, 2026-10-02): the palette only — gold, copper, ivory and the logo's blue; no green. By day the dot is an
// ivory light in a gold halo; by night it takes the logo's blue, and so does the ring's aura.
const CLAY_DOT = {
  day: { core: '#fff6dc', glow: 'rgba(232,186,92,0.95)', haloFrom: 'rgba(242,206,120,0.95)', haloTo: 'rgba(201,162,74,0.4)' },
  night: { core: '#e3edff', glow: 'rgba(138,180,244,0.95)', haloFrom: 'rgba(138,180,244,0.9)', haloTo: 'rgba(72,118,206,0.4)' },
};
const CLAY_NIGHT_AURA = '#8ab4f4';
// CLAY (owner, 2026-10-02): the progress — the ribbon, its pointed tip and the spark — is ROYAL BLUE, never the band's
// gold (services/progressColor.mjs). The values come from the palette (ring.css: --kz-progress-from/-to; a lighter blue
// in the dark palettes), so the same ring reads on every ground.
const CLAY_RIBBON = { from: 'var(--kz-progress-from, #2347bd)', to: 'var(--kz-progress-to, #325ddb)' };
const CLAY_LUMINOSITY = {
  dim: { opacity: 0.9, filter: 'none', aura: 0.42 },
  glowing: { opacity: 0.96, filter: 'drop-shadow(0 0 1.5px rgba(61,106,234,0.55))', aura: 0.54 },
  bright: { opacity: 1, filter: 'drop-shadow(0 0 2.5px rgba(120,156,248,0.85)) drop-shadow(0 0 6px rgba(42,85,208,0.45))', aura: 0.7 },
};
// Long-term rhythm changes luminosity and aura — never the fill.
const LUMINOSITY = {
  dim: { opacity: 0.78, filter: 'none', aura: 0.42 },
  glowing: { opacity: 0.92, filter: 'drop-shadow(0 0 1.5px rgba(255,217,138,0.75))', aura: 0.54 },
  bright: { opacity: 1, filter: 'drop-shadow(0 0 2.5px rgba(255,217,138,0.95)) drop-shadow(0 0 6px rgba(224,185,85,0.55))', aura: 0.7 },
};
const SIZES = { small: 46, large: 132 };

// For assistive technology the ring is ONE image with a short spoken label ("המעגל הרוחני. התקדמות השבוע: 42 אחוזים."),
// made from the progress it was given (nothing is counted here); every drawn part inside is hidden. `period` names what
// the progress measures ('השבוע' / 'היום'); `label` replaces the whole sentence; `decorative` hides the ring entirely
// (where it sits inside a control that already names itself).
export default function SpiritualRing({ size = 'large', todayProgress = 0, presenceLevel = 'dim', dayOrNight = 'day', showCenterDot = true, className = '', period = '', label = '', decorative = false }) {
  const id = useId().replace(/:/g, '');
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.large;
  const progress = clampProgress(todayProgress);
  const path = ribbonPath(progress);
  const { cx, cy, r, halfWidth } = RING_GEOMETRY;
  const start = pt(0, r);
  const tip = tipPoint(progress);
  const night = dayOrNight === 'night';
  const clay = clayBuildEnabled();
  const dot = (clay ? CLAY_DOT : DOT)[night ? 'night' : 'day'];
  const looks = clay ? CLAY_LUMINOSITY : LUMINOSITY;
  const look = looks[presenceLevel] || looks.dim;
  const state = progress >= 1 ? 'full' : progress > 0 ? 'partial' : 'empty';
  const spoken = label || `המעגל הרוחני. התקדמות${period ? ` ${period}` : ''}: ${Math.round(progress * 100)} אחוזים.`;
  const a11y = decorative ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': spoken };
  return <svg className={`spiritual-ring is-${state} is-${night ? 'night' : 'day'} ${className}`.trim()} width={px} height={px} viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`} {...a11y} focusable="false" data-progress-state={state} style={{ overflow: 'visible', display: 'block' }}>
    <g aria-hidden="true">
    <defs>
      <linearGradient id={`ribbon-${id}`} gradientUnits="userSpaceOnUse" x1={start.x} y1={start.y} x2={tip.x} y2={tip.y}>
        {clay
          ? <><stop offset="0" style={{ stopColor: CLAY_RIBBON.from }} /><stop offset="1" style={{ stopColor: CLAY_RIBBON.to }} /></>
          : <><stop offset="0" stopColor={RIBBON.from} /><stop offset="1" stopColor={RIBBON.to} /></>}
      </linearGradient>
      <radialGradient id={`halo-${id}`}>
        <stop offset="0" stopColor={dot.haloFrom} />
        <stop offset="1" stopColor={dot.haloTo} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`spark-${id}`}>
        <stop offset="0" stopColor={clay ? '#ffffff' : '#fffdf2'} />
        <stop offset="0.35" stopColor={clay ? '#d6e3ff' : '#ffe9b0'} stopOpacity="0.9" />
        {clay ? <stop offset="1" style={{ stopColor: CLAY_RIBBON.to, stopOpacity: 0 }} /> : <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />}
      </radialGradient>
      <filter id={`aura-${id}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.6" /></filter>
    </defs>
    {/* Soft breathing aura around the whole ring. */}
    <circle className="ring-aura" cx={cx} cy={cy} r={r} fill="none" stroke={night ? (clay ? CLAY_NIGHT_AURA : '#b8a8ff') : RIBBON.to} strokeWidth={halfWidth * 4} opacity={look.aura} filter={`url(#aura-${id})`} />
    {/* Dim track: the ring is never fully invisible, even when empty. */}
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={RIBBON.from} strokeOpacity="0.2" strokeWidth={halfWidth * 2} />
    {path && <path className="ring-ribbon" d={path} fill={`url(#ribbon-${id})`} fillRule="evenodd" style={{ opacity: look.opacity, filter: look.filter }} />}
    {state === 'partial' && <circle className="ring-spark" cx={tip.x} cy={tip.y} r="5.5" fill={`url(#spark-${id})`} />}
    {showCenterDot && <g>
      <circle className="ring-dot-halo" cx={cx} cy={cy} r="15" fill={`url(#halo-${id})`} />
      <circle className="ring-dot" cx={cx} cy={cy} r="5" fill={dot.core} style={{ filter: `drop-shadow(0 0 8px ${dot.glow}) drop-shadow(0 0 2px ${dot.glow})` }} />
    </g>}
    </g>
  </svg>;
}
