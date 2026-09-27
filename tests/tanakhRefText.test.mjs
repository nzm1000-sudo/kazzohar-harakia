// Tanakh references read book-and-chapter first: each verse number after its comma is a step smaller, everywhere a
// Tanakh reference is shown — and only there (halacha titles with commas keep their size).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatTanakhReferences, isTanakhReference } from '../src/services/tanakhReferences.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const VERSE = /(, [^\s·–,]+)/;

test('the verse parts are exactly the numbers after each comma', () => {
  const text = formatTanakhReferences('Deuteronomy 33:1-34:12; Genesis 1:1-2:3; Numbers 29:35-30:1; Ecclesiastes 1:1-12:14');
  assert.equal(text, 'דברים ל״ג, א׳–ל״ד, י״ב · בראשית א׳, א׳–ב׳, ג׳ · במדבר כ״ט, ל״ה–ל׳, א׳ · קהלת א׳, א׳–י״ב, י״ד');
  const verses = text.split(VERSE).filter(part => part.startsWith(', ')).map(part => part.slice(2));
  assert.deepEqual(verses, ['א׳', 'י״ב', 'א׳', 'ג׳', 'ל״ה', 'א׳', 'א׳', 'י״ד']);
  assert.equal(formatTanakhReferences('I Samuel 20:18-42'), 'שמואל א כ׳, י״ח–מ״ב');
});

test('only Tanakh references are recognised', () => {
  assert.equal(isTanakhReference('Deuteronomy 33:1-34:12; Genesis 1:1-2:3'), true);
  assert.equal(isTanakhReference('I Samuel 20:18-42'), true);
  assert.equal(isTanakhReference('Esther 1'), true);
  assert.equal(isTanakhReference('Shulchan Arukh, Orach Chayim 1:1'), false);
  assert.equal(isTanakhReference('Siddur Edot HaMizrach, Rosh Hodesh, Hallel'), false);
});

test('applied wherever Tanakh references are shown', () => {
  assert.match(read('../src/components/TanakhRefText.jsx'), /<span className="ref-verse">\{part\.slice\(2\)\}<\/span>/);
  assert.match(read('../src/pages/BooksPage.jsx'), /const displayReference = reference => <TanakhRefText text=\{formatTanakhReferences\(reference\)\} \/>;/);
  assert.match(read('../src/pages/ShabbatPage.jsx'), /<TanakhRefText text=\{formatTanakhReferences\(reading\.haftara\)\} \/>/);
  assert.match(read('../src/pages/PreparationHub.jsx'), /\['קריאת התורה', refNode\(reading\.torah\)\]/);
  assert.match(read('../src/pages/ShnayimMikra.jsx'), /<strong><TanakhRefText text=\{verse\.label\} \/><\/strong>/);
  assert.equal((read('../src/pages/PersonalTools.jsx').match(/<strong><TanakhRefText text=\{verse\.reference\} \/><\/strong>/g) || []).length, 2);
  assert.match(read('../src/components/SourceReader.jsx'), /\{isTanakhReference\(reference\) \? <TanakhRefText text=\{displayTitle\} \/> : displayTitle\}/);
  // Verse numbers stay the same size as book and chapter.
  assert.match(read('../src/styles/base.css'), /\.tanakh-ref \.ref-verse\{font-size:inherit\}/);
});

test('a reading of several parts: a row per part, bold parasha or book name, its own arrow, hairlines between', () => {
  const books = read('../src/pages/BooksPage.jsx');
  assert.match(books, /<ReadingList refs=\{splitReference\(reading\.torah\)\} openSource=\{openSource\}\/>/);
  assert.match(books, /<button key=\{ref\} type="button" className="reading-item" onClick=\{\(\) => openSource\(ref,/);
  assert.match(books, /return parasha \? `פרשת \$\{parasha\.he\}` :/);
  assert.match(read('../src/styles/base.css'), /\.reading-item\+\.reading-item\{box-shadow:inset 0 1px 0 /);
});
