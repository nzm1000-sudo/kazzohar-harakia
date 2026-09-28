// "נר זיכרון" — the personal yahrzeits the user keeps for their loved ones. Pure date logic (no UI, no storage, no
// network): the original Hebrew date of death, the recurring yahrzeit, the next one, when the Today card shows, and
// the reminders to schedule. The recurrence is @hebcal/core's getYahrzeit (Reingold & Dershowitz, "Calendrical
// Calculations"; the rules are documented in docs/memorial/yahrzeit-rules.md) — no second calendar here. The only
// rule added on top is the Adar custom, where practice differs (Rema: Adar I; Mechaber: Adar II; some keep both).
import { HDate, months, HebrewCalendar } from '@hebcal/core';

export const SCHEMA_VERSION = 1;
const { ADAR_I, ADAR_II } = months;

export const isLeap = year => HDate.isLeapYear(Number(year));
export const daysInMonth = (month, year) => HDate.daysInMonth(Number(month), Number(year));

// A complete Hebrew date the calendar can hold (Adar II only in a leap year; day 30 only in a 30-day month).
export function validHebrewDate({ day, month, year } = {}) {
  const d = Number(day), m = Number(month), y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y) || y < 3000 || y > 6500) return false;
  if (m < 1 || m > 13 || (m === ADAR_II && !isLeap(y))) return false;
  return d >= 1 && d <= daysInMonth(m, y);
}

// A civil date of death → its Hebrew date. The Hebrew day turns at sunset: after sunset it is the next Hebrew day.
// With the time unknown, both dates are returned and nothing is decided.
export function hebrewFromCivilDeath({ day, month, year, sunsetRelation } = {}) {
  const civil = new Date(Number(year), Number(month) - 1, Number(day), 12);
  if (!Number.isFinite(civil.getTime()) || civil.getDate() !== Number(day)) return null;
  const before = new HDate(civil);
  const after = before.next();
  const parts = hd => ({ day: hd.getDate(), month: hd.getMonth(), year: hd.getFullYear() });
  if (sunsetRelation === 'before') return { date: parts(before), confidence: 'exact' };
  if (sunsetRelation === 'after') return { date: parts(after), confidence: 'exact' };
  return { date: null, confidence: 'uncertain', candidates: { before: parts(before), after: parts(after) } };
}

// Where the Adar custom matters: a death in the Adar of a common year, remembered in a leap year.
export const adarChoiceMatters = hebrew => Boolean(hebrew) && Number(hebrew.month) === ADAR_I && !isLeap(hebrew.year);
// The default custom by the user's nusach: Edot HaMizrach follow the Mechaber (Adar II); the others the Rema (Adar I).
export const defaultAdarRule = nusach => (nusach === 'edot' ? 'adar2' : 'adar1');

// The yahrzeit(s) of a record in one Hebrew year, as HDates (two when the Adar custom is to keep both).
export function yahrzeitsInYear(record, hyear) {
  const death = record?.hebrewDeathDate;
  if (!death || !validHebrewDate(death) || hyear <= Number(death.year)) return [];
  const civil = HebrewCalendar.getYahrzeit(hyear, new HDate(Number(death.day), Number(death.month), Number(death.year)));
  if (!civil) return [];
  const found = new HDate(civil);
  const base = { dd: found.getDate(), mm: found.getMonth(), yy: found.getFullYear() };
  const at = (d, m) => new HDate(Math.min(d, daysInMonth(m, hyear)), m, hyear);
  if (adarChoiceMatters(death) && isLeap(hyear)) {
    const rule = record.adarRule || 'adar1';
    const first = at(base.dd, ADAR_I), second = at(base.dd, ADAR_II);
    return rule === 'adar2' ? [second] : rule === 'both' ? [first, second] : [first];
  }
  return [new HDate(base.dd, base.mm, base.yy)];
}

// The yahrzeits from a given Hebrew day on (inclusive), in order — the next `count` of them.
export function upcomingYahrzeits(record, fromHDate, count = 2) {
  const fromAbs = fromHDate.abs();
  const out = [];
  for (let y = fromHDate.getFullYear() - 1; y <= fromHDate.getFullYear() + 3 && out.length < count; y++) {
    for (const hd of yahrzeitsInYear(record, y)) if (hd.abs() >= fromAbs && out.length < count) out.push(hd);
  }
  return out;
}

export const nextYahrzeit = (record, fromHDate) => upcomingYahrzeits(record, fromHDate, 1)[0] || null;

// Today card: from the sunset that begins the yahrzeit (the app's Jewish date already turns there) for one Jewish day,
// or three when the user chose three. The status says what the day is — the yahrzeit itself is always one day.
export function activeMemorials(records = [], todayHDate, { afterSunset = false } = {}) {
  if (!todayHDate) return [];
  const today = todayHDate.abs();
  const active = [];
  for (const record of records) {
    if (record.dateConfidence !== 'exact') continue;
    const span = record.homeDisplay?.duration === 3 ? 3 : 1;
    const recent = [todayHDate.getFullYear() - 1, todayHDate.getFullYear()].flatMap(y => yahrzeitsInYear(record, y));
    const hit = recent.find(hd => today - hd.abs() >= 0 && today - hd.abs() < span);
    if (!hit) continue;
    const ago = today - hit.abs();
    const status = ago === 0 ? (afterSunset ? 'הערב החלה האזכרה' : 'היום האזכרה') : ago === 1 ? 'האזכרה הייתה אתמול' : 'האזכרה הייתה לפני יומיים';
    active.push({ record, yahrzeit: hit, ago, status });
  }
  return active.sort((a, b) => a.ago - b.ago || a.record.displayName.localeCompare(b.record.displayName, 'he'));
}

// The list inside the tool: by the next yahrzeit (the soonest first); records whose date is not decided at the end.
export function sortByNext(records = [], todayHDate) {
  const next = new Map(records.map(record => [record.id, record.dateConfidence === 'exact' ? nextYahrzeit(record, todayHDate) : null]));
  return [...records].sort((a, b) => {
    const x = next.get(a.id), y = next.get(b.id);
    if (!x && !y) return a.displayName.localeCompare(b.displayName, 'he');
    if (!x) return 1; if (!y) return -1;
    return x.abs() - y.abs();
  }).map(record => ({ record, next: next.get(record.id), inDays: next.get(record.id) ? next.get(record.id).abs() - todayHDate.abs() : null }));
}

export const honorificFor = record => (record.gender === 'f' ? 'ע״ה' : 'ז״ל');
export const memorialName = record => `${record.displayName} ${honorificFor(record)}`;
export const hebrewDayLabel = hd => hd.renderGematriya(true).replace(/\s*ת?[א-ת]*״[א-ת]$/, '').replace(/^(\S+)\s/, '$1 ב');

// The reminders to schedule: for each record with a reminder, the next two yahrzeits (a year ahead is always
// covered), N days before the civil day of the yahrzeit, at the chosen local time. Bounded for iOS (64 pending):
// at most `limit` in all, the soonest first. The civil date of a Hebrew day is its daytime; the yahrzeit itself
// begins at the sunset of the day before.
const LEAD = { 1: 'מחר', 2: 'בעוד יומיים', 3: 'בעוד 3 ימים' };
export function reminderSchedule(records = [], todayHDate, { now = new Date(), limit = 48 } = {}) {
  const out = [];
  for (const record of records) {
    if (record.dateConfidence !== 'exact' || !record.reminder?.enabled) continue;
    const days = [1, 2, 3].includes(Number(record.reminder.daysBefore)) ? Number(record.reminder.daysBefore) : 1;
    const [hh, mm] = String(record.reminder.time || '09:00').split(':').map(Number);
    for (const hd of upcomingYahrzeits(record, todayHDate, 2)) {
      const civil = hd.greg();
      const at = new Date(civil.getFullYear(), civil.getMonth(), civil.getDate() - days, Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0);
      if (at <= now) continue;
      const key = `memorial:${record.id}:${hd.getFullYear()}-${hd.getMonth()}-${hd.getDate()}:${days}`;
      out.push({ key, recordId: record.id, at: at.toISOString(), category: 'memorial', title: 'נר זיכרון',
        body: `${LEAD[days]} אזכרת ${memorialName(record)} · ${hebrewDayLabel(hd)}${days === 1 ? ' — מתחילה הערב בשקיעה' : ''}` });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at)).slice(0, limit);
}

// ── Storage: versioned, parsed safely; a corrupt value never crashes the app ──────────────────────────────────
export const STORAGE_KEY = 'ner-zikaron-v1';
export const SCHEDULE_KEY = 'ner-zikaron-schedule-v1';
export function parseStore(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const list = Array.isArray(data) ? data : Array.isArray(data?.memorials) ? data.memorials : [];
    return list.filter(item => item && typeof item.id === 'string' && typeof item.displayName === 'string').map(migrate);
  } catch { return []; }
}
function migrate(record) {
  return {
    gender: 'm', relationship: '', originalInputType: 'hebrew', civilDeathDate: null, hebrewDeathDate: null, dateConfidence: 'exact',
    adarRule: null, reminder: { enabled: true, daysBefore: 1, time: '09:00' }, homeDisplay: { duration: 1 }, ...record,
    schemaVersion: SCHEMA_VERSION,
  };
}
export const serializeStore = memorials => JSON.stringify({ schemaVersion: SCHEMA_VERSION, memorials });
