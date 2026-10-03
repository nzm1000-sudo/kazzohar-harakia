// האתגר העולמי — the server's routes, over any store (D1 in the Worker — d1Store.mjs; memory in the tests —
// memoryStore.mjs). createApp(...) returns handle(request) → Response.
//
//   GET    /v1/day/:date            the day's global numbers (counters, never a scan)
//   POST   /v1/start                { device, date, il } → { token, startedAt, budgetMs } (the first start stands)
//   POST   /v1/submit               { device, date, il, token|null, answers: [{ qid, choice, ms }] × 5 } → the score
//   GET    /v1/board/:week?device=  the week's top 100 and the device's place with five above and five below
//   POST   /v1/nickname             { device, nickname?, board? } — the nickname (chosen or changed, ≤ 5 a day) and the board opt-in
//   DELETE /v1/me                   { device } — erases every row of the device
//
// A submission with a valid token, within its time budget (five 30-second clocks and a 20-second grace from the
// server's start; answers never claiming more time than has passed), is "verified" and earns the week's points; an
// answer over its own 30 seconds (and a beat) scores 0. One without a token (played offline, sent later) counts in the
// day's numbers only. One submission per device and day.
import { closedReason, weekKeyOf, isDateKey } from '../../../src/services/globalChallenge/calendar.mjs';
import { answersProblem, scoreAnswers, timingProblem, TIME_BUDGET_MS, QUESTION_MS, MAX_ANSWER_MS, GLOBAL_SIZE, correctPercents } from '../../../src/services/globalChallenge/scoring.mjs';
import { checkNickname, NICK_CHANGES_PER_DAY } from '../../../src/services/globalChallenge/nickname.mjs';
import { originAllowed, corsHeaders, isDevice, dateInWindow, weekInRange, utcToday, signStart, verifyStart, ipTag, LIMITS, createMemoryLimiter, hourBucket, dayBucket,
  rankFromHist, histTotal, json, MAX_BODY } from './logic.mjs';

export const BOARD_TOP = 100;
export const BOARD_AROUND = 5;
const CACHE_MS = 20 * 1000;

export function createApp({ store, secret, key, now = () => Date.now(), allowedOrigins, dev = false, rateLimiter = null } = {}) {
  if (!secret || secret.length < 16) throw new Error('TOKEN_SECRET must be set (16+ characters)');
  const originOptions = { allowed: allowedOrigins, dev };
  const ipLimiter = createMemoryLimiter({ max: LIMITS.ipPerMinute });
  const deviceLimiter = createMemoryLimiter({ max: LIMITS.devicePerMinute });
  const cache = new Map();
  const cached = async (k, make) => {
    const hit = cache.get(k);
    const t = now();
    if (hit && t - hit.at < CACHE_MS) return hit.value;
    const value = await make();
    cache.set(k, { at: t, value });
    if (cache.size > 500) cache.clear();
    return value;
  };
  const invalidate = prefix => { for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k); };

  const keyRows = date => key?.days?.[date] || null;

  async function readBody(request) {
    const text = await request.text();
    if (text.length > MAX_BODY) return { error: 'too-large' };
    try { const body = JSON.parse(text || '{}'); return body && typeof body === 'object' && !Array.isArray(body) ? { body } : { error: 'json' }; } catch { return { error: 'json' }; }
  }
  // The writes' durable limits: per IP per hour, per device per day.
  async function writeAllowed(ip, device) {
    const t = now();
    if (rateLimiter) { const { success } = await rateLimiter.limit({ key: `w:${ip}` }); if (!success) return false; }
    else if ((await store.hit(`ip:${ip}:${hourBucket(t)}`, (hourBucket(t) + 2) * 3600000)) > LIMITS.ipWritesPerHour) return false;
    if (device && (await store.hit(`dev:${device}:${dayBucket(t)}`, (dayBucket(t) + 2) * 86400000)) > LIMITS.deviceWritesPerDay) return false;
    return true;
  }

  async function dayStats(date) {
    return cached(`day:${date}`, async () => {
      const s = (await store.getDayStats(date)) || { n: 0, c: Array(GLOBAL_SIZE).fill(0), h: Array(GLOBAL_SIZE + 1).fill(0) };
      return { date, n: s.n, c: s.c, h: s.h, percents: correctPercents(s) };
    });
  }

  const routes = {
    async getDay({ params }) {
      const { date } = params;
      // A scheduled day up to tomorrow (UTC) — never a future day's numbers.
      if (!isDateKey(date) || !keyRows(date) || (date > utcToday(now()) && !dateInWindow(date, now()))) return json({ error: 'date' }, 400);
      return json(await dayStats(date), 200, { 'cache-control': 'public, max-age=15' });
    },

    async start({ body, ip }) {
      const { device, date, il } = body;
      if (!isDevice(device)) return json({ error: 'device' }, 400);
      if (typeof il !== 'boolean') return json({ error: 'il' }, 400);
      if (!dateInWindow(date, now())) return json({ error: 'window' }, 422);
      if (closedReason(date, { il })) return json({ error: 'closed', reason: closedReason(date, { il }) }, 422);
      if (!keyRows(date)) return json({ error: 'no-key' }, 404);
      if (!(await writeAllowed(ip, device))) return json({ error: 'rate' }, 429, { 'retry-after': '3600' });
      if (await store.getSubmission(device, date)) return json({ error: 'already' }, 409);
      const startedAt = await store.putStart(device, date, now());
      return json({ token: await signStart(secret, { device, date, startedAt }), startedAt, budgetMs: TIME_BUDGET_MS, questionMs: QUESTION_MS, answerMaxMs: MAX_ANSWER_MS });
    },

    async submit({ body, ip }) {
      const { device, date, il, token = null, answers } = body;
      if (!isDevice(device)) return json({ error: 'device' }, 400);
      if (typeof il !== 'boolean') return json({ error: 'il' }, 400);
      if (!dateInWindow(date, now())) return json({ error: 'window' }, 422);
      if (closedReason(date, { il })) return json({ error: 'closed', reason: closedReason(date, { il }) }, 422);
      const rows = keyRows(date);
      if (!rows) return json({ error: 'no-key' }, 404);
      const problem = answersProblem(rows, answers);
      if (problem) return json({ error: problem }, 400);
      let verified = false;
      if (token !== null) {
        const startedAt = await verifyStart(secret, token, { device, date });
        const recorded = startedAt === null ? null : await store.getStart(device, date);
        if (startedAt === null || recorded !== startedAt) return json({ error: 'token' }, 400);
        // 30 seconds a question, by the server's clock: the whole game within five clocks and the grace ('late'), and
        // never more time claimed than has passed ('timing'). An answer over its own clock scores 0 (scoreAnswers).
        const timing = timingProblem(answers, now() - startedAt);
        if (timing) return json({ error: timing }, timing === 'late' ? 409 : 400);
        verified = true;
      }
      if (!(await writeAllowed(ip, device))) return json({ error: 'rate' }, 429, { 'retry-after': '3600' });
      const score = scoreAnswers(rows, answers);
      const inserted = await store.insertSubmission({ device, date, correct: score.correct, points: score.points, verified, at: now() });
      if (!inserted) return json({ error: 'already' }, 409);
      await store.addDayStats(date, score.perQuestion);
      invalidate(`day:${date}`);
      if (verified && score.points >= 0) {
        const player = await store.getPlayer(device);
        const week = weekKeyOf(date);
        await store.addWeekPoints({ week, device, points: score.points, at: now(), listed: Boolean(player?.board && player?.nickname) });
        invalidate(`board:${week}`);
      }
      return json({ verified, score, day: await dayStats(date) });
    },

    async board({ params, query }) {
      const { week } = params;
      if (!weekInRange(week, now())) return json({ error: 'week' }, 400);
      const device = query.get('device');
      if (device !== null && !isDevice(device)) return json({ error: 'device' }, 400);
      const { top, hist } = await cached(`board:${week}`, async () => ({ top: await store.weekTop(week, BOARD_TOP), hist: await store.weekHist(week) }));
      const total = histTotal(hist);
      const view = row => ({ rank: rankFromHist(hist, row.points), nickname: row.nickname, points: row.points });
      let me = null;
      if (device) {
        const entry = await store.weekEntry(week, device);
        const player = await store.getPlayer(device);
        if (entry || player) {
          const listed = Boolean(entry?.listed);
          me = { points: entry?.points || 0, listed, nickname: player?.nickname || null, rank: listed ? rankFromHist(hist, entry.points) : null, above: [], below: [] };
          if (listed) {
            const around = await store.weekAround(week, { device, points: entry.points, reached: entry.reached }, BOARD_AROUND);
            me.above = around.above.map(view);
            me.below = around.below.map(view);
          }
        }
      }
      return json({ week, total, top: top.map(row => ({ ...view(row), me: Boolean(device && row.device === device) })), me });
    },

    async nickname({ body, ip }) {
      const { device } = body;
      if (!isDevice(device)) return json({ error: 'device' }, 400);
      if (body.nickname === undefined && body.board === undefined) return json({ error: 'empty' }, 400);
      if (body.board !== undefined && typeof body.board !== 'boolean') return json({ error: 'board' }, 400);
      if (body.nickname !== undefined && (typeof body.nickname !== 'string' || body.nickname.length > 60)) return json({ error: 'nickname', reason: 'length' }, 400);
      if (!(await writeAllowed(ip, device))) return json({ error: 'rate' }, 429, { 'retry-after': '3600' });
      let player = await store.getPlayer(device);
      if (body.nickname !== undefined) {
        const check = checkNickname(body.nickname);
        if (!check.ok) return json({ error: 'nickname', reason: check.reason }, 400);
        // Chosen or changed, any time: one atomic write of the device's row. The old name is free at once; a name
        // another device holds is 'taken'; more than NICK_CHANGES_PER_DAY writes on one UTC day is 'limit'. The same
        // nickname again is no change at all (not counted).
        if (player?.nickname !== check.nickname) {
          const result = await store.setNickname({ device, nickname: check.nickname, nickKey: check.key, day: dayBucket(now()), max: NICK_CHANGES_PER_DAY, at: now() });
          if (result === 'taken') return json({ error: 'taken' }, 409);
          if (result === 'limit') return json({ error: 'limit', nickname: player?.nickname || null }, 409);
          if (player?.board) invalidate('board:');
          player = await store.getPlayer(device);
        }
      }
      if (body.board !== undefined) {
        if (body.board && !player?.nickname) return json({ error: 'need-nickname' }, 400);
        if (player) { await store.setBoard(device, body.board); invalidate('board:'); player = await store.getPlayer(device); }
      }
      return json({ nickname: player?.nickname || null, board: Boolean(player?.board) });
    },

    async deleteMe({ body, query, ip }) {
      const device = body?.device ?? query.get('device');
      if (!isDevice(device)) return json({ error: 'device' }, 400);
      if (!(await writeAllowed(ip, null))) return json({ error: 'rate' }, 429, { 'retry-after': '3600' });
      await store.deleteDevice(device);
      invalidate('board:');
      return json({ ok: true });
    },
  };

  return async function handle(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const cors = corsHeaders(origin, originOptions);
    const finish = response => { for (const [k, v] of Object.entries(cors)) response.headers.set(k, v); return response; };
    if (!originAllowed(origin, originOptions)) return finish(json({ error: 'origin' }, 403));
    if (request.method === 'OPTIONS') return finish(new Response(null, { status: 204 }));
    const rawIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const ip = await ipTag(secret, rawIp);
    const t = now();
    if (!ipLimiter.hit(ip, t)) return finish(json({ error: 'rate' }, 429, { 'retry-after': '60' }));
    const path = url.pathname.replace(/\/+$/, '');
    let match;
    try {
      if (request.method === 'GET' && (match = /^\/v1\/day\/([0-9-]{10})$/.exec(path))) return finish(await routes.getDay({ params: { date: match[1] } }));
      if (request.method === 'GET' && (match = /^\/v1\/board\/([0-9-]{10})$/.exec(path))) {
        const device = url.searchParams.get('device');
        if (device && !deviceLimiter.hit(device, t)) return finish(json({ error: 'rate' }, 429, { 'retry-after': '60' }));
        return finish(await routes.board({ params: { week: match[1] }, query: url.searchParams }));
      }
      const writes = { 'POST /v1/start': 'start', 'POST /v1/submit': 'submit', 'POST /v1/nickname': 'nickname', 'DELETE /v1/me': 'deleteMe' };
      const name = writes[`${request.method} ${path}`];
      if (!name) return finish(json({ error: 'route' }, 404));
      const read = await readBody(request);
      if (read.error) return finish(json({ error: read.error }, read.error === 'too-large' ? 413 : 400));
      const device = read.body.device;
      if (isDevice(device) && !deviceLimiter.hit(device, t)) return finish(json({ error: 'rate' }, 429, { 'retry-after': '60' }));
      return finish(await routes[name]({ body: read.body, query: url.searchParams, ip }));
    } catch (error) {
      return finish(json({ error: 'server' }, 500));
    }
  };
}

export async function scheduled(store, now = Date.now()) { await store.cleanup(now); }
