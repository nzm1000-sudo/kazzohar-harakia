// The label of the week — what is read on the coming Shabbat — from one source (services/weeklyParasha.mjs
// weekReadingOf), the same in the day context, on Today and in the widget snapshot. A festival on the Shabbat names
// the festival (or וזאת הברכה on Israel's Shemini Atzeret, which is Simchat Torah); the next parasha appears only from
// Motzaei Shabbat. All readings come from @hebcal/core's Sedra.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weekReadingOf, parashaOfWeek } from '../src/services/weeklyParasha.mjs';
import { dayContext } from '../src/dayContext.mjs';

test('Chol HaMoed Sukkot 5787 (Thursday 1 Oct 2026): Israel → וזאת הברכה, abroad → שמיני עצרת', () => {
  const il = weekReadingOf('2026-10-01', true);
  assert.equal(il.label, 'פרשת וזאת הברכה');
  assert.equal(il.name, 'וזאת הברכה');
  assert.equal(il.kind, 'parasha');
  assert.equal(il.shabbatKey, '2026-10-03');
  assert.equal(il.festival, 'Shmini Atzeret');
  const abroad = weekReadingOf('2026-10-01', false);
  assert.equal(abroad.label, 'שמיני עצרת');
  assert.equal(abroad.kind, 'festival');
  for (const reading of [il, abroad]) assert.doesNotMatch(reading.label, /בראשית/);
  // The whole week, Sunday to the Shabbat itself.
  for (const key of ['2026-09-27', '2026-09-30', '2026-10-02', '2026-10-03']) assert.equal(weekReadingOf(key, true).label, 'פרשת וזאת הברכה', key);
});

test('בראשית from the Sunday after (Motzaei Shabbat on), in Israel and abroad', () => {
  assert.equal(weekReadingOf('2026-10-04', true).label, 'פרשת בראשית');
  assert.equal(weekReadingOf('2026-10-04', false).label, 'פרשת בראשית');
  assert.equal(weekReadingOf('2026-10-10', true).label, 'פרשת בראשית');
});

test('a normal week → its parasha (combined ones joined with a maqaf)', () => {
  assert.equal(weekReadingOf('2026-10-12', true).label, 'פרשת נח');
  assert.equal(weekReadingOf('2026-02-11', true).label, 'פרשת משפטים');
  assert.equal(weekReadingOf('2026-03-12', true).label, 'פרשת ויקהל־פקודי');
  assert.equal(weekReadingOf('2026-10-12', true).kind, 'parasha');
  assert.equal(weekReadingOf('2026-10-12', true).festival, null);
});

test('other festival Shabbatot name the festival, never the next parasha', () => {
  // Shabbat Chol HaMoed Pesach 5787 (24 April 2027), both in Israel and abroad.
  assert.equal(weekReadingOf('2027-04-21', true).label, 'שבת חול המועד פסח');
  assert.equal(weekReadingOf('2027-04-21', false).label, 'שבת חול המועד פסח');
  // Shabbat Chol HaMoed Sukkot 5786 (11 October 2025).
  assert.equal(weekReadingOf('2025-10-08', true).label, 'שבת חול המועד סוכות');
  // The first day of Sukkot on Shabbat (26 September 2026).
  assert.equal(weekReadingOf('2026-09-24', true).label, 'סוכות');
  // Yom Kippur on Shabbat (30 September 2028).
  assert.equal(weekReadingOf('2028-09-27', true).label, 'יום כיפור');
  // Shavuot II on Shabbat abroad only (12 June 2027): abroad the festival, Israel its parasha.
  assert.equal(weekReadingOf('2027-06-10', false).label, 'שבועות');
  assert.equal(weekReadingOf('2027-06-10', true).label, 'פרשת נשא');
  for (const key of ['2027-04-21', '2028-09-27']) assert.equal(weekReadingOf(key, true).kind, 'festival');
});

test('the study target (Shnayim Mikra, the daily aliya) stays the next regular parasha', () => {
  assert.equal(parashaOfWeek('2026-10-01', true).id, 'bereshit');
  assert.equal(weekReadingOf('not a date', true), null);
});

test('the day context carries the week\'s reading; Today shows it under the right heading', async () => {
  const settingsIL = { il: true, halachicResidenceStatus: 'israel', location: { tzid: 'Asia/Jerusalem' } };
  const settingsAbroad = { il: false, halachicResidenceStatus: 'diaspora', location: { tzid: 'America/New_York' } };
  const items = [
    { category: 'holiday', subcat: 'major', date: '2026-10-03', title: 'Shmini Atzeret', hebrew: 'שמיני עצרת', leyning: { torah: 'Deuteronomy 33:1-34:12' } },
    { category: 'parashat', date: '2026-10-10', title: 'Parashat Bereshit', hebrew: 'פרשת בראשית', leyning: { torah: 'Genesis 1:1-6:8' } },
  ];
  const il = dayContext(new Date('2026-10-01T09:00:00Z'), settingsIL, { sunset: '2026-10-01T15:20:00Z' }, items);
  assert.equal(il.weekReading.label, 'פרשת וזאת הברכה');
  assert.equal(il.parasha.hebrew, 'פרשת בראשית', 'the next regular parasha stays available (Shnayim Mikra, its date)');
  const abroad = dayContext(new Date('2026-10-01T14:00:00Z'), settingsAbroad, { sunset: '2026-10-01T22:40:00Z' }, items);
  assert.equal(abroad.weekReading.label, 'שמיני עצרת');
  // Motzaei Shabbat (after the sunset that opens Sunday) belongs to the week of בראשית.
  const motzaei = dayContext(new Date('2026-10-03T17:30:00Z'), settingsIL, { sunset: '2026-10-03T15:15:00Z' }, items);
  assert.equal(motzaei.weekReading.label, 'פרשת בראשית');
});
