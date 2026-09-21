import test from 'node:test';
import assert from 'node:assert/strict';
import { psalmIndex } from '../src/content.mjs';
import { dailyTehillimLabel } from '../src/tehillimDaily.mjs';
import { formatTehillimChapter, tehillimResumeTitle, tehillimTitle } from '../src/services/tehillimPresentation.mjs';

test('Tehillim chapters use conventional Hebrew numerals', () => {
  const expected = {
    1: 'א׳', 9: 'ט׳', 10: 'י׳', 12: 'י״ב', 15: 'ט״ו', 16: 'ט״ז',
    18: 'י״ח', 42: 'מ״ב', 100: 'ק׳', 119: 'קי״ט', 150: 'ק״נ',
  };
  for (const [chapter, label] of Object.entries(expected)) assert.equal(formatTehillimChapter(Number(chapter)), label);
});

test('all 150 Psalm index titles use Hebrew chapter presentation', () => {
  assert.equal(psalmIndex.length, 150);
  assert.equal(psalmIndex[11].title, 'תהילים י״ב');
  assert.equal(psalmIndex[149].title, 'תהילים ק״נ');
  assert.ok(psalmIndex.every(item => !item.title.match(/תהילים \d/)));
});

test('daily labels use Hebrew chapter and verse numerals', () => {
  assert.equal(dailyTehillimLabel({ start: 12, end: 12, verseStart: 1, verseEnd: null }), 'פרק י״ב');
  assert.equal(dailyTehillimLabel({ start: 119, end: 119, verseStart: 97, verseEnd: 176 }), 'פרק קי״ט · פסוקים צ״ז–קע״ו');
});

test('resume presentation hides internal numeric chapter references', () => {
  assert.equal(tehillimResumeTitle({ source: 'tehillim', title: 'תהילים פרק 12', reference: 'chapter/12' }), 'תהילים פרק י״ב');
  assert.equal(tehillimResumeTitle({ source: 'tehillim', title: '', reference: 'chapter/150' }), 'תהילים פרק ק״נ');
  assert.equal(tehillimTitle(42), 'תהילים פרק מ״ב');
  assert.equal(tehillimResumeTitle({ source: 'tehillim', title: 'תהילים פרק י״ב', reference: 'chapter/12' }).includes('chapter/'), false);
});
