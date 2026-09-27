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

test('the Shabbat table shows the week\'s three divrei torah openly, each with its source', () => {
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, { context: { parasha: { hebrew: 'בראשית' } }, now: new Date('2026-10-05T09:00:00Z') }));
  assert.match(html, /שלושה דברי תורה/);
  assert.equal((html.match(/class="table-divrei-item"/g) || []).length, 3);
  assert.equal((html.match(/<cite>/g) || []).length >= 3, true);
});

test('during a festival week the festival\'s divrei torah replace the parasha', () => {
  const items = [{ category: 'holiday', date: '2026-09-27', title: 'Sukkot II (CH’’M)', hebrew: 'סוכות ב׳ (חוה״מ)' }];
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, { context: { parasha: { hebrew: 'בראשית' } }, items, now: new Date('2026-09-27T09:00:00Z') }));
  assert.match(html, /<h1>סוכות<\/h1>/);
  assert.equal((html.match(/class="table-divrei-item"/g) || []).length, 3);
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
