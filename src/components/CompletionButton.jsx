import { useEffect, useState } from 'react';
import { completionState, getEvents, getJewishDateKey, JOURNAL_CHANGE_EVENT, recordStudyCompletion, studyUnitSourceId } from '../services/mitzvotJournal.mjs';
import { computeCircle, lightAck, WEEK_GOAL } from '../services/spiritualCircle.mjs';
import { VisuallyHidden } from './a11yPrimitives.jsx';

// The circle as it stands (derived from the journal), for the acknowledgement of a tap and the count under the frame.
function circleNow(tzid) { try { return computeCircle(getEvents(), getJewishDateKey(new Date(), tzid)); } catch { return null; } }

// The line "הוספת אור למעגל הרוחני" in the lettering of the About heading (styles: .about-title-letter): each letter
// drifts among the theme's tones on its own clock — here about half as fast again, so it glows without calling for
// attention. Fixed seeds: the same on every visit, never jumping on re-render. Static under reduced motion (CSS).
export const LIGHT_ADDED = 'הוספת אור למעגל הרוחני';
export const LIGHT_INVITE = 'להוסיף אור למעגל הרוחני?';
// Once recorded, the frame says it — "ישר כח!" — in a soft golden light (the item's own words stay for screen readers).
export const YASHER_KOACH = 'ישר כח!';
function seededLetter(seed) {
  let t = (seed * 2654435761) >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
export function slowShimmerLetters(text = LIGHT_ADDED) {
  return [...text].map((char, index) => {
    if (char === ' ') return { char, key: index };
    const random = seededLetter(index + 7);
    const duration = 72 + random() * 28; // 72–100 s: a slow, quiet drift (the About heading turns in 14–22 s)
    return { char, key: index, cycle: 1 + Math.floor(random() * 3), duration: `${duration.toFixed(2)}s`, delay: `-${(random() * duration).toFixed(2)}s` };
  });
}
const ADDED_LETTERS = slowShimmerLetters();
// "18/26" — the open circle's lights, Arabic numerals, no spaces (0/26 right after a circle completes).
export const circleFraction = active => `${Math.max(0, Number(active) || 0)}/${WEEK_GOAL}`;

// The one "סיימתי" of the app — prayers, blessings, Tehillim, study, שלום רב. One look everywhere: a quiet footer with
// the gold button, and once recorded a clear confirmation in its place. Explicit completion only (opening is not
// praying). When it may be recorded again is the journal's policy (mitzvotJournal.repeatPolicy): a blessing, a Tehillim
// chapter or a unit of study returns to "סיימתי" one hour after its last recording; a prayer, the Omer and Shnayim
// Mikra stay done for their day. The state is re-checked when the hour ends (a timer), when the app returns to the
// screen, and on every change of the journal — so an open screen flips back by itself, and a second tap within the
// hour never records twice.
// `record()` writes the entry (services/mitzvotJournal.mjs); `source` / `sourceId` identify it for "already recorded".
export function useRecordedToday({ source, sourceId, tzid = 'Asia/Jerusalem' }) {
  const state = () => { try { return sourceId ? completionState({ source, sourceId, now: new Date(), tzid }) : { done: false, until: null }; } catch { return { done: false, until: null }; } };
  const [done, setDone] = useState(() => state().done);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const now = state();
    setDone(now.done);
    // An undo in the journal (or a record from another reader) shows here at once; the app's return re-checks too.
    const refresh = () => setTick(value => value + 1);
    const onVisible = () => { try { if (!document.hidden) refresh(); } catch { /* no DOM */ } };
    // The hour of an 'hourly' item ends: flip back to "סיימתי" (capped so a far timer never overflows).
    const timer = now.until ? setTimeout(refresh, Math.min(Math.max(0, now.until - Date.now()) + 250, 0x7fffffff)) : null;
    try {
      window.addEventListener(JOURNAL_CHANGE_EVENT, refresh);
      window.addEventListener('focus', refresh);
      document.addEventListener('visibilitychange', onVisible);
    } catch { return () => { if (timer) clearTimeout(timer); }; }
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(JOURNAL_CHANGE_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [source, sourceId, tzid, tick, done]);
  return [done, setDone];
}

// One look in every reader (never on Today): an open golden rectangle with modest rounded corners — the About frame's
// gold, a double frame, a soft light travelling very slowly (about a minute a turn) round its outline — with the words
// in the theme's ink. Under it, centred: the invitation before the tap; after it,
// "הוספת אור למעגל הרוחני" in the About lettering (slower) and, directly below, the open circle as "18/26". Once
// recorded, the frame becomes the status line; right after the tap it speaks once: "הוספת אור למעגל הרוחני. 18 מתוך 26".
// Nothing jumps, nothing sounds; a second tap records nothing. Reduced motion: a still outline and still letters.
export default function CompletionButton({ source, sourceId, tzid = 'Asia/Jerusalem', record, label = 'סיימתי', ariaLabel }) {
  const [done, setDone] = useRecordedToday({ source, sourceId, tzid });
  const [ack, setAck] = useState(null);
  // Back to "סיימתי" (the hour of a blessing / chapter / unit has passed): the last acknowledgement is spent.
  useEffect(() => { if (!done) setAck(null); }, [done]);
  if (!sourceId || typeof record !== 'function') return null;
  const complete = () => {
    if (done) return;
    const before = circleNow(tzid);
    try { record(); } finally { setDone(true); }
    const added = lightAck(before, circleNow(tzid));
    if (added) setAck(added);
  };
  const active = done ? (ack ? ack.active : circleNow(tzid)?.active) : null;
  const fraction = done && Number.isFinite(active) ? circleFraction(active) : null;
  return <div className="prayer-completion-footer is-rect">
    {done
      ? <p className={`prayer-complete-done completion-rect is-yasher${ack ? ' is-fresh' : ''}`} role="status"><span className="completion-rect-label">{YASHER_KOACH}</span><VisuallyHidden>{label}. נרשם ב״המעגל הרוחני״{ack && `. ${LIGHT_ADDED}. ${ack.active} מתוך ${WEEK_GOAL}`}</VisuallyHidden></p>
      : <button type="button" className="prayer-complete-btn completion-rect" onClick={complete} aria-label={ariaLabel || label}><span className="completion-rect-label">{label}</span></button>}
    {done
      ? <p className="completion-caption is-added" aria-hidden="true">
          <span className="completion-added">{ADDED_LETTERS.map(letter => letter.cycle
            ? <span key={letter.key} className={`about-title-letter tone-${letter.cycle}`} style={{ animationDuration: letter.duration, animationDelay: letter.delay }}>{letter.char}</span>
            : <span key={letter.key}> </span>)}</span>
          {fraction && <span className="completion-fraction" dir="ltr">{fraction}</span>}
        </p>
      : <p className="completion-caption">{LIGHT_INVITE}</p>}
  </div>;
}

// "סיימתי את הלימוד" for any reader of Torah (ספרים, תלמוד, הלכה, מקורות): the unit read is recorded (again after an hour), and
// the study timer is flushed first so the minutes of this reading are in the journal too.
export function StudyCompletion({ workId, workTitle, unitId = null, unitLabel = null, source, tzid = 'Asia/Jerusalem', onBeforeRecord }) {
  if (!workId) return null;
  const sourceId = studyUnitSourceId(workId, unitId);
  return <CompletionButton
    key={sourceId}
    source={source}
    sourceId={sourceId}
    tzid={tzid}
    label="סיימתי את הלימוד"
    ariaLabel={`סימון הלימוד${unitLabel ? ` (${unitLabel})` : ''} כהושלם`}
    record={() => { try { onBeforeRecord?.(); } catch { /* the timer is best effort */ } recordStudyCompletion({ workId, workTitle, unitId, unitLabel, source, occurredAt: new Date(), tzid }); }}
  />;
}
