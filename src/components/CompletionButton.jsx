import { useEffect, useState } from 'react';
import { getEvents, getJewishDateKey, hasRecordedToday, JOURNAL_CHANGE_EVENT, recordStudyCompletion, studyUnitSourceId } from '../services/mitzvotJournal.mjs';
import { computeCircle, lightAck, WEEK_GOAL } from '../services/spiritualCircle.mjs';
import { VisuallyHidden } from './a11yPrimitives.jsx';

// The circle as it stands (derived from the journal), for the acknowledgement of a tap and the count under the ellipse.
function circleNow(tzid) { try { return computeCircle(getEvents(), getJewishDateKey(new Date(), tzid)); } catch { return null; } }

// The line "הוספת אור למעגל הרוחני" in the lettering of the About heading (styles: .about-title-letter): each letter
// drifts among the theme's tones on its own clock — here about half as fast again, so it glows without calling for
// attention. Fixed seeds: the same on every visit, never jumping on re-render. Static under reduced motion (CSS).
export const LIGHT_ADDED = 'הוספת אור למעגל הרוחני';
export const LIGHT_INVITE = 'להוסיף אור למעגל הרוחני?';
function seededLetter(seed) {
  let t = (seed * 2654435761) >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
export function slowShimmerLetters(text = LIGHT_ADDED) {
  return [...text].map((char, index) => {
    if (char === ' ') return { char, key: index };
    const random = seededLetter(index + 7);
    const duration = 26 + random() * 12; // 26–38 s: slower than the About heading (14–22 s)
    return { char, key: index, cycle: 1 + Math.floor(random() * 3), duration: `${duration.toFixed(2)}s`, delay: `-${(random() * duration).toFixed(2)}s` };
  });
}
const ADDED_LETTERS = slowShimmerLetters();
// "48/72" — the open circle's lights, Arabic numerals, no spaces (0/72 right after a circle completes).
export const circleFraction = active => `${Math.max(0, Number(active) || 0)}/${WEEK_GOAL}`;

// The one "סיימתי" of the app — prayers, blessings, Tehillim, study, שלום רב. One look everywhere: a quiet footer with
// the gold button, and once recorded a clear confirmation in its place. Explicit completion only (opening is not
// praying), one entry per item per Jewish day (the journal's eventKey), so a second tap never records twice.
// `record()` writes the entry (services/mitzvotJournal.mjs); `source` / `sourceId` identify it for "already recorded".
export function useRecordedToday({ source, sourceId, tzid = 'Asia/Jerusalem' }) {
  const probe = () => { try { return Boolean(sourceId) && hasRecordedToday({ jewishDate: getJewishDateKey(new Date(), tzid), source, sourceId }); } catch { return false; } };
  const [done, setDone] = useState(probe);
  useEffect(() => {
    setDone(probe());
    // An undo in the journal (or a record from another reader) shows here at once.
    const refresh = () => setDone(probe());
    try { window.addEventListener(JOURNAL_CHANGE_EVENT, refresh); } catch { return undefined; }
    return () => window.removeEventListener(JOURNAL_CHANGE_EVENT, refresh);
  }, [source, sourceId, tzid]);
  return [done, setDone];
}

// One look in every reader (never on Today): an open golden ellipse — the About frame's gold, a soft light travelling
// round its outline — with the words in the theme's ink. Under it, centred: the invitation before the tap; after it,
// "הוספת אור למעגל הרוחני" in the About lettering (slower) and, directly below, the open circle as "48/72". Once
// recorded, the ellipse becomes the status line; right after the tap it speaks once: "הוספת אור למעגל הרוחני. 48 מתוך 72".
// Nothing jumps, nothing sounds; a second tap records nothing. Reduced motion: a still outline and still letters.
export default function CompletionButton({ source, sourceId, tzid = 'Asia/Jerusalem', record, label = 'סיימתי', ariaLabel }) {
  const [done, setDone] = useRecordedToday({ source, sourceId, tzid });
  const [ack, setAck] = useState(null);
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
  return <div className="prayer-completion-footer is-ellipse">
    {done
      ? <p className={`prayer-complete-done completion-ellipse${ack ? ' is-fresh' : ''}`} role="status"><span className="completion-ellipse-label">{label}</span><VisuallyHidden>. נרשם ב״המעגל הרוחני״{ack && `. ${LIGHT_ADDED}. ${ack.active} מתוך ${WEEK_GOAL}`}</VisuallyHidden></p>
      : <button type="button" className="prayer-complete-btn completion-ellipse" onClick={complete} aria-label={ariaLabel || label}><span className="completion-ellipse-label">{label}</span></button>}
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

// "סיימתי את הלימוד" for any reader of Torah (ספרים, תלמוד, הלכה, מקורות): the unit read is recorded once a day, and
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
