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

test('the prayer TOC panel is part of the rendered tree (it used to sit after the return statement)', () => {
  const body = readerSource.slice(readerSource.indexOf('  return <>'));
  assert.ok(body.indexOf('prayer-toc-panel') > 0 && body.indexOf('prayer-toc-panel') < body.indexOf('</>;'), 'TOC panel is inside the returned fragment');
});

test('in-prayer navigation (הקודם | תוכן | הבא) is always available, built from the real sections', () => {
  const html = renderMincha();
  assert.match(html, /class="prayer-quicknav"/);
  assert.match(html, />תוכן</);
  assert.match(html, /הקודם/);
  assert.match(html, /הבא/);
  assert.doesNotMatch(readerSource, /['"]אשרי['"]|['"]וידוי['"]/, 'section names are not hardcoded');
  assert.match(readerSource, /headings\.map\(section =>/);
});

test('section jumps stay in the same reader and PrayerSession', () => {
  const jump = readerSource.match(/const jumpTo = [^\n]+/)[0];
  assert.match(jump, /scrollIntoView/);
  assert.doesNotMatch(jump, /renew|createPrayerSession|setSession|openSource/);
  const step = readerSource.match(/const step = [^\n]+/)[0];
  assert.match(step, /jumpTo\(target\.id\)/);
});

test('a jumped-to heading lands below the status bar and the nav clears tab bar and home indicator', () => {
  assert.match(css, /\[id\^="prayer-section-"\][^{]*\{scroll-margin-top:calc\(env\(safe-area-inset-top/);
  assert.match(css, /\.prayer-quicknav\{position:fixed;[^}]*env\(safe-area-inset-bottom/);
  assert.match(css, /@media \(max-width:860px\)\{\.prayer-quicknav\{bottom:calc\(70px/);
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
