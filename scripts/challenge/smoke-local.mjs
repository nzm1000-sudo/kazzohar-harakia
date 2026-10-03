#!/usr/bin/env node
// האתגר העולמי — an end-to-end run against a running Worker (by default the local one: `wrangler dev --local --env dev`).
//   node scripts/challenge/smoke-local.mjs [http://127.0.0.1:8787]
// Plays the day with a few fresh devices through the real routes and D1 (start → submit → day → nickname → change →
// taken / freed / limit → impossible timing → board → a second submission refused → delete), and prints what it saw. Exit 1 on the first surprise. Never run against the
// live server without the owner's say: it writes rows.
import { randomUUID } from 'node:crypto';
import KEY from '../../server/challenge-worker/src/key.mjs';
import { closedReason, shiftDateKey, keyOfUTC, weekKeyOf } from '../../src/services/globalChallenge/calendar.mjs';

const base = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const origin = 'http://localhost:5498';
const today = keyOfUTC(new Date());
const candidates = [shiftDateKey(today, -1), today, shiftDateKey(today, 1)];
let date = null; let il = true;
for (const d of candidates) for (const regime of [true, false]) if (!date && KEY.days[d] && !closedReason(d, { il: regime })) { date = d; il = regime; }
if (!date) { console.error(`no open scheduled day around ${today}`); process.exit(1); }
const rows = KEY.days[date];

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, { method, headers: { origin, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, cors: res.headers.get('access-control-allow-origin') };
}
const expect = (cond, message, extra) => { if (!cond) { console.error(`✗ ${message}`, extra ?? ''); process.exit(1); } console.log(`✓ ${message}`); };

const devices = [randomUUID(), randomUUID(), randomUUID()];
console.log(`${base} · day ${date} (${il ? 'Israel' : 'diaspora'}) · week ${weekKeyOf(date)}`);
const before = await call('GET', `/v1/day/${date}`);
expect(before.status === 200 && before.cors === origin, 'GET day (CORS for the dev origin)', before);
for (const [i, device] of devices.entries()) {
  const start = await call('POST', '/v1/start', { device, date, il });
  expect(start.status === 200 && /^\d+\.[0-9a-f]{64}$/.test(start.data.token), `start #${i + 1}`, start);
  const answers = rows.map(([qid, answer], k) => ({ qid, choice: k < 5 - i ? answer : (answer + 1) % 4, ms: 3000 + k * 100 }));
  const submit = await call('POST', '/v1/submit', { device, date, il, token: start.data.token, answers });
  expect(submit.status === 200 && submit.data.verified && submit.data.score.correct === 5 - i, `submit #${i + 1}: ${submit.data?.score?.correct}/5, day n=${submit.data?.day?.n}`, submit);
}
const again = await call('POST', '/v1/submit', { device: devices[0], date, il, token: null, answers: rows.map(([qid, a]) => ({ qid, choice: a, ms: 1000 })) });
expect(again.status === 409 && again.data.error === 'already', 'a second submission is refused', again);
const day = await call('GET', `/v1/day/${date}`);
expect(day.data.n >= before.data.n + 3, `day: n=${day.data.n}, percents ${day.data.percents.join('/')}, h ${day.data.h.join(',')}`, day);
const nick = `בודק ${Math.floor(Math.random() * 9000 + 1000)}`;
const set = await call('POST', '/v1/nickname', { device: devices[1], nickname: nick, board: true });
expect(set.status === 200 && set.data.board === true, `nickname "${nick}" and the board`, set);
const renamed = `שונה ${Math.floor(Math.random() * 9000 + 1000)}`;
const change = await call('POST', '/v1/nickname', { device: devices[1], nickname: renamed });
expect(change.status === 200 && change.data.nickname === renamed && change.data.board === true, `nickname changed to "${renamed}" (the board kept)`, change);
const taken = await call('POST', '/v1/nickname', { device: devices[0], nickname: renamed.replace('שונה', 'שׁוֹנֶה') });
expect(taken.status === 409 && taken.data.error === 'taken', 'the new name is taken (niqqud ignored)', taken);
const freed = await call('POST', '/v1/nickname', { device: devices[0], nickname: nick });
expect(freed.status === 200 && freed.data.nickname === nick, 'the old name is free at once', freed);
let limited = null;
for (let i = 0; i < 6 && !limited; i += 1) { const r = await call('POST', '/v1/nickname', { device: devices[2], nickname: `מחליף ${i + 1}` }); if (r.status !== 200) limited = r; }
expect(limited?.status === 409 && limited.data.error === 'limit', 'the sixth change in a day is refused (limit)', limited);
const fast = randomUUID();
const fastStart = await call('POST', '/v1/start', { device: fast, date, il });
const forged = await call('POST', '/v1/submit', { device: fast, date, il, token: fastStart.data.token, answers: rows.map(([qid, a]) => ({ qid, choice: a, ms: 29000 })) });
expect(forged.status === 400 && forged.data.error === 'timing', 'answers claiming more time than has passed are refused (timing)', forged);
const reserved = await call('POST', '/v1/nickname', { device: devices[2], nickname: 'admin' });
expect(reserved.status === 400 && reserved.data.reason === 'reserved', 'a reserved nickname is refused', reserved);
const board = await call('GET', `/v1/board/${weekKeyOf(date)}?device=${devices[1]}`);
expect(board.status === 200 && board.data.me?.listed && board.data.me.rank >= 1 && board.data.me.nickname === renamed, `board: total ${board.data.total}, my place ${board.data.me?.rank} with ${board.data.me?.points} points`, board);
const del = await call('DELETE', '/v1/me', { device: devices[1] });
expect(del.status === 200, 'delete my data', del);
const gone = await call('GET', `/v1/board/${weekKeyOf(date)}?device=${devices[1]}`);
expect(gone.data.me === null, 'after delete: nothing of the device remains on the board', gone);
const evil = await fetch(`${base}/v1/day/${date}`, { headers: { origin: 'https://evil.example' } });
expect(evil.status === 403, 'a foreign origin is refused');
console.log('smoke: ok');
