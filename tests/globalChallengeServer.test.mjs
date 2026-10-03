// האתגר העולמי — the server (server/challenge-worker): its pure rules, and every route over the in-memory store with a
// fixed clock — scoring, one submission a day, the signed start and its time budget, the date window, Shabbat and Yom
// Tov (both regimes), the rate limits, the nickname filter, its uniqueness and its changes, the board with its neighbourhood, CORS,
// and the erasure of a device.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/challenge-worker/src/app.mjs';
import { createMemoryStore } from '../server/challenge-worker/src/memoryStore.mjs';
import { originAllowed, dateInWindow, signStart, verifyStart, rankFromHist, weekInRange, LIMITS } from '../server/challenge-worker/src/logic.mjs';
import { TIME_BUDGET_MS, DAY_POINTS, QUESTION_MS, MAX_ANSWER_MS, NETWORK_GRACE_MS, GLOBAL_SIZE, timingProblem, scoreAnswers } from '../src/services/globalChallenge/scoring.mjs';
import { NICK_CHANGES_PER_DAY } from '../src/services/globalChallenge/nickname.mjs';
import KEY from '../server/challenge-worker/src/key.mjs';

const SECRET = 'test-secret-0123456789abcdef';
const DAY = '2026-10-05'; // a Monday, 24 Tishrei 5787 (an ordinary day in both regimes)
const T0 = Date.UTC(2026, 9, 5, 9, 0, 0);
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rows = KEY.days[DAY];
const right = () => rows.map(([qid, answer]) => ({ qid, choice: answer, ms: 4000 }));
const wrongAt = (...idx) => rows.map(([qid, answer], i) => ({ qid, choice: idx.includes(i) ? (answer + 1) % 4 : answer, ms: 5000 }));

let lastClock = null;
function setup({ now = T0, key = KEY } = {}) {
  const clock = { t: now };
  lastClock = clock;
  const store = createMemoryStore();
  const handle = createApp({ store, secret: SECRET, key, now: () => clock.t });
  let ipCounter = 0;
  const call = async (method, path, body, { origin = 'https://nzm1000-sudo.github.io', ip } = {}) => {
    const headers = { 'cf-connecting-ip': ip || `10.0.0.${(ipCounter += 1) % 250}` };
    if (origin) headers.origin = origin;
    if (body) headers['content-type'] = 'application/json';
    const res = await handle(new Request(`https://w.example${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }));
    return { status: res.status, body: res.status === 204 ? null : await res.json(), headers: res.headers };
  };
  return { clock, store, call };
}
const play = async (call, device, { date = DAY, answers = right(), il = true, clock = lastClock } = {}) => {
  const start = await call('POST', '/v1/start', { device, date, il });
  assert.equal(start.status, 200, JSON.stringify(start.body));
  // the game takes the time its answers claim (and the beats between them)
  if (clock) clock.t += answers.reduce((sum, a) => sum + a.ms, 0) + 4 * 1500;
  return call('POST', '/v1/submit', { device, date, il, token: start.body.token, answers });
};

test('pure rules: origins, the date window, the signed start, ranks', async () => {
  assert.ok(originAllowed('https://nzm1000-sudo.github.io'));
  assert.ok(originAllowed('capacitor://localhost'));
  assert.ok(originAllowed('https://localhost'));
  assert.ok(originAllowed(null), 'no Origin (a tool) passes; limits protect');
  assert.ok(!originAllowed('https://evil.example'));
  assert.ok(!originAllowed('http://localhost:5498'), 'localhost over http only in dev');
  assert.ok(originAllowed('http://localhost:5498', { dev: true }));
  assert.ok(!originAllowed('http://localhost.evil.com:80', { dev: true }));
  assert.ok(dateInWindow('2026-10-04', T0) && dateInWindow('2026-10-05', T0) && dateInWindow('2026-10-06', T0));
  assert.ok(!dateInWindow('2026-10-03', T0) && !dateInWindow('2026-10-07', T0) && !dateInWindow('2026-13-01', T0));
  assert.ok(weekInRange('2026-10-04', T0) && !weekInRange('2026-10-05', T0), 'a week is named by its Sunday');
  const device = uuid(1);
  const token = await signStart(SECRET, { device, date: DAY, startedAt: T0 });
  assert.equal(await verifyStart(SECRET, token, { device, date: DAY }), T0);
  assert.equal(await verifyStart(SECRET, token, { device: uuid(2), date: DAY }), null, 'bound to the device');
  assert.equal(await verifyStart(SECRET, token, { device, date: '2026-10-06' }), null, 'bound to the date');
  assert.equal(await verifyStart('another-secret-000000000', token, { device, date: DAY }), null);
  assert.equal(await verifyStart(SECRET, token.replace(/^\d+/, String(T0 + 60000)), { device, date: DAY }), null, 'the time cannot be moved');
  const hist = [{ points: 70, n: 2 }, { points: 45, n: 3 }, { points: 10, n: 1 }];
  assert.equal(rankFromHist(hist, 70), 1);
  assert.equal(rankFromHist(hist, 45), 3, 'equal points share a place');
  assert.equal(rankFromHist(hist, 10), 6);
});

test('submit: the server scores with its key, and the day\'s counters follow', async () => {
  const { call } = setup();
  const a = await play(call, uuid(1));
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.verified, true);
  assert.equal(a.body.score.correct, 5);
  assert.equal(a.body.score.points, rows.reduce((s, [, , d]) => s + DAY_POINTS[d], 0));
  const b = await play(call, uuid(2), { answers: wrongAt(0, 4) });
  assert.equal(b.body.score.correct, 3);
  assert.deepEqual(b.body.score.perQuestion, [false, true, true, true, false]);
  assert.equal(b.body.day.n, 2);
  assert.deepEqual(b.body.day.percents, [50, 100, 100, 100, 50]);
  assert.deepEqual(b.body.day.h, [0, 0, 0, 1, 0, 1]);
  const day = await call('GET', `/v1/day/${DAY}`);
  assert.equal(day.status, 200);
  assert.equal(day.body.n, 2);
  // a client's own "correct" claim is ignored: only qid, choice and ms are read
  const c = await play(call, uuid(3), { answers: wrongAt(0, 1, 2, 3, 4).map(x => ({ ...x, correct: true })) });
  assert.equal(c.body.score.correct, 0);
});

test('one submission per device and day; a second start returns the first start', async () => {
  const { call, clock } = setup();
  const device = uuid(7);
  const s1 = await call('POST', '/v1/start', { device, date: DAY, il: true });
  clock.t += 60000;
  const s2 = await call('POST', '/v1/start', { device, date: DAY, il: true });
  assert.equal(s2.body.startedAt, s1.body.startedAt, 'starting again never resets the clock');
  const first = await call('POST', '/v1/submit', { device, date: DAY, il: true, token: s1.body.token, answers: right() });
  assert.equal(first.status, 200);
  const again = await call('POST', '/v1/submit', { device, date: DAY, il: true, token: s1.body.token, answers: right() });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'already');
  const offlineAgain = await call('POST', '/v1/submit', { device, date: DAY, il: true, token: null, answers: right() });
  assert.equal(offlineAgain.body.error, 'already');
  assert.equal((await call('POST', '/v1/start', { device, date: DAY, il: true })).body.error, 'already');
  assert.equal((await call('GET', `/v1/day/${DAY}`)).body.n, 1);
});

test('30 seconds a question (owner, 2026-10-03): the budget is five clocks and a small grace, by the server\'s clock', () => {
  assert.equal(QUESTION_MS, 30000);
  assert.equal(TIME_BUDGET_MS, GLOBAL_SIZE * 30000 + NETWORK_GRACE_MS);
  assert.ok(TIME_BUDGET_MS <= 5 * 30000 + 20000, 'no longer fifteen minutes');
  assert.ok(MAX_ANSWER_MS > 30000 && MAX_ANSWER_MS <= 32000, 'an answer: its clock and a beat');
  const at = ms => right().map(a => ({ ...a, ms }));
  assert.equal(timingProblem(at(20000), 101000), null);
  assert.equal(timingProblem(at(30000), TIME_BUDGET_MS), null, 'the last moment of the budget');
  assert.equal(timingProblem(at(1000), TIME_BUDGET_MS + 1), 'late');
  assert.equal(timingProblem(at(29000), 60000), 'timing', 'claims 145 s after one minute');
  assert.equal(timingProblem(at(4000), 1000), null, 'the start\'s own network beat is within the grace');
  // an answer past its clock scores 0 — the same rule in the app and on the server
  const slow = right().map((a, i) => (i === 2 ? { ...a, ms: MAX_ANSWER_MS + 1 } : a));
  assert.deepEqual(scoreAnswers(rows, slow).perQuestion, [true, true, false, true, true]);
  assert.equal(scoreAnswers(rows, right().map(a => ({ ...a, ms: MAX_ANSWER_MS }))).correct, 5, 'within the beat');
});

test('the server enforces the clock: late, impossible sums, and an answer over its 30 seconds scores 0', async () => {
  const { call, clock } = setup();
  // a whole game at the edge of every clock: verified
  const edge = await play(call, uuid(40), { answers: right().map(a => ({ ...a, ms: 29900 })), clock });
  assert.equal(edge.status, 200, JSON.stringify(edge.body));
  assert.equal(edge.body.verified, true);
  assert.equal(edge.body.score.correct, 5);
  // one answer claims 40 seconds: that answer scores 0, the rest stand
  clock.t = T0;
  const over = await play(call, uuid(41), { answers: right().map((a, i) => (i === 4 ? { ...a, ms: 40000 } : a)), clock });
  assert.equal(over.status, 200, JSON.stringify(over.body));
  assert.deepEqual(over.body.score.perQuestion, [true, true, true, true, false]);
  assert.equal(over.body.score.points, rows.slice(0, 4).reduce((s, [, , d]) => s + DAY_POINTS[d], 0));
  // answers claiming two minutes, submitted ten seconds after the start: impossible, refused (nothing counted)
  clock.t = T0;
  const fast = uuid(42);
  const start = await call('POST', '/v1/start', { device: fast, date: DAY, il: true });
  clock.t += 10000;
  const forged = await call('POST', '/v1/submit', { device: fast, date: DAY, il: true, token: start.body.token, answers: right().map(a => ({ ...a, ms: 24000 })) });
  assert.equal(forged.status, 400);
  assert.equal(forged.body.error, 'timing');
  // after the five clocks and the grace: late (the old fifteen minutes are gone)
  const slow = uuid(43);
  const s2 = await call('POST', '/v1/start', { device: slow, date: DAY, il: true });
  clock.t += 5 * 30000 + 20000 + 1;
  const late = await call('POST', '/v1/submit', { device: slow, date: DAY, il: true, token: s2.body.token, answers: right() });
  assert.deepEqual([late.status, late.body.error], [409, 'late']);
  assert.equal(s2.body.budgetMs, TIME_BUDGET_MS);
  assert.equal(s2.body.questionMs, 30000);
  // without a token (offline) the per-answer rule still holds: over its clock, no point
  const offline = await call('POST', '/v1/submit', { device: uuid(44), date: DAY, il: true, token: null, answers: right().map((a, i) => (i === 0 ? { ...a, ms: 31600 } : a)) });
  assert.equal(offline.body.score.correct, 4);
});

test('the time budget: a submission after start + budget is refused; a forged or foreign token too', async () => {
  const { call, clock } = setup();
  const device = uuid(8);
  const start = await call('POST', '/v1/start', { device, date: DAY, il: true });
  clock.t += TIME_BUDGET_MS + 1000;
  const late = await call('POST', '/v1/submit', { device, date: DAY, il: true, token: start.body.token, answers: right() });
  assert.equal(late.status, 409);
  assert.equal(late.body.error, 'late');
  const other = uuid(9);
  const forged = await call('POST', '/v1/submit', { device: other, date: DAY, il: true, token: start.body.token, answers: right() });
  assert.equal(forged.body.error, 'token');
  const made = await signStart('not-the-secret-000000000', { device: other, date: DAY, startedAt: clock.t });
  assert.equal((await call('POST', '/v1/submit', { device: other, date: DAY, il: true, token: made, answers: right() })).body.error, 'token');
  // a genuine token without the start on record (e.g. signed for a time never started) is refused
  const unrecorded = await signStart(SECRET, { device: other, date: DAY, startedAt: clock.t });
  assert.equal((await call('POST', '/v1/submit', { device: other, date: DAY, il: true, token: unrecorded, answers: right() })).body.error, 'token');
});

test('without a token (played offline): counted in the day, never on the board', async () => {
  const { call, store } = setup();
  const device = uuid(10);
  await call('POST', '/v1/nickname', { device, nickname: 'לומד שקט', board: true });
  const res = await call('POST', '/v1/submit', { device, date: DAY, il: true, token: null, answers: right() });
  assert.equal(res.status, 200);
  assert.equal(res.body.verified, false);
  assert.equal(res.body.day.n, 1);
  assert.equal(await store.weekEntry('2026-10-04', device), null);
});

test('dates: only today ±1 (UTC), only scheduled days, never Shabbat or Yom Tov — by the regime', async () => {
  const { call, clock } = setup();
  const device = uuid(11);
  for (const date of ['2026-10-02', '2026-10-08', '2026-1-05', 'yesterday']) {
    const res = await call('POST', '/v1/start', { device, date, il: true });
    assert.equal(res.status, 422, date);
    assert.equal(res.body.error, 'window');
  }
  // Saturday 2026-10-10 (Shabbat)
  clock.t = Date.UTC(2026, 9, 10, 12);
  assert.equal((await call('POST', '/v1/start', { device, date: '2026-10-10', il: true })).body.reason, 'shabbat');
  // 2026-10-04 is 23 Tishrei: Simchat Torah in the diaspora, an ordinary day in Israel
  clock.t = Date.UTC(2026, 9, 4, 12);
  const dia = await call('POST', '/v1/start', { device, date: '2026-10-04', il: false });
  assert.equal(dia.status, 422);
  assert.equal(dia.body.reason, 'yomtov');
  assert.equal((await call('POST', '/v1/submit', { device, date: '2026-10-04', il: false, token: null, answers: KEY.days['2026-10-04'].map(([qid, a]) => ({ qid, choice: a, ms: 1000 })) })).body.reason, 'yomtov');
  const il = await call('POST', '/v1/start', { device, date: '2026-10-04', il: true });
  assert.equal(il.status, 200, 'Isru Chag in Israel has a challenge');
  // a day the key does not hold
  clock.t = Date.UTC(2031, 0, 6, 12);
  assert.equal((await call('POST', '/v1/start', { device, date: '2031-01-06', il: true })).body.error, 'no-key');
});

test('input validation everywhere', async () => {
  const { call } = setup();
  const device = uuid(12);
  assert.equal((await call('POST', '/v1/start', { device: 'not-a-uuid', date: DAY, il: true })).body.error, 'device');
  assert.equal((await call('POST', '/v1/start', { device, date: DAY, il: 'yes' })).body.error, 'il');
  const start = await call('POST', '/v1/start', { device, date: DAY, il: true });
  const submit = answers => call('POST', '/v1/submit', { device, date: DAY, il: true, token: start.body.token, answers });
  assert.equal((await submit(right().slice(0, 4))).body.error, 'answers');
  assert.equal((await submit(right().map((a, i) => (i === 2 ? { ...a, qid: 'tanakh-0001' } : a)))).body.error, 'qid');
  assert.equal((await submit(right().map((a, i) => (i === 1 ? { ...a, choice: 7 } : a)))).body.error, 'choice');
  assert.equal((await submit(right().map((a, i) => (i === 1 ? { ...a, ms: -3 } : a)))).body.error, 'ms');
  assert.equal((await submit(right().map((a, i) => (i === 1 ? { ...a, ms: 2 * 24 * 3600000 } : a)))).body.error, 'ms', 'not a time at all');
  assert.equal((await submit(right().map((a, i) => (i === 1 ? { ...a, ms: 1.5 } : a)))).body.error, 'ms');
  assert.equal((await submit(right().map((a, i) => (i === 0 ? { ...a, choice: null } : a)))).body.score.correct, 4, 'a clock that ran out is a miss');
  const handle = createApp({ store: createMemoryStore(), secret: SECRET, key: KEY, now: () => T0 });
  const big = await handle(new Request('https://w.example/v1/submit', { method: 'POST', body: 'x'.repeat(5000) }));
  assert.equal(big.status, 413);
  const bad = await handle(new Request('https://w.example/v1/submit', { method: 'POST', body: '{nope' }));
  assert.equal(bad.status, 400);
  assert.equal((await handle(new Request('https://w.example/v1/whatever'))).status, 404);
  assert.equal((await call('GET', '/v1/board/2026-10-05')).body.error, 'week', 'a week is a Sunday');
  assert.equal((await call('GET', `/v1/board/2026-10-04?device=xyz`)).body.error, 'device');
  assert.throws(() => createApp({ store: createMemoryStore(), secret: 'short', key: KEY }), /TOKEN_SECRET/);
});

test('CORS: only the app\'s origins (localhost over http in dev only)', async () => {
  const { call } = setup();
  const ok = await call('GET', `/v1/day/${DAY}`, null, { origin: 'capacitor://localhost' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'capacitor://localhost');
  const evil = await call('GET', `/v1/day/${DAY}`, null, { origin: 'https://evil.example' });
  assert.equal(evil.status, 403);
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  const pre = await call('OPTIONS', '/v1/submit', null, { origin: 'https://nzm1000-sudo.github.io' });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-methods'), /POST/);
  const devApp = createApp({ store: createMemoryStore(), secret: SECRET, key: KEY, now: () => T0, dev: true });
  const local = await devApp(new Request(`https://w.example/v1/day/${DAY}`, { headers: { origin: 'http://localhost:5498' } }));
  assert.equal(local.headers.get('access-control-allow-origin'), 'http://localhost:5498');
});

test('rate limits: per IP per minute (memory) and the write limits (store counters)', async () => {
  const { call } = setup();
  let last;
  for (let i = 0; i <= LIMITS.ipPerMinute; i += 1) last = await call('GET', `/v1/day/${DAY}`, null, { ip: '192.0.2.1' });
  assert.equal(last.status, 429);
  assert.equal(last.body.error, 'rate');
  assert.equal((await call('GET', `/v1/day/${DAY}`, null, { ip: '192.0.2.2' })).status, 200, 'another IP is unaffected');
  // writes: a device that keeps writing is stopped for the day
  const device = uuid(13);
  let res;
  for (let i = 0; i <= LIMITS.deviceWritesPerDay; i += 1) res = await call('POST', '/v1/nickname', { device, board: false }, { ip: `198.51.100.${i % 200}` });
  assert.equal(res.status, 429);
  // writes per IP per hour
  const { call: call2 } = setup();
  let r2;
  for (let i = 0; i <= LIMITS.ipWritesPerHour; i += 1) r2 = await call2('POST', '/v1/nickname', { device: uuid(1000 + i), board: false }, { ip: '203.0.113.9' });
  assert.equal(r2.status, 429);
});

test('nickname: filtered on the server, unique by key (case and niqqud ignored); the board is a separate opt-in', async () => {
  const { call } = setup();
  const a = uuid(21);
  const b = uuid(22);
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: 'admin' })).body.reason, 'reserved');
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: 'הרב כהן' })).body.reason, 'reserved');
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: 'כזוהר הרקיע' })).body.reason, 'reserved');
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: 'f u c k' })).body.reason, 'blocked');
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: '<script>' })).body.reason, 'chars');
  assert.equal((await call('POST', '/v1/nickname', { device: a, board: true })).body.error, 'need-nickname');
  const set = await call('POST', '/v1/nickname', { device: a, nickname: '  Sara  Levi ' });
  assert.equal(set.status, 200);
  assert.deepEqual(set.body, { nickname: 'Sara Levi', board: false }, 'joining the board is separate');
  assert.equal((await call('POST', '/v1/nickname', { device: b, nickname: 'saralevi' })).body.error, 'taken', 'case and spaces ignored');
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: 'Sara Levi' })).status, 200, 'the same nickname again is fine');
  assert.deepEqual((await call('POST', '/v1/nickname', { device: a, board: true })).body, { nickname: 'Sara Levi', board: true });
  assert.equal((await call('POST', '/v1/nickname', { device: b, nickname: 'שָׂרָה' })).status, 200);
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: 'שרה' })).body.error, 'taken', 'niqqud ignored');
});

test('nickname: changed at any time — the old name is free at once, the board shows the new one, five changes a day', async () => {
  const { call, clock, store } = setup();
  const a = uuid(51);
  const b = uuid(52);
  await call('POST', '/v1/nickname', { device: a, nickname: 'אריה', board: true });
  await play(call, a, { clock });
  const week = '2026-10-04';
  assert.equal((await call('GET', `/v1/board/${week}`)).body.top[0].nickname, 'אריה');
  // the change: one row per device, updated in place; the board's rows name the device, so they follow
  const changed = await call('POST', '/v1/nickname', { device: a, nickname: 'Lion' });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.deepEqual(changed.body, { nickname: 'Lion', board: true }, 'the board opt-in is kept');
  assert.equal(store._tables.players.size, 1, 'still one row for the device');
  const board = await call('GET', `/v1/board/${week}?device=${a}`);
  assert.deepEqual([board.body.total, board.body.top[0].nickname, board.body.me.nickname], [1, 'Lion', 'Lion'], 'the history shows the current nickname');
  assert.ok(board.body.me.points > 0, 'nothing is orphaned: the points stay with the device');
  // the old name is free the moment it changes; the new one is taken (case ignored)
  assert.equal((await call('POST', '/v1/nickname', { device: b, nickname: 'LION' })).body.error, 'taken');
  assert.equal((await call('POST', '/v1/nickname', { device: b, nickname: 'אריה' })).status, 200, 'the old name is free');
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: 'אריה' })).body.error, 'taken', 'and now it is b\'s');
  // a change to the same name in another case is a change of spelling only (allowed, the key is one's own)
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: 'lion' })).body.nickname, 'lion');
  // the limit: five nickname writes a UTC day, the first choice included (a refused attempt is not a write)
  // a: 'אריה' (1), 'Lion' (2), 'lion' (3) — two more, then refused
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: 'Lion One' })).status, 200);
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: 'Lion Two' })).status, 200);
  const limited = await call('POST', '/v1/nickname', { device: a, nickname: 'Lion Three' });
  assert.deepEqual([limited.status, limited.body.error, limited.body.nickname], [409, 'limit', 'Lion Two']);
  assert.equal(NICK_CHANGES_PER_DAY, 5);
  assert.equal((await call('POST', '/v1/nickname', { device: b, nickname: 'Lion Three' })).status, 200, 'a refused change holds nothing');
  assert.equal((await call('POST', '/v1/nickname', { device: a, nickname: 'Lion Two' })).status, 200, 'the same name again is no change');
  assert.equal((await call('POST', '/v1/nickname', { device: a, board: false })).body.board, false, 'the board switch is not a nickname change');
  // the next UTC day: changes again
  clock.t += 24 * 3600000;
  assert.deepEqual((await call('POST', '/v1/nickname', { device: a, nickname: 'Lion Four' })).body, { nickname: 'Lion Four', board: false });
  // erasing the device frees its current name
  await call('DELETE', '/v1/me', { device: a });
  assert.equal((await call('POST', '/v1/nickname', { device: uuid(53), nickname: 'lion four' })).status, 200);
});

test('the board: the week\'s top, my place with five above and five below, only listed players, no device ids', async () => {
  const { call } = setup();
  const devices = Array.from({ length: 16 }, (_, i) => uuid(100 + i));
  for (const [i, device] of devices.entries()) {
    if (i !== 15) await call('POST', '/v1/nickname', { device, nickname: `שחקן ${i + 1}`, board: true });
    // i correct answers spread: wrong on the first (i % 6) questions
    const misses = Array.from({ length: i % 6 }, (_, k) => k).filter(k => k < 5);
    await play(call, device, { answers: wrongAt(...misses) });
  }
  const me = devices[7];
  const board = await call('GET', `/v1/board/2026-10-04?device=${me}`);
  assert.equal(board.status, 200);
  assert.equal(board.body.total, 15, 'the unlisted player is not counted');
  assert.equal(board.body.top.length, 15);
  assert.ok(board.body.top.every((row, i, all) => i === 0 || all[i - 1].points >= row.points), 'sorted by points');
  assert.ok(!JSON.stringify(board.body).includes('00000000-0000-4000'), 'no device id is ever returned');
  assert.equal(board.body.top.filter(r => r.me).length, 1);
  assert.equal(board.body.me.listed, true);
  assert.equal(board.body.me.nickname, 'שחקן 8');
  assert.ok(board.body.me.above.length <= 5 && board.body.me.below.length <= 5);
  assert.ok(board.body.me.above.every(r => r.points >= board.body.me.points));
  assert.ok(board.body.me.below.every(r => r.points <= board.body.me.points));
  const at = board.body.top.findIndex(r => r.me);
  assert.equal(board.body.me.above.length, Math.min(5, at));
  assert.equal(board.body.me.below.length, Math.min(5, board.body.top.length - 1 - at));
  assert.deepEqual(board.body.me.above.map(r => r.nickname), board.body.top.slice(Math.max(0, at - 5), at).map(r => r.nickname), 'the same order as the top list');
  const top = board.body.top[0];
  assert.equal(top.rank, 1);
  // leaving the board: off the list, my points kept; back on: listed again
  await call('POST', '/v1/nickname', { device: me, board: false });
  const after = await call('GET', `/v1/board/2026-10-04?device=${me}`);
  assert.equal(after.body.total, 14);
  assert.equal(after.body.me.listed, false);
  assert.equal(after.body.me.rank, null);
  assert.ok(after.body.me.points > 0);
  await call('POST', '/v1/nickname', { device: me, board: true });
  assert.equal((await call('GET', `/v1/board/2026-10-04?device=${me}`)).body.total, 15);
  // the unlisted player sees their points but no place
  const hidden = await call('GET', `/v1/board/2026-10-04?device=${devices[15]}`);
  assert.equal(hidden.body.me.listed, false);
});

test('DELETE /v1/me erases the device: its submission, start, week, nickname (free again) — the day\'s anonymous counts stay', async () => {
  const { call, store } = setup();
  const device = uuid(31);
  await call('POST', '/v1/nickname', { device, nickname: 'דוד', board: true });
  await play(call, device);
  assert.equal((await call('GET', '/v1/board/2026-10-04')).body.total, 1);
  const del = await call('DELETE', '/v1/me', { device });
  assert.deepEqual(del.body, { ok: true });
  assert.equal(await store.getPlayer(device), null);
  assert.equal(await store.getSubmission(device, DAY), null);
  assert.equal(await store.getStart(device, DAY), null);
  assert.equal(await store.weekEntry('2026-10-04', device), null);
  assert.equal((await call('GET', '/v1/board/2026-10-04')).body.total, 0);
  assert.equal((await call('POST', '/v1/nickname', { device: uuid(32), nickname: 'דוד' })).status, 200, 'the nickname is free again');
  assert.equal((await call('GET', `/v1/day/${DAY}`)).body.n, 1, 'anonymous counters are not personal data');
});
