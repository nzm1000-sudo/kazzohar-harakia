import { useEffect, useRef, useState } from 'react';
import CircleSeal from './CircleSeal.jsx';
import { announce } from './a11yPrimitives.jsx';
import { haptic } from './jewishAlarm/AlarmParts.jsx';
import { getPreferences, readSystem, resolvePreferences } from '../services/accessibility/preferences.mjs';
import { circlesLabel, circlesWord, markAnnounced, markSeen, olamSpoken, rankFor, readCircles, remainingTo } from '../services/spiritualCircle.mjs';

// "אורות עגולים" / "מעגלי עולם" — the circles completed over a lifetime, beside the open circle of the week. Everything
// shown here comes from ONE derived count (services/spiritualCircle.mjs: journal → circles, kept by a high-water record).

export const reduceMotionNow = () => { try { return resolvePreferences(getPreferences(), readSystem(globalThis)).reduceMotion; } catch { return false; } };

// Home, under "המעגל הרוחני": the seal on the page's centre axis, the count to its right, the rank to its left, and what
// remains below — one quiet button to "מעגלי עולם".
export function OlamHomeLine({ lifetime, onOpen, sealRef, glowing = false }) {
  const rank = rankFor(lifetime);
  return <button type="button" className={`olam-home${glowing ? ' is-glowing' : ''}`} onClick={onOpen} aria-label={olamSpoken(rank, 'מעגלי עולם', { zeroless: true })}>
    <span className="olam-home-row" aria-hidden="true">
      <span className="olam-home-count">{rank.count > 0 ? circlesLabel(rank.count) : 'ללא מעגלים'}</span>
      <span className="olam-home-seal" ref={sealRef}><CircleSeal count={rank.count} size={44} alive /></span>
      <span className={`olam-home-rank${rank.name ? '' : ' is-remaining'}`}>{rank.name || remainingTo(rank)}</span>
    </span>
    {rank.name && rank.next && <span className="olam-home-next" aria-hidden="true">{remainingTo(rank)}</span>}
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
    {rank.name && <span className="olam-card-rank" aria-hidden="true">{rank.name}</span>}
    {rank.next && <span className="olam-card-next" aria-hidden="true">{remainingTo(rank)}</span>}
    {rank.next && <span className="olam-card-progress" aria-hidden="true"><i style={{ width: `${Math.round(rank.progress * 100)}%` }} /></span>}
    {completedThisWeek > 0 && <span className="olam-card-week" aria-hidden="true">השבוע הושלמו {circlesWord(completedThisWeek)}</span>}
    <span className="olam-card-more" aria-hidden="true">מעגלי עולם ‹</span>
  </button>;
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
