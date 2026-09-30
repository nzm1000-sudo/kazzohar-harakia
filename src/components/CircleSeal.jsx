import { useId } from 'react';
import { SEAL_VIEWBOX, sealPrimitives } from '../services/sealGeometry.mjs';

// The seal of "מעגלי עולם" — drawn from services/sealGeometry.mjs (pure, deterministic). Always decorative: the text
// beside it carries the meaning (the count is never drawn inside it). Its colour is the theme's gold (currentColor).
// A small seal draws its fine lines a little thicker so the same geometry still reads at 30 px.
export default function CircleSeal({ count = 0, size = 32, className = '' }) {
  const id = useId().replace(/:/g, '');
  const px = Math.max(16, Number(size) || 32);
  const thicken = Math.min(2.4, Math.max(1, 96 / px));
  const items = sealPrimitives(count);
  const stroke = item => ({ fill: 'none', stroke: 'currentColor', strokeWidth: Math.round(item.w * thicken * 100) / 100, strokeOpacity: item.o, strokeLinecap: 'round', strokeLinejoin: item.join || 'round' });
  return <svg className={`circle-seal ${className}`.trim()} width={px} height={px} viewBox={`0 0 ${SEAL_VIEWBOX} ${SEAL_VIEWBOX}`} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`seal-glow-${id}`}>
        <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
        <stop offset="0.45" stopColor="currentColor" stopOpacity="0.28" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
    </defs>
    {items.map(item => {
      const c = SEAL_VIEWBOX / 2;
      switch (item.kind) {
        case 'glow': return <circle key={item.key} className="circle-seal-glow" cx={c} cy={c} r={item.r} fill={`url(#seal-glow-${id})`} opacity={item.o} />;
        case 'core': return <circle key={item.key} className="circle-seal-core" cx={c} cy={c} r={item.r * Math.min(1.6, thicken)} fill="currentColor" />;
        case 'dot': return <circle key={item.key} cx={item.cx} cy={item.cy} r={item.r * Math.min(1.5, thicken)} fill="currentColor" fillOpacity={item.o} />;
        case 'circle': return <circle key={item.key} cx={item.cx ?? c} cy={item.cy ?? c} r={item.r} {...stroke(item)} />;
        case 'line': return <line key={item.key} x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} {...stroke(item)} />;
        case 'rect': return <rect key={item.key} x={item.x} y={item.y} width={item.width} height={item.height} rx="1.6" {...stroke(item)} />;
        case 'path': return <path key={item.key} d={item.d} pathLength={item.dash ? 1 : undefined} strokeDasharray={item.dash ? `${item.dash} 1` : undefined} {...stroke(item)} />;
        default: return null;
      }
    })}
  </svg>;
}
