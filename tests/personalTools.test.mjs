import test from 'node:test';
import assert from 'node:assert/strict';
import { findNameVerses, formatHebrewDate, formatTanakhReference, getVerseById, hebrewFromGregorian, hebrewFromParts, isHebrewLeapYear, isValidGregorianParts, isValidHebrewParts, nameLetters, parseGregorian, parashaForDate, VERSE_INDEX_SIZE, months } from '../src/services/personalTools.mjs';
import { formatGregorianDate } from '../src/civilDate.mjs';
import tanakh from '../src/data/tanakh.json' with { type: 'json' };

test('Gregorian to Hebrew conversion is stable', () => {
  const result = hebrewFromGregorian(parseGregorian(18, 9, 2026));
  assert.equal(result.day, 7);
  assert.equal(result.year, 5787);
});
test('Hebrew to Gregorian conversion round-trips', () => {
  const hebrew = hebrewFromParts(7, 7, 5787);
  const civil = hebrewFromGregorian(hebrew.date);
  assert.deepEqual({ day: civil.day, month: civil.month, year: civil.year }, { day: 7, month: 7, year: 5787 });
});
test('Hebrew to Gregorian yields a UTC-noon date so UTC formatters show the correct civil day in any host timezone', () => {
  // 1 Tishrei 5787 is Saturday 12 September 2026. Before the fix, hosts east of UTC displayed Friday 11.9.2026.
  const roshHashana = hebrewFromParts(1, 7, 5787);
  assert.equal(roshHashana.date.getUTCHours(), 12);
  assert.equal(formatGregorianDate(roshHashana.date), '12.9.2026');
  assert.equal(new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(roshHashana.date), 'Saturday');
  assert.equal(roshHashana.date.getTime(), parseGregorian(12, 9, 2026).getTime());
});
test('Gregorian dates use unpadded day.month.year formatting', () => {
  assert.equal(formatGregorianDate('1983-05-06'), '6.5.1983');
  assert.equal(formatGregorianDate('2026-09-18'), '18.9.2026');
  assert.equal(formatGregorianDate('2027-01-01'), '1.1.2027');
});

test('Hebrew dates use Jewish letter numerals and natural month prefixes', () => {
  assert.equal(formatHebrewDate(23, months.IYYAR, 5743), 'כ״ג באייר תשמ״ג');
  assert.equal(formatHebrewDate(15, months.SHVAT, 5786), 'ט״ו בשבט תשפ״ו');
  assert.equal(formatHebrewDate(16, months.SHVAT, 5786), 'ט״ז בשבט תשפ״ו');
});

test('Tanakh references use Hebrew chapter and verse numerals', () => {
  assert.equal(formatTanakhReference('תהילים', 30, 11), 'תהילים ל׳, י״א');
  assert.equal(formatTanakhReference('תהילים', 31, 7), 'תהילים ל״א, ז׳');
  assert.equal(formatTanakhReference('תהילים', 35, 24), 'תהילים ל״ה, כ״ד');
  assert.equal(formatTanakhReference('תהילים', 15, 16), 'תהילים ט״ו, ט״ז');
  assert.equal(formatTanakhReference('תהילים', 150, 15), 'תהילים ק״נ, ט״ו');
  assert.deepEqual(getVerseById('Psalms.30.11'), { ...getVerseById('Psalms.30.11'), reference: 'תהילים ל׳, י״א', sourceReference: 'Psalms 30:11' });
});

test('Hebrew leap-year month validation distinguishes Adar I and II', () => {
  assert.equal(isHebrewLeapYear(5787), true);
  assert.doesNotThrow(() => hebrewFromParts(1, 12, 5787));
  assert.doesNotThrow(() => hebrewFromParts(1, 13, 5787));
  assert.throws(() => hebrewFromParts(1, 13, 5786));
});

test('date validity stays false for partial, empty, and impossible inputs', () => {
  assert.equal(isValidGregorianParts('', '', ''), false);
  assert.equal(isValidGregorianParts('1', '1', '20'), false);
  assert.equal(isValidGregorianParts('31', '2', '2026'), false);
  assert.equal(isValidHebrewParts('', 7, 5787), false);
  assert.equal(isValidHebrewParts(1, 13, 5786), false);
  assert.equal(isValidHebrewParts(1, 7, 5787), true);
});

test('Hebrew final letters normalize for name matching', () => {
  assert.deepEqual(nameLetters('  שָׁלוֹם  '), { first: 'ש', last: 'מ' });
  assert.deepEqual(nameLetters('ברוך'), { first: 'ב', last: 'כ' });
});

test('verse search returns exact local source text and no invented fallback', () => {
  const matches = findNameVerses('שלום');
  assert.ok(matches.length > 0);
  assert.ok(matches.every(match => tanakh.books.some(book => book.verses.some(([chapter, verse, text]) => match.text === text && match.id === `${book.id}.${chapter}.${verse}`))));
  assert.deepEqual(findNameVerses('קק'), []);
});

test('full local corpus covers Torah, Neviim, and Ketuvim exactly', () => {
  assert.equal(VERSE_INDEX_SIZE, 23213);
  assert.deepEqual(new Set(tanakh.books.map(book => book.division)), new Set(['Torah', 'Neviim', 'Ketuvim']));
  assert.equal(findNameVerses('בץ').some(match => match.id === 'Genesis.1.1'), true);
  assert.equal(findNameVerses('ויי').some(match => match.id === 'Isaiah.6.8'), true);
  assert.equal(findNameVerses('מר').some(match => match.id === 'Psalms.23.1'), true);
});

test('matching ignores nikud, cantillation, punctuation, and final letters', () => {
  assert.deepEqual(nameLetters('שָׁל֥וֹם־'), { first: 'ש', last: 'מ' });
  assert.ok(findNameVerses('בְּרוּךְ־').length > 0);
});

test('common letter pairs return multiple full-Tanakh matches', () => {
  assert.ok(findNameVerses('שמ').length > 1);
});

test('06.05.1983 resolves to the upcoming Israel Shabbat parasha', () => {
  const result = parashaForDate(parseGregorian(6, 5, 1983), true);
  assert.equal(result.name, 'פָּרָשַׁת בְּהַר־בְּחֻקֹּתַי');
  assert.equal(formatGregorianDate(result.date), '7.5.1983');
  assert.equal(result.hebrewDate, 'כ״ד באייר תשמ״ג');
  assert.ok(parashaForDate(parseGregorian(6, 5, 1983), false));
  assert.equal(parashaForDate(parseGregorian(7, 5, 1983), true).name, result.name);
  assert.equal(parashaForDate(parseGregorian(8, 5, 1983), true).name, 'פָּרָשַׁת בְּמִדְבַּר');
});

test('special Shabbat keeps the weekly parasha primary and exposes canonical readings', () => {
  const result = parashaForDate(parseGregorian(13, 2, 2026), true);
  assert.equal(result.name, 'פָּרָשַׁת מִשְׁפָּטִים');
  assert.equal(result.sourceRef, 'Parashat Mishpatim');
  assert.equal(result.specialShabbat.name, 'שַׁבַּת שְׁקָלִים');
  assert.equal(result.specialShabbat.maftirRef, 'Exodus 30:11-16');
  assert.equal(result.specialShabbat.haftaraRef, 'II Kings 12:1-17');
});

test('the four special Shabbat designations never replace the weekly parasha', () => {
  const cases = [
    [27, 2, 2026, 'שַׁבַּת זָכוֹר'],
    [6, 3, 2026, 'שַׁבַּת פָּרָה'],
    [13, 3, 2026, 'שַׁבַּת הַחֹדֶשׁ'],
    [27, 3, 2026, 'שַׁבַּת הַגָּדוֹל'],
  ];
  for (const [day, month, year, specialName] of cases) {
    const result = parashaForDate(parseGregorian(day, month, year), true);
    assert.ok(result.sourceRef);
    assert.equal(result.specialShabbat.name, specialName);
  }
});

test('Rosh Chodesh and Chanukah retain a weekly parasha', () => {
  const roshChodesh = parashaForDate(parseGregorian(17, 4, 2026), true);
  assert.equal(roshChodesh.name, 'פָּרָשַׁת תַזְרִיעַ־מְצֹרָע');
  const chanukah = parashaForDate(parseGregorian(4, 12, 2026), true);
  assert.equal(chanukah.name, 'פָּרָשַׁת וַיֵּשֶׁב');
});

test('festival Shabbat exposes a holiday reading without inventing a weekly parasha', () => {
  const result = parashaForDate(parseGregorian(3, 4, 2026), true);
  assert.equal(result.sourceRef, null);
  assert.equal(result.holidayReading.sourceRef, 'Exodus 13:17-15:26');
});

test('Israel and diaspora calendar selection remains distinct', () => {
  const israel = parashaForDate(parseGregorian(22, 5, 2026), true);
  const diaspora = parashaForDate(parseGregorian(22, 5, 2026), false);
  assert.notEqual(israel.sourceRef, diaspora.sourceRef);
  assert.equal(diaspora.holidayReading.sourceRef, 'Exodus 19:1-20:23');
});
