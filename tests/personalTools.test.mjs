import test from 'node:test';
import assert from 'node:assert/strict';
import { findNameVerses, hebrewFromGregorian, hebrewFromParts, isHebrewLeapYear, isValidGregorianParts, isValidHebrewParts, nameLetters, parseGregorian, VERSE_INDEX_SIZE } from '../src/services/personalTools.mjs';
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
