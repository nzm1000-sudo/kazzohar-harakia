// Prayer Day Facts — the Smart Siddur's single factual view of "what day, time and place is this".
// FACTS ONLY: no Tachanun, Hallel, seasonal phrases or any other prayer consequence lives here
// (those belong to the rule layer). Adapter over trusted sources already in the app:
//   • @hebcal/core                — Hebrew date, festival flags, Chol HaMoed / Chanukah day numbers
//   • civilDate.jewishDateKey     — the app's Jewish-day boundary (sunset)
//   • app zmanim (times.sunset)   — preferred sunset; otherwise @hebcal/core's local solar
//                                   calculation, so correctness never depends on the network
// Unknown is not false: anything that cannot be established is `unresolved` / `unsupported`.
import { GeoLocation, HDate, Zmanim, flags, getHolidaysOnDate, months } from '@hebcal/core';
import { civilDateKey, jewishDateKey } from '../../civilDate.mjs';
import { civilKeyAsLocalDate } from '../calendarAccuracy.mjs';

export const PRAYER_DAY_FACTS_SCHEMA_VERSION = 1;
export const STATUS = Object.freeze({ RESOLVED: 'resolved', PROVISIONAL: 'provisional', UNRESOLVED: 'unresolved', UNSUPPORTED: 'unsupported' });
export const GEO_REGIME = Object.freeze({ ISRAEL: 'israel', DIASPORA: 'diaspora', UNKNOWN: 'unknown' });

const validDate = value => {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
};
const validTimeZone = tzid => {
  if (typeof tzid !== 'string' || !tzid) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: tzid }); return true; } catch { return false; }
};
const finite = value => (value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null);

// Israel / diaspora comes only from the user's explicit setting — never from language or nusach.
export function geoRegimeFrom(settings = {}) {
  if (settings.halachicResidenceStatus === GEO_REGIME.ISRAEL || settings.halachicResidenceStatus === GEO_REGIME.DIASPORA) {
    return { regime: settings.halachicResidenceStatus, source: 'settings.halachicResidenceStatus' };
  }
  if (typeof settings.il === 'boolean') return { regime: settings.il ? GEO_REGIME.ISRAEL : GEO_REGIME.DIASPORA, source: 'settings.il' };
  return { regime: GEO_REGIME.UNKNOWN, source: null };
}

// Sunset for the civil date of `instant` at the location: app zmanim if valid for that date,
// otherwise local solar calculation. Polar day/night → unsupported (never "daytime").
function resolveSunset({ civilDate, tzid, latitude, longitude, times }) {
  const fromApp = validDate(times?.sunset);
  if (fromApp && civilDateKey(fromApp, tzid) === civilDate) return { status: STATUS.RESOLVED, sunset: fromApp, source: 'app-zmanim' };
  if (latitude === null || longitude === null) return { status: STATUS.UNRESOLVED, sunset: null, source: null, reason: 'missing-coordinates' };
  let computed = null;
  try {
    const place = new GeoLocation(null, latitude, longitude, 0, tzid);
    computed = validDate(new Zmanim(place, civilKeyAsLocalDate(civilDate), false).sunset());
  } catch { computed = null; }
  if (!computed || civilDateKey(computed, tzid) !== civilDate) return { status: STATUS.UNSUPPORTED, sunset: null, source: 'local-solar', reason: 'no-sunset-at-location' };
  return { status: STATUS.RESOLVED, sunset: computed, source: 'local-solar' };
}

const FESTIVAL_KIND = { YOM_TOV: 'yom-tov', CHOL_HAMOED: 'chol-hamoed', MINOR: 'minor', FAST: 'fast', ROSH_CHODESH: 'rosh-chodesh', MODERN: 'modern' };
// Hebcal's getDesc() is its stable machine key for an event (not a UI translation).
const MODERN_IDS = { "Yom HaAtzma'ut": 'yom-haatzmaut', 'Yom Yerushalayim': 'yom-yerushalayim', 'Yom HaZikaron': 'yom-hazikaron', 'Yom HaShoah': 'yom-hashoah' };

function fastId(month, day) {
  if (month === months.TISHREI) return day === 10 ? 'yom-kippur' : 'tzom-gedaliah';
  if (month === months.TEVET) return 'asara-betevet';
  if (month === months.ADAR_I || month === months.ADAR_II) return 'taanit-esther';
  if (month === months.TAMUZ) return 'shiva-asar-betammuz';
  if (month === months.AV) return 'tisha-beav';
  if (month === months.NISAN) return 'taanit-bechorot';
  return null;
}

// Structured observances of one Jewish day for one regime. Identity comes from Hebrew
// month/day and Hebcal flags — never from rendered (translated) holiday names.
function observancesFor(hdate, isIsrael) {
  const month = hdate.getMonth();
  const day = hdate.getDate();
  const events = getHolidaysOnDate(hdate, isIsrael) || [];
  const mask = events.reduce((all, event) => all | Number(event.getFlags?.() || 0), 0);
  const scope = isIsrael ? GEO_REGIME.ISRAEL : GEO_REGIME.DIASPORA;
  const isYomTov = Boolean(mask & flags.CHAG);
  const isCholHamoed = Boolean(mask & flags.CHOL_HAMOED);
  const list = [];
  let chag = null;
  let chagDayIndex = null;
  if (month === months.TISHREI && (day === 1 || day === 2)) { chag = 'rosh-hashanah'; chagDayIndex = day; }
  else if (month === months.TISHREI && day === 10) { chag = 'yom-kippur'; chagDayIndex = 1; }
  else if (month === months.TISHREI && day >= 15 && day <= 21) { chag = 'sukkot'; chagDayIndex = day - 14; }
  else if (month === months.TISHREI && day === 22) { chag = 'shemini-atzeret'; chagDayIndex = 1; }
  else if (month === months.TISHREI && day === 23 && !isIsrael) { chag = 'simchat-torah'; chagDayIndex = 1; }
  else if (month === months.NISAN && day >= 15 && day <= (isIsrael ? 21 : 22)) { chag = 'pesach'; chagDayIndex = day - 14; }
  else if (month === months.SIVAN && (day === 6 || (day === 7 && !isIsrael))) { chag = 'shavuot'; chagDayIndex = day - 5; }
  let cholHamoedDayIndex = null;
  if (chag && (isYomTov || isCholHamoed)) {
    if (isCholHamoed) {
      const fromEngine = events.map(event => event.cholHaMoedDay).find(value => Number.isInteger(value) && value > 0);
      cholHamoedDayIndex = fromEngine ?? (day - (isIsrael ? 15 : 16)); // Hoshana Rabbah is marked -1 by Hebcal
    }
    list.push({ id: chag, family: chag, kind: isYomTov ? FESTIVAL_KIND.YOM_TOV : FESTIVAL_KIND.CHOL_HAMOED, dayIndex: chagDayIndex, cholHamoedDayIndex, scope });
    // In Israel Shemini Atzeret is also Simchat Torah.
    if (chag === 'shemini-atzeret' && isIsrael) list.push({ id: 'simchat-torah', family: 'shemini-atzeret', kind: FESTIVAL_KIND.YOM_TOV, dayIndex: 1, cholHamoedDayIndex: null, scope });
  } else {
    chag = null; chagDayIndex = null;
  }
  const roshChodesh = Boolean(mask & flags.ROSH_CHODESH);
  let roshChodeshDayIndex = null;
  if (roshChodesh) {
    const previous = getHolidaysOnDate(hdate.prev(), isIsrael) || [];
    roshChodeshDayIndex = previous.some(event => Number(event.getFlags?.() || 0) & flags.ROSH_CHODESH) ? 2 : 1;
    list.push({ id: 'rosh-chodesh', family: 'rosh-chodesh', kind: FESTIVAL_KIND.ROSH_CHODESH, dayIndex: roshChodeshDayIndex, cholHamoedDayIndex: null, scope });
  }
  const chanukahDay = events.map(event => event.chanukahDay).find(value => Number.isInteger(value) && value >= 1 && value <= 8) ?? null;
  if (chanukahDay) list.push({ id: 'chanukah', family: 'chanukah', kind: FESTIVAL_KIND.MINOR, dayIndex: chanukahDay, cholHamoedDayIndex: null, scope });
  const purimMonth = hdate.isLeapYear() ? months.ADAR_II : months.ADAR_I;
  let purim = null;
  if (month === purimMonth && day === 14) purim = 'purim';
  else if (month === purimMonth && day === 15) purim = 'shushan-purim';
  else if (hdate.isLeapYear() && month === months.ADAR_I && day === 14) purim = 'purim-katan';
  if (purim) list.push({ id: purim, family: 'purim', kind: FESTIVAL_KIND.MINOR, dayIndex: 1, cholHamoedDayIndex: null, scope });
  const modernObservance = events.filter(event => Number(event.getFlags?.() || 0) & flags.MODERN_HOLIDAY).map(event => MODERN_IDS[event.getDesc?.()]).find(Boolean) || null;
  if (modernObservance) list.push({ id: modernObservance, family: 'modern', kind: FESTIVAL_KIND.MODERN, dayIndex: 1, cholHamoedDayIndex: null, scope });
  const isFastDay = Boolean(mask & (flags.MAJOR_FAST | flags.MINOR_FAST));
  const fast = isFastDay ? fastId(month, day) : null;
  if (fast && fast !== 'yom-kippur') list.push({ id: fast, family: 'fast', kind: FESTIVAL_KIND.FAST, dayIndex: 1, cholHamoedDayIndex: null, scope });
  const omerStart = new HDate(16, months.NISAN, hdate.getFullYear());
  const omerOffset = hdate.abs() - omerStart.abs();
  const omerCalendarDay = omerOffset >= 0 && omerOffset < 49 ? omerOffset + 1 : null;
  return {
    observances: list,
    facts: {
      isYomTov, chag: chag && (isYomTov || isCholHamoed) ? chag : null, chagDayIndex,
      isCholHamoed, cholHamoedChag: isCholHamoed ? chag : null, cholHamoedDayIndex,
      isHoshanaRabbah: month === months.TISHREI && day === 21,
      isRoshChodesh: roshChodesh, roshChodeshDayIndex,
      chanukahDay, purim, fast, omerCalendarDay, modernObservance,
    },
  };
}

/**
 * computePrayerDayFacts({ instant, settings, times }) → PrayerDayFacts (see docs/prayer-day-facts.md)
 * instant: Date | ISO string; settings: app settings ({ location: { tzid, latitude, longitude, source }, halachicResidenceStatus | il });
 * times: optional app zmanim ({ sunset }). Pure and deterministic for identical inputs.
 */
export function computePrayerDayFacts({ instant, settings = {}, times = null } = {}) {
  const warnings = [];
  const at = validDate(instant);
  if (!at) throw new TypeError('computePrayerDayFacts: a valid instant is required');
  const location = settings.location || {};
  const tzid = validTimeZone(location.tzid) ? location.tzid : null;
  const latitude = finite(location.latitude);
  const longitude = finite(location.longitude);
  const { regime, source: regimeSource } = geoRegimeFrom(settings);
  if (!tzid) {
    warnings.push('missing-time-zone');
    return {
      schemaVersion: PRAYER_DAY_FACTS_SCHEMA_VERSION, status: STATUS.UNRESOLVED, instant: at.toISOString(), timeZone: null, civilDate: null,
      location: { tzid: null, latitude, longitude, source: location.source || null },
      geoRegime: regime, dayBoundary: { status: STATUS.UNRESOLVED, afterSunset: null, sunset: null, source: null },
      jewishDay: null, observanceStatus: STATUS.UNRESOLVED, observances: null, facts: null,
      provenance: { calendarEngine: '@hebcal/core', boundary: 'civilDate.jewishDateKey', sunsetSource: null, locationSource: location.source || null, geoRegimeSource: regimeSource, warnings },
    };
  }
  const civilDate = civilDateKey(at, tzid);
  const sun = resolveSunset({ civilDate, tzid, latitude, longitude, times });
  if (sun.reason) warnings.push(sun.reason);
  const boundaryKey = sun.status === STATUS.RESOLVED ? jewishDateKey(at, sun.sunset, tzid) : null;
  const afterSunset = boundaryKey ? boundaryKey !== civilDate : null;
  // Without a boundary the day is only provisional (the civil date); dependent facts inherit that.
  const dayKey = boundaryKey || civilDate;
  const dayStatus = boundaryKey ? STATUS.RESOLVED : STATUS.PROVISIONAL;
  if (!boundaryKey) warnings.push('jewish-day-provisional');
  const hdate = new HDate(civilKeyAsLocalDate(dayKey));
  const next = hdate.next();
  const jewishDay = {
    status: dayStatus,
    key: dayKey,
    hebrew: { year: hdate.getFullYear(), month: hdate.getMonth(), day: hdate.getDate(), isLeapYear: hdate.isLeapYear() },
    weekday: hdate.getDay(),
    isShabbat: hdate.getDay() === 6,
    // The following Jewish day (calendar fact; needed by eve-of-day rules such as Mincha before Rosh Chodesh).
    next: { hebrew: { year: next.getFullYear(), month: next.getMonth(), day: next.getDate() }, chanukahDay: observancesFor(next, true).facts.chanukahDay },
  };
  let observed;
  let observanceStatus = dayStatus;
  if (regime === GEO_REGIME.UNKNOWN) {
    const israel = observancesFor(hdate, true);
    const diaspora = observancesFor(hdate, false);
    const strip = value => JSON.stringify(value.observances.map(({ scope, ...rest }) => rest)) + JSON.stringify(value.facts);
    if (strip(israel) === strip(diaspora)) observed = { observances: israel.observances.map(item => ({ ...item, scope: 'both' })), facts: israel.facts };
    else { observed = { observances: null, facts: null }; observanceStatus = STATUS.UNRESOLVED; warnings.push('geo-regime-unknown-and-observances-differ'); }
  } else {
    observed = observancesFor(hdate, regime === GEO_REGIME.ISRAEL);
  }
  const facts = observed.facts ? { isShabbat: jewishDay.isShabbat, ...observed.facts, isShabbatCholHamoed: jewishDay.isShabbat && observed.facts.isCholHamoed } : null;
  const status = dayStatus === STATUS.RESOLVED && observanceStatus === STATUS.RESOLVED ? STATUS.RESOLVED : observanceStatus === STATUS.UNRESOLVED ? STATUS.UNRESOLVED : STATUS.PROVISIONAL;
  return {
    schemaVersion: PRAYER_DAY_FACTS_SCHEMA_VERSION,
    status,
    instant: at.toISOString(),
    timeZone: tzid,
    civilDate,
    location: { tzid, latitude, longitude, source: location.source || null },
    geoRegime: regime,
    dayBoundary: { status: sun.status, afterSunset, sunset: sun.sunset ? sun.sunset.toISOString() : null, source: sun.source },
    jewishDay,
    observanceStatus,
    observances: observed.observances,
    facts,
    provenance: { calendarEngine: '@hebcal/core', boundary: 'civilDate.jewishDateKey', sunsetSource: sun.source, locationSource: location.source || null, geoRegimeSource: regimeSource, warnings },
  };
}

