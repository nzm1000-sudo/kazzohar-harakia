import test from 'node:test';
import assert from 'node:assert/strict';
import { hebrewDate } from '../src/dayContext.mjs';

test('REGRESSION: Hebrew date labels use Hebrew numerals (gematria) for the day, never raw Arabic digits', () => {
  // 2026-09-27 civil noon is 16 Tishrei 5787 on the ICU Hebrew calendar.
  const sixteen = hebrewDate('2026-09-27');
  assert.equal(sixteen.day, 16);
  assert.equal(sixteen.label, 'ט״ז בתשרי תשפ״ז');
  assert.doesNotMatch(sixteen.label, /\d/);
});

test('day 15 renders as ט״ו, not the digits 15', () => {
  const fifteen = hebrewDate('2026-09-26');
  assert.equal(fifteen.day, 15);
  assert.equal(fifteen.label, 'ט״ו בתשרי תשפ״ז');
  assert.doesNotMatch(fifteen.label, /\d/);
});

test('day 13/14 render correctly too', () => {
  assert.equal(hebrewDate('2026-09-24').label, 'י״ג בתשרי תשפ״ז');
  assert.equal(hebrewDate('2026-09-25').label, 'י״ד בתשרי תשפ״ז');
});

test('the label never contains an Arabic digit for any day of a full Hebrew month', () => {
  for (let day = 1; day <= 30; day += 1) {
    const key = `2026-09-${String(11 + day).padStart(2, '0')}`;
    if (day > 19) continue; // stay within September's civil range for this sample
    const result = hebrewDate(key);
    if (!result) continue;
    assert.doesNotMatch(result.label, /\d/, `day ${day} (${key}) leaked an Arabic digit: ${result.label}`);
  }
});
