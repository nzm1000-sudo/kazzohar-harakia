import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { _resetEntries, backTo, entryRecord, linkEntry, readRouteState, rememberScroll, restoreScroll, writeRouteState } from '../src/services/scrollRestoration.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

function fakeWindow({ scrollHeight = 5000, innerHeight = 800, state = { kzDepth: 1, kzKey: 'b' } } = {}) {
  const win = {
    scrolled: [], listeners: {}, backCalls: 0, innerHeight,
    document: { scrollingElement: { scrollHeight } },
    history: { state, back() { win.backCalls += 1; } },
    scrollTo(_x, y) { win.scrolled.push(y); },
    addEventListener(type, fn) { win.listeners[type] = fn; },
    removeEventListener(type) { delete win.listeners[type]; },
    requestAnimationFrame(fn) { win.pending = fn; return 1; },
    cancelAnimationFrame() { win.pending = null; },
  };
  return win;
}

test('Back restores the exact scroll position of that history entry, not another page', () => {
  _resetEntries();
  rememberScroll('list', 1840);
  rememberScroll('other', 300);
  const win = fakeWindow();
  restoreScroll('list', { win });
  assert.equal(win.scrolled.at(-1), 1840);
});

test('restoration waits for late content instead of settling at the top', () => {
  _resetEntries();
  rememberScroll('list', 3000);
  const win = fakeWindow({ scrollHeight: 1000 });
  restoreScroll('list', { win });
  assert.equal(win.scrolled.at(-1), 200, 'clamped while content is still short');
  win.document.scrollingElement.scrollHeight = 4000;
  win.pending();
  assert.equal(win.scrolled.at(-1), 3000, 'lands on the saved position once content arrives');
});

test('a user touch cancels restoration (no fighting the user)', () => {
  _resetEntries();
  rememberScroll('list', 3000);
  const win = fakeWindow({ scrollHeight: 1000 });
  restoreScroll('list', { win });
  win.listeners.touchstart();
  assert.equal(win.pending, null);
});

test('page state (selected date, search text) is kept per history entry', () => {
  _resetEntries();
  writeRouteState('calendar-entry', 'calendar-selected', '2026-10-05');
  writeRouteState('library-entry', 'library-query', 'בראשית');
  assert.deepEqual(readRouteState('calendar-entry', 'calendar-selected'), { value: '2026-10-05' });
  assert.deepEqual(readRouteState('library-entry', 'library-query'), { value: 'בראשית' });
  assert.equal(readRouteState('fresh-entry', 'library-query'), null, 'a new visit starts fresh');
});

test('the store is bounded', () => {
  _resetEntries();
  for (let i = 0; i < 500; i += 1) rememberScroll(`k${i}`, i);
  assert.equal(entryRecord('k0'), null);
  assert.ok(entryRecord('k499'));
});

test('on-screen "חזרה" to the screen we came from is a real Back; otherwise it navigates', () => {
  _resetEntries();
  globalThis.history = { state: { kzKey: 'b', kzDepth: 2 } };
  linkEntry('b', '#books/c/tanakh');
  const win = fakeWindow({ state: { kzDepth: 2, kzKey: 'b' } });
  let navigated = 0;
  backTo('books/c/tanakh', () => { navigated += 1; }, { win });
  assert.equal(win.backCalls, 1);
  backTo('books', () => { navigated += 1; }, { win });
  assert.equal(navigated, 1, 'a different parent is a forward navigation');
  delete globalThis.history;
});

test('pages keep their state through Back via useRouteState', () => {
  assert.match(read('../src/pages/CalendarPage.jsx'), /useRouteState\('calendar-selected'/);
  // A search's text is route state too (useSearchState wraps useRouteState and marks the entry as showing results).
  assert.match(read('../src/pages/LibraryPage.jsx'), /useSearchState\('library-query'/);
  assert.match(read('../src/pages/LibraryPage.jsx'), /useSearchState\('category-query'/);
  const app = read('../src/NewApp.jsx');
  assert.match(app, /restoreScroll\(currentEntryKey\(\)\)/);
  assert.match(app, /kzKey/);
});

test('Hebrew UI never reintroduces wide letter spacing', () => {
  const css = read('../src/styles/base.css');
  for (const [, value] of css.matchAll(/letter-spacing:([^;}]+)/g)) assert.match(value.trim(), /^(normal|0)$/);
});

test('bottom nav steps aside for the keyboard; direct jumps clear the status bar', () => {
  const css = read('../src/styles/base.css');
  assert.match(css, /body:has\(input:focus,textarea:focus,select:focus\) \.tabbar\{display:none\}/);
  assert.match(css, /scroll-margin-top:calc\(env\(safe-area-inset-top/);
});

test('error recovery returns home without re-opening the crashed screen', () => {
  const boundary = read('../src/components/AppErrorBoundary.jsx');
  assert.match(boundary, /history\.replaceState\(null/);
});
