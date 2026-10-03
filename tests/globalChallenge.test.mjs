// האתגר העולמי — the app's side: the day's five (deterministic, the same for every device, different from day to day),
// the published schedule (append-only, matching the server's key), no challenge on Shabbat / Yom Tov / Tisha B'Av by
// the user's regime (checked against @hebcal/core for years, both regimes), Friday closing at candle lighting, the
// device's store (defaults, the result kept once, offline queueing), the nickname rules, the API client against a mock
// server, the words of a result, and the screens (the card, the settings section).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { HebrewCalendar, HDate, flags } from '@hebcal/core';
import { loadJsx } from './helpers/jsx.mjs';
import { memoryStorage } from './helpers/memoryStorage.mjs';
import { checkMarkup, formatProblems } from './helpers/a11yCheck.mjs';
import { loadBank } from '../src/services/quiz/bank.mjs';
import { pickDailySet, dailySet, eligibleQuestions } from '../src/services/globalChallenge/select.mjs';
import { closedReason, weekKeyOf, boardWeekAt, shiftDateKey, weekdayOf, weekDays } from '../src/services/globalChallenge/calendar.mjs';
import { challengeToday, closesAtFor, resultLine, countLine } from '../src/services/globalChallenge/status.mjs';
import { emptyGlobalState, readGlobalState, writeGlobalState, normalizeGlobalState, recordDay, pendingDays, forgetServer, withDevice, isDeviceId, makeDeviceId, DEFAULT_PREFS, GLOBAL_STORAGE_KEY } from '../src/services/globalChallenge/store.mjs';
import { createChallengeApi, flushPending } from '../src/services/globalChallenge/api.mjs';
import { checkNickname, nicknameKey } from '../src/services/globalChallenge/nickname.mjs';
import { scoreAnswers, shareBelow, addToDayStats, emptyDayStats, SLOT_DIFFICULTIES, GLOBAL_SIZE, DAY_MAX_POINTS } from '../src/services/globalChallenge/scoring.mjs';
import { checkAll, extendSchedule, keyFor } from '../scripts/challenge/build-key.mjs';
import SCHEDULE from '../src/data/globalChallenge/schedule.mjs';
import KEY from '../server/challenge-worker/src/key.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const bankPromise = loadBank();
const JERUSALEM = { name: 'ירושלים', latitude: 31.7683, longitude: 35.2137, tzid: 'Asia/Jerusalem', countryCode: 'IL' };
const NEW_YORK = { name: 'ניו יורק', latitude: 40.7128, longitude: -74.006, tzid: 'America/New_York', countryCode: 'US' };

test('the day\'s five: deterministic, the same for every device, different across days, 1·1·2·2·3 in five areas', async () => {
  const bank = await bankPromise;
  const a = pickDailySet(bank.questions, '2026-11-02');
  const shuffledBank = [...bank.questions].reverse();
  assert.deepEqual(pickDailySet(shuffledBank, '2026-11-02'), a, 'independent of the order of the bank');
  assert.deepEqual(pickDailySet(bank.questions, '2026-11-02'), a, 'the same again');
  assert.equal(a.length, GLOBAL_SIZE);
  assert.deepEqual(a.map(id => bank.byId.get(id).difficulty), SLOT_DIFFICULTIES);
  assert.equal(new Set(a.map(id => bank.byId.get(id).category)).size, GLOBAL_SIZE, 'five different areas');
  const days = Array.from({ length: 30 }, (_, i) => shiftDateKey('2026-11-01', i));
  const sets = days.map(d => pickDailySet(bank.questions, d).join());
  assert.equal(new Set(sets).size, days.length, 'every day its own five');
  assert.ok(eligibleQuestions(bank.questions).length === bank.size, 'nothing excluded yet (GLOBAL_EXCLUDED is empty)');
});

test('the schedule: every day\'s ids in the bank, the server\'s key matches the bank, append-only, no Saturdays', async () => {
  const bank = await bankPromise;
  assert.deepEqual(checkAll(bank, SCHEDULE, KEY, '2026-10-03'), []);
  const days = Object.keys(SCHEDULE.days);
  assert.ok(days.every(d => weekdayOf(d) !== 6));
  // append-only: extending keeps every scheduled day as it is
  const longer = extendSchedule(bank, SCHEDULE, shiftDateKey(SCHEDULE.to, 30));
  for (const d of days) assert.deepEqual(longer.days[d], SCHEDULE.days[d]);
  assert.ok(Object.keys(longer.days).length > days.length);
  // a key that disagrees with the bank is caught
  const broken = keyFor(bank, SCHEDULE);
  broken.days[days[3]] = broken.days[days[3]].map(([id, a, d], i) => [id, i === 0 ? (a + 1) % 4 : a, d]);
  assert.ok(checkAll(bank, SCHEDULE, broken, '2026-10-03').some(p => p.includes(days[3])));
  // the app uses the schedule's five when it has them, the seeded choice beyond it
  const today = dailySet(bank, days[10], SCHEDULE);
  assert.deepEqual(today, { ids: SCHEDULE.days[days[10]], scheduled: true });
  const beyond = dailySet(bank, '2031-02-03', SCHEDULE);
  assert.equal(beyond.scheduled, false);
  assert.equal(beyond.ids.length, GLOBAL_SIZE);
  // no repeats within the avoid window of the schedule
  const recent = days.slice(0, 40).flatMap(d => SCHEDULE.days[d]);
  assert.equal(new Set(recent).size, recent.length, 'forty days without a repeated question');
});

test('no challenge on Shabbat and Yom Tov — exactly @hebcal/core\'s chag days, by the regime, for six years', () => {
  for (const il of [true, false]) {
    let day = '2026-01-01';
    let yomTov = 0;
    while (day < '2032-01-01') {
      const [y, m, d] = day.split('-').map(Number);
      const events = HebrewCalendar.getHolidaysOnDate(new HDate(new Date(y, m - 1, d)), il) || [];
      const chag = events.some(e => e.getFlags() & flags.CHAG);
      const reason = closedReason(day, { il });
      if (weekdayOf(day) === 6) assert.equal(reason, 'shabbat', day);
      else if (chag) { assert.equal(reason, 'yomtov', `${day} ${il ? 'IL' : 'diaspora'}`); yomTov += 1; }
      else if (reason !== 'tisha-bav') assert.equal(reason, null, `${day} ${il ? 'IL' : 'diaspora'} ${events.map(e => e.getDesc())}`);
      day = shiftDateKey(day, 1);
    }
    assert.ok(yomTov > (il ? 30 : 50), `${il ? 'IL' : 'diaspora'} found ${yomTov}`);
  }
  // the second days: Simchat Torah 5787 in the diaspora, Isru Chag in Israel
  assert.equal(closedReason('2026-10-04', { il: false }), 'yomtov');
  assert.equal(closedReason('2026-10-04', { il: true }), null);
  // Tisha B'Av: 9 Av 5787 is Thursday 2027-08-12; in 5786 9 Av falls on Shabbat → the fast (and the closing) on Sunday
  assert.equal(closedReason('2027-08-12', { il: true }), 'tisha-bav');
  assert.equal(closedReason('2026-07-23', { il: true }), 'tisha-bav');
  assert.equal(closedReason('2026-07-22', { il: true }), null);
});

test('Friday closes at candle lighting (the app\'s minutes); the week runs Sunday–Friday and turns at motzaei Shabbat', () => {
  // Friday 2026-10-09 in Jerusalem, 40 minutes (the city's custom, as set)
  const settings = { location: JERUSALEM, il: true, halachicResidenceStatus: 'israel', candles: 40 };
  const closes = closesAtFor('2026-10-09', { il: true, location: JERUSALEM, candles: 40 });
  const sunset = Date.parse('2026-10-09T15:12:00Z');
  assert.ok(Math.abs(closes - (sunset - 40 * 60000)) < 3 * 60000, new Date(closes).toISOString());
  const before = challengeToday({ now: closes - 60000, settings });
  assert.equal(before.open, true);
  assert.equal(before.closesAt, closes);
  const after = challengeToday({ now: closes + 60000, settings });
  assert.deepEqual([after.open, after.reason], [false, 'evening']);
  assert.equal(challengeToday({ now: Date.parse('2026-10-10T09:00:00Z'), settings }).reason, 'shabbat');
  // an ordinary Wednesday: open, no early closing
  const wed = challengeToday({ now: Date.parse('2026-10-07T09:00:00Z'), settings });
  assert.deepEqual([wed.open, wed.closesAt, wed.date], [true, null, '2026-10-07']);
  // the eve of a diaspora Yom Tov closes; the same day in Israel does not (Pesach 5787: 15 Nisan = 2027-04-22)
  assert.ok(closesAtFor('2027-04-21', { il: false, location: NEW_YORK, candles: 18 }));
  assert.equal(closesAtFor('2027-04-22', { il: true, location: JERUSALEM, candles: 40 }), null, '16 Nisan is no Yom Tov in Israel');
  assert.ok(closesAtFor('2027-04-22', { il: false, location: NEW_YORK, candles: 18 }), 'the diaspora\'s second day follows');
  // the week
  assert.equal(weekKeyOf('2026-10-09'), '2026-10-04');
  assert.deepEqual(weekDays('2026-10-04'), ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
  assert.equal(boardWeekAt('2026-10-10'), '2026-10-04', 'Shabbat still shows the week it ends');
  assert.equal(boardWeekAt('2026-10-10', { shabbatOver: true }), '2026-10-11', 'motzaei Shabbat: the new week');
  const saturdayNight = challengeToday({ now: Date.parse('2026-10-10T17:30:00Z'), settings });
  assert.equal(saturdayNight.week, '2026-10-11');
  const saturdayDay = challengeToday({ now: Date.parse('2026-10-10T10:00:00Z'), settings });
  assert.equal(saturdayDay.week, '2026-10-04');
});

test('the device\'s store: participation on, the board off, no id until needed; a broken record reads as new', () => {
  const storage = memoryStorage();
  const fresh = readGlobalState(storage);
  assert.deepEqual(fresh.prefs, { participate: true, board: false, nickname: '', introSeen: false });
  assert.deepEqual(DEFAULT_PREFS, fresh.prefs);
  assert.equal(fresh.device, null, 'no id is made before the server is contacted');
  const withId = withDevice(fresh);
  assert.ok(isDeviceId(withId.device));
  assert.ok(isDeviceId(makeDeviceId({ getRandomValues: b => b.fill(7) })), 'a fallback without randomUUID');
  assert.notEqual(makeDeviceId(), makeDeviceId());
  storage.setItem(GLOBAL_STORAGE_KEY, '{broken');
  assert.deepEqual(readGlobalState(storage).prefs, DEFAULT_PREFS);
  assert.equal(normalizeGlobalState({ device: 'not-an-id', prefs: { participate: false, board: 'yes' } }).device, null);
  assert.deepEqual(normalizeGlobalState({ prefs: { participate: false, board: 'yes' } }).prefs.board, false);
  assert.equal(normalizeGlobalState({ prefs: { participate: false } }).prefs.participate, false);
});

test('offline: the result is kept on the device and waits; it is sent when the server answers, once', async () => {
  const bank = await bankPromise;
  const date = Object.keys(SCHEDULE.days)[1];
  const ids = SCHEDULE.days[date];
  const answers = ids.map((qid, i) => ({ qid, choice: i < 3 ? bank.byId.get(qid).answer : (bank.byId.get(qid).answer + 1) % 4, ms: 4000 }));
  let state = withDevice(emptyGlobalState());
  state = recordDay(state, { date, ids, answers, bank, il: true, scheduled: true, queue: true });
  assert.equal(state.days[date].correct, 3);
  assert.equal(state.days[date].status, 'pending');
  assert.deepEqual(pendingDays(state), [date]);
  assert.equal(recordDay(state, { date, ids, answers: answers.map(a => ({ ...a, choice: bank.byId.get(a.qid).answer })), bank }), state, 'the first result of a day stands');
  // no server configured: local only, never queued
  assert.equal(recordDay(emptyGlobalState(), { date, ids, answers, bank, queue: false }).days[date].status, 'local');
  const storage = memoryStorage();
  writeGlobalState(state, storage);
  assert.equal(readGlobalState(storage).days[date].status, 'pending', 'it survives a restart');
  // the network is down: it stays pending
  const calls = [];
  const down = { enabled: true, submit: async body => { calls.push(body); return { ok: false, offline: true, error: 'network' }; } };
  const still = await flushPending(state, down);
  assert.equal(still.days[date].status, 'pending');
  // back online: sent, with the day's numbers
  const up = { enabled: true, submit: async body => { calls.push(body); return { ok: true, data: { verified: false, day: { n: 12, c: [9, 8, 7, 6, 5], h: [0, 1, 2, 3, 4, 2] } } }; } };
  const sent = await flushPending(still, up);
  assert.equal(sent.days[date].status, 'sent');
  assert.equal(sent.stats[date].n, 12);
  assert.deepEqual(calls.at(-1).answers.map(a => Object.keys(a).sort().join()), Array(5).fill('choice,ms,qid'), 'only qid, choice and ms leave the device');
  assert.equal(calls.at(-1).token, null, 'played offline: no token');
  assert.deepEqual(pendingDays(sent), []);
  assert.equal((await flushPending(sent, up)), sent, 'nothing left to send');
  // refused (e.g. too late): kept on the device, not retried; already there: counted as sent
  const late = await flushPending(state, { enabled: true, submit: async () => ({ ok: false, offline: false, error: 'late' }) });
  assert.deepEqual([late.days[date].status, late.days[date].reason], ['rejected', 'late']);
  const dup = await flushPending(state, { enabled: true, submit: async () => ({ ok: false, offline: false, error: 'already' }) });
  assert.equal(dup.days[date].status, 'sent');
  // participation off: nothing is sent
  const off = { ...state, prefs: { ...state.prefs, participate: false } };
  assert.equal(await flushPending(off, up), off);
  // "מחיקת הנתונים שלי מהשרת": no id, no board, and nothing waits any more
  const forgotten = forgetServer({ ...state, prefs: { ...state.prefs, board: true, nickname: 'דנה' } });
  assert.equal(forgotten.device, null);
  assert.deepEqual([forgotten.prefs.board, forgotten.prefs.nickname, forgotten.prefs.participate], [false, '', true]);
  assert.deepEqual(pendingDays(forgotten), []);
  assert.equal(forgotten.days[date].correct, 3, 'the player\'s own result stays');
});

test('the nickname: 2–20 letters, digits and spaces; no long numbers, no blocked or reserved words; unique by key', () => {
  for (const ok of ['דנה', 'Sara Levi', 'לומד 18', 'Ashkenazi', 'grape', 'חזיונות', 'rabbit', 'Shmuel K']) assert.equal(checkNickname(ok).ok, true, ok);
  const reason = v => checkNickname(v).reason;
  assert.equal(reason('א'), 'length');
  assert.equal(reason('א'.repeat(21)), 'length');
  assert.equal(reason('hello!'), 'chars');
  assert.equal(reason('שָׁלוֹם'), 'chars', 'no niqqud');
  assert.equal(reason('12'), 'letter');
  assert.equal(reason('דני 0521234567'), 'digits', 'no phone numbers');
  for (const word of ['admin', 'Admin1', 'הרב שלום', 'מרן', 'rabbi', 'כזוהר', 'כזוהר הרקיע', 'kazzohar fan', 'מנהל', 'אדמור', 'Moderator']) assert.equal(reason(word), 'reserved', word);
  for (const word of ['fuck', 'FUCKER', 'f4ggot', 'זונה', 'בן זונה', 'שרמוטה', 'nazi', 'היטלר']) assert.equal(reason(word), 'blocked', word);
  assert.equal(checkNickname('  שרה   לוי ').nickname, 'שרה לוי');
  assert.equal(nicknameKey('Sara Levi'), nicknameKey('saralevi'));
  assert.equal(nicknameKey('שלום'), nicknameKey('שלומ'), 'final letters ignored');
});

test('the API client: the right requests, every failure resolved (never thrown), disabled without an address', async () => {
  const seen = [];
  const fake = (status, body) => async (url, init) => { seen.push({ url, init }); return { ok: status < 400, status, json: async () => body }; };
  const api = createChallengeApi({ base: 'https://challenge.example/', fetchImpl: fake(200, { token: 't', startedAt: 1 }) });
  assert.equal(api.enabled, true);
  const start = await api.start({ device: 'd', date: '2026-10-05', il: true });
  assert.deepEqual([start.ok, start.data.token], [true, 't']);
  assert.equal(seen[0].url, 'https://challenge.example/v1/start');
  assert.equal(seen[0].init.method, 'POST');
  assert.equal(seen[0].init.credentials, 'omit', 'no cookies');
  assert.deepEqual(JSON.parse(seen[0].init.body), { device: 'd', date: '2026-10-05', il: true });
  await api.board({ week: '2026-10-04', device: 'd d' });
  assert.equal(seen[1].url, 'https://challenge.example/v1/board/2026-10-04?device=d%20d');
  await api.deleteMe({ device: 'd' });
  assert.equal(seen[2].init.method, 'DELETE');
  const refused = await createChallengeApi({ base: 'https://x', fetchImpl: fake(409, { error: 'already' }) }).submit({ device: 'd', date: '2026-10-05', il: true, answers: [] });
  assert.deepEqual([refused.ok, refused.error, refused.offline], [false, 'already', false]);
  const busy = await createChallengeApi({ base: 'https://x', fetchImpl: fake(503, null) }).day('2026-10-05');
  assert.deepEqual([busy.ok, busy.offline], [false, true], 'a busy server is like offline: try later');
  const down = await createChallengeApi({ base: 'https://x', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }).day('2026-10-05');
  assert.deepEqual([down.ok, down.offline, down.error], [false, true, 'network']);
  const off = createChallengeApi({ base: '', fetchImpl: fake(200, {}) });
  assert.equal(off.enabled, false);
  assert.deepEqual(await off.day('2026-10-05'), { ok: false, status: 0, data: null, error: 'disabled', offline: false });
});

test('the words of a result: "ענית נכון על 4 מתוך 5 — יותר מ-72% מהעונים היום", and the day\'s count', () => {
  const stats = { n: 100, c: [90, 80, 70, 60, 50], h: [2, 10, 20, 40, 18, 10] };
  assert.equal(shareBelow(stats, 4), 72);
  assert.equal(resultLine(4, stats), 'ענית נכון על 4 מתוך 5 — יותר מ-72% מהעונים היום');
  assert.equal(resultLine(4), 'ענית נכון על 4 מתוך 5', 'without the world: the personal result only');
  assert.equal(resultLine(0, stats), 'הפעם לא היו תשובות נכונות', 'no "more than 0%"');
  assert.equal(resultLine(1, { n: 1, c: [1, 0, 0, 0, 0], h: [0, 1, 0, 0, 0, 0] }), 'ענית נכון על שאלה אחת מתוך 5', 'alone today: no comparison');
  assert.equal(countLine(1234), 'היום ענו 1,234 לומדים');
  assert.equal(countLine(1), 'היום ענה לומד אחד');
  assert.equal(countLine(0), '');
  let s = emptyDayStats();
  s = addToDayStats(s, [true, true, false, false, true]);
  s = addToDayStats(s, [false, false, false, false, false]);
  assert.deepEqual(s, { n: 2, c: [1, 1, 0, 0, 1], h: [1, 0, 0, 1, 0, 0] });
  const key = [['a', 0, 1], ['b', 1, 1], ['c', 2, 2], ['d', 3, 2], ['e', 0, 3]];
  assert.deepEqual(scoreAnswers(key, key.map(([qid, a]) => ({ qid, choice: a }))), { correct: 5, points: DAY_MAX_POINTS, perQuestion: [true, true, true, true, true] });
  assert.equal(DAY_MAX_POINTS, 70);
});

test('the screens: the Today card (local), the closed day, and the settings section with its four rows', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  globalThis.window ??= globalThis;
  globalThis.history ??= { state: null, back() {}, replaceState() {}, pushState() {} };
  const { default: Card } = loadJsx('components/globalChallenge/GlobalChallengeCard.jsx');
  const settings = { location: JERUSALEM, il: true, halachicResidenceStatus: 'israel', candles: 40 };
  const html = renderToStaticMarkup(React.createElement(Card, { settings, go() {}, place: 'today', now: Date.parse('2026-10-07T09:00:00Z') }));
  assert.match(html, /<h2 class="gc-card-title"[^>]*>האתגר העולמי של היום<\/h2><span class="title-ornament"/);
  assert.match(html, /לאתגר של היום/);
  assert.deepEqual(checkMarkup(html), [], formatProblems(checkMarkup(html)));
  assert.doesNotMatch(html, /היום ענו/, 'no server: no global count');
  // Shabbat: on Today the card steps aside; in the quiz it says why
  const shabbat = Date.parse('2026-10-10T09:00:00Z');
  assert.equal(renderToStaticMarkup(React.createElement(Card, { settings, place: 'today', now: shabbat })), '');
  assert.match(renderToStaticMarkup(React.createElement(Card, { settings, place: 'hub', now: shabbat })), /אין אתגר בשבת/);
  // participation off: gone from Today, a quiet way back in the quiz
  store.set(GLOBAL_STORAGE_KEY, JSON.stringify({ prefs: { participate: false } }));
  assert.equal(renderToStaticMarkup(React.createElement(Card, { settings, place: 'today', now: Date.parse('2026-10-07T09:00:00Z') })), '');
  assert.match(renderToStaticMarkup(React.createElement(Card, { settings, place: 'hub', now: Date.parse('2026-10-07T09:00:00Z') })), /האתגר העולמי כבוי/);
  store.clear();
  const { default: SettingsPage } = loadJsx('pages/SettingsPage.jsx');
  const page = renderToStaticMarkup(React.createElement(SettingsPage, { route: 'settings', settings, setSettings() {}, theme: 'light', setTheme() {}, go() {} }));
  const section = page.slice(page.indexOf('id="settings-challenge"'));
  assert.match(section, /<h2 class="settings-section-title"[^>]*>האתגר העולמי<\/h2>/);
  for (const id of ['challenge-participate', 'challenge-board', 'challenge-nickname', 'challenge-delete']) assert.ok(section.includes(`data-setting="${id}"`), id);
  assert.match(section, /role="switch" aria-checked="true" aria-label="השתתפות באתגר העולמי — פעילה"/, 'participation on by default');
  assert.match(section, /role="switch" aria-checked="false" aria-label="הופעה בטבלת השיאים — כבויה"/, 'the board off by default');
  assert.match(section, /מחיקת הנתונים שלי מהשרת/);
  assert.match(section, /השרת של האתגר עדיין לא פעיל/, 'without a server it says so');
});
