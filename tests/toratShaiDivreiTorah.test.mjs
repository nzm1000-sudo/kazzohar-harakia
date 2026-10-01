// תורת ש״י inside דברי תורה: the owner's own divrei torah on the parasha and the festival (src/data/toratShai, group
// 'parasha') are first-class articles of the Torah content engine — read from the one source, filed under their parasha
// (and חנוכה), always first in the lists, the week's three and the Shabbat table, with and without the archive; the
// essay and the prayer stay out; the reader carries the author's credit; the search finds them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire, Module } from 'node:module';
import { buildSync } from 'esbuild';
import fixtureIndex from './fixtures/torahContentSample/index.mjs';
import { memoryStorage } from './helpers/memoryStorage.mjs';
import { TORAT_SHAI_PIECES } from '../src/data/toratShai/index.mjs';
import {
  articleKindLine, articlesForHoliday, articlesForParasha, buildCatalog, configureTorahContent, groupArticles, loadTorahArticle,
  loadTorahCatalog, parashaCounts, sortArticles,
} from '../src/services/torahContent.mjs';
import { collectionFocus, replaceWeeklyPick, selectWeeklyTorah, torahWeekFocus, weeklyTorah } from '../src/services/torahSelection.mjs';
import { TORAT_SHAI_CREDIT, occasionScope, toratShaiArticles } from '../src/services/toratShaiTorah.mjs';
import { configureTorahSearch, prepareTorahSearch, searchTorahContent, _resetTorahSearch } from '../src/services/torahSearch.mjs';

const EXPECTED = {
  'vayishlach-ohev-o-sone': 'וישלח', 'vayeshev-igra-rama': 'וישב', 'miketz-chanukah-chai-tzomeach-domem': 'מקץ',
  'beshalach-teur-hageula': 'בשלח', 'teruma-koach-uvechira': 'תרומה', 'balak-shalom-veachdut': 'בלק',
};
const OWN_ID = id => `torat-shai:${id}`;
const archivePath = new URL('../src/data/torahContent/index.mjs', import.meta.url);
const realIndex = existsSync(archivePath) ? (await import(archivePath)).default : null;
const catalogs = () => [['without the archive', buildCatalog(null)], ['with the fixture archive', buildCatalog(fixtureIndex)], ...(realIndex ? [['with the real archive', buildCatalog(realIndex)]] : [])];

test('only the parasha pieces come in — from the one source, with stable ids, their parasha and the credit', () => {
  const own = toratShaiArticles();
  assert.deepEqual(own.map(item => item.pieceId), Object.keys(EXPECTED));
  for (const item of own) {
    const piece = TORAT_SHAI_PIECES.find(entry => entry.id === item.pieceId);
    assert.equal(item.id, OWN_ID(piece.id));
    assert.equal(item.title, piece.title);
    assert.deepEqual(item.parashot, [EXPECTED[piece.id]]);
    assert.equal(item.collection, 'torat-shai');
    assert.equal(item.pinned, true);
    assert.equal(item.body.blocks, piece.blocks, 'the blocks are the category\'s own, not a copy');
    assert.equal(item.body.source.ref, 'מאת הרב שלום יוסף ברבי · תורת ש״י');
    assert.ok(item.body.paragraphs.length === piece.blocks.length && item.readMinutes >= 1);
  }
  assert.deepEqual(occasionScope('פרשת מקץ · חנוכה'), { parashot: ['מקץ'], holidays: ['chanukah'] });
  assert.ok(own.find(item => item.pieceId === 'miketz-chanukah-chai-tzomeach-domem').holidays.includes('chanukah'));
  for (const left of ['shalach-lachmecha', 'hodaa-lakadosh-baruch-hu']) {
    assert.ok(TORAT_SHAI_PIECES.some(piece => piece.id === left), `${left} is still in its category`);
    for (const [, catalog] of catalogs()) assert.ok(!catalog.articles.some(item => item.id.includes(left)), `${left} is not a dvar torah of the engine`);
  }
});

test('each piece is first for its parasha, and the Chanukah piece first for Chanukah — with and without the archive', () => {
  for (const [label, catalog] of catalogs()) {
    for (const [id, parasha] of Object.entries(EXPECTED)) {
      const list = articlesForParasha(catalog, parasha);
      assert.equal(list[0].id, OWN_ID(id), `${label}: ${parasha}`);
      assert.equal(list.filter(item => item.collection === 'torat-shai').length, 1, `${label}: ${parasha} has one of the owner's`);
      assert.ok(list.length >= 4, `${label}: ${parasha} keeps its other divrei torah`);
      assert.equal(articlesForParasha(catalog, `פרשת ${parasha}`)[0].id, OWN_ID(id));
      // Every order a reader can choose, and the groups of the collection page, keep it first.
      for (const sort of ['order', 'short', 'long', 'title']) assert.equal(sortArticles(list, sort)[0].id, OWN_ID(id), `${label}: ${parasha} / ${sort}`);
      assert.deepEqual(groupArticles(list)[0].items.map(item => item.id), [OWN_ID(id)]);
      assert.equal(groupArticles(list)[0].label, 'תורת ש״י');
    }
    assert.equal(articlesForHoliday(catalog, 'chanukah')[0].id, OWN_ID('miketz-chanukah-chai-tzomeach-domem'), `${label}: Chanukah`);
    assert.ok(articlesForParasha(catalog, 'בראשית').every(item => item.collection !== 'torat-shai'), 'no piece where there is none');
  }
});

test('without the archive: the app\'s own three stay for every parasha, the owner\'s beside them', () => {
  const catalog = buildCatalog(null);
  assert.equal(catalog.hasArchive, false);
  for (const parasha of Object.values(EXPECTED)) {
    const list = articlesForParasha(catalog, parasha);
    assert.equal(list.filter(item => item.collection === 'app').length, 3, parasha);
    assert.equal(parashaCounts(catalog)[parasha], 4);
  }
  assert.equal(articlesForHoliday(catalog, 'chanukah').filter(item => item.collection === 'app').length, 3);
});

test('the week\'s three: the owner\'s piece first, deterministic, never replaced; three different ones', () => {
  for (const [label, catalog] of catalogs()) {
    for (const [id, parasha] of Object.entries(EXPECTED)) {
      for (const todayKey of ['2026-11-25', '2027-02-10', '2028-07-05']) {
        const focus = collectionFocus('parasha', parasha, { todayKey });
        const picks = selectWeeklyTorah({ focus, catalog, readHistory: [OWN_ID(id)] });
        assert.equal(picks.length, 3, `${label}: ${parasha}`);
        assert.equal(new Set(picks.map(item => item.id)).size, 3);
        assert.equal(picks[0].id, OWN_ID(id), `${label}: ${parasha} — first, even when read`);
        assert.deepEqual(selectWeeklyTorah({ focus, catalog }).map(item => item.id), selectWeeklyTorah({ focus, catalog }).map(item => item.id));
      }
    }
    const chanukah = selectWeeklyTorah({ holiday: 'chanukah', weekKey: '2026-12-05', catalog });
    assert.equal(chanukah[0].id, OWN_ID('miketz-chanukah-chai-tzomeach-domem'), `${label}: Chanukah`);
  }
  // The device's week: kept, the owner's piece stays first; replacing it does nothing, replacing another keeps it.
  const store = memoryStorage();
  const catalog = { ...buildCatalog(fixtureIndex), loaded: true };
  const focus = collectionFocus('parasha', 'וישב', { todayKey: '2026-12-01' });
  const first = weeklyTorah(focus, { catalog, store, persist: true });
  assert.equal(first.picks[0].id, OWN_ID('vayeshev-igra-rama'));
  assert.deepEqual(replaceWeeklyPick(focus, 0, { catalog, store }).picks.map(item => item.id), first.picks.map(item => item.id));
  const replaced = replaceWeeklyPick(focus, 1, { catalog, store });
  assert.equal(replaced.picks[0].id, OWN_ID('vayeshev-igra-rama'));
  assert.notEqual(replaced.picks[1].id, first.picks[1].id);
  // A week saved before the owner's piece existed is chosen again, with it first.
  const old = memoryStorage();
  old.setItem('kz-torah-week-v1', JSON.stringify({ weekKey: focus.weekKey, scopes: { [focus.scopeKey]: { picks: ['app-p9-1', 'app-p9-2', 'app-p9-3'], slots: {}, replaced: [] } } }));
  assert.equal(weeklyTorah(focus, { catalog, store: old }).picks[0].id, OWN_ID('vayeshev-igra-rama'));
});

test('the calendar: the week of וישב brings its piece first; a Chanukah week brings the Chanukah piece first', () => {
  for (const [label, catalog] of catalogs()) {
    const vayeshev = torahWeekFocus({ todayKey: '2026-11-30', parashaName: 'פרשת וישב', catalog });
    assert.equal(vayeshev.kind, 'parasha');
    assert.equal(selectWeeklyTorah({ focus: vayeshev, catalog })[0].id, OWN_ID('vayeshev-igra-rama'), label);
    // Chanukah 5787 begins on Friday 2026-12-04 (the Shabbat of וישב): the festival leads, the parasha's own comes with it.
    const items = [{ category: 'holiday', subcat: 'minor', date: '2026-12-05', title: 'Chanukah: 2 Candles', hebrew: 'חנוכה: ב׳ נרות' }];
    const week = torahWeekFocus({ items, todayKey: '2026-12-01', parashaName: 'פרשת וישב', catalog });
    assert.equal(week.kind, 'holiday');
    const picks = selectWeeklyTorah({ focus: week, catalog });
    assert.equal(picks[0].id, OWN_ID('miketz-chanukah-chai-tzomeach-domem'), label);
    assert.equal(picks[1].id, OWN_ID('vayeshev-igra-rama'), `${label}: the parasha's own comes with the festival`);
    assert.equal(picks.length, 3);
  }
});

test('opening one: the whole text with its form, the credit; the row\'s line names תורת ש״י', async () => {
  configureTorahContent({ loadIndex: async () => null, loadSearch: async () => null, loadPack: async () => { throw new Error('none'); } });
  await loadTorahCatalog();
  const article = await loadTorahArticle(OWN_ID('beshalach-teur-hageula'));
  assert.equal(article.title, 'תיאור הגאולה');
  assert.equal(article.source.ref, TORAT_SHAI_CREDIT.line);
  assert.ok(article.paragraphs.length > 5);
  assert.match(articleKindLine(article), /^תורת ש״י · /);
});

test('the search finds them: by title, by a phrase of the text, by the author and by the parasha', async () => {
  configureTorahContent({ loadIndex: async () => fixtureIndex, loadSearch: async () => null, loadPack: async () => { throw new Error('none'); } });
  _resetTorahSearch();
  configureTorahSearch(async () => null);
  await prepareTorahSearch();
  const ids = query => searchTorahContent(query, { limit: 100 }).map(hit => hit.id);
  assert.ok(ids('אוהב או שונא').includes(OWN_ID('vayishlach-ohev-o-sone')));
  assert.ok(ids('חי צומח דומם').includes(OWN_ID('miketz-chanukah-chai-tzomeach-domem')));
  assert.ok(ids('מבירא עמיקתא').includes(OWN_ID('vayeshev-igra-rama')));
  assert.equal(ids('שלום יוסף ברבי').length, 6);
  assert.ok(ids('תרומה').includes(OWN_ID('teruma-koach-uvechira')));
  _resetTorahSearch();
});

// ---- the screens (server-rendered, as the UI tests do) ----
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = fileURLToPath(new URL('..', import.meta.url));
function loadBundle() {
  const contents = [
    "export * from './pages/TorahContentPage.jsx';",
    "export { default as TorahContentPage } from './pages/TorahContentPage.jsx';",
    "export { default as ShabbatTable } from './pages/ShabbatTable.jsx';",
    "export * as engine from './services/torahContent.mjs';",
  ].join('\n');
  const compiled = buildSync({ stdin: { contents, resolveDir: `${root}src`, loader: 'jsx', sourcefile: 'torat-shai-entry.jsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', loader: { '.jsx': 'jsx', '.css': 'empty' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false }) }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const file = `${root}src/torat-shai-entry.jsx`;
  const loaded = new Module(file);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, file);
  return loaded.exports;
}
function withMemoryStorage(run) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage() });
  try { return run(); } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete globalThis.localStorage; }
}

test('the screens: the parasha list opens with the owner\'s piece; the reader credits him; the Shabbat table leads with it', async () => {
  const ui = loadBundle();
  ui.engine.configureTorahContent({ loadIndex: async () => null, loadSearch: async () => null, loadPack: async () => { throw new Error('none'); } });
  await ui.engine.loadTorahCatalog();
  const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
  withMemoryStorage(() => {
    const list = render(ui.TorahContentPage, { route: `torah/parasha/${encodeURIComponent('וישב')}`, go: () => {}, now: new Date('2026-11-30T09:00:00Z') });
    const all = list.split('id="tc-all"')[1];
    assert.match(all, /<h3 class="tc-group-title" id="tc-group-torat-shai">תורת ש״י<small>1<\/small><\/h3>/);
    assert.ok(all.indexOf('מאיגרא רמה לבירא עמיקתא') < all.indexOf('class="tc-group-title" id="tc-group-short"'), 'first in the list');
    const week = list.split('id="tc-collection-week"')[1].split('</section>')[0];
    assert.match(week.split('<li')[1], /מאיגרא רמה לבירא עמיקתא/, 'first of the three');
    assert.doesNotMatch(week.split('<li')[1], /class="tc-replace"/, 'the owner\'s piece is not replaced');
    const chanukah = render(ui.TorahContentPage, { route: 'torah/holiday/chanukah', go: () => {} });
    assert.ok(chanukah.split('id="tc-all"')[1].indexOf('חי, צומח, דומם') > 0);
    assert.match(chanukah.split('id="tc-all"')[1].split('<li')[1], /חי, צומח, דומם/);

    const reader = render(ui.TorahArticleReader, { id: OWN_ID('vayishlach-ohev-o-sone'), go: () => {} });
    assert.match(reader, /<h1 id="tc-article-title">אוהב או שונא<\/h1>/);
    assert.match(reader, /<p class="tc-article-byline">מאת הרב שלום יוסף ברבי<\/p>/);
    assert.match(reader, /<p class="tc-credit-from">תורת ש״י<\/p><p class="tc-credit-author">מאת הרב שלום יוסף ברבי<\/p>/);
    assert.match(reader, /<blockquote class="tc-article-source"><p>וישלח יעקב מלאכים לפניו אל עשו אחיו<\/p><cite>בראשית לב, ד<\/cite><\/blockquote>/);
    assert.match(reader, /<h2 class="tc-article-section">תשובה<\/h2>/);
    assert.match(reader, /class="text-size-control|aria-label="גודל/, 'the same text size control');
    assert.match(reader, /tc-favorite/, 'the same heart');
    assert.match(reader, /tc-prevnext/, 'the same next / previous');

    const table = render(ui.ShabbatTable, { context: { parasha: { hebrew: 'פרשת בשלח' } }, now: new Date('2027-01-19T09:00:00Z') });
    const first = table.split('class="table-divrei-item"')[1];
    assert.match(first, /תיאור הגאולה/);
    assert.match(first, /<cite>מאת הרב שלום יוסף ברבי · תורת ש״י<\/cite>/);
    assert.doesNotMatch(first, />החלף דבר תורה</);
    assert.equal((table.match(/class="table-divrei-item"/g) || []).length, 3);
  });
});

test('the תורת ש״י category itself is untouched by the integration (read-only import)', () => {
  const source = readFileSync(new URL('../src/services/toratShaiTorah.mjs', import.meta.url), 'utf8');
  assert.match(source, /from '\.\.\/data\/toratShai\/index\.mjs'/);
  assert.doesNotMatch(source, /TORAT_SHAI_PIECES\s*\.(?:push|splice)|TORAT_SHAI_PIECES\s*=/);
});
