// השעון היהודי on the Today screen: one compact entry, under קביעות יומית. With an alarm on, the next one — "השעון הבא
// 05:35 · 25 דק׳ לפני הנץ · הנץ 06:00"; with none, the name and a short line inviting to set one. Either way it opens the
// alarm screen.
import { useEffect, useMemo, useState } from 'react';
import { JewishAlarmIcon } from '../ToolIcons.jsx';
import { ALARM_CHANGE_EVENT, alarmContext, getNextAlarm, loadAlarmState, offsetPhraseShort, timeText, ANCHORS, dayText, civilKeyOf } from '../../services/jewishAlarm/index.mjs';

export default function TodayAlarmCard({ settings, now, onOpen }) {
  const [rules, setRules] = useState(() => loadAlarmState().rules);
  useEffect(() => { const update = () => setRules(loadAlarmState().rules); window.addEventListener(ALARM_CHANGE_EVENT, update); return () => window.removeEventListener(ALARM_CHANGE_EVENT, update); }, []);
  const ctx = useMemo(() => alarmContext(settings), [settings]);
  const minute = Math.floor(new Date(now).getTime() / 60000);
  const next = useMemo(() => (rules.some(rule => rule.enabled) && ctx.valid ? getNextAlarm(rules, ctx, new Date(now)) : null), [rules, ctx, minute]);
  if (!next) return <button type="button" className="ja-today is-empty" onClick={onOpen} aria-label="השעון היהודי: שעון מעורר לפי זמני היום. לקביעת שעון">
    <span className="ja-today-icon" aria-hidden="true"><JewishAlarmIcon size={22} /></span>
    <span className="ja-today-text" aria-hidden="true"><strong>השעון היהודי</strong><small><span>שעון מעורר לפי זמני היום</span><span className="ja-today-dot"> · </span><span>לקביעת שעון</span></small></span>
    <span className="ja-today-arrow" aria-hidden="true">←</span>
  </button>;
  const { rule, occurrence } = next;
  const time = timeText(occurrence.at, ctx.tz);
  const anchor = rule.mode === 'jewish' ? ANCHORS[rule.jewishAnchorId] : null;
  const todayKey = civilKeyOf(new Date(now).getTime(), ctx.tz);
  const detail = [anchor ? offsetPhraseShort(rule.offsetMinutes, rule.jewishAnchorId) : 'שעה קבועה', anchor ? `${anchor.short} ${timeText(occurrence.anchorTime, ctx.tz)}` : dayText(occurrence.date, todayKey)].join(' · ');
  return <button type="button" className="ja-today" onClick={onOpen} aria-label={`השעון הבא ${dayText(occurrence.date, todayKey)} ב־${time}, ${detail}`}>
    <span className="ja-today-icon" aria-hidden="true"><JewishAlarmIcon size={22} /></span>
    <span className="ja-today-text" aria-hidden="true"><strong>השעון הבא <time dir="ltr">{time}</time></strong><small>{detail}</small></span>
    <span className="ja-today-arrow" aria-hidden="true">←</span>
  </button>;
}
