// השעון היהודי — the engine. Pure and deterministic: a rule + a civil date + the app's context → the anchor time and
// the alarm time. It never schedules anything and never reads the clock or storage.
//
// ONE SOURCE OF TRUTH. There is no second zmanim calculator here:
//   • daily zmanim   → computeZmanim(dateKey, location)  (services/zmanimLocal.mjs — what TodayPage and זמנים show)
//   • candle lighting / havdalah → @hebcal/core's calendar with the app's own parameters (the candle minutes from the
//     settings, havdalah at 8.5°: exactly what services.mjs asks the Hebcal API for; tests pin both to computeZmanim)
//   • fasts          → fastOn() (services/fastTimes.mjs — the FastCard on TodayPage)
//   • the Omer       → @hebcal/core's Omer count; Chanukah → @hebcal/core's calendar + the app's verified lighting rule
// Times are absolute instants (tz-aware); an offset is plain arithmetic on the instant, so an alarm that crosses
// midnight simply lands on the other day.
import { HebrewCalendar, HDate, Location, flags, months } from '@hebcal/core';
import { computeZmanim } from '../zmanimLocal.mjs';
import { fastOn } from '../fastTimes.mjs';
import { shiftCivilDate } from '../../civilDate.mjs';
import { ANCHORS, CHANUKAH_RULE, anchorOf } from './anchors.mjs';

export const MINUTE = 60000;
export const MAX_OFFSET_MINUTES = 720; // twelve hours either way: any reasonable offset, never a nonsense one
export const ERRORS = Object.freeze({
  'no-location': 'בחרו עיר או מיקום כדי לחשב את הזמן.',
  unavailable: 'הזמן הזה אינו זמין ביום שנבחר.',
  'bad-rule': 'לא ניתן לחשב את השעון הזה.',
});

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isDateKey = value => DATE_KEY.test(String(value || ''));
export const isTimeText = value => TIME.test(String(value || ''));

// ── Context ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The context is the app's normalized settings (services.mjs normalizeSettings): location, candle minutes, residence.
export function alarmContext(settings = {}) {
  const location = settings?.location;
  const valid = location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)) && typeof location.tzid === 'string' && location.tzid;
  const il = settings.halachicResidenceStatus ? settings.halachicResidenceStatus === 'israel' : Boolean(settings.il);
  const candles = Number.isFinite(Number(settings.candles)) ? Number(settings.candles) : 20;
  if (!valid) return { valid: false, location: null, tz: null, il, candles, settings };
  const loc = { name: location.name || '', latitude: Number(location.latitude), longitude: Number(location.longitude), tzid: location.tzid, il: Boolean(location.il) };
  return { valid: true, location: loc, tz: loc.tzid, il, candles, settings: { ...settings, location: loc } };
}

// What, in the context, changes an alarm's time: the place, the zone, the residence and the candle minutes.
export const contextSignature = ctx => (ctx?.valid ? [ctx.location.latitude, ctx.location.longitude, ctx.tz, ctx.il ? 'il' : 'dia', ctx.candles].join('|') : 'none');

// ── Time-zone arithmetic (DST-safe) ──────────────────────────────────────────────────────────────────────────────
function wallParts(instant, tz) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(instant));
  const value = type => Number(parts.find(part => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour') % 24, minute: value('minute') };
}
function offsetMinutesAt(instant, tz) {
  const p = wallParts(instant, tz);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(instant / MINUTE) * MINUTE) / MINUTE;
}
// The instant a wall-clock time happens on a civil date in a zone. A time that does not exist (the hour skipped when
// clocks go forward) rings at the same moment one hour later on the wall; a time that happens twice (clocks go back)
// rings the first time.
export function zonedInstant(dateKey, timeText, tz) {
  if (!isDateKey(dateKey) || !isTimeText(timeText) || !tz) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  try {
    const candidates = new Set();
    for (const probe of [target - 14 * 3600000, target, target + 14 * 3600000]) candidates.add(target - offsetMinutesAt(probe, tz) * MINUTE);
    const exact = [...candidates].filter(instant => { const p = wallParts(instant, tz); return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute; }).sort((a, b) => a - b);
    if (exact.length) return new Date(exact[0]);
    // In the gap: use the offset that was in force before the change.
    return new Date(target - offsetMinutesAt(target - 14 * 3600000, tz) * MINUTE);
  } catch { return null; }
}

// The wall-clock time now (HH:MM, to the minute) in the app's zone — where a new fixed alarm starts. Without a zone,
// the device's own clock.
export function wallTimeText(instant = Date.now(), tz = null) {
  const at = new Date(instant).getTime();
  if (!Number.isFinite(at)) return '06:30';
  let hour; let minute;
  try {
    if (!tz) throw new Error('no zone');
    ({ hour, minute } = wallParts(at, tz));
  } catch { const local = new Date(at); hour = local.getHours(); minute = local.getMinutes(); }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function civilKeyOf(instant, tz) {
  const p = wallParts(instant, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
export const weekdayOf = dateKey => new Date(`${dateKey}T12:00:00Z`).getUTCDay();

// ── The calendar (candle lighting, havdalah, Yom Tov), cached by month ───────────────────────────────────────────
const calendarCache = new Map();
const hdateOfKey = key => { const [y, m, d] = key.split('-').map(Number); return new HDate(new Date(y, m - 1, d)); };
const keyOfHDate = hd => { const d = hd.greg(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function monthEvents(ctx, monthKey) {
  const cacheKey = `${contextSignature(ctx)}|${monthKey}`;
  if (calendarCache.has(cacheKey)) return calendarCache.get(cacheKey);
  const [year, month] = monthKey.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const location = new Location(ctx.location.latitude, ctx.location.longitude, ctx.il, ctx.tz, ctx.location.name || 'location');
  const byDate = new Map();
  let events = [];
  try {
    events = HebrewCalendar.calendar({ start, end, location, il: ctx.il, candlelighting: true, candleLightingMins: ctx.candles, havdalahDeg: 8.5, noMinorFast: true, noModern: true, noRoshChodesh: true, noSpecialShabbat: true, sedrot: false });
  } catch { events = []; }
  for (const item of events) {
    const key = keyOfHDate(item.getDate());
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(item);
  }
  if (calendarCache.size > 48) calendarCache.delete(calendarCache.keys().next().value);
  calendarCache.set(cacheKey, byDate);
  return byDate;
}
function eventsOn(ctx, dateKey) { return monthEvents(ctx, dateKey.slice(0, 7)).get(dateKey) || []; }
const categoriesOf = item => item?.getCategories?.() || [];
const timedEvent = (ctx, dateKey, category) => { const hit = eventsOn(ctx, dateKey).find(item => categoriesOf(item).includes(category) && item.eventTime); return hit ? new Date(hit.eventTime) : null; };
const isYomTovDate = (ctx, dateKey) => eventsOn(ctx, dateKey).some(item => Number(item.getFlags?.() || 0) & flags.CHAG);

export function candleLightingOn(ctx, dateKey) { return ctx?.valid && isDateKey(dateKey) ? timedEvent(ctx, dateKey, 'candles') : null; }
export function havdalahOn(ctx, dateKey) { return ctx?.valid && isDateKey(dateKey) ? timedEvent(ctx, dateKey, 'havdalah') : null; }

// Shabbat and Yom Tov as spans: from a candle lighting to the first havdalah after it (Yom Tov into Shabbat is one
// span). A moment exactly at candle lighting or exactly at havdalah is outside the span.
export function restWindowAt(instant, ctx) {
  if (!ctx?.valid) return null;
  const at = new Date(instant).getTime();
  const key = civilKeyOf(at, ctx.tz);
  const marks = [];
  for (let shift = -4; shift <= 2; shift += 1) {
    const day = shiftCivilDate(key, shift);
    const candles = candleLightingOn(ctx, day);
    const havdalah = havdalahOn(ctx, day);
    if (candles) marks.push({ kind: 'candles', at: candles.getTime() });
    if (havdalah) marks.push({ kind: 'havdalah', at: havdalah.getTime() });
  }
  marks.sort((a, b) => a.at - b.at);
  for (let index = 0; index < marks.length; index += 1) {
    if (marks[index].kind !== 'candles') continue;
    // A span starts at the first candle lighting after a havdalah (a second-day Yom Tov lighting is inside the span).
    if (marks[index - 1]?.kind === 'candles') continue;
    const end = marks.slice(index + 1).find(mark => mark.kind === 'havdalah');
    if (!end) continue;
    if (at > marks[index].at && at < end.at) return { start: new Date(marks[index].at), end: new Date(end.at) };
  }
  return null;
}

// ── Anchors ──────────────────────────────────────────────────────────────────────────────────────────────────────
const zmanimCache = new Map();
function zmanimOn(ctx, dateKey) {
  const cacheKey = `${contextSignature(ctx)}|${dateKey}`;
  if (zmanimCache.has(cacheKey)) return zmanimCache.get(cacheKey);
  const value = computeZmanim(dateKey, ctx.location);
  if (zmanimCache.size > 800) zmanimCache.delete(zmanimCache.keys().next().value);
  zmanimCache.set(cacheKey, value);
  return value;
}
const fastCache = new Map();
function fastOnCached(ctx, dateKey) {
  const cacheKey = `${contextSignature(ctx)}|${dateKey}`;
  if (fastCache.has(cacheKey)) return fastCache.get(cacheKey);
  const settings = { location: ctx.location, halachicResidenceStatus: ctx.il ? 'israel' : 'diaspora', candles: ctx.candles };
  // Hebrew-calendar check first: fastOn is only asked on the days a fast can fall on.
  const value = mayBeFastDay(dateKey) ? fastOn(dateKey, settings) : null;
  if (fastCache.size > 800) fastCache.delete(fastCache.keys().next().value);
  fastCache.set(cacheKey, value);
  return value;
}
function mayBeFastDay(dateKey) {
  const hd = hdateOfKey(dateKey);
  const m = hd.getMonth();
  const d = hd.getDate();
  return (m === months.TISHREI && d >= 3 && d <= 10) || (m === months.TEVET && d === 10) || ((m === months.ADAR_I || m === months.ADAR_II) && d >= 11 && d <= 13)
    || (m === months.TAMUZ && d >= 17 && d <= 18) || (m === months.AV && d >= 9 && d <= 10) || (m === months.NISAN && d >= 12 && d <= 14);
}
// The Omer night that begins on the evening of a civil date (1–49), from @hebcal/core's Omer count.
export function omerNightOn(dateKey) {
  if (!isDateKey(dateKey)) return null;
  const tomorrow = hdateOfKey(shiftCivilDate(dateKey, 1));
  const m = tomorrow.getMonth();
  if (m !== months.NISAN && m !== months.IYYAR && m !== months.SIVAN) return null;
  try {
    const found = HebrewCalendar.calendar({ start: tomorrow, end: tomorrow, omer: true, noHolidays: true, sedrot: false, candlelighting: false });
    const omer = found.find(item => categoriesOf(item).includes('omer'));
    const day = Number(omer?.omer);
    return Number.isInteger(day) && day >= 1 && day <= 49 ? day : null;
  } catch { return null; }
}
// The Chanukah night (1–8) that begins on the evening of a civil date, from @hebcal/core's Chanukah candles.
export function chanukahNightOn(dateKey) {
  if (!isDateKey(dateKey)) return null;
  const hd = hdateOfKey(dateKey);
  const first = new HDate(24, months.KISLEV, hd.getFullYear());
  const night = hd.abs() - first.abs() + 1;
  if (night < 1 || night > 8) return null;
  try {
    const found = HebrewCalendar.calendar({ start: hd, end: hd, noHolidays: false, sedrot: false });
    return found.some(item => /Chanukah: \d Candle/.test(item.getDesc?.() || '')) ? night : null;
  } catch { return null; }
}

// One anchor on one civil date → { at: Date, detail } or null (the anchor does not exist that day).
export function anchorOn(anchorId, dateKey, ctx) {
  const anchor = anchorOf(anchorId);
  if (!anchor || !ctx?.valid || !isDateKey(dateKey)) return null;
  const at = value => { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date : null; };
  if (anchor.kind === 'daily') {
    const time = at(zmanimOn(ctx, dateKey)?.[anchor.zman]);
    return time ? { at: time, detail: null } : null;
  }
  const weekday = weekdayOf(dateKey);
  switch (anchorId) {
    case 'candles-shabbat': { if (weekday !== 5) return null; const time = candleLightingOn(ctx, dateKey); return time ? { at: time, detail: null } : null; }
    case 'candles-yomtov': { const time = candleLightingOn(ctx, dateKey); return time && isYomTovDate(ctx, shiftCivilDate(dateKey, 1)) ? { at: time, detail: null } : null; }
    case 'havdalah-shabbat': { if (weekday !== 6) return null; const time = havdalahOn(ctx, dateKey); return time ? { at: time, detail: null } : null; }
    case 'havdalah-yomtov': { const time = havdalahOn(ctx, dateKey); return time && isYomTovDate(ctx, dateKey) ? { at: time, detail: null } : null; }
    case 'rt-shabbat': { if (weekday !== 6 || !havdalahOn(ctx, dateKey)) return null; const time = at(zmanimOn(ctx, dateKey)?.tzeit72min); return time ? { at: time, detail: null } : null; }
    case 'fast-start': {
      // A fast that starts on this date: a daytime fast begins at dawn of its own day; Tisha B'Av and Yom Kippur the
      // evening before. Never the firstborn's fast (not a communal fast).
      const own = fastOnCached(ctx, dateKey);
      if (own && own.kind === 'minor' && own.begins) return { at: own.begins, detail: { fast: own.hebrew } };
      const tomorrow = fastOnCached(ctx, shiftCivilDate(dateKey, 1));
      if (tomorrow && (tomorrow.kind === 'tisha-bav' || tomorrow.kind === 'yom-kippur') && tomorrow.begins) return { at: tomorrow.begins, detail: { fast: tomorrow.hebrew } };
      return null;
    }
    case 'fast-end': {
      const own = fastOnCached(ctx, dateKey);
      return own && own.kind !== 'bechorot' && own.ends ? { at: own.ends, detail: { fast: own.hebrew } } : null;
    }
    case 'omer': {
      const night = omerNightOn(dateKey);
      if (!night) return null;
      const time = at(zmanimOn(ctx, dateKey)?.tzeit85deg);
      return time ? { at: time, detail: { omerDay: night } } : null;
    }
    case 'chanukah': {
      // The app's verified rule (sunset + its minutes) on a weekday evening. Friday (lit before Shabbat's candles) and
      // Motzaei Shabbat (after Shabbat ends) have no single verified time in the app, so the anchor is not offered then.
      if (!CHANUKAH_RULE || weekday === 5 || weekday === 6) return null;
      const night = chanukahNightOn(dateKey);
      if (!night) return null;
      const base = at(zmanimOn(ctx, dateKey)?.[CHANUKAH_RULE.zman]);
      return base ? { at: new Date(base.getTime() + CHANUKAH_RULE.minutes * MINUTE), detail: { chanukahNight: night } } : null;
    }
    default: return null;
  }
}

// ── The public engine ────────────────────────────────────────────────────────────────────────────────────────────
export const clampOffset = minutes => { const value = Math.round(Number(minutes) || 0); return Math.max(-MAX_OFFSET_MINUTES, Math.min(MAX_OFFSET_MINUTES, value)); };

/**
 * resolveJewishAlarm(rule, dateKey, context) → the alarm of one rule on one civil date (the date of its anchor, or of
 * its wall-clock time for a fixed alarm): { date, anchorTime, alarmTime, anchorLabel, location, timezone, explanation,
 * detail } — or { date, error, message } in plain Hebrew. `context` is alarmContext(settings) (or the settings).
 */
export function resolveJewishAlarm(rule, dateKey, context) {
  const ctx = context?.valid === undefined ? alarmContext(context) : context;
  if (!ctx.valid) return { date: dateKey, error: 'no-location', message: ERRORS['no-location'] };
  if (!rule || !isDateKey(dateKey)) return { date: dateKey, error: 'bad-rule', message: ERRORS['bad-rule'] };
  const base = { date: dateKey, location: ctx.location.name, timezone: ctx.tz };
  if (rule.mode === 'fixed') {
    const alarmTime = zonedInstant(dateKey, rule.fixedTime, ctx.tz);
    if (!alarmTime) return { ...base, error: 'bad-rule', message: ERRORS['bad-rule'] };
    return { ...base, anchorTime: null, alarmTime, anchorLabel: null, explanation: 'שעה קבועה', detail: null };
  }
  const anchor = anchorOf(rule.jewishAnchorId);
  if (!anchor) return { ...base, error: 'bad-rule', message: ERRORS['bad-rule'] };
  const found = anchorOn(anchor.id, dateKey, ctx);
  if (!found) return { ...base, error: 'unavailable', message: ERRORS.unavailable, anchorLabel: anchor.label };
  const offset = clampOffset(rule.offsetMinutes);
  const alarmTime = new Date(found.at.getTime() + offset * MINUTE);
  return { ...base, anchorTime: found.at, alarmTime, anchorLabel: anchor.label, explanation: anchor.method || '', detail: found.detail, offsetMinutes: offset };
}

export { ANCHORS };
