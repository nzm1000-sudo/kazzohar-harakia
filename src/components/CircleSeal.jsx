import { useId } from 'react';
import { SEAL_VIEWBOX, sealPrimitives } from '../services/sealGeometry.mjs';
import { sealLuminosity } from '../services/sealLuminosity.mjs';

// The seal of "מעגלי עולם" — drawn from services/sealGeometry.mjs (pure, deterministic). Always decorative: the text
// beside it carries the meaning (the count is never drawn inside it). Its lines are the theme's gold (currentColor).
// A small seal draws its fine lines a little thicker so the same geometry still reads at 30 px.
// On top of the gold, services/sealLuminosity.mjs sets the colour and life for the rank (styles/seal.css): concentric
// coloured hazes (radial gradients — pre-blurred, no filters), the hues passing through the lines (a gradient disc seen
// only through the lines, as a mask) and a luminous core. Every seal shows its rank's colours; only `alive` seals (the
// large one, the Home one, the card, the current rank) move: the light breathes, the hues turn, lights travel the rings,
// glints twinkle on the nodes, and at the higher ranks the glow plane and the glints drift against each other (a quiet parallax depth, crisp vector, no 3D layer). All in CSS (transform / opacity only); under reduced
// motion (system or the app's setting) nothing moves — the colours stay.
// Each hue's haze: [inner, outer] of its band (fraction of the radius), the radius, its strength.
const HAZE = { violet: [0.5, 1, 60, 1], sky: [0.3, 0.8, 46, 0.55], rose: [0, 0.6, 24, 0.75], green: [0.84, 0.98, 50, 0.7] };
const IRIS = ['violet', 'sky', 'rose', 'green'];

export default function CircleSeal({ count = 0, size = 32, className = '', alive = false }) {
  const id = useId().replace(/:/g, '');
  const px = Math.max(16, Number(size) || 32);
  const small = px < 60;
  const thicken = Math.min(2.4, Math.max(1, 96 / px));
  const items = sealPrimitives(count);
  const lum = sealLuminosity(count);
  const { intensity, weights, effect } = lum;
  const c = SEAL_VIEWBOX / 2;
  const sw = w => Math.round(w * thicken * 100) / 100;
  const stroke = (item, paint = 'currentColor', widen = 1) => ({ fill: item.fill ? paint : 'none', fillOpacity: item.fill || undefined, stroke: paint, strokeWidth: sw(item.w * widen), strokeOpacity: item.o, strokeLinecap: 'round', strokeLinejoin: item.join || 'round' });
  const draw = (item, paint, widen) => {
    switch (item.kind) {
      case 'glow': return <circle key={item.key} className="circle-seal-glow" cx={c} cy={c} r={item.r} fill={`url(#seal-glow-${id})`} opacity={item.o} />;
      case 'core': return <circle key={item.key} className="circle-seal-core" cx={c} cy={c} r={item.r * Math.min(1.6, thicken)} fill="currentColor" />;
      case 'dot': return <circle key={item.key} cx={item.cx} cy={item.cy} r={item.r * Math.min(1.5, thicken)} fill={paint || 'currentColor'} fillOpacity={item.o} />;
      case 'circle': return <circle key={item.key} cx={item.cx ?? c} cy={item.cy ?? c} r={item.r} {...stroke(item, paint, widen)} />;
      case 'line': return <line key={item.key} x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} {...stroke(item, paint, widen)} />;
      case 'path': return <path key={item.key} d={item.d} pathLength={item.dash ? 1 : undefined} strokeDasharray={item.dash ? `${item.dash} 1` : undefined} {...stroke(item, paint, widen)} />;
      default: return null;
    }
  };
  const drift = items.filter(item => item.drift);
  const core = items.filter(item => item.kind === 'core');
  const glows = items.filter(item => item.kind === 'glow');
  const rest = items.filter(item => !item.drift && item.kind !== 'core' && item.kind !== 'glow');
  const hues = IRIS.filter(name => weights[name] > 0.02);
  // A short tapered highlight on a ring (three stacked arcs, brightest at the middle), in the gold or a hue.
  const travel = (r, paint, scale = 1) => [[34, 0.16], [20, 0.22], [8, 0.3]].map(([span, o]) => {
    const t = (span / 2) * (Math.PI / 180); const x1 = c - r * Math.sin(t); const x2 = c + r * Math.sin(t); const y = c - r * Math.cos(t);
    return <path key={span} d={`M ${x1.toFixed(2)} ${y.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y.toFixed(2)}`} fill="none" style={{ stroke: paint }} strokeWidth={sw(1.6 * scale)} strokeOpacity={Math.min(0.9, o * (1 + intensity))} strokeLinecap="round" />;
  });
  const lights = alive && effect >= 1 ? [
    { r: 44, paint: effect >= 3 ? 'var(--seal-sky)' : 'currentColor', n: 1 },
    ...(effect >= 3 && !small ? [{ r: 28, paint: 'var(--seal-violet)', n: 2, scale: 0.8 }] : []),
    ...(effect >= 4 && !small ? [{ r: 34, paint: 'var(--seal-green)', n: 3, scale: 0.7 }] : []),
    ...(effect >= 5 && !small ? [{ r: 54, paint: 'var(--seal-rose)', n: 4, scale: 0.7 }] : []),
  ] : [];
  // Glints on the six nodes of בינה and between the marks (never on a single pair of axes: a staggered six-fold set).
  const glintAt = [[0, 23.5], [120, 23.5], [240, 23.5], [30, 39.6], [150, 39.6], [270, 39.6], [60, 23.5], [180, 23.5], [300, 23.5]];
  const glints = alive && effect >= 3 && !small ? glintAt.slice(0, effect >= 5 ? 9 : effect >= 4 ? 6 : 3).map(([deg, r], i) => {
    const t = (deg * Math.PI) / 180;
    return <circle key={i} className="circle-seal-glint" style={{ animationDelay: `${-((i * 2.3) % 7).toFixed(1)}s` }} cx={(c + r * Math.sin(t)).toFixed(2)} cy={(c - r * Math.cos(t)).toFixed(2)} r={3.4} fill={`url(#seal-glint-${id})`} />;
  }) : [];
  // The hues seen through the lines: a disc of gradient, masked by the (slightly widened) geometry.
  const irisOpacity = Math.round((0.28 + 0.62 * intensity) * (small ? 0.7 : 1) * 100) / 100;
  const irisStops = [['var(--seal-gold-hi)', 0.55]];
  hues.forEach(name => { irisStops.push([`var(--seal-${name})`, weights[name]]); irisStops.push(['var(--seal-gold-hi)', 0.4]); });
  if (hues.length === 0) irisStops.push(['var(--seal-gold-hi)', 0.08], ['var(--seal-gold-hi)', 0.6]);
  const lit = count > 0;
  return <svg className={`circle-seal${alive ? ' is-alive' : ''} ${className}`.trim()} data-fx={effect} data-hues={lum.hues} data-small={small ? '' : undefined} width={px} height={px} viewBox={`0 0 ${SEAL_VIEWBOX} ${SEAL_VIEWBOX}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`seal-glow-${id}`}>
        <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
        <stop offset="0.45" stopColor="currentColor" stopOpacity="0.28" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
      {hues.map(name => { const [a, b] = HAZE[name]; return <radialGradient key={name} id={`seal-haze-${name}-${id}`}>
        <stop offset={a} style={{ stopColor: `var(--seal-${name})` }} stopOpacity="0" />
        <stop offset={(a + b) / 2} style={{ stopColor: `var(--seal-${name})` }} stopOpacity="0.55" />
        <stop offset={b} style={{ stopColor: `var(--seal-${name})` }} stopOpacity="0" />
      </radialGradient>; })}
      <radialGradient id={`seal-glint-${id}`}>
        <stop offset="0" style={{ stopColor: 'var(--seal-spark)' }} stopOpacity="1" />
        <stop offset="0.3" style={{ stopColor: 'var(--seal-gold-hi)' }} stopOpacity="0.55" />
        <stop offset="1" style={{ stopColor: 'var(--seal-gold-hi)' }} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`seal-core-${id}`}>
        <stop offset="0" style={{ stopColor: 'var(--seal-spark)' }} stopOpacity="0.95" />
        <stop offset="0.35" style={{ stopColor: 'var(--seal-gold-hi)' }} stopOpacity="0.5" />
        <stop offset="1" style={{ stopColor: 'var(--seal-gold-hi)' }} stopOpacity="0" />
      </radialGradient>
      {lit && <linearGradient id={`seal-iris-${id}`} gradientUnits="userSpaceOnUse" x1="64" y1="6" x2="64" y2="122">
        {irisStops.map(([color, o], i) => <stop key={i} offset={Math.round((i / (irisStops.length - 1)) * 1000) / 1000} style={{ stopColor: color }} stopOpacity={Math.round(o * 1000) / 1000} />)}
      </linearGradient>}
      {lit && <mask id={`seal-mask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={SEAL_VIEWBOX} height={SEAL_VIEWBOX}>
        {rest.map(item => draw(item, '#fff', small ? 1.1 : 1.25))}
      </mask>}
    </defs>
    {hues.length > 0 && <g className="circle-seal-auraplane"><g className="circle-seal-aura">
      {hues.map((name, i) => <circle key={name} className={`circle-seal-haze circle-seal-haze-${i + 1}`} cx={c} cy={c} r={HAZE[name][2] + 3 * intensity} fill={`url(#seal-haze-${name}-${id})`} opacity={Math.round(weights[name] * HAZE[name][3] * (small ? 0.2 : 0.18 + 0.42 * intensity) * 100) / 100} />)}
    </g></g>}
    <g className="circle-seal-breath">{glows.map(draw)}</g>
    {rest.map(item => draw(item))}
    {drift.length > 0 && <g className="circle-seal-drift">{drift.map(item => draw(item))}</g>}
    {lit && <g className="circle-seal-irisplane"><g mask={`url(#seal-mask-${id})`} opacity={irisOpacity}>
      <g className="circle-seal-iris"><circle cx={c} cy={c} r={c} fill={`url(#seal-iris-${id})`} /></g>
    </g></g>}
    {lights.map(({ r, paint, n, scale }) => <g key={n} className={`circle-seal-sheen circle-seal-sheen-${n}`}>{travel(r, paint, scale)}</g>)}
    {glints.length > 0 && <g className="circle-seal-glints">{glints}</g>}
    {lit && <circle className="circle-seal-corelight" cx={c} cy={c} r={Math.round((5 + 13 * intensity) * 100) / 100} fill={`url(#seal-core-${id})`} opacity={Math.round((0.35 + 0.65 * intensity) * 100) / 100} />}
    {core.map(item => draw(item))}
  </svg>;
}
