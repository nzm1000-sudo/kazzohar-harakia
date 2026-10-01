// שעשועון טריוויה יהודי — full-bleed and integrated: while the game is open the arena's night fills the screen and the
// app's header, tab bar and status bar take its tones; every way out (unmount, a route change, Back) restores them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARENA_CLASS, STATUS_STYLE, enterArenaChrome, isQuizRoute, appStatusStyle } from '../src/services/quiz/arenaChrome.mjs';

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
    getComputedStyle: () => ({ backgroundColor: classes.has(ARENA_CLASS) ? 'rgb(14, 16, 48)' : 'rgb(245, 242, 234)' }),
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
  const leave = enterArenaChrome({ doc: env.doc, win: env.win, statusBar: env.statusBar });
  assert.ok(env.classes.has(ARENA_CLASS));
  assert.equal(env.meta.content, 'rgb(14, 16, 48)');
  assert.deepEqual(env.calls, [STATUS_STYLE.dark]);
  assert.equal(STATUS_STYLE.dark, 'DARK', "Capacitor's Style.Dark = light glyphs");
  leave();
});

test('leaving (unmount): everything restored — class, theme colour, the status bar for the app theme; idempotent', () => {
  for (const [theme, style] of [['light', 'LIGHT'], ['sage', 'LIGHT'], ['dark', 'DARK']]) {
    const env = fakeEnv({ theme });
    const leave = enterArenaChrome({ doc: env.doc, win: env.win, statusBar: env.statusBar });
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
  const leave = enterArenaChrome({ doc: env.doc, win: env.win, statusBar: env.statusBar });
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
  const leave = enterArenaChrome({ doc: env.doc, win: env.win, statusBar: env.statusBar });
  env.root.setTheme('dark');
  assert.equal(env.calls.at(-1), 'DARK');
  leave();
  env.root.setTheme('light');
  assert.equal(env.calls.at(-1), 'DARK', 'after leaving the observer is gone');
  const web = fakeEnv();
  const leaveWeb = enterArenaChrome({ doc: web.doc, win: web.win, statusBar: null });
  assert.ok(web.classes.has(ARENA_CLASS));
  assert.doesNotThrow(leaveWeb);
  assert.equal(web.classes.has(ARENA_CLASS), false);
  const failing = fakeEnv();
  const leaveFail = enterArenaChrome({ doc: failing.doc, win: failing.win, statusBar: { setStyle: () => Promise.reject(new Error('no plugin')) } });
  assert.doesNotThrow(leaveFail);
  assert.doesNotThrow(() => enterArenaChrome({ doc: null })());
});

test('the page enters the chrome once when it opens and leaves it in the effect\'s cleanup; the stylesheet paints edge to edge', () => {
  const page = readFileSync(new URL('../src/pages/QuizPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /return enterArenaChrome\(\{ doc: document, win: window, statusBar: native \? StatusBar : null \}\);\n  \}, \[\]\);/, 'leave() is the cleanup');
  assert.match(page, /useArenaChrome\(\);/);
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
