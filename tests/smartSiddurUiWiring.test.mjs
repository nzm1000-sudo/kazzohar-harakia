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

const readerSource = readFileSync(fileURLToPath(new URL('../src/components/SourceReader.jsx', import.meta.url)), 'utf8');
const forgottenSource = readFileSync(fileURLToPath(new URL('../src/pages/ForgottenAddition.jsx', import.meta.url)), 'utf8');
const booksSource = readFileSync(fileURLToPath(new URL('../src/pages/BooksPage.jsx', import.meta.url)), 'utf8');
const cssSource = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');

test('SourceReader passes the real Jewish date context and original edition markup to the Siddur normalizer', () => {
  assert.match(readerSource, /normalizeSiddurBlocks\(siddurParagraphs,\s*\{[\s\S]*?context: jewishContext/);
  assert.match(readerSource, /markup: siddurParagraphs\.map\(part => text\?\.siddurMarkup\?\.\[part\.source\]/);
});

test('the reader renders no condition/debug panel or internal anchor copy', () => {
  assert.doesNotMatch(readerSource, /PrayerConditionPanel|siddur-condition-panel/);
  assert.doesNotMatch(readerSource, /עוגן מאומת|אין עוגן|NOT_VERIFIED/);
  assert.doesNotMatch(cssSource, /\.siddur-condition-panel\{/);
});

test('the actual recited phrase (not the instruction label) stays in the prayer reading-ink color', () => {
  assert.match(cssSource, /\.siddur-block-recited,[^{]*\{color:var\(--ink\)/);
  assert.match(readerSource, /data-siddur-type=\{block\.type\}/);
  assert.match(readerSource, /markup: siddurParagraphs\.map\(part => text\?\.siddurMarkup\?\.\[part\.source\]/);
  assert.match(readerSource, /context: jewishContext/);
  assert.match(readerSource, /reading-segment reading-\$\{block\.legacyType\}/);
});

test('condition omissions are handled by section filtering, not advisory panel output', () => {
  assert.match(booksSource, /shouldDisplaySiddurSection\(item\.en, summary\)/);
  assert.doesNotMatch(readerSource, /לא אומרים היום|לבדיקה \(לא מאומת\)/);
  assert.doesNotMatch(booksSource, /summary\.hasTachanun \?|context\.additions\.map/);
});

test('the navigable prayer flow (not just the browse list) is contextually filtered, so opening Mincha skips an irrelevant Vidui in sequence', () => {
  assert.match(booksSource, /\.filter\(item => shouldDisplaySiddurSection\(item\.en, summary\)\)/, 'collectSiddurLeaves feeds the same section rules used by the TOC, so prev/next navigation already assembles only the relevant sequence');
});

test('the forgotten-addition topic rows use a dedicated compact layout, not the mismatched 3-column personal-tool-row', () => {
  assert.match(forgottenSource, /forgotten-topic-row/);
  assert.doesNotMatch(forgottenSource, /personal-tool-row/);
  assert.match(cssSource, /\.forgotten-topic-row\{display:flex;align-items:center;justify-content:space-between/);
  assert.match(cssSource, /\.forgotten-topic-arrow\{flex:0 0 auto/);
});

test('forgotten addition tool still renders the topic list without a network call', () => {
  const ForgottenAddition = loadJsxModule('pages/ForgottenAddition.jsx').default;
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const html = renderToStaticMarkup(React.createElement(ForgottenAddition));
  assert.match(html, /forgotten-topic-row/);
  assert.match(html, /forgotten-topic-arrow/);
});
