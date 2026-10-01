// שעשועון טריוויה יהודי — the question's clock (30 s, red and blinking in the last ten), "הסבר קצר" after an answer
// (never leaking the answer after a miss unless reveal is on), and the automatic move on when there is nothing to read.
// Fake timers drive the clock and the beat.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Module, createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { TIMER_SECONDS, URGENT_SECONDS, AUTO_ADVANCE_MS, clockUrgent, startCountdown, explanationFor, scheduleAdvance } from '../src/services/quiz/clock.mjs';
import { emptyState, normalizeState } from '../src/services/quiz/store.mjs';
import { LADDER_STEPS } from '../src/services/quiz/ladder.mjs';
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

// ---------- the clock ----------
test('the clock counts 30 seconds down with fake timers, is urgent in the last ten, and times out exactly once', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const ticks = []; let outs = 0;
    const stop = startCountdown({ from: TIMER_SECONDS, onTick: v => ticks.push(v), onTimeout: () => { outs += 1; } });
    mock.timers.tick(5000);
    assert.equal(ticks.at(-1), 25, 'at 25 s');
    assert.equal(clockUrgent(25), false);
    mock.timers.tick(17000);
    assert.equal(ticks.at(-1), 8, 'at 8 s');
    assert.equal(clockUrgent(8), true, 'red in the last ten seconds');
    assert.equal(clockUrgent(URGENT_SECONDS), true);
    assert.equal(clockUrgent(URGENT_SECONDS + 1), false);
    assert.equal(outs, 0);
    mock.timers.tick(8000);
    assert.equal(ticks.at(-1), 0);
    assert.equal(outs, 1, 'time out at 0');
    mock.timers.tick(10000);
    assert.equal(outs, 1, 'once only');
    assert.equal(ticks.length, 30);
    stop();
  } finally { mock.timers.reset(); }
});

test('the clock holds when stopped (an answer, the held breath) and resumes from where it was', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    let left = TIMER_SECONDS; let outs = 0;
    let stop = startCountdown({ from: left, onTick: v => { left = v; }, onTimeout: () => { outs += 1; } });
    mock.timers.tick(12000);
    stop();
    mock.timers.tick(60000);
    assert.equal(left, 18, 'nothing counts while stopped');
    stop = startCountdown({ from: left, onTick: v => { left = v; }, onTimeout: () => { outs += 1; } });
    mock.timers.tick(18000);
    assert.equal(left, 0);
    assert.equal(outs, 1);
    stop(); stop();
    assert.doesNotThrow(() => startCountdown({ from: 0 })(), 'nothing to count');
  } finally { mock.timers.reset(); }
});

test('the clock\'s markup: role=timer with the seconds in words, red (is-urgent) at 8 s, electric at 25 s; blinking only in the motion block', () => {
  const { QuizClock } = loadJsx('components/quiz/QuizClock.jsx');
  const at = s => renderToStaticMarkup(React.createElement(QuizClock, { remaining: s, total: TIMER_SECONDS }));
  assert.match(at(25), /class="qz-clock" role="timer" aria-label="נותרו 25 שניות"/);
  assert.match(at(25), /<b>25<\/b>/);
  assert.match(at(8), /class="qz-clock is-urgent" role="timer" aria-label="נותרו 8 שניות"/);
  assert.match(at(0), /is-out/);
  const css = read('styles/quiz.css');
  assert.match(css, /\.qz-clock\.is-urgent \.qz-clock-left\{stroke:var\(--qz-alarm-lit\)/, 'steady red without motion');
  const motionAt = css.lastIndexOf('@media (prefers-reduced-motion:no-preference)');
  assert.doesNotMatch(css.slice(0, motionAt), /qz-blink/, 'the blink is only in the motion block');
  assert.match(css.slice(motionAt), /html:not\(\[data-a11y-motion\]\) \.qz-clock\.is-urgent\{animation:qz-blink/);
  // .qz-clock-left's transition is off under reduced motion (system and the app's own setting).
  assert.match(css, /html\[data-a11y-motion\] \.qz-ring-fill,html\[data-a11y-motion\] \.qz-clock-left/);
});

test('the clock shows in the ladder and the challenge (not only in practice): the ladder view draws it above the question', () => {
  const views = loadJsx('components/quiz/LadderView.jsx');
  const q = SAMPLE[3];
  const html = renderToStaticMarkup(React.createElement(views.default, { question: { id: q.id, q: q.q, options: [...q.options], category: q.category }, step: LADDER_STEPS[0], phase: 'ask', timer: { remaining: 8, total: 30 } }));
  assert.match(html, /class="qz-clock is-urgent qz-clock-ladder" role="timer"/);
  assert.ok(html.indexOf('qz-clock') < html.indexOf('qz-q-text'), 'above the question');
  const without = renderToStaticMarkup(React.createElement(views.default, { question: { id: q.id, q: q.q, options: [...q.options], category: q.category }, step: LADDER_STEPS[0], phase: 'ask' }));
  assert.doesNotMatch(without, /qz-clock/);
  const ladder = read('components/quiz/LadderPlay.jsx');
  assert.match(ladder, /useQuestionClock\(\{ enabled: Boolean\(prefs\.timer\)/, 'the ladder (and the challenge) runs the clock when the setting is on');
  assert.match(ladder, /timer=\{prefs\.timer \? \{ remaining, total: TIMER_SECONDS \} : null\}/);
  assert.match(ladder, /verdict\(null, \{ late: true \}\)/, 'time out: not answered (a miss)');
  assert.match(read('pages/QuizPage.jsx'), /onTimeout: \(\) => choose\(null\)/, 'practice: time out is a miss, as before');
});

// ---------- הסבר קצר ----------
test('"הסבר קצר": after a right answer; after a miss only with reveal on; never when off or without a note', () => {
  const note = 'הבננה גדלה על צמח שאינו עץ, ולכן ברכתה האדמה.';
  assert.equal(explanationFor({ note, correct: true, explain: true, reveal: false }), note);
  assert.equal(explanationFor({ note, correct: false, explain: true, reveal: false }), null, 'a miss never leaks the answer');
  assert.equal(explanationFor({ note, correct: false, explain: true, reveal: true }), note);
  assert.equal(explanationFor({ note, correct: true, explain: false, reveal: true }), null);
  assert.equal(explanationFor({ note: '  ', correct: true, explain: true }), null);
  assert.equal(explanationFor({ correct: true, explain: true }), null);
  // The setting: on by default, persisted, off stays off.
  assert.equal(emptyState().prefs.explain, true);
  assert.equal(normalizeState({ prefs: {} }).prefs.explain, true);
  assert.equal(normalizeState({ prefs: { explain: false } }).prefs.explain, false);
  assert.equal(normalizeState(JSON.parse(JSON.stringify({ ...emptyState(), prefs: { ...emptyState().prefs, explain: false } }))).prefs.explain, false);
});

test('waits for "לשאלה הבאה" with an explanation; moves on by itself after the beat without one (fake timers)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let moved = 0;
    const cancelWait = scheduleAdvance({ wait: true, onAdvance: () => { moved += 1; } });
    mock.timers.tick(60000);
    assert.equal(moved, 0, 'an explanation stays until the tap');
    cancelWait();
    scheduleAdvance({ wait: false, onAdvance: () => { moved += 1; } });
    mock.timers.tick(AUTO_ADVANCE_MS - 1);
    assert.equal(moved, 0);
    mock.timers.tick(1);
    assert.equal(moved, 1, 'on by itself after ~1.5 s');
    const cancel = scheduleAdvance({ onAdvance: () => { moved += 1; } });
    cancel();
    mock.timers.tick(AUTO_ADVANCE_MS * 2);
    assert.equal(moved, 1, 'a tap (or leaving) cancels the pending move');
  } finally { mock.timers.reset(); }
  assert.ok(AUTO_ADVANCE_MS >= 1200 && AUTO_ADVANCE_MS <= 1800);
});

test('the views show the explanation only when the page passes it, under the verdict; the pages gate it by the verdict and reveal', () => {
  const qv = loadJsx('components/quiz/QuestionView.jsx');
  const views = loadJsx('components/quiz/LadderView.jsx');
  const q = SAMPLE[1];
  const pub = { id: q.id, q: q.q, options: [...q.options], category: q.category };
  const practice = (feedback, explanation) => renderToStaticMarkup(React.createElement(qv.default, { question: pub, index: 0, total: 10, selected: 0, feedback, explanation, onNext: () => {} }));
  const right = practice('right', q.note);
  assert.match(right, /<aside class="qz-explain" aria-label="הסבר קצר">/);
  assert.match(right, new RegExp(q.note));
  assert.match(right, />לשאלה הבאה</);
  assert.ok(right.indexOf('qz-explain') > right.indexOf('quiz-feedback'), 'under the verdict');
  assert.doesNotMatch(practice('wrong', null), /qz-explain|מקור/);
  const ladder = (phase, explanation) => renderToStaticMarkup(React.createElement(views.default, { question: pub, step: LADDER_STEPS[2], phase, selected: 1, explanation }));
  assert.match(ladder('right', q.note), /qz-explain/);
  assert.doesNotMatch(ladder('wrong', null), /qz-explain/);
  assert.doesNotMatch(ladder('suspense', q.note), /qz-explain/, 'nothing before the verdict');
  // The pages: the note is read only through explanationFor, with the verdict and the reveal setting.
  const page = read('pages/QuizPage.jsx');
  assert.match(page, /explanationFor\(\{ note: question\.note, correct: feedback === 'right', explain: quiz\.prefs\.explain, reveal: quiz\.prefs\.reveal \}\)/);
  assert.match(page, /useAutoAdvance\(\{ active: Boolean\(playing && feedback\), wait: Boolean\(explanation\)/);
  const lp = read('components/quiz/LadderPlay.jsx');
  assert.match(lp, /explanationFor\(\{ note: question\.note, correct: phase === 'right', explain: prefs\.explain, reveal: prefs\.reveal \}\)/);
  assert.equal((lp.match(/\.note\b/g) || []).length, 1, 'the ladder reads the note in one place only');
  assert.match(lp, /wait: Boolean\(explanation\)/);
});

test('the settings: "הסבר קצר" (on by default) and the clock for every question (not only practice)', () => {
  const page = loadJsx('pages/QuizPage.jsx');
  const home = renderToStaticMarkup(React.createElement(page.default, { route: 'leatzmi/quiz', go: () => {}, initialState: emptyState(), initialBank: null }));
  assert.match(home, /role="switch" aria-checked="true" class="quiz-switch is-on"><span class="quiz-switch-label">הסבר קצר<\/span>/);
  assert.match(home, /<span>שעון לכל שאלה<\/span>/);
  const off = renderToStaticMarkup(React.createElement(page.default, { route: 'leatzmi/quiz', go: () => {}, initialState: { ...emptyState(), prefs: { ...emptyState().prefs, explain: false } }, initialBank: null }));
  assert.match(off, /role="switch" aria-checked="false" class="quiz-switch"><span class="quiz-switch-label">הסבר קצר<\/span>/);
});
