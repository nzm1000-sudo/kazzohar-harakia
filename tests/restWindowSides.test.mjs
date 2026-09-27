// Beside "המעגל הרוחני": the next (or current) Shabbat / Yom Tov window from real candle-lighting and havdalah.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextRestWindow } from '../src/services/notificationEngine.mjs';

// Literal Hebcal-shaped items (Jerusalem, Sukkot 5787 → Bereshit).
const items = [
  { date: '2026-10-02T18:02:00+03:00', category: 'candles', title: 'Candle lighting: 18:02', memo: 'Sukkot VII (Hoshana Raba)' },
  { date: '2026-10-03', category: 'holiday', title: 'Shmini Atzeret', hebrew: 'שמיני עצרת', yomtov: true },
  { date: '2026-10-03T18:58:00+03:00', category: 'havdalah', title: 'Havdalah: 18:58' },
  { date: '2026-10-09T17:54:00+03:00', category: 'candles', title: 'Candle lighting: 17:54' },
  { date: '2026-10-10', category: 'parashat', title: 'Parashat Bereshit', hebrew: 'פרשת בראשית' },
  { date: '2026-10-10T18:49:00+03:00', category: 'havdalah', title: 'Havdalah: 18:49' },
];

test('before a festival that falls on Shabbat: one window, named by the festival', () => {
  assert.deepEqual(nextRestWindow(items, new Date('2026-09-27T09:00:00+03:00')), { kind: 'yom-tov', start: '2026-10-02T15:02:00.000Z', end: '2026-10-03T15:58:00.000Z', name: 'שמיני עצרת' });
});

test('during the festival the current window stays; after havdalah the next Shabbat with its parasha', () => {
  assert.equal(nextRestWindow(items, new Date('2026-10-03T10:00:00+03:00')).name, 'שמיני עצרת');
  assert.deepEqual(nextRestWindow(items, new Date('2026-10-03T19:30:00+03:00')), { kind: 'shabbat', start: '2026-10-09T14:54:00.000Z', end: '2026-10-10T15:49:00.000Z', name: 'פרשת בראשית' });
});

test('two-day Yom Tov: from the first candle lighting to the final havdalah (the second-night candles do not split it)', () => {
  const twoDay = [
    { date: '2027-06-10T19:30:00+03:00', category: 'candles' },
    { date: '2027-06-11', category: 'holiday', hebrew: 'שבועות א׳', yomtov: true },
    { date: '2027-06-11T20:38:00+03:00', category: 'candles' },
    { date: '2027-06-12T20:39:00+03:00', category: 'havdalah' },
  ];
  const window = nextRestWindow(twoDay, new Date('2027-06-09T12:00:00+03:00'));
  assert.equal(window.start, '2027-06-10T16:30:00.000Z');
  assert.equal(window.end, '2027-06-12T17:39:00.000Z');
});

test('no data → nothing shown (never an invented time)', () => {
  assert.equal(nextRestWindow([], new Date()), null);
  assert.equal(nextRestWindow(items, new Date('2026-12-01T12:00:00+02:00')), null);
});

test('Today shows the two sides symmetrically around the ring', () => {
  const today = readFileSync(new URL('../src/pages/TodayPage.jsx', import.meta.url), 'utf8');
  assert.match(today, /<Side side=\{sides\?\.start\}[\s\S]*<div className="spiritual-circle-core">[\s\S]*<Side side=\{sides\?\.end\}/);
  assert.match(today, /kicker: shabbat \? 'כניסת שבת' : 'כניסת החג'/);
  assert.match(today, /kicker: shabbat \? 'יציאת שבת' : 'צאת החג'/);
  const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
  assert.match(css, /\.spiritual-circle\{display:grid;grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/, 'equal side columns keep the ring centred');
  assert.match(readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8'), /const restWindow = nextRestWindow\(calendarResource\.data \|\| \[\], now\);/);
});
