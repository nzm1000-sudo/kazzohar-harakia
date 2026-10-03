import { useEffect, useId, useRef, useState } from 'react';
import { LADDER_SIZE } from '../../services/quiz/ladder.mjs';
import { comboLevel, formatCountdown, personalRecords } from '../../services/quiz/records.mjs';
import { msToNextWindow } from '../../services/quiz/store.mjs';
import { motionReduced } from '../../services/quiz/feel.mjs';

// The arena of שעשועון טריוויה יהודי — the trivia's own, younger look (styles/quiz.css, "the arena"): bold numbers that
// count up, a progress ring, the combo meter's flame of light, a burst of light on a right answer, the daily challenge's
// countdown and share grid, the category orbs, the medals and the player's own records. All decorative parts are
// aria-hidden; the words beside them carry the meaning. No motion under reduced motion (system or the app's setting).
const nf = new Intl.NumberFormat('he-IL');

// A number that counts up to its value (ease-out, ~0.7s); still and exact under reduced motion and on the first paint.
export function CountUp({ value = 0, from: start0 = null, className = '', ms = 700 }) {
  const [shown, setShown] = useState(start0 ?? value);
  const from = useRef(start0 ?? value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value || motionReduced() || typeof requestAnimationFrame !== 'function') { setShown(value); return undefined; }
    let raf = 0; const t0 = performance.now();
    const tick = t => { const k = Math.min(1, (t - t0) / ms); setShown(Math.round(start + (value - start) * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`qz-count-up ${className}`}>{nf.format(shown)}</span>;
}

// A ring of progress with a bold number at its heart.
export function ProgressRing({ value = 0, size = 58, children, className = '' }) {
  const id = useId().replace(/:/g, '');
  const v = Math.max(0, Math.min(1, value));
  return <span className={`qz-ring ${className}`} style={{ width: size, height: size }}>
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs><linearGradient id={`qzr-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="qz-stop-a" /><stop offset="1" className="qz-stop-b" /></linearGradient></defs>
      <circle cx="24" cy="24" r="21" className="qz-ring-track" />
      <circle cx="24" cy="24" r="21" pathLength="1" className="qz-ring-fill" stroke={`url(#qzr-${id})`} strokeDasharray={`${v} 1`} transform="rotate(-90 24 24)" />
    </svg>
    <span className="qz-ring-body">{children}</span>
  </span>;
}

// The combo meter: a flame of light (never an emoji) that grows with a run of right answers.
export function ComboMeter({ run = 0, label = 'ברצף', decorative = false }) {
  const id = useId().replace(/:/g, '');
  const lv = comboLevel(run);
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `${nf.format(run)} תשובות נכונות ברצף` };
  return <span className={`qz-combo is-lv${lv}${decorative ? ' is-mini' : ''}`} {...a11y}>
    <svg className="qz-flame" viewBox="0 0 24 32" aria-hidden="true" focusable="false">
      <defs><linearGradient id={`qzf-${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" className="qz-flame-a" /><stop offset=".55" className="qz-flame-b" /><stop offset="1" className="qz-flame-c" /></linearGradient></defs>
      <path className="qz-flame-out" fill={`url(#qzf-${id})`} d="M12 1.5c1.2 4.6 6.2 7.6 7.8 12.6 1.9 6-1.7 13.9-7.8 13.9S2.3 22.2 4.2 16.4c.9-2.8 2.9-4.2 3.6-7 .9 1.6 1.2 3.3 1 5 2.4-3.6 3.6-8 3.2-12.9z" />
      <path className="qz-flame-in" d="M12 15.5c.7 2.4 3.6 3.9 3.6 7 0 2.4-1.6 4-3.6 4s-3.6-1.6-3.6-4c0-2 1.3-2.7 1.8-4.3.6.9.8 1.7.7 2.6 1-1.5 1.3-3.4 1.1-5.3z" />
    </svg>
    {decorative ? null : <><span className="qz-combo-num" aria-hidden="true">{nf.format(run)}</span><small aria-hidden="true">{label}</small></>}
  </span>;
}

// A burst of light: twelve points flying out from the centre and fading (only with motion).
export function Burst({ className = '' }) {
  return <span className={`qz-burst ${className}`} aria-hidden="true">
    {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--a': `${i * 30 + (i % 2 ? 12 : 0)}deg`, '--d': `${i % 3 === 0 ? 62 : i % 3 === 1 ? 46 : 54}px` }} />)}
  </span>;
}

// The result as a grid of fifteen squares — three rows of five (the safe steps close the first two rows).
export function ShareGrid({ marks = [], className = '' }) {
  const rows = [0, 1, 2].map(r => marks.slice(r * 5, r * 5 + 5));
  return <div className={`qz-grid ${className}`} aria-hidden="true">
    {rows.map((row, r) => <span key={r} className="qz-grid-row">{row.map((m, i) => <i key={i} className={`is-${m || 'open'}`} />)}</span>)}
  </div>;
}

// The time left until the next challenge (every four hours of the device's clock: 00, 04, 08 …), ticking each second;
// `onDone` once when the round turns.
export function useCountdown(onDone) {
  const [ms, setMs] = useState(() => msToNextWindow());
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let last = msToNextWindow();
    const h = setInterval(() => { const next = msToNextWindow(); if (next > last + 1000) done.current?.(); last = next; setMs(next); }, 1000);
    return () => clearInterval(h);
  }, []);
  return ms;
}
export function NextDaily({ className = '', short = false, onDone }) {
  const ms = useCountdown(onDone);
  const text = formatCountdown(ms);
  return <span className={`qz-next ${className}`}>
    <span>{short ? 'הבא בעוד' : 'האתגר הבא בעוד'}</span> <time className="qz-next-clock" dir="ltr" dateTime={`PT${Math.floor(ms / 1000)}S`}>{text}</time>
  </span>;
}

// The areas' glyphs: fine lines, one per category — and never cross-like.
const GLYPHS = {
  all: <><path d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z" /><circle cx="12" cy="12" r="2.2" /></>,
  tanakh: <><path d="M7 5h10M7 19h10" /><path d="M7 5v14M17 5v14" /><circle cx="7" cy="5" r="1.6" /><circle cx="17" cy="5" r="1.6" /><circle cx="7" cy="19" r="1.6" /><circle cx="17" cy="19" r="1.6" /><path d="M10 9.5h4M10 12h4M10 14.5h3" /></>,
  'torah-stories': <><path d="M3.5 18.5L12 5l8.5 13.5z" /><path d="M10 18.5l2-4 2 4" /></>,
  places: <><path d="M12 21s6-6.1 6-11a6 6 0 0 0-12 0c0 4.9 6 11 6 11z" /><circle cx="12" cy="10" r="2.2" /></>,
  people: <><circle cx="12" cy="8" r="3.4" /><path d="M5 20c.8-3.9 3.6-6 7-6s6.2 2.1 7 6" /></>,
  history: <><path d="M7 3.5h10M7 20.5h10" /><path d="M8 3.5c0 4.5 8 4.5 8 8.5s-8 4-8 8.5M16 3.5c0 4.5-8 4.5-8 8.5" /></>,
  halacha: <><path d="M8.5 20c-1.7 0-2.6-1.6-2.4-4.1.2-2.4 1-4.4 2.7-4.4 1.6 0 2 2 1.8 4.4-.2 2.5-.6 4.1-2.1 4.1z" /><path d="M15.5 13c-1.6 0-2-1.6-1.8-4.1.2-2.4.9-4.4 2.5-4.4 1.7 0 2.4 2 2.2 4.4-.2 2.5-1.2 4.1-2.9 4.1z" /></>,
  shabbat: <><path d="M8 21v-9.5M16 21v-9.5" /><path d="M8 8.5c-1.1-1-1.1-2.4 0-4 1.1 1.6 1.1 3 0 4zM16 8.5c-1.1-1-1.1-2.4 0-4 1.1 1.6 1.1 3 0 4z" /><path d="M5.5 21h13" /></>,
  moadim: <><path d="M4 18c3.5 0 7.5-1.5 10.5-5S19 6 20 4.5" /><path d="M4 18c.2 1.3 1 2 2.3 1.8M20 4.5l-1.8 4.2" /></>,
  brachot: <><path d="M6.5 4.5h11c0 5-2.4 8-5.5 8s-5.5-3-5.5-8z" /><path d="M12 12.5v6M8.5 20.5h7" /></>,
  tefila: <><path d="M4 20.5h16" /><path d="M5 20.5v-12h14v12" /><path d="M5 12.5h14M5 16.5h14M9 8.5v4M15 8.5v4M12 12.5v4M8 16.5v4M16 16.5v4" /></>,
  yahadut: <><path d="M12 3.5l7.2 12.5H4.8z" /><path d="M12 20.5L4.8 8h14.4z" /></>,
};
export function CategoryGlyph({ id }) {
  return <svg className="qz-glyph" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{GLYPHS[id] || GLYPHS.all}</svg>;
}

// A medal for an achievement: a six-sided seal on a ribbon — gold and lit when earned, a quiet outline with a lock when not.
export function Medal({ earned = false, n = 1 }) {
  const id = useId().replace(/:/g, '');
  return <svg className={`qz-medal${earned ? ' is-earned' : ''}`} viewBox="0 0 48 56" aria-hidden="true" focusable="false">
    <defs><linearGradient id={`qzm-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="qz-medal-a" /><stop offset="1" className="qz-medal-b" /></linearGradient></defs>
    <path className="qz-medal-ribbon" d="M15 2h7l4 14h-7zM33 2h-7l-4 14h7z" />
    <path className="qz-medal-face" fill={earned ? `url(#qzm-${id})` : 'none'} d="M24 15l15 8.6v17.2L24 49.4 9 40.8V23.6z" />
    <path className="qz-medal-inner" d="M24 20.5l10.2 5.9v11.8L24 44.1l-10.2-5.9V26.4z" />
    {earned ? <text className="qz-medal-n" x="24" y="36.5" textAnchor="middle">{n}</text>
      : <g className="qz-medal-lock"><rect x="19.5" y="30" width="9" height="7.5" rx="1.6" /><path d="M21.3 30v-2.2a2.7 2.7 0 0 1 5.4 0V30" /></g>}
  </svg>;
}

// A day's points on the chart: in full up to 9,999, then compact (12.6K) so every column keeps its one line.
const compact = new Intl.NumberFormat('he-IL', { notation: 'compact', maximumFractionDigits: 1 });
export const formatDayPoints = n => (n >= 10000 ? compact.format(n).replace(/\u200f/g, '') : nf.format(n));

// השיאים שלי — the player's own records, and השבוע שלי: this week day by day — seven equal columns on one baseline,
// ראשון … שבת under them (א׳ on the right), each day's points above its column, today in a thin outline (never
// filled); the week's points and its place among the player's own weeks either side of the title, mirror-equal.
export function RecordsPanel({ quiz, now = Date.now() }) {
  const r = personalRecords(quiz, now);
  // One slim strip of four: the heading already says שיא, so each cell shows the short name (the full one is read aloud).
  const tiles = [
    { k: 'בסולם', short: 'סולם', v: <>{nf.format(r.bestLadder)}<small>/{LADDER_SIZE}</small></> },
    { k: 'באתגר היומי', short: 'אתגר יומי', v: nf.format(r.bestDaily) },
    { k: 'תשובות ברצף', short: 'תשובות ברצף', v: nf.format(r.bestRun) },
    { k: 'ימים ברצף', short: 'ימים ברצף', v: nf.format(r.bestDays) },
  ];
  const w = r.week;
  const played = w.days.filter(d => d.points > 0);
  const said = `השבוע: ${nf.format(w.points)} נקודות סולם — מקום ${nf.format(w.rank)} מתוך ${nf.format(w.of)} ${w.of === 1 ? 'שבוע' : 'השבועות'} שלך${played.length ? ` · ${played.map(d => `${d.today ? 'היום' : `יום ${d.name}`} ${nf.format(d.points)}`).join(', ')}` : ''}`;
  return <section className="qz-records" aria-labelledby="qz-records-title">
    <h2 className="quiz-eyebrow" id="qz-records-title"><span>השיאים שלי</span></h2>
    <dl className="qz-rec-tiles">
      {tiles.map(t => <div key={t.k}><dt><span className="visually-hidden">{`שיא ${t.k}`}</span><span aria-hidden="true">{t.short}</span></dt><dd>{t.v}</dd></div>)}
    </dl>
    {r.beginner.games ? <p className="qz-rec-beginner"><span>שיא למתחילים</span><b>{nf.format(r.beginner.best)}<small>/{LADDER_SIZE}</small></b></p> : null}
    <figure className="qz-week" role="group" aria-label={said}>
      <div className="qz-week-head" aria-hidden="true">
        <span className="qz-week-stat"><b>{nf.format(w.points)}</b><small>נקודות</small></span>
        <b className="qz-week-title">השבוע שלי</b>
        <span className="qz-week-stat"><b>{nf.format(w.rank)}</b><small>{`מקום מתוך ${nf.format(w.of)}`}</small></span>
      </div>
      <ol className="qz-week-days" aria-hidden="true">
        {w.days.map(d => <li key={d.key} className={`qz-week-day${d.today ? ' is-today' : ''}${d.ahead ? ' is-ahead' : ''}${d.points ? '' : ' is-empty'}`}>
          <span className="qz-week-val">{d.ahead ? '' : formatDayPoints(d.points)}</span>
          <span className="qz-week-col"><i style={{ transform: `scaleY(${d.points ? Math.max(0.06, d.points / w.dayTop) : 0})` }} /></span>
          <span className="qz-week-name">{d.letter}</span>
        </li>)}
      </ol>
      <figcaption className="qz-week-cap">{`מול ${nf.format(w.of)} ${w.of === 1 ? 'שבוע' : 'השבועות'} שלך · רק במכשיר הזה`}</figcaption>
    </figure>
  </section>;
}

// A "level up" moment (a safe step, a run of three, five, ten).
export function LevelUp({ text }) {
  if (!text) return null;
  return <span className="qz-levelup"><span className="qz-levelup-ray" aria-hidden="true" /><b>{text}</b></span>;
}
