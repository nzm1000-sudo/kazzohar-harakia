// Back after a search result returns to the results (owner's request): the same text, the same results, the same
// filter chip and "עוד תוצאות" pages, scrolled where the reader was; Back once more returns to the screen before the
// search. One mechanism for every search (src/services/searchReturn.mjs), exercised here on a simulated browser history.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Module } from 'node:module';
import { buildSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

// One bundle, so the pages and the history store share one module instance (as they do in the app).
function loadBundle() {
  const contents = `
    export * from './src/services/scrollRestoration.mjs';
    export * from './src/services/searchReturn.mjs';
    export { default as LibraryPage, parseLibraryRoute, libraryRoute } from './src/pages/LibraryPage.jsx';
    export { default as HalachaLibrary, parseHalachaRoute } from './src/pages/HalachaLibrary.jsx';
    export { default as HalachaIndex } from './src/components/halacha/HalachaIndex.jsx';
    export { default as TorahSearchResults, keepTorahResults, keptTorahResults } from './src/components/TorahSearchResults.jsx';
  `;
  const code = buildSync({ stdin: { contents, resolveDir: root, loader: 'js', sourcefile: 'search-return-entry.js' }, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false }) }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(`${root}search-return-entry.js`);
  loaded.filename = `${root}search-return-entry.js`;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(code, loaded.filename);
  return loaded.exports;
}
const app = loadBundle();

// A browser history of entries (address + state) with Back; enough for pushState/replaceState and the app's reads.
function fakeBrowser(hash, state) {
  const entries = [{ url: `https://app.local/${hash}`, state }];
  let index = 0;
  let keys = 0;
  const win = {
    scrollY: 0,
    location: { get href() { return entries[index].url; }, get hash() { return new URL(entries[index].url).hash; } },
    history: {
      get state() { return entries[index].state; },
      get length() { return entries.length; },
      pushState(next, _title, url) { entries.splice(index + 1); entries.push({ url: new URL(url, entries[index].url).href, state: next }); index += 1; },
      replaceState(next, _title, url) { entries[index] = { url: new URL(url, entries[index].url).href, state: next }; },
      back() { index -= 1; },
    },
  };
  // What NewApp's pushRoute does: keep a search one Back away, remember the scroll, push the destination.
  const pushRoute = (to) => {
    app.splitSearchEntry({ win, newKey: () => `results-${++keys}` });
    app.rememberScroll(win.history.state.kzKey, win.scrollY);
    const { kzResults: _results, ...previous } = win.history.state;
    win.history.pushState({ ...previous, source: null, kzDepth: Number(previous.kzDepth || 0) + 1, kzKey: `page-${++keys}` }, '', to);
  };
  globalThis.history = win.history;
  return { win, entries, pushRoute, at: () => entries[index] };
}
const render = element => renderToStaticMarkup(element);

test('opening a header-search result keeps the results one Back away; Back again returns to the screen before', () => {
  app._resetEntries();
  app.registerSearchState('global-search', '');
  const browser = fakeBrowser('#calendar', { kzKey: 'origin', kzDepth: 0, source: null });
  app.rememberScroll('origin', 420); // where the calendar was scrolled when the search began
  // Typing: the text is kept on the entry, letter by letter — no history entry, however many letters.
  for (const text of ['ש', 'שב', 'שבת', 'שבת ש', 'שבת שלום']) { app.writeRouteState('origin', 'global-search', text); app.noteSearchValue('origin', text); }
  assert.equal(browser.entries.length, 1, 'no history entry per keystroke');
  browser.win.scrollY = 1840; // scrolled down the results
  app.rememberScroll('origin', 1840);
  browser.pushRoute('#halacha/q/abc'); // a result opened
  assert.equal(browser.entries.length, 3, 'origin, results, result');
  const results = browser.entries[1];
  assert.equal(results.state.kzResults, true);
  assert.equal(results.url, 'https://app.local/#calendar', 'the results entry keeps the address the search was typed on');
  // Back: the results, with their text and scroll.
  browser.win.history.back();
  assert.equal(browser.win.history.state.kzKey, results.state.kzKey);
  assert.deepEqual(app.readRouteState(results.state.kzKey, 'global-search'), { value: 'שבת שלום' });
  assert.equal(app.entryRecord(results.state.kzKey).scrollY, 1840);
  // Back again: the calendar, with no search, where it was.
  browser.win.history.back();
  assert.equal(browser.win.history.state.kzKey, 'origin');
  assert.deepEqual(app.readRouteState('origin', 'global-search'), { value: '' });
  assert.equal(app.entryRecord('origin').scrollY, 420);
});

test('trying several results: from the restored results another result opens without another results entry', () => {
  app._resetEntries();
  app.registerSearchState('global-search', '');
  const browser = fakeBrowser('#today', { kzKey: 'origin', kzDepth: 0, source: null });
  app.writeRouteState('origin', 'global-search', 'חנוכה');
  app.noteSearchValue('origin', 'חנוכה');
  browser.pushRoute('#books/read/a');
  browser.win.history.back(); // the results
  browser.pushRoute('#books/read/b'); // a second result
  assert.equal(browser.entries.length, 3, 'origin, results, the second result — the first result was replaced');
  browser.win.history.back();
  assert.equal(browser.win.history.state.kzResults, true);
  assert.deepEqual(app.readRouteState(browser.win.history.state.kzKey, 'global-search'), { value: 'חנוכה' });
  browser.win.history.back();
  assert.equal(browser.win.history.state.kzKey, 'origin');
});

test('a navigation without a search pushes one entry, as before', () => {
  app._resetEntries();
  const browser = fakeBrowser('#today', { kzKey: 'origin', kzDepth: 0, source: null });
  browser.pushRoute('#calendar');
  assert.equal(browser.entries.length, 2);
  assert.equal(browser.entries[1].state.kzResults, undefined);
});

test('a plain link (hashchange) out of a search: the entry becomes the results and the destination follows', () => {
  app._resetEntries();
  app.registerSearchState('tradition-query', '');
  const browser = fakeBrowser('#personal-tools/tradition', { kzKey: 'home', kzDepth: 1, source: null });
  app.rememberScroll('home', 0);
  app.writeRouteState('home', 'tradition-query', 'מימונה');
  app.noteSearchValue('home', 'מימונה');
  app.rememberScroll('home', 900);
  // The browser has already added the link's entry (state null) when the app hears the hashchange.
  browser.win.history.pushState(null, '', '#personal-tools/tradition/r/mimouna');
  const split = app.splitAfterHashNavigation({ win: browser.win, fromKey: 'home', fromURL: 'https://app.local/#personal-tools/tradition', fromDepth: 1, newKey: () => 'results' });
  browser.win.history.pushState({ source: null, kzDepth: split.depth, kzKey: 'record' }, '', split.destination);
  assert.deepEqual(browser.entries.map(entry => new URL(entry.url).hash), ['#personal-tools/tradition', '#personal-tools/tradition', '#personal-tools/tradition/r/mimouna']);
  browser.win.history.back();
  assert.equal(browser.win.history.state.kzKey, 'results');
  assert.deepEqual(app.readRouteState('results', 'tradition-query'), { value: 'מימונה' });
  assert.equal(app.entryRecord('results').scrollY, 900);
  browser.win.history.back();
  assert.deepEqual(app.readRouteState('home', 'tradition-query'), { value: '' });
});

test('library search: Back restores the text, the family chip, every loaded page of results and "כל הספרים"', () => {
  app._resetEntries();
  const browser = fakeBrowser('#books', { kzKey: 'books', kzDepth: 1, source: null });
  const page = () => render(React.createElement(app.LibraryPage, { route: app.parseLibraryRoute('books'), go: () => {}, openSource: () => {} }));
  const before = page(); // registers the page's search state
  assert.doesNotMatch(before, /data-kz-results/);
  // The reader searched, chose a family, loaded a second page of results and opened "כל הספרים".
  app.writeRouteState('books', 'library-query', 'שבת');
  app.writeRouteState('books', 'library-family', 'tanakh');
  app.writeRouteState('books', 'library-all-books', true);
  app.noteSearchValue('books', 'שבת');
  const hit = n => ({ id: `hit-${n}`, displayRef: `בראשית ב ${n}`, workTitle: 'בראשית', snippet: { text: 'וישבות ביום השביעי', highlights: [], before: false, after: false } });
  app.keepTorahResults('שבת', { family: 'tanakh' }, { query: 'שבת', total: 90, shown: 40, results: Array.from({ length: 40 }, (_, n) => hit(n + 1)), suggestions: [] });
  browser.win.scrollY = 2600;
  browser.pushRoute('#books/read/Genesis/2/2');
  browser.win.history.back();
  const restored = page();
  assert.match(restored, /value="שבת"/, 'the text is in the field');
  assert.match(restored, /data-kz-results/, 'the results are shown');
  assert.match(restored, /role="radio" aria-checked="true" class="on"[^>]*>תנ״ך</, 'the same family chip');
  assert.equal((restored.match(/class="library-row torah-hit"/g) || []).length, 40, 'both loaded pages of results, not only the first');
  assert.match(restored, /עוד תוצאות/);
  assert.doesNotMatch(restored, /כל הספרים \(/, '"כל הספרים" stays opened');
  assert.equal(app.entryRecord(browser.win.history.state.kzKey).scrollY, 2600, 'the scroll to restore');
  browser.win.history.back();
  const origin = page();
  assert.doesNotMatch(origin, /data-kz-results/, 'Back again: the library as it was before the search');
  assert.match(origin, /id="library-search"[^>]*value=""/);
});

test('halacha search: Back from an answer shows the question and its answers; Back again the Halacha home', () => {
  app._resetEntries();
  const browser = fakeBrowser('#halacha', { kzKey: 'halacha', kzDepth: 1, source: null });
  const page = () => render(React.createElement(app.HalachaLibrary, { route: app.parseHalachaRoute('halacha'), go: () => {}, openSource: () => {}, back: () => {}, context: {} }));
  page();
  const question = 'שכחתי יעלה ויבוא';
  app.writeRouteState('halacha', 'halacha-query', question);
  app.writeRouteState('halacha', 'halacha-submitted', question);
  app.noteSearchValue('halacha', question);
  browser.pushRoute('#halacha/q/forgot-yaale');
  browser.win.history.back();
  const restored = page();
  assert.match(restored, new RegExp(`id="halacha-search"[^>]*value="${question}"`));
  assert.match(restored, /class="halacha-results"[^>]*data-kz-results/);
  browser.win.history.back();
  const home = page();
  assert.match(home, /id="halacha-search"[^>]*value=""/);
  assert.doesNotMatch(home, /data-kz-results/);
});

test('the questions database filter comes back with its list', () => {
  app._resetEntries();
  const browser = fakeBrowser('#halacha/all', { kzKey: 'all', kzDepth: 1, source: null });
  const route = app.parseHalachaRoute('halacha/all');
  const page = () => render(React.createElement(app.HalachaIndex, { go: () => {}, route }));
  page();
  app.writeRouteState('all', 'halacha-index-filter', 'תפילין');
  app.noteSearchValue('all', 'תפילין');
  browser.pushRoute('#halacha/chat');
  browser.win.history.back();
  const restored = page();
  assert.match(restored, /value="תפילין"/);
  assert.match(restored, /halacha-index-list" data-kz-results/);
  browser.win.history.back();
  assert.doesNotMatch(page(), /data-kz-results/);
});

test('in-book search: a result opens as a new step (Back returns to the results), not a replacement', () => {
  const library = src('pages/LibraryPage.jsx');
  assert.match(library, /useSearchState\('library-reader-query'\)/);
  assert.match(library, /const openHitHere = \(target, targetUnit\) => go\(libraryRoute\.read\(work\.workId, target, targetUnit\)\);/);
  assert.doesNotMatch(library, /setQuery\(''\); within\(/, 'the search is no longer cleared and replaced');
  assert.doesNotMatch(library, /setQuery\(''\); if \(hit\.workId === work\.workId\) within/);
  // Returning to the place does not jump to the unit over the restored scroll.
  assert.match(library, /if \(isRestoring\(\)\) return;/);
});

test('every search that opens results keeps its text per entry (one mechanism, no per-screen history code)', () => {
  const uses = {
    'pages/LibraryPage.jsx': ["useSearchState('library-query')", "useSearchState('category-query')", "useSearchState('library-toc-filter')", "useSearchState('library-reader-query')", "useRouteState('library-all-books', false)"],
    'pages/HalachaLibrary.jsx': ["useSearchState('halacha-query', kept)", "useSearchState('halacha-submitted', kept)"],
    'components/halacha/HalachaIndex.jsx': ["useSearchState('halacha-index-filter')"],
    'components/halacha/HalachaChat.jsx': ["useRouteState('halacha-chat', EMPTY)"],
    'pages/BlessingsEngine.jsx': ["useSearchState('brachot-query')", "useRouteState('brachot-limit', 30)"],
    'pages/ShalomRavPage.jsx': ["useSearchState('shalom-rav-query')"],
    'pages/TraditionPage.jsx': ["useSearchState('tradition-query')"],
    'pages/PersonalTools.jsx': ["useSearchState('verse-query')", "useSearchState('baby-names-query')"],
    'pages/TalmudPage.jsx': ["useSearchState('talmud-daf-input')"],
  };
  for (const [file, needles] of Object.entries(uses)) for (const needle of needles) assert.ok(src(file).includes(needle), `${file}: ${needle}`);
  for (const file of Object.keys(uses)) assert.doesNotMatch(src(file), /history\.pushState/, `${file} leaves history to the app`);
});

test('the app: split before every push and after a plain link; Back restores the header search; results take the focus', () => {
  const app = src('NewApp.jsx');
  const push = app.slice(app.indexOf('const pushRoute ='), app.indexOf('const nav ='));
  assert.ok(push.indexOf('splitSearchEntry()') < push.indexOf('history.pushState'), 'the results entry comes first');
  assert.match(push, /const \{ kzResults: _results, \.\.\.previous \} = history\.state \|\| \{\};/, 'the destination is not a results entry');
  assert.match(app, /splitAfterHashNavigation\(\{fromKey:from\.key,fromURL:event\.oldURL,fromDepth:depthRef\.current\}\)/);
  // Back to an entry reads its header-search text (it used to be cleared on every Back).
  assert.match(app, /setQuery\(readRouteState\(state\?\.kzKey,GLOBAL_SEARCH\)\?\.value\|\|''\)/);
  assert.doesNotMatch(app, /setSource\(source\);setQuery\(''\);/);
  // The header text is kept per entry by a Map write when it changes — no storage, no history, no extra search.
  assert.match(app, /writeRouteState\(key, GLOBAL_SEARCH, text\); noteSearchValue\(key, text\); \}, \[query, source\]\);/);
  assert.match(app, /if \(!focusSearchResults\(\)\)/);
  assert.match(app, /<Fragment key=\{resultsKey \|\| 'page'\}>/);
  // The results regions are marked for the focus, on every family of search.
  for (const file of ['pages/LearningSearch.jsx', 'components/TorahSearchResults.jsx', 'pages/LibraryPage.jsx', 'pages/HalachaLibrary.jsx', 'components/halacha/HalachaIndex.jsx', 'pages/ShalomRavPage.jsx', 'pages/TraditionPage.jsx', 'pages/BlessingsEngine.jsx']) assert.match(src(file), /data-kz-results/, file);
});

test('focus after Back to results goes to their heading, never the search field', () => {
  const heading = { attributes: {}, focused: false, hasAttribute(name) { return name in this.attributes; }, setAttribute(name, value) { this.attributes[name] = value; }, focus() { this.focused = true; } };
  const region = { querySelector: () => heading, hasAttribute: () => false };
  const doc = { querySelector: selector => (selector === '[data-kz-results]' ? region : null) };
  assert.equal(app.focusSearchResults(doc), true);
  assert.equal(heading.focused, true);
  assert.equal(heading.attributes.tabindex, '-1');
  assert.equal(app.focusSearchResults({ querySelector: () => null }), false);
});
