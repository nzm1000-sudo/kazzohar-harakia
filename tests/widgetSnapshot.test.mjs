// The widget / Siri snapshot (services/widgetSnapshot.mjs): the next zman agrees with the app's own rule, candle
// lighting and havdalah, the parasha, the ring, a multi-day timeline whose Jewish date turns at sunset, the tzaddik of
// the day from the verified list, the Omer, and the ways into the app (services/nativeWidgets.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWidgetSnapshot, widgetStateAt, omerDayOf, omerAnswer, tzaddikimOf, timeText, SNAPSHOT_DAYS } from '../src/services/widgetSnapshot.mjs';
import { computeZmanim } from '../src/services/zmanimLocal.mjs';
import { CITIES, DEFAULT_SETTINGS, getNextRelevantZman } from '../src/services.mjs';
import { shiftCivilDate, civilDateKey } from '../src/civilDate.mjs';
import { omerNightOn } from '../src/services/jewishAlarm/engine.mjs';
import { YAHRZEITS } from '../src/data/yahrzeits.mjs';
import { parseEntryUrl, ENTRY_ROUTES } from '../src/services/nativeWidgets.mjs';

const TLV = DEFAULT_SETTINGS;
const NY = { ...DEFAULT_SETTINGS, location: CITIES.find(city => city.searchName === 'New York'), il: false, halachicResidenceStatus: 'diaspora' };
const at = iso => new Date(iso);
const snap = (iso, settings = TLV, extra = {}) => buildWidgetSnapshot({ now: at(iso), settings, ...extra });

test('the next zman is the one the app itself shows (getNextRelevantZman), at many instants over several days', () => {
  for (const settings of [TLV, NY]) {
    const tzid = settings.location.tzid;
    const start = at('2026-09-30T00:30:00Z');
    const snapshot = buildWidgetSnapshot({ now: start, settings });
    for (let hours = 0; hours < 24 * 6; hours += 1.75) {
      const instant = new Date(start.getTime() + hours * 3600000);
      const civil = civilDateKey(instant, tzid);
      const times = { ...computeZmanim(civil, settings.location), nextDay: computeZmanim(shiftCivilDate(civil, 1), settings.location) };
      const expected = getNextRelevantZman(instant, times, { showRT: false });
      const state = widgetStateAt(snapshot, instant);
      assert.equal(state.next?.key, expected?.key, `${tzid} ${instant.toISOString()}`);
      assert.equal(state.next?.at, expected?.at.getTime(), `${tzid} ${instant.toISOString()}`);
    }
  }
});

test('Rabbenu Tam joins the timeline only when the user shows it in the app', () => {
  assert.equal(snap('2026-09-30T10:00:00Z').zmanim.some(z => z.key === 'tzeit72min'), false);
  assert.equal(snap('2026-09-30T10:00:00Z', { ...TLV, showRT: true }).zmanim.some(z => z.key === 'tzeit72min'), true);
});

test('candle lighting and havdalah for the coming Shabbat (Tel Aviv, 20 minutes; 8.5°) and the per-city minutes', () => {
  const snapshot = snap('2026-09-30T10:00:00Z');
  const [shabbat] = snapshot.shabbat;
  assert.equal(shabbat.key, '2026-10-03');
  assert.equal(timeText(shabbat.candles, 'Asia/Jerusalem'), '18:04');
  assert.equal(timeText(shabbat.havdalah, 'Asia/Jerusalem'), '19:00');
  const friday = computeZmanim('2026-10-02', TLV.location);
  assert.ok(Math.abs(new Date(friday.sunset).getTime() - 20 * 60000 - shabbat.candles) <= 60000, 'sunset − 20 minutes');
  const forty = snap('2026-09-30T10:00:00Z', { ...TLV, candles: 40 }).shabbat[0];
  assert.equal(shabbat.candles - forty.candles, 20 * 60000);
  // During Shabbat (after candle lighting, before havdalah) the same Shabbat stays; after havdalah, the next one.
  assert.equal(widgetStateAt(snapshot, at('2026-10-03T10:00:00Z')).shabbat.key, '2026-10-03');
  assert.equal(widgetStateAt(snapshot, at('2026-10-03T16:30:00Z')).shabbat.key, '2026-10-10');
});

test('the parasha of the week: the next regular reading (a holiday Shabbat skips to the next), Israel and abroad', () => {
  const snapshot = snap('2026-09-30T10:00:00Z');
  assert.equal(widgetStateAt(snapshot, at('2026-09-30T10:00:00Z')).day.parasha, 'פרשת בראשית');
  assert.equal(snapshot.shabbat[0].parasha, null, 'Shemini Atzeret (Israel) has no weekly parasha');
  assert.equal(snapshot.shabbat[1].parasha, 'פרשת בראשית');
  assert.equal(widgetStateAt(snap('2026-10-11T10:00:00Z'), at('2026-10-11T10:00:00Z')).day.parasha, 'פרשת נח');
  // 2027: the second day of Shavuot is a Shabbat abroad only — Israel reads Beha'alotcha that week, the Diaspora Naso.
  const il = widgetStateAt(snap('2027-06-17T12:00:00Z'), at('2027-06-17T12:00:00Z')).day.parasha;
  const ny = widgetStateAt(snap('2027-06-17T16:00:00Z', NY), at('2027-06-17T16:00:00Z')).day.parasha;
  assert.equal(il, 'פרשת בהעלתך');
  assert.equal(ny, 'פרשת נשא');
  assert.notEqual(il, ny, 'Israel and the Diaspora read different portions that week');
});

test('the ring: the open circle of this week (N / 72), empty again at Motzaei Shabbat; lifetime keeps the high-water mark', () => {
  const events = [];
  for (let i = 0; i < 80; i += 1) events.push({ category: 'prayer', jewishDate: '2026-09-29', quantity: 1 });
  events.push({ category: 'tehillim', jewishDate: '2026-09-30', quantity: 5 });
  events.push({ category: 'prayer', jewishDate: '2026-09-20', quantity: 1 }); // last week
  const snapshot = snap('2026-09-30T10:00:00Z', TLV, { events, lifetimeBest: 7 });
  assert.equal(snapshot.ring.goal, 72);
  assert.equal(snapshot.ring.active, 13, '85 lights this week → one circle completed, 13 of the next');
  assert.equal(snapshot.ring.completedThisWeek, 1);
  assert.equal(snapshot.ring.lifetime, 7, 'the high-water record is never lowered');
  assert.equal((snapshot.ring.active / snapshot.ring.goal).toFixed(3), '0.181');
  const saturdaySunset = new Date(computeZmanim('2026-10-03', TLV.location).sunset).getTime();
  assert.equal(snapshot.ring.until, saturdaySunset, 'the week ends at the sunset that ends Shabbat');
  assert.equal(widgetStateAt(snapshot, new Date(saturdaySunset - 60000)).ring, 13);
  assert.equal(widgetStateAt(snapshot, new Date(saturdaySunset + 60000)).ring, 0);
});

test('a multi-day timeline: contiguous Jewish days that turn at sunset, zmanim for a week ahead, then stale', () => {
  const snapshot = snap('2026-09-30T10:00:00Z');
  assert.ok(snapshot.days.length >= SNAPSHOT_DAYS, `${snapshot.days.length} days`);
  for (let i = 1; i < snapshot.days.length; i += 1) assert.equal(snapshot.days[i].from, snapshot.days[i - 1].to, 'no gap, no overlap');
  for (let i = 1; i < snapshot.zmanim.length; i += 1) assert.ok(snapshot.zmanim[i].at >= snapshot.zmanim[i - 1].at, 'sorted');
  assert.ok(snapshot.zmanim.at(-1).at - snapshot.generatedAt > 7 * 86400000, 'a week of zmanim');
  const sunset = new Date(computeZmanim('2026-09-30', TLV.location).sunset).getTime();
  const before = widgetStateAt(snapshot, new Date(sunset - 60000));
  const after = widgetStateAt(snapshot, new Date(sunset + 60000));
  assert.equal(before.day.date, 'י״ט בתשרי תשפ״ז');
  assert.equal(after.day.date, 'כ׳ בתשרי תשפ״ז', 'the Jewish date turns at sunset, as in the app');
  assert.equal(before.day.dayMonth, 'י״ט בתשרי');
  assert.equal(before.day.weekday, 'יום רביעי');
  assert.equal(before.next.key, 'sunset');
  assert.equal(after.next.key, 'tzeit85deg');
  assert.equal(widgetStateAt(snapshot, new Date(snapshot.validUntil + 1)).stale, true);
  assert.ok(JSON.stringify(snapshot).length < 16000, 'compact');
});

test('the tzaddik of the day comes only from the verified list of "נר ה\' נשמת אדם"', () => {
  const snapshot = snap('2026-09-30T10:00:00Z');
  const today = widgetStateAt(snapshot, at('2026-09-30T10:00:00Z')).day;
  assert.ok(today.tzaddik.some(name => name.startsWith('הגאון מווילנא')), today.tzaddik.join(' | '));
  assert.equal(today.tzaddikCount, tzaddikimOf('2026-09-30').length);
  const known = new Set(YAHRZEITS.map(record => record.displayNameHe));
  for (const day of snapshot.days) for (const name of day.tzaddik) assert.ok([...known].some(base => name.startsWith(base)), name);
  assert.deepEqual(widgetStateAt(snapshot, at('2026-10-02T10:00:00Z')).day.tzaddik, [], 'a day without a record shows none — nothing invented');
});

test('the Omer day agrees with the app\'s Omer engine, and Siri\'s answer', () => {
  for (let i = 0; i < 70; i += 1) {
    const eve = shiftCivilDate('2027-04-20', i);
    assert.equal(omerDayOf(shiftCivilDate(eve, 1)), omerNightOn(eve) || 0, eve);
  }
  assert.equal(omerAnswer(snap('2027-05-05T09:00:00Z'), at('2027-05-05T09:00:00Z')), 'היום 13 לעומר · נותרו 36 ימים');
  const autumn = snap('2026-09-30T10:00:00Z');
  assert.match(omerAnswer(autumn, at('2026-09-30T10:00:00Z')), /^ספירת העומר מתחילה בעוד \d+ ימים$/);
});

test('ways into the app: only known routes, the blessings query kept', () => {
  assert.deepEqual(parseEntryUrl('kzohaar://open/brachot?q=%D7%AA%D7%A4%D7%95%D7%97'), { route: 'siddur-brachot', query: 'תפוח' });
  assert.deepEqual(parseEntryUrl('kzohaar://open/zmanim'), { route: 'times', query: '' });
  assert.equal(parseEntryUrl('kzohaar://open/unknown'), null);
  assert.equal(parseEntryUrl('https://example.com/open/zmanim'), null);
  assert.equal(parseEntryUrl('kzohaar://open/today?q=x').query, '', 'a query only for the blessings engine');
  for (const route of Object.values(ENTRY_ROUTES)) assert.match(route, /^[a-z/-]+$/);
});

test('wiring: the app publishes the snapshot and never sends it anywhere', () => {
  const app = readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /useWidgetSync\(settings\)/);
  const bridge = readFileSync(new URL('../src/services/nativeWidgets.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(bridge, /fetch\(|XMLHttpRequest|https?:\/\//);
  assert.match(bridge, /JOURNAL_CHANGE_EVENT/);
});
