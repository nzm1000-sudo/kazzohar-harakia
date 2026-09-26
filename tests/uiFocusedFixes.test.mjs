import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import siddurOffline from '../src/data/siddurOffline.mjs';
import { BOOK_CATALOG } from '../src/data/bookCatalog.mjs';
import { buildLocalBookToc } from '../src/services/localBookToc.mjs';

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

test('the More menu stays focused and omits removed bookmark and duplicate routes', () => {
  const { MORE } = loadJsxModule('components/Shell.jsx');
  assert.deepEqual(MORE, [
    ['halacha', 'הלכה'],
    ['books', 'ספרים'],
    ['talmud', 'תלמוד'],
    ['parasha', 'פרשה'],
    ['learning', 'הלימוד היומי'],
    ['personal-tools', 'כלים אישיים'],
    ['shabbat-page', 'דף שבת'],
    ['mitzvot-journal', 'המצוות שלי'],
    ['about', 'אודות ומקורות'],
  ]);
});

test('every top-level page is reachable from the mobile tab bar or its More sheet, and nested routes highlight their owner', () => {
  const Shell = loadJsxModule('components/Shell.jsx');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const html = renderToStaticMarkup(React.createElement(Shell.default, { page: 'halacha/q/qa-tefillin-until-when', onNav() {}, query: '', setQuery() {}, theme: 'light', setTheme() {} }));
  // Mobile sheet is rendered only when open; assert the data instead of the DOM.
  const source = readFileSync(fileURLToPath(new URL('../src/components/Shell.jsx', import.meta.url)), 'utf8');
  assert.match(source, /MOBILE_MORE = \[\.\.\.NAV\.slice\(4\), \.\.\.MORE\]/, 'times (desktop-only NAV entry) must be folded into the mobile More sheet');
  assert.equal(Shell.navRootFor('halacha/q/qa-tefillin-until-when'), 'halacha');
  assert.equal(Shell.navRootFor('talmud/Berakhot/2a'), 'talmud');
  assert.equal(Shell.navRootFor('settings'), 'times');
  assert.equal(Shell.navRootFor('preparation/tasks'), 'shabbat-page');
  assert.equal(Shell.navRootFor(''), 'today');
  assert.match(html, /aria-current="page"[^>]*>הלכה</, 'nested halacha route highlights the הלכה entry');
});

test('the books catalog contains the requested Hebrew source titles', () => {
  const titles = new Set(BOOK_CATALOG.map(book => book.title));
  for (const title of ['בן פורת יוסף', 'נועם אלימלך', 'צפנת פענח', 'ליקוטי מוהר״ן', 'חובות הלבבות', 'מסילת ישרים', 'כל המשניות עם פירוש', 'כל התנ״ך']) {
    assert.equal(titles.has(title), true, title);
  }
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

test('the Tanakh accordion selects the new book in one tap and leaves only one book open', () => {
  const { getTanakhAccordionState } = loadJsxModule('pages/BooksPage.jsx');
  const next = getTanakhAccordionState('Joshua', 'Judges');
  assert.equal(next, 'Judges');
  assert.equal(getTanakhAccordionState('Judges', 'Joshua'), 'Joshua');
});

test('the Mishnah TOC resolves to the canonical Seder → Masechet → Perek → Mishnah hierarchy', () => {
  const toc = buildLocalBookToc({ id: 'mishnah', title: 'כל המשניות עם פירוש', reference: 'Mishnah' }, {});
  const seder = toc.sections.find(section => section.ref === 'Mishnah Berakhot');
  const masechet = toc.sections.find(section => section.ref === 'Mishnah Berakhot 1');
  const mishnah = toc.sections.find(section => section.ref === 'Mishnah Berakhot 1:1');
  assert.ok(seder, 'Seder-level node exists');
  assert.ok(masechet, 'Masechet-level node exists');
  assert.ok(mishnah, 'Mishnah-level node exists');
  assert.equal(seder.label, 'זרעים · משנה ברכות');
  assert.equal(masechet.label, 'פרק א׳');
  assert.equal(mishnah.label, 'משנה א׳');
});

test('generic books do not fabricate a fake paragraph-based TOC and the catalog does not show redundant clutter', () => {
  const toc = buildLocalBookToc({ id: 'example-book', title: 'ספר דוגמה', reference: 'Example Book' }, { 'Example Book': true });
  assert.equal(toc.sections.length, 1);
  assert.equal(toc.sections[0].label, 'ספר דוגמה');
  assert.equal(toc.sections[0].ref, 'Example Book');
  const source = readFileSync(fileURLToPath(new URL('../src/pages/BooksPage.jsx', import.meta.url)), 'utf8');
  assert.doesNotMatch(source, /פתיחה מיידית|זמין ללא אינטרנט|הספר המלא|לספר המלא/);
});