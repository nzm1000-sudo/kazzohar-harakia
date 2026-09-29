// השעון היהודי — how an alarm reads: short, human Hebrew; times like 05:35 always left-to-right digits; never a code,
// never undefined / NaN.
import { anchorOf } from './anchors.mjs';
import { isEventRule } from './model.mjs';
import { civilKeyOf, weekdayOf } from './engine.mjs';

export const WEEKDAY_LETTERS = Object.freeze(['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']);
export const WEEKDAY_NAMES = Object.freeze(['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']);
export const WEEKDAY_SHORT = Object.freeze(['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']);

export function timeText(instant, tz) {
  const date = instant ? new Date(instant) : null;
  if (!date || !Number.isFinite(date.getTime())) return '';
  try { return new Intl.DateTimeFormat('he-IL', { timeZone: tz || undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date); } catch { return ''; }
}

// "היום" / "מחר" / "יום חמישי" (within the week) / "ה׳ 12.3" further on.
export function dayText(dateKey, todayKey) {
  if (!dateKey) return '';
  if (dateKey === todayKey) return 'היום';
  const days = Math.round((Date.parse(`${dateKey}T12:00:00Z`) - Date.parse(`${todayKey}T12:00:00Z`)) / 86400000);
  if (days === 1) return 'מחר';
  if (days > 1 && days < 7) return WEEKDAY_NAMES[weekdayOf(dateKey)];
  const [, month, day] = dateKey.split('-').map(Number);
  return `${WEEKDAY_SHORT[weekdayOf(dateKey)]} ${day}.${month}`;
}

// 1 → "דקה", 2 → "2 דקות", 60 → "שעה", 120 → "שעתיים", 180 → "3 שעות", 25 → "25 דקות".
export function minutesText(value) {
  const minutes = Math.abs(Math.round(Number(value) || 0));
  if (minutes === 1) return 'דקה';
  if (minutes >= 60 && minutes % 60 === 0) { const hours = minutes / 60; return hours === 1 ? 'שעה' : hours === 2 ? 'שעתיים' : `${hours} שעות`; }
  return `${minutes} דקות`;
}
// 90 → "שעה ו־30 דקות"; 45 → "45 דקות"; 150 → "שעתיים ו־30 דקות".
export function durationBreakdown(value) {
  const minutes = Math.abs(Math.round(Number(value) || 0));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return minutesText(rest);
  const hourText = hours === 1 ? 'שעה' : hours === 2 ? 'שעתיים' : `${hours} שעות`;
  if (!rest) return hourText;
  return `${hourText} ו־${rest === 1 ? 'דקה' : `${rest} דקות`}`;
}

// "25 דקות לפני הנץ" · "בזמן הנץ" · "10 דקות אחרי צאת הכוכבים"
export function offsetPhrase(offsetMinutes, anchorId) {
  const anchor = anchorOf(anchorId);
  if (!anchor) return '';
  const offset = Math.round(Number(offsetMinutes) || 0);
  if (offset === 0) return `בזמן ${anchor.short}`;
  return `${minutesText(offset)} ${offset < 0 ? 'לפני' : 'אחרי'} ${anchor.short}`;
}
// The same, abbreviated for a narrow card: "25 דק׳ לפני הנץ".
export function offsetPhraseShort(offsetMinutes, anchorId) {
  const anchor = anchorOf(anchorId);
  if (!anchor) return '';
  const offset = Math.round(Number(offsetMinutes) || 0);
  if (offset === 0) return `בזמן ${anchor.short}`;
  const minutes = Math.abs(offset);
  const amount = minutes >= 60 && minutes % 60 === 0 ? minutesText(minutes) : minutes === 1 ? 'דקה' : `${minutes} דק׳`;
  return `${amount} ${offset < 0 ? 'לפני' : 'אחרי'} ${anchor.short}`;
}

export function recurrenceText(rule) {
  if (!rule) return '';
  if (isEventRule(rule)) return anchorOf(rule.jewishAnchorId)?.recurrence || '';
  if (rule.recurrence === 'daily') return 'כל יום';
  if (rule.recurrence === 'weekdays') return 'ימות השבוע (א׳–ה׳)';
  const days = rule.weekdays || [];
  return days.length ? days.map(day => WEEKDAY_SHORT[day]).join(' ') : '';
}

// The rule in one line: "25 דקות לפני הנץ" or "שעה קבועה".
export function ruleText(rule) {
  if (!rule) return '';
  if (rule.mode === 'fixed') return 'שעה קבועה';
  return offsetPhrase(rule.offsetMinutes, rule.jewishAnchorId);
}

// A default name for a rule the user did not name.
export function defaultTitle(rule) {
  if (!rule) return 'שעון';
  if (rule.mode === 'fixed') return 'שעון מעורר';
  const anchor = anchorOf(rule.jewishAnchorId);
  if (!anchor) return 'שעון';
  if (anchor.id === 'sunrise' && Number(rule.offsetMinutes) <= 0) return 'השכמה לנץ';
  if (anchor.id === 'candles-shabbat' && Number(rule.offsetMinutes) < 0) return 'הכנות לשבת';
  return anchor.label;
}
export const titleOf = rule => (rule?.title?.trim() || defaultTitle(rule));

// ── Spoken time (VoiceOver / TalkBack): "חמש שלושים וחמש" ──────────────────────────────────────────────────────
const UNITS = ['אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
const TEENS = ['עשר', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה'];
const TENS = ['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים'];
export function numberWords(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > 59) return String(value);
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  const unit = n % 10;
  return unit ? `${TENS[Math.floor(n / 10)]} ו${UNITS[unit]}` : TENS[n / 10];
}
export function spokenTime(text) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(text || ''));
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute === 0) return numberWords(hour);
  if (minute < 10) return `${numberWords(hour)} ו${UNITS[minute]} דקות`;
  return `${numberWords(hour)} ${numberWords(minute)}`;
}

// "השעון השכמה לנץ, פעיל, מחר בחמש שלושים וחמש, עשרים וחמש דקות לפני הנץ."
export function accessibilityLabel(rule, occurrence, { tz, todayKey } = {}) {
  const parts = [`השעון ${titleOf(rule)}`, rule.enabled ? 'פעיל' : 'כבוי'];
  if (rule.enabled && occurrence) {
    const time = timeText(occurrence.at, tz);
    parts.push(`${dayText(occurrence.date, todayKey)} ב${spokenTime(time)}`);
  }
  if (rule.mode === 'jewish') {
    const offset = Math.abs(Number(rule.offsetMinutes) || 0);
    const anchor = anchorOf(rule.jewishAnchorId);
    if (anchor) parts.push(offset === 0 ? `בזמן ${anchor.short}` : `${offset === 60 ? 'שעה' : `${numberWordsLong(offset)} דקות`} ${Number(rule.offsetMinutes) < 0 ? 'לפני' : 'אחרי'} ${anchor.short}`);
  } else parts.push('שעה קבועה');
  return `${parts.join(', ')}.`;
}
const numberWordsLong = n => (n < 60 ? numberWords(n) : String(n));

// The notification / alarm text: concise, no technical detail.
//   "השכמה לנץ" · "25 דקות לפני הנץ · הנץ היום 06:00"
//   "ספירת העומר" · "הגיע זמן ספירת העומר · הערב 12 לעומר"
export function alarmNotice(rule, occurrence, tz) {
  const title = titleOf(rule);
  if (rule.mode === 'fixed') return { title, body: `השעה ${timeText(occurrence.at, tz)}` };
  const anchor = anchorOf(rule.jewishAnchorId);
  if (anchor?.id === 'omer') return { title: 'ספירת העומר', body: occurrence.detail?.omerDay ? `הגיע זמן ספירת העומר · הלילה ${occurrence.detail.omerDay} לעומר` : 'הגיע זמן ספירת העומר' };
  const anchorTime = timeText(occurrence.anchorTime, tz);
  const offset = Number(rule.offsetMinutes) || 0;
  const when = offset < 0 ? `בעוד ${minutesText(offset)}` : offset > 0 ? `לפני ${minutesText(offset)}` : 'עכשיו';
  const name = anchor?.label || '';
  if (anchor?.kind === 'event') return { title, body: `${name} · ${when} · ${anchorTime}` };
  if (offset === 0) return { title, body: `${name} · ${anchorTime}` };
  const sameDay = civilKeyOf(new Date(occurrence.anchorTime).getTime(), tz) === civilKeyOf(new Date(occurrence.at).getTime(), tz);
  return { title, body: `${offsetPhrase(offset, anchor?.id)} · ${anchor?.short} ${sameDay ? 'היום' : 'מחר'} ${anchorTime}` };
}
