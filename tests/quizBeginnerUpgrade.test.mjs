// שעשועון טריוויה יהודי — מסלול למתחילים, the upgrade: השבוע שלי for both tracks (a small switch אלוף · מתחילים above the
// chart, each from its own day log, opening on the track last chosen), a new player starts on the beginner's track (one
// who has played the champion's stays on it), and the beginner's own three achievements (never the champion's, and
// never earned by the champion's games). The third mistake still drops the points to the last safe step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Module, createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { validateBank, indexBank } from '../src/services/quiz/bank.mjs';
import { createLadder, ladderPick, answerLadder, clearAids, ladderSummary, seededRandom, safeFloor } from '../src/services/quiz/ladder.mjs';
import { emptyState, normalizeState, applyLadderEnd, applySessionEnd, readLadderTrack, writeLadderTrack, defaultLadderTrack, LADDER_TRACK_KEY } from '../src/services/quiz/store.mjs';
import { personalRecords, weekOf } from '../src/services/quiz/records.mjs';
import { ACHIEVEMENTS } from '../src/services/quiz/achievements.mjs';
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
function withStorage(store, fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
  try { return fn(); } finally { if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage; }
}
const wrongOf = q => (q.answer + 1) % 4;
const pick = (l, i = 0) => ladderPick(l, bank, { rng: seededRandom(i) });
const right = (l, i = 0) => { const q = pick(l, i); return clearAids(answerLadder(l, q, q.answer).ladder); };
const wrong = (l, i = 0) => { const q = pick(l, i); return clearAids(answerLadder(l, q, wrongOf(q)).ladder); };
// Thursday 1 October 2026, noon local: the week is Sunday 27 September … Shabbat 3 October.
const T0 = new Date(2026, 9, 1, 12, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;
const game = (track, climbed, banked, status = 'lost') => ({ kind: 'ladder', track, status, climbed, banked, marks: [] });
const facts = st => ({ ...st, stage: 0, session: { answered: 1, correct: 1, bestRun: 1, maxDifficultyRun: 0 } });
const BEGINNER_IDS = ['beginner-5', 'beginner-10', 'beginner-15'];
const CHAMPION_IDS = ['ladder-5', 'ladder-10', 'ladder-15'];

// Two tracks played on different days: the champion's on Monday (500), the beginner's on Tuesday and today (300 + 1,000).
function twoTracks() {
  let st = applyLadderEnd(emptyState(), game('champion', 6, 500), T0 - 3 * DAY);
  st = applyLadderEnd(st, game('beginner', 5, 300), T0 - 2 * DAY);
  st = applyLadderEnd(st, game('beginner', 8, 1000), T0);
  return st;
}

// ---------- the week, per track ----------
test('records: each track has its own week from its own day log; the champion\'s week is as before', () => {
  const st = twoTracks();
  const r = personalRecords(st, T0);
  assert.equal(r.week.points, 500);
  assert.deepEqual(r.week.days.map(d => d.points), [0, 500, 0, 0, 0, 0, 0]);
  assert.equal(r.beginner.week.points, 1300);
  assert.deepEqual(r.beginner.week.days.map(d => d.points), [0, 0, 300, 0, 1000, 0, 0]);
  // The same shape for both: seven days, today marked once, the days ahead empty.
  for (const w of [r.week, r.beginner.week]) {
    assert.equal(w.days.length, 7);
    assert.equal(w.days.filter(d => d.today).length, 1);
    assert.equal(w.days.findIndex(d => d.today), 4);
    assert.deepEqual(w.days.map(d => d.ahead), [false, false, false, false, false, true, true]);
    assert.equal(w.rank, 1);
    assert.equal(w.of, 1);
  }
  assert.deepEqual(weekOf(st.ladder.log, T0), r.week);
  // A beginner's earlier week ranks the beginner's week only.
  const older = applyLadderEnd(st, game('beginner', 15, 5000, 'won'), T0 - 7 * DAY);
  const r2 = personalRecords(older, T0);
  assert.deepEqual([r2.beginner.week.rank, r2.beginner.week.of], [2, 2]);
  assert.deepEqual([r2.week.rank, r2.week.of], [1, 1]);
  // A record from before the tracks: an empty beginner's week.
  const old = personalRecords(normalizeState({ schemaVersion: 1, ladder: { log: { '2026-09-28': 200 } } }), T0);
  assert.equal(old.week.points, 200);
  assert.equal(old.beginner.week.points, 0);
  assert.equal(old.beginner.week.days.length, 7);
});

test('the chart\'s switch (אלוף · מתחילים) shows each track\'s own week, its points and its place; it opens on the track last chosen', () => {
  const { RecordsPanel } = loadJsx('components/quiz/ArenaParts.jsx');
  const st = twoTracks();
  const render = props => renderToStaticMarkup(React.createElement(RecordsPanel, { quiz: st, now: T0, ...props }));
  const switchOf = html => {
    const at = html.indexOf('class="seg qz-week-switch" role="radiogroup"');
    assert.ok(at > 0, 'the switch is there');
    assert.ok(at < html.indexOf('<figure class="qz-week"'), 'the switch above the chart');
    const radios = html.slice(at).match(/<button[^>]*role="radio"[^>]*>[^<]*<\/button>/g).slice(0, 2);
    return radios.map(b => ({ on: /aria-checked="true"/.test(b), cls: /class="is-on"/.test(b), text: b.replace(/<[^>]+>/g, '') }));
  };
  const vals = html => [...html.matchAll(/<span class="qz-week-val">([^<]*)<\/span>/g)].map(m => m[1]);
  const head = html => [...html.matchAll(/<span class="qz-week-stat"><b>([^<]*)<\/b>/g)].map(m => m[1]);

  const champ = render({ track: 'champion' });
  assert.deepEqual(switchOf(champ), [{ on: true, cls: true, text: 'אלוף' }, { on: false, cls: false, text: 'מתחילים' }]);
  assert.deepEqual(vals(champ), ['0', '500', '0', '0', '0', '', '']);
  assert.deepEqual(head(champ), ['500', '1']);
  assert.match(champ, /data-track="champion"/);
  assert.match(champ, /aria-label="השבוע במסלול אלוף: 500 נקודות סולם/);

  const begin = render({ track: 'beginner' });
  assert.deepEqual(switchOf(begin), [{ on: false, cls: false, text: 'אלוף' }, { on: true, cls: true, text: 'מתחילים' }]);
  assert.deepEqual(vals(begin), ['0', '0', '300', '0', '1,000', '', '']);
  assert.match(begin, /<span class="qz-week-stat"><b>1,300<\/b><small>נקודות<\/small>/);
  assert.match(begin, /aria-label="השבוע במסלול למתחילים: 1,300 נקודות סולם/);
  // Both keep the seven equal columns, the letters, today outlined.
  for (const html of [champ, begin]) {
    assert.equal((html.match(/class="qz-week-day[ "]/g) || []).length, 7);
    assert.equal((html.match(/is-today/g) || []).length, 1);
    assert.deepEqual([...html.matchAll(/<span class="qz-week-name">([^<]*)<\/span>/g)].map(m => m[1]), ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']);
  }
  // Without a track given, the panel opens on the one last chosen at the ladder's way in (kz-quiz-track).
  for (const remembered of ['champion', 'beginner']) {
    const store = memory();
    store.setItem(LADDER_TRACK_KEY, remembered);
    const html = withStorage(store, () => render({}));
    assert.match(html, new RegExp(`data-track="${remembered}"`), remembered);
  }
  // Never chosen: this player has played the champion's track, so it opens there.
  assert.match(withStorage(memory(), () => render({})), /data-track="champion"/);
});

// ---------- the new player's default ----------
test('a new player starts on מסלול למתחילים; an existing player keeps the stored choice, or the champion\'s once played', () => {
  const s = memory();
  const fresh = emptyState();
  const veteran = applyLadderEnd(emptyState(), game('champion', 3, 0), T0);
  assert.equal(defaultLadderTrack(fresh), 'beginner');
  assert.equal(defaultLadderTrack(veteran), 'champion');
  assert.equal(readLadderTrack(s, fresh), 'beginner', 'never chosen and no champion\'s game: the beginner\'s');
  assert.equal(readLadderTrack(s, veteran), 'champion', 'never chosen but has champion\'s games: the champion\'s');
  // A beginner-only player (never chosen, e.g. the key cleared) is still new to the champion's track.
  assert.equal(readLadderTrack(s, applyLadderEnd(emptyState(), game('beginner', 3, 0), T0)), 'beginner');
  // The daily challenge counts as the champion's (one mistake).
  assert.equal(readLadderTrack(s, applyLadderEnd(emptyState(), { kind: 'daily', day: '2026-10-01@08', status: 'lost', climbed: 1, banked: 0, marks: Array(15).fill('open') }, T0)), 'champion');
  // A stored choice always wins.
  writeLadderTrack('champion', s);
  assert.equal(readLadderTrack(s, fresh), 'champion');
  writeLadderTrack('beginner', s);
  assert.equal(readLadderTrack(s, veteran), 'beginner');
  // Junk reads as never chosen; a storage that throws as never chosen too; without a state, the champion's (as before).
  s.setItem(LADDER_TRACK_KEY, 'junk');
  assert.equal(readLadderTrack(s, fresh), 'beginner');
  assert.equal(readLadderTrack(s), 'champion');
  assert.equal(readLadderTrack(throwing, fresh), 'beginner');
  assert.equal(readLadderTrack(throwing, veteran), 'champion');
});

test('the way in: a new player sees מסלול למתחילים chosen; a player with champion\'s games sees the champion\'s', () => {
  const page = loadJsx('pages/QuizPage.jsx');
  const intro = state => withStorage(memory(), () => renderToStaticMarkup(React.createElement(page.default, { route: 'leatzmi/quiz/ladder', go: () => {}, initialState: state, initialBank: bank })));
  const checked = html => {
    const at = html.indexOf('class="seg qz-track"');
    return html.slice(at).match(/<button[^>]*role="radio"[^>]*>/g).slice(0, 2).map(b => /aria-checked="true"/.test(b));
  };
  assert.deepEqual(checked(intro(emptyState())), [false, true]);
  assert.match(intro(emptyState()), /שלוש טעויות מותרות/);
  assert.deepEqual(checked(intro(applyLadderEnd(emptyState(), game('champion', 2, 0), T0))), [true, false]);
});

// ---------- the beginner's achievements ----------
test('the beginner\'s three achievements: marked למתחילים, beside the champion\'s, in the same list', () => {
  const ids = ACHIEVEMENTS.map(a => a.id);
  for (const id of BEGINNER_IDS) assert.ok(ids.includes(id), id);
  const byId = id => ACHIEVEMENTS.find(a => a.id === id);
  assert.deepEqual(BEGINNER_IDS.map(id => byId(id).title), ['מדרגת ביטחון · למתחילים', 'עשר מעלות · למתחילים', 'סיום הסולם · למתחילים']);
  assert.ok(BEGINNER_IDS.every(id => /· למתחילים$/.test(byId(id).title) && byId(id).track === 'beginner'));
  assert.ok(CHAMPION_IDS.every(id => !/למתחילים/.test(byId(id).title)));
  // Right after the champion's three (one row of three in the grid), the list still a multiple of three.
  assert.deepEqual(ids.slice(ids.indexOf('ladder-5'), ids.indexOf('ladder-5') + 6), [...CHAMPION_IDS, ...BEGINNER_IDS]);
  assert.equal(ACHIEVEMENTS.length % 3, 0);
  assert.equal(new Set(ids).size, ids.length);
});

test('beginner achievements are earned on the beginner\'s track only; the champion\'s never by a beginner\'s game', () => {
  const earnedOf = st => ACHIEVEMENTS.filter(a => a.test(facts(st))).map(a => a.id);
  // Beginner: step 5, step 10, the whole ladder.
  let b = applyLadderEnd(emptyState(), game('beginner', 5, 1000), T0);
  assert.deepEqual(earnedOf(b).filter(id => [...BEGINNER_IDS, ...CHAMPION_IDS].includes(id)), ['beginner-5']);
  b = applyLadderEnd(b, game('beginner', 10, 32000), T0);
  assert.deepEqual(earnedOf(b).filter(id => [...BEGINNER_IDS, ...CHAMPION_IDS].includes(id)), ['beginner-5', 'beginner-10']);
  b = applyLadderEnd(b, game('beginner', 15, 1000000, 'won'), T0);
  assert.deepEqual(earnedOf(b).filter(id => [...BEGINNER_IDS, ...CHAMPION_IDS].includes(id)), BEGINNER_IDS);
  // Champion: its three, never the beginner's.
  let c = applyLadderEnd(emptyState(), game('champion', 15, 1000000, 'won'), T0);
  assert.deepEqual(earnedOf(c).filter(id => [...BEGINNER_IDS, ...CHAMPION_IDS].includes(id)), CHAMPION_IDS);
  // The daily challenge (one mistake) is the champion's too.
  const d = applyLadderEnd(emptyState(), { kind: 'daily', day: '2026-10-01@08', track: 'beginner', status: 'won', climbed: 15, banked: 1000000, marks: Array(15).fill('right') }, T0);
  assert.ok(!earnedOf(d).some(id => BEGINNER_IDS.includes(id)));
  // Through the session's end, as the game does it: awarded once, kept by id across a write and read.
  const { state, earned } = applySessionEnd(b, { answered: 15, correct: 15 }, T0);
  assert.ok(BEGINNER_IDS.every(id => earned.some(a => a.id === id)));
  assert.ok(!earned.some(a => CHAMPION_IDS.includes(a.id)));
  const back = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.ok(BEGINNER_IDS.every(id => back.achievements[id]));
  assert.equal(applySessionEnd(back, { answered: 1, correct: 1 }, T0).earned.filter(a => BEGINNER_IDS.includes(a.id)).length, 0, 'never twice');
});

test('a real beginner game: climbing to step 5 earns מדרגת ביטחון · למתחילים and not the champion\'s', () => {
  let l = createLadder({ track: 'beginner' });
  l = wrong(l, 0);
  for (let i = 0; i < 5; i++) l = right(l, 10 + i);
  l = wrong(l, 20);
  l = wrong(l, 21);
  assert.equal(l.status, 'lost');
  const summary = ladderSummary(l);
  const { earned } = applySessionEnd(applyLadderEnd(emptyState(), summary, T0), summary, T0);
  assert.ok(earned.some(a => a.id === 'beginner-5'));
  assert.ok(!earned.some(a => a.id === 'ladder-5'));
});

test('the achievements page shows the beginner\'s three in the existing medals, counted with the rest', () => {
  const page = loadJsx('pages/QuizPage.jsx');
  const st = applySessionEnd(applyLadderEnd(emptyState(), game('beginner', 10, 32000), T0), { answered: 10, correct: 9 }, T0).state;
  const html = withStorage(memory(), () => renderToStaticMarkup(React.createElement(page.default, { route: 'leatzmi/quiz/journey', go: () => {}, initialState: st, initialBank: bank })));
  assert.match(html, new RegExp(`הישגים · ${Object.keys(st.achievements).length} מתוך ${ACHIEVEMENTS.length}`));
  const items = [...html.matchAll(/<li class="([^"]*)"><svg class="qz-medal[^"]*"[\s\S]*?<strong>([\s\S]*?)<\/strong>/g)].map(m => ({ on: m[1] === 'is-earned', title: m[2].replace(/<[^>]+>/g, '') }));
  // The beginner's name, then its small tag (a hidden " · " so it reads as one).
  assert.match(html, /<strong>סיום הסולם<span class="visually-hidden"> · <\/span><span class="qz-ach-tag">למתחילים<\/span><\/strong>/);
  const at = t => items.find(x => x.title === t);
  assert.equal(at('מדרגת ביטחון · למתחילים')?.on, true);
  assert.equal(at('עשר מעלות · למתחילים')?.on, true);
  assert.equal(at('סיום הסולם · למתחילים')?.on, false);
  assert.equal(at('סיום הסולם')?.on, false);
  assert.equal(at('מדרגת ביטחון')?.on, false);
});

// ---------- the rule unchanged ----------
test('the third mistake still drops the points to the last safe step', () => {
  let l = createLadder({ track: 'beginner' });
  for (let i = 0; i < 7; i++) l = right(l, 30 + i);
  l = wrong(l, 40);
  l = wrong(l, 41);
  assert.equal(l.status, 'playing');
  const q = pick(l, 42);
  const { ladder, result } = answerLadder(l, q, wrongOf(q));
  assert.equal(result.status, 'lost');
  assert.equal(ladder.banked, safeFloor(7));
  assert.equal(result.banked, safeFloor(7));
});
