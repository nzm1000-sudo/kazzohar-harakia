import test from 'node:test';
import assert from 'node:assert/strict';
import { civilDateKey, civilDateForSolarEngine, jewishDateKey } from '../src/civilDate.mjs';

test('Jewish date advances at the supplied Tel Aviv sunset, not civil midnight', () => {
  const sunset = '2026-09-18T18:43:00+03:00';
  assert.equal(jewishDateKey(new Date('2026-09-18T18:42:59+03:00'), sunset), '2026-09-18');
  assert.equal(jewishDateKey(new Date(sunset), sunset), '2026-09-19');
  assert.equal(jewishDateKey(new Date(sunset), null), null);
});

test('Jerusalem civil midnight advances before UTC midnight in summer', () => {
  assert.equal(civilDateKey(new Date('2026-09-17T20:59:59Z')), '2026-09-17');
  assert.equal(civilDateKey(new Date('2026-09-17T21:00:00Z')), '2026-09-18');
});

test('Jerusalem winter offset is not hardcoded to daylight saving time', () => {
  assert.equal(civilDateKey(new Date('2026-01-01T21:59:59Z')), '2026-01-01');
  assert.equal(civilDateKey(new Date('2026-01-01T22:00:00Z')), '2026-01-02');
});

test('DST transitions retain the correct civil day', () => {
  for (const instant of ['2026-03-27T00:00:00Z', '2026-03-27T01:00:00Z']) {
    assert.equal(civilDateKey(new Date(instant)), '2026-03-27');
  }
});

test('location timezone is explicit and independent of the device', () => {
  const instant = new Date('2026-09-17T22:00:00Z');
  assert.equal(civilDateKey(instant, 'Asia/Jerusalem'), '2026-09-18');
  assert.equal(civilDateKey(instant, 'America/New_York'), '2026-09-17');
});

test('solar adapter preserves leap days and rejects invalid dates', () => {
  assert.equal(civilDateForSolarEngine('2028-02-29').toISOString(), '2028-02-29T00:00:00.000Z');
  for (const key of ['2026-02-29', '2026-13-01', '', '2026-2-1']) {
    assert.throws(() => civilDateForSolarEngine(key), RangeError);
  }
});

test('civil date does not pretend to implement the Jewish sunset boundary', () => {
  assert.equal(civilDateKey(new Date('2026-09-17T18:00:00Z')), '2026-09-17');
});
