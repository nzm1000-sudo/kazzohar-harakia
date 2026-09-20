import { HDate, HolidayEvent, ParshaEvent, RoshHashanaEvent, calendar, months } from '@hebcal/core';
import tanakh from '../data/tanakh.json' with { type: 'json' };
import { formatGregorianDate } from '../civilDate.mjs';

export const PERSONAL_KEYS = Object.freeze({
  profile: 'kz-personal-tools-v1',
});

export const HEBREW_MONTHS = [
  [months.TISHREI, 'תשרי'], [months.CHESHVAN, 'חשון'], [months.KISLEV, 'כסלו'],
  [months.TEVET, 'טבת'], [months.SHVAT, 'שבט'], [months.ADAR_I, 'אדר'],
  [months.NISAN, 'ניסן'], [months.IYYAR, 'אייר'], [months.SIVAN, 'סיון'],
  [months.TAMUZ, 'תמוז'], [months.AV, 'אב'], [months.ELUL, 'אלול'],
];

export function hebrewMonthsForYear(year) {
  if (isHebrewLeapYear(Number(year))) return HEBREW_MONTHS.map(([value, label]) => value === months.ADAR_I ? [value, 'אדר א׳'] : [value, label]).flatMap(item => item[0] === months.ADAR_I ? [item, [months.ADAR_II, 'אדר ב׳']] : [item]);
  return HEBREW_MONTHS;
}

const HEBREW_NUMERAL_LETTERS = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']];
const HEBREW_MONTH_NAMES = new Map([
  [months.TISHREI, 'בתשרי'], [months.CHESHVAN, 'בחשון'], [months.KISLEV, 'בכסלו'], [months.TEVET, 'בטבת'],
  [months.SHVAT, 'בשבט'], [months.ADAR_I, 'באדר א׳'], [months.ADAR_II, 'באדר ב׳'], [months.NISAN, 'בניסן'],
  [months.IYYAR, 'באייר'], [months.SIVAN, 'בסיון'], [months.TAMUZ, 'בתמוז'], [months.AV, 'באב'], [months.ELUL, 'באלול'],
]);

export function hebrewNumeral(value, { year = false } = {}) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) throw new RangeError('מספר עברי אינו תקין');
  let remainder = numeric;
  if (year && remainder >= 1000) remainder %= 1000;
  if (remainder === 15) return 'ט״ו';
  if (remainder === 16) return 'ט״ז';
  let result = '';
  for (const [amount, letter] of HEBREW_NUMERAL_LETTERS) {
    while (remainder >= amount) { result += letter; remainder -= amount; }
  }
  if (!result) result = 'א';
  if (result.length === 1) return `${result}׳`;
  return `${result.slice(0, -1)}״${result.slice(-1)}`;
}

export function formatHebrewDate(day, month, year) {
  const monthName = HEBREW_MONTH_NAMES.get(Number(month));
  if (!monthName) throw new RangeError('חודש עברי אינו תקין');
  return `${hebrewNumeral(day)} ${monthName} ${hebrewNumeral(year, { year: true })}`;
}

export function formatTanakhReference(bookName, chapter, verse) {
  return `${bookName} ${hebrewNumeral(chapter)}, ${hebrewNumeral(verse)}`;
}

const FINAL_LETTERS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const stripMarks = value => String(value || '').replace(/[\u0591-\u05C7]/g, '').replace(/[\u05BE\u05C0\u05C3\u05F3\u05F4\u200C\u200D]/g, '').trim();
const canonicalLetter = value => FINAL_LETTERS[value] || value;

export function normalizeName(value) {
  return stripMarks(value).replace(/[^א-ת]/g, '');
}

export function nameLetters(value) {
  const name = normalizeName(value);
  if (!name) return null;
  return { first: canonicalLetter(name[0]), last: canonicalLetter(name[name.length - 1]) };
}

const bookMap = new Map(tanakh.books.map(book => [book.id, book]));
const verseText = (bookId, chapter, verse) => {
  const entry = bookMap.get(bookId)?.verses.find(item => item[0] === chapter && item[1] === verse);
  return entry?.[2] || '';
};
const verseIndex = tanakh.index.map(([bookId, chapter, verse, first, last]) => {
  const book = bookMap.get(bookId);
  return {
    id: `${bookId}.${chapter}.${verse}`,
    reference: formatTanakhReference(book.hebrewName, chapter, verse),
    sourceReference: `${bookId.replaceAll('_', ' ')} ${chapter}:${verse}`,
    text: verseText(bookId, chapter, verse),
    division: book.division,
    first,
    last,
  };
});

export const VERSE_INDEX_SIZE = verseIndex.length;
export const TANAKH_META = tanakh.meta;

export function findNameVerses(name) {
  const letters = nameLetters(name);
  if (!letters) return [];
  return verseIndex.filter(verse => verse.first === letters.first && verse.last === letters.last);
}

export function getVerseById(id) {
  return verseIndex.find(verse => verse.id === id) || null;
}

export function gregorianDateKey(date) {
  const value = date instanceof Date ? date : new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(value.getTime())) throw new RangeError('תאריך לועזי אינו תקין');
  return value.toISOString().slice(0, 10);
}

export function parseGregorian(day, month, year) {
  const numericDay = Number(day); const numericMonth = Number(month); const numericYear = Number(year);
  if (!Number.isInteger(numericDay) || !Number.isInteger(numericMonth) || !Number.isInteger(numericYear) || numericYear < 1 || numericYear > 9999 || numericMonth < 1 || numericMonth > 12 || numericDay < 1 || numericDay > 31) throw new RangeError('תאריך לועזי אינו תקין');
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay, 12));
  if (date.getUTCFullYear() !== numericYear || date.getUTCMonth() !== numericMonth - 1 || date.getUTCDate() !== numericDay) throw new RangeError('תאריך לועזי אינו תקין');
  return date;
}

export function isValidGregorianParts(day, month, year) {
  try { parseGregorian(day, month, year); return true; } catch { return false; }
}

export function hebrewFromGregorian(date) {
  const value = date instanceof Date ? date : parseGregorian(date.day, date.month, date.year);
  const hd = new HDate(value);
  return { day: hd.getDate(), month: hd.getMonth(), year: hd.getFullYear(), date: value, label: formatHebrewDate(hd.getDate(), hd.getMonth(), hd.getFullYear()) };
}

export function isHebrewLeapYear(year) {
  return ((7 * year + 1) % 19) < 7;
}

export function hebrewFromParts(day, month, year) {
  const numericDay = Number(day); const numericMonth = Number(month); const numericYear = Number(year);
  const validMonths = new Set(HEBREW_MONTHS.map(([value]) => value).concat(months.ADAR_II));
  if (!Number.isInteger(numericDay) || !Number.isInteger(numericMonth) || !Number.isInteger(numericYear) || numericDay < 1 || numericDay > 30 || !validMonths.has(numericMonth) || numericYear < 1) throw new RangeError('תאריך עברי אינו תקין');
  if (numericMonth === months.ADAR_II && !isHebrewLeapYear(numericYear)) throw new RangeError('בשנה פשוטה יש לבחור אדר');
  const hd = new HDate(numericDay, numericMonth, numericYear);
  const date = hd.greg();
  if (!Number.isFinite(date.getTime())) throw new RangeError('תאריך עברי אינו תקין');
  return { day: numericDay, month: numericMonth, year: numericYear, date, label: formatHebrewDate(numericDay, numericMonth, numericYear) };
}

export function isValidHebrewParts(day, month, year) {
  try { hebrewFromParts(day, month, year); return true; } catch { return false; }
}

export { formatGregorianDate };
export const formatGregorian = formatGregorianDate;

export function weekdayLabel(date) {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'UTC' }).format(date);
}

const SPECIAL_SHABBAT_READINGS = Object.freeze({
  'Shabbat Shekalim': { maftirRef: 'Exodus 30:11-16', haftaraRef: 'II Kings 12:1-17' },
  'Shabbat Zachor': { maftirRef: 'Deuteronomy 25:17-19', haftaraRef: 'I Samuel 15:2-34' },
  'Shabbat Parah': { maftirRef: 'Numbers 19:1-22', haftaraRef: 'Ezekiel 36:16-38' },
  'Shabbat HaChodesh': { maftirRef: 'Exodus 12:1-20', haftaraRef: 'Ezekiel 45:16-46:18' },
  'Shabbat HaGadol': { haftaraRef: 'Malachi 3:4-24' },
  'Shabbat Shuva': { haftaraRef: 'Hosea 14:2-10' },
});

const HOLIDAY_READING_REFS = Object.freeze([
  [/^Pesach/, 'Exodus 13:17-15:26'],
  [/^Sukkot/, 'Leviticus 22:26-23:44'],
  [/^Shavuot/, 'Exodus 19:1-20:23'],
  [/^Yom Kippur/, 'Leviticus 16:1-34'],
  [/^Rosh Hashana/, 'Genesis 21:1-34'],
]);

function holidaySourceRef(desc) {
  return HOLIDAY_READING_REFS.find(([pattern]) => pattern.test(desc))?.[1] || null;
}

export function parashaForDate(date, isIsrael = true) {
  const value = date instanceof Date ? date : parseGregorian(date.day, date.month, date.year);
  const year = value.getUTCFullYear();
  const events = calendar({ year, isHebrewYear: false, sedrot: true, il: isIsrael });
  const target = new Date(value); target.setUTCHours(12, 0, 0, 0);
  const dated = events.map(item => {
    const greg = item.getDate().greg();
    const civilDate = parseGregorian(greg.getDate(), greg.getMonth() + 1, greg.getFullYear());
    return { item, date: civilDate, weekday: greg.getDay() };
  });
  const parashot = dated.filter(({ item, weekday }) => item instanceof ParshaEvent && weekday === 6);
  const specialShabbat = dated.filter(({ item, weekday }) => {
    if (weekday !== 6) return false;
    return item instanceof HolidayEvent && Boolean(SPECIAL_SHABBAT_READINGS[item.desc]);
  });
  const holidayEvents = dated.filter(({ item, weekday }) => {
    if (weekday !== 6 || /^Erev /.test(item.render('en'))) return false;
    return (item instanceof HolidayEvent || item instanceof RoshHashanaEvent) && !(item instanceof HolidayEvent && SPECIAL_SHABBAT_READINGS[item.desc]);
  });
  const holidayReadings = holidayEvents.filter(({ item }) => holidaySourceRef(item.desc));
  const shabbatDates = [...new Set([...parashot, ...specialShabbat, ...holidayReadings].map(({ date }) => date.getTime()))].sort((a, b) => a - b);
  const selectedDate = shabbatDates.find(itemDate => itemDate >= target.getTime()) ?? shabbatDates[shabbatDates.length - 1];
  const special = specialShabbat.find(({ date }) => date.getTime() === selectedDate);
  const regular = parashot.find(({ date }) => date.getTime() === selectedDate);
  const holiday = holidayReadings.find(({ date }) => date.getTime() === selectedDate);
  if (!regular && !holiday) return null;
  const event = regular || holiday;
  const hd = event.item.getDate();
  const specialData = special ? SPECIAL_SHABBAT_READINGS[special.item.desc] || {} : null;
  const specialName = special ? special.item.render('he') : null;
  return {
    name: regular?.item.render('he') || holiday.item.render('he'),
    date: event.date,
    hebrewDate: formatHebrewDate(hd.getDate(), hd.getMonth(), hd.getFullYear()),
    source: regular?.item.parsha,
    sourceRef: regular?.item.parsha?.length ? `Parashat ${regular.item.parsha.join('-')}` : null,
    special: Boolean(special),
    specialShabbat: special ? { name: specialName, maftirRef: specialData?.maftirRef || null, haftaraRef: specialData?.haftaraRef || null } : null,
    holidayReading: holiday ? { name: holiday.item.render('he'), sourceRef: holidaySourceRef(holiday.item.desc) } : null,
    isIsrael,
  };
}

export function loadPersonalProfile() {
  try { return JSON.parse(localStorage.getItem(PERSONAL_KEYS.profile) || '{}'); } catch { return {}; }
}

export function savePersonalProfile(profile) {
  try { localStorage.setItem(PERSONAL_KEYS.profile, JSON.stringify(profile)); } catch {}
}

export function shareText(text) {
  if (navigator.share) return navigator.share({ text }).catch(() => {});
  return navigator.clipboard?.writeText(text).catch(() => {});
}

export { HDate, months };
