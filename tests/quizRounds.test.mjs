// שעשועון טריוויה יהודי — the challenge (still "אתגר יומי") renews every four hours of the device's clock: the same
// fifteen questions for everyone in a round, one play a round, a countdown to the next, results kept per round, the
// stored one-a-day results migrated safely, and the share text naming the round.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBank, indexBank } from '../src/services/quiz/bank.mjs';
import { createLadder, ladderPick, answerLadder, walkAway, ladderSummary, dailyPlan, dailyShareText, pointsAt } from '../src/services/quiz/ladder.mjs';
import { emptyState, normalizeState, applyLadderEnd, dailyResult, quizSummary, windowKey, windowOf, windowLabel, isWindowKey, msToNextWindow, DAILY_WINDOW_HOURS, DAILY_ROUNDS } from '../src/services/quiz/store.mjs';
import { formatCountdown, personalRecords } from '../src/services/quiz/records.mjs';
import { SAMPLE } from './fixtures/quizSample.mjs';

const bank = indexBank(validateBank({ 'sample.mjs': SAMPLE }).questions);
const at = (h, m = 0, s = 0, d = 1) => new Date(2026, 9, d, h, m, s).getTime();

test('six four-hour rounds a day by the local clock: 00–04, 04–08 … 20–24; the boundaries are exact', () => {
  assert.equal(DAILY_WINDOW_HOURS, 4);
  assert.equal(DAILY_ROUNDS, 6);
  assert.equal(windowKey(at(0)), '2026-10-01@00');
  assert.equal(windowKey(at(3, 59, 59)), '2026-10-01@00');
  assert.equal(windowKey(at(4)), '2026-10-01@04');
  assert.equal(windowKey(at(13, 40)), '2026-10-01@12');
  assert.equal(windowKey(at(15, 59, 59)), '2026-10-01@12');
  assert.equal(windowKey(at(16)), '2026-10-01@16');
  assert.equal(windowKey(at(23, 59, 59)), '2026-10-01@20');
  assert.equal(windowKey(at(0, 0, 0, 2)), '2026-10-02@00', 'midnight opens the next day\'s first round');
  const w = windowOf('2026-10-01@12');
  assert.deepEqual({ round: w.round, hours: w.hours, day: w.day }, { round: 4, hours: '12:00–16:00', day: '2026-10-01' });
  assert.equal(w.start, at(12)); assert.equal(w.end, at(16));
  assert.equal(windowOf('2026-10-01@20').hours, '20:00–00:00');
  assert.equal(windowOf('2026-10-01@00').round, 1);
  for (const bad of ['2026-10-01', '2026-10-01@13', '2026-10-01@24', 'x@04', null]) assert.equal(isWindowKey(bad), false, String(bad));
  assert.equal(windowLabel('2026-10-01@12'), 'סבב 4 · ⁦12:00–16:00⁩', 'the hours kept left-to-right inside Hebrew');
});

test('the countdown runs to the next round, not to midnight', () => {
  assert.equal(msToNextWindow(at(13, 40)), (2 * 60 + 20) * 60000);
  assert.equal(formatCountdown(msToNextWindow(at(13, 40))), '02:20:00');
  assert.equal(msToNextWindow(at(15, 59, 30)), 30000);
  assert.equal(msToNextWindow(at(16)), 4 * 3600000, 'a new round has its whole four hours');
  assert.equal(msToNextWindow(at(23, 0)), 3600000, 'the last round ends at midnight');
  for (let h = 0; h < 24; h += 1) assert.ok(msToNextWindow(at(h, 7)) <= 4 * 3600000 && msToNextWindow(at(h, 7)) > 0);
});

test('the same fifteen questions for everyone in a round (deterministic by the date and the round); a new round, new questions', () => {
  const key = windowKey(at(13, 40));
  assert.deepEqual(dailyPlan(bank, key), dailyPlan(bank, windowKey(at(12, 1))), 'anyone in the same round');
  assert.deepEqual(dailyPlan(bank, key), dailyPlan(indexBank([...bank.questions].reverse()), key), 'independent of the bank\'s order');
  assert.notDeepEqual(dailyPlan(bank, '2026-10-01@12').map(s => s[0]), dailyPlan(bank, '2026-10-01@16').map(s => s[0]), 'the next round differs');
  assert.notDeepEqual(dailyPlan(bank, '2026-10-01@12').map(s => s[0]), dailyPlan(bank, '2026-10-02@12').map(s => s[0]), 'the same hours tomorrow differ');
});

test('one play a round: the first result of the round stands; the next round is open; records count every round', () => {
  const play = (key, n, now) => {
    let l = createLadder({ daily: key, plan: dailyPlan(bank, key) });
    for (let i = 0; i < n; i += 1) { const q = ladderPick(l, bank); l = answerLadder(l, q, q.answer).ladder; }
    return ladderSummary(walkAway(l));
  };
  let state = applyLadderEnd(emptyState(), play('2026-10-01@12', 4, at(13)), at(13));
  assert.equal(dailyResult(state, '2026-10-01@12').climbed, 4);
  state = applyLadderEnd(state, play('2026-10-01@12', 9, at(14)), at(14));
  assert.equal(dailyResult(state, '2026-10-01@12').climbed, 4, 'one play a round');
  assert.equal(quizSummary(state, at(15, 59)).dailyDone, true);
  assert.equal(quizSummary(state, at(16)).dailyDone, false, 'the next round opens at 16:00');
  assert.equal(dailyResult(state, '2026-10-01@16'), null);
  state = applyLadderEnd(state, play('2026-10-01@16', 7, at(16, 5)), at(16, 5));
  assert.equal(dailyResult(state, '2026-10-01@16').climbed, 7);
  assert.equal(Object.keys(state.ladder.daily).length, 2);
  assert.equal(personalRecords(state, at(17)).bestDaily, pointsAt(7));
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))).ladder.daily, state.ladder.daily, 'rounds survive a round trip');
});

test('migration: the stored one-a-day results move to the round they were played in, nothing is lost or doubled', () => {
  const marks = [...Array(5).fill('right'), 'wrong', ...Array(9).fill('open')];
  const old = { ladder: { best: 6, daily: {
    '2026-09-30': { climbed: 5, banked: 300, status: 'lost', marks, at: new Date(2026, 8, 30, 10, 15).getTime() },
    '2026-09-29': { climbed: 3, banked: 100, status: 'walked', marks, at: 0 },
    '2026-09-28': { climbed: 2, banked: 50, status: 'walked', marks, at: new Date(2026, 9, 3, 9).getTime() },
    '2026-09-30@08': { climbed: 9, banked: 900, status: 'walked', marks, at: new Date(2026, 8, 30, 11).getTime() },
    junk: { climbed: 1 },
  } } };
  const daily = normalizeState(old).ladder.daily;
  assert.deepEqual(Object.keys(daily).sort(), ['2026-09-28@00', '2026-09-29@00', '2026-09-30@08']);
  assert.equal(daily['2026-09-30@08'].climbed, 5, 'two results in one round: the first played stands');
  assert.equal(daily['2026-09-29@00'].banked, 100, 'no time: the day\'s first round');
  assert.equal(daily['2026-09-28@00'].banked, 50, 'a time on another day: the day\'s first round');
  assert.deepEqual(normalizeState({ ladder: { daily } }).ladder.daily, daily, 'migrating twice changes nothing');
  assert.equal(personalRecords({ ...emptyState(), ladder: normalizeState(old).ladder }).bestDaily, 300);
});

test('the share text names the round (and never a question or an answer)', () => {
  const key = '2026-10-01@12';
  let l = createLadder({ daily: key, plan: dailyPlan(bank, key) });
  for (let i = 0; i < 6; i += 1) { const q = ladderPick(l, bank); l = answerLadder(l, q, q.answer).ladder; }
  const s = ladderSummary(walkAway(l));
  const text = dailyShareText({ dateLabel: 'כ׳ תשרי', roundLabel: windowLabel(key), climbed: s.climbed, banked: s.banked, marks: s.marks, status: s.status });
  assert.match(text, /^שעשועון טריוויה יהודי · אתגר יומי\nכ׳ תשרי · סבב 4 · ⁦12:00–16:00⁩\n/);
  for (const r of l.results) { const q = bank.byId.get(r.id); assert.ok(!text.includes(q.q)); q.options.forEach(o => assert.ok(!text.includes(o))); }
});
