import { useId } from 'react';
import { MAGEN_VIEWBOX, magenPrimitives } from '../../services/quiz/magenDavid.mjs';

// The evolving Magen David of בחן אותי, drawn from services/quiz/magenDavid.mjs (pure, deterministic). Decorative: the
// text beside it carries the meaning. Its lines are the theme's gold; the depth layers take the theme's accent. Only an
// `alive` star moves (a slow breath of the central light, the outer rhythm turning very slowly, the nodes shimmering) —
// in CSS, transform/opacity only, and nothing moves under reduced motion (system or the app's setting).
export default function MagenDavid({ points = 0, size = 160, variant = 'classic', alive = false, className = '' }) {
  const id = useId().replace(/:/g, '');
  const px = Math.max(24, Number(size) || 160);
  const thicken = Math.min(2.6, Math.max(1, 150 / px));
  const c = MAGEN_VIEWBOX / 2;
  const items = magenPrimitives(points, variant);
  const sw = w => Math.round(w * thicken * 100) / 100;
  const paint = item => (item.tone === 'accent' ? 'var(--md-accent)' : 'currentColor');
  const draw = item => {
    const stroke = { fill: 'none', stroke: paint(item), strokeWidth: sw(item.w), strokeOpacity: item.o, strokeLinecap: 'round', strokeLinejoin: item.join || 'round' };
    const dash = item.dash !== undefined && item.dash < 0.999 ? { pathLength: 1, strokeDasharray: `${item.dash} 1` } : {};
    switch (item.kind) {
      case 'dot': return <circle key={item.key} className={item.glint ? 'md-glint' : undefined} cx={item.cx} cy={item.cy} r={Math.round(item.r * Math.min(1.6, thicken) * 100) / 100} fill={paint(item)} fillOpacity={item.o} />;
      case 'circle': return <circle key={item.key} cx={item.cx ?? c} cy={item.cy ?? c} r={item.r} {...stroke} />;
      case 'line': return <line key={item.key} x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} {...stroke} />;
      case 'path': return <path key={item.key} d={item.d} {...dash} {...stroke} />;
      default: return null;
    }
  };
  const glow = items.find(item => item.kind === 'glow');
  const core = items.find(item => item.kind === 'core');
  const drift = items.filter(item => item.drift);
  const rest = items.filter(item => !item.drift && item.kind !== 'glow' && item.kind !== 'core');
  return <svg className={`magen-david${alive ? ' is-alive' : ''} ${className}`.trim()} width={px} height={px} viewBox={`0 0 ${MAGEN_VIEWBOX} ${MAGEN_VIEWBOX}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`md-glow-${id}`}>
        <stop offset="0" stopColor="currentColor" stopOpacity="0.55" />
        <stop offset="0.4" stopColor="currentColor" stopOpacity="0.16" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`md-core-${id}`}>
        <stop offset="0" style={{ stopColor: 'var(--md-spark)' }} stopOpacity="1" />
        <stop offset="0.5" stopColor="currentColor" stopOpacity="0.5" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
    </defs>
    {glow ? <circle className="md-glow" cx={c} cy={c} r={glow.r} fill={`url(#md-glow-${id})`} opacity={glow.o} /> : null}
    {drift.length ? <g className="md-drift">{drift.map(draw)}</g> : null}
    <g className="md-body">{rest.map(draw)}</g>
    {core ? <g className="md-core">
      <circle cx={c} cy={c} r={core.r * 3.2} fill={`url(#md-core-${id})`} />
      <circle cx={c} cy={c} r={Math.round(core.r * Math.min(1.4, thicken) * 100) / 100} fill="currentColor" />
    </g> : null}
  </svg>;
}
