// שעשועון טריוויה יהודי — הסולם: the ladder's rules (steps, safe steps, walking away, a miss), the three lifelines, the
// daily challenge's determinism, the records, the rename, and the markup (no reveal unless asked, accessible parts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Module, createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { validateBank, indexBank } from '../src/services/quiz/bank.mjs';
import { LADDER_STEPS, LADDER_SIZE, SAFE_STEPS, LADDER_TOP, LIFELINES, pointsAt, safeFloor, stepDifficulty, createLadder, ladderPick, answerLadder, walkAway,
  applyFifty, applyAudience, applySwap, setAside, clearAids, audiencePoll, dailyPlan, ladderSummary, ladderMarks, dailyShareText, seededRandom } from '../src/services/quiz/ladder.mjs';
import { emptyState, normalizeState, applyLadderEnd, applySessionEnd, dailyResult, quizSummary } from '../src/services/quiz/store.mjs';
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
const rng = (seed = 11) => seededRandom(seed);
const climb = (ladder, n) => {
  let l = ladder;
  for (let i = 0; i < n; i++) { const q = ladderPick(l, bank, { rng: rng(i) }); l = clearAids(answerLadder(l, q, q.answer).ladder); }
  return l;
};

// ---------- the ladder ----------
test('fifteen rising steps, points not money, safe steps at 5 and 10, difficulty 1 · 2 · 3 by fives', () => {
  assert.equal(LADDER_STEPS.length, LADDER_SIZE);
  assert.equal(LADDER_SIZE, 15);
  LADDER_STEPS.forEach((s, i) => { if (i) assert.ok(s.points > LADDER_STEPS[i - 1].points); });
  assert.deepEqual(SAFE_STEPS, [5, 10]);
  assert.deepEqual(LADDER_STEPS.filter(s => s.safe).map(s => s.step), [5, 10]);
  assert.deepEqual(LADDER_STEPS.map(s => s.difficulty), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3]);
  assert.equal(LADDER_TOP, LADDER_STEPS[14].points);
  // Adaptive: a strong player meets the next band one step early, nobody meets an easier one.
  for (let s = 1; s <= 15; s++) { assert.equal(stepDifficulty(s, 1), LADDER_STEPS[s - 1].difficulty); assert.ok(stepDifficulty(s, 3) >= stepDifficulty(s, 1)); }
  assert.equal(stepDifficulty(5, 3), 2);
  assert.equal(stepDifficulty(10, 3), 3);
});

test('progression: each right answer is one step up, at the step\'s difficulty, never a repeat; fifteen = סיום הסולם', () => {
  let l = createLadder({ category: 'all' });
  const asked = new Set();
  for (let i = 0; i < 15; i++) {
    const q = ladderPick(l, bank, { rng: rng(i) });
    assert.equal(q.difficulty, LADDER_STEPS[i].difficulty, `step ${i + 1}`);
    assert.ok(!asked.has(q.id)); asked.add(q.id);
    const { ladder, result } = answerLadder(l, q, q.answer);
    assert.equal(result.correct, true);
    assert.equal(ladder.climbed, i + 1);
    assert.equal(ladder.banked, pointsAt(i + 1));
    assert.equal(result.safe, SAFE_STEPS.includes(i + 1));
    l = clearAids(ladder);
  }
  assert.equal(l.status, 'won');
  assert.equal(l.banked, LADDER_TOP);
  assert.equal(ladderPick(l, bank), null, 'nothing after the top');
  assert.deepEqual(ladderMarks(l), Array(15).fill('right'));
  // A category is kept.
  const cat = createLadder({ category: 'shabbat' });
  assert.equal(ladderPick(cat, bank, { rng: rng() }).category, 'shabbat');
  // Flagged and seen-this-week questions are avoided.
  const first = ladderPick(createLadder(), bank, { rng: () => 0 });
  assert.notEqual(ladderPick(createLadder(), bank, { rng: () => 0, flagged: { [first.id]: 1 } }).id, first.id);
});

test('a miss falls to the last safe step: nothing before 5, the 5th step\'s points from 5 to 9, the 10th\'s from 10', () => {
  for (const reached of [0, 3, 4, 5, 7, 9, 10, 12, 14]) {
    const l = climb(createLadder(), reached);
    const q = ladderPick(l, bank, { rng: rng(99) });
    const { ladder, result } = answerLadder(l, q, (q.answer + 1) % 4);
    assert.equal(result.correct, false);
    assert.equal(ladder.status, 'lost');
    const expected = reached >= 10 ? pointsAt(10) : reached >= 5 ? pointsAt(5) : 0;
    assert.equal(ladder.banked, expected, `missed at step ${reached + 1}`);
    assert.equal(safeFloor(reached), expected);
    assert.equal(ladder.climbed, reached);
    assert.equal(ladderMarks(ladder)[reached], 'wrong');
    assert.equal(answerLadder(ladder, q, q.answer).result, null, 'the game is over');
  }
});

test('walk away (לסיים ולשמור) keeps every point climbed so far', () => {
  for (const reached of [0, 1, 6, 11, 14]) {
    const l = walkAway(climb(createLadder(), reached));
    assert.equal(l.status, 'walked');
    assert.equal(l.banked, pointsAt(reached));
    assert.equal(ladderPick(l, bank), null);
  }
  const done = walkAway(createLadder());
  assert.equal(walkAway(done), done, 'once');
});

// ---------- lifelines ----------
test('חמישים–חמישים removes exactly two wrong options and never the correct one; once a game', () => {
  for (let seed = 1; seed < 200; seed++) {
    const q = SAMPLE[seed % SAMPLE.length];
    const l = applyFifty(createLadder(), q, rng(seed));
    assert.equal(l.removed.length, 2);
    assert.ok(!l.removed.includes(q.answer));
    assert.equal(new Set(l.removed).size, 2);
    assert.equal(l.used.fifty, true);
    assert.equal(applyFifty(l, q, rng(seed + 1)), l, 'a second use does nothing');
  }
});

test('שאל את הקהל: sums to 100, the correct option the largest but never 100, leaning more on the easy steps; removed get 0', () => {
  const lead = { easy: 0, hard: 0 };
  for (let seed = 1; seed < 400; seed++) {
    const q = SAMPLE[seed % SAMPLE.length];
    for (const step of [1, 8, 15]) {
      for (const removed of [[], [0, 1, 2, 3].filter(i => i !== q.answer).slice(0, 2)]) {
        const poll = audiencePoll(q, step, removed, rng(seed * 31 + step));
        assert.equal(poll.reduce((a, b) => a + b, 0), 100, `sum ${poll}`);
        assert.ok(poll.every(v => Number.isInteger(v) && v >= 0));
        assert.ok(poll[q.answer] < 100 && poll[q.answer] <= 90, `never 100: ${poll}`);
        poll.forEach((v, i) => { if (i !== q.answer) assert.ok(v < poll[q.answer], `correct leads: ${poll}`); });
        removed.forEach(i => assert.equal(poll[i], 0));
        [0, 1, 2, 3].filter(i => i !== q.answer && !removed.includes(i)).forEach(i => assert.ok(poll[i] >= 1));
        if (!removed.length && step === 1) lead.easy += poll[q.answer];
        if (!removed.length && step === 15) lead.hard += poll[q.answer];
      }
    }
  }
  assert.ok(lead.easy > lead.hard * 1.3, 'the easy steps lean more clearly');
  const q = SAMPLE[0];
  const l = applyAudience(createLadder(), q, rng());
  assert.equal(l.used.audience, true);
  assert.equal(l.audience.reduce((a, b) => a + b, 0), 100);
  // 50:50 after the audience: the removed shares move, the rules still hold.
  const both = applyFifty(l, q, rng(3));
  assert.equal(both.audience.reduce((a, b) => a + b, 0), 100);
  both.removed.forEach(i => assert.equal(both.audience[i], 0));
});

test('החלפת שאלה: another question of the same step (same difficulty), not counted; the swapped one never returns', () => {
  for (const reached of [0, 4, 7, 12]) {
    const l = climb(createLadder(), reached);
    const q = ladderPick(l, bank, { rng: rng(5) });
    const swapped = applySwap(l, q);
    const next = ladderPick(swapped, bank, { rng: rng(6) });
    assert.notEqual(next.id, q.id);
    assert.equal(next.difficulty, q.difficulty);
    assert.equal(swapped.climbed, l.climbed);
    assert.equal(swapped.results.length, l.results.length);
    assert.equal(swapped.used.swap, true);
    assert.equal(applySwap(swapped, next), swapped, 'once a game');
  }
  // "לא מתאימה" sets aside without spending the lifeline.
  const q = ladderPick(createLadder(), bank, { rng: rng() });
  const aside = setAside(createLadder(), q);
  assert.equal(aside.used.swap, false);
  assert.ok(aside.skipped.includes(q.id));
  assert.deepEqual(LIFELINES.map(x => x.id), ['fifty', 'audience', 'swap']);
});

// ---------- the daily challenge ----------
test('אתגר יומי: the same fifteen for everyone on a day (whatever the bank order or the player), another the next day', () => {
  const shuffledBank = indexBank([...bank.questions].reverse());
  const a = dailyPlan(bank, '2026-10-01');
  assert.deepEqual(dailyPlan(shuffledBank, '2026-10-01'), a);
  assert.equal(a.length, 15);
  a.forEach((ids, i) => ids.forEach(id => assert.equal(bank.byId.get(id).difficulty, LADDER_STEPS[i].difficulty)));
  assert.equal(new Set(a.flat()).size, a.flat().length, 'no question twice in a day');
  assert.notDeepEqual(dailyPlan(bank, '2026-10-02').map(x => x[0]), a.map(x => x[0]));
  // Two players with different histories get the same questions.
  const play = seen => { let l = createLadder({ daily: '2026-10-01', plan: a }); const ids = []; for (let i = 0; i < 15; i++) { const q = ladderPick(l, bank, { seen, rng: Math.random }); ids.push(q.id); l = answerLadder(l, q, q.answer).ladder; } return ids; };
  assert.deepEqual(play({}), play(Object.fromEntries(a.flat().map(id => [id, Date.now()]))));
  assert.deepEqual(play({}), a.map(x => x[0]));
  // The swap in the daily is the day's own alternate.
  const l = createLadder({ daily: '2026-10-01', plan: a });
  const q = ladderPick(l, bank);
  assert.equal(ladderPick(applySwap(l, q), bank).id, a[0][1]);
});

test('records: best step, ladder points, the round\'s result (kept once), the shared streak; the share text has no question or answer', () => {
  let l = climb(createLadder({ daily: '2026-10-01@12', plan: dailyPlan(bank, '2026-10-01@12') }), 7);
  l = walkAway(l);
  const summary = ladderSummary(l);
  const now = new Date(2026, 9, 1, 12).getTime();
  let state = applyLadderEnd(emptyState(), summary, now);
  assert.equal(state.ladder.best, 7);
  assert.equal(state.ladder.total, pointsAt(7));
  assert.deepEqual(dailyResult(state, '2026-10-01@12').marks, [...Array(7).fill('right'), ...Array(8).fill('open')]);
  const again = applyLadderEnd(state, { ...summary, climbed: 15, banked: LADDER_TOP, status: 'won' }, now);
  assert.equal(dailyResult(again, '2026-10-01@12').climbed, 7, 'the first result of the round stands');
  assert.equal(again.ladder.wins, 1);
  const { state: ended, earned } = applySessionEnd(again, summary, now);
  assert.equal(ended.days.streak, 1);
  assert.ok(earned.some(a => a.id === 'ladder-5') && earned.some(a => a.id === 'daily') && earned.some(a => a.id === 'ladder-15'));
  assert.equal(quizSummary(ended, now).dailyDone, true);
  // Persistence: the record survives normalisation; junk does not.
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(ended))).ladder, ended.ladder);
  assert.deepEqual(normalizeState({ ladder: { best: 99, daily: { nope: 1 } } }).ladder.daily, {});
  assert.equal(normalizeState({ ladder: { best: 99 } }).ladder.best, 15);
  assert.equal(emptyState().prefs.confirm, true);
  assert.equal(emptyState().prefs.sound, false);
  const text = dailyShareText({ dateLabel: 'כ׳ תשרי', climbed: 7, banked: pointsAt(7), marks: summary.marks, status: 'walked' });
  for (const r of l.results) { const q = bank.byId.get(r.id); assert.ok(!text.includes(q.q)); q.options.forEach(o => assert.ok(!text.includes(o))); }
  assert.match(text, /שעשועון טריוויה יהודי/);
  assert.match(text, /◆◆◆◆◆◆◆·/);
});

// ---------- the markup ----------
const views = loadJsx('components/quiz/LadderView.jsx');
const parts = loadJsx('components/quiz/LadderParts.jsx');
const page = loadJsx('pages/QuizPage.jsx');
const pub = q => ({ id: q.id, q: q.q, options: [...q.options], category: q.category });

test('a wrong answer reveals nothing unless "להציג את התשובה הנכונה?" is on: the markup is the same whichever option is correct', () => {
  const q = SAMPLE[4];
  const render = (answer, selected, phase, revealed = null) => renderToStaticMarkup(React.createElement(views.default, { question: pub({ ...q, answer }), step: LADDER_STEPS[3], phase, selected, revealed, onChoose: () => {} }));
  for (const selected of [0, 1, 2, 3]) {
    const wrongs = [0, 1, 2, 3].filter(a => a !== selected).map(a => render(a, selected, 'wrong'));
    assert.ok(wrongs.every(html => html === wrongs[0]), 'markup depends on the answer');
    assert.doesNotMatch(wrongs[0], /is-revealed|התשובה הנכונה|data-answer/);
    assert.match(wrongs[0], /לא נכון/);
    for (const phase of ['ask', 'confirm', 'suspense']) {
      const htmls = [0, 1, 2, 3].map(a => render(a, phase === 'ask' ? null : selected, phase));
      assert.ok(htmls.every(h => h === htmls[0]), phase);
    }
  }
  // On: only the correct one, only after a miss.
  const on = render(2, 0, 'wrong', 2);
  assert.equal((on.match(/is-revealed/g) || []).length, 1);
  assert.match(on.split('class="qz-lozenge qz-option')[3], /^ is-revealed/);
  assert.doesNotMatch(render(2, 2, 'right', 2), /is-revealed/);
  const src = readFileSync(new URL('../src/components/quiz/LadderPlay.jsx', import.meta.url), 'utf8');
  assert.match(src, /revealed=\{prefs\.reveal && phase === 'wrong' \? question\.answer : null\}/);
  assert.equal((src.match(/\.answer\b/g) || []).length, 1, 'the page reads the answer in one place only');
});

test('accessible parts: answers a radio group, one status line, תשובה סופית?, lifelines labelled, the ladder an ordered list with the current step', () => {
  const q = SAMPLE[0];
  const html = renderToStaticMarkup(React.createElement(views.default, { question: pub(q), step: LADDER_STEPS[5], phase: 'confirm', selected: 1, removed: [], used: { fifty: true }, onChoose: () => {}, onFlag: () => {}, onWalk: () => {}, banked: 100 }));
  assert.match(html, /role="radiogroup" aria-labelledby="qz-q-/);
  assert.equal((html.match(/role="radio"/g) || []).length, 4);
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.match(html, /תשובה סופית\?/);
  assert.match(html, />סופית</);
  assert.match(html, /aria-label="חמישים–חמישים — נוצל"/);
  assert.match(html, /aria-label="שאל את הקהל — הדמיה/);
  assert.match(html, /role="group" aria-label="גלגלי עזרה/);
  assert.match(html, /לסיים ולשמור/);
  assert.match(html, /לא מתאימה/);
  // 50:50: the removed options are disabled and say so; their text is gone.
  const fifty = renderToStaticMarkup(React.createElement(views.default, { question: pub(q), step: LADDER_STEPS[0], phase: 'ask', removed: [0, 3], onChoose: () => {} }));
  assert.equal((fifty.match(/aria-label="[אד] — הוסרה"/g) || []).length, 2);
  assert.ok(!fifty.includes(q.options[0]) && !fifty.includes(q.options[3]));
  // The audience is a labelled figure with the simulation note.
  const aud = renderToStaticMarkup(React.createElement(parts.AudienceChart, { poll: [10, 70, 15, 5] }));
  assert.match(aud, /aria-label="שאל את הקהל \(הדמיה\): א 10%, ב 70%, ג 15%, ד 5%"/);
  assert.match(aud, /הדמיה/);
  const ladder = renderToStaticMarkup(React.createElement(parts.LadderColumn, { climbed: 6, current: 7 }));
  assert.match(ladder, /<ol class="qz-ladder/);
  assert.equal((ladder.match(/<li /g) || []).length, 15);
  assert.equal((ladder.match(/aria-current="step"/g) || []).length, 1);
  assert.equal((ladder.match(/מדרגת ביטחון/g) || []).length, 2);
  assert.equal((ladder.match(/הושלמה/g) || []).length, 6);
});

test('the rename: שעשועון טריוויה יהודי on the home, the לעצמי entry and the play pages; routes kept; ladder and daily routes', () => {
  const render = route => renderToStaticMarkup(React.createElement(page.default, { route, go: () => {}, initialState: emptyState(), initialBank: bank }));
  const home = render('leatzmi/quiz');
  assert.match(home, /<h1 id="quiz-title" class="quiz-title">שעשועון טריוויה יהודי<\/h1>/);
  assert.match(home, /<p class="quiz-tagline">טריוויה, ידע ורוח<\/p>/);
  assert.match(home, /לעלות בסולם/);
  assert.match(home, /אתגר יומי/);
  assert.match(home, /לתרגול חופשי/);
  assert.match(home, /aria-label="שעשועון טריוויה יהודי"/);
  assert.match(home, /class="magen-david is-alive"/, 'the evolving Magen David stays the identity');
  assert.doesNotMatch(home, /בחן אותי/);
  assert.match(home, /role="switch" aria-checked="true" class="quiz-switch is-on"><span class="quiz-switch-label">״תשובה סופית\?״ בסולם/);
  assert.match(home, /role="switch" aria-checked="false" class="quiz-switch"><span class="quiz-switch-label">צלילים עדינים/);
  assert.deepEqual(page.parseQuizRoute('leatzmi/quiz/ladder'), { view: 'ladder' });
  assert.deepEqual(page.parseQuizRoute('leatzmi/quiz/daily'), { view: 'daily' });
  assert.deepEqual(page.parseQuizRoute('leatzmi/quiz/play'), { view: 'play' });
  const intro = render('leatzmi/quiz/ladder');
  assert.match(intro, /הסולם/);
  assert.match(intro, /<ol class="qz-ladder/);
  assert.doesNotMatch(intro, /בחן אותי/);
  const entry = readFileSync(new URL('../src/components/leatzmi/LeatzmiHome.jsx', import.meta.url), 'utf8');
  assert.match(entry, /href="#leatzmi\/quiz" glyph=\{<Glyph\.quiz \/>\} title="שעשועון טריוויה יהודי"/);
  for (const name of readdirSync(new URL('../src/components/quiz/', import.meta.url))) {
    const src = readFileSync(new URL(`../src/components/quiz/${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /['">]בחן אותי/, name);
    assert.doesNotMatch(src, /spiritualCircle|mitzvotJournal|upsertTorahStudyMinutes|SpiritualRing/, `${name}: the game never fills the ring`);
  }
});

test('the stylesheet: every game rule is scoped (qz- or quiz-), no shared .lz- class, outline look, motion only in the motion block', () => {
  const css = readFileSync(new URL('../src/styles/quiz.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.lz-|\.lz\b/, 'no rules for the shared לעצמי classes');
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '').match(/(?:^|\})\s*([^{}@]+)\{/g) || [];
  for (const raw of selectors) {
    const sel = raw.replace(/^\}?\s*/, '').replace(/\{$/, '');
    for (const part of sel.split(',')) assert.match(part, /\.(?:quiz-|qz-|magen-david|md-)|^\s*(?:from|to|\d+%)/, `unscoped selector: ${part}`);
  }
  const ladder = css.slice(css.indexOf('/* ==== הסולם'));
  const motion = ladder.slice(ladder.indexOf('@media (prefers-reduced-motion:no-preference)'));
  const before = ladder.slice(0, ladder.indexOf('@media (prefers-reduced-motion:no-preference)'));
  assert.doesNotMatch(before, /animation:/, 'no animation outside the motion block');
  assert.match(motion, /html:not\(\[data-a11y-motion\]\) \.qz-question\.is-suspense/);
  for (const rule of ladder.match(/\.qz-(?:option|cta|life-btn)[^{]*\{[^}]*\}/g).filter(r => !/::(?:before|after)/.test(r))) assert.doesNotMatch(rule, /background:(?!transparent|none)/, rule);
});
