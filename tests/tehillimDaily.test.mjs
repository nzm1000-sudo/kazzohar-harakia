import test from 'node:test';
import assert from 'node:assert/strict';
import { jewishDateKey } from '../src/civilDate.mjs';
import { dailyTehillimLabel, dailyTehillimTitle, getDailyTehillim } from '../src/tehillimDaily.mjs';

test('daily Tehillim uses the standard monthly division', () => {
  assert.deepEqual(getDailyTehillim(1), { day: 1, start: 1, end: 9, verseStart: 1, verseEnd: null });
  assert.deepEqual(getDailyTehillim(10), { day: 10, start: 55, end: 59, verseStart: 1, verseEnd: null });
  assert.deepEqual(getDailyTehillim(25), { day: 25, start: 119, end: 119, verseStart: 1, verseEnd: 96 });
  assert.deepEqual(getDailyTehillim(26), { day: 26, start: 119, end: 119, verseStart: 97, verseEnd: 176 });
  assert.deepEqual(getDailyTehillim(29), { day: 29, start: 140, end: 144, verseStart: 1, verseEnd: null });
  assert.deepEqual(getDailyTehillim(30), { day: 30, start: 145, end: 150, verseStart: 1, verseEnd: null });
});

test('daily Tehillim renders Hebrew day and range labels', () => {
  assert.equal(dailyTehillimTitle(11), 'תהילים ליום י״א בחודש');
  assert.equal(dailyTehillimLabel(getDailyTehillim(10)), 'פרקים נ״ה–נ״ט');
  assert.equal(dailyTehillimLabel(getDailyTehillim(25)), 'פרק קי״ט · פסוקים א׳–צ״ו');
});

test('daily Tehillim follows the existing sunset Hebrew-date transition', () => {
  const sunset = '2026-09-18T18:43:00+03:00';
  assert.equal(jewishDateKey(new Date('2026-09-18T18:42:59+03:00'), sunset), '2026-09-18');
  assert.equal(jewishDateKey(new Date('2026-09-18T18:43:00+03:00'), sunset), '2026-09-19');
});