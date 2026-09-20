import { HDate, calendar, months } from '@hebcal/core';
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
    reference: `${book.hebrewName} ${chapter}:${verse}`,
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
  return { day: hd.getDate(), month: hd.getMonth(), year: hd.getFullYear(), date: value, label: hd.render('he') };
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
  return { day: numericDay, month: numericMonth, year: numericYear, date, label: hd.render('he') };
}

export function isValidHebrewParts(day, month, year) {
  try { hebrewFromParts(day, month, year); return true; } catch { return false; }
}

export { formatGregorianDate };
export const formatGregorian = formatGregorianDate;

export function weekdayLabel(date) {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'UTC' }).format(date);
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
  const parashot = dated.filter(({ item, weekday }) => item.constructor.name === 'ParshaEvent' && weekday === 6);
  const specialShabbat = dated.filter(({ item, weekday }) => item.constructor.name === 'HolidayEvent' && weekday === 6 && !/^Erev /.test(item.render('en')));
  const shabbatDates = [...new Set([...parashot, ...specialShabbat].map(({ date }) => date.getTime()))].sort((a, b) => a - b);
  const selectedDate = shabbatDates.find(itemDate => itemDate >= target.getTime()) ?? shabbatDates[shabbatDates.length - 1];
  const special = specialShabbat.find(({ date }) => date.getTime() === selectedDate);
  const regular = parashot.find(({ date }) => date.getTime() === selectedDate);
  const event = special || regular;
  if (!event) return null;
  const hd = event.item.getDate();
  return { name: event.item.render('he'), date: event.date, hebrewDate: hd.render('he'), source: event.item.parsha, special: event.item.constructor.name === 'HolidayEvent', isIsrael };
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
