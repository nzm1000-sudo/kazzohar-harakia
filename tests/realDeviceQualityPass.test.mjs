import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

function loadJsxModule(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({
    entryPoints: [source],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    loader: { '.jsx': 'jsx' },
    jsx: 'automatic',
    define: { 'import.meta.env.BASE_URL': '"/"' },
    external: ['react', 'react/jsx-runtime', 'react-dom/server'],
  }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const learningSource = readFileSync(fileURLToPath(new URL('../src/pages/LearningSearch.jsx', import.meta.url)), 'utf8');
const personalToolsSource = readFileSync(fileURLToPath(new URL('../src/pages/PersonalTools.jsx', import.meta.url)), 'utf8');
const readerSource = readFileSync(fileURLToPath(new URL('../src/components/SourceReader.jsx', import.meta.url)), 'utf8');
const cssSource = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');

test('Daily Learning ("הלימוד היומי") shows the Gregorian date and the Hebrew date together, and drops the old disclaimer sentence', () => {
  const { LearningPage } = loadJsxModule('pages/LearningSearch.jsx');
  const html = renderToStaticMarkup(React.createElement(LearningPage, {
    context: { civil: '2026-09-24', date: { label: 'י״ג בתשרי תשפ״ז' } },
    settings: { il: true },
    openSource: () => {},
  }));
  assert.match(html, /י״ג בתשרי תשפ״ז/);
  assert.doesNotMatch(html, /זהו סדר לימוד, לא פסק הלכה/);
});

test('Daily Learning cards use a single coherent row: fixed badge, text block, fixed arrow slot — never the old flex-stretched .index-number', () => {
  const learningPageBody = learningSource.match(/export function LearningPage[\s\S]*?\n\}/)?.[0] || '';
  assert.match(learningPageBody, /className=\{`daily-learning-card tone-\$\{i%5\}`\}/);
  assert.match(learningPageBody, /className="daily-learning-badge"/);
  assert.match(learningPageBody, /className="daily-learning-card-arrow"/);
  assert.doesNotMatch(learningPageBody, /className="index-row"/, 'the old shared .index-row layout (with its first-child flex:1 collision) must not be reused here');
  assert.match(cssSource, /\.daily-learning-badge\{[^}]*width:30px/);
  assert.match(cssSource, /\.daily-learning-card-arrow\{[^}]*flex:0 0 20px/);
});

test('Daily Learning cards get a subtle palette-derived tone per card (same hue-rotate technique as Halacha groups), not a rainbow', () => {
  for (let tone = 0; tone < 5; tone += 1) {
    assert.match(cssSource, new RegExp(`\\.daily-learning-card\\.tone-${tone}\\{--tone-shift:`));
  }
  assert.match(cssSource, /\.daily-learning-card\{[^}]*filter:hue-rotate\(var\(--tone-shift/);
});

test('the MyParasha year field no longer renders an inline row of year chips ("2021 2022 2023…"), only the native year select', () => {
  assert.doesNotMatch(personalToolsSource, /year-grid/);
  assert.doesNotMatch(personalToolsSource, /yearPickerOpen/);
  assert.doesNotMatch(personalToolsSource, /שנה מהירה/);
  assert.match(personalToolsSource, /<select value=\{year\}/, 'the native year <select> (a real wheel picker on iOS) remains the only year control');
});

test('Siddur semantic levels are wired with real classes, not string-guessing: heading (Level 1), instruction (Level 2), recited text (Level 3)', () => {
  assert.match(readerSource, /className=\{cacheType === 'siddur' \? 'siddur-heading' : undefined\}/);
  assert.match(cssSource, /--siddur-editorial:color-mix/);
  assert.match(cssSource, /\.source-reader h2\.siddur-heading\{color:var\(--siddur-editorial\)/);
  assert.match(cssSource, /\.reading-text\.siddur-semantic \.siddur-block-instruction\{[^}]*color:var\(--ink-2\)/);
  assert.match(cssSource, /\.reading-text\.siddur-semantic \.siddur-block-recited,[^{]*\{color:var\(--ink\)/);
  assert.match(cssSource, /\.siddur-index summary\{[^}]*color:var\(--siddur-editorial\)/);
});

test('the --siddur-editorial token is a genuine blend, not a bare alias of --danger', () => {
  const rule = cssSource.match(/--siddur-editorial:color-mix\(in srgb,var\(--danger\)[^;]*\);/)?.[0];
  assert.ok(rule, 'expected a color-mix blend definition');
  assert.match(rule, /var\(--accent-soft\)/, 'the blend must retain the selected palette while staying in the warm editorial family');
});

test('no raw instruction/condition text is ever rendered inside the .reading-text (recited-prayer) article', () => {
  assert.doesNotMatch(readerSource, /className="reading-text"[^>]*>\{.*siddur-instruction-label/);
  const readingTextBlock = readerSource.match(/<article className="reading-text"[\s\S]*?<\/article>\}/)?.[0] || '';
  assert.doesNotMatch(readingTextBlock, /siddur-instruction-label/);
  assert.doesNotMatch(readingTextBlock, /PrayerConditionPanel/);
});
