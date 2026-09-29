// השעון היהודי — the engine: fixed and Jewish-time alarms, offsets, seasons, fasts, Shabbat policy, DST, time zones,
// cross-midnight, and the single source of truth (the alarm's anchor is exactly the time TodayPage shows).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeZmanim } from '../src/services/zmanimLocal.mjs';
import { zmanim, CITIES, DEFAULT_SETTINGS, normalizeSettings } from '../src/services.mjs';
import { fastOn } from '../src/services/fastTimes.mjs';
import { HALACHA_RULES } from '../src/data/halachaRules.mjs';
import { alarmContext, resolveJewishAlarm, anchorOn, zonedInstant, civilKeyOf, restWindowAt, contextSignature, omerNightOn, chanukahNightOn, weekdayOf } from '../src/services/jewishAlarm/engine.mjs';
import { occurrencesFor, getNextAlarm, previewDays, livePreview, nextOccurrence } from '../src/services/jewishAlarm/occurrences.mjs';
import { normalizeRule, blankRule, draftProblem, findDuplicate } from '../src/services/jewishAlarm/model.mjs';
import { ANCHORS, ANCHOR_GROUPS } from '../src/services/jewishAlarm/anchors.mjs';

const TLV = normalizeSettings({ ...DEFAULT_SETTINGS });
const NY = normalizeSettings({ ...DEFAULT_SETTINGS, location: CITIES.find(city => city.searchName === 'New York'), il: false, halachicResidenceStatus: 'diaspora' });
const ctx = alarmContext(TLV);
const MIN = 60000;
const jewish = (anchor, offset, extra = {}) => normalizeRule({ id: `r-${anchor}-${offset}`, mode: 'jewish', jewishAnchorId: anchor, offsetMinutes: offset, recurrence: 'daily', ...extra });
const fixed = (time, extra = {}) => normalizeRule({ id: `f-${time}`, mode: 'fixed', fixedTime: time, recurrence: 'daily', ...extra });
const hm = (instant, tz = 'Asia/Jerusalem') => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
const allIn = (rule, from, days, settings = TLV) => occurrencesFor(rule, alarmContext(settings), { now: new Date(from), days, limit: 1000 });

test('a fixed alarm rings at its wall-clock time every day, in the location\'s zone', () => {
  const list = allIn(fixed('06:30'), '2026-10-05T12:00:00Z', 5);
  assert.deepEqual(list.map(item => item.date), ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'], 'Shabbat morning (10.10) is silent by default');
  for (const item of list) assert.equal(hm(item.at), '06:30');
  assert.equal(list[0].date, '2026-10-06', 'the first one after "now" (noon) is tomorrow morning');
  assert.equal(resolveJewishAlarm(fixed('06:30'), '2026-10-06', ctx).anchorTime, null);
});

test('exact zman: offset 0 is the zman itself; 25 before sunrise; 10 after nightfall', () => {
  const day = '2026-10-06';
  const z = computeZmanim(day, TLV.location);
  const exact = resolveJewishAlarm(jewish('sunrise', 0), day, ctx);
  assert.equal(exact.alarmTime.toISOString(), z.sunrise);
  assert.equal(exact.anchorTime.toISOString(), z.sunrise);
  const before = resolveJewishAlarm(jewish('sunrise', -25), day, ctx);
  assert.equal(before.alarmTime.getTime(), new Date(z.sunrise).getTime() - 25 * MIN);
  assert.equal(before.anchorLabel, 'הנץ החמה');
  const after = resolveJewishAlarm(jewish('tzeit85deg', 10), day, ctx);
  assert.equal(after.alarmTime.getTime(), new Date(z.tzeit85deg).getTime() + 10 * MIN);
});

test('the time moves with the season by itself: tomorrow and next month are recalculated, never adjusted by hand', () => {
  const rule = jewish('sunrise', -25);
  const today = resolveJewishAlarm(rule, '2026-10-06', ctx).alarmTime;
  const tomorrow = resolveJewishAlarm(rule, '2026-10-07', ctx).alarmTime;
  const nextMonth = resolveJewishAlarm(rule, '2026-11-06', ctx).alarmTime;
  assert.notEqual(hm(today), hm(nextMonth));
  for (const [key, value] of [['2026-10-07', tomorrow], ['2026-11-06', nextMonth]]) assert.equal(value.getTime(), new Date(computeZmanim(key, TLV.location).sunrise).getTime() - 25 * MIN);
});

test('SOURCE OF TRUTH: every daily anchor equals the zmanim TodayPage shows (services.mjs zmanim → computeZmanim)', async () => {
  for (const settings of [TLV, NY]) {
    const c = alarmContext(settings);
    for (const day of ['2026-10-06', '2026-12-21', '2027-03-28', '2027-06-21']) {
      const shown = await zmanim(day, settings); // the exact call NewApp makes for TodayPage
      for (const [id, anchor] of Object.entries(ANCHORS)) {
        if (anchor.kind !== 'daily') continue;
        const resolved = resolveJewishAlarm(jewish(id, 0), day, c);
        assert.equal(resolved.anchorTime.toISOString(), shown[anchor.zman], `${settings.location.searchName} ${day} ${id}`);
      }
    }
  }
});

test('SOURCE OF TRUTH: candle lighting and havdalah equal the Hebcal calendar the app shows (a captured API answer), to the minute', () => {
  // tests/fixtures/hebcalCalendarJerusalem.json: the Hebcal API answer the app used for Jerusalem (b=40, M=on).
  const api = JSON.parse(readFileSync(new URL('./fixtures/hebcalCalendarJerusalem.json', import.meta.url), 'utf8'));
  const place = { name: 'ירושלים', latitude: api.location.latitude, longitude: api.location.longitude, tzid: api.location.tzid, il: true };
  const c = alarmContext({ location: place, candles: 40, halachicResidenceStatus: 'israel' });
  const timed = api.items.filter(item => item.category === 'candles' || item.category === 'havdalah');
  assert.ok(timed.length >= 10);
  for (const item of timed) {
    const key = item.date.slice(0, 10);
    const local = item.category === 'candles' ? (anchorOn('candles-shabbat', key, c) || anchorOn('candles-yomtov', key, c)) : (anchorOn('havdalah-shabbat', key, c) || anchorOn('havdalah-yomtov', key, c));
    assert.equal(local?.at.getTime(), new Date(item.date).getTime(), `${item.category} ${item.date}`);
  }
});

test('SOURCE OF TRUTH: candle lighting = sunset − the candle minutes; havdalah = the app\'s 8.5° nightfall; Rabbenu Tam = sunset + 72', () => {
  for (const friday of ['2026-10-09', '2026-12-18', '2027-06-25']) {
    const z = computeZmanim(friday, TLV.location);
    // Hebcal rounds candle lighting down to the minute (never later than the true time): within one minute.
    const gap = new Date(z.sunset).getTime() - TLV.candles * MIN - anchorOn('candles-shabbat', friday, ctx).at.getTime();
    assert.ok(gap >= 0 && gap <= MIN, `${friday} ${gap}`);
    const saturday = new Date(Date.parse(`${friday}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const zs = computeZmanim(saturday, TLV.location);
    assert.equal(anchorOn('havdalah-shabbat', saturday, ctx).at.toISOString(), zs.tzeit85deg, saturday);
    assert.equal(anchorOn('rt-shabbat', saturday, ctx).at.toISOString(), zs.tzeit72min, saturday);
  }
  // 60 minutes before candle lighting
  const rule = jewish('candles-shabbat', -60);
  const resolved = resolveJewishAlarm(rule, '2026-10-09', ctx);
  assert.equal(resolved.alarmTime.getTime(), anchorOn('candles-shabbat', '2026-10-09', ctx).at.getTime() - 60 * MIN);
  // A different candle setting (e.g. 40 minutes, Jerusalem's custom) moves the anchor with it.
  const jerusalem = alarmContext({ ...TLV, location: CITIES[1], candles: 40 });
  const zj = computeZmanim('2026-10-09', CITIES[1]);
  const gapJ = new Date(zj.sunset).getTime() - 40 * MIN - anchorOn('candles-shabbat', '2026-10-09', jerusalem).at.getTime();
  assert.ok(gapJ >= 0 && gapJ <= MIN);
});

test('candle lighting only on Friday (Shabbat) and on the eve of Yom Tov; havdalah only on Motzaei Shabbat / Yom Tov', () => {
  const shabbat = allIn(jewish('candles-shabbat', 0, { ringOnRest: true }), '2026-10-04T00:00:00Z', 60);
  assert.ok(shabbat.length >= 8);
  for (const item of shabbat) assert.equal(weekdayOf(item.date), 5, item.date);
  // Yom Tov candles: Erev Pesach 5787 (2027-04-21) and Erev Shavuot (2027-06-10), and not an ordinary weekday
  assert.ok(anchorOn('candles-yomtov', '2027-04-21', ctx), 'Erev Pesach');
  assert.ok(anchorOn('candles-yomtov', '2027-06-10', ctx), 'Erev Shavuot');
  assert.equal(anchorOn('candles-yomtov', '2027-04-20', ctx), null);
  assert.equal(anchorOn('havdalah-yomtov', '2027-04-22', ctx)?.at.toISOString(), computeZmanim('2027-04-22', TLV.location).tzeit85deg, 'end of the first day of Pesach in Israel');
  for (const item of allIn(jewish('havdalah-shabbat', 0, { ringOnRest: true }), '2026-10-04T00:00:00Z', 60)) assert.equal(weekdayOf(item.date), 6);
});

test('the Omer: only on Omer nights (1–49, from @hebcal/core), at nightfall + the offset, with the day number', () => {
  const year = allIn(jewish('omer', 10, { ringOnRest: true }), '2026-10-01T00:00:00Z', 400);
  assert.equal(year.length, 49);
  assert.equal(year[0].date, '2027-04-22', 'the second night of Pesach (16 Nisan begins) — in Israel the evening after the first day');
  assert.equal(year[0].detail.omerDay, 1);
  assert.equal(year.at(-1).detail.omerDay, 49);
  assert.deepEqual(year.map(item => item.detail.omerDay), Array.from({ length: 49 }, (_, index) => index + 1));
  for (const item of year) assert.equal(item.at.getTime(), new Date(computeZmanim(item.date, TLV.location).tzeit85deg).getTime() + 10 * MIN);
  assert.equal(omerNightOn('2027-04-21'), null, 'the Seder night is not an Omer night');
  // Without the explicit Shabbat choice, Friday nights and Yom Tov nights are silent.
  const quiet = allIn(jewish('omer', 10), '2026-10-01T00:00:00Z', 400);
  assert.ok(quiet.length < 49 && quiet.length >= 40);
  for (const item of quiet) assert.notEqual(weekdayOf(item.date), 5);
});

test('Chanukah: only Chanukah evenings, at the app\'s verified time (sunset + its minutes); not Friday nor Motzaei Shabbat', () => {
  const rule = HALACHA_RULES.find(item => item.id === 'chanukah-candles');
  assert.equal(rule.zman, 'sunset');
  const list = allIn(jewish('chanukah', 0), '2026-11-01T00:00:00Z', 60);
  // 5787: first candle Friday 4 Dec 2026; the weekday nights are Sun 6 … Thu 10 Dec.
  assert.deepEqual(list.map(item => item.date), ['2026-12-06', '2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10']);
  assert.deepEqual(list.map(item => item.detail.chanukahNight), [3, 4, 5, 6, 7]);
  for (const item of list) assert.equal(item.at.getTime(), new Date(computeZmanim(item.date, TLV.location).sunset).getTime() + rule.minutes * MIN);
  assert.equal(chanukahNightOn('2026-12-03'), null);
  assert.equal(chanukahNightOn('2026-12-04'), 1);
  assert.equal(anchorOn('chanukah', '2026-12-04', ctx), null, 'Erev Shabbat: no single verified time');
  assert.equal(anchorOn('chanukah', '2026-12-05', ctx), null, 'Motzaei Shabbat: no single verified time');
  assert.equal(allIn(jewish('chanukah', 0), '2027-01-01T00:00:00Z', 200).length, 0, 'none outside Chanukah');
});

test('fasts: start and end from the fast engine — dawn for a minor fast, the eve\'s sunset for Tisha B\'Av, candle lighting for Yom Kippur', () => {
  const settings = { location: TLV.location, halachicResidenceStatus: 'israel', candles: TLV.candles };
  const tevet = fastOn('2026-12-20', settings);
  assert.equal(anchorOn('fast-start', '2026-12-20', ctx).at.getTime(), tevet.begins.getTime());
  assert.equal(anchorOn('fast-end', '2026-12-20', ctx).at.getTime(), tevet.ends.getTime());
  assert.equal(tevet.begins.toISOString(), computeZmanim('2026-12-20', TLV.location).alotHaShachar);
  const av = fastOn('2027-08-12', settings);
  assert.equal(anchorOn('fast-start', '2027-08-11', ctx).at.getTime(), av.begins.getTime(), 'Tisha B\'Av begins the evening before');
  assert.equal(av.begins.toISOString(), computeZmanim('2027-08-11', TLV.location).sunset);
  const yk = fastOn('2026-09-21', settings);
  assert.equal(anchorOn('fast-start', '2026-09-20', ctx).at.getTime(), yk.begins.getTime(), 'Yom Kippur begins at candle lighting');
  assert.equal(anchorOn('fast-end', '2026-09-21', ctx).at.getTime(), yk.ends.getTime());
  // Only fast dates.
  const starts = allIn(jewish('fast-start', -30, { ringOnRest: true }), '2026-10-01T00:00:00Z', 365);
  assert.ok(starts.length >= 4 && starts.length <= 6, `${starts.length}`);
  for (const item of starts) assert.ok(fastOn(item.date, settings) || fastOn(new Date(Date.parse(`${item.date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10), settings), item.date);
  assert.equal(anchorOn('fast-start', '2026-10-06', ctx), null);
});

test('a disabled rule never rings; weekday recurrence skips Friday and Shabbat; custom days ring only on those days', () => {
  assert.deepEqual(allIn({ ...fixed('06:30'), enabled: false }, '2026-10-04T00:00:00Z', 14), []);
  const work = allIn(fixed('06:30', { recurrence: 'weekdays' }), '2026-10-04T00:00:00Z', 14);
  assert.ok(work.length >= 9);
  for (const item of work) assert.ok([0, 1, 2, 3, 4].includes(weekdayOf(item.date)));
  const custom = allIn(jewish('sunrise', -25, { recurrence: 'custom', weekdays: [1, 3] }), '2026-10-04T00:00:00Z', 14);
  assert.ok(custom.length >= 4);
  for (const item of custom) assert.ok([1, 3].includes(weekdayOf(item.date)));
});

test('Shabbat policy: a daily alarm is silent on Shabbat and Yom Tov unless the user explicitly allows it', () => {
  // Daily nightfall + 10: Friday evening is inside Shabbat.
  const quiet = allIn(jewish('tzeit85deg', 10), '2026-10-04T00:00:00Z', 14);
  assert.equal(quiet.some(item => weekdayOf(item.date) === 5), false);
  const allowed = allIn(jewish('tzeit85deg', 10, { ringOnRest: true }), '2026-10-04T00:00:00Z', 14);
  assert.equal(allowed.some(item => weekdayOf(item.date) === 5), true);
  // Before Shabbat and after it: normal.
  assert.ok(allIn(jewish('candles-shabbat', 0), '2026-10-04T00:00:00Z', 14).length >= 1, 'at candle lighting');
  assert.ok(allIn(jewish('candles-shabbat', -45), '2026-10-04T00:00:00Z', 14).length >= 1, 'before candle lighting');
  assert.equal(allIn(jewish('candles-shabbat', 10), '2026-10-04T00:00:00Z', 14).length, 0, 'after candle lighting is Shabbat');
  assert.ok(allIn(jewish('havdalah-shabbat', 0), '2026-10-04T00:00:00Z', 14).length >= 1, 'at the end of Shabbat');
  assert.ok(restWindowAt(new Date('2026-10-10T08:00:00Z'), ctx));
  assert.equal(restWindowAt(new Date('2026-10-08T08:00:00Z'), ctx), null);
});

test('cross-midnight offsets are plain arithmetic on the instant', () => {
  const late = resolveJewishAlarm(jewish('tzeit85deg', 360), '2026-10-06', ctx);
  assert.equal(civilKeyOf(late.alarmTime.getTime(), 'Asia/Jerusalem'), '2026-10-07');
  const early = resolveJewishAlarm(jewish('alotHaShachar', -360), '2026-10-07', ctx);
  assert.equal(civilKeyOf(early.alarmTime.getTime(), 'Asia/Jerusalem'), '2026-10-06');
  // The occurrence list includes tonight's alarm for tomorrow's dawn.
  const next = occurrencesFor(jewish('alotHaShachar', -360), ctx, { now: new Date('2026-10-06T15:00:00Z'), days: 2 })[0];
  assert.equal(next.date, '2026-10-07');
  assert.ok(next.at < new Date('2026-10-07T00:00:00+03:00'));
});

test('DST: a fixed time in the skipped hour rings an hour later on the wall; a repeated hour rings the first time; zmanim stay exact', () => {
  // Israel: clocks go forward Friday 26 March 2027 at 02:00; back Sunday 25 October 2026 at 02:00.
  assert.equal(hm(zonedInstant('2027-03-26', '02:30', 'Asia/Jerusalem')), '03:30');
  assert.equal(zonedInstant('2026-10-25', '01:30', 'Asia/Jerusalem').toISOString(), '2026-10-24T22:30:00.000Z');
  // New York
  assert.equal(hm(zonedInstant('2027-03-14', '02:30', 'America/New_York'), 'America/New_York'), '03:30');
  assert.equal(zonedInstant('2026-11-01', '01:30', 'America/New_York').toISOString(), '2026-11-01T05:30:00.000Z');
  // A fixed 06:30 alarm stays 06:30 on the wall across the change.
  for (const item of allIn(fixed('06:30'), '2027-03-22T00:00:00Z', 10)) assert.equal(hm(item.at), '06:30');
  for (const item of allIn(fixed('06:30'), '2026-10-22T00:00:00Z', 6)) assert.equal(hm(item.at), '06:30');
  // Sunrise − 25 on both sides of the change is exactly 25 minutes before that day's sunrise.
  for (const day of ['2027-03-25', '2027-03-26', '2027-03-27', '2026-10-24', '2026-10-25', '2026-10-26']) {
    const r = resolveJewishAlarm(jewish('sunrise', -25), day, ctx);
    assert.equal(r.anchorTime.getTime() - r.alarmTime.getTime(), 25 * MIN, day);
  }
});

test('time zone and location changes recalculate in the new place; the signature changes', () => {
  const ny = alarmContext(NY);
  const r = resolveJewishAlarm(jewish('sunrise', -25), '2026-10-06', ny);
  assert.equal(r.timezone, 'America/New_York');
  assert.equal(r.anchorTime.toISOString(), computeZmanim('2026-10-06', NY.location).sunrise);
  assert.notEqual(contextSignature(ny), contextSignature(ctx));
  const fixedNy = allIn(fixed('06:30'), '2026-10-05T00:00:00Z', 3, NY);
  for (const item of fixedNy) assert.equal(hm(item.at, 'America/New_York'), '06:30');
  // No location → a human error, never a crash or NaN.
  const none = resolveJewishAlarm(jewish('sunrise', -25), '2026-10-06', alarmContext({ location: null }));
  assert.equal(none.message, 'בחרו עיר או מיקום כדי לחשב את הזמן.');
  const missing = resolveJewishAlarm(jewish('candles-shabbat', 0), '2026-10-06', ctx);
  assert.equal(missing.message, 'הזמן הזה אינו זמין ביום שנבחר.');
});

test('next alarm merges fixed and Jewish rules; the 7-day preview and the live preview come from the same engine', () => {
  const rules = [fixed('09:00'), jewish('sunrise', -25)];
  const next = getNextAlarm(rules, ctx, new Date('2026-10-06T12:00:00Z'));
  assert.equal(next.rule.mode, 'jewish');
  assert.equal(next.occurrence.date, '2026-10-07');
  const days = previewDays(jewish('sunrise', -25), ctx, new Date('2026-10-06T12:00:00Z'));
  assert.equal(days.length, 7);
  assert.equal(days.find(day => weekdayOf(day.date) === 6).status, 'rest');
  const live = livePreview(jewish('sunrise', -25), ctx, new Date('2026-10-06T12:00:00Z'));
  assert.equal(live.occurrence.anchorTime.toISOString(), computeZmanim('2026-10-07', TLV.location).sunrise);
  assert.equal(nextOccurrence(jewish('chanukah', 0), ctx, new Date('2026-10-06T12:00:00Z')).date, '2026-12-06', 'months ahead, found');
});

test('the rule model: drafts, validation, clamping, duplicates', () => {
  const draft = blankRule();
  assert.equal(draftProblem(draft), 'בחרו את סוג השעון.');
  assert.equal(draftProblem({ ...draft, mode: 'jewish' }), 'בחרו זמן יהודי.');
  assert.equal(draftProblem({ ...draft, mode: 'jewish', jewishAnchorId: 'sunrise' }), 'בחרו כמה זמן לפני, בזמן או אחרי.');
  assert.equal(draftProblem({ ...draft, mode: 'jewish', jewishAnchorId: 'sunrise', offsetMinutes: -25 }), null);
  assert.equal(normalizeRule({ mode: 'jewish', jewishAnchorId: 'sunrise', offsetMinutes: -5000 }).offsetMinutes, -720);
  assert.equal(normalizeRule({ mode: 'jewish', jewishAnchorId: 'no-such', offsetMinutes: 0 }), null);
  assert.equal(normalizeRule('garbage'), null);
  const a = jewish('sunrise', -25);
  assert.ok(findDuplicate([a], { ...a, id: 'other' }));
  assert.equal(findDuplicate([a], { ...a, id: 'other', offsetMinutes: -30 }), null);
  // Every group lists real anchors; no invented zman (every daily anchor is a key of computeZmanim).
  const keys = Object.keys(computeZmanim('2026-10-06', TLV.location));
  for (const group of ANCHOR_GROUPS) for (const id of group.anchors) { assert.ok(ANCHORS[id], id); if (ANCHORS[id].kind === 'daily') assert.ok(keys.includes(ANCHORS[id].zman), id); }
});

test('offline first: the engine never touches the network', () => {
  for (const file of ['anchors', 'engine', 'model', 'occurrences', 'format', 'store', 'scheduler']) {
    const source = readFileSync(new URL(`../src/services/jewishAlarm/${file}.mjs`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|https?:\/\/|setInterval\(/, file);
  }
});
