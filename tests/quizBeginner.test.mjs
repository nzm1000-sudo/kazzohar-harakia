// שעשועון טריוויה יהודי — הסולם's second track, מסלול למתחילים: three mistakes are allowed; after a mistake (a wrong answer
// or the clock) the game goes on at the same step with another question; the third mistake ends it. מסלול אלוף stays
// one mistake, and so does the daily challenge. The beginner's records are kept apart (never the champion's), a game
// left in the middle resumes with its track and lives, the choice is remembered, and the start button stays first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Module, createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { validateBank, indexBank } from '../src/services/quiz/bank.mjs';
import { createLadder, ladderPick, answerLadder, clearAids, walkAway, ladderSummary, ladderMarks, seededRandom, dailyPlan, pointsAt, safeFloor,
  TRACKS, BEGINNER_LIVES, trackOf, livesLeft, runOf } from '../src/services/quiz/ladder.mjs';
import { emptyState, normalizeState, applyLadderEnd, readLadderTrack, writeLadderTrack, LADDER_TRACK_KEY } from '../src/services/quiz/store.mjs';
import { personalRecords } from '../src/services/quiz/records.mjs';
import { ACHIEVEMENTS } from '../src/services/quiz/achievements.mjs';
import { makeSnapshot, saveSession, readSession, decideResume, ladderState, restoreLadder, validForBank } from '../src/services/quiz/sessionResume.mjs';
import { SAMPLE } from './fixtures/quizSample.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = fileURLToPath(new URL('..', import.meta.url));
function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', loader: { '.jsx': 'jsx', '.css': 'empty' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false }) }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}
const bank = indexBank(validateBank({ 'sample.mjs': SAMPLE }).questions);
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('denied'); } };
const wrongOf = q => (q.answer + 1) % 4;
const pick = (l, i = 0) => ladderPick(l, bank, { rng: seededRandom(i) });
const right = (l, i = 0) => { const q = pick(l, i); return clearAids(answerLadder(l, q, q.answer).ladder); };
const route = 'leatzmi/quiz/ladder';
const T0 = Date.UTC(2026, 9, 1, 9, 0, 0);
const MIN = 60 * 1000;

// ---------- the rules ----------
test('two tracks: מסלול אלוף · טעות אחת, מסלול למתחילים · שלוש טעויות; a beginner game starts with three lives', () => {
  assert.deepEqual(TRACKS.map(t => `${t.name} · ${t.detail}`), ['מסלול אלוף · טעות אחת', 'מסלול למתחילים · שלוש טעויות']);
  assert.equal(BEGINNER_LIVES, 3);
  const b = createLadder({ track: 'beginner' });
  assert.equal(trackOf(b), 'beginner');
  assert.equal(livesLeft(b), 3);
  const c = createLadder();
  assert.equal(trackOf(c), 'champion');
  assert.equal(livesLeft(c), 1);
  assert.equal(trackOf(createLadder({ track: 'nonsense' })), 'champion');
  // The daily challenge is the same game for everyone: always one mistake, whatever was chosen.
  const day = '2026-10-01@08';
  const d = createLadder({ daily: day, plan: dailyPlan(bank, day), track: 'beginner' });
  assert.equal(trackOf(d), 'champion');
  assert.equal(livesLeft(d), 1);
  const q = pick(d);
  assert.equal(answerLadder(d, q, wrongOf(q)).ladder.status, 'lost');
});

test('after a mistake the game continues on the same step with a fresh question; the points are held, a life is lost', () => {
  let l = right(right(createLadder({ track: 'beginner' }), 1), 2); // two steps up
  assert.equal(l.climbed, 2);
  const q = pick(l, 3);
  const { ladder: next, result } = answerLadder(l, q, wrongOf(q));
  assert.equal(result.correct, false);
  assert.equal(result.status, 'playing');
  assert.equal(result.lives, 2);
  assert.equal(result.step, 3);
  assert.equal(next.status, 'playing');
  assert.equal(next.climbed, 2, 'no step lost — no restart');
  assert.equal(next.banked, pointsAt(2), 'the points held stay');
  assert.equal(livesLeft(next), 2);
  // The next question: the same step (3), never the one just missed.
  const fresh = pick(clearAids(next), 4);
  assert.ok(fresh && fresh.id !== q.id);
  const after = answerLadder(clearAids(next), fresh, fresh.answer);
  assert.equal(after.result.step, 3, 'the same step again');
  assert.equal(after.ladder.climbed, 3);
  assert.equal(livesLeft(after.ladder), 2, 'a right answer gives no life back');
  // A timeout is a mistake like any other (no choice).
  const t = answerLadder(after.ladder, pick(after.ladder, 5), null);
  assert.equal(t.result.correct, false);
  assert.equal(t.ladder.status, 'playing');
  assert.equal(livesLeft(t.ladder), 1);
  // The marks: a step climbed after a mistake reads right; the run counts from the last mistake.
  assert.equal(ladderMarks(after.ladder)[2], 'right');
  assert.equal(runOf(after.ladder), 1);
  assert.equal(runOf(right(right(createLadder({ track: 'beginner' })), 1)), 2);
});

test('the third mistake ends the game, the points falling to the last safe step (as the champion\'s one mistake)', () => {
  let l = createLadder({ track: 'beginner' });
  for (let i = 0; i < 6; i++) l = right(l, i);
  assert.equal(l.climbed, 6);
  const statuses = [];
  for (let k = 0; k < 3; k++) {
    const q = pick(l, 20 + k);
    const { ladder, result } = answerLadder(l, q, wrongOf(q));
    statuses.push(result.status);
    l = clearAids(ladder);
  }
  assert.deepEqual(statuses, ['playing', 'playing', 'lost']);
  assert.equal(l.status, 'lost');
  assert.equal(livesLeft(l), 0);
  assert.equal(l.climbed, 6);
  assert.equal(l.banked, safeFloor(6));
  assert.equal(pick(l), null, 'nothing more is asked');
  const s = ladderSummary(l);
  assert.equal(s.track, 'beginner');
  assert.equal(s.mistakes, 3);
  assert.equal(s.answered, 9);
  // The champion's track is untouched: the first mistake ends it.
  const c = right(createLadder(), 0);
  const q = pick(c, 1);
  const lost = answerLadder(c, q, wrongOf(q));
  assert.equal(lost.ladder.status, 'lost');
  assert.equal(lost.result.lives, 0);
  assert.equal(lost.ladder.banked, safeFloor(1));
  // Reaching step 15 ends a beginner game too — won, whatever lives are left.
  let w = createLadder({ track: 'beginner' });
  const q1 = pick(w, 1); w = clearAids(answerLadder(w, q1, wrongOf(q1)).ladder);
  for (let i = 0; i < 15; i++) w = right(w, 40 + i);
  assert.equal(w.status, 'won');
  assert.equal(w.climbed, 15);
  assert.equal(livesLeft(w), 2);
});

// ---------- the records ----------
test('records: a beginner game never touches the champion\'s records — its best kept apart (שיא למתחילים)', () => {
  const now = T0;
  let st = applyLadderEnd(emptyState(), { kind: 'ladder', track: 'champion', status: 'lost', climbed: 4, banked: 0, marks: [] }, now);
  const champ = JSON.parse(JSON.stringify(st.ladder));
  st = applyLadderEnd(st, { kind: 'ladder', track: 'beginner', status: 'won', climbed: 15, banked: 1800, marks: [] }, now);
  for (const k of ['games', 'wins', 'best', 'bestPoints', 'total', 'log', 'daily']) assert.deepEqual(st.ladder[k], champ[k], `champion ${k} untouched`);
  assert.deepEqual({ ...st.ladder.beginner, log: undefined }, { games: 1, wins: 1, best: 15, bestPoints: 1800, total: 1800, log: undefined });
  const r = personalRecords(st, now);
  assert.equal(r.bestLadder, 4, 'the 4/15 stays the champion\'s');
  assert.equal(r.week.points, 0, 'the week\'s chart: the champion\'s games only');
  assert.equal(r.beginner.best, 15);
  // The ladder achievements are the champion's (a beginner's fifteen steps earn no "סיום הסולם").
  const facts = { ...st, stage: 0, session: { answered: 1, correct: 1, bestRun: 1, maxDifficultyRun: 0 } };
  for (const id of ['ladder-5', 'ladder-10', 'ladder-15']) assert.equal(ACHIEVEMENTS.find(a => a.id === id).test(facts), false, id);
  // Kept across a write and read, and a record from before the tracks reads with an empty beginner record.
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(st))).ladder.beginner, st.ladder.beginner);
  assert.deepEqual(normalizeState({ schemaVersion: 1, ladder: { best: 7 } }).ladder.beginner, { games: 0, wins: 0, best: 0, bestPoints: 0, total: 0, log: {} });
  // A daily summary never counts as a beginner one.
  const d = applyLadderEnd(emptyState(), { kind: 'daily', day: '2026-10-01@08', track: 'beginner', status: 'lost', climbed: 2, banked: 0, marks: Array(15).fill('open') }, now);
  assert.equal(d.ladder.games, 1);
  assert.equal(d.ladder.beginner.games, 0);
});

test('the records panel shows שיא למתחילים only once a beginner game was played, apart from the four tiles', () => {
  const { RecordsPanel } = loadJsx('components/quiz/ArenaParts.jsx');
  const html = st => renderToStaticMarkup(React.createElement(RecordsPanel, { quiz: st, now: T0 }));
  assert.doesNotMatch(html(emptyState()), /qz-rec-beginner/);
  const st = applyLadderEnd(emptyState(), { kind: 'ladder', track: 'beginner', status: 'lost', climbed: 9, banked: 300, marks: [] }, T0);
  const out = html(st);
  assert.match(out, /class="qz-rec-beginner"><span>שיא למתחילים<\/span><b>9<small>\/15<\/small><\/b>/);
  assert.match(out, /<span aria-hidden="true">סולם<\/span><\/dt><dd>0<small>/, 'the champion tile still 0');
});

// ---------- resume ----------
test('resume: a beginner game left after a mistake comes back with its track and its lives left', () => {
  const storage = memory();
  let l = right(createLadder({ track: 'beginner' }), 0);
  const q = pick(l, 1);
  const { ladder, result } = answerLadder(l, q, wrongOf(q));
  const game = { day: '2026-10-01@08', ladder, question: q, phase: 'wrong', selected: wrongOf(q), walkAsk: false, lastResult: result, timedOut: false, remaining: null, ended: null };
  saveSession(makeSnapshot({ kind: 'ladder', route, bank, state: ladderState(game), now: T0 }), storage);
  const d = decideResume(readSession({ storage, now: T0 + 4 * MIN }), { route, bank });
  assert.ok(d.resume, 'resumed');
  const back = restoreLadder(d.resume.state, bank);
  assert.equal(back.phase, 'wrong');
  assert.equal(trackOf(back.ladder), 'beginner');
  assert.equal(livesLeft(back.ladder), 2);
  assert.equal(back.lastResult.lives, 2);
  // It plays on from there: the same step, another question.
  const next = pick(clearAids(back.ladder), 2);
  assert.ok(next && next.id !== q.id);
  // Rendered: the lives marks with their words, the verdict says the lives left, the next button stays on the step.
  const lp = loadJsx('components/quiz/LadderPlay.jsx');
  const html = renderToStaticMarkup(React.createElement(lp.default, { quiz: emptyState(), setQuiz: () => {}, bank, go: () => {}, route, resume: d.resume }));
  assert.match(html, /class="qz-lives" role="img" aria-label="נותרו 2 טעויות מתוך 3"/);
  assert.equal((html.match(/class="qz-heart is-on"/g) || []).length, 2);
  assert.equal((html.match(/class="qz-heart is-lost"/g) || []).length, 1);
  assert.match(html, /role="status" aria-live="polite">[^]*נותרו עוד שתי טעויות · ממשיכים באותה מדרגה/);
  assert.match(html, /לשאלה אחרת במדרגה ב׳/);
  // Broken lives or a beginner daily are discarded.
  const bad = (patch, kind = 'ladder') => validForBank({ ...d.resume, kind, state: { ...d.resume.state, ladder: { ...d.resume.state.ladder, ...patch } } }, bank);
  assert.equal(bad({}), true);
  assert.equal(bad({ lives: 4 }), false);
  assert.equal(bad({ lives: 'x' }), false);
  assert.equal(bad({ track: 'pro' }), false);
  assert.equal(bad({ lives: 0, status: 'playing' }), false);
  // A champion game shows no lives.
  const c = right(createLadder(), 0);
  const cq = pick(c, 1);
  const cs = makeSnapshot({ kind: 'ladder', route, bank, state: ladderState({ day: '2026-10-01@08', ladder: c, question: cq, phase: 'ask', selected: null, walkAsk: false, lastResult: null, timedOut: false, remaining: null, ended: null }), now: T0 });
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(lp.default, { quiz: emptyState(), setQuiz: () => {}, bank, go: () => {}, route, resume: cs })), /qz-lives/);
});

// ---------- the choice ----------
test('the choice persists on this device (its own key), defaults to the champion, and a storage that throws is harmless', () => {
  const s = memory();
  assert.equal(readLadderTrack(s), 'champion');
  assert.equal(writeLadderTrack('beginner', s), true);
  assert.equal(s.m.get(LADDER_TRACK_KEY), 'beginner');
  assert.equal(readLadderTrack(s), 'beginner');
  writeLadderTrack('champion', s);
  assert.equal(readLadderTrack(s), 'champion');
  s.setItem(LADDER_TRACK_KEY, 'junk');
  assert.equal(readLadderTrack(s), 'champion');
  assert.equal(readLadderTrack(throwing), 'champion');
  assert.equal(writeLadderTrack('beginner', throwing), false);
  assert.equal(readLadderTrack(null), 'champion');
});

test('the way in: the start button first, then the two tracks (a centred radio group), then the fifteen steps; the remembered track is chosen', () => {
  const page = loadJsx('pages/QuizPage.jsx');
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = memory();
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  try {
    const render = r => renderToStaticMarkup(React.createElement(page.default, { route: r, go: () => {}, initialState: emptyState(), initialBank: bank }));
    for (const remembered of ['champion', 'beginner']) {
      store.setItem(LADDER_TRACK_KEY, remembered);
      const intro = render(route);
      const button = intro.indexOf('<span class="qz-cta-text">לעלות בסולם</span>');
      const choice = intro.indexOf('class="seg qz-track" role="radiogroup" aria-label="מסלול"');
      const ladder = intro.indexOf('<ol class="qz-ladder');
      assert.ok(button > 0 && choice > 0 && ladder > 0, remembered);
      assert.ok(button < choice, 'the start button before the choice');
      assert.ok(choice < ladder, 'the choice above the fifteen steps');
      const radios = intro.slice(choice).match(/<button[^>]*role="radio"[^>]*>/g).slice(0, 2);
      assert.equal(radios.length, 2);
      const checked = radios.map(b => /aria-checked="true"/.test(b));
      assert.deepEqual(checked, remembered === 'champion' ? [true, false] : [false, true]);
      assert.ok(radios.every(b => /aria-checked="true"/.test(b) ? /class="is-on"/.test(b) && /tabindex="0"/.test(b) : /tabindex="-1"/.test(b)));
      assert.match(intro, /<b>מסלול אלוף<\/b><span class="visually-hidden"> · <\/span><small>טעות אחת<\/small>/);
      assert.match(intro, /<b>מסלול למתחילים<\/b><span class="visually-hidden"> · <\/span><small>שלוש טעויות<\/small>/);
      // The beginner's rule is said with the rules when that track is chosen.
      assert.equal(/שלוש טעויות מותרות/.test(intro), remembered === 'beginner');
    }
    // The daily challenge has no choice (it is always one mistake).
    assert.doesNotMatch(render('leatzmi/quiz/daily'), /qz-track/);
  } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage;
  }
});

test('the champion\'s game is exactly as before: one mistake ends it, walking away keeps the points', () => {
  let l = createLadder();
  for (let i = 0; i < 5; i++) l = right(l, i);
  assert.equal(walkAway(l).banked, pointsAt(5));
  const q = pick(l, 9);
  const { ladder, result } = answerLadder(l, q, wrongOf(q));
  assert.equal(result.status, 'lost');
  assert.equal(ladder.banked, safeFloor(5));
  assert.equal(ladderSummary(ladder).track, 'champion');
});
