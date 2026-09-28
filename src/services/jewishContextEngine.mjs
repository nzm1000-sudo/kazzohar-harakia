import { HDate, flags, getHolidaysOnDate, months } from '@hebcal/core';
import { civilDateKey, jewishDateKey } from '../civilDate.mjs';
import { civilKeyAsLocalDate } from './calendarAccuracy.mjs';

// Four distinct rites (data/nusach/registry.mjs); "sefard" is the Chassidic Nusach Sefard, never Edot HaMizrach.
export const NUSACH = Object.freeze({ EDOT_HAMIZRACH: 'edot-hamizrach', ASHKENAZ: 'ashkenaz', SEFARD: 'sefard', CHABAD: 'chabad' });
export const RESIDENCE_STATUS = Object.freeze({ ISRAEL: 'israel', DIASPORA: 'diaspora' });

const SOURCE_REVIEW = Object.freeze({
  reviewState: 'source-verified',
  nusach: NUSACH.EDOT_HAMIZRACH,
  scope: 'israel-and-diaspora',
});

const RULES = Object.freeze({
  yaalehVeyavo: { id: 'prayer.yaaleh-veyavo', topic: 'rosh-chodesh', source: 'Shulchan Arukh, Orach Chayim 422', ...SOURCE_REVIEW },
  alHanissim: { id: 'prayer.al-hanissim', topic: 'chanukah-purim', source: 'Shulchan Arukh, Orach Chayim 682, 693', ...SOURCE_REVIEW },
  hallel: { id: 'prayer.hallel', topic: 'hallel', source: 'Shulchan Arukh, Orach Chayim 422, 683', ...SOURCE_REVIEW },
  tachanun: { id: 'prayer.tachanun', topic: 'tachanun', source: 'Shulchan Arukh, Orach Chayim 131', ...SOURCE_REVIEW },
  mashivHaruch: { id: 'prayer.mashiv-haruach', topic: 'seasonal', source: 'Yalkut Yosef, Tefillah, siman 114', ...SOURCE_REVIEW },
  vetenTalUmatar: { id: 'prayer.veten-tal-umatar', topic: 'seasonal', source: 'Yalkut Yosef, Tefillah, siman 117', ...SOURCE_REVIEW },
  vidui: { id: 'prayer.vidui-erev-yom-kippur', topic: 'yom-kippur', source: 'Shulchan Arukh, Orach Chayim 607; Yalkut Yosef, Yamim Noraim', ...SOURCE_REVIEW },
});

const hebrewMonths = new Map([
  [months.NISAN, 'ניסן'], [months.IYYAR, 'אייר'], [months.SIVAN, 'סיוון'], [months.TAMUZ, 'תמוז'],
  [months.AV, 'אב'], [months.ELUL, 'אלול'], [months.TISHREI, 'תשרי'], [months.CHESHVAN, 'חשוון'],
  [months.KISLEV, 'כסלו'], [months.TEVET, 'טבת'], [months.SHVAT, 'שבט'], [months.ADAR_I, 'אדר א׳'], [months.ADAR_II, 'אדר ב׳'],
]);

const isLeapGregorianYear = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const eventCategories = event => event?.getCategories?.() || [];

function hebrewDateParts(date) {
  const hdate = new HDate(date);
  const rendered = hdate.renderGematriya().replace(/\p{M}/gu, '').split(' ');
  const label = `${rendered[0]} ב${rendered.slice(1).join(' ')}`;
  return { day: hdate.getDate(), month: hdate.getMonth(), year: hdate.getFullYear(), hdate,
    label };
}

// The 30th of any month is the first day of the next month's Rosh Chodesh (30 Tishrei included); 1 Tishrei is Rosh HaShanah.
function isRoshChodesh(date) { return date.day === 30 || (date.day === 1 && date.month !== months.TISHREI); }
function isChanukah(date) {
  const elapsed = date.hdate.abs() - new HDate(25, months.KISLEV, date.year).abs();
  return elapsed >= 0 && elapsed < 8;
}
function isPurim(date) {
  const month = date.hdate.isLeapYear() ? months.ADAR_II : months.ADAR_I;
  return date.month === month && (date.day === 14 || date.day === 15);
}
function isMajorHoliday(date) {
  return (date.month === months.TISHREI && [1, 2, 10, 15, 16, 21, 22, 23].includes(date.day))
    || (date.month === months.NISAN && date.day >= 15 && date.day <= 22)
    || (date.month === months.SIVAN && date.day === 6);
}
function mashivHaruch(date, prayerType = 'shacharit') {
  if (date.month === months.TISHREI) {
    if (date.day > 22) return true;
    // SA OC 114:1 — from Mussaf of Shemini Atzeret. Arvit that opens 22 Tishrei is still before it
    // (the evening after it already belongs to 23 Tishrei, handled above).
    return date.day === 22 && ['mussaf', 'mincha'].includes(prayerType);
  }
  if (date.month === months.NISAN) {
    if (date.day < 15) return true;
    // Until Mussaf of the first day of Pesach: Arvit of the Seder night and Shacharit still say it.
    return date.day === 15 && ['maariv', 'shacharit'].includes(prayerType);
  }
  return [months.CHESHVAN, months.KISLEV, months.TEVET, months.SHVAT, months.ADAR_I, months.ADAR_II].includes(date.month);
}
function vetenTalUmatar(date, isIsrael, civil, prayerType = 'shacharit', tzid = 'UTC', afterSunset = false) {
  if (isIsrael) {
    if (date.month === months.CHESHVAN && date.day === 7) return ['maariv', 'shacharit', 'mussaf', 'mincha'].includes(prayerType);
    if (date.month === months.CHESHVAN && date.day < 7) return false;
    if (date.month === months.CHESHVAN) return date.day > 7;
    if (date.month === months.NISAN) return date.day < 15;
    return [months.KISLEV, months.TEVET, months.SHVAT, months.ADAR_I, months.ADAR_II].includes(date.month);
  }
  // Preserve the winter season across Gregorian New Year; stop at Pesach.
  if (date.month === months.NISAN) return date.day < 15;
  if ([months.IYYAR, months.SIVAN, months.TAMUZ, months.AV, months.ELUL, months.TISHREI].includes(date.month)) return false;
  if ([months.TEVET, months.SHVAT, months.ADAR_I, months.ADAR_II].includes(date.month)) return true;
  const localDate = civilDateKey(civil, tzid);
  const year = Number(localDate.slice(0, 4));
  const startDay = isLeapGregorianYear(year + 1) ? 5 : 4;
  const transitionDate = `${year}-12-${String(startDay).padStart(2, '0')}`;
  if (localDate > transitionDate) return true;
  if (localDate < transitionDate) return false;
  return afterSunset || prayerType === 'maariv';
}

function readingContext(hdate, isIsrael, sourceEvents) {
  const event = sourceEvents.find(item => item.category === 'parashat' || item.t === 'parashat') || sourceEvents.find(item => item.category === 'holiday' && item.leyning?.torah);
  if (!event) return null;
  return {
    name: event.hebrew || event.title,
    sourceRef: event?.leyning?.torah || null,
    maftir: event?.leyning?.maftir || null,
    haftara: event?.leyning?.haftarah_sephardic || event?.leyning?.haftarah || event?.leyning?.haftara || null,
    special: sourceEvents.find(item => /Shkalim|Shekalim|Parah|Hachodesh|Zachor/i.test(item.title || item.desc || '')) || null,
  };
}

export function normalizeJewishProfile(settings = {}) {
  const status = settings.halachicResidenceStatus || (settings.il ? RESIDENCE_STATUS.ISRAEL : RESIDENCE_STATUS.DIASPORA);
  return {
    nusach: Object.values(NUSACH).includes(settings.nusach) ? settings.nusach : NUSACH.EDOT_HAMIZRACH,
    halachicResidenceStatus: Object.values(RESIDENCE_STATUS).includes(status) ? status : RESIDENCE_STATUS.ISRAEL,
    currentLocation: settings.location || null,
  };
}

export function JewishContextEngine({ now = new Date(), settings = {}, times = {}, items = [], prayerType = 'shacharit' } = {}) {
  const profile = normalizeJewishProfile(settings);
  const isIsrael = profile.halachicResidenceStatus === RESIDENCE_STATUS.ISRAEL;
  const tzid = settings.location?.tzid || 'UTC';
  const civil = new Date(now);
  const civilDate = civilDateKey(civil, tzid);
  const sunset = times?.sunset ? new Date(times.sunset) : null;
  const verifiedKey = jewishDateKey(civil, sunset, tzid);
  const afterSunset = Boolean(verifiedKey && verifiedKey !== civilDate);
  const jewishKey = verifiedKey || civilDate;
  const jewishCivil = civilKeyAsLocalDate(jewishKey);
  const date = hebrewDateParts(jewishCivil);
  const holidays = (getHolidaysOnDate(date.hdate, isIsrael) || []).filter(event => !eventCategories(event).includes('hebdate'));
  const holidayFlags = holidays.reduce((mask, event) => mask | Number(event?.getFlags?.() || 0), 0);
  const dayOfWeek = date.hdate.getDay();
  const chanukah = isChanukah(date);
  const purim = isPurim(date);
  const roshChodesh = isRoshChodesh(date);
  const shabbat = dayOfWeek === 6;
  const sourceEvents = (Array.isArray(items) ? items : []).filter(event => event?.date?.slice?.(0, 10) === jewishKey);
  // A public fast only: the fast of the firstborn and Monday–Thursday–Monday (BeHaB) are private and change nothing
  // in the congregation's prayer (no עננו, ויחל or Avinu Malkeinu for everyone).
  const PUBLIC_FAST = /Gedaliah|Tevet|Esther|Tamuz|Tammuz|Tish.?a B.?Av|Yom Kippur/i;
  const isFast = Boolean(holidays.some(event => (Number(event?.getFlags?.() || 0) & (flags.MINOR_FAST | flags.MAJOR_FAST)) && PUBLIC_FAST.test(String(event?.getDesc?.() || '')))
    || sourceEvents.some(event => event?.subcat === 'fast' && PUBLIC_FAST.test(String(event?.title || event?.desc || ''))));
  const isYomTov = Boolean(holidayFlags & flags.CHAG);
  const isCholHaMoed = Boolean(holidayFlags & flags.CHOL_HAMOED);
  const additions = [];
  if (roshChodesh) additions.push({ text: 'יעלה ויבוא', kind: 'yaaleh-veyavo', rule: { ...RULES.yaalehVeyavo } });
  if (chanukah || purim) additions.push({ text: 'על הניסים', kind: 'al-hanissim', rule: { ...RULES.alHanissim } });
  if (mashivHaruch(date, prayerType)) additions.push({ text: 'משיב הרוח ומוריד הגשם', kind: 'mashiv-haruach', prayer: prayerType, rule: { ...RULES.mashivHaruch } });
  if (vetenTalUmatar(date, isIsrael, civil, prayerType, tzid, afterSunset)) additions.push({ text: 'ותן טל ומטר לברכה', kind: 'veten-tal-umatar', prayer: prayerType, rule: { ...RULES.vetenTalUmatar } });
  // Full Hallel: Chanukah; Sukkot and Shemini Atzeret / Simchat Torah; the first day of Pesach (two abroad); Shavuot
  // (two abroad). Half Hallel: Rosh Chodesh (not in Chanukah) and the rest of Pesach.
  const diaspora = !isIsrael;
  const fullHallel = chanukah
    || (date.month === months.TISHREI && date.day >= 15 && date.day <= (diaspora ? 23 : 22))
    || (date.month === months.NISAN && (date.day === 15 || (diaspora && date.day === 16)))
    || (date.month === months.SIVAN && (date.day === 6 || (diaspora && date.day === 7)));
  const halfHallel = !fullHallel && (roshChodesh || (date.month === months.NISAN && date.day >= 16 && date.day <= (diaspora ? 22 : 21)));
  const hallel = fullHallel ? 'הלל שלם' : halfHallel ? 'חצי הלל' : null;
  if (hallel) additions.push({ text: hallel, kind: 'hallel', rule: { ...RULES.hallel } });
  // Mincha of Erev Shabbat and of Erev Yom Tov: no Tachanun (the whole afternoon leans into the holy day).
  const tomorrow = new HDate(date.hdate.abs() + 1);
  const erevYomTov = [...(getHolidaysOnDate(tomorrow, isIsrael) || [])].some(event => Number(event?.getFlags?.() || 0) & flags.CHAG) && !isYomTov;
  const omitTachanun = tachanunOmitted(date, shabbat, roshChodesh, chanukah, purim, prayerType)
    || (prayerType === 'mincha' && (dayOfWeek === 5 || erevYomTov));
  const omissions = omitTachanun ? [{ text: 'אין אומרים תחנון', kind: 'tachanun', prayer: prayerType, rule: { ...RULES.tachanun } }] : [];
  if (date.month === months.TISHREI && date.day === 9 && prayerType === 'mincha') additions.push({ text: 'וידוי', kind: 'vidui', prayer: 'mincha', rule: { ...RULES.vidui } });
  // Rosh Hashanah (1 Tishrei) through Yom Kippur (10 Tishrei) inclusive; the verified sunset
  // transition already moves the key to 11 Tishrei once Yom Kippur ends, so this turns off on its own.
  const isAseretYemeiTeshuvah = date.month === months.TISHREI && date.day >= 1 && date.day <= 10;
  const prayerContext = { type: prayerType, additions, omissions, hallel, omitTachanun, fast: isFast, productionApproved: false };
  return {
    civil: civilDate, civilDate, hebrewDate: { day: date.day, month: date.month, year: date.year, label: date.label },
    isIsrael, profile, location: profile.currentLocation, prayerContext, additions, omissions,
    specialDay: holidays[0] || null, holidays, chanukah, purim, isRoshChodesh: roshChodesh, isYomTov, isCholHaMoed, isAseretYemeiTeshuvah,
    seasonal: { mashivHaruch: mashivHaruch(date, prayerType), vetenTalUmatar: vetenTalUmatar(date, isIsrael, civil, prayerType, tzid, afterSunset) },
    torahReading: readingContext(date.hdate, isIsrael, sourceEvents), sourceEvents,
    disputedTravel: false, travelWarnings: [], afterSunset, dateCertainty: verifiedKey ? 'sunset-verified' : 'civil-day-only', key: jewishKey,
    fast: isFast,
  };
}

// The days on which no rite says Tachanun (Shulchan Aruch OC 131:6–7 and the common practice of all four rites here).
// Tachanun IS said between Rosh HaShanah and Yom Kippur; it is not said from Erev Yom Kippur to the end of Tishrei,
// all of Nisan, 1–12 Sivan (Shavuot, its preparation and its Tashlumin), Pesach Sheni, Lag BaOmer, Tisha B'Av, 15 Av,
// 15 Shevat, Purim and Shushan Purim (and Purim Katan in a leap year).
export function tachanunOmitted(date, shabbat, roshChodesh, chanukah, purim, prayerType) {
  if (shabbat || roshChodesh || chanukah || purim || date.month === months.NISAN) return true;
  const { month, day } = date;
  if (month === months.TISHREI && (day <= 2 || day >= 9)) return true;
  if (month === months.SIVAN && day <= 12) return true;
  if (month === months.IYYAR && (day === 14 || day === 18)) return true;
  if (month === months.AV && (day === 9 || day === 15)) return true;
  if (month === months.SHVAT && day === 15) return true;
  if ((month === months.ADAR_I || month === months.ADAR_II) && (day === 14 || day === 15)) return true;
  return false;
}

export const CONTEXT_RULES = RULES;
