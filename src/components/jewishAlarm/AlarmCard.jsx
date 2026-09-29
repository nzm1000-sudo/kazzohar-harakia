// השעון היהודי — one alarm in the list. RTL, three balanced columns: the name and its rule on the right, the next
// actual time in the centre, the switch on the left. The whole card opens the editor; the switch stands apart.
import { AlarmSwitch } from './AlarmParts.jsx';
import { accessibilityLabel, dayText, offsetPhraseShort, recurrenceText, timeText, titleOf } from '../../services/jewishAlarm/index.mjs';

export default function AlarmCard({ rule, occurrence, tz, todayKey, onOpen, onToggle }) {
  const time = rule.enabled && occurrence ? timeText(occurrence.at, tz) : '';
  const rest = rule.mode === 'fixed' ? `שעה קבועה · ${recurrenceText(rule)}` : `${offsetPhraseShort(rule.offsetMinutes, rule.jewishAnchorId)}`;
  const when = !rule.enabled ? 'כבוי' : occurrence ? dayText(occurrence.date, todayKey) : 'אין מועד קרוב';
  return <article className={`ja-card${rule.enabled ? '' : ' is-off'}`}>
    <button type="button" className="ja-card-hit" aria-label={`${accessibilityLabel(rule, occurrence, { tz, todayKey })} לעריכה`} onClick={onOpen} />
    <span className="ja-card-text" aria-hidden="true"><strong>{titleOf(rule)}</strong><small>{rest}</small></span>
    <span className="ja-card-time" aria-hidden="true">{time ? <time dir="ltr">{time}</time> : <time className="is-empty">––:––</time>}<small>{when}</small></span>
    <span className="ja-card-switch"><AlarmSwitch checked={rule.enabled} onChange={onToggle} label={`${titleOf(rule)} — ${rule.enabled ? 'פעיל' : 'כבוי'}`} /></span>
  </article>;
}
