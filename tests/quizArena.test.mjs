// שעשועון טריוויה יהודי — the arena: the player's own records and weekly rank, the combo and level-up moments, the daily
// countdown, and the arena's parts (decorative, accessible, never revealing an answer; motion only when allowed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Module, createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { personalRecords, weekKey, msToNextDay, formatCountdown, comboLevel, levelUpOf, WEEKS_SHOWN } from '../src/services/quiz/records.mjs';
import { emptyState, normalizeState, applyLadderEnd, LOG_KEEP_DAYS } from '../src/services/quiz/store.mjs';
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
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

test('weeks start on Sunday; this week is ranked against the player\'s own weeks only', () => {
  assert.equal(weekKey('2026-10-01'), '2026-09-27'); // Thursday → Sunday
  assert.equal(weekKey('2026-09-27'), '2026-09-27');
  assert.equal(weekKey('2026-10-03'), '2026-09-27'); // שבת closes the week
  const now = at(2026, 10, 1);
  let state = emptyState();
  for (const [day, pts] of [['2026-09-14', 900], ['2026-09-21', 300], ['2026-09-29', 500]]) {
    const [y, m, d] = day.split('-').map(Number);
    state = applyLadderEnd(state, { kind: 'ladder', status: 'walked', climbed: 3, banked: pts, marks: [] }, at(y, m, d));
  }
  const r = personalRecords(state, now);
  assert.deepEqual([r.week.points, r.week.rank, r.week.of], [500, 2, 3]);
  assert.equal(r.week.bars.length, WEEKS_SHOWN);
  assert.equal(r.week.bars.at(-1).current, true);
  assert.equal(r.week.bars.at(-1).points, 500);
  // Two games on one day add up; a new week starts at zero and still counts as a week.
  state = applyLadderEnd(state, { kind: 'ladder', status: 'walked', climbed: 1, banked: 600, marks: [] }, at(2026, 9, 30));
  assert.equal(personalRecords(state, now).week.points, 1100);
  assert.equal(personalRecords(state, now).week.rank, 1);
  const next = personalRecords(state, at(2026, 10, 5));
  assert.deepEqual([next.week.points, next.week.rank, next.week.of], [0, 4, 4]);
  // Nothing played yet: one week, first place, no bars.
  const fresh = personalRecords(emptyState(), now);
  assert.deepEqual([fresh.week.rank, fresh.week.of, fresh.bestLadder, fresh.bestDaily], [1, 1, 0, 0]);
});

test('the day log persists, is pruned, and junk is dropped', () => {
  const s = applyLadderEnd(emptyState(), { kind: 'ladder', status: 'won', climbed: 15, banked: 1800, marks: [] }, at(2026, 10, 1));
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))).ladder.log, { '2026-10-01': 1800 });
  const many = Object.fromEntries(Array.from({ length: LOG_KEEP_DAYS + 30 }, (_, i) => [new Date(2026, 0, 1 + i, 12).toISOString().slice(0, 10), 10]));
  const n = normalizeState({ ladder: { log: { ...many, nope: 3, '2026-01-02': 'x' } } }).ladder.log;
  assert.equal(Object.keys(n).length, LOG_KEEP_DAYS);
  assert.ok(!('nope' in n));
  assert.deepEqual(normalizeState({}).ladder.log, {});
});

test('records: best daily, best run, best days', () => {
  const state = { ...emptyState(), bestRun: 9, days: { last: null, streak: 2, best: 6, count: 9 },
    ladder: { ...emptyState().ladder, best: 11, daily: { '2026-09-20': { banked: 600 }, '2026-09-21': { banked: 200 } } } };
  const r = personalRecords(state, at(2026, 10, 1));
  assert.deepEqual([r.bestLadder, r.bestDaily, r.bestRun, r.bestDays, r.dailyCount], [11, 600, 9, 6, 2]);
});

test('the daily countdown runs to the device\'s midnight', () => {
  assert.equal(msToNextDay(new Date(2026, 9, 1, 23, 59, 30).getTime()), 30000);
  assert.equal(formatCountdown(msToNextDay(new Date(2026, 9, 1, 12, 47, 28).getTime())), '11:12:32');
  assert.equal(formatCountdown(-5), '00:00:00');
});

test('combo levels and level-up moments: few, earned, never on the final win (it has its own)', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 9, 10, 15].map(comboLevel), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(levelUpOf({ run: 5, safe: true }), 'מדרגת ביטחון');
  assert.equal(levelUpOf({ run: 3 }), 'שלוש ברצף');
  assert.equal(levelUpOf({ run: 4 }), null);
  assert.equal(levelUpOf({ run: 15, won: true }), null);
});

const arena = loadJsx('components/quiz/ArenaParts.jsx');
const views = loadJsx('components/quiz/LadderView.jsx');
const pub = q => ({ id: q.id, q: q.q, options: [...q.options], category: q.category });

test('the arena\'s parts: decorative or said in words; the grid is fifteen squares; medals locked or lit', () => {
  const combo = renderToStaticMarkup(React.createElement(arena.ComboMeter, { run: 6 }));
  assert.match(combo, /class="qz-combo is-lv2" role="img" aria-label="6 תשובות נכונות ברצף"/);
  assert.match(renderToStaticMarkup(React.createElement(arena.ComboMeter, { run: 3, decorative: true })), /aria-hidden="true"/);
  const grid = renderToStaticMarkup(React.createElement(arena.ShareGrid, { marks: [...Array(7).fill('right'), 'wrong', ...Array(7).fill('open')] }));
  assert.match(grid, /^<div class="qz-grid " aria-hidden="true">/);
  assert.equal((grid.match(/<i class="is-/g) || []).length, 15);
  assert.equal((grid.match(/is-right/g) || []).length, 7);
  assert.equal((grid.match(/class="qz-grid-row"/g) || []).length, 3);
  assert.match(renderToStaticMarkup(React.createElement(arena.Medal, { earned: false })), /qz-medal-lock/);
  assert.match(renderToStaticMarkup(React.createElement(arena.Medal, { earned: true, n: 3 })), /class="qz-medal is-earned"[\s\S]*>3</);
  const rec = renderToStaticMarkup(React.createElement(arena.RecordsPanel, { quiz: emptyState(), now: at(2026, 10, 1) }));
  assert.match(rec, /השיאים שלי/);
  assert.match(rec, /role="group" aria-label="השבוע: 0 נקודות סולם — מקום 1 מתוך 1 שבוע שלך"/);
  assert.equal((rec.match(/class="qz-week-bar(?: is-current)?"/g) || []).length, WEEKS_SHOWN);
  // Every category has its own glyph.
  for (const id of ['all', 'tanakh', 'torah-stories', 'places', 'people', 'history', 'halacha', 'shabbat', 'moadim', 'brachot', 'tefila', 'yahadut'])
    assert.match(renderToStaticMarkup(React.createElement(arena.CategoryGlyph, { id })), /aria-hidden="true"/);
});

test('the burst of light and the level-up badge come only with a right answer — a miss still reveals nothing', () => {
  const q = SAMPLE[2];
  const render = (answer, selected, phase, extra = {}) => renderToStaticMarkup(React.createElement(views.default, { question: pub({ ...q, answer }), step: LADDER_STEPS[4], phase, selected, onChoose: () => {}, ...extra }));
  const right = render(1, 1, 'right', { levelUp: 'מדרגת ביטחון' });
  assert.equal((right.match(/class="qz-burst /g) || []).length, 1);
  assert.match(right, /role="status" aria-live="polite"><b>נכון<\/b><span class="qz-levelup">/);
  for (const selected of [0, 1, 2, 3]) {
    const wrongs = [0, 1, 2, 3].filter(a => a !== selected).map(a => render(a, selected, 'wrong', { levelUp: 'מדרגת ביטחון' }));
    assert.ok(wrongs.every(h => h === wrongs[0]));
    assert.doesNotMatch(wrongs[0], /qz-burst|qz-levelup|is-revealed/);
  }
});

test('the arena stylesheet: tokens from the theme, the orbs three quarters wide, every arena motion in the motion block', () => {
  const css = readFileSync(new URL('../src/styles/quiz.css', import.meta.url), 'utf8');
  const arenaCss = css.slice(css.indexOf('/* ==== The arena'));
  assert.ok(arenaCss.length > 1000);
  assert.match(arenaCss, /--qz-night:color-mix\(in oklch,[^;]*var\(--accent\)/, 'the night is tinted by the theme');
  assert.match(arenaCss, /\.qz-orbs\{[^}]*width:clamp\(236px,75%,400px\)/);
  assert.match(arenaCss, /\.qz-cta-daily\{width:min\(72%,250px\)/);
  const motionAt = arenaCss.indexOf('@media (prefers-reduced-motion:no-preference)');
  assert.ok(motionAt > 0);
  assert.doesNotMatch(arenaCss.slice(0, motionAt), /animation:/);
  for (const line of arenaCss.slice(motionAt).split('\n').filter(l => /animation:qz-/.test(l))) assert.match(line, /^html(?:\.qz-arena-light)?:not\(\[data-a11y-motion\]\) /, line);
  // The decorative burst and sparks are invisible unless animated.
  assert.match(arenaCss, /\.qz-burst i\{[^}]*opacity:0/);
  assert.match(arenaCss, /\.qz-rail-sparks circle\{[^}]*opacity:0/);
});
