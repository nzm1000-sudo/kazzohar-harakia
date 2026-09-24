import { HDate, flags, getHolidaysOnDate, months } from '@hebcal/core';
import { civilDateKey, jewishDateKey } from '../civilDate.mjs';
import { civilKeyAsLocalDate } from './calendarAccuracy.mjs';

export const NUSACH = Object.freeze({ EDOT_HAMIZRACH: 'edot-hamizrach' });
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

function isRoshChodesh(date) { return date.month !== months.TISHREI && (date.day === 1 || date.day === 30); }
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
    return date.day === 22 && ['mussaf', 'mincha', 'maariv'].includes(prayerType);
  }
  if (date.month === months.NISAN) {
    if (date.day < 15) return true;
    return date.day === 15 && prayerType === 'shacharit';
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
    nusach: settings.nusach || NUSACH.EDOT_HAMIZRACH,
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
  const isFast = Boolean((holidayFlags & (flags.MINOR_FAST | flags.MAJOR_FAST))
    || sourceEvents.some(event => event?.subcat === 'fast'));
  const isYomTov = Boolean(holidayFlags & flags.CHAG);
  const isCholHaMoed = Boolean(holidayFlags & flags.CHOL_HAMOED);
  const additions = [];
  if (roshChodesh) additions.push({ text: 'יעלה ויבוא', kind: 'yaaleh-veyavo', rule: { ...RULES.yaalehVeyavo } });
  if (chanukah || purim) additions.push({ text: 'על הניסים', kind: 'al-hanissim', rule: { ...RULES.alHanissim } });
  if (mashivHaruch(date, prayerType)) additions.push({ text: 'משיב הרוח ומוריד הגשם', kind: 'mashiv-haruach', prayer: prayerType, rule: { ...RULES.mashivHaruch } });
  if (vetenTalUmatar(date, isIsrael, civil, prayerType, tzid, afterSunset)) additions.push({ text: 'ותן טל ומטר לברכה', kind: 'veten-tal-umatar', prayer: prayerType, rule: { ...RULES.vetenTalUmatar } });
  const fullHallel = chanukah || (date.month === months.TISHREI && date.day >= 15 && date.day <= 21) || (date.month === months.NISAN && date.day === 15) || (date.month === months.SIVAN && date.day === 6);
  const halfHallel = roshChodesh || (date.month === months.NISAN && date.day >= 16 && date.day <= 21);
  const hallel = fullHallel ? 'הלל שלם' : halfHallel ? 'חצי הלל' : null;
  if (hallel) additions.push({ text: hallel, kind: 'hallel', rule: { ...RULES.hallel } });
  const omitTachanun = tachanunOmitted(date, shabbat, roshChodesh, chanukah, purim, prayerType);
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

function tachanunOmitted(date, shabbat, roshChodesh, chanukah, purim, prayerType) {
  if (shabbat || roshChodesh || chanukah || purim || date.month === months.NISAN) return true;
  if (date.month === months.TISHREI && date.day >= 1 && date.day <= 23) return true;
  if (date.month === months.SIVAN && date.day === 7) return true;
  return false;
}

export const CONTEXT_RULES = RULES;
