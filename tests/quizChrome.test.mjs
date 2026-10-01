// שעשועון טריוויה יהודי — full-bleed and integrated: while the game is open the arena's night fills the screen and the
// app's header, tab bar and status bar take its tones; every way out (unmount, a route change, Back) restores them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARENA_CLASS, LIGHT_CLASS, STATUS_STYLE, QUIZ_LOOK_KEY, enterArenaChrome, isQuizRoute, appStatusStyle, arenaMode, readQuizLook, writeQuizLook } from '../src/services/quiz/arenaChrome.mjs';

function fakeEnv({ theme = 'light', hash = '#leatzmi/quiz' } = {}) {
  const classes = new Set();
  const attrs = { 'data-theme': theme };
  const observers = [];
  const root = {
    classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
    dataset: { get theme() { return attrs['data-theme']; } },
    setTheme(t) { attrs['data-theme'] = t; observers.forEach(o => o.cb([{ attributeName: 'data-theme' }])); },
  };
  const meta = { content: '#f5f2ea', getAttribute() { return this.content; }, setAttribute(_, v) { this.content = v; } };
  const doc = { documentElement: root, body: {}, querySelector: sel => (sel === 'meta[name="theme-color"]' ? meta : null) };
  const listeners = {};
  class MO { constructor(cb) { this.cb = cb; } observe() { observers.push(this); } disconnect() { const i = observers.indexOf(this); if (i >= 0) observers.splice(i, 1); } }
  const win = {
    location: { hash },
    MutationObserver: MO,
    getComputedStyle: () => ({ backgroundColor: classes.has(ARENA_CLASS) ? 'rgb(14, 16, 48)' : classes.has(LIGHT_CLASS) ? 'rgb(247, 241, 232)' : 'rgb(245, 242, 234)' }),
    addEventListener: (t, f) => { (listeners[t] ||= new Set()).add(f); },
    removeEventListener: (t, f) => listeners[t]?.delete(f),
    fire: t => [...(listeners[t] || [])].forEach(f => f()),
    count: () => Object.values(listeners).reduce((n, s) => n + s.size, 0),
  };
  const calls = [];
  const statusBar = { setStyle: ({ style }) => { calls.push(style); return Promise.resolve(); } };
  return { doc, win, meta, root, classes, calls, statusBar, observers };
}

test('entering: the arena class on <html>, the browser bar in the night, the status bar light content', () => {
  const env = fakeEnv();
  const leave = enterArenaChrome({ doc: env.doc, win: env.win, statusBar: env.statusBar, look: 'dark' });
  assert.ok(env.classes.has(ARENA_CLASS));
  assert.equal(env.meta.content, 'rgb(14, 16, 48)');
  assert.deepEqual(env.calls, [STATUS_STYLE.dark]);
  assert.equal(STATUS_STYLE.dark, 'DARK', "Capacitor's Style.Dark = light glyphs");
  leave();
});

test('leaving (unmount): everything restored — class, theme colour, the status bar for the app theme; idempotent', () => {
  for (const [theme, style] of [['light', 'LIGHT'], ['sage', 'LIGHT'], ['dark', 'DARK']]) {
    const env = fakeEnv({ theme });
    const leave = enterArenaChrome({ doc: env.doc, win: env.win, statusBar: env.statusBar, look: 'dark' });
    assert.equal(leave(), true);
    assert.equal(env.classes.has(ARENA_CLASS), false);
    assert.equal(env.meta.content, '#f5f2ea');
    assert.equal(env.calls.at(-1), style, `${theme}: as NewApp sets it`);
    assert.equal(appStatusStyle(env.doc), style);
    assert.equal(env.win.count(), 0, 'no listener left behind');
    assert.equal(env.observers.length, 0, 'no observer left behind');
    assert.equal(leave(), false, 'a second leave does nothing');
    assert.equal(env.calls.length, 2);
  }
});

test('a route change away from the quiz (a link, Back) restores the chrome even before the page unmounts', () => {
  const env = fakeEnv();
  const leave = enterArenaChrome({ doc: env.doc, win: env.win, statusBar: env.statusBar, look: 'dark' });
  env.win.location.hash = '#leatzmi/quiz/ladder'; env.win.fire('hashchange');
  assert.ok(env.classes.has(ARENA_CLASS), 'within the quiz it stays');
  env.win.location.hash = '#today'; env.win.fire('popstate');
  assert.equal(env.classes.has(ARENA_CLASS), false, 'Back to another screen');
  assert.equal(env.meta.content, '#f5f2ea');
  assert.equal(env.calls.at(-1), 'LIGHT');
  assert.equal(leave(), false, 'the unmount after it is harmless');
  assert.ok(isQuizRoute('#leatzmi/quiz') && isQuizRoute('leatzmi/quiz/daily') && !isQuizRoute('#leatzmi') && !isQuizRoute('#leatzmi/quizzes'));
});

test('a theme picked while the game is open keeps the status bar light; no plugin (web) is fine', () => {
  const env = fakeEnv();
  const leave = enterArenaChrome({ doc: env.doc, win: env.win, statusBar: env.statusBar, look: 'dark' });
  env.root.setTheme('dark');
  assert.equal(env.calls.at(-1), 'DARK');
  leave();
  env.root.setTheme('light');
  assert.equal(env.calls.at(-1), 'DARK', 'after leaving the observer is gone');
  const web = fakeEnv();
  const leaveWeb = enterArenaChrome({ doc: web.doc, win: web.win, statusBar: null, look: 'dark' });
  assert.ok(web.classes.has(ARENA_CLASS));
  assert.doesNotThrow(leaveWeb);
  assert.equal(web.classes.has(ARENA_CLASS), false);
  const failing = fakeEnv();
  const leaveFail = enterArenaChrome({ doc: failing.doc, win: failing.win, statusBar: { setStyle: () => Promise.reject(new Error('no plugin')) }, look: 'dark' });
  assert.doesNotThrow(leaveFail);
  assert.doesNotThrow(() => enterArenaChrome({ doc: null })());
});

test('the page enters the chrome once when it opens and leaves it in the effect\'s cleanup; the stylesheet paints edge to edge', () => {
  const page = readFileSync(new URL('../src/pages/QuizPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /return enterArenaChrome\(\{ doc: document, win: window, statusBar: native \? StatusBar : null, look \}\);\n  \}, \[look\]\);/, 'leave() is the cleanup; a new look draws it again');
  assert.match(page, /useArenaChrome\(look\);/);
  const css = readFileSync(new URL('../src/styles/quiz.css', import.meta.url), 'utf8');
  const arena = css.slice(css.indexOf('/* ==== The arena'));
  const pageRule = arena.match(/\n\.quiz-page\{[^}]*\}/)[0];
  assert.doesNotMatch(pageRule, /border-radius|box-shadow|border:|background:/, 'no card: no corners, frame, shadow or own background');
  assert.match(arena, /html\.qz-arena-on #root\{background-color:var\(--qz-night\)/, 'the night behind the whole app');
  assert.match(arena, /html\.qz-arena-on body\{background:var\(--qz-night\)\}/);
  assert.match(arena, /html\.qz-arena-on \.shell-head-safe,html\.qz-arena-on \.tabbar,html\.qz-arena-on \.app-footer\{[^}]*--surface:var\(--qz-night\)[^}]*--ink:var\(--qz-on\)/, 'header, tab bar and footer re-pointed');
  assert.match(arena, /html\.qz-arena-on \.tabbar>button\.on,[^{]*\{color:var\(--qz-goldlit\)/, 'the active tab stays clear');
  assert.match(arena, /\.quiz-page::before\{[^}]*left:calc\(50% - 50vw\);right:calc\(50% - 50vw\)/, 'the stars from edge to edge');
  assert.doesNotMatch(arena, /@media \(max-width:360px\)\{\n\.quiz-page\{[^}]*border-radius/);
});

// ---- The light quiz (the owner's light mode): as the app theme by default, or chosen in the quiz's settings ----

const memory = (seed = {}) => { const map = new Map(Object.entries(seed)); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), map }; };

test('the look: as the app theme (dark and amber give the night, every other theme the light quiz), or the chosen one', () => {
  for (const theme of ['light', 'sage', 'blue', 'plum', 'coral', 'teal', undefined]) assert.equal(arenaMode('auto', theme), 'light', String(theme));
  for (const theme of ['dark', 'amber']) assert.equal(arenaMode('auto', theme), 'dark', theme);
  assert.equal(arenaMode('light', 'dark'), 'light');
  assert.equal(arenaMode('dark', 'light'), 'dark');
  assert.equal(arenaMode('nonsense', 'light'), 'light', 'an unknown value reads as auto');
});

test('the chosen look is kept on this device (its own key), and storage that throws is harmless', () => {
  const store = memory();
  assert.equal(readQuizLook(store), 'auto');
  assert.equal(writeQuizLook('light', store), true);
  assert.equal(store.map.get(QUIZ_LOOK_KEY), 'light');
  assert.equal(readQuizLook(store), 'light');
  writeQuizLook('dark', store); assert.equal(readQuizLook(store), 'dark');
  writeQuizLook('auto', store); assert.equal(store.map.has(QUIZ_LOOK_KEY), false, 'auto = nothing stored');
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(readQuizLook(broken), 'auto');
  assert.equal(writeQuizLook('light', broken), false);
  assert.equal(readQuizLook(null), 'auto');
});

test('light: no night around the light quiz — the light class, the paper in the browser bar, dark status-bar glyphs', () => {
  const env = fakeEnv({ theme: 'light' });
  const leave = enterArenaChrome({ doc: env.doc, win: env.win, statusBar: env.statusBar });
  assert.ok(env.classes.has(LIGHT_CLASS));
  assert.equal(env.classes.has(ARENA_CLASS), false, 'no night class');
  assert.equal(env.meta.content, 'rgb(247, 241, 232)');
  assert.deepEqual(env.calls, [STATUS_STYLE.light]);
  assert.equal(leave.mode(), 'light');
  leave();
  assert.equal(env.classes.size, 0);
  assert.equal(env.meta.content, '#f5f2ea');
  // A dark app with the light quiz chosen: light too (the stylesheet re-points the app's tokens to the paper).
  const dark = fakeEnv({ theme: 'dark' });
  const leaveDark = enterArenaChrome({ doc: dark.doc, win: dark.win, statusBar: dark.statusBar, look: 'light' });
  assert.ok(dark.classes.has(LIGHT_CLASS) && !dark.classes.has(ARENA_CLASS));
  assert.equal(dark.calls.at(-1), STATUS_STYLE.light);
  leaveDark();
  assert.equal(dark.calls.at(-1), STATUS_STYLE.dark, 'back to the dark app theme');
});

test('auto follows a theme picked while the game is open; a chosen look stays', () => {
  const env = fakeEnv({ theme: 'light' });
  const leave = enterArenaChrome({ doc: env.doc, win: env.win, statusBar: env.statusBar, look: 'auto' });
  assert.ok(env.classes.has(LIGHT_CLASS));
  env.root.setTheme('amber');
  assert.ok(env.classes.has(ARENA_CLASS) && !env.classes.has(LIGHT_CLASS), 'the night with a dark theme');
  assert.equal(env.calls.at(-1), STATUS_STYLE.dark);
  env.root.setTheme('sage');
  assert.ok(env.classes.has(LIGHT_CLASS) && !env.classes.has(ARENA_CLASS));
  assert.equal(env.calls.at(-1), STATUS_STYLE.light);
  leave();
  const fixed = fakeEnv({ theme: 'light' });
  const leaveFixed = enterArenaChrome({ doc: fixed.doc, win: fixed.win, statusBar: fixed.statusBar, look: 'light' });
  fixed.root.setTheme('dark');
  assert.ok(fixed.classes.has(LIGHT_CLASS) && !fixed.classes.has(ARENA_CLASS));
  assert.equal(fixed.calls.at(-1), STATUS_STYLE.light);
  leaveFixed();
});

test('the quiz settings offer the look (כמו האפליקציה · בהיר · כהה), kept with writeQuizLook', () => {
  const page = readFileSync(new URL('../src/pages/QuizPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /export const LOOK_OPTIONS = \[\['auto', 'כמו האפליקציה'\], \['light', 'בהיר'\], \['dark', 'כהה'\]\];/);
  assert.match(page, /useState\(\(\) => readQuizLook\(\)\)/);
  assert.match(page, /const setLook = next => \{ writeQuizLook\(next\); setLookRaw\(next\); \};/);
  assert.match(page, /<div className="quiz-setting qz-look" role="radiogroup" aria-label="מראה השעשועון">/);
  assert.match(page, /import '@fontsource\/heebo\/500\.css';/, 'the light quiz\'s 500 weight');
});
