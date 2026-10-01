// Fast days with their start and end, computed for the user's location — never a national table. The calendar
// (which day is a fast, including a fast moved off Shabbat) comes from @hebcal/core; the times from the app's own
// zmanim definitions (zmanimLocal.mjs). Each kind of fast has its own rule:
//   • minor fasts (צום גדליה, עשרה בטבת, תענית אסתר, י״ז בתמוז): עלות השחר (16.1°) → צאת הכוכבים (8.5°)
//   • תשעה באב: sunset of the eve → צאת הכוכבים (8.5°) of the next night
//   • יום הכיפורים: candle lighting (sunset − the app's candle offset) → צאת הכוכבים (8.5°)
//   • תענית בכורות: firstborn only — עלות השחר → צאת הכוכבים, shown with its own note, never as a communal fast
// "רבנו תם" (sunset + 72) is offered as a later, secondary alternative; the main end stays the app's nightfall.
import { HebrewCalendar, HDate, Location, flags, months } from '@hebcal/core';
import { computeZmanim, RABBENU_TAM_METHOD, NIGHTFALL_DEGREES } from './zmanimLocal.mjs';
import { shiftCivilDate } from '../civilDate.mjs';

export const FAST_RULES = Object.freeze({
  minor: { begins: 'עלות השחר (16.1°)', ends: `צאת הכוכבים (${NIGHTFALL_DEGREES}°)` },
  'tisha-bav': { begins: 'שקיעת החמה בערב הצום', ends: `צאת הכוכבים (${NIGHTFALL_DEGREES}°)` },
  'yom-kippur': { begins: 'הדלקת נרות (לפני השקיעה)', ends: `צאת הכוכבים (${NIGHTFALL_DEGREES}°)` },
  bechorot: { begins: 'עלות השחר (16.1°)', ends: `צאת הכוכבים (${NIGHTFALL_DEGREES}°)`, note: 'לבכורות בלבד; רבים נוהגים להשתתף בסיום מסכת ולא לצום' },
  rabbenuTam: RABBENU_TAM_METHOD,
});

const NAMES = {
  'Tzom Gedaliah': 'צום גדליה', "Asara B'Tevet": 'עשרה בטבת', "Ta'anit Esther": 'תענית אסתר', 'Tzom Tammuz': 'שבעה עשר בתמוז',
  "Tish'a B'Av": 'תשעה באב', 'Yom Kippur': 'יום הכיפורים', "Ta'anit Bechorot": 'תענית בכורות',
};
// The nominal date of each fast; a fast observed on another day was moved (נדחה) off Shabbat (or, for Esther, forward).
const NOMINAL = {
  'Tzom Gedaliah': [months.TISHREI, 3], "Asara B'Tevet": [months.TEVET, 10], 'Tzom Tammuz': [months.TAMUZ, 17], "Tish'a B'Av": [months.AV, 9],
  'Yom Kippur': [months.TISHREI, 10], "Ta'anit Bechorot": [months.NISAN, 14],
};
const kindOf = desc => (desc === "Tish'a B'Av" ? 'tisha-bav' : desc === 'Yom Kippur' ? 'yom-kippur' : desc === "Ta'anit Bechorot" ? 'bechorot' : 'minor');
const baseDesc = desc => String(desc || '').replace(/\s*\(observed\)\s*$/i, '').trim();
const isIsrael = settings => (settings?.halachicResidenceStatus ? settings.halachicResidenceStatus === 'israel' : Boolean(settings?.il));
const dateKeyOf = hdate => { const d = hdate.greg(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hdateOf = key => { const [y, m, d] = String(key).split('-').map(Number); return new HDate(new Date(y, m - 1, d)); };
const at = value => (value ? new Date(value) : null);

function times(dateKey, settings) { return computeZmanim(dateKey, settings?.location) || null; }

// Every fast between two civil dates (inclusive), each with its location-aware times. Missing location → times null.
export function fastsBetween(startKey, endKey, settings = {}) {
  const il = isIsrael(settings);
  const events = HebrewCalendar.calendar({ start: hdateOf(startKey), end: hdateOf(endKey), il, noHolidays: false, noMinorFast: false, noSpecialShabbat: true, noRoshChodesh: true, noModern: true, mask: flags.MINOR_FAST | flags.MAJOR_FAST });
  const seen = new Set();
  const out = [];
  for (const event of events) {
    const desc = baseDesc(event.getDesc());
    if (!NAMES[desc] || !(event.getFlags() & (flags.MINOR_FAST | flags.MAJOR_FAST))) continue;
    if (/^Erev /.test(desc)) continue;
    const hdate = event.getDate();
    const key = dateKeyOf(hdate);
    if (seen.has(`${desc}|${key}`)) continue;
    seen.add(`${desc}|${key}`);
    const kind = kindOf(desc);
    const nominal = NOMINAL[desc];
    // hebcal marks a fast moved off Shabbat (or, for Esther and Bechorot, moved earlier) as observed on another day.
    const postponed = event.observed === true || /observed/i.test(event.getDesc()) || (nominal ? !(hdate.getMonth() === nominal[0] && hdate.getDate() === nominal[1]) : desc === "Ta'anit Esther" && hdate.getDate() !== 13);
    const weekday = hdate.greg().getDay();
    const day = times(key, settings);
    const eve = times(shiftCivilDate(key, -1), settings);
    let begins = null;
    let ends = null;
    if (day) {
      if (kind === 'tisha-bav') begins = at(eve?.sunset);
      else if (kind === 'yom-kippur') begins = eve?.sunset ? new Date(new Date(eve.sunset).getTime() - (Number(settings.candles) || 20) * 60000) : null;
      else begins = at(day.alotHaShachar);
      ends = at(day.tzeit85deg);
    }
    out.push({
      key, hebrewDate: hdate, title: desc, hebrew: NAMES[desc], kind, postponed, weekday,
      firstbornOnly: kind === 'bechorot',
      // A fast on Friday keeps its full length: it ends at nightfall, after candle lighting (SA OC 249:4; 550:3).
      endsIntoShabbat: weekday === 5 && kind === 'minor',
      begins, ends,
      endsRabbenuTam: day?.tzeit72min ? at(day.tzeit72min) : null,
      sunset: at(day?.sunset), eveSunset: at(eve?.sunset),
      rule: FAST_RULES[kind], rabbenuTam: RABBENU_TAM_METHOD,
      note: kind === 'bechorot' ? FAST_RULES.bechorot.note : null,
    });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

// The fast observed on one civil date (the Jewish day key the app uses), or null.
export function fastOn(dateKey, settings = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) return null;
  return fastsBetween(dateKey, dateKey, settings)[0] || null;
}

// Today's fast and tomorrow's (the day before every fast shows its times), by the app's current Jewish day key.
export function fastOutlook(todayKey, settings = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(todayKey))) return { today: null, tomorrow: null };
  return { today: fastOn(todayKey, settings), tomorrow: fastOn(shiftCivilDate(todayKey, 1), settings) };
}

export const FAST_KIND_LABELS = Object.freeze({ minor: 'תענית ציבור', 'tisha-bav': 'תשעה באב', 'yom-kippur': 'יום הכיפורים', bechorot: 'תענית בכורות' });
export { Location };
