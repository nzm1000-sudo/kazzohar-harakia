// תזכורות — what to schedule now. Pure: the saved reminders + the app's context + `now` → the nearest notifications,
// within the platform's budget (services/notificationBudget.mjs), each with the screen it opens.
//
// Shabbat and Yom Tov: nothing is ever scheduled inside a span from candle lighting to havdalah (the Jewish alarm's
// restWindowAt, from @hebcal/core with the app's location and candle minutes).
//   • a daily reminder (קריאת שמע, מנחה, הדלקת נרות) that would fall there is skipped;
//   • the Omer on the night Shabbat / Yom Tov ends waits for its end; on a night that is itself holy it is skipped;
//   • a Hebrew-date reminder (אזכרה, יום הולדת, יום נישואין) is moved EARLIER, to an hour before the candle lighting
//     that begins that Shabbat / Yom Tov (a yahrzeit candle must be lit before it), and says so in its text.
// Rolling: the nearest entries first; one reminder of each Hebrew-date event is reserved (up to a third of the budget)
// so a yearly date is never crowded out by the daily ones; every launch and return to the app refills the horizon.
import { HDate } from '@hebcal/core';
import { shiftCivilDate } from '../../civilDate.mjs';
import { civilKeyOf, restWindowAt, weekdayOf, zonedInstant, MINUTE } from '../jewishAlarm/engine.mjs';
import { WEEKDAY_NAMES } from '../jewishAlarm/format.mjs';
import { SMART_ORDER, smartOn } from './smart.mjs';
import { MAZKIR_KINDS, MAZKIR_ORDER } from './mazkir.mjs';
import { EVENT_TYPES, upcomingOccurrences, hebrewDayLabel, yearsOrdinal } from './hebrewDates.mjs';
import { memorialName } from '../memorialYahrzeit.mjs';

export const SMART_HORIZON_DAYS = 10;
export const EVENT_OCCURRENCES = 2;
export const REST_LEAD_MINUTES = 60;

const deviceZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };
const civilKeyOfHDate = hd => { const d = hd.greg(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysBetween = (fromKey, toKey) => Math.round((Date.parse(`${toKey}T12:00:00Z`) - Date.parse(`${fromKey}T12:00:00Z`)) / 86400000);

// "היום" / "מחר" / "מחרתיים" / "ביום שישי".
export function leadWord(reminderKey, eventKey) {
  const days = daysBetween(reminderKey, eventKey);
  if (days <= 0) return 'היום';
  if (days === 1) return 'מחר';
  if (days === 2) return 'מחרתיים';
  return `ב${WEEKDAY_NAMES[weekdayOf(eventKey)]}`;
}

// The kind of a rest span in words: שבת, החג, or שבת והחג.
function restName(window, tz) {
  const startKey = civilKeyOf(window.start.getTime(), tz);
  const endKey = civilKeyOf(window.end.getTime(), tz);
  const keys = [];
  for (let key = startKey; key <= endKey && keys.length < 5; key = shiftCivilDate(key, 1)) keys.push(key);
  const hasShabbat = keys.slice(1).some(key => weekdayOf(key) === 6) || weekdayOf(endKey) === 6;
  const plainShabbat = weekdayOf(startKey) === 5 && endKey === shiftCivilDate(startKey, 1);
  if (plainShabbat) return 'שבת';
  return hasShabbat ? 'שבת והחג' : 'החג';
}

// Without a location (never the case with the app's settings, but kept safe): no Friday afternoon, no Saturday.
function civilRestFallback(at, tz) {
  const key = civilKeyOf(at.getTime(), tz);
  const weekday = weekdayOf(key);
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(at));
  if (weekday === 6) return zonedInstant(shiftCivilDate(key, -1), '11:00', tz);
  if (weekday === 5 && hour >= 12) return zonedInstant(key, '11:00', tz);
  return null;
}

/** An instant that may fall on Shabbat / Yom Tov → { at, movedBefore } (movedBefore: 'שבת' | 'החג' | 'שבת והחג' | null). */
export function beforeRest(at, ctx) {
  if (ctx?.valid) {
    const window = restWindowAt(at, ctx);
    if (!window) return { at, movedBefore: null };
    return { at: new Date(window.start.getTime() - REST_LEAD_MINUTES * MINUTE), movedBefore: restName(window, ctx.tz) };
  }
  const moved = civilRestFallback(at, deviceZone());
  return moved ? { at: moved, movedBefore: 'שבת' } : { at, movedBefore: null };
}

export const eventName = entry => String(entry?.displayName || entry?.name || '').trim();

// The notification of a Hebrew-date event. Kept short: who, what, which Hebrew day, and when.
export function eventNotice(entry, occurrence, slot, { reminderKey, eventKey, movedBefore = null } = {}) {
  const type = EVENT_TYPES[entry.type] || EVENT_TYPES.birthday;
  const name = eventName(entry);
  const day = hebrewDayLabel(occurrence.hd);
  const lead = leadWord(reminderKey, eventKey);
  const moved = movedBefore ? ` · הוקדם לפני ${movedBefore}` : '';
  if (entry.type === 'yahrzeit') {
    const begins = slot === 'eve' && !movedBefore && lead === 'מחר' ? ' · מתחילה הערב בשקיעה' : '';
    return { title: 'אזכרה', body: `${lead} האזכרה של ${name} · ${day}${begins}${moved}` };
  }
  const ordinal = yearsOrdinal(occurrence.years);
  const noun = entry.type === 'anniversary' ? 'יום הנישואין' : 'יום ההולדת';
  return { title: type.title, body: `${lead} ${noun}${ordinal ? ` ${ordinal}` : ''} של ${name} · ${day}${moved}` };
}

// Where a tap on an event's notification leads: the memorial in נר זיכרון, else the reminder itself.
export const eventRoute = entry => (entry.type === 'yahrzeit' && entry.memorialId ? `personal-tools/memorial/${encodeURIComponent(entry.memorialId)}` : `jewish-alarm/reminders/e/${encodeURIComponent(entry.id)}`);

/** The reminders of one Hebrew-date event from `now` on: [{ key, at, title, body, route, entryId, slot, hd, moved }]. */
export function eventReminders(original, ctx, { now = new Date(), count = EVENT_OCCURRENCES, memorial = null } = {}) {
  if (!original || original.enabled === false) return [];
  // A yahrzeit linked to נר זיכרון is named as there ("… בן … ז״ל").
  const entry = memorial ? { ...original, displayName: memorialName(memorial) } : original;
  const tz = ctx?.valid ? ctx.tz : deviceZone();
  const from = new Date(now).getTime();
  // From the Hebrew day of yesterday: an event tomorrow may still have its evening reminder today.
  const todayHd = new HDate(new Date(from));
  const occurrences = upcomingOccurrences(entry, todayHd.prev(), count + 1, memorial);
  const out = [];
  for (const occurrence of occurrences) {
    const eventKey = civilKeyOfHDate(occurrence.hd);
    for (const slot of ['eve', 'day']) {
      const setting = entry[slot];
      if (!setting?.enabled) continue;
      const civilKey = slot === 'eve' ? shiftCivilDate(eventKey, -1) : eventKey;
      const wanted = zonedInstant(civilKey, setting.time, tz);
      if (!wanted) continue;
      const { at, movedBefore } = beforeRest(wanted, ctx);
      if (!at || at.getTime() <= from) continue;
      const reminderKey = civilKeyOf(at.getTime(), tz);
      const notice = eventNotice(entry, occurrence, slot, { reminderKey, eventKey, movedBefore });
      out.push({ key: `rem:ev:${entry.id}:${occurrence.hd.getFullYear()}-${occurrence.hd.getMonth()}-${occurrence.hd.getDate()}:${slot}`, at, ...notice, route: eventRoute(entry), entryId: entry.id, slot, hd: occurrence.hd, eventKey, moved: movedBefore });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, count * 2);
}

/** The daily (smart) reminders over the coming days: [{ key, at, title, body, route, kind, ... }]. */
export function smartReminders(smart, ctx, { now = new Date(), days = SMART_HORIZON_DAYS } = {}) {
  if (!ctx?.valid || !smart) return [];
  const from = new Date(now).getTime();
  const first = civilKeyOf(from, ctx.tz);
  const out = [];
  for (const kind of [...SMART_ORDER, ...MAZKIR_ORDER]) {
    if (!smart[kind]?.enabled) continue;
    for (let shift = 0; shift <= days; shift += 1) {
      const item = smartOn(kind, smart[kind], shiftCivilDate(first, shift), ctx);
      if (item && item.at.getTime() > from) out.push(item);
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Everything to schedule now, nearest first, at most `budget`: [{ key, at (ISO), title, body, route, category }].
 * `memorials`: the נר זיכרון records (a linked yahrzeit takes its date and Adar custom from its memorial).
 */
export function planReminders({ smart, events = [] } = {}, ctx, { now = new Date(), budget = 18, memorials = [] } = {}) {
  if (!budget || budget < 1) return [];
  const byMemorial = new Map((memorials || []).map(record => [record.id, record]));
  const eventLists = (events || []).filter(Boolean).map(entry => eventReminders(entry, ctx, { now, memorial: entry.memorialId ? byMemorial.get(entry.memorialId) || null : null }));
  const daily = smartReminders(smart, ctx, { now });
  // A rare kind (Chanukah, Birkat HaLevana, Birkat HaIlanot) is reserved like a yearly date: its nearest reminder is
  // never crowded out by the daily ones.
  const rareFirsts = MAZKIR_ORDER.filter(kind => MAZKIR_KINDS[kind].rare).map(kind => daily.find(item => item.kind === kind)).filter(Boolean);
  const reserved = [...eventLists.map(list => list[0]).filter(Boolean), ...rareFirsts].sort((a, b) => a.at - b.at).slice(0, Math.floor(budget / 3));
  const reservedKeys = new Set(reserved.map(item => item.key));
  const rest = [...eventLists.flat(), ...daily].filter(item => !reservedKeys.has(item.key)).sort((a, b) => a.at - b.at);
  const seen = new Set();
  const chosen = [...reserved, ...rest].filter(item => (seen.has(item.key) ? false : (seen.add(item.key), true))).slice(0, budget);
  return chosen.sort((a, b) => a.at - b.at).map(item => ({ key: item.key, at: item.at.toISOString(), title: item.title, body: item.body, route: item.route, category: 'reminder' }));
}
