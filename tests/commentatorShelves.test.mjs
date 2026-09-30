// Commentator shelves (מפרשי המקרא / המשנה / הש״ס) read commentator-first: commentators → the commentator's books grouped
// by the base text's divisions → the book. Also: a performance guard for the lists and the lookups the readers make, and
// the desktop top navigation ("עוד" for what does not fit) scoped so phones and tablets are untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire, Module } from 'node:module';
import { buildSync } from 'esbuild';
import { WORKS, workById, worksInCategory } from '../src/data/library/registry.mjs';
import { layersOf } from '../src/services/library/relations.mjs';
import { bookTarget, commentatorOf, commentatorOfWork, commentatorsOf, isCommentatorShelf } from '../src/services/library/commentators.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', loader: { '.jsx': 'jsx', '.png': 'empty' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false }) }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}

test('מפרשי המקרא lists commentators — bundled in their customary order, then those read live', () => {
  const list = commentatorsOf('tanakh-commentary');
  assert.deepEqual(list.slice(0, 6).map(item => item.title), ['רש״י', 'רמב״ן', 'אבן עזרא', 'ספורנו', 'אור החיים', 'כלי יקר']);
  assert.ok(list.slice(0, 6).every(item => !item.remote));
  const remote = list.slice(6);
  assert.ok(remote.length > 0 && remote.every(item => item.remote), 'the commentators read live follow');
  assert.ok(remote.some(item => item.title === 'מלבי״ם'));
  // Every public book of the shelf belongs to exactly one commentator; nothing is lost or listed twice.
  const books = list.flatMap(item => item.books.filter(book => !book.remote).map(book => book.workId));
  assert.deepEqual([...books].sort(), worksInCategory('tanakh-commentary').map(work => work.workId).sort());
  assert.equal(new Set(books).size, books.length);
});

test('a commentator lists only the books it has, under תורה · נביאים · כתובים, in canonical order', () => {
  const rashi = commentatorOf('tanakh-commentary', 'rashi');
  assert.deepEqual(rashi.sections.map(section => section.title), ['תורה', 'נביאים', 'כתובים']);
  assert.equal(rashi.books.length, 39);
  assert.deepEqual(rashi.sections[0].books.map(book => book.title), ['בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים']);
  const ramban = commentatorOf('tanakh-commentary', 'ramban');
  assert.deepEqual(ramban.sections.map(section => section.title), ['תורה'], 'no empty section');
  assert.deepEqual(ramban.sections[0].books.map(book => book.title), ['בראשית', 'ויקרא', 'במדבר', 'דברים']);
  // Honest coverage: the books the app does not carry stay named.
  assert.ok(ramban.missing.some(item => item.title === 'רמב״ן על שמות'));
  const malbim = commentatorOf('tanakh-commentary', 'malbim');
  assert.ok(malbim.books.some(book => book.title === 'ישעיהו · ביאור המילות'), 'a second work on the same book is told apart');
});

test('מפרשי המשנה and מפרשי הש״ס: commentator → tractates by seder', () => {
  assert.deepEqual(commentatorsOf('mishnah-commentary').map(item => item.title), ['ברטנורא', 'תוספות יום טוב']);
  const bartenura = commentatorOf('mishnah-commentary', 'bartenura');
  assert.deepEqual(bartenura.sections.map(section => section.title), ['סדר זרעים', 'סדר מועד', 'סדר נשים', 'סדר נזיקין', 'סדר קדשים', 'סדר טהרות']);
  assert.equal(bartenura.sections[0].books[0].title, 'ברכות');
  const tyt = commentatorOf('mishnah-commentary', 'tosafot-yom-tov');
  assert.equal(tyt.sections[0].title, null, 'the introduction opens the list, unnamed');
  const shas = commentatorsOf('talmud-commentary').map(item => item.title);
  assert.deepEqual(shas.slice(0, 3), ['רש״י', 'תוספות', 'רי״ף']);
  assert.ok(shas.includes('רא״ש'));
  const rif = commentatorOf('talmud-commentary', 'rif');
  assert.equal(rif.sections[0].title, 'סדר זרעים');
  assert.equal(rif.sections[0].books[0].title, 'ברכות', 'the Rif is placed by the tractate it belongs to');
  assert.ok(isCommentatorShelf('talmud-commentary') && !isCommentatorShelf('halacha'));
});

test('one tap on a book: a bundled book opens as a book; a live commentator opens its base text with it chosen', () => {
  const rashiGenesis = commentatorOf('tanakh-commentary', 'rashi').books[0];
  assert.deepEqual(bookTarget(rashiGenesis), { kind: 'work', workId: 'Rashi_on_Genesis' });
  const malbimGenesis = commentatorOf('tanakh-commentary', 'malbim').books.find(book => book.base.workId === 'Genesis');
  const target = bookTarget(malbimGenesis);
  assert.equal(target.kind, 'commentary');
  assert.equal(target.baseWorkId, 'Genesis');
  assert.deepEqual(target.choice, { key: 'tanakh', name: 'מלבי״ם' });
  assert.ok(workById('Malbim_on_Genesis').editions[0].anchorNodes.some(row => row[0] === target.node), 'opens at a chapter the commentator reaches');
  const rosh = commentatorOf('talmud-commentary', 'rosh').books[0];
  assert.equal(bookTarget(rosh).kind, 'open', 'the Rishonim read live open in the Talmud reader');
  assert.equal(commentatorOfWork(workById('Rashi_on_Genesis')).id, 'rashi');
  assert.equal(commentatorOfWork(workById('Genesis')), null);
});

test('pages: the shelf shows commentator tiles; a commentator page shows its books; the reader names the commentator', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: LibraryPage, parseLibraryRoute, libraryRoute } = loadJsx('pages/LibraryPage.jsx');
  const render = mode => renderToStaticMarkup(React.createElement(LibraryPage, { route: parseLibraryRoute(mode), go: () => {}, openSource: () => {} }));
  assert.deepEqual(parseLibraryRoute('books/c/tanakh-commentary/rashi'), { view: 'category', id: 'tanakh-commentary', commentator: 'rashi' });
  assert.deepEqual(parseLibraryRoute('books/c/halacha'), { view: 'category', id: 'halacha' });
  assert.equal(libraryRoute.commentator('tanakh-commentary', 'rashi'), 'books/c/tanakh-commentary/rashi');
  const shelf = render('books/c/tanakh-commentary');
  assert.match(shelf, /library-commentators/);
  assert.equal((shelf.match(/class="library-category/g) || []).length, commentatorsOf('tanakh-commentary').length);
  assert.doesNotMatch(shelf, /library-row-title">בראשית</, 'no list of Tanakh books on the shelf itself');
  const rashi = render('books/c/tanakh-commentary/rashi');
  assert.match(rashi, /<h1>רש״י<\/h1>/);
  assert.ok(rashi.indexOf('>תורה<') < rashi.indexOf('>נביאים<') && rashi.indexOf('>נביאים<') < rashi.indexOf('>כתובים<'));
  assert.equal((rashi.match(/class="library-row"/g) || []).length, 39);
  assert.match(render('books/c/tanakh-commentary/ramban'), /לא במהדורה זו: רמב״ן על שמות/);
  for (const mode of ['books/c/mishnah-commentary', 'books/c/talmud-commentary']) assert.match(render(mode), /library-commentators/);
  assert.match(render('books/c/mishnah-commentary/bartenura'), /סדר זרעים/);
  const reader = render(libraryRoute.read('Rashi_on_Genesis', 1));
  assert.match(reader, /מפרשי המקרא[\s\S]*רש״י[\s\S]*רש״י על בראשית/, 'breadcrumbs: shelf › commentator › book');
  // Other shelves keep their lists.
  assert.match(render('books/c/halacha'), /library-row/);
});

test('performance guard: the lists are derived once, and the readers\' lookups do not scan every work', () => {
  const t0 = performance.now();
  for (const shelf of ['tanakh-commentary', 'mishnah-commentary', 'talmud-commentary']) commentatorsOf(shelf);
  assert.ok(performance.now() - t0 < 250, 'three shelves listed in well under a frame budget');
  assert.equal(commentatorsOf('tanakh-commentary'), commentatorsOf('tanakh-commentary'), 'cached');
  const ids = WORKS.map(work => work.workId);
  const t1 = performance.now();
  for (let i = 0; i < 50000; i++) workById(ids[i % ids.length]);
  assert.ok(performance.now() - t1 < 100, 'workById is an index lookup');
  assert.equal(workById('Rashi_on_Genesis').workId, 'Rashi_on_Genesis');
  assert.equal(workById('no-such-work'), null);
  const t2 = performance.now();
  for (let i = 0; i < 5000; i++) layersOf('Genesis');
  assert.ok(performance.now() - t2 < 150, 'layersOf is grouped once');
  assert.deepEqual(layersOf('Genesis').map(work => work.workId), layersOf('Genesis', [...WORKS]).map(work => work.workId), 'same answer as a scan');
  const library = readFileSync(new URL('../src/pages/LibraryPage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(library, /PUBLIC_WORKS\.filter\([^)]*downloadState\(/, 'the saved-books record is not parsed once per book');
});

const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
const blockAt = start => {
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error('unterminated block');
};

test('desktop navigation: one line, the rest under "עוד" — scoped to a mouse and a wide window only', () => {
  const { DESKTOP_NAV_QUERY, navOverflowCount } = loadJsx('components/Shell.jsx');
  assert.equal(DESKTOP_NAV_QUERY, '(min-width:861px) and (hover:hover) and (pointer:fine)');
  const start = css.indexOf(`@media ${DESKTOP_NAV_QUERY}{`);
  assert.ok(start >= 0, 'the desktop block uses the same query as the component');
  const desktop = blockAt(start);
  // Everything the overflow adds lives in that block, except the default that hides "עוד" everywhere else.
  const outside = css.slice(0, start) + css.slice(start + desktop.length);
  assert.deepEqual(outside.match(/\.shell-nav-more[\w-]*\{[^}]*\}|\.is-overflow[^{]*\{[^}]*\}/g), ['.shell-nav-more{display:none}']);
  assert.match(desktop, /\.shell-nav \.is-overflow,\.shell-nav-more\.is-idle\{position:absolute;[^}]*visibility:hidden/);
  // Phones and touch tablets keep their tab bar and sheet, untouched.
  const tablet = blockAt(css.indexOf('@media (pointer:coarse) and (min-width:861px){'));
  assert.doesNotMatch(tablet, /shell-nav-more|is-overflow/);
  assert.match(tablet, /\.shell-nav\{display:none\}/);
  assert.match(css, /@media \(max-width:860px\)\{[\s\S]*?\.shell-nav\{display:none\}/);
  // The fit: all when they fit; otherwise as many as fit beside "עוד".
  assert.equal(navOverflowCount([80, 80, 80], 300, 60, 2), 3);
  assert.equal(navOverflowCount([80, 80, 80, 80], 300, 60, 2), 2);
  assert.equal(navOverflowCount([80, 80], 0, 60, 2), 2, 'a hidden navigation (phone, tablet) is never cut');
});

test('Shell: overflowed destinations are out of the tab order and offered in the menu', () => {
  const shell = readFileSync(new URL('../src/components/Shell.jsx', import.meta.url), 'utf8');
  assert.match(shell, /aria-hidden=\{hidden \|\| undefined\} tabIndex=\{hidden \? -1 : undefined\}/);
  assert.match(shell, /role="menu" aria-label="יעדים נוספים"/);
  assert.match(shell, /event\.key === 'Escape'/);
  assert.match(shell, /window\.matchMedia\?\.\(DESKTOP_NAV_QUERY\)\.matches/, 'measured only where the desktop CSS applies');
});
