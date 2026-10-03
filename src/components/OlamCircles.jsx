import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import CircleSeal from './CircleSeal.jsx';
import { announce } from './a11yPrimitives.jsx';
import { haptic } from './jewishAlarm/AlarmParts.jsx';
import { getPreferences, readSystem, resolvePreferences } from '../services/accessibility/preferences.mjs';
import { circlesLabel, claimCeremony, readCeremony, hebrewCircles, circlesWord, markAnnounced, markSeen, olamSpoken, rankFor, readCircles, remainingTo } from '../services/spiritualCircle.mjs';
import { clayBuildEnabled } from '../services/clayExperiment.mjs';
import { nativeTick } from '../services/clayHaptics.mjs';
import ArrowMark from './ui/ArrowMark.jsx';

// "אורות עגולים" / "מעגלי עולם" — the circles completed over a lifetime, beside the open circle of the week. Everything
// shown here comes from ONE derived count (services/spiritualCircle.mjs: journal → circles, kept by a high-water record).

export const reduceMotionNow = () => { try { return resolvePreferences(getPreferences(), readSystem(globalThis)).reduceMotion; } catch { return false; } };

// CLAY · the rank's name inside the dynamic gold circle (owner, 2026-10-02) — the gold ring that marks "you are here"
// (the current rank's halo on the path), now drawn around the name itself, the same for every rank and wherever a
// rank is named (Today, "אורות עגולים", מעגלי עולם). A fine gold line on a faint track, a small jewel at the top, and a
// soft gold halo that breathes (base.css › .rank-ring-halo; still under reduced motion). Decorative: the button or the
// heading around it already says the rank.
// The rank-up ceremony: when a new rank is reached, the circle closes slowly around the name (from the top, clockwise,
// like the spiritual circle), with one light haptic — once per rank-up (claimCeremony records it before it plays, so a
// re-render, a remount or a reload never plays it again); under reduced motion the circle is simply closed.
export const RANK_CEREMONY_MS = 1800;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
// The ceremony now playing (memory only), so React's development double mount continues it instead of losing it.
let ceremony = null;
export function useRankCeremony(index, lineRef) {
  useLayoutEffect(() => {
    if (!clayBuildEnabled()) return undefined;
    let current = ceremony && !ceremony.done && ceremony.index === index ? ceremony : null;
    if (!current && claimCeremony(index)) {
      if (reduceMotionNow()) return undefined;
      current = ceremony = { index, start: null, done: false };
      nativeTick();
    }
    const line = lineRef.current;
    if (!current || !line) return undefined;
    let frame = 0;
    const step = now => {
      if (current.start === null) current.start = now;
      const t = Math.min(1, (now - current.start) / RANK_CEREMONY_MS);
      line.style.strokeDashoffset = String(1 - easeInOut(t));
      if (t < 1) frame = requestAnimationFrame(step);
      else { current.done = true; line.style.strokeDashoffset = ''; line.closest('.rank-ring')?.classList.remove('is-closing'); }
    };
    line.style.strokeDashoffset = '1';
    line.closest('.rank-ring')?.classList.add('is-closing');
    frame = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(frame); };
  }, [index]);
}

export function RankRing({ rank, size = 'lg', kicker = '' }) {
  const lineRef = useRef(null);
  const id = useRef(`rr${Math.random().toString(36).slice(2, 8)}`).current;
  useRankCeremony(rank.index, lineRef);
  if (!rank?.name) return null;
  const long = rank.name.length > 6;
  return <span className={`rank-ring is-${size}${long ? ' is-long' : ''}`} aria-hidden="true">
    <svg className="rank-ring-svg" viewBox="0 0 100 100" focusable="false">
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0.78" className="rank-ring-halo-stop" stopOpacity="0" />
          <stop offset="0.9" className="rank-ring-halo-stop" stopOpacity="0.34" />
          <stop offset="1" className="rank-ring-halo-stop" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="rank-ring-halo" cx="50" cy="50" r="50" fill={`url(#${id}-halo)`} />
      <circle className="rank-ring-track" cx="50" cy="50" r="45" />
      <circle className="rank-ring-line" ref={lineRef} cx="50" cy="50" r="45" pathLength="1" transform="rotate(-90 50 50)" />
      <circle className="rank-ring-jewel" cx="50" cy="5" r="2.2" />
    </svg>
    <span className="rank-ring-text">{kicker && <span className="rank-ring-kicker">{kicker}</span>}<span className="rank-ring-name">{rank.name}</span></span>
  </span>;
}

// Home, under "המעגל הרוחני" — one quiet, symmetric button to "מעגלי עולם". With a rank: the count (in Hebrew words
// under 100) to the seal's right and the rank to its left, nothing beneath. Before the first rank: the seal on the
// centre axis with the count centred under it ("ללא מעגלים", "שלושה מעגלים"). Never "עוד …".
export function OlamHomeLine({ lifetime, onOpen, sealRef, glowing = false }) {
  const rank = rankFor(lifetime);
  const words = hebrewCircles(rank.count);
  return <button type="button" className={`olam-home${glowing ? ' is-glowing' : ''}${rank.name ? '' : ' is-unranked'}`} onClick={onOpen} aria-label={olamSpoken(rank, 'מעגלי עולם', { zeroless: true })}>
    {rank.name
      ? <span className="olam-home-row" aria-hidden="true">
          <span className="olam-home-count">{words}</span>
          <span className="olam-home-seal" ref={sealRef}><CircleSeal count={rank.count} size={44} alive /></span>
          {clayBuildEnabled() ? <span className="olam-home-rank is-ring"><RankRing rank={rank} size="sm" /></span> : <span className="olam-home-rank">{rank.name}</span>}
        </span>
      : <span className="olam-home-stack" aria-hidden="true">
          <span className="olam-home-seal" ref={sealRef}><CircleSeal count={rank.count} size={44} alive /></span>
          <span className="olam-home-count is-centred">{words}</span>
        </span>}
  </button>;
}

// CLAY, before the first circle (owner, 2026-10-02): not an empty "ללא מעגלים" tile but one compact, meaningful line —
// the small seal and the way to the first circle. Owner (2026-10-03): "האורות" over the count alone, an embossed number
// (1, 5, 10, 26), no "מתוך 26" — the arc around the seal already shows the share. Exactly centred
// (round 3): the two lines sit on the pill's axis — the seal on one side is balanced by an equal, empty place on the
// other — and the count and the thin arc around the seal are the circle's progress colour (royal blue).
export function OlamFirstLine({ active = 0, goal = 26, onOpen, sealRef, glowing = false }) {
  const share = Math.max(0, Math.min(1, active / Math.max(1, goal)));
  return <button type="button" className={`olam-home olam-first${glowing ? ' is-glowing' : ''}`} onClick={onOpen} aria-label={`מעגלי עולם. האורות: ${active} מתוך ${goal}.`} style={{ '--olam-first-p': `${Math.round(share * 1000) / 10}%` }}>
    <span className="olam-first-seal" ref={sealRef} aria-hidden="true"><CircleSeal count={0} size={22} alive /></span>
    <span className="olam-first-text" aria-hidden="true"><span className="olam-first-kicker">האורות</span><strong className="olam-first-count">{active}</strong></span>
    <span className="olam-first-balance" aria-hidden="true" />
  </button>;
}

// The compact card on the spiritual circle page: count, rank, the way to the next, and the seal — calm and centred.
// No "0" (at zero the label "מעגלים" alone) and no "עוד": "5 מעגלים למלכות".
export function OlamCard({ lifetime, onOpen, sealRef, glowing = false, completedThisWeek = 0 }) {
  const rank = rankFor(lifetime);
  return <button type="button" className={`olam-card${glowing ? ' is-glowing' : ''}`} onClick={onOpen} aria-label={`${olamSpoken(rank, 'אורות עגולים', { zeroless: true })}${completedThisWeek ? ` השבוע הושלמו ${circlesWord(completedThisWeek)}.` : ''} פתיחת מעגלי עולם`}>
    <span className="olam-card-title" aria-hidden="true">אורות עגולים</span>
    <span className="olam-card-seal" ref={sealRef} aria-hidden="true"><CircleSeal count={rank.count} size={76} alive vivid /></span>
    <span className="olam-card-count" aria-hidden="true">{circlesLabel(rank.count)}</span>
    {rank.name && (clayBuildEnabled() ? <span className="olam-card-rank is-ring" aria-hidden="true"><RankRing rank={rank} kicker="דרגת" /></span> : <span className="olam-card-rank" aria-hidden="true">{rank.name}</span>)}
    {rank.next && <span className="olam-card-next" aria-hidden="true">{remainingTo(rank)}</span>}
    {rank.next && <span className="olam-card-progress" aria-hidden="true"><i style={{ width: `${Math.round(rank.progress * 100)}%` }} /></span>}
    {completedThisWeek > 0 && <span className="olam-card-week" aria-hidden="true">השבוע הושלמו {circlesWord(completedThisWeek)}</span>}
    <span className="olam-card-more" aria-hidden="true">מעגלי עולם<ArrowMark size="inline" legacy=" ‹" /></span>
  </button>;
}

// CLAY · the circle page's entry (owner, 2026-10-02): on entering the page the lights fill from 0 to the week's count —
// short (CIRCLE_ENTRY_MS), eased out — the ring and the number together. Once per entry (a later change of the count
// shows at once); nothing at 0; off under reduced motion. Returns the lights to draw now (fractional), or null when
// nothing is playing (draw the real count).
export const CIRCLE_ENTRY_MS = 1000;
export const entryEase = t => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
export function entryFillAt(elapsed, target, ms = CIRCLE_ENTRY_MS) {
  if (!(target > 0) || elapsed >= ms) return null;
  return target * entryEase(elapsed / ms);
}
export function useCircleEntry(target, { enabled = true } = {}) {
  const targetRef = useRef(target);
  targetRef.current = target;
  const [shown, setShown] = useState(() => (enabled && target > 0 && !reduceMotionNow() ? 0 : null));
  const playing = shown !== null;
  useEffect(() => {
    if (!playing) return undefined;
    let frame = 0;
    let start = null;
    const step = now => {
      if (start === null) start = now;
      const value = entryFillAt(now - start, targetRef.current);
      setShown(value);
      if (value !== null) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);
  return shown;
}

// The completion of a circle, shown once: the gold ring completes, its light strengthens, it draws in a little, a small
// light travels to the seal, and only then the lifetime count and the seal advance. Driven by the stored "seen" count:
// the new count is marked seen BEFORE anything plays, so a reload mid-way shows the final state and never replays it,
// and nothing is ever counted here (the count itself is derived). Reduced motion: the final state at once.
const PHASES = [['fill', 900], ['hold', 380], ['contract', 480], ['travel', 720], ['settle', 700]];
// The completion now playing (memory only — a reload forgets it, which is the point). React's development double mount
// and a quick remount pick the same one up instead of losing it; it is finished once it ran its course (or ran a while).
let playing = null;
export function useCircleCompletion(lifetime, { ringRef, sealRef } = {}) {
  const [state, setState] = useState({ phase: null, from: null, travel: null });
  const [unlock, setUnlock] = useState(null);
  useEffect(() => {
    const record = readCircles();
    // The ceremony's first look: the rank already shown before this count (none, for a new user) — so the first rank a
    // new user reaches is celebrated, and an updating user's past ranks are not.
    if (clayBuildEnabled() && readCeremony() === null) claimCeremony(rankFor(record ? record.seen : lifetime).index);
    let current = playing && !playing.done && playing.to === lifetime ? playing : null;
    if (!current && record && lifetime > record.seen) {
      const rank = rankFor(lifetime);
      current = playing = { from: record.seen, to: lifetime, opened: rank.index > record.announced ? rank : null, started: Date.now(), done: false };
      markSeen(lifetime);
      haptic();
      announce(`הושלם מעגל. סך הכול ${circlesWord(lifetime)}.${current.opened ? ` נפתחה דרגת ${current.opened.name}.` : ''}`);
    }
    if (!current) {
      // Nothing new; a rank opened earlier and not yet acknowledged is still presented (quietly, no motion).
      if (record && rankFor(lifetime).index > record.announced) setUnlock(rankFor(lifetime));
      return undefined;
    }
    const finish = () => { current.done = true; setState({ phase: null, from: null, travel: null }); if (current.opened) setUnlock(current.opened); };
    if (reduceMotionNow()) { finish(); return undefined; }
    const { from } = current;
    let at = 0;
    const list = [];
    for (const [phase, ms] of PHASES) {
      list.push(setTimeout(() => {
        let travel = null;
        if (phase === 'travel') {
          const a = ringRef?.current?.getBoundingClientRect?.(); const b = sealRef?.current?.getBoundingClientRect?.();
          if (a && b && a.width && b.width) travel = { x: a.left + a.width / 2, y: a.top + a.height / 2, dx: (b.left + b.width / 2) - (a.left + a.width / 2), dy: (b.top + b.height / 2) - (a.top + a.height / 2) };
        }
        setState(previous => ({ phase, from, travel: travel || previous.travel }));
      }, at));
      at += ms;
    }
    list.push(setTimeout(finish, at));
    return () => { list.forEach(clearTimeout); if (Date.now() - current.started > 1200) current.done = true; setState({ phase: null, from: null, travel: null }); };
  }, [lifetime]);
  const { phase, from } = state;
  // The count and the seal wait for the light to arrive.
  const shownLifetime = phase && phase !== 'settle' && from !== null ? from : lifetime;
  const ringFull = phase === 'fill' || phase === 'hold' || phase === 'contract';
  const dismissUnlock = () => { if (unlock) markAnnounced(unlock.index); setUnlock(null); };
  return { phase, shownLifetime, ringFull, travel: phase === 'travel' ? state.travel : null, unlock, dismissUnlock };
}

// The small light on its way from the ring to the seal (decorative).
export function CompletionTravel({ travel }) {
  if (!travel) return null;
  return <span className="olam-travel" aria-hidden="true" style={{ left: `${travel.x}px`, top: `${travel.y}px`, '--olam-dx': `${travel.dx}px`, '--olam-dy': `${travel.dy}px` }} />;
}

// A rank opened: a restrained presentation in the flow of the page (not a modal) — the seal, "נפתחה דרגת נצח",
// "50 מעגלים הושלמו", and a way to close it. Shown until closed (kept across a reload by the "announced" record).
export function OlamUnlock({ unlock, onClose, vivid = false }) {
  const closeRef = useRef(null);
  if (!unlock) return null;
  return <section className="olam-unlock" aria-label={`נפתחה דרגת ${unlock.name}`}>
    <span className="olam-unlock-seal" aria-hidden="true"><CircleSeal count={unlock.count} size={72} vivid={vivid} /></span>
    <p className="olam-unlock-title">נפתחה דרגת {unlock.name}</p>
    <p className="olam-unlock-sub">{circlesWord(unlock.count)} הושלמו</p>
    <button type="button" ref={closeRef} className="olam-unlock-close" onClick={onClose}>סגירה</button>
  </section>;
}
