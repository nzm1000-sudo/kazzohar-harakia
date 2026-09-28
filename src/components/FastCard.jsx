import { timeLabel } from '../services.mjs';
import { FAST_KIND_LABELS } from '../services/fastTimes.mjs';

// A fast on Today: the day before ("מחר · צום גדליה") and on the day itself, with its start and end for the user's
// location. The main end time is the app's nightfall; "רבנו תם" sits beneath it, smaller, as a later alternative —
// never as the required end of a minor fast. Yom Kippur and Tisha B'Av keep their own rules (fastTimes.mjs).
export default function FastCard({ fast, tz, when = 'today', onOpen }) {
  if (!fast) return null;
  const kicker = when === 'tomorrow' ? 'מחר' : 'היום';
  const kind = fast.kind === 'minor' ? null : FAST_KIND_LABELS[fast.kind];
  const noTimes = !fast.begins || !fast.ends;
  return <button type="button" className={`today-feature today-fast is-${when}`} onClick={onOpen} aria-label={`${kicker} ${fast.hebrew}${fast.begins ? `, תחילת הצום ${timeLabel(fast.begins, tz)}` : ''}${fast.ends ? `, סיום הצום ${timeLabel(fast.ends, tz)}` : ''}`}>
    <span>{kicker}{kind ? ` · ${kind}` : fast.postponed ? ' · נדחה' : ''}</span>
    <strong>{when === 'tomorrow' ? `צום ${fast.hebrew}`.replace('צום צום', 'צום') : fast.hebrew}</strong>
    {noTimes ? <small className="today-fast-note">נדרש מיקום לחישוב הזמן</small> : <span className="today-fast-times">
      <span className="today-fast-time"><small>תחילת הצום</small><b>{timeLabel(fast.begins, tz)}</b>{fast.kind === 'tisha-bav' || fast.kind === 'yom-kippur' ? <small>{when === 'tomorrow' ? 'הערב' : 'אמש'}</small> : null}</span>
      <span className="today-fast-time"><small>סיום הצום</small><b>{timeLabel(fast.ends, tz)}</b>{fast.endsRabbenuTam && <small className="rabbenu-tam-line">רבנו תם · {timeLabel(fast.endsRabbenuTam, tz)}</small>}</span>
    </span>}
    {fast.endsIntoShabbat && <small className="today-fast-note">הצום נמשך עד צאת הכוכבים, גם אחרי הדלקת נרות.</small>}
    {fast.note && <small className="today-fast-note">{fast.note}</small>}
  </button>;
}
