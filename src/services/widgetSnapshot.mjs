// The home-screen widget, the lock-screen accessories and Siri answer from ONE compact snapshot the app computes here and
// hands to the native side (services/nativeWidgets.mjs → iOS App Group / shared keychain, Android SharedPreferences).
// Pure and offline: the same on-device engines the app shows (zmanim from services/zmanimLocal.mjs, the Jewish date that
// turns at sunset, @hebcal/core's candle lighting / havdalah / parasha — the library behind the Hebcal API the app
// reads — the verified yahrzeit list of "נר ה' נשמת אדם", and the spiritual ring of services/spiritualCircle.mjs).
//
// Several days ahead, so the widget stays right without the app being opened: every zman instant (the widget builds
// its timeline from them, so "the next zman" advances on time), every Jewish day with its start and end (sunset), and
// the coming Shabbatot. Instants are epoch milliseconds; every text is ready Hebrew, so the native side never
// formats a Jewish date or a name.
import { HDate, HebrewCalendar, Location, flags } from '@hebcal/core';
import { civilDateKey, shiftCivilDate } from '../civilDate.mjs';
import { computeZmanim } from './zmanimLocal.mjs';
import { hebrewDate } from '../dayContext.mjs';
import { YAHRZEITS } from '../data/yahrzeits.mjs';
import { yahrzeitsOn, nameWithHonorific } from './yahrzeits.mjs';
import { computeCircle, WEEK_GOAL } from './spiritualCircle.mjs';

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_DAYS = 8;

// The zmanim the widget advances through: the app's own list (services.mjs ZMANIM) in its order, with a short name
// that fits a small widget. Rabbenu Tam only when the user shows it in the app (settings.showRT).
export const WIDGET_ZMANIM = Object.freeze([
  ['chatzotNight', 'חצות הלילה'],
  ['alotHaShachar', 'עלות השחר'],
  ['misheyakir', 'משיכיר'],
  ['sunrise', 'הנץ החמה'],
  ['sofZmanShmaMGA', 'סוף ק״ש מג״א'],
  ['sofZmanShma', 'סוף זמן ק״ש'],
  ['sofZmanTfilla', 'סוף זמן תפילה'],
  ['chatzot', 'חצות היום'],
  ['minchaGedola', 'מנחה גדולה'],
  ['minchaKetana', 'מנחה קטנה'],
  ['plagHaMincha', 'פלג המנחה'],
  ['sunset', 'שקיעה'],
  ['tzeit85deg', 'צאת הכוכבים'],
  ['tzeit72min', 'רבנו תם'],
].map(Object.freeze));

const WEEKDAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת קודש'];

const ms = value => {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};
const weekdayOf = key => new Date(`${key}T12:00:00Z`).getUTCDay();
const localDate = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const hdateOf = key => new HDate(localDate(key));
const isIsrael = settings => (settings?.halachicResidenceStatus ? settings.halachicResidenceStatus === 'israel' : Boolean(settings?.il ?? settings?.location?.il));

// The Omer day (1–49) of a Jewish day, or 0. The count of day N is said on the evening that opens it.
export function omerDayOf(key) {
  const hd = hdateOf(key);
  const day = hd.abs() - new HDate(15, 1, hd.getFullYear()).abs();
  return day >= 1 && day <= 49 ? day : 0;
}
// The next Jewish day that is the first of the Omer (16 Nisan), on or after `key`.
export function nextOmerStart(key) {
  const hd = hdateOf(key);
  for (const year of [hd.getFullYear(), hd.getFullYear() + 1]) {
    const first = new HDate(16, 1, year);
    if (first.abs() >= hd.abs()) {
      const g = first.greg();
      return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`;
    }
  }
  return null;
}

// The famous tzaddikim of a Jewish day (the same list and order as "נר ה' נשמת אדם" on Today).
export function tzaddikimOf(key) {
  const hd = hdateOf(key);
  const date = { day: hd.getDate(), month: hd.getMonth(), year: hd.getFullYear() };
  let lengths;
  try { lengths = { [date.month]: HDate.daysInMonth(date.month, date.year) }; } catch { lengths = undefined; }
  return yahrzeitsOn(date, YAHRZEITS, { monthLengths: lengths }).map(nameWithHonorific);
}

// Candle lighting, havdalah and the weekly parasha from @hebcal/core, for the civil days [start, end].
function calendarEvents(start, end, settings) {
  const l = settings.location;
  const location = new Location(Number(l.latitude), Number(l.longitude), isIsrael(settings), l.tzid, l.name || '');
  const events = HebrewCalendar.calendar({
    start: localDate(start), end: localDate(end), location, il: isIsrael(settings),
    candlelighting: true, candleLightingMins: Number(settings.candles ?? 20), havdalahDeg: 8.5,
    sedrot: true, noHolidays: true,
  });
  const keyOf = event => { const g = event.getDate().greg(); return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`; };
  const out = { candles: new Map(), havdalah: new Map(), parashot: [] };
  for (const event of events) {
    const key = keyOf(event);
    const desc = event.getDesc();
    if (desc === 'Candle lighting' && event.eventTime) out.candles.set(key, ms(event.eventTime));
    else if (desc === 'Havdalah' && event.eventTime) out.havdalah.set(key, ms(event.eventTime));
    else if (event.getFlags() & flags.PARSHA_HASHAVUA) out.parashot.push({ key, name: event.render('he-x-NoNikud') });
  }
  out.parashot.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

/**
 * The snapshot.
 * @param {object} input
 * @param {Date}   input.now
 * @param {object} input.settings        the app's settings (location, candles, il / halachicResidenceStatus, showRT)
 * @param {Array}  [input.events]        the journal ("המצוות שלי") events, for the ring
 * @param {number} [input.lifetimeBest]  the high-water lifetime circles (services/spiritualCircle.mjs readCircles)
 * @param {number} [input.days]
 */
export function buildWidgetSnapshot({ now = new Date(), settings, events = [], lifetimeBest = 0, days = SNAPSHOT_DAYS } = {}) {
  const location = settings?.location;
  const tzid = location?.tzid;
  const at = ms(now);
  if (!tzid || at === null) return null;
  const civilToday = civilDateKey(new Date(at), tzid);
  // Civil days from yesterday (its sunset opens today's Jewish day) to `days` ahead.
  const civil = Array.from({ length: days + 2 }, (_, i) => shiftCivilDate(civilToday, i - 1));
  const times = new Map(civil.map(key => [key, computeZmanim(key, location)]));
  const sunsetOf = key => ms(times.get(key)?.sunset);
  if (sunsetOf(civilToday) === null) return null; // no sunset (polar day/night): no Jewish day boundary to show
  const todayKey = at >= sunsetOf(civilToday) ? shiftCivilDate(civilToday, 1) : civilToday;

  const lastKey = civil[civil.length - 1];
  const calendar = calendarEvents(civil[0], shiftCivilDate(lastKey, 21), settings);
  const parashaFrom = key => calendar.parashot.find(item => item.key >= key)?.name || null;

  // The Jewish days: [sunset of the day before, sunset of the day].
  const jewishDays = [];
  for (let i = 1; i < civil.length; i += 1) {
    const key = civil[i];
    const from = sunsetOf(civil[i - 1]);
    const to = sunsetOf(key);
    if (from === null || to === null || to <= at) continue;
    const date = hebrewDate(key);
    const names = tzaddikimOf(key);
    jewishDays.push({
      key, from, to,
      date: date.label,
      dayMonth: date.label.split(' ').slice(0, -1).join(' '),
      weekday: WEEKDAYS[weekdayOf(key)],
      parasha: parashaFrom(key),
      tzaddik: names.slice(0, 3),
      tzaddikCount: names.length,
      omer: omerDayOf(key),
    });
  }

  const showRT = Boolean(settings.showRT);
  const zmanim = [];
  for (const key of civil) {
    const day = times.get(key);
    if (!day) continue;
    for (const [zmanKey, name] of WIDGET_ZMANIM) {
      if (zmanKey === 'tzeit72min' && !showRT) continue;
      const instant = ms(day[zmanKey]);
      if (instant !== null && instant > at) zmanim.push({ key: zmanKey, name, at: instant });
    }
  }
  zmanim.sort((a, b) => a.at - b.at);

  // The coming Shabbatot: Friday's candle lighting, Saturday's havdalah (8.5°), and the parasha read.
  const shabbat = [];
  for (const [key, havdalah] of [...calendar.havdalah].sort(([a], [b]) => a.localeCompare(b))) {
    if (weekdayOf(key) !== 6 || havdalah <= at) continue;
    const candles = calendar.candles.get(shiftCivilDate(key, -1)) ?? null;
    shabbat.push({ key, candles, havdalah, parasha: calendar.parashot.find(item => item.key === key)?.name || null });
    if (shabbat.length >= 2) break;
  }

  // The ring: the open circle of this Jewish week; it empties at Motzaei Shabbat (the sunset that ends Saturday).
  const circle = computeCircle(events, todayKey);
  const saturday = shiftCivilDate(circle.weekStart, 6);
  const weekEnd = sunsetOf(saturday) ?? ms(computeZmanim(saturday, location)?.sunset);
  const lifetime = Math.max(circle.lifetime, Math.floor(Number(lifetimeBest) || 0));

  const omerStart = nextOmerStart(todayKey);
  return {
    v: SNAPSHOT_VERSION,
    generatedAt: at,
    validUntil: jewishDays.length ? jewishDays[jewishDays.length - 1].to : at,
    place: location.name || '',
    tzid,
    days: jewishDays,
    zmanim,
    shabbat,
    ring: { active: circle.active, goal: WEEK_GOAL, completedThisWeek: circle.completedThisWeek, lifetime, until: weekEnd },
    // The evening the next Omer count begins (the sunset that opens 16 Nisan).
    omer: { startsAt: omerStart ? ms(computeZmanim(shiftCivilDate(omerStart, -1), location)?.sunset) : null },
  };
}

// What the widget shows at an instant — the same rule the Swift and Kotlin widgets apply to the snapshot, kept here so
// the tests pin it: the Jewish day that contains the instant, the first zman after it, the first Shabbat whose havdalah
// is still ahead, and the ring (empty once the week has ended).
export function widgetStateAt(snapshot, instant) {
  const t = ms(instant);
  if (!snapshot || t === null) return null;
  const day = snapshot.days.find(item => t >= item.from && t < item.to) || null;
  const next = snapshot.zmanim.find(item => item.at > t) || null;
  const shabbat = snapshot.shabbat.find(item => item.havdalah > t) || null;
  const ring = t < snapshot.ring.until ? snapshot.ring.active : 0;
  return { day, next, shabbat, ring, goal: snapshot.ring.goal, stale: t >= snapshot.validUntil };
}

// Spoken / shown answers for Siri (the native side reads the same strings from the snapshot's rules; these pin them).
export function omerAnswer(snapshot, instant) {
  const state = widgetStateAt(snapshot, instant);
  if (!state?.day) return null;
  const day = state.day.omer;
  if (day) return `היום ${day} לעומר · נותרו ${49 - day} ימים`;
  const inDays = snapshot.omer?.startsAt ? Math.ceil((snapshot.omer.startsAt - ms(instant)) / 86400000) : null;
  if (inDays === 1) return 'ספירת העומר מתחילה הערב';
  return inDays > 1 ? `ספירת העומר מתחילה בעוד ${inDays} ימים` : 'אין ספירת העומר היום';
}

export const timeText = (instant, tzid) => new Intl.DateTimeFormat('he-IL', { timeZone: tzid, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant));
