// The day's zmanim, computed on the device from the saved location (@hebcal/core — the same library behind
// hebcal.com, so the values agree with the Hebcal API to the minute; tests/zmanimLocal.test.mjs checks that against
// captured API answers and an independent solar service). No network: once a location is saved, every time the app
// shows is available offline, in any timezone. Sea-level sunrise/sunset, no elevation correction (as the app always did).
//
// Definitions (the app's own, shown to the user on the zmanim screen):
//   • alotHaShachar 16.1° · misheyakir 11.5° · sunrise / sunset geometric, sea level
//   • tzeit85deg 8.5° — the app's nightfall (צאת הכוכבים), end of Shabbat, Yom Tov and fasts
//   • tzeit72min — "רבנו תם": a fixed 72 minutes after sunset (the app's one definition of Rabbenu Tam)
import { Location, Zmanim } from '@hebcal/core';

export const RABBENU_TAM_MINUTES = 72;
export const RABBENU_TAM_METHOD = Object.freeze({ id: 'sunset-plus-72', label: 'רבנו תם', minutesAfterSunset: RABBENU_TAM_MINUTES, description: '72 דקות קבועות אחרי השקיעה (במישור, ללא תיקון גובה)', source: 'The same fixed-minute Rabbenu Tam the app has always listed (ZMANIM key tzeit72min); one recognized implementation among several.' });
export const NIGHTFALL_DEGREES = 8.5;

const validLocation = location => location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)) && typeof location.tzid === 'string' && location.tzid;

// A civil date key ("2026-11-06") as the local calendar day of the location: noon in that timezone, so DST and the
// date line never move the day.
function civilNoon(dateKey, tzid) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, 12));
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tzid, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(probe);
  const value = type => Number(parts.find(part => part.type === type)?.value);
  const localAsUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour') % 24, value('minute'));
  const offsetMinutes = (localAsUtc - probe.getTime()) / 60000;
  return new Date(Date.UTC(year, month - 1, day, 12) - offsetMinutes * 60000);
}

const round = date => Zmanim.roundTime(date);
const iso = date => (date instanceof Date && Number.isFinite(date.getTime()) ? round(date).toISOString() : null);

// Every key the Hebcal zmanim API returns, for one civil date at a location.
export function computeZmanim(dateKey, location) {
  if (!validLocation(location) || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) return null;
  const loc = new Location(Number(location.latitude), Number(location.longitude), Boolean(location.il), location.tzid);
  const noon = civilNoon(dateKey, location.tzid);
  const z = new Zmanim(loc, noon, false);
  const safe = fn => { try { return iso(fn()); } catch { return null; } };
  return {
    chatzotNight: safe(() => z.chatzotNight()),
    alotHaShachar: safe(() => z.alotHaShachar()),
    misheyakir: safe(() => z.misheyakir()),
    misheyakirMachmir: safe(() => z.misheyakirMachmir()),
    dawn: safe(() => z.dawn()),
    sunrise: safe(() => z.sunrise()),
    sofZmanShmaMGA19Point8: safe(() => z.sofZmanShmaMGA19Point8()),
    sofZmanShmaMGA16Point1: safe(() => z.sofZmanShmaMGA16Point1()),
    sofZmanShmaMGA: safe(() => z.sofZmanShmaMGA()),
    sofZmanShma: safe(() => z.sofZmanShma()),
    sofZmanTfillaMGA19Point8: safe(() => z.sofZmanTfillaMGA19Point8()),
    sofZmanTfillaMGA16Point1: safe(() => z.sofZmanTfillaMGA16Point1()),
    sofZmanTfillaMGA: safe(() => z.sofZmanTfillaMGA()),
    sofZmanTfilla: safe(() => z.sofZmanTfilla()),
    chatzot: safe(() => z.chatzot()),
    minchaGedola: safe(() => z.minchaGedola()),
    minchaGedolaMGA: safe(() => z.minchaGedolaMGA()),
    minchaKetana: safe(() => z.minchaKetana()),
    minchaKetanaMGA: safe(() => z.minchaKetanaMGA()),
    plagHaMincha: safe(() => z.plagHaMincha()),
    sunset: safe(() => z.sunset()),
    beinHaShmashos: safe(() => z.beinHaShmashos()),
    dusk: safe(() => z.dusk()),
    tzeit7083deg: safe(() => z.tzeit(7.083)),
    tzeit85deg: safe(() => z.tzeit(NIGHTFALL_DEGREES)),
    tzeit42min: safe(() => z.sunsetOffset(42, true)),
    tzeit50min: safe(() => z.sunsetOffset(50, true)),
    tzeit72min: safe(() => z.sunsetOffset(RABBENU_TAM_MINUTES, true)),
  };
}

// Rabbenu Tam for the night that ends the given civil date: sunset + 72 minutes.
export function rabbenuTamAfterSunset(dateKey, location) {
  const times = computeZmanim(dateKey, location);
  return times?.tzeit72min ? new Date(times.tzeit72min) : null;
}

// The civil date of an instant at the location.
export function civilKeyAt(instant, tzid) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tzid, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
