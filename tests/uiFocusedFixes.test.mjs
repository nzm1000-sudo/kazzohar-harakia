import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import siddurOffline from '../src/data/siddurOffline.mjs';

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

test('the More menu keeps every route in the requested visible order', () => {
  const { MORE } = loadJsxModule('components/Shell.jsx');
  assert.deepEqual(MORE, [
    ['halacha', 'הלכה'],
    ['talmud', 'תלמוד'],
    ['parasha', 'פרשה'],
    ['learning', 'הלימוד היומי'],
    ['personal-tools', 'כלים אישיים'],
    ['travel', 'מצב נסיעה יהודי'],
    ['shabbat-page', 'דף שבת'],
    ['preparation', 'הכנה לשבת ולחג'],
    ['offline', 'תוכן ללא אינטרנט'],
    ['about', 'אודות ומקורות'],
  ]);
});

test('the forgotten-addition label uses the corrected Hebrew spelling', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/pages/BooksPage.jsx', import.meta.url)), 'utf8');
  assert.match(source, /שכחתי תוספת — מה עושים\?/);
  assert.doesNotMatch(source, /תוספה/);
});

test('only the redundant weekday Shacharit wrapper is hidden from navigation', () => {
  const { isSiddurNavigationItemHidden } = loadJsxModule('pages/BooksPage.jsx');
  assert.equal(isSiddurNavigationItemHidden('Weekday Shacharit', 'Morning Prayer'), true);
  for (const section of ['Petichat Eliyahu', 'Order of Talit', 'Order of Tefillin', "Hanna's Prayer", 'Incense Offering', 'Hodu', "Pesukei D'Zimra", 'The Shema', 'Amida']) {
    assert.equal(isSiddurNavigationItemHidden('Weekday Shacharit', section), false, section);
  }
  assert.equal(isSiddurNavigationItemHidden('Shabbat Shacharit', 'Morning Prayer'), false);

  const shacharit = siddurOffline.schema.nodes.find(node => node.key === 'Weekday Shacharit');
  assert.ok(shacharit.nodes.some(node => node.key === 'Morning Prayer'), 'canonical Siddur schema content remains bundled');
  assert.ok(siddurOffline.texts['Siddur Edot HaMizrach, Weekday Shacharit, Morning Prayer'], 'canonical prayer text remains bundled');
});