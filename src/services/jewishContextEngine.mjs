import { HDate, getHolidaysOnDate, getSedra, months } from '@hebcal/core';

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
  mashivHaruch: { id: 'prayer.mashiv-haruach', topic: 'seasonal', source: 'Shulchan Arukh, Orach Chayim 114', ...SOURCE_REVIEW },
  vetenTalUmatar: { id: 'prayer.veten-tal-umatar', topic: 'seasonal', source: 'Shulchan Arukh, Orach Chayim 117', ...SOURCE_REVIEW },
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
  return { day: hdate.getDate(), month: hdate.getMonth(), year: hdate.getFullYear(), hdate,
    label: `${hdate.getDate()} ${hebrewMonths.get(hdate.getMonth()) || ''} ${hdate.getFullYear()}`.trim() };
}

function isRoshChodesh(date) { return date.day === 1 || date.day === 30; }
function isChanukah(date) { return (date.month === months.KISLEV && date.day >= 25) || (date.month === months.TEVET && date.day <= 2); }
function isPurim(date) { return (date.month === months.ADAR_I || date.month === months.ADAR_II) && (date.day === 14 || date.day === 15); }
function isMajorHoliday(date) {
  return (date.month === months.TISHREI && [1, 2, 10, 15, 16, 21, 22, 23].includes(date.day))
    || (date.month === months.NISAN && date.day >= 15 && date.day <= 22)
    || (date.month === months.SIVAN && date.day === 6);
}
function mashivHaruch(date) {
  if (date.month === months.TISHREI && date.day >= 22) return true;
  if (date.month === months.NISAN) return date.day < 15;
  return [months.TISHREI, months.CHESHVAN, months.KISLEV, months.TEVET, months.SHVAT, months.ADAR_I, months.ADAR_II].includes(date.month);
}
function vetenTalUmatar(date, isIsrael, civil) {
  if (isIsrael) {
    if (date.month === months.CHESHVAN && date.day >= 7) return true;
    return date.month > months.CHESHVAN && date.month < months.NISAN;
  }
  const year = civil.getUTCFullYear();
  const startDay = isLeapGregorianYear(year + 1) ? 4 : 5;
  return civil.getTime() >= Date.UTC(year, 11, startDay, 12);
}

function readingContext(hdate, isIsrael, sourceEvents) {
  const sedra = getSedra(hdate.getFullYear(), isIsrael).lookup(hdate);
  const event = sourceEvents.find(item => item.category === 'parashat' || item.t === 'parashat');
  if (!event && !sedra?.parsha?.length) return null;
  return {
    name: event?.hebrew || event?.title || sedra.parsha.join('–'),
    sourceRef: event?.leyning?.torah || null,
    maftir: event?.leyning?.maftir || null,
    haftara: event?.leyning?.haftarah_sephardic || event?.leyning?.haftara || null,
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
  const civilDate = new Intl.DateTimeFormat('en-CA', { timeZone: tzid, year: 'numeric', month: '2-digit', day: '2-digit' }).format(civil);
  const sunset = times?.sunset ? new Date(times.sunset) : null;
  const jewishCivil = sunset && civil >= sunset ? new Date(civil.getTime() + 86400000) : civil;
  const date = hebrewDateParts(jewishCivil);
  const holidays = (getHolidaysOnDate(date.hdate, isIsrael) || []).filter(event => !eventCategories(event).includes('hebdate'));
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tzid, weekday: 'short' }).format(civil);
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const chanukah = isChanukah(date);
  const purim = isPurim(date);
  const roshChodesh = isRoshChodesh(date);
  const shabbat = dayOfWeek === 6;
  const sourceEvents = items.filter(event => event.date?.slice?.(0, 10) === civilDate);
  const additions = [];
  if (roshChodesh) additions.push({ text: 'יעלה ויבוא', kind: 'yaaleh-veyavo', rule: { ...RULES.yaalehVeyavo } });
  if (chanukah || purim) additions.push({ text: 'על הניסים', kind: 'al-hanissim', rule: { ...RULES.alHanissim } });
  if (mashivHaruch(date)) additions.push({ text: 'משיב הרוח ומוריד הגשם', kind: 'mashiv-haruach', rule: { ...RULES.mashivHaruch } });
  if (vetenTalUmatar(date, isIsrael, civil)) additions.push({ text: 'ותן טל ומטר לברכה', kind: 'veten-tal-umatar', rule: { ...RULES.vetenTalUmatar } });
  const fullHallel = chanukah || (date.month === months.TISHREI && date.day >= 15 && date.day <= 21) || (date.month === months.NISAN && date.day === 15) || (date.month === months.SIVAN && date.day === 6);
  const halfHallel = roshChodesh || (date.month === months.NISAN && date.day >= 16 && date.day <= 21);
  const hallel = fullHallel ? 'הלל שלם' : halfHallel ? 'חצי הלל' : null;
  if (hallel) additions.push({ text: hallel, kind: 'hallel', rule: { ...RULES.hallel } });
  const omitTachanun = shabbat || roshChodesh || chanukah || purim || isMajorHoliday(date);
  const omissions = omitTachanun ? [{ text: 'אין אומרים תחנון', kind: 'tachanun', rule: { ...RULES.tachanun } }] : [];
  const prayerContext = { type: prayerType, additions, omissions, hallel, omitTachanun, productionApproved: false };
  return {
    civil: civilDate, civilDate, hebrewDate: { day: date.day, month: date.month, year: date.year, label: date.label },
    isIsrael, profile, location: profile.currentLocation, prayerContext, additions, omissions,
    specialDay: holidays[0] || null, holidays, chanukah, purim, isRoshChodesh: roshChodesh,
    seasonal: { mashivHaruch: mashivHaruch(date), vetenTalUmatar: vetenTalUmatar(date, isIsrael, civil) },
    torahReading: readingContext(date.hdate, isIsrael, sourceEvents), sourceEvents,
    disputedTravel: false, travelWarnings: [], afterSunset: Boolean(sunset && civil >= sunset), key: civilDate,
  };
}

export const CONTEXT_RULES = RULES;