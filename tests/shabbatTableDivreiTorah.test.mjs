import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL('../src/pages/ShabbatTable.jsx', import.meta.url));
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
const shabbatModule = new Module(source);
shabbatModule.filename = source;
shabbatModule.paths = Module._nodeModulePaths(root);
shabbatModule._compile(compiled, source);
const ShabbatTable = shabbatModule.exports.default;
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('the דבר תורה preview card is collapsed by default and shows only a single grounded summary line', () => {
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, { context: { parasha: { hebrew: 'בראשית' } } }));
  assert.match(html, /table-preview-card/);
  assert.doesNotMatch(html, /table-divrei-torah/, 'the expanded multi-item view is not rendered until the user taps the preview');
});

test('the preview card uses a fixed arrow slot, not a floating/flex-grow arrow', () => {
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, { context: { parasha: { hebrew: 'בראשית' } } }));
  assert.match(html, /table-preview-arrow/);
});

test('a holiday-override Shabbat honestly explains the regular parasha is deferred, instead of silently showing unrelated content', () => {
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, {
    context: { parasha: { hebrew: 'בראשית' }, shabbatReading: { category: 'holiday', hebrew: 'סוכות א׳' } },
  }));
  assert.match(html, /בשבת זו קוראים את קריאת החג/);
  assert.match(html, /סוכות א׳/);
});

test('no content renders an honest "not available" notice rather than fabricated Torah content', () => {
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, { context: { parasha: { hebrew: 'לא קיים' } } }));
  assert.match(html, /אין כרגע תוכן מאומת/);
});
