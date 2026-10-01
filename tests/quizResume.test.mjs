// שעשועון טריוויה יהודי — a game left in the middle resumes where it was (services/quiz/sessionResume.mjs): another
// screen of the app or the app in the background, and back within ten minutes → the same mode, step, question, answers,
// lifelines, the clock's seconds as left, the verdict and its explanation; ten minutes or more → afresh; a finished game
// keeps its results within the window; a broken, older or foreign snapshot is discarded; a storage that throws never
// breaks the quiz; nothing of the progress record is re-applied on return.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Module, createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { validateBank, indexBank } from '../src/services/quiz/bank.mjs';
import { createLadder, ladderPick, answerLadder, clearAids, applyFifty, ladderSummary, walkAway, seededRandom, dailyPlan } from '../src/services/quiz/ladder.mjs';
import { createSession, pickNext, answerQuestion, sessionSummary } from '../src/services/quiz/session.mjs';
import { emptyState, applyLadderEnd, applySessionEnd } from '../src/services/quiz/store.mjs';
import { ACHIEVEMENTS } from '../src/services/quiz/achievements.mjs';
import { QUIZ_SESSION_KEY, SESSION_SNAPSHOT_VERSION, RESUME_WINDOW_MS, bankSignature, makeSnapshot, saveSession, clearSession, readSession, decideResume,
  entryRoute, validForBank, resumeSeconds, ladderState, restoreLadder, playState, restorePlay, isFinished } from '../src/services/quiz/sessionResume.mjs';
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
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

const bank = indexBank(validateBank({ 'sample.mjs': SAMPLE }).questions);
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('denied'); } };
const T0 = Date.UTC(2026, 9, 1, 9, 0, 0);
const MIN = 60 * 1000;

// A ladder two answers in, waiting on its third question, 50:50 used on it, 17 seconds left.
function ladderTwoIn({ kind = 'ladder' } = {}) {
  const day = kind === 'daily' ? '2026-10-01@08' : null;
  let l = createLadder({ daily: day, plan: day ? dailyPlan(bank, day) : null });
  for (let i = 0; i < 2; i++) { const q = ladderPick(l, bank, { rng: seededRandom(i) }); l = clearAids(answerLadder(l, q, q.answer).ladder); }
  const question = ladderPick(l, bank, { rng: seededRandom(7) });
  l = applyFifty(l, question, seededRandom(3));
  return { day: day || '2026-10-01@08', ladder: l, question, phase: 'ask', selected: null, walkAsk: false, lastResult: null, timedOut: false, remaining: 17, ended: null };
}
const route = 'leatzmi/quiz/ladder';
const keep = (state, { storage, kind = 'ladder', at = T0, r = route } = {}) => saveSession(makeSnapshot({ kind, route: r, bank, state: ladderState(state), now: at }), storage);

// ---------- within ten minutes / after ten ----------
test('left for another screen or the background and back within ten minutes: the same game, question, answers and lifelines', () => {
  const storage = memory();
  const game = ladderTwoIn();
  assert.equal(keep(game, { storage }), true);
  for (const away of [0, 30 * 1000, 5 * MIN, RESUME_WINDOW_MS - 1]) {
    const found = readSession({ storage, now: T0 + away });
    assert.equal(found.status, 'resume', `away ${away}`);
    const d = decideResume(found, { route, bank });
    assert.ok(d.resume && !d.clear && !d.home);
    const back = restoreLadder(d.resume.state, bank);
    assert.equal(back.question.id, game.question.id);
    assert.equal(back.question, bank.byId.get(game.question.id), 'the question comes from the bank, never from storage');
    assert.equal(back.phase, 'ask');
    assert.deepEqual(back.ladder, game.ladder);
    assert.equal(back.ladder.climbed, 2);
    assert.equal(back.ladder.results.length, 2);
    assert.equal(back.ladder.used.fifty, true);
    assert.equal(back.ladder.removed.length, 2);
  }
  // The snapshot keeps question ids, never a question or its answer.
  const raw = storage.getItem(QUIZ_SESSION_KEY);
  assert.doesNotMatch(raw, /"options"|"answer"|"note"/);
  assert.equal(JSON.parse(raw).v, SESSION_SNAPSHOT_VERSION);
});

test('ten minutes or more away: afresh, and the kept game is cleared', () => {
  const storage = memory();
  keep(ladderTwoIn(), { storage });
  for (const away of [RESUME_WINDOW_MS, RESUME_WINDOW_MS + 1, 11 * MIN, 3 * 60 * MIN]) {
    const found = readSession({ storage, now: T0 + away });
    assert.equal(found.status, 'expired');
    const d = decideResume(found, { route, bank });
    assert.deepEqual(d, { resume: null, clear: true, home: false });
    assert.equal(entryRoute(found), null);
  }
  // A clock that went backwards is not a return within the window.
  assert.equal(readSession({ storage, now: T0 - MIN }).status, 'expired');
});

test('the clock: the seconds the question had when he left (never charged for the time away), at least one', () => {
  const storage = memory();
  keep(ladderTwoIn(), { storage });
  const back = restoreLadder(readSession({ storage, now: T0 + 9 * MIN }).snapshot.state, bank);
  assert.equal(back.remaining, 17);
  assert.equal(resumeSeconds(back.remaining, 30), 17);
  assert.equal(resumeSeconds(0, 30), 1);
  assert.equal(resumeSeconds(99, 30), 30);
  assert.equal(resumeSeconds(null, 30), 30);
  // The clock never runs while the page is hidden, and it starts from the kept seconds.
  const clock = read('components/quiz/QuizClock.jsx');
  assert.match(clock, /usePageVisible\(\)/);
  assert.match(clock, /enabled && running && visible/);
  assert.match(clock, /initial = null/);
});

test('answered and showing its verdict (and "הסבר קצר"): resumed on the verdict, the answer not graded again', () => {
  const storage = memory();
  const game = ladderTwoIn();
  const { ladder, result } = answerLadder(game.ladder, game.question, game.question.answer);
  keep({ ...game, ladder, phase: 'right', selected: game.question.answer, lastResult: result }, { storage });
  const d = decideResume(readSession({ storage, now: T0 + 2 * MIN }), { route, bank });
  const back = restoreLadder(d.resume.state, bank);
  assert.equal(back.phase, 'right');
  assert.equal(back.ladder.climbed, 3);
  assert.equal(back.ladder.results.length, 3, 'the answer stands once');
  assert.deepEqual(back.lastResult, result);
  // Held breath (answer locked in, verdict not yet given): kept with the choice, the verdict comes on return.
  keep({ ...game, phase: 'suspense', selected: 1 }, { storage });
  const held = restoreLadder(decideResume(readSession({ storage, now: T0 + MIN }), { route, bank }).resume.state, bank);
  assert.equal(held.phase, 'suspense');
  assert.equal(held.selected, 1);
  assert.equal(held.ladder.results.length, 2);
  assert.match(read('components/quiz/LadderPlay.jsx'), /back\?\.phase === 'suspense'[^\n]+verdict\(back\.selected\)/);
});

test('the resumed ladder renders on its question with its clock, and nothing is written to the progress record', () => {
  const storage = memory();
  const game = ladderTwoIn();
  keep(game, { storage });
  const snap = decideResume(readSession({ storage, now: T0 + 3 * MIN }), { route, bank }).resume;
  const lp = loadJsx('components/quiz/LadderPlay.jsx');
  let writes = 0;
  const quiz = { ...emptyState(), prefs: { ...emptyState().prefs, timer: true } };
  const html = renderToStaticMarkup(React.createElement(lp.default, { quiz, setQuiz: () => { writes += 1; }, bank, go: () => {}, route, resume: snap }));
  assert.ok(html.includes(game.question.q), 'the same question');
  assert.match(html, /aria-label="נותרו 17 שניות"/);
  assert.match(html, /aria-label="חמישים–חמישים — נוצל"/);
  assert.doesNotMatch(html, /qz-intro/);
  assert.equal(writes, 0);
  // Without a snapshot: the intro, as before.
  assert.match(renderToStaticMarkup(React.createElement(lp.default, { quiz, setQuiz: () => {}, bank, go: () => {}, route })), /qz-intro/);
});

// ---------- finished games / the daily challenge ----------
test('a finished game keeps its results within the window, then goes home; it never sends the player back into it from the home', () => {
  const storage = memory();
  const game = ladderTwoIn();
  const done = walkAway(game.ladder);
  const summary = ladderSummary(done);
  const earned = [ACHIEVEMENTS[0]];
  keep({ ...game, ladder: done, question: null, phase: 'end', ended: { summary, earned, newBest: true, best: 2 } }, { storage });
  const found = readSession({ storage, now: T0 + 4 * MIN });
  assert.ok(isFinished(found.snapshot));
  assert.equal(entryRoute(found), null);
  const back = restoreLadder(decideResume(found, { route, bank }).resume.state, bank);
  assert.equal(back.phase, 'end');
  assert.equal(back.ended.summary.status, 'walked');
  assert.equal(back.ended.earned[0], ACHIEVEMENTS[0], 'achievements found again by id');
  assert.doesNotMatch(storage.getItem(QUIZ_SESSION_KEY), /"test"/);
  assert.deepEqual(decideResume(readSession({ storage, now: T0 + 12 * MIN }), { route, bank }), { resume: null, clear: true, home: true });
});

test('the daily challenge resumes in its own round and its result is never counted twice', () => {
  const storage = memory();
  const game = ladderTwoIn({ kind: 'daily' });
  const r = 'leatzmi/quiz/daily';
  keep(game, { storage, kind: 'daily', r });
  // Back after the four-hour round has turned (08→12): the game keeps its round.
  const found = readSession({ storage, now: T0 + 6 * MIN });
  const back = restoreLadder(decideResume(found, { route: r, bank }).resume.state, bank);
  assert.equal(back.day, '2026-10-01@08');
  assert.equal(back.ladder.day, '2026-10-01@08');
  // Not the ladder's route: the daily game is not resumed there (and is left alone).
  assert.deepEqual(decideResume(found, { route, bank }), { resume: null, clear: false, home: false });
  // Ending it once records the round once; resuming its results never applies it again.
  const summary = ladderSummary(walkAway(back.ladder));
  const once = applyLadderEnd(emptyState(), summary, T0 + 7 * MIN);
  const twice = applyLadderEnd(once, summary, T0 + 8 * MIN);
  assert.deepEqual(twice.ladder.daily, once.ladder.daily);
  const src = read('components/quiz/LadderPlay.jsx');
  assert.match(src, /useState\(\(\) => back\?\.day \|\| dayProp \|\| windowKey\(\)\)/);
  // The progress record is never part of the snapshot.
  assert.doesNotMatch(storage.getItem(QUIZ_SESSION_KEY), /"mistakes"|"seen"|"achievements"|"prefs"/);
});

// ---------- free practice ----------
test('free practice resumes with its answers, score, run, the verdict and the explanation', () => {
  const storage = memory();
  let s = createSession({ size: 10 });
  for (let i = 0; i < 3; i++) { const q = pickNext(s, bank, { rng: seededRandom(i) }); s = answerQuestion(s, q, i === 1 ? (q.answer + 1) % 4 : q.answer).session; }
  const question = pickNext(s, bank, { rng: seededRandom(9) });
  const { session } = answerQuestion(s, question, question.answer);
  const r = 'leatzmi/quiz/play';
  saveSession(makeSnapshot({ kind: 'play', route: r, bank, now: T0, state: playState({ mode: 'play', session, question, selected: question.answer, feedback: 'right', remaining: 12, notes: [{ id: 'x', q: 'q', note: 'n' }], ended: null }) }), storage);
  const d = decideResume(readSession({ storage, now: T0 + 9 * MIN }), { route: r, bank });
  const back = restorePlay(d.resume.state, bank);
  assert.equal(back.question.id, question.id);
  assert.equal(back.feedback, 'right');
  assert.equal(back.session.results.length, 4);
  assert.equal(back.session.points, session.points);
  assert.equal(back.remaining, 12);
  assert.equal(back.notes.length, 1);
  // Rendered: the same question with its verdict and explanation; nothing written to the progress record.
  const page = loadJsx('pages/QuizPage.jsx');
  saveSession(makeSnapshot({ kind: 'play', route: r, bank, now: Date.now(), state: playState({ mode: 'play', session, question, selected: question.answer, feedback: 'right', remaining: 12, notes: [], ended: null }) }), storage);
  const before = storage.getItem('kz-quiz-v1');
  globalThis.localStorage = storage;
  try {
    const html = renderToStaticMarkup(React.createElement(page.default, { route: r, go: () => {}, initialState: emptyState(), initialBank: bank }));
    assert.ok(html.includes(question.q), 'the same question');
    if (question.note) assert.ok(html.includes(question.note), 'its explanation');
    assert.equal(storage.getItem('kz-quiz-v1'), before);
  } finally { delete globalThis.localStorage; }
  // A finished practice: within the window its summary; its empty "no questions" end is never kept.
  assert.equal(playState({ mode: 'play', session, question: null, ended: { empty: true, summary: sessionSummary(session) } }), null);
  const end = playState({ mode: 'play', session, question: null, ended: { summary: sessionSummary(session), earned: [], stageBefore: 0, stageAfter: 0, notes: [] } });
  assert.ok(end.ended && validForBank({ ...makeSnapshot({ kind: 'play', route: r, bank, state: end }) }, bank));
  assert.match(read('pages/QuizPage.jsx'), /if \(bank && !back\) begin\(\)/);
});

test('entering the quiz at its home with a game in progress goes straight back into it', () => {
  const storage = memory();
  keep(ladderTwoIn(), { storage, at: Date.now() });
  const found = readSession({ storage });
  assert.equal(entryRoute(found), route);
  const page = loadJsx('pages/QuizPage.jsx');
  globalThis.localStorage = storage;
  try {
    const html = renderToStaticMarkup(React.createElement(page.default, { route: 'leatzmi/quiz', go: () => {}, initialState: emptyState(), initialBank: bank }));
    assert.match(html, /aria-busy="true"/, 'not the home while it goes back');
    assert.doesNotMatch(html, /quiz-home/);
    // On the ladder's route the game itself, on its question.
    const game = renderToStaticMarkup(React.createElement(page.default, { route, go: () => {}, initialState: emptyState(), initialBank: bank }));
    assert.ok(game.includes(ladderTwoIn().question.q));
    clearSession();
    assert.match(renderToStaticMarkup(React.createElement(page.default, { route: 'leatzmi/quiz', go: () => {}, initialState: emptyState(), initialBank: bank })), /quiz-home/);
  } finally { delete globalThis.localStorage; }
});

// ---------- discarded snapshots / storage ----------
test('a broken, older, foreign or stale snapshot is discarded; a question no longer in the bank too', () => {
  const storage = memory();
  for (const raw of ['{not json', '[]', '"x"', JSON.stringify({ v: 0, kind: 'ladder', route, leftAt: T0, state: {} }), JSON.stringify({ v: 1, kind: 'other', route, leftAt: T0, state: {} }),
    JSON.stringify({ v: 1, kind: 'ladder', route, leftAt: 'soon', state: {} })]) {
    storage.setItem(QUIZ_SESSION_KEY, raw);
    const found = readSession({ storage, now: T0 });
    assert.equal(found.status, 'none', raw);
    assert.equal(decideResume(found, { route, bank }).clear, true, raw);
  }
  assert.deepEqual(decideResume(readSession({ storage: memory(), now: T0 }), { route, bank }), { resume: null, clear: false, home: false });
  // Another bank (questions added or removed): not resumed.
  keep(ladderTwoIn(), { storage });
  const other = indexBank(validateBank({ 'sample.mjs': SAMPLE.slice(1) }).questions);
  assert.notEqual(bankSignature(other), bankSignature(bank));
  assert.deepEqual(decideResume(readSession({ storage, now: T0 + MIN }), { route, bank: other }), { resume: null, clear: true, home: false });
  // A tampered state (an unknown question, a bad phase, a ladder already lost but still asking): not resumed.
  const snap = JSON.parse(storage.getItem(QUIZ_SESSION_KEY));
  const bad = [
    { ...snap, state: { ...snap.state, questionId: 'nope' } },
    { ...snap, state: { ...snap.state, phase: 'intro' } },
    { ...snap, state: { ...snap.state, ladder: { ...snap.state.ladder, status: 'lost' } } },
    { ...snap, state: { ...snap.state, ladder: { ...snap.state.ladder, kind: 'daily' } } },
    { ...snap, state: { ...snap.state, ladder: null } },
  ];
  for (const s of bad) assert.equal(validForBank(s, bank), false);
  assert.equal(validForBank(snap, bank), true);
});

test('a storage that throws: nothing resumes, nothing breaks', () => {
  assert.equal(saveSession(makeSnapshot({ kind: 'ladder', route, bank, state: ladderState(ladderTwoIn()) }), throwing), false);
  assert.equal(clearSession(throwing), false);
  const found = readSession({ storage: throwing, now: T0 });
  assert.equal(found.status, 'none');
  assert.equal(decideResume(found, { route, bank }).resume, null);
  assert.equal(entryRoute(found), null);
  assert.equal(readSession({ storage: null, now: T0 }).status, 'none');
});

test('the keeper: saves on every change, on hiding, on pagehide and on unmount; a deliberate exit clears; the look is untouched', () => {
  const keeper = read('components/quiz/useSessionKeeper.js');
  assert.match(keeper, /useEffect\(save\)/);
  assert.match(keeper, /visibilitychange/);
  assert.match(keeper, /pagehide/);
  assert.match(keeper, /removeEventListener\('pagehide', onHide\); save\(\);/);
  assert.match(keeper, /away >= RESUME_WINDOW_MS/);
  assert.doesNotMatch(keeper + read('services/quiz/sessionResume.mjs'), /['"]kz-quiz-(look|v1)['"]/);
  assert.equal(QUIZ_SESSION_KEY, 'kz-quiz-session-v1');
});
