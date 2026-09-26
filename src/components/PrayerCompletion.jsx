import { useState } from 'react';
import { getJewishDateKey, hasRecordedToday, recordSiddurCompletion, SIDDUR_COMPLETION } from '../services/mitzvotJournal.mjs';

// "סיימתי את התפילה" for any Siddur service: explicit completion only (opening is not praying),
// one entry per service per day, and a clear confirmation so the user knows it was recorded.
export default function PrayerCompletion({ flowKey, tzid = 'Asia/Jerusalem' }) {
  const [done, setDone] = useState(() => {
    try { return hasRecordedToday({ jewishDate: getJewishDateKey(new Date(), tzid), source: 'siddur', sourceId: flowKey }); } catch { return false; }
  });
  if (!SIDDUR_COMPLETION[flowKey]) return null;
  const complete = () => { recordSiddurCompletion(flowKey, { occurredAt: new Date(), tzid }); setDone(true); };
  return <div className="prayer-completion-footer">
    {done
      ? <p className="prayer-complete-done" role="status"><span aria-hidden="true">✓</span> נרשם ב״המצוות שלי״</p>
      : <button type="button" className="prayer-complete-btn" onClick={complete} aria-label="סימון התפילה כהושלמה">סיימתי את התפילה</button>}
  </div>;
}
