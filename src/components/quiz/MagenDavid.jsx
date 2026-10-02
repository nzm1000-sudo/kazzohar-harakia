import { useId } from 'react';
import { MAGEN_VIEWBOX, magenPrimitives, magenLuminosity, GLINT_POINTS } from '../../services/quiz/magenDavid.mjs';

// The evolving Magen David of בחן אותי, drawn from services/quiz/magenDavid.mjs (pure, deterministic). Decorative: the
// text beside it carries the meaning. Its lines are the theme's gold; the depth layers take the theme's accent.
// On top of the gold — in the spirit of the rank seal (CircleSeal.jsx) — magenLuminosity() sets colour and life for the
// stage: delicate hues (תכלת, then a soft violet, then a pale rose) as layered hazes behind the star and seen *through*
// its lines (a gradient disc masked by the geometry), a luminous heart, and at the higher stages soft glints on the
// points. Every star shows its stage's colours; only an `alive` star moves: the light breathes, a light travels through
// the lines, the hues turn slowly, lights orbit the rings, the glints twinkle — CSS only, transform/opacity, and nothing
// moves under reduced motion (system or the app's setting). Six-fold always: nothing here is ever cross-like.
// Each hue's haze: [inner, outer] of its band (fraction of the radius), the radius, its strength.
const HAZE = { sky: [0.55, 1, 60, 0.9], violet: [0.25, 0.85, 46, 0.75], rose: [0, 0.6, 26, 0.8] };
const HUES = ['sky', 'violet', 'rose'];
const r2 = v => Math.round(v * 100) / 100;

export default function MagenDavid({ points = 0, size = 160, variant = 'classic', alive = false, className = '' }) {
  const id = useId().replace(/:/g, '');
  const px = Math.max(24, Number(size) || 160);
  const small = px < 60;
  const thicken = Math.min(2.6, Math.max(1, 150 / px));
  const c = MAGEN_VIEWBOX / 2;
  const items = magenPrimitives(points, variant);
  const { intensity, weights, effect, glints } = magenLuminosity(points);
  const sw = w => r2(w * thicken);
  // The jewel's shadow and edge offsets, in the drawing's units (the same on the screen at every size).
  const shade = Math.max(0.6, Math.min(2.4, 128 / px * 1.1));
  const paint = item => (item.tone === 'accent' ? 'var(--md-accent)' : 'currentColor');
  // `keep`: an ink of its own (the gold leaf, its edge, its shadow) that keeps each line's own strength; `lift` scales it.
  const draw = (item, ink, widen = 1, keep = false, lift = 1) => {
    const color = ink || paint(item);
    const o = Math.min(1, item.o * lift);
    const stroke = { fill: 'none', stroke: color, strokeWidth: sw(item.w * widen), strokeOpacity: ink && !keep ? 1 : r2(o), strokeLinecap: 'round', strokeLinejoin: item.join || 'round' };
    const dash = item.dash !== undefined && item.dash < 0.999 ? { pathLength: 1, strokeDasharray: `${item.dash} 1` } : {};
    switch (item.kind) {
      case 'dot': return <circle key={item.key} className={item.glint && !ink ? 'md-glint' : undefined} cx={item.cx} cy={item.cy} r={r2(item.r * Math.min(1.6, thicken) * widen)} fill={color} fillOpacity={ink && !keep ? 1 : r2(o)} />;
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
  const hues = HUES.filter(name => weights[name] > 0.02);
  const lit = Number(points) > 0;
  const ringDone = rest.some(item => item.key === 'ring-outer' && item.kind === 'circle');

  // The hues through the lines: gold, then each hue between soft golds (top to bottom; the disc turns when alive).
  const irisStops = [['var(--md-gold-hi)', 0.5]];
  hues.forEach(name => { irisStops.push([`var(--md-${name})`, weights[name]]); irisStops.push(['var(--md-gold-hi)', 0.35]); });
  if (!hues.length) irisStops.push(['var(--md-gold-hi)', 0.12], ['var(--md-gold-hi)', 0.5]);
  const irisOpacity = r2(Math.min(0.92, (0.22 + 0.66 * intensity) * (small ? 0.75 : 1)));

  // A short tapered light on a ring (three stacked arcs, brightest in the middle) — it orbits when alive.
  const orbit = (r, color, scale = 1) => [[40, 0.16], [22, 0.24], [9, 0.34]].map(([span, o]) => {
    const t = (span / 2) * (Math.PI / 180); const x1 = c - r * Math.sin(t); const x2 = c + r * Math.sin(t); const y = c - r * Math.cos(t);
    return <path key={span} d={`M ${x1.toFixed(2)} ${y.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y.toFixed(2)}`} fill="none" style={{ stroke: color }} strokeWidth={sw(1.5 * scale)} strokeOpacity={r2(Math.min(0.9, o * (1 + intensity)))} strokeLinecap="round" />;
  });
  const lights = alive && !small && effect >= 1 && ringDone ? [
    { r: 50, color: effect >= 3 ? 'var(--md-sky)' : 'var(--md-gold-hi)', n: 1 },
    ...(effect >= 4 ? [{ r: 20, color: 'var(--md-violet)', n: 2, scale: 0.75 }] : []),
    ...(effect >= 5 ? [{ r: 63, color: 'var(--md-rose)', n: 3, scale: 0.7 }] : []),
  ] : [];
  const glintSet = !small ? GLINT_POINTS.slice(0, glints) : [];

  return <svg className={`magen-david${alive ? ' is-alive' : ''} ${className}`.trim()} data-fx={effect} data-hues={1 + hues.length} data-small={small ? '' : undefined}
    width={px} height={px} viewBox={`0 0 ${MAGEN_VIEWBOX} ${MAGEN_VIEWBOX}`} aria-hidden="true" focusable="false">
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
      {hues.map(name => { const [a, b] = HAZE[name]; return <radialGradient key={name} id={`md-haze-${name}-${id}`}>
        <stop offset={a} style={{ stopColor: `var(--md-${name})` }} stopOpacity="0" />
        <stop offset={r2((a + b) / 2)} style={{ stopColor: `var(--md-${name})` }} stopOpacity="0.5" />
        <stop offset={b} style={{ stopColor: `var(--md-${name})` }} stopOpacity="0" />
      </radialGradient>; })}
      {/* The gold leaf of the light look (styles/quiz.css shows .md-jewel only there): bands of bright and deep gold
          across the star, as beaten leaf catches the light. */}
      <linearGradient id={`md-leaf-${id}`} gradientUnits="userSpaceOnUse" x1="14" y1="10" x2="114" y2="118">
        <stop offset="0" style={{ stopColor: 'var(--md-leaf-hi)' }} />
        <stop offset="0.28" style={{ stopColor: 'var(--md-leaf)' }} />
        <stop offset="0.5" style={{ stopColor: 'var(--md-leaf-lo)' }} />
        <stop offset="0.68" style={{ stopColor: 'var(--md-leaf)' }} />
        <stop offset="0.84" style={{ stopColor: 'var(--md-leaf-hi)' }} />
        <stop offset="1" style={{ stopColor: 'var(--md-leaf-lo)' }} />
      </linearGradient>
      {glintSet.length ? <radialGradient id={`md-glint-${id}`}>
        <stop offset="0" style={{ stopColor: 'var(--md-spark)' }} stopOpacity="1" />
        <stop offset="0.3" style={{ stopColor: 'var(--md-gold-hi)' }} stopOpacity="0.5" />
        <stop offset="1" style={{ stopColor: 'var(--md-gold-hi)' }} stopOpacity="0" />
      </radialGradient> : null}
      {lit ? <>
        <linearGradient id={`md-iris-${id}`} gradientUnits="userSpaceOnUse" x1="64" y1="8" x2="64" y2="120">
          {irisStops.map(([color, o], i) => <stop key={i} offset={Math.round((i / (irisStops.length - 1)) * 1000) / 1000} style={{ stopColor: color }} stopOpacity={Math.round(o * 1000) / 1000} />)}
        </linearGradient>
        <linearGradient id={`md-sweep-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--md-spark)' }} stopOpacity="0" />
          <stop offset="0.5" style={{ stopColor: 'var(--md-spark)' }} stopOpacity="0.95" />
          <stop offset="1" style={{ stopColor: 'var(--md-spark)' }} stopOpacity="0" />
        </linearGradient>
        <mask id={`md-mask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={MAGEN_VIEWBOX} height={MAGEN_VIEWBOX}>
          {rest.map(item => draw(item, '#fff', small ? 1.15 : 1.35))}
        </mask>
      </> : null}
    </defs>
    {hues.length ? <g className="md-auraplane"><g className="md-aura">
      {hues.map((name, i) => <circle key={name} className={`md-haze md-haze-${i + 1}`} cx={c} cy={c} r={r2(HAZE[name][2] + 3 * intensity)} fill={`url(#md-haze-${name}-${id})`}
        opacity={r2(weights[name] * HAZE[name][3] * (small ? 0.42 : 0.3 + 0.5 * intensity))} />)}
    </g></g> : null}
    {glow ? <circle className="md-glow" cx={c} cy={c} r={glow.r} fill={`url(#md-glow-${id})`} opacity={glow.o} /> : null}
    {drift.length ? <g className="md-drift">{drift.map(item => draw(item))}</g> : null}
    {/* The light look's jewel (hidden in the night — styles/quiz.css): a soft shadow under the lines, away from the light;
        the lines in gold leaf, a little stronger; a bright edge on their lit side. */}
    <g className="md-jewel md-jewel-shade" transform={`translate(${r2(0.7 * shade)} ${r2(1.2 * shade)})`}>{rest.filter(item => item.kind !== 'dot').map(item => draw(item, 'var(--md-shade)', 2.6, true, 1.2))}</g>
    <g className="md-jewel md-jewel-shade md-jewel-shade-near" transform={`translate(${r2(0.35 * shade)} ${r2(0.6 * shade)})`}>{rest.map(item => draw(item, 'var(--md-shade-near)', item.kind === 'dot' ? 1.15 : 1.7, true, 1.2))}</g>
    <g className="md-body">{rest.map(item => draw(item))}</g>
    <g className="md-jewel md-jewel-leaf">{rest.map(item => draw(item, item.tone === 'accent' ? 'var(--md-accent)' : `url(#md-leaf-${id})`, 1.42, true, 1.5))}</g>
    <g className="md-jewel md-jewel-edge" transform={`translate(${r2(-0.42 * shade)} ${r2(-0.6 * shade)})`}>{rest.filter(item => item.kind !== 'dot').map(item => draw(item, 'var(--md-leaf-edge)', 0.26, true, 1.1))}</g>
    {lit ? <g className="md-irisplane"><g mask={`url(#md-mask-${id})`}>
      <g opacity={irisOpacity}><g className="md-iris"><circle cx={c} cy={c} r={c} fill={`url(#md-iris-${id})`} /></g></g>
      {alive && effect >= 1 ? <g className="md-sweep"><rect x={-44} y={0} width={44} height={MAGEN_VIEWBOX} fill={`url(#md-sweep-${id})`} transform={`rotate(-24 ${c} ${c})`} /></g> : null}
    </g></g> : null}
    {lights.map(({ r, color, n, scale }) => <g key={n} className={`md-light md-light-${n}`}>{orbit(r, color, scale)}</g>)}
    {glintSet.length ? <g className="md-glints">{glintSet.map(([deg, r], i) => {
      const t = (deg * Math.PI) / 180;
      return <circle key={i} className="md-spark" style={{ animationDelay: `${-((i * 2.3) % 7).toFixed(1)}s` }} cx={(c + r * Math.sin(t)).toFixed(2)} cy={(c - r * Math.cos(t)).toFixed(2)} r={r2(3.6 + 0.8 * intensity)} fill={`url(#md-glint-${id})`} />;
    })}</g> : null}
    {core ? <g className="md-core">
      <circle cx={c} cy={c} r={r2(core.r * 3.2 + 8 * intensity)} fill={`url(#md-core-${id})`} opacity={r2(0.75 + 0.25 * intensity)} />
      <circle cx={c} cy={c} r={r2(core.r * Math.min(1.4, thicken))} fill="currentColor" />
    </g> : null}
  </svg>;
}
