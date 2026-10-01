// תזכורות — persistence. On this device only (localStorage): no server, no upload, no analytics. Names and dates never
// leave the device.
//
// RemindersState {
//   version: 1,
//   smart: { omer, shma, mincha, candles }        (services/reminders/smart.mjs normalizeSmart)
//   events: [HebrewDateEvent]
//   schedule: { key: { id, at, title, body } }     (what was handed to the OS, for reconciliation)
//   permission, platform, budget, horizonEnd, lastReconciledAt, contextSignature
// }
// HebrewDateEvent {
//   id, type: 'yahrzeit' | 'birthday' | 'anniversary', name, enabled,
//   memorialId: string | null                       (a yahrzeit linked to נר זיכרון: the date comes from the memorial)
//   inputType: 'hebrew' | 'civil', hebrew: { day, month, year }, civil: { day, month, year, afterSunset }
//   adarRule: 'adar1' | 'adar2' | 'both' | null      (yahrzeit, only where the Adar custom matters)
//   burialDelayDays: number, firstYear: 'death' | 'burial'   (yahrzeit; 'burial' only with a delay of 3+ days)
//   eve: { enabled, time: 'HH:MM' }, day: { enabled, time: 'HH:MM' }
//   createdAt, updatedAt
// }
import { normalizeSmart } from './smart.mjs';
import { isEventType, eventHebrewDate, hebrewFromCivil, validHebrewDate, FIRST_YEAR_BURIAL_MIN_DAYS } from './hebrewDates.mjs';

export const REMINDERS_KEY = 'kz-reminders-v1';
export const REMINDERS_CHANGE_EVENT = 'kz-reminders-change';
export const DEFAULT_EVE_TIME = '16:00'; // before the earliest sunset of the year in Israel (≈16:37 in Jerusalem)
export const DEFAULT_DAY_TIME = '08:00';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const time = (value, fallback) => (TIME.test(String(value || '')) ? value : fallback);
const empty = () => ({ version: 1, smart: normalizeSmart(null), events: [], schedule: {}, permission: null, platform: null, budget: null, horizonEnd: null, lastReconciledAt: null, contextSignature: null, error: null });

export function newEventId() {
  const random = globalThis.crypto?.randomUUID?.();
  return random ? `ev-${random}` : `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const intOr = (value, fallback) => (Number.isInteger(Number(value)) ? Number(value) : fallback);

/** Any stored value → a clean event, or null. */
export function normalizeEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!isEventType(value.type)) return null;
  const name = typeof value.name === 'string' ? value.name.trim().slice(0, 80) : '';
  const memorialId = value.type === 'yahrzeit' && typeof value.memorialId === 'string' && value.memorialId ? value.memorialId : null;
  const inputType = value.inputType === 'civil' ? 'civil' : 'hebrew';
  const hebrew = value.hebrew && typeof value.hebrew === 'object' ? { day: intOr(value.hebrew.day, 1), month: intOr(value.hebrew.month, 7), year: intOr(value.hebrew.year, 5780) } : { day: 1, month: 7, year: 5780 };
  const civil = value.civil && typeof value.civil === 'object' ? { day: intOr(value.civil.day, 1), month: intOr(value.civil.month, 1), year: intOr(value.civil.year, 2000), afterSunset: value.civil.afterSunset === true } : null;
  const entry = {
    id: typeof value.id === 'string' && value.id ? value.id : newEventId(),
    type: value.type, name, enabled: value.enabled !== false, memorialId, inputType, hebrew, civil,
    adarRule: value.type === 'yahrzeit' && ['adar1', 'adar2', 'both'].includes(value.adarRule) ? value.adarRule : null,
    burialDelayDays: value.type === 'yahrzeit' ? Math.max(0, Math.min(60, intOr(value.burialDelayDays, 0))) : 0,
    firstYear: value.type === 'yahrzeit' && value.firstYear === 'burial' && intOr(value.burialDelayDays, 0) >= FIRST_YEAR_BURIAL_MIN_DAYS ? 'burial' : 'death',
    eve: { enabled: value.eve?.enabled !== false, time: time(value.eve?.time, DEFAULT_EVE_TIME) },
    day: { enabled: value.day?.enabled === true, time: time(value.day?.time, DEFAULT_DAY_TIME) },
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
  // The Hebrew date of a civil input is kept beside it (what the list shows), recomputed from the civil date.
  if (inputType === 'civil') {
    const converted = civil ? hebrewFromCivil(civil) : null;
    if (!converted) return null;
    entry.hebrew = converted;
  }
  if (!memorialId && !validHebrewDate(entry.hebrew)) return null;
  if (!memorialId && !name) return null;
  return entry;
}

// Is a draft ready to save? → null, or the reason in plain Hebrew.
export function eventProblem(draft, memorial = null) {
  if (!draft || !isEventType(draft.type)) return 'לא ניתן לשמור את התזכורת.';
  if (!draft.memorialId && !String(draft.name || '').trim()) return draft.type === 'yahrzeit' ? 'יש לכתוב את שם הנפטר/ת.' : draft.type === 'anniversary' ? 'יש לכתוב את שמות בני הזוג.' : 'יש לכתוב שם.';
  if (!eventHebrewDate(draft, memorial)) return draft.inputType === 'civil' ? 'התאריך הלועזי אינו תקין.' : 'התאריך העברי אינו קיים בשנה זו.';
  if (!draft.eve?.enabled && !draft.day?.enabled) return 'בחרו מתי להזכיר: בערב שלפני, ביום עצמו או בשניהם.';
  return null;
}

export function parseRemindersState(text) {
  let raw;
  try { raw = JSON.parse(text || 'null'); } catch { raw = null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty();
  const events = (Array.isArray(raw.events) ? raw.events : []).map(normalizeEvent).filter(Boolean)
    .filter((entry, index, list) => list.findIndex(other => other.id === entry.id) === index);
  const schedule = {};
  for (const [key, item] of Object.entries(raw.schedule && typeof raw.schedule === 'object' ? raw.schedule : {})) {
    if (item && typeof item === 'object' && Number.isInteger(item.id) && typeof item.at === 'string') schedule[key] = { id: item.id, at: item.at, title: String(item.title || ''), body: String(item.body || '') };
  }
  const str = value => (typeof value === 'string' ? value : null);
  return { ...empty(), smart: normalizeSmart(raw.smart), events, schedule, permission: str(raw.permission), platform: str(raw.platform), budget: Number.isInteger(raw.budget) ? raw.budget : null, horizonEnd: str(raw.horizonEnd), lastReconciledAt: str(raw.lastReconciledAt), contextSignature: str(raw.contextSignature), error: str(raw.error) };
}

const defaultStorage = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export function loadReminders(storage = defaultStorage()) {
  try { return parseRemindersState(storage?.getItem(REMINDERS_KEY)); } catch { return empty(); }
}

export function saveReminders(state, storage = defaultStorage()) {
  const next = parseRemindersState(JSON.stringify(state));
  try { storage?.setItem(REMINDERS_KEY, JSON.stringify(next)); } catch { /* storage full or unavailable */ }
  try { globalThis.dispatchEvent?.(new CustomEvent(REMINDERS_CHANGE_EVENT)); } catch { /* not in a browser */ }
  return next;
}

export function updateReminders(change, storage = defaultStorage()) {
  const current = loadReminders(storage);
  return saveReminders(change(current) || current, storage);
}

export function setSmart(kind, patch, storage = defaultStorage()) {
  return updateReminders(state => ({ ...state, smart: normalizeSmart({ ...state.smart, [kind]: { ...state.smart[kind], ...patch } }) }), storage);
}

export function upsertEvent(entry, storage = defaultStorage()) {
  const clean = normalizeEvent({ ...entry, updatedAt: new Date().toISOString() });
  if (!clean) return loadReminders(storage);
  return updateReminders(state => {
    const index = state.events.findIndex(item => item.id === clean.id);
    return { ...state, events: index < 0 ? [...state.events, clean] : state.events.map(item => (item.id === clean.id ? { ...clean, createdAt: item.createdAt } : item)) };
  }, storage);
}

export function deleteEvent(id, storage = defaultStorage()) {
  return updateReminders(state => ({ ...state, events: state.events.filter(item => item.id !== id) }), storage);
}

// A memorial deleted in נר זיכרון takes its linked reminders with it.
export function deleteEventsOfMemorial(memorialId, storage = defaultStorage()) {
  return updateReminders(state => ({ ...state, events: state.events.filter(item => item.memorialId !== memorialId) }), storage);
}
