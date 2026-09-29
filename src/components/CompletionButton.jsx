import { useEffect, useState } from 'react';
import { getJewishDateKey, hasRecordedToday, JOURNAL_CHANGE_EVENT, recordStudyCompletion, studyUnitSourceId } from '../services/mitzvotJournal.mjs';

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

export default function CompletionButton({ source, sourceId, tzid = 'Asia/Jerusalem', record, label = 'סיימתי', ariaLabel }) {
  const [done, setDone] = useRecordedToday({ source, sourceId, tzid });
  if (!sourceId || typeof record !== 'function') return null;
  const complete = () => { if (done) return; try { record(); } finally { setDone(true); } };
  return <div className="prayer-completion-footer">
    {done
      ? <p className="prayer-complete-done" role="status"><span aria-hidden="true">✓</span> נרשם ב״המעגל הרוחני״</p>
      : <button type="button" className="prayer-complete-btn" onClick={complete} aria-label={ariaLabel || label}>{label}</button>}
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
