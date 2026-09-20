import { HDate, calendar, months } from '@hebcal/core';
import tanakh from '../data/tanakh.json' with { type: 'json' };

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
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  if (!Number.isInteger(Number(day)) || !Number.isInteger(Number(month)) || !Number.isInteger(Number(year)) || date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) throw new RangeError('תאריך לועזי אינו תקין');
  return date;
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
  if (!Number.isInteger(numericDay) || !Number.isInteger(numericMonth) || !Number.isInteger(numericYear) || numericYear < 1) throw new RangeError('תאריך עברי אינו תקין');
  if (numericMonth === months.ADAR_II && !isHebrewLeapYear(numericYear)) throw new RangeError('בשנה פשוטה יש לבחור אדר');
  const hd = new HDate(numericDay, numericMonth, numericYear);
  const date = hd.greg();
  if (!Number.isFinite(date.getTime())) throw new RangeError('תאריך עברי אינו תקין');
  return { day: numericDay, month: numericMonth, year: numericYear, date, label: hd.render('he') };
}

export function formatGregorian(date, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone }).format(date);
}

export function weekdayLabel(date) {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: 'UTC' }).format(date);
}

export function parashaForDate(date, isIsrael = true) {
  const value = date instanceof Date ? date : parseGregorian(date.day, date.month, date.year);
  const year = value.getUTCFullYear();
  const events = calendar({ year, isHebrewYear: false, sedrot: true, il: isIsrael });
  const parashot = events.filter(event => event.constructor.name === 'ParshaEvent');
  const target = new Date(value); target.setUTCHours(12, 0, 0, 0);
  const event = parashot.map(item => ({ item, date: item.getDate().greg() })).find(({ date: itemDate }) => itemDate >= target) || parashot[parashot.length - 1];
  if (!event) return null;
  const shabbat = event.date;
  const hd = new HDate(shabbat);
  return { name: event.item.render('he'), date: shabbat, hebrewDate: hd.render('he'), source: event.item.parsha };
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
