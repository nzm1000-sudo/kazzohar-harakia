// זמנים בכל העולם: an offline city search (src/data/worldCities.mjs — GeoNames CC BY 4.0, Hebrew names from Wikidata
// CC0) and, for any place, its local time and the day's zmanim computed on the device (services/zmanimLocal.mjs, the
// same @hebcal/core engine as the app's own zmanim screen).
import { HDate } from '@hebcal/core';
import { civilDateKey, shiftCivilDate } from '../civilDate.mjs';
import { computeZmanim } from './zmanimLocal.mjs';
import { isInEretzYisrael } from './diasporaMode.mjs';

export const WORLD_ZMANIM = Object.freeze([
  ['alotHaShachar', 'עלות השחר'],
  ['sunrise', 'הנץ החמה'],
  ['sofZmanShma', 'סוף זמן ק״ש'],
  ['sofZmanTfilla', 'סוף זמן תפילה'],
  ['chatzot', 'חצות היום'],
  ['minchaGedola', 'מנחה גדולה'],
  ['plagHaMincha', 'פלג המנחה'],
  ['sunset', 'שקיעה'],
  ['tzeit85deg', 'צאת הכוכבים'],
]);

let displayNames = null;
export function countryName(cc) {
  if (!cc) return '';
  try { displayNames ||= new Intl.DisplayNames(['he'], { type: 'region' }); return displayNames.of(String(cc).toUpperCase()) || cc; } catch { return cc; }
}

// "name|he|cc|lat|lon|tz|population" → a place.
export function parseCity(row) {
  const [name, he, cc, lat, lon, tzid, population] = String(row).split('|');
  const latitude = Number(lat);
  const longitude = Number(lon);
  return { id: `${name}|${cc}|${lat}|${lon}`, name: he || name, searchName: name, he: he || '', countryCode: cc.toLowerCase(), latitude, longitude, tzid, population: Number(population) || 0, il: cc === 'IL' || cc === 'PS' };
}

const fold = text => String(text || '').toLocaleLowerCase('en').normalize('NFD').replace(/[̀-֑ͯ-ׇ'"׳״\-–.]/g, '').replace(/\s+/g, ' ').trim();

// The best matches for a query in Hebrew or English: a name that starts with it first, then one that contains it;
// larger places first within each.
export function searchCities(cities, query, limit = 8) {
  const q = fold(query);
  if (q.length < 2) return [];
  const scored = [];
  for (const city of cities) {
    const names = [fold(city.he), fold(city.searchName)];
    const starts = names.some(name => name && name.startsWith(q));
    const contains = starts || names.some(name => name && name.includes(q));
    if (contains) scored.push({ city, rank: starts ? 0 : 1 });
  }
  return scored.sort((a, b) => a.rank - b.rank || b.city.population - a.city.population).slice(0, limit).map(item => item.city);
}

function offsetMinutes(tzid, at) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tzid, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at);
  const get = type => Number(parts.find(part => part.type === type)?.value);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return Math.round((local - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

// "+7 שעות" / "−2:30 שעות" / "אותה שעה" relative to another zone.
export function offsetLabel(tzid, fromTzid, at = new Date()) {
  try {
    const diff = offsetMinutes(tzid, at) - offsetMinutes(fromTzid, at);
    if (!diff) return 'אותה שעה כמו כאן';
    const sign = diff > 0 ? '+' : '−';
    const hours = Math.floor(Math.abs(diff) / 60);
    const minutes = Math.abs(diff) % 60;
    return `${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''} ${hours === 1 && !minutes ? 'שעה' : 'שעות'} מכאן`;
  } catch { return ''; }
}

// A place right now: local time and date, the Hebrew date (after sunset, the next day's "אור ל…"), the day's zmanim,
// and whether it is in Eretz Yisrael.
export function placeNow(place, now = new Date()) {
  const tzid = place.tzid;
  const dateKey = civilDateKey(now, tzid);
  const times = computeZmanim(dateKey, place) || {};
  const sunset = times.sunset ? new Date(times.sunset) : null;
  const afterSunset = Boolean(sunset && now >= sunset);
  const [y, m, d] = (afterSunset ? shiftCivilDate(dateKey, 1) : dateKey).split('-').map(Number);
  let hebrew = '';
  try { hebrew = new HDate(new Date(y, m - 1, d)).renderGematriya(true); } catch { hebrew = ''; }
  const fmt = options => { try { return new Intl.DateTimeFormat('he-IL', { timeZone: tzid, ...options }).format(now); } catch { return ''; } };
  return {
    dateKey,
    time: fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    date: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
    hebrew: hebrew ? `${afterSunset ? 'אור ל' : ''}${hebrew}` : '',
    afterSunset,
    zmanim: WORLD_ZMANIM.map(([key, label]) => ({ key, label, at: times[key] || null })),
    polar: !times.sunrise || !times.sunset,
    eretzYisrael: isInEretzYisrael(place),
  };
}
