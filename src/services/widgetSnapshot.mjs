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
import { HDate, HebrewCalendar, Location } from '@hebcal/core';
import { civilDateKey, shiftCivilDate } from '../civilDate.mjs';
import { computeZmanim } from './zmanimLocal.mjs';
import { hebrewDate } from '../dayContext.mjs';
import { YAHRZEITS } from '../data/yahrzeits.mjs';
import { yahrzeitsOn, nameWithHonorific } from './yahrzeits.mjs';
import { computeCircle, WEEK_GOAL } from './spiritualCircle.mjs';
import { MEAT_DAIRY_DEFAULT_HOURS, MEAT_DAIRY_HOURS, MEAT_DAIRY_LINGER_MS } from './meatDairy.mjs';
import { weekReadingOf } from './weeklyParasha.mjs';

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

// Candle lighting and havdalah from @hebcal/core, for the civil days [start, end]. (The week's reading comes from the
// app's one source, services/weeklyParasha.mjs weekReadingOf.)
function calendarEvents(start, end, settings) {
  const l = settings.location;
  const location = new Location(Number(l.latitude), Number(l.longitude), isIsrael(settings), l.tzid, l.name || '');
  const events = HebrewCalendar.calendar({
    start: localDate(start), end: localDate(end), location, il: isIsrael(settings),
    candlelighting: true, candleLightingMins: Number(settings.candles ?? 20), havdalahDeg: 8.5,
    noHolidays: true,
  });
  const keyOf = event => { const g = event.getDate().greg(); return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`; };
  const out = { candles: new Map(), havdalah: new Map() };
  for (const event of events) {
    const key = keyOf(event);
    const desc = event.getDesc();
    if (desc === 'Candle lighting' && event.eventTime) out.candles.set(key, ms(event.eventTime));
    else if (desc === 'Havdalah' && event.eventTime) out.havdalah.set(key, ms(event.eventTime));
  }
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
export function buildWidgetSnapshot({ now = new Date(), settings, events = [], lifetimeBest = 0, days = SNAPSHOT_DAYS, weather = null, sayings = null, meat = null } = {}) {
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
  // The week's reading, the same label the app shows: what is read on the coming Shabbat — on a festival Shabbat the
  // festival (or וזאת הברכה on Israel's Shemini Atzeret), never the parasha of the week after.
  const readingOf = key => weekReadingOf(key, isIsrael(settings))?.label || null;

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
      parasha: readingOf(key),
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

  // The coming Shabbatot: Friday's candle lighting, Saturday's havdalah (8.5°), and what is read (parasha or festival).
  const shabbat = [];
  for (const [key, havdalah] of [...calendar.havdalah].sort(([a], [b]) => a.localeCompare(b))) {
    if (weekdayOf(key) !== 6 || havdalah <= at) continue;
    const candles = calendar.candles.get(shiftCivilDate(key, -1)) ?? null;
    // Rabbenu Tam: the app's one definition — 72 fixed minutes after Saturday's sunset (zmanimLocal tzeit72min).
    const rabbenuTam = ms(times.get(key)?.tzeit72min) ?? null;
    shabbat.push({ key, candles, havdalah, rabbenuTam, parasha: readingOf(key) });
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
    prayers: prayerWindows(civil, times, at),
    weather: widgetWeather(weather, at),
    sayings: widgetSayings(sayings, at),
    meat: widgetMeat(meat),
  };
}

// ── The prayer of the hour ───────────────────────────────────────────────────────────────────────────────────────
// The same rule as the app's own Siddur (services/smartPrayer.mjs choosePrayerType): Arvit until dawn, Shacharit from
// dawn until midday, Mincha from midday until sunset, Arvit from sunset. Each window carries the time it properly
// begins (the sunrise, Mincha Gedola, the stars) and its deadlines in order — for Shacharit the latest Shema and the
// latest Amidah (the Gra, as the app's list), then midday; for Mincha the sunset; for Arvit midnight, then dawn.
export const PRAYER_NAMES = Object.freeze({ shacharit: 'שחרית', mincha: 'מנחה', maariv: 'ערבית' });

function prayerWindows(civil, times, at) {
  const out = [];
  const zman = (dayKey, key, name) => { const instant = ms(times.get(dayKey)?.[key]); return instant === null ? null : { name, at: instant }; };
  for (let i = 0; i < civil.length - 1; i += 1) {
    const key = civil[i];
    const next = civil[i + 1];
    const alot = ms(times.get(key)?.alotHaShachar);
    const chatzot = ms(times.get(key)?.chatzot);
    const sunset = ms(times.get(key)?.sunset);
    const nextAlot = ms(times.get(next)?.alotHaShachar);
    if (alot === null || chatzot === null || sunset === null || nextAlot === null) continue;
    out.push({ key: 'shacharit', name: PRAYER_NAMES.shacharit, from: alot, to: chatzot, opens: zman(key, 'sunrise', 'הנץ החמה'),
      ends: [zman(key, 'sofZmanShma', 'סוף זמן ק״ש'), zman(key, 'sofZmanTfilla', 'סוף זמן תפילה'), { name: 'חצות היום', at: chatzot }].filter(Boolean) });
    out.push({ key: 'mincha', name: PRAYER_NAMES.mincha, from: chatzot, to: sunset, opens: zman(key, 'minchaGedola', 'מנחה גדולה'),
      ends: [{ name: 'שקיעה', at: sunset }] });
    out.push({ key: 'maariv', name: PRAYER_NAMES.maariv, from: sunset, to: nextAlot, opens: zman(key, 'tzeit85deg', 'צאת הכוכבים'),
      ends: [zman(next, 'chatzotNight', 'חצות הלילה'), { name: 'עלות השחר', at: nextAlot }].filter(Boolean) });
  }
  return out.filter(item => item.to > at).sort((a, b) => a.from - b.from);
}

// The prayer whose window holds the instant, the deadline still ahead, whether it has properly begun, and the next one.
export function prayerStateAt(snapshot, instant) {
  const t = ms(instant);
  const list = snapshot?.prayers || [];
  const index = list.findIndex(item => t >= item.from && t < item.to);
  if (t === null || index < 0) return null;
  const current = list[index];
  return {
    current,
    deadline: current.ends.find(item => item.at > t) || null,
    opens: current.opens && current.opens.at > t ? current.opens : null,
    next: list[index + 1] || null,
  };
}

// The four doors of the רביעיית תפילות widget, each with its hint: "עד 09:42" for the prayer of the hour (its next
// deadline), "מ־12:30" for one still to come (when it properly begins). Birkat HaMazon has no hour.
export function quartetAt(snapshot, instant, time = (value => value)) {
  const t = ms(instant);
  const state = prayerStateAt(snapshot, t);
  const doors = ['shacharit', 'mincha', 'maariv'].map(key => {
    if (state?.current.key === key) return { key, name: PRAYER_NAMES[key], now: true, hint: state.deadline ? `עד ${time(state.deadline.at)}` : '' };
    const upcoming = (snapshot?.prayers || []).find(item => item.key === key && item.from > t);
    const start = upcoming ? (upcoming.opens?.at ?? upcoming.from) : null;
    return { key, name: PRAYER_NAMES[key], now: false, hint: start ? `מ־${time(start)}` : '' };
  });
  return [...doors, { key: 'birkat-hamazon', name: 'ברכת המזון', now: false, hint: 'אחרי הסעודה' }];
}

// ── Weather: the app's own last reading (services/weather.mjs, Open-Meteo), never fetched by the widget ─────────────
// Shown with the time it was read; dimmed after three hours, gone after twelve (the app's own limit for a stale reading).
export const WEATHER_DIM_MS = 3 * 3600000;
export const WEATHER_GONE_MS = 12 * 3600000;
function widgetWeather(cache, at) {
  const weather = cache?.weather;
  const savedAt = ms(cache?.savedAt);
  if (!weather || savedAt === null || weather.temperature == null || !Number.isFinite(Number(weather.temperature)) || at - savedAt >= WEATHER_GONE_MS) return null;
  const n = value => (Number.isFinite(Number(value)) && value !== null ? Math.round(Number(value)) : null);
  return { temp: n(weather.temperature), kind: String(weather.kind || 'cloudy'), label: String(weather.label || ''), high: n(weather.high), low: n(weather.low), at: savedAt };
}
export function weatherStateAt(snapshot, instant) {
  const t = ms(instant);
  const weather = snapshot?.weather;
  if (!weather || t === null) return null;
  const age = t - weather.at;
  if (age >= WEATHER_GONE_MS) return null;
  return { ...weather, dim: age >= WEATHER_DIM_MS };
}

// ── דברי חכמים: a saying every three hours, short enough for a widget ───────────────────────────────────────────────
// The candidates are the collection's sayings of at most 100 letters (vowels and cantillation not counted); slot k
// (three-hour slots since 1970) shows candidate (a·k + b) mod m — a fixed permutation, every one before any repeats.
// The snapshot carries the next 16 slots (two days); past them the widget cycles through those 16 again, never blank.
export const SAYING_SLOT_MS = 3 * 3600000;
export const SAYING_SLOTS = 16;
export const SAYING_MAX_LETTERS = 100;
const letters = text => String(text || '').replace(/[\u0591-\u05C7]/g, '').length;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function widgetSayings(data, at) {
  const rows = data?.SAYINGS;
  if (!Array.isArray(rows) || !rows.length) return null;
  const candidates = [];
  rows.forEach((row, index) => { if (letters(row[5]) <= SAYING_MAX_LETTERS && data.WORKS?.[row[1]]) candidates.push(index); });
  const m = candidates.length;
  if (!m) return null;
  let a = 7919 % m || 1;
  while (gcd(a, m) !== 1) a = (a + 1) % m || 1;
  const first = Math.floor(at / SAYING_SLOT_MS);
  const items = Array.from({ length: SAYING_SLOTS }, (_, i) => {
    const row = rows[candidates[((a * (first + i) + 11) % m + m) % m]];
    return { id: row[0], text: row[5], source: `${data.WORKS[row[1]].title} · ${row[4]}` };
  });
  return { from: first * SAYING_SLOT_MS, period: SAYING_SLOT_MS, items };
}
export function sayingStateAt(snapshot, instant) {
  const t = ms(instant);
  const sayings = snapshot?.sayings;
  if (!sayings?.items?.length || t === null) return null;
  const slot = Math.floor((t - sayings.from) / sayings.period);
  const count = sayings.items.length;
  return { ...sayings.items[((slot % count) + count) % count], until: sayings.from + (slot + 1) * sayings.period };
}

// ── אכלתי בשרי: the wait between meat and dairy, shared by the app and the widget ────────────────────────────────────
// The app's state (services/meatDairy.mjs) in the snapshot; the widget's own "אכלתי בשרי" button writes the same
// record to the shared store, and whichever was changed last wins (newerMeat) — in the app, the widget and Siri.
function widgetMeat(meat) {
  if (!meat) return null;
  const startedAt = ms(meat.startedAt);
  const hours = MEAT_DAIRY_HOURS.includes(meat.hours) ? meat.hours : MEAT_DAIRY_DEFAULT_HOURS;
  const preferred = MEAT_DAIRY_HOURS.includes(meat.preferred) ? meat.preferred : MEAT_DAIRY_DEFAULT_HOURS;
  return { startedAt: meat.startedAt ? startedAt : null, hours, preferred, updatedAt: ms(meat.updatedAt) ?? 0 };
}
export const newerMeat = (a, b) => (!a ? b || null : !b ? a : (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a);
// The same rule as meatDairyStatus(): waiting until start + hours, then "אפשר חלבי" for three hours, then at rest.
export function meatStateAt(meat, instant) {
  const t = ms(instant);
  if (!meat?.startedAt || t === null) return { phase: 'idle', hours: meat?.preferred || MEAT_DAIRY_DEFAULT_HOURS };
  const hours = MEAT_DAIRY_HOURS.includes(meat.hours) ? meat.hours : MEAT_DAIRY_DEFAULT_HOURS;
  const end = meat.startedAt + hours * 3600000;
  if (t > end + MEAT_DAIRY_LINGER_MS) return { phase: 'idle', hours: meat.preferred || hours };
  return { phase: t < end ? 'waiting' : 'done', start: meat.startedAt, end, hours, restAt: end + MEAT_DAIRY_LINGER_MS };
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
  return { day, next, upcoming: upcomingZmanimAt(snapshot, t), shabbat, ring, goal: snapshot.ring.goal, stale: t >= snapshot.validUntil };
}

// The next zmanim in order — the timeline of the day's zmanim with the Shabbat's candle lighting ("כניסת שבת") and
// havdalah ("צאת שבת") joined as zmanim — the first `count` after the instant. The medium "היום" widget (the one with
// the tzaddik of the day) shows three of them side by side, evenly spaced: e.g. מנחה קטנה · כניסת שבת · שקיעה. On the
// evening Shabbat ends, "צאת שבת" takes the place of that evening's "צאת הכוכבים" (the same moment, said once).
export const UPCOMING_COUNT = 3;
export const SHABBAT_ZMAN_NAMES = Object.freeze({ candles: 'כניסת שבת', havdalah: 'צאת שבת' });
const SHABBAT_TZEIT_WINDOW_MS = 30 * 60000;
export function upcomingZmanimAt(snapshot, instant, count = UPCOMING_COUNT) {
  const t = ms(instant);
  if (!snapshot || t === null) return [];
  const havdalot = (snapshot.shabbat || []).map(item => item.havdalah).filter(Number.isFinite);
  const replaced = item => item.key === 'tzeit85deg' && havdalot.some(h => Math.abs(h - item.at) < SHABBAT_TZEIT_WINDOW_MS);
  const list = (snapshot.zmanim || []).filter(item => item.at > t && !replaced(item)).map(({ key, name, at }) => ({ key, name, at }));
  for (const shabbat of snapshot.shabbat || []) {
    if (Number.isFinite(shabbat.candles) && shabbat.candles > t) list.push({ key: 'candles', name: SHABBAT_ZMAN_NAMES.candles, at: shabbat.candles });
    if (Number.isFinite(shabbat.havdalah) && shabbat.havdalah > t) list.push({ key: 'havdalah', name: SHABBAT_ZMAN_NAMES.havdalah, at: shabbat.havdalah });
  }
  return list.sort((a, b) => a.at - b.at).slice(0, Math.max(0, count));
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
