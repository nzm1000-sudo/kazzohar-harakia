import { useId, useLayoutEffect, useRef, useState } from 'react';
import { LADDER_STEPS, LADDER_SIZE, LIFELINES, AUDIENCE_NOTE } from '../../services/quiz/ladder.mjs';

// The parts of הסולם: the lozenge outline (the game's frame — an elongated hexagon in a fine double gold line, never a
// filled box), the ladder of fifteen steps (vertical, and a compact rail for the phone), the marks of a game, the
// lifeline glyphs and the simulated audience.
const nf = new Intl.NumberFormat('he-IL');
export const formatPoints = n => nf.format(n);

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect;

// An elongated hexagon drawn to the element's own size (measured), so the pointed ends keep their angle and the line
// stays one pixel whatever the text's length. `tip` is the depth of each point.
export function lozengePath(w, h, tip, inset = 0.75) {
  const t = Math.min(tip, h * 0.75);
  const m = h / 2;
  return `M${t} ${inset}H${w - t}L${w - inset} ${m}L${w - t} ${h - inset}H${t}L${inset} ${m}Z`;
}
// The inner line of the bevel: the same shape, `d` pixels inside.
export function lozengeInner(w, h, tip, d = 3.5) {
  const t = Math.min(tip, h * 0.75);
  const m = h / 2;
  const sinA = (m) / Math.hypot(t, m);
  const xTop = t * (1 - (2 * d) / h) + d / sinA;
  const xTip = d / sinA;
  return `M${xTop} ${d}H${w - xTop}L${w - xTip} ${m}L${w - xTop} ${h - d}H${xTop}L${xTip} ${m}Z`;
}

// `glow`: the arena's lit face — a soft two-stop gradient inside the outline (its colours set by the stylesheet per state).
export function Lozenge({ as: Tag = 'div', className = '', tip = 18, bevel = true, glow = false, children, innerRef = null, ...rest }) {
  const ref = useRef(null);
  const gid = `qzl-${useId().replace(/:/g, '')}`;
  const [size, setSize] = useState({ w: 320, h: 64 });
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => { const w = el.offsetWidth; const h = el.offsetHeight; if (w && h) setSize(s => (s.w === w && s.h === h ? s : { w, h })); };
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w, h } = size;
  const setRef = el => { ref.current = el; if (typeof innerRef === 'function') innerRef(el); else if (innerRef) innerRef.current = el; };
  return <Tag ref={setRef} className={`qz-lozenge ${className}`} {...rest}>
    <svg className="qz-frame" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {glow ? <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="qz-face-a" /><stop offset="1" className="qz-face-b" /></linearGradient></defs> : null}
      <path className={`qz-edge${glow ? ' is-glow' : ''}`} d={lozengePath(w, h, tip)} style={glow ? { fill: `url(#${gid})` } : undefined} />
      {bevel && h > 30 ? <path className="qz-bevel" d={lozengeInner(w, h, tip)} /> : null}
      <path className="qz-sweep" d={lozengePath(w, h, tip)} pathLength="1" />
    </svg>
    {children}
  </Tag>;
}

// A small hexagram for the safe steps (the quiz's own sign).
export function SafeMark({ size = 12 }) {
  return <svg className="qz-safe-mark" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <path d="M12 3l7.8 13.5H4.2z" /><path d="M12 21L4.2 7.5h15.6z" />
  </svg>;
}

// The ladder, vertical: fifteen at the top, one at the foot. Read in order (1 → 15) by a screen reader.
export function LadderColumn({ climbed = 0, current = null, just = null, className = '', label = 'הסולם — חמש עשרה מעלות' }) {
  return <ol className={`qz-ladder ${className}`} aria-label={label}>
    {LADDER_STEPS.map(s => {
      const done = s.step <= climbed;
      const isCurrent = current === s.step;
      return <Lozenge as="li" key={s.step} tip={12} bevel={false} className={`qz-rung${done ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}${just === s.step ? ' is-just' : ''}${s.safe ? ' is-safe' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
        <span className="qz-ladder-num">{s.step}</span>
        <span className="qz-ladder-gem" aria-hidden="true">{s.safe ? <SafeMark /> : <i />}</span>
        <span className="qz-ladder-pts">{formatPoints(s.points)}</span>
        {s.safe ? <span className="visually-hidden"> · מדרגת ביטחון</span> : null}
        {done ? <span className="visually-hidden"> · הושלמה</span> : null}
      </Lozenge>;
    })}
  </ol>;
}

// The compact rail (phone): fifteen small diamonds on a hairline, right to left; the safe steps doubled; a halo moves to
// the current step. `marks` (a finished game) draws right / wrong / open instead.
const RAIL_W = 300;
const railX = step => RAIL_W - 10 - (step - 1) * ((RAIL_W - 20) / (LADDER_SIZE - 1));
export function LadderRail({ climbed = 0, current = null, just = null, marks = null, className = '' }) {
  const haloStep = current || (climbed ? Math.min(LADDER_SIZE, climbed) : null);
  return <svg className={`qz-rail ${className}`} viewBox={`0 0 ${RAIL_W} 30`} aria-hidden="true" focusable="false">
    <line className="qz-rail-line" x1={railX(1)} x2={railX(LADDER_SIZE)} y1="15" y2="15" />
    <line className="qz-rail-done" x1={railX(1)} x2={railX(Math.max(1, Math.min(LADDER_SIZE, marks ? marks.filter(m => m === 'right').length : climbed)))} y1="15" y2="15" />
    {haloStep && !marks ? <g className="qz-rail-halo" style={{ transform: `translateX(${railX(haloStep)}px)` }}><circle cx="0" cy="15" r="11" /></g> : null}
    {just && !marks ? <g className="qz-rail-sparks" transform={`translate(${railX(just)} 15)`}>
      {[-36, -18, 0, 18, 36, -8, 8].map((dx, i) => <circle key={i} r={i % 2 ? 1.1 : 1.6} style={{ '--dx': `${dx * 0.5}px`, '--dy': `${-14 - (i % 3) * 5}px`, animationDelay: `${i * 40}ms` }} />)}
    </g> : null}
    {LADDER_STEPS.map(s => {
      const x = railX(s.step);
      const state = marks ? marks[s.step - 1] : s.step <= climbed ? 'right' : s.step === current ? 'current' : 'open';
      const r = state === 'current' ? 5.6 : s.safe ? 4.6 : 3.6;
      const d = `M${x} ${15 - r}L${x + r} 15L${x} ${15 + r}L${x - r} 15Z`;
      return <g key={s.step} className={`qz-rail-step is-${state}${s.safe ? ' is-safe' : ''}${just === s.step ? ' is-just' : ''}`}>
        {s.safe ? <path className="qz-rail-ring" d={`M${x} ${15 - r - 3.2}L${x + r + 3.2} 15L${x} ${15 + r + 3.2}L${x - r - 3.2} 15Z`} /> : null}
        <path d={d} />
      </g>;
    })}
  </svg>;
}

// Lifeline glyphs: thin lines, the palette's gold.
export function LifelineGlyph({ id }) {
  if (id === 'fifty') return <span className="qz-life-text" aria-hidden="true">50:50</span>;
  const common = { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false };
  if (id === 'audience') return <svg {...common}><path d="M5 19v-6M9.7 19V7M14.3 19v-9M19 19v-4" /><path d="M3.5 21h17" /></svg>;
  return <svg {...common}><path d="M18.5 9.5A7 7 0 0 0 6 7.2" /><path d="M5.5 4.2v3.4h3.4" /><path d="M5.5 14.5A7 7 0 0 0 18 16.8" /><path d="M18.5 19.8v-3.4h-3.4" /></svg>;
}

export function Lifelines({ used, disabled, onUse }) {
  return <div className="qz-lifelines" role="group" aria-label="גלגלי עזרה — כל אחד פעם אחת במשחק">
    {LIFELINES.map(l => {
      const spent = Boolean(used?.[l.id]);
      return <div key={l.id} className={`qz-life${spent ? ' is-used' : ''}`}>
        <Lozenge as="button" type="button" tip={12} bevel={false} glow className="qz-life-btn" aria-disabled={spent || disabled || undefined}
          aria-label={`${l.label}${spent ? ' — נוצל' : ` — ${l.detail}`}`} onClick={() => { if (!spent && !disabled) onUse?.(l.id); }}>
          <LifelineGlyph id={l.id} />
        </Lozenge>
        <small aria-hidden="true">{l.label}</small>
      </div>;
    })}
  </div>;
}

// The simulated audience: four outlined columns, the share in each, א–ד under them; said in words to a screen reader.
export function AudienceChart({ poll, marks = ['א', 'ב', 'ג', 'ד'] }) {
  if (!poll) return null;
  const words = poll.map((v, i) => `${marks[i]} ${v}%`).join(', ');
  return <figure className="qz-audience" role="group" aria-label={`שאל את הקהל (הדמיה): ${words}`}>
    <div className="qz-audience-cols" aria-hidden="true">
      {poll.map((v, i) => <div key={i} className="qz-audience-col">
        <span className="qz-audience-pct">{v}%</span>
        <span className="qz-audience-bar"><span style={{ transform: `scaleY(${v / 100})` }} /></span>
        <span className="qz-audience-mark">{marks[i]}</span>
      </div>)}
    </div>
    <figcaption>{AUDIENCE_NOTE}</figcaption>
  </figure>;
}

// מסלול למתחילים: the three lives — small quiet hearts in the palette's gold, a lost one hollow (its outline only). The
// words are read instead of the marks ("נותרו 2 מתוך 3 טעויות"); the verdict's live line says it after a mistake.
export const livesWords = (left, total) => (left === 1 ? `נותרה טעות אחת מתוך ${total}` : `נותרו ${left} טעויות מתוך ${total}`);
export function LivesMarks({ left, total = 3, className = '' }) {
  return <p className={`qz-lives${className ? ` ${className}` : ''}`} role="img" aria-label={livesWords(left, total)}>
    {Array.from({ length: total }, (_, i) => {
      const on = i < left;
      return <svg key={i} className={`qz-heart${on ? ' is-on' : ' is-lost'}`} viewBox="0 0 20 18" width="16" height="15" aria-hidden="true" focusable="false">
        <path d="M10 16.2C4.6 12.6 1.6 9.6 1.6 6.1 1.6 3.6 3.5 1.8 5.8 1.8c1.7 0 3.2.9 4.2 2.4 1-1.5 2.5-2.4 4.2-2.4 2.3 0 4.2 1.8 4.2 4.3 0 3.5-3 6.5-8.4 10.1z" />
      </svg>;
    })}
  </p>;
}
