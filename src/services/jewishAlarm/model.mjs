// השעון היהודי — the rule. One record per alarm; stored on the device only.
//
// JewishAlarmRule {
//   id, enabled, title,
//   mode: 'fixed' | 'jewish',
//   fixedTime: 'HH:MM'                     (fixed)
//   jewishAnchorId, offsetMinutes          (jewish; signed: −25 = 25 minutes before, 0 = at, +10 = 10 after)
//   recurrence: 'daily' | 'weekdays' | 'custom'   ('weekdays' = Sunday–Thursday); event anchors recur by themselves
//   weekdays: [0..6]                       (custom; 0 = Sunday)
//   seasonalRule: 'omer' | 'chanukah' | 'shabbat' | 'yomtov' | 'fast' | null   (derived from the anchor, informational)
//   ringOnRest: false                      (Shabbat / Yom Tov: silent unless the user explicitly chose otherwise)
//   locationMode: 'app'                    (always the app's own location selection)
//   locationSnapshot, timezone, calculationMethod   (what the last calculation used — shown, never a second source)
//   sound: 'default' | 'gentle' | 'bold', vibration: boolean, snoozeMinutes: 5 | 10 | 15,
//   createdAt, updatedAt, nextOccurrence, platformScheduleState
// }
import { isAnchor, anchorOf } from './anchors.mjs';
import { clampOffset, isTimeText } from './engine.mjs';

export const RECURRENCES = Object.freeze(['daily', 'weekdays', 'custom']);
export const SOUNDS = Object.freeze(['default', 'gentle', 'bold']);
export const SNOOZES = Object.freeze([5, 10, 15]);
export const WORK_WEEK = Object.freeze([0, 1, 2, 3, 4]);
export const ALL_DAYS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);
export const QUICK_OFFSETS = Object.freeze([5, 10, 15, 20, 25, 30, 45, 60]);

const SEASONAL = { omer: 'omer', chanukah: 'chanukah', 'candles-shabbat': 'shabbat', 'havdalah-shabbat': 'shabbat', 'rt-shabbat': 'shabbat', 'candles-yomtov': 'yomtov', 'havdalah-yomtov': 'yomtov', 'fast-start': 'fast', 'fast-end': 'fast' };
export const seasonalRuleOf = anchorId => SEASONAL[anchorId] || null;
export const isEventRule = rule => rule?.mode === 'jewish' && anchorOf(rule.jewishAnchorId)?.kind === 'event';

export function newRuleId() {
  const random = globalThis.crypto?.randomUUID?.();
  return random || `ja-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function blankRule(overrides = {}) {
  return normalizeRule({ id: newRuleId(), enabled: true, title: '', mode: null, fixedTime: '06:30', jewishAnchorId: null, offsetMinutes: null, recurrence: 'daily', weekdays: [...ALL_DAYS], ringOnRest: false, sound: 'default', vibration: true, snoozeMinutes: 10, ...overrides }, { allowIncomplete: true });
}

// Any stored value → a valid rule, or null. `allowIncomplete` keeps an editor draft (no mode / no offset chosen yet).
export function normalizeRule(value, { allowIncomplete = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const mode = value.mode === 'fixed' || value.mode === 'jewish' ? value.mode : null;
  if (!mode && !allowIncomplete) return null;
  const anchorId = isAnchor(value.jewishAnchorId) ? value.jewishAnchorId : null;
  if (mode === 'jewish' && !anchorId && !allowIncomplete) return null;
  const hasOffset = value.offsetMinutes !== null && value.offsetMinutes !== undefined && Number.isFinite(Number(value.offsetMinutes));
  if (mode === 'jewish' && !hasOffset && !allowIncomplete) return null;
  const fixedTime = isTimeText(value.fixedTime) ? value.fixedTime : '06:30';
  const weekdays = [...new Set((Array.isArray(value.weekdays) ? value.weekdays : []).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
  const recurrence = RECURRENCES.includes(value.recurrence) ? value.recurrence : 'daily';
  const now = new Date().toISOString();
  return {
    id: typeof value.id === 'string' && value.id ? value.id : newRuleId(),
    enabled: value.enabled !== false,
    title: typeof value.title === 'string' ? value.title.slice(0, 60) : '',
    mode,
    fixedTime,
    jewishAnchorId: anchorId,
    offsetMinutes: hasOffset ? clampOffset(value.offsetMinutes) : null,
    recurrence,
    weekdays: recurrence === 'custom' ? (weekdays.length ? weekdays : [...WORK_WEEK]) : recurrence === 'weekdays' ? [...WORK_WEEK] : [...ALL_DAYS],
    seasonalRule: seasonalRuleOf(anchorId),
    ringOnRest: value.ringOnRest === true,
    locationMode: 'app',
    locationSnapshot: value.locationSnapshot && typeof value.locationSnapshot === 'object' ? { name: String(value.locationSnapshot.name || ''), latitude: Number(value.locationSnapshot.latitude), longitude: Number(value.locationSnapshot.longitude) } : null,
    timezone: typeof value.timezone === 'string' ? value.timezone : null,
    calculationMethod: typeof value.calculationMethod === 'string' ? value.calculationMethod : null,
    sound: SOUNDS.includes(value.sound) ? value.sound : 'default',
    vibration: value.vibration !== false,
    snoozeMinutes: SNOOZES.includes(Number(value.snoozeMinutes)) ? Number(value.snoozeMinutes) : 10,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
    nextOccurrence: typeof value.nextOccurrence === 'string' ? value.nextOccurrence : null,
    platformScheduleState: typeof value.platformScheduleState === 'string' ? value.platformScheduleState : null,
  };
}

// Is a draft ready to save? → null, or the reason in plain Hebrew.
export function draftProblem(rule) {
  if (!rule?.mode) return 'בחרו את סוג השעון.';
  if (rule.mode === 'fixed' && !isTimeText(rule.fixedTime)) return 'בחרו שעה.';
  if (rule.mode === 'jewish' && !rule.jewishAnchorId) return 'בחרו זמן יהודי.';
  if (rule.mode === 'jewish' && (rule.offsetMinutes === null || rule.offsetMinutes === undefined)) return 'בחרו כמה זמן לפני, בזמן או אחרי.';
  if (!isEventRule(rule) && rule.recurrence === 'custom' && !rule.weekdays?.length) return 'בחרו לפחות יום אחד.';
  return null;
}

// Two rules that would ring at the very same times (same kind, time or anchor and offset, same days).
export const ruleIdentity = rule => (rule.mode === 'fixed'
  ? `fixed|${rule.fixedTime}|${isEventRule(rule) ? '' : rule.weekdays.join('')}|${rule.ringOnRest}`
  : `jewish|${rule.jewishAnchorId}|${rule.offsetMinutes}|${isEventRule(rule) ? '' : rule.weekdays.join('')}|${rule.ringOnRest}`);
export const findDuplicate = (rules, rule) => (rules || []).find(other => other.id !== rule.id && ruleIdentity(other) === ruleIdentity(rule)) || null;

// Does the rule ring on this weekday? (Event anchors: every day the calendar has them.)
export function ringsOnWeekday(rule, weekday) {
  if (isEventRule(rule)) return true;
  return (rule.weekdays || ALL_DAYS).includes(weekday);
}
