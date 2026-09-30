import { useId } from 'react';
import { SEAL_VIEWBOX, sealPrimitives } from '../services/sealGeometry.mjs';

// The seal of "מעגלי עולם" — drawn from services/sealGeometry.mjs (pure, deterministic). Always decorative: the text
// beside it carries the meaning (the count is never drawn inside it). Its colour is the theme's gold (currentColor).
// A small seal draws its fine lines a little thicker so the same geometry still reads at 30 px.
// `alive` (only for the few seals that deserve it: the large one, the Home one, the current rank) lets it move gently:
// the central light breathes, the fine outer tick rhythm turns very slowly, a soft light travels along the boundary.
// All in CSS (transform / opacity only); under reduced motion (system or the app's setting) it stands still.
export default function CircleSeal({ count = 0, size = 32, className = '', alive = false }) {
  const id = useId().replace(/:/g, '');
  const px = Math.max(16, Number(size) || 32);
  const thicken = Math.min(2.4, Math.max(1, 96 / px));
  const items = sealPrimitives(count);
  const c = SEAL_VIEWBOX / 2;
  const stroke = item => ({ fill: item.fill ? 'currentColor' : 'none', fillOpacity: item.fill || undefined, stroke: 'currentColor', strokeWidth: Math.round(item.w * thicken * 100) / 100, strokeOpacity: item.o, strokeLinecap: 'round', strokeLinejoin: item.join || 'round' });
  const draw = item => {
    switch (item.kind) {
      case 'glow': return <circle key={item.key} className="circle-seal-glow" cx={c} cy={c} r={item.r} fill={`url(#seal-glow-${id})`} opacity={item.o} />;
      case 'core': return <circle key={item.key} className="circle-seal-core" cx={c} cy={c} r={item.r * Math.min(1.6, thicken)} fill="currentColor" />;
      case 'dot': return <circle key={item.key} cx={item.cx} cy={item.cy} r={item.r * Math.min(1.5, thicken)} fill="currentColor" fillOpacity={item.o} />;
      case 'circle': return <circle key={item.key} cx={item.cx ?? c} cy={item.cy ?? c} r={item.r} {...stroke(item)} />;
      case 'line': return <line key={item.key} x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} {...stroke(item)} />;
      case 'path': return <path key={item.key} d={item.d} pathLength={item.dash ? 1 : undefined} strokeDasharray={item.dash ? `${item.dash} 1` : undefined} {...stroke(item)} />;
      default: return null;
    }
  };
  const drift = items.filter(item => item.drift);
  const core = items.filter(item => item.kind === 'core');
  const glows = items.filter(item => item.kind === 'glow');
  const rest = items.filter(item => !item.drift && item.kind !== 'core' && item.kind !== 'glow');
  // The travelling light: a short tapered highlight on the boundary ring (three stacked arcs, brightest at the middle).
  const sheen = alive ? [[34, 0.16], [20, 0.22], [8, 0.3]].map(([span, o]) => {
    const t = (span / 2) * (Math.PI / 180); const x1 = c - 44 * Math.sin(t); const x2 = c + 44 * Math.sin(t); const y = c - 44 * Math.cos(t);
    return <path key={span} d={`M ${x1.toFixed(2)} ${y.toFixed(2)} A 44 44 0 0 1 ${x2.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke="currentColor" strokeWidth={Math.round(1.6 * thicken * 100) / 100} strokeOpacity={o} strokeLinecap="round" />;
  }) : null;
  return <svg className={`circle-seal${alive ? ' is-alive' : ''} ${className}`.trim()} width={px} height={px} viewBox={`0 0 ${SEAL_VIEWBOX} ${SEAL_VIEWBOX}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`seal-glow-${id}`}>
        <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
        <stop offset="0.45" stopColor="currentColor" stopOpacity="0.28" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
    </defs>
    <g className="circle-seal-breath">{glows.map(draw)}</g>
    {rest.map(draw)}
    {drift.length > 0 && <g className="circle-seal-drift">{drift.map(draw)}</g>}
    {sheen && <g className="circle-seal-sheen">{sheen}</g>}
    {core.map(draw)}
  </svg>;
}
