import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { DEFAULT_SETTINGS } from '../src/services.mjs';
import { _resetEntries, readRouteState, writeRouteState } from '../src/services/scrollRestoration.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const readerSource = read('../src/components/ComposedPrayerReader.jsx');
const css = read('../src/styles/base.css');

function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env.BASE_URL': '"/"' }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}

function renderMincha() {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: ComposedPrayerReader } = loadJsx('components/ComposedPrayerReader.jsx');
  return renderToStaticMarkup(React.createElement(ComposedPrayerReader, { reference: 'Siddur Edot HaMizrach, Weekday Mincha, Amidah', settings: DEFAULT_SETTINGS, now: new Date('2026-09-28T12:00:00+03:00') }));
}

const navSource = read('../src/components/PrayerSectionNav.jsx');

test('one shared in-prayer nav renders both the bar and the TOC panel', () => {
  const body = navSource.slice(navSource.indexOf("  const nav = <div className={slot ? 'prayer-nav in-header' : 'prayer-nav'}>"));
  assert.ok(body.includes('prayer-nav-bar') && body.includes('prayer-nav-popover'));
  assert.match(readerSource, /<PrayerSectionNav /, 'Mincha uses it');
  assert.match(read('../src/components/SourceReader.jsx'), /<PrayerSectionNav /, 'every other Siddur prayer uses it');
});

test('in-prayer navigation (הקודם | תוכן | הבא) is always available, built from the real sections', () => {
  const html = renderMincha();
  assert.match(html, /class="prayer-nav-bar"/);
  assert.ok(html.indexOf('prayer-nav-bar') < html.indexOf('class="siddur-heading"'), 'the bar sits at the top of the reader, not at the bottom');
  assert.match(html, />תוכן</);
  assert.match(html, /הקודם/);
  assert.match(html, /הבא/);
  assert.doesNotMatch(readerSource + navSource, /['"]אשרי['"]|['"]וידוי['"]/, 'section names are not hardcoded');
  assert.match(readerSource, /items=\{headings\.map\(section =>/);
});

test('section jumps stay in the same reader and PrayerSession', () => {
  const jump = readerSource.match(/const jumpTo = [^\n]+/)[0];
  assert.match(jump, /scrollIntoView/);
  assert.doesNotMatch(jump, /renew|createPrayerSession|setSession|openSource/);
  assert.match(readerSource, /onSelect=\{item => jumpTo\(item\.id\)\}/);
});

test('bar is pinned under the status bar; the sections list is a compact popover, not a half-screen panel', () => {
  assert.match(css, /\[id\^="prayer-section-"\][^{]*\{scroll-margin-top:calc\(env\(safe-area-inset-top/);
  assert.match(css, /\.prayer-nav\{position:sticky;top:calc\(env\(safe-area-inset-top/);
  const popover = css.match(/\.prayer-nav-popover\{[^}]*\}/)[0];
  assert.match(popover, /width:min\(300px/);
  assert.match(popover, /max-height:min\(58dvh/);
  const row = css.match(/\.prayer-nav-list button\{[^}]*\}/)[0];
  assert.doesNotMatch(row, /border:1px/, 'list rows are plain rows, not boxed tiles');
  assert.doesNotMatch(css, /prayer-toc-panel|prayer-quicknav/, 'old full-height panel and bottom bar are gone');
});

test('Siddur groups are controlled per history entry: Back restores them, a fresh visit starts collapsed', () => {
  const siddur = read('../src/pages/BooksPage.jsx');
  assert.match(siddur, /useRouteState\('siddur-expanded',\[\]\)/);
  assert.match(siddur, /open=\{Boolean\(q\)\|\|expanded\.includes\(groupKey\)\}/);
  assert.match(siddur, /onToggle=/);
  _resetEntries();
  writeRouteState('mincha-visit', 'siddur-expanded', ['Weekday Mincha']);
  assert.deepEqual(readRouteState('mincha-visit', 'siddur-expanded'), { value: ['Weekday Mincha'] });
  assert.equal(readRouteState('new-visit', 'siddur-expanded'), null);
});

test('all other prayers: moving between sections replaces the entry, and "חזרה" is a real Back to the index', () => {
  const history = read('../src/services/readerHistory.mjs');
  assert.match(history, /\{ replace: true \}\)/);
  assert.match(history, /backTo\(spec\.returnRoute/);
  assert.match(read('../src/NewApp.jsx'), /if\(extra\.replace&&history\.state\?\.source\)\{history\.replaceState/);
});

test('the sections list comes from the prayer flow itself (Shacharit, Arvit…)', async () => {
  const { restoreReaderNavigation } = await import('../src/services/readerHistory.mjs');
  const flow = [{ reference: 'S, Weekday Shacharit, Ashrei', title: 'אשרי', mode: 'nikud' }, { reference: 'S, Weekday Shacharit, Amida', title: 'עמידה', mode: 'nikud' }];
  const opened = [];
  const nav = restoreReaderNavigation({ flow, index: 0, flowKey: 'Weekday Shacharit', flowTitle: 'שחרית לחול', returnRoute: 'siddur', breadcrumbs: [] }, { openSource: (...args) => opened.push(args), navigate: () => {} });
  assert.equal(nav.flowTitle, 'שחרית לחול');
  nav.onSelect(flow[1]);
  assert.equal(opened[0][0], 'S, Weekday Shacharit, Amida');
  assert.deepEqual(opened[0][4], { replace: true });
  assert.equal(opened[0][3].index, 1, 'הבא/הקודם continue from the new section');
});

test('in Siddur prayers the header search gives its place to the prayer nav; elsewhere search stays', () => {
  const shell = read('../src/components/Shell.jsx');
  assert.match(shell, /prayerMode \? <div className="head-prayer-slot" id="kz-head-prayer-slot" \/> : <label className="head-search">/);
  assert.match(read('../src/NewApp.jsx'), /prayerMode=\{Boolean\(\(isDayServiceReference\(source\?\.reference\) && !source\.reference\.endsWith\('birkat-hamazon'\)\) \|\| \(source\?\.reference\?\.startsWith\('Siddur Edot HaMizrach'\) && \(isWeekdayMinchaReference\(source\.reference\) \|\| \(source\.navigation\?\.flow\?\.length \|\| 0\) > 1\)\)\)\}/, 'the Smart Siddur and multi-section prayers put their navigation in the header; single-section prayers (Birkat HaMazon) keep the search — no empty header');
  assert.match(navSource, /createPortal\(nav, slot\)/);
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: Shell } = loadJsx('components/Shell.jsx');
  const props = { page: 'siddur', onNav: () => {}, query: '', setQuery: () => {}, theme: 'light', setTheme: () => {} };
  assert.match(renderToStaticMarkup(React.createElement(Shell, props)), /חיפוש בספרייה/);
  const inPrayer = renderToStaticMarkup(React.createElement(Shell, { ...props, prayerMode: true }));
  assert.doesNotMatch(inPrayer, /חיפוש בספרייה/);
  assert.match(inPrayer, /kz-head-prayer-slot/);
});

test('the Siddur index is gathered into families; a prayer is one row that opens at its start, only collections unfold', () => {
  const siddur = read('../src/pages/BooksPage.jsx');
  assert.match(siddur, /SIDDUR_GROUPS = \[/);
  for (const title of ['תפילות החול', 'ראש חודש ותעניות', 'ברכות', 'שבת']) assert.match(siddur, new RegExp(`title: '${title}'`));
  assert.match(siddur, /className="siddur-entry" onClick=\{\(\)=>openItem\(items\[0\]\)\}/);
  assert.match(siddur, /SIDDUR_COLLECTIONS\.has\(rootEn\)/);
  assert.match(siddur, /\{q\?<div className="siddur-index">/, 'search still lists every matching prayer');
});

test('the Siddur index stays quiet: no counts on the families, no list of parts under a prayer', () => {
  const siddur = read('../src/pages/BooksPage.jsx');
  assert.doesNotMatch(siddur, /group\.roots\.length\}<\/small>/);
  assert.doesNotMatch(siddur, /partsLine/);
});
