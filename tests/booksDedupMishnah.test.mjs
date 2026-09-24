import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { buildMishnahToc } from '../src/services/localBookToc.mjs';

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
    external: ['react', 'react/jsx-runtime'],
  }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}

test('a single-section book title is not duplicated: it appears once as its own clickable row', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/pages/BooksPage.jsx', import.meta.url)), 'utf8');
  assert.match(source, /book-row-single/, 'a dedicated single-row class exists for fallback books');
  // The fallback branch must return before ever reaching the nested <details> summary/list duplication.
  assert.match(source, /if \(toc\.fallback\) return <button[^>]*className="index-row book-row-single"/);
});

test('groupMishnahPerakim keeps each perek heading paired only with its own mishnayot', () => {
  const { groupMishnahPerakim } = loadJsxModule('pages/BooksPage.jsx');
  const toc = buildMishnahToc({ id: 'mishnah', title: 'כל המשניות עם פירוש', reference: 'Mishnah' }, {});
  const berakhotItems = toc.sections.filter(section => section.masechet === 'משנה ברכות' && section.kind !== 'masechet');
  const groups = groupMishnahPerakim(berakhotItems);
  assert.ok(groups.length > 1, 'Berakhot has more than one perek');
  assert.equal(groups[0].perek.label, 'פרק א׳');
  assert.equal(groups[0].mishnayot.length, 5, 'perek 1 of Berakhot has 5 mishnayot');
  assert.ok(groups[0].mishnayot.every(item => item.ref.startsWith(groups[0].perek.ref + ':')));
  assert.equal(groups[1].perek.label, 'פרק ב׳');
});

test('Mishnah rows and perek headings use visually distinct classes', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/pages/BooksPage.jsx', import.meta.url)), 'utf8');
  assert.match(source, /mishnah-perek-heading/);
  assert.match(source, /className="index-row mishnah-row"/);
});

test('the Mishnah accordion opens one seder/masechet at a time via the shared single-open helper', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/pages/BooksPage.jsx', import.meta.url)), 'utf8');
  assert.match(source, /mishnah-active-seder-v1/);
  assert.match(source, /mishnah-active-masechet-v1/);
  assert.match(source, /toggle\(setActiveSeder, activeSeder, seder\)/);
});
