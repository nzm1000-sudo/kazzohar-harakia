// בחן אותי — the evolving Magen David (stages grow monotonically; never a cross) and the markup: a wrong answer never
// reveals the correct option, the answers are a radio group, feedback is announced once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Module, createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { STAGES, STAGE_COUNT, VARIANTS, stageOf, layerGrowth, magenPrimitives, variantUnlocked, magenLuminosity, MAGEN_HUES, GLINT_POINTS } from '../src/services/quiz/magenDavid.mjs';
import { validateBank, indexBank } from '../src/services/quiz/bank.mjs';
import { emptyState, flagQuestion } from '../src/services/quiz/store.mjs';
import { SAMPLE } from './fixtures/quizSample.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = fileURLToPath(new URL('..', import.meta.url));
// Like tests/helpers/jsx.mjs, with the page's stylesheet imports emptied.
function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', loader: { '.jsx': 'jsx', '.css': 'empty' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false }) }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}
const C = 64;
const ink = items => items.reduce((sum, it) => sum + (it.o ?? 1) * (it.w ?? it.r ?? 1) * (it.dash ?? 1), 0);
const POINTS = [...new Set([...Array.from({ length: 300 }, (_, i) => i * 20), ...STAGES.map(s => s.at), 7000])].sort((a, b) => a - b);

// ---------- the Magen David ----------
test('the stage names (owner\'s naming, Mishkan and Torah words): עץ החיים, יריעות, מגן ישראל, כפתור ופרח, שש משזר, קרני ראם', () => {
  assert.deepEqual(STAGES.map(s => s.name), ['ניצוץ', 'שני משולשים', 'מעגל', 'משושה', 'שש משזר', 'כפתור ופרח', 'קו כפול', 'קרני ראם',
    'מגן ישראל', 'יריעות', 'קשתות', 'עץ החיים', 'עומק', 'כתר', 'זוהר']);
  for (const old of ['זרע החיים', 'קצב', 'מגן פנימי', 'טבעת פנימית', 'שש נקודות', 'קרני אור']) assert.ok(!STAGES.some(s => s.name === old), old);
});

test('fifteen stages, strictly rising thresholds; the stage and its layers never go back as points grow', () => {
  assert.equal(STAGE_COUNT, 15);
  STAGES.forEach((s, i) => { if (i) assert.ok(s.at > STAGES[i - 1].at); });
  let prev = null;
  for (const p of POINTS) {
    const s = stageOf(p);
    const g = layerGrowth(p);
    const items = magenPrimitives(p);
    if (prev) {
      assert.ok(s.stage >= prev.s.stage, `stage at ${p}`);
      g.forEach((v, i) => assert.ok(v >= prev.g[i], `layer ${i} at ${p}`));
      assert.ok(items.length >= prev.items.length, `primitives at ${p}`);
      assert.ok(ink(items) >= prev.ink - 1e-9, `ink at ${p}`);
      for (const key of prev.items.map(it => it.key)) assert.ok(items.some(it => it.key === key), `${key} kept at ${p}`);
    }
    prev = { s, g, items, ink: ink(items) };
  }
  // Each stage adds something visible; in between, the drawing moves (interpolation).
  for (let i = 1; i < STAGES.length; i += 1) {
    const before = magenPrimitives(STAGES[i - 1].at); const at = magenPrimitives(STAGES[i].at); const mid = magenPrimitives((STAGES[i - 1].at + STAGES[i].at) / 2);
    assert.ok(ink(at) > ink(before), `stage ${i} adds ink`);
    assert.ok(ink(mid) > ink(before) && ink(mid) < ink(at), `stage ${i} interpolates`);
  }
  // Deterministic.
  assert.deepEqual(magenPrimitives(1234, 'woven'), magenPrimitives(1234, 'woven'));
  assert.equal(stageOf(0).stage, 0);
  assert.equal(stageOf(1e9).next, null);
});

test('stage 0 is two faint triangles and a point of light; the full star is rich', () => {
  const first = magenPrimitives(0).filter(it => !['glow', 'core'].includes(it.kind));
  assert.deepEqual(first.map(it => it.key), ['tri-up', 'tri-down']);
  assert.ok(first.every(it => it.o < 0.4));
  assert.ok(magenPrimitives(STAGES[14].at).length >= 75);
});

test('never a cross: six-fold geometry, no stroke through the centre, no layer of four, no lone vertical/horizontal pair', () => {
  const angleOf = (x, y) => ((Math.atan2(x - C, C - y) * 180) / Math.PI + 360) % 360;
  const rot = ([x, y], deg) => { const t = (deg * Math.PI) / 180; const dx = x - C; const dy = y - C; return [C + dx * Math.cos(t) - dy * Math.sin(t), C + dx * Math.sin(t) + dy * Math.cos(t)]; };
  const samples = [...POINTS.filter((_, i) => i % 7 === 0), ...STAGES.map(s => s.at), 1e6];
  for (const variant of VARIANTS.map(v => v.id)) for (const p of samples) {
    const items = magenPrimitives(p, variant);
    const segs = items.flatMap(it => it.segs || []);
    for (const [x1, y1, x2, y2] of segs) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const dist = Math.abs((x2 - x1) * (C - y1) - (y2 - y1) * (C - x1)) / (len || 1);
      const t = ((C - x1) * (x2 - x1) + (C - y1) * (y2 - y1)) / (len * len || 1);
      assert.ok(!(dist < 4 && t > 0 && t < 1), `${variant} ${p}: a stroke passes through the centre`);
    }
    // The whole set of straight strokes is invariant under a turn of 120° (three-fold) — a four-fold, cross-like
    // composition cannot be.
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.08;
    for (const s of segs) {
      const a = rot([s[0], s[1]], 120); const b = rot([s[2], s[3]], 120);
      assert.ok(segs.some(o => (near(a, [o[0], o[1]]) && near(b, [o[2], o[3]])) || (near(a, [o[2], o[3]]) && near(b, [o[0], o[1]]))), `${variant} ${p}: segment not three-fold`);
    }
    // Every placed layer (dots, rays, ticks, arcs, small circles) comes in sets of 3·k, never 4.
    const layers = new Map();
    for (const it of items) {
      const at = it.at ?? (it.cx !== undefined ? angleOf(it.cx, it.cy) : null);
      if (at === null) continue;
      const layer = it.key.replace(/-?\d+[ab]?$/, '');
      layers.set(layer, [...(layers.get(layer) || []), at]);
    }
    for (const [layer, list] of layers) {
      assert.ok(list.length % 3 === 0 && list.length !== 4, `${variant} ${p}: layer ${layer} has ${list.length}`);
      const axes = new Set(list.map(a => Math.round(a) % 180));
      if (axes.has(0) && axes.has(90)) assert.ok(axes.size >= 6, `${variant} ${p}: layer ${layer} is a lone orthogonal pair`);
    }
  }
});

test('the forms (הפתעות גאומטריות) are only variations of the Magen David, opened by stages', () => {
  assert.deepEqual(VARIANTS.map(v => v.id), ['classic', 'woven', 'starry']);
  assert.ok(variantUnlocked('classic', 0));
  assert.ok(!variantUnlocked('woven', STAGES[6].at - 1) && variantUnlocked('woven', STAGES[6].at));
  assert.ok(!variantUnlocked('starry', STAGES[10].at - 1) && variantUnlocked('starry', STAGES[10].at));
  // A locked form draws as the classic one.
  assert.deepEqual(magenPrimitives(100, 'starry'), magenPrimitives(100, 'classic'));
  const woven = magenPrimitives(STAGES[6].at, 'woven').find(it => it.key === 'tri-up');
  assert.equal(woven.segs.length, 6, 'each triangle edge is broken once, where it passes under');
});

// ---------- the markup ----------
const view = loadJsx('components/quiz/QuestionView.jsx');
const page = loadJsx('pages/QuizPage.jsx');
const bank = indexBank(validateBank({ 'sample.mjs': SAMPLE }).questions);

test('a wrong answer never reveals the correct option: the markup is the same whichever option is correct', () => {
  const q = SAMPLE[3];
  const render = (answer, selected, feedback) => renderToStaticMarkup(React.createElement(view.default, { question: view.publicQuestion({ ...q, answer }), index: 2, total: 10, categoryText: 'תנ״ך', selected, feedback, onChoose: () => {}, onNext: () => {} }));
  for (const selected of [0, 1, 2, 3]) {
    const wrongs = [0, 1, 2, 3].filter(a => a !== selected).map(a => render(a, selected, 'wrong'));
    assert.ok(wrongs.every(html => html === wrongs[0]), `selected ${selected}: markup depends on the answer`);
    const html = wrongs[0];
    assert.match(html, /לא נכון/);
    assert.doesNotMatch(html, /is-correct|data-correct|data-answer|התשובה הנכונה/);
    // The unchosen options are all treated alike.
    assert.equal((html.match(/is-faded/g) || []).length, 3);
    assert.equal((html.match(/is-chosen/g) || []).length, 1);
    // Before answering, likewise nothing marks any option.
    const fresh = [0, 1, 2, 3].map(a => render(a, null, null));
    assert.ok(fresh.every(h => h === fresh[0]));
    const timeout = [0, 1, 2, 3].map(a => render(a, null, 'timeout'));
    assert.ok(timeout.every(h => h === timeout[0]));
  }
  assert.deepEqual(Object.keys(view.publicQuestion(q)).sort(), ['category', 'id', 'options', 'q']);
});

test('the answers are a radio group; one status line says נכון / לא נכון once; targets are buttons', () => {
  const q = view.publicQuestion(SAMPLE[0]);
  const html = renderToStaticMarkup(React.createElement(view.default, { question: q, index: 0, total: 10, selected: 2, feedback: 'right', onChoose: () => {}, onNext: () => {} }));
  assert.match(html, /role="radiogroup" aria-labelledby="quiz-q-/);
  assert.equal((html.match(/role="radio"/g) || []).length, 4);
  assert.equal((html.match(/aria-checked="true"/g) || []).length, 1);
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.match(html, /role="status" aria-live="polite">נכון</);
  assert.match(html, /aria-label="שאלה 1 מתוך 10"/);
  assert.match(html, /הבאה/);
  // Explanations never mid-game.
  assert.doesNotMatch(html, new RegExp(SAMPLE[1].note));
});

test('the pages render: home (centred title, categories, levels), journey (15 stages, forms, achievements)', () => {
  const render = route => renderToStaticMarkup(React.createElement(page.default, { route, go: () => {}, initialState: emptyState(), initialBank: bank }));
  const home = render('leatzmi/quiz');
  assert.match(home, /<h1 id="quiz-title" class="quiz-title">שעשועון טריוויה יהודי<\/h1>/);
  assert.doesNotMatch(home, /בחן אותי/);
  // The twelve areas are orbs (an icon and a name, a radio each); the levels and the settings stay pills.
  assert.equal((home.match(/class="qz-orb(?: is-on)?"/g) || []).length, 12);
  assert.equal((home.match(/class="quiz-pill(?: is-on)?"/g) || []).length, 4 + 3 + 3 + 2, 'levels, session sizes, the look (כמו האפליקציה · בהיר · כהה), the clock');
  assert.match(home, /aria-checked="true"[^>]*>כמו האפליקציה</, 'the look follows the app by default');
  assert.match(home, /aria-checked="true"[^>]*class="qz-orb is-on"><span class="qz-orb-icon" aria-hidden="true">.*?<span class="qz-orb-label">הכול</);
  assert.match(home, /השיאים שלי/);
  assert.match(home, /aria-checked="true"[^>]*>משתנה</);
  assert.match(home, /שלב 1 מתוך 15/);
  assert.match(home, /class="magen-david is-alive"/);
  const journey = render('leatzmi/quiz/journey');
  assert.equal((journey.match(/class="magen-david/g) || []).length, 1 + 15 + 3);
  assert.equal((journey.match(/aria-current="step"/g) || []).length, 1);
  assert.match(journey, /בלי שגיאה/);
  assert.deepEqual(page.parseQuizRoute('leatzmi/quiz/q/tanakh-0003'), { view: 'single', id: 'tanakh-0003' });
  assert.deepEqual(page.parseQuizRoute('leatzmi/quiz/whatever'), { view: 'home' });
});

test('the stylesheet: no filled blocks for choices, theme variables only, reduced motion respected', () => {
  const css = readFileSync(new URL('../src/styles/quiz.css', import.meta.url), 'utf8');
  for (const rule of css.match(/\.quiz-(?:pill|option|primary|form)[^{]*\{[^}]*\}/g)) assert.doesNotMatch(rule, /background:(?!transparent|none)/, rule);
  // Colours come from the theme; the only literals are the star's own palette tokens (--md-*), as in the seal.
  assert.doesNotMatch(css.replace(/--md-[a-z-]+:#[0-9a-f]+/gi, ''), /#[0-9a-f]{3,8}\b/i, 'colours come from the theme');
  // Every star palette token has a dark-theme value too.
  const light = css.match(/\.magen-david\{[^}]*\}/)[0]; const dark = css.match(/\[data-theme="dark"\] \.magen-david,[^{]*\{[^}]*\}/)[0];
  for (const token of ['--md-gold-hi', '--md-spark', '--md-sky', '--md-violet', '--md-rose']) { assert.match(light, new RegExp(token)); assert.match(dark, new RegExp(token)); }
  // Still stars (reduced motion / not alive) keep the travelling lights hidden; every motion sits in the no-preference block.
  assert.match(css, /\.magen-david \.md-sweep,\.magen-david \.md-light\{opacity:0\}/);
  const motion = css.slice(css.indexOf('@media (prefers-reduced-motion:no-preference)'));
  const outside = css.slice(0, css.indexOf('@media (prefers-reduced-motion:no-preference)'));
  assert.doesNotMatch(outside, /animation:md-/, 'no star animation outside the motion block');
  assert.match(motion, /\.md-sweep\{animation:md-sweep/);
  assert.match(css, /@media \(prefers-reduced-motion:no-preference\)\{\nhtml:not\(\[data-a11y-motion\]\) \.magen-david\.is-alive/);
  assert.match(css, /min-height:44px/);
});

// ---------- the star's light ----------
test('the star\'s light: hues join with the stages (gold → תכלת → violet → rose), effects and glints only rise', () => {
  assert.deepEqual(MAGEN_HUES.map(h => h.name), ['sky', 'violet', 'rose']);
  let prev = null;
  for (const p of POINTS) {
    const l = magenLuminosity(p);
    assert.ok(l.intensity >= 0 && l.intensity <= 1);
    if (prev) {
      assert.ok(l.intensity >= prev.intensity && l.effect >= prev.effect && l.glints >= prev.glints && l.hues >= prev.hues, `at ${p}`);
      for (const k of ['sky', 'violet', 'rose']) assert.ok(l.weights[k] >= prev.weights[k], `${k} at ${p}`);
    }
    prev = l;
  }
  const first = magenLuminosity(0);
  assert.deepEqual([first.intensity, first.effect, first.glints, first.hues], [0, 0, 0, 1]);
  const last = magenLuminosity(STAGES[14].at);
  assert.deepEqual([last.intensity, last.effect, last.glints, last.hues], [1, 5, 9, 4]);
  // תכלת arrives before violet, violet before rose.
  const firstAt = name => POINTS.find(p => magenLuminosity(p).weights[name] >= 1);
  assert.ok(firstAt('sky') < firstAt('violet') && firstAt('violet') < firstAt('rose'));
  // Glints come in three-fold sets on the six-fold geometry — never a lone vertical/horizontal pair (nothing cross-like).
  for (const n of [3, 6, 9]) {
    const set = GLINT_POINTS.slice(0, n).map(([deg]) => deg);
    for (const d of set) assert.ok(set.includes((d + 120) % 360), `glints ${n}: ${d} not three-fold`);
  }
});

test('the star renders its stage: hazes and hues in the lines, glints at the high stages, motion only when alive', () => {
  const md = loadJsx('components/quiz/MagenDavid.jsx');
  const render = (points, alive = false, size = 176) => renderToStaticMarkup(React.createElement(md.default, { points, size, alive }));
  const spark = render(0, true);
  assert.match(spark, /data-fx="0"/);
  assert.doesNotMatch(spark, /class="md-(?:haze|spark|light|sweep)/);
  const mid = render(STAGES[6].at, true);
  assert.match(mid, /md-haze-1/);
  assert.match(mid, /md-sweep/);
  assert.match(mid, /mask="url\(#md-mask-/);
  const full = render(STAGES[14].at, true);
  assert.equal((full.match(/class="md-spark"/g) || []).length, 9);
  assert.equal((full.match(/class="md-haze md-haze-/g) || []).length, 3);
  assert.equal((full.match(/class="md-light md-light-/g) || []).length, 3);
  // A still star keeps its colours but has no travelling light; a small one has no glints.
  const still = render(STAGES[14].at, false);
  assert.match(still, /md-haze-3/);
  assert.doesNotMatch(still, /class="md-(?:sweep|light)/);
  assert.doesNotMatch(render(STAGES[14].at, false, 48), /class="md-spark/);
});

// ---------- reveal, flag, flagged list ----------
test('with "להציג את התשובה הנכונה?" on, a miss outlines the correct option (gold + check); a hit reveals nothing', () => {
  const q = SAMPLE[3];
  const render = (answer, selected, feedback, revealed) => renderToStaticMarkup(React.createElement(view.default, { question: view.publicQuestion({ ...q, answer }), index: 2, total: 10, selected, feedback, revealed, onChoose: () => {}, onNext: () => {} }));
  for (const answer of [0, 1, 2, 3]) {
    const chosen = (answer + 1) % 4;
    const html = render(answer, chosen, 'wrong', answer);
    assert.equal((html.match(/is-revealed/g) || []).length, 1);
    assert.equal((html.match(/is-faded/g) || []).length, 2);
    const options = html.split('role="radio"').slice(1);
    assert.match(options[answer], /is-revealed/);
    assert.match(options[answer], /התשובה הנכונה/);
    assert.match(options[answer], /M5 10\.5l3\.2 3\.2L15 6\.8/, 'a check on the revealed option');
    assert.match(html, /לא נכון/);
    // A timeout reveals likewise.
    assert.equal((render(answer, null, 'timeout', answer).match(/is-revealed/g) || []).length, 1);
  }
  // A correct answer: nothing extra, whatever is passed.
  assert.doesNotMatch(render(1, 1, 'right', 1), /is-revealed|התשובה הנכונה/);
  // Off (nothing passed): exactly the old markup.
  assert.equal(render(2, 0, 'wrong', null), render(2, 0, 'wrong', undefined));
  assert.doesNotMatch(render(2, 0, 'wrong', null), /is-revealed|התשובה הנכונה/);
});

test('the play page passes the answer to the view only when reveal is on and the answer was wrong', () => {
  const src = readFileSync(new URL('../src/pages/QuizPage.jsx', import.meta.url), 'utf8');
  assert.match(src, /revealed=\{quiz\.prefs\.reveal && feedback && feedback !== 'right' \? question\.answer : null\}/);
  assert.equal((src.match(/question\.answer/g) || []).length, 1, 'the answer is read in one place only');
});

test('the home: the tagline, the reveal switch (off by default), the flagged list behind the settings', () => {
  const render = (route, state = emptyState()) => renderToStaticMarkup(React.createElement(page.default, { route, go: () => {}, initialState: state, initialBank: bank }));
  const home = render('leatzmi/quiz');
  assert.match(home, /<p class="quiz-tagline">טריוויה, ידע ורוח<\/p>/);
  assert.match(home, /role="switch" aria-checked="false" class="quiz-switch"><span class="quiz-switch-label">להציג את התשובה הנכונה\?<\/span>/);
  const on = render('leatzmi/quiz', { ...emptyState(), prefs: { ...emptyState().prefs, reveal: true } });
  assert.match(on, /role="switch" aria-checked="true" class="quiz-switch is-on"/);
  assert.match(home, /שאלות שסימנתי/);
  // The flagged list: question and its area, never the answer; each can be returned.
  const q = SAMPLE[5];
  const flagged = render('leatzmi/quiz/flagged', flagQuestion(emptyState(), q.id, 1));
  assert.deepEqual(page.parseQuizRoute('leatzmi/quiz/flagged'), { view: 'flagged' });
  assert.match(flagged, /<h1 id="quiz-flagged-title"[^>]*>שאלות שסימנתי<\/h1>/);
  assert.ok(flagged.includes(q.q));
  assert.match(flagged, /להחזיר למשחק/);
  for (const o of q.options) assert.ok(!flagged.includes(o), 'no options, no answer');
  assert.match(render('leatzmi/quiz/flagged'), /תופיע כאן/);
});

test('during a question: a quiet "לא מתאימה" beside סיום הסבב', () => {
  const html = renderToStaticMarkup(React.createElement(view.default, { question: view.publicQuestion(SAMPLE[0]), index: 0, total: 10, onChoose: () => {}, onNext: () => {}, onFlag: () => {}, onExit: () => {} }));
  assert.match(html, /class="quiz-actions-quiet"><button type="button" class="quiz-quiet quiz-flag"[^>]*>לא מתאימה<\/button><span class="quiz-sep" aria-hidden="true"><\/span><button type="button" class="quiz-quiet">סיום הסבב<\/button>/);
});

test('the Magen David on paper is a jewel — gold leaf, a lit edge, a soft shadow — and the night\'s star is untouched', () => {
  const md = loadJsx('components/quiz/MagenDavid.jsx');
  const html = renderToStaticMarkup(React.createElement(md.default, { points: STAGES[10].at, size: 176, alive: true }));
  // The jewel's layers: the shadow (two soft passes) under the lines, the gold leaf and its edge over them.
  const order = ['md-jewel md-jewel-shade"', 'md-jewel md-jewel-shade md-jewel-shade-near"', 'class="md-body"', 'md-jewel md-jewel-leaf"', 'md-jewel md-jewel-edge"'].map(k => html.indexOf(k));
  assert.ok(order.every(i => i > 0), 'every layer drawn');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'shadow under the lines, leaf and edge over them');
  assert.match(html, /<linearGradient id="md-leaf-[^"]+" gradientUnits="userSpaceOnUse"/);
  assert.match(html, /stroke="url\(#md-leaf-/, 'the lines in gold leaf');
  // The shadow falls away from the light (down and to the right), the lit edge toward it.
  assert.match(html, /class="md-jewel md-jewel-shade" transform="translate\(0\.\d+ 0\.\d+\)"/);
  assert.match(html, /class="md-jewel md-jewel-edge" transform="translate\(-0\.\d+ -0\.\d+\)"/);
  const css = readFileSync(new URL('../src/styles/quiz.css', import.meta.url), 'utf8');
  // Hidden by default (the night arena, every dark look); shown — and the thin body put away — only in the light quiz.
  assert.match(css, /\n\.magen-david \.md-jewel\{display:none\}/);
  const shown = [...css.matchAll(/([^{}\n]*)\.md-jewel\{display:inline\}/g)].map(m => m[1]);
  assert.deepEqual(shown, ['html.qz-arena-light .quiz-page .magen-david '], 'the jewel only in the light quiz');
  assert.match(css, /html\.qz-arena-light \.quiz-page \.magen-david \.md-body\{display:none\}/);
  assert.match(css, /html\.qz-arena-light \.quiz-page \.magen-david\{--md-leaf-hi:[^}]*--md-shade:[^}]*\}/);
  // Nothing of it in the night's rules: no .md-jewel / --md-leaf outside the light quiz's selectors.
  for (const [, sel] of css.matchAll(/([^{}]*)\{[^}]*(?:md-jewel|--md-leaf|--md-shade)/g)) assert.ok(/qz-arena-light|^\s*\.magen-david \.md-jewel\s*$/.test(sel.replace(/\/\*[\s\S]*?\*\//g, '')), `the night's star touched: ${sel.trim()}`);
  // No filter: the shadow and the leaf are drawn, not blurred.
  assert.doesNotMatch(css, /md-jewel[^{]*\{[^}]*filter/);
});
