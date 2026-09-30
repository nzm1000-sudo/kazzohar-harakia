import { useEffect, useState } from 'react';
import { getEvents, getJewishDateKey, hasRecordedToday, JOURNAL_CHANGE_EVENT, recordStudyCompletion, studyUnitSourceId } from '../services/mitzvotJournal.mjs';
import { computeCircle, lightAck } from '../services/spiritualCircle.mjs';
import { VisuallyHidden } from './a11yPrimitives.jsx';

// The circle as it stands (derived from the journal), for the acknowledgement of a tap.
function circleNow(tzid) { try { return computeCircle(getEvents(), getJewishDateKey(new Date(), tzid)); } catch { return null; } }
// A quiet line under the button ("כל סיום מוסיף אור…") until the reader has seen what a completion does a few times.
const HINT_KEY = 'kz-light-hint-v1';
const HINT_UNTIL = 3;
const hintCount = () => { try { return Number(globalThis.localStorage?.getItem(HINT_KEY)) || 0; } catch { return HINT_UNTIL; } };
const countHint = () => { try { globalThis.localStorage?.setItem(HINT_KEY, String(hintCount() + 1)); } catch { /* a hint only */ } };

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

// After the tap: the confirmation, and — only right after it — a restrained acknowledgement of the light it added
// ("אור למעגל · 48 מתוך 72", or "המעגל הושלם"): a soft fade and glow (none under reduced motion), spoken once with the
// confirmation (the same status line). Nothing jumps, nothing sounds; a second tap records nothing and shows nothing new.
export default function CompletionButton({ source, sourceId, tzid = 'Asia/Jerusalem', record, label = 'סיימתי', ariaLabel }) {
  const [done, setDone] = useRecordedToday({ source, sourceId, tzid });
  const [ack, setAck] = useState(null);
  const [hint] = useState(() => hintCount() < HINT_UNTIL);
  if (!sourceId || typeof record !== 'function') return null;
  const complete = () => {
    if (done) return;
    const before = circleNow(tzid);
    try { record(); } finally { setDone(true); }
    const added = lightAck(before, circleNow(tzid));
    if (added) { setAck(added); countHint(); }
  };
  return <div className="prayer-completion-footer">
    {done
      ? <p className={`prayer-complete-done${ack ? ' is-fresh' : ''}`} role="status"><span aria-hidden="true">✓</span> נרשם ב״המעגל הרוחני״{ack && <VisuallyHidden>. {ack.spoken}</VisuallyHidden>}</p>
      : <button type="button" className="prayer-complete-btn" onClick={complete} aria-label={ariaLabel || label}>{label}</button>}
    {done && ack && <p className="light-ack" aria-hidden="true">{ack.completed ? ack.text : <><span dir="ltr">+{ack.gained}</span> {ack.text}</>}</p>}
    {!done && hint && <p className="completion-hint">כל סיום מוסיף אור למעגל הרוחני</p>}
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
