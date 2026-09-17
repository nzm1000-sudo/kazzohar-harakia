import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { halachot, prayers, matches, normalizeHebrew, hebrewNumber, psalmIndex } from '../src/content.mjs';

const tehillim = JSON.parse(readFileSync(new URL('../src/data/tehillim.json', import.meta.url), 'utf8'));

test('Tehillim data holds all 150 public-domain chapters', () => {
  assert.equal(tehillim.chapters.length, 150);
  assert.equal(tehillim.meta.license, 'Public Domain');
  assert.ok(tehillim.chapters[0][0].startsWith('אַשְׁרֵי'));
});

test('chapter verse counts match the received source', () => {
  assert.equal(tehillim.chapters[116].length, 2);   // פרק קי"ז
  assert.equal(tehillim.chapters[118].length, 176); // פרק קי"ט
  for (const [i, chapter] of tehillim.chapters.entries()) {
    assert.ok(chapter.length >= 2, `chapter ${i + 1} too short`);
    assert.ok(!chapter.some(v => /[<>]|&[a-z]+;/.test(v)), `markup leaked in chapter ${i + 1}`);
  }
});

test('library search answers the requested Hebrew queries', () => {
  const find = q => halachot.filter(r => matches(r, q)).map(r => r.id);
  assert.ok(find('בורא נפשות').includes('nefashot'));
  assert.ok(find('תפילת הדרך').includes('travel'));
  assert.ok(find('מוקצה').includes('muktzeh'));
  assert.ok(find('קפה').includes('berachot'));
  assert.ok(find('מה מברכים על בננה').includes('fruit'));
  assert.ok(prayers.filter(r => matches(r, 'יעלה ויבוא')).length >= 1);
  assert.ok(psalmIndex.filter(p => matches(p, 'תהילים קכא')).some(p => p.chapter === 121));
});

test('hebrew numerals render correctly for psalm titles', () => {
  assert.equal(hebrewNumber(15), 'טו');
  assert.equal(hebrewNumber(16), 'טז');
  assert.equal(hebrewNumber(121), 'קכא');
  assert.equal(hebrewNumber(150), 'קנ');
});

function chapters() {} // guard: real assertion above uses local binding
