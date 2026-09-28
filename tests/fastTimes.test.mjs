// Fast days with location-aware times (services/fastTimes.mjs): each kind by its own rule, moved fasts, a fast on
// Friday, Israel and Diaspora, DST, the day-before preview — expected values from the calendar and the zmanim
// definitions, not from the code under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fastsBetween, fastOn, fastOutlook, FAST_RULES } from '../src/services/fastTimes.mjs';
import { computeZmanim } from '../src/services/zmanimLocal.mjs';
import { dayContext } from '../src/dayContext.mjs';

const NETIVOT = { location: { latitude: 31.4218, longitude: 34.5883, tzid: 'Asia/Jerusalem', name: 'נתיבות' }, halachicResidenceStatus: 'israel', il: true, candles: 20 };
const JERUSALEM = { location: { latitude: 31.778, longitude: 35.235, tzid: 'Asia/Jerusalem', name: 'ירושלים' }, halachicResidenceStatus: 'israel', il: true, candles: 40 };
const NY = { location: { latitude: 40.713, longitude: -74.006, tzid: 'America/New_York', name: 'New York' }, halachicResidenceStatus: 'diaspora', il: false, candles: 18 };
const LONDON = { location: { latitude: 51.507, longitude: -0.128, tzid: 'Europe/London', name: 'London' }, halachicResidenceStatus: 'diaspora', il: false, candles: 18 };
const hm = (date, tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the year 5787 in Netivot: every fast, its kind, and times from the app\'s own zmanim', () => {
  const fasts = fastsBetween('2026-09-01', '2027-09-30', NETIVOT);
  assert.deepEqual(fasts.map(fast => [fast.key, fast.hebrew, fast.kind]), [
    ['2026-09-14', 'צום גדליה', 'minor'], ['2026-09-21', 'יום הכיפורים', 'yom-kippur'], ['2026-12-20', 'עשרה בטבת', 'minor'],
    ['2027-03-22', 'תענית אסתר', 'minor'], ['2027-04-21', 'תענית בכורות', 'bechorot'], ['2027-07-22', 'שבעה עשר בתמוז', 'minor'], ['2027-08-12', 'תשעה באב', 'tisha-bav'],
  ]);
  for (const fast of fasts) {
    const day = computeZmanim(fast.key, NETIVOT.location);
    assert.equal(fast.ends.toISOString(), day.tzeit85deg, `${fast.hebrew} ends at the app's nightfall`);
    assert.equal(fast.endsRabbenuTam.toISOString(), day.tzeit72min, `${fast.hebrew} Rabbenu Tam = sunset + 72`);
    if (fast.kind === 'minor' || fast.kind === 'bechorot') assert.equal(fast.begins.toISOString(), day.alotHaShachar, `${fast.hebrew} begins at dawn`);
    assert.ok(fast.begins < fast.ends);
    assert.ok(fast.ends < fast.endsRabbenuTam, 'Rabbenu Tam is later, secondary');
  }
  const gedaliah = fasts[0];
  assert.equal(hm(gedaliah.begins, 'Asia/Jerusalem'), '05:12');
  assert.equal(hm(gedaliah.ends, 'Asia/Jerusalem'), '19:25');
  assert.equal(gedaliah.postponed, false);
});

test('Tisha B\'Av begins at sunset of the eve; Yom Kippur at candle lighting; both end at nightfall', () => {
  const [tishaBav] = fastsBetween('2027-08-12', '2027-08-12', NETIVOT);
  assert.equal(tishaBav.kind, 'tisha-bav');
  assert.equal(tishaBav.begins.toISOString(), computeZmanim('2027-08-11', NETIVOT.location).sunset);
  assert.equal(tishaBav.ends.toISOString(), computeZmanim('2027-08-12', NETIVOT.location).tzeit85deg);
  const [yomKippur] = fastsBetween('2026-09-21', '2026-09-21', JERUSALEM);
  assert.equal(yomKippur.kind, 'yom-kippur');
  const eveSunset = new Date(computeZmanim('2026-09-20', JERUSALEM.location).sunset);
  assert.equal(yomKippur.begins.getTime(), eveSunset.getTime() - 40 * 60000, 'Jerusalem: 40 minutes before sunset, the app\'s candle offset');
  assert.equal(yomKippur.ends.toISOString(), computeZmanim('2026-09-21', JERUSALEM.location).tzeit85deg);
  assert.match(FAST_RULES['yom-kippur'].begins, /הדלקת נרות/);
  assert.match(FAST_RULES['tisha-bav'].begins, /שקיעת החמה/);
});

test('moved fasts: Tisha B\'Av 5782 and 17 Tammuz 5782 observed on Sunday, Esther 5784 on Thursday, Bechorot 5781 on Thursday', () => {
  const y5782 = fastsBetween('2022-07-01', '2022-08-31', NETIVOT);
  const tammuz = y5782.find(fast => fast.title === 'Tzom Tammuz');
  assert.equal(tammuz.key, '2022-07-17'); assert.equal(tammuz.weekday, 0); assert.equal(tammuz.postponed, true);
  const av = y5782.find(fast => fast.kind === 'tisha-bav');
  assert.equal(av.key, '2022-08-07'); assert.equal(av.weekday, 0); assert.equal(av.postponed, true);
  assert.equal(av.begins.toISOString(), computeZmanim('2022-08-06', NETIVOT.location).sunset, 'begins Motzaei Shabbat at sunset');
  // 5784: Purim on Sunday (24 Mar 2024), so 13 Adar II is Shabbat and the fast moves to Thursday 11 Adar II.
  const esther = fastsBetween('2024-03-18', '2024-03-24', NY).find(fast => fast.title === "Ta'anit Esther");
  assert.equal(esther.key, '2024-03-21'); assert.equal(esther.weekday, 4); assert.equal(esther.postponed, true);
  // 5781: 13 Adar on a Thursday — observed on its own day, not moved.
  const esther5781 = fastsBetween('2021-02-20', '2021-02-28', NY).find(fast => fast.title === "Ta'anit Esther");
  assert.equal(esther5781.key, '2021-02-25'); assert.equal(esther5781.postponed, false);
  const bechorot = fastsBetween('2021-03-20', '2021-03-27', NY).find(fast => fast.kind === 'bechorot');
  assert.equal(bechorot.key, '2021-03-25'); assert.equal(bechorot.postponed, true); assert.equal(bechorot.firstbornOnly, true);
  assert.match(bechorot.note, /לבכורות בלבד/);
});

test('a fast on Friday keeps its end at nightfall, into Shabbat (Asara B\'Tevet 5781, 25 Dec 2020)', () => {
  const [tevet] = fastsBetween('2020-12-25', '2020-12-25', JERUSALEM);
  assert.equal(tevet.title, "Asara B'Tevet"); assert.equal(tevet.weekday, 5);
  assert.equal(tevet.endsIntoShabbat, true);
  assert.equal(tevet.ends.toISOString(), computeZmanim('2020-12-25', JERUSALEM.location).tzeit85deg);
  assert.ok(tevet.ends > new Date(computeZmanim('2020-12-25', JERUSALEM.location).sunset), 'after candle lighting and sunset');
});

test('Israel and the Diaspora, and a DST change on the fast day itself, use the location\'s own clock', () => {
  const ny = fastsBetween('2026-09-14', '2026-09-14', NY)[0];
  const netivot = fastsBetween('2026-09-14', '2026-09-14', NETIVOT)[0];
  assert.equal(ny.title, netivot.title);
  assert.notEqual(ny.begins.getTime(), netivot.begins.getTime());
  assert.equal(hm(ny.ends, 'America/New_York'), '19:47');
  // London, Tenth of Tevet 5787 (20 Dec 2026): a northern winter day — a short fast.
  const london = fastsBetween('2026-12-20', '2026-12-20', LONDON)[0];
  assert.ok((london.ends - london.begins) / 3600000 < 11.5);
  // Ta'anit Esther 5787 (22 Mar 2027) lies between the American (14 Mar) and Israeli (26 Mar) DST changes.
  const esther = fastsBetween('2027-03-22', '2027-03-22', NY)[0];
  assert.equal(hm(esther.begins, 'America/New_York'), '05:35');
  assert.equal(hm(esther.ends, 'America/New_York'), '19:51');
});

test('the day before a fast the outlook names tomorrow\'s fast with its times; without a location, no guessed time', () => {
  const eve = fastOutlook('2026-09-13', NETIVOT);
  assert.equal(eve.today, null);
  assert.equal(eve.tomorrow.hebrew, 'צום גדליה');
  assert.ok(eve.tomorrow.begins && eve.tomorrow.ends);
  const day = fastOutlook('2026-09-14', NETIVOT);
  assert.equal(day.today.hebrew, 'צום גדליה');
  const noLocation = fastOn('2026-09-14', { halachicResidenceStatus: 'israel', location: { name: 'x' } });
  assert.equal(noLocation.hebrew, 'צום גדליה');
  assert.equal(noLocation.begins, null); assert.equal(noLocation.ends, null);
  // dayContext carries both, and the Today page shows the day-before card and today's card.
  const context = dayContext(new Date('2026-09-13T10:00:00Z'), { ...NETIVOT, nusach: 'edot-hamizrach', night: 'tzeit85deg' }, computeZmanim('2026-09-13', NETIVOT.location), []);
  assert.equal(context.fasts.tomorrow.hebrew, 'צום גדליה');
  const today = read('../src/pages/TodayPage.jsx');
  assert.match(today, /context\?\.fasts\?\.tomorrow && !context\?\.fasts\?\.today && <FastCard/);
  assert.match(today, /context\?\.fasts\?\.today && <FastCard/);
  const card = read('../src/components/FastCard.jsx');
  assert.match(card, /נדרש מיקום לחישוב הזמן/);
  assert.match(card, /רבנו תם · \{timeLabel\(fast\.endsRabbenuTam, tz\)\}/);
});

test('Rabbenu Tam is shown beneath the regular end of Shabbat / Yom Tov everywhere the end is shown, as a smaller line', () => {
  const today = read('../src/pages/TodayPage.jsx');
  assert.match(today, /rabbenuTamAfterSunset\(civilKeyAt\(window\.end, tz\), location\)/);
  assert.match(today, /spiritual-side-rt/);
  assert.match(read('../src/pages/ShabbatPage.jsx'), /rabbenu-tam-line/);
  assert.match(read('../src/pages/PreparationHub.jsx'), /\['צאת שבת', plan\.havdalah, rabbenuTam\]/);
  assert.match(read('../src/pages/CalendarPage.jsx'), /e\.category==='havdalah'&&rabbenuTamAfterSunset/);
  assert.match(read('../src/styles/base.css'), /\.rabbenu-tam-line\{display:block;color:var\(--ink-2\);font-size:var\(--font-ui-caption\)/);
});
