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

test('SourceReader resolves prayer conditions from the real Jewish context, once, for Siddur references only', () => {
  assert.match(readerSource, /const prayerType = cacheType === 'siddur' \? prayerTypeFromFlowKey\(navigation\?\.flowKey\) : null;/);
  assert.match(readerSource, /const conditions = cacheType === 'siddur' && jewishContext \? resolvePrayerConditions\(jewishContext, prayerType\) : null;/);
});

test('the condition panel is visually distinct from the prayer text: instruction labels use the muted rust token, never the reading font/size', () => {
  assert.match(cssSource, /\.siddur-condition-panel\{[^}]*background:color-mix\(in srgb,var\(--instruction\)/);
  assert.match(cssSource, /\.siddur-instruction-label\{[^}]*color:var\(--instruction\)/);
  assert.match(cssSource, /\.siddur-condition-chip\{[^}]*font-size:13px/);
  const readingTextRule = cssSource.match(/\.reading-text\{[^}]*\}/)?.[0] || '';
  assert.doesNotMatch(readingTextRule, /font-size:13px/);
});

test('the actual recited phrase (not the instruction label) stays in the prayer reading-ink color', () => {
  assert.match(cssSource, /\.siddur-block-recited\{[^}]*color:var\(--ink\)/);
  assert.match(readerSource, /data-siddur-type=\{block\.type\}/);
  assert.match(readerSource, /additions: conditions\?\.inline/);
});

test('inserts, omissions, and NOT_VERIFIED review items each get their own distinguishable class', () => {
  assert.match(readerSource, /className="siddur-condition-chip insert"/);
  assert.match(cssSource, /\.siddur-condition-chip\.omit \.siddur-recited-text\{[^}]*text-decoration:line-through/);
  assert.match(cssSource, /\.siddur-condition-chip\.review \.siddur-recited-text\{/);
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
