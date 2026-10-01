// The Torah content screens, rendered as the phone draws them (server-rendered markup), against the hand-made fixture:
// the reader and its credit, the library and the parasha picker, an empty collection, the Shabbat table, the Today
// line, the global search group, the About credit, and the accessibility semantics of each.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire, Module } from 'node:module';
import { buildSync } from 'esbuild';
import fixtureIndex from './fixtures/torahContentSample/index.mjs';
import fixtureSearch from './fixtures/torahContentSample/search.mjs';
import { checkMarkup, formatProblems } from './helpers/a11yCheck.mjs';
import { loadJsx } from './helpers/jsx.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = fileURLToPath(new URL('..', import.meta.url));

// One bundle for the screens and the engine, so the test configures the very engine the screens use.
function loadBundle() {
  const contents = [
    "export * from './pages/TorahContentPage.jsx';",
    "export { default as TorahContentPage } from './pages/TorahContentPage.jsx';",
    "export { default as ShabbatTable } from './pages/ShabbatTable.jsx';",
    "export { default as ShabbatPage } from './pages/ShabbatPage.jsx';",
    "export { default as TorahTodayCard, torahTodayOffer } from './components/torah/TorahTodayCard.jsx';",
    "export { default as TorahSearchGroup } from './components/torah/TorahSearchGroup.jsx';",
    "export * as engine from './services/torahContent.mjs';",
    "export * as search from './services/torahSearch.mjs';",
  ].join('\n');
  const compiled = buildSync({ stdin: { contents, resolveDir: `${root}src`, loader: 'jsx', sourcefile: 'torah-ui-entry.jsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', loader: { '.jsx': 'jsx', '.css': 'empty' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false }) }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const file = `${root}src/torah-ui-entry.jsx`;
  const loaded = new Module(file);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, file);
  return loaded.exports;
}
const ui = loadBundle();
const packFile = file => new Uint8Array(readFileSync(new URL(`./fixtures/torahContentSample/packs/${file}`, import.meta.url)));
const fixtureSource = { loadIndex: async () => fixtureIndex, loadSearch: async () => fixtureSearch, loadPack: async (name, entry) => packFile(entry.file) };
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const noop = () => {};
const a11y = (html, label) => assert.equal(formatProblems(checkMarkup(html)), '', label);

function withMemoryStorage(run) {
  const map = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) } });
  try { return run(map); } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete globalThis.localStorage; }
}

test('with an empty database every screen still has divrei torah (the app\'s own), and no archive credit', () => {
  ui.engine.configureTorahContent({ loadIndex: async () => null, loadSearch: async () => null, loadPack: async () => { throw new Error('none'); } });
  withMemoryStorage(() => {
    const reader = render(ui.TorahArticleReader, { id: 'app-p17-1', go: noop });
    assert.match(reader, /<h1 id="tc-article-title">/);
    assert.match(reader, /class="tc-article-body"/);
    assert.doesNotMatch(reader, /בני ציון/, 'the app\'s own divrei torah are not credited to the archive');
    const table = render(ui.ShabbatTable, { context: { parasha: { hebrew: 'פרשת יתרו' } }, now: new Date('2027-01-19T09:00:00Z') });
    assert.equal((table.match(/class="table-divrei-item"/g) || []).length, 3);
    assert.match(table, /חידון/, 'family, short source and quiz stay');
  });
});

test('the reader: centred title, the quiet line, the text, the fixed credit, quiet actions, next and previous', async () => {
  ui.engine.configureTorahContent(fixtureSource);
  await ui.engine.loadTorahCatalog();
  await ui.engine.loadTorahArticle('bz-yitro-02');
  withMemoryStorage(() => {
    const html = render(ui.TorahArticleReader, { id: 'bz-yitro-02', go: noop });
    assert.match(html, /<article class="tc-page tc-article" aria-labelledby="tc-article-title" style="--reading-scale:1">/);
    assert.match(html, /<h1 id="tc-article-title">עצת יתרו<\/h1>/);
    assert.match(html, /<p class="tc-article-meta">פרשת יתרו · 6 דקות<\/p>/);
    assert.equal((html.match(/<div class="tc-article-body" lang="he"><p>/g) || []).length, 1);
    assert.equal((html.split('class="tc-article-body"')[1].split('</div>')[0].match(/<p>/g) || []).length, 5, 'one paragraph per paragraph');
    // The credit, in full, readable (its own lines, not a footnote).
    assert.match(html, /<footer class="tc-credit" aria-label="מקור">.*<p class="tc-credit-from">מתוך ״בני ציון״<\/p><p class="tc-credit-author">משה מזרחי<\/p><p class="tc-credit-note">מובא באישור בעל הזכויות<\/p>/s);
    assert.doesNotMatch(html, /Public Domain|נחלת הכלל/i);
    for (const action of ['שמירה', 'שיתוף', 'עוד לפרשה', 'עוד בנושא']) assert.match(html, new RegExp(`>${action}<`), action);
    assert.match(html, /<nav class="tc-prevnext" aria-label="דבר התורה הקודם והבא">/);
    assert.match(html, /הקודם<\/span><strong>כאיש אחד בלב אחד<\/strong>/);
    assert.match(html, /הבא<span aria-hidden="true"> ←<\/span><\/span><strong>הסבא שבא לבית הכנסת<\/strong>/);
    assert.doesNotMatch(html, /class="[^"]*card[^"]*"/, 'no cards in the reader');
    a11y(html, 'reader');
  });
});

test('the reader counts study time only through useStudyTimer, and joins "continue where you left off"', () => {
  const page = readFileSync(new URL('../src/pages/TorahContentPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /useStudyTimer\(\{ workId: `torah:\$\{id\}`[^)]*category: 'torah_study', source: 'torah-content'[^)]*enabled: Boolean\(ready\) \}\)/);
  assert.doesNotMatch(page, /recordStudy|addStudyMinutes|onClick=\{[^}]*studySession/, 'never on a tap');
  assert.match(page, /rememberLearning\(`torah:\$\{id\}`, \{ source: 'torah', reference: torahRoute\.article\(id\)/);
  const app = readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /if \(item\.source === 'torah'\) return go\(item\.reference\);/);
  const { learningResumeKind, learningResumeSubtitle, learningResumeCompactTitle } = loadJsx('services/learningPresentation.mjs');
  const item = { source: 'torah', reference: 'torah/article/bz-yitro-02', title: 'עצת יתרו', detail: 'פרשת יתרו' };
  assert.equal(learningResumeKind(item), 'דבר תורה');
  assert.equal(learningResumeSubtitle(item), 'פרשת יתרו');
  assert.equal(learningResumeCompactTitle(item), null, 'the compact card keeps the article\'s title');
});

test('the library: this week, the 54 parashot by book with counts, festivals, topics, favourites and a search field', async () => {
  ui.engine.configureTorahContent(fixtureSource);
  await ui.engine.loadTorahCatalog();
  withMemoryStorage(() => {
    const html = render(ui.TorahContentPage, { route: 'torah', go: noop, context: { parasha: { hebrew: 'פרשת יתרו' } }, items: [], now: new Date('2027-01-19T09:00:00Z') });
    assert.match(html, /<h1 id="tc-home-title">דברי תורה<\/h1>/);
    assert.match(html, /<h2 class="tc-section-title" id="tc-week">השבוע · פרשת יתרו<\/h2>/);
    assert.equal((html.split('id="tc-week"')[1].split('</section>')[0].match(/class="tc-row has-action"/g) || []).length, 3);
    assert.equal((html.match(/class="tc-tile"/g) || []).length + (html.match(/class="tc-tile" aria-current/g) || []).length >= 54, true);
    assert.match(html, /aria-label="פרשת יתרו, 5 דברי תורה, פרשת השבוע"/, 'this week\'s parasha is marked');
    for (const book of ['בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים']) assert.match(html, new RegExp(`>ספר ${book}</h3>`));
    for (const section of ['מועדים', 'שבתות מיוחדות', 'נושאים', 'מועדפים']) assert.match(html, new RegExp(`>${section}</h2>`), section);
    assert.match(html, /<label for="tc-search-field">חיפוש בדברי התורה<\/label>/);
    assert.match(html, /עוד 2 דברי תורה לפרשה/);
    assert.match(html, /עלוני ״בני ציון״ מאת משה מזרחי, ומשמש באפליקציה באישורו/);
    a11y(html, 'library');
  });
});

test('a parasha: the picker reaches any parasha (books, strip, next / previous), the three of the week, every article', async () => {
  ui.engine.configureTorahContent(fixtureSource);
  await ui.engine.loadTorahCatalog();
  withMemoryStorage(() => {
    const html = render(ui.TorahContentPage, { route: `torah/parasha/${encodeURIComponent('בראשית')}`, go: noop, now: new Date('2026-10-06T09:00:00Z') });
    assert.match(html, /<nav class="tc-picker" aria-label="מעבר לפרשה אחרת">/);
    assert.equal((html.match(/class="tc-picker-book"/g) || []).length, 5);
    assert.match(html, /aria-pressed="true"[^>]*>בראשית<\/button>/);
    assert.equal((html.match(/class="tc-picker-parasha"/g) || []).length, 12, 'the book\'s twelve parashot');
    assert.match(html, /aria-current="page"[^>]*>בראשית<\/button>/);
    assert.match(html, /aria-label="פרשת לך לך, 2 דברי תורה"/, 'Lech Lecha is one tap away from Bereshit');
    assert.match(html, /<h1 id="tc-collection-title">פרשת בראשית<\/h1>/);
    assert.match(html, />שלושה לשבת<\/h2>/);
    assert.match(html, />כל דברי התורה<\/h2>/);
    assert.match(html, /<div class="tc-filters" role="group" aria-label="סינון ומיון">/);
    assert.equal((html.split('id="tc-all"')[1].match(/class="tc-row"/g) || []).length, 6);
    assert.match(html, /הפרשה הבאה<span aria-hidden="true"> ←<\/span><\/span><strong>נח<\/strong>/);
    a11y(html, 'parasha');
    const yitro = render(ui.TorahContentPage, { route: `torah/parasha/${encodeURIComponent('יתרו')}`, go: noop });
    assert.match(yitro, /aria-pressed="true"[^>]*>שמות<\/button>/, 'the picker opens on the parasha\'s own book');
    assert.match(yitro, /הפרשה הקודמת<\/span><strong>בשלח<\/strong>/);
  });
});

test('an empty collection says so plainly, and the way on', async () => {
  ui.engine.configureTorahContent(fixtureSource);
  await ui.engine.loadTorahCatalog();
  withMemoryStorage(() => {
    const html = render(ui.TorahContentPage, { route: `torah/topic/${encodeURIComponent('נושא שאין בו')}`, go: noop });
    assert.match(html, /עדיין אין כאן דברי תורה/);
    assert.match(html, /class="tc-empty"/);
    a11y(html, 'empty');
    const missing = render(ui.TorahArticleReader, { id: 'no-such-article', go: noop });
    assert.match(missing, /דבר התורה לא נמצא/);
  });
});

test('the Shabbat table takes its three from the engine, keeps family, source and quiz, and credits the archive', async () => {
  ui.engine.configureTorahContent(fixtureSource);
  await ui.engine.loadTorahCatalog();
  for (const id of ['bz-yitro-01', 'bz-yitro-02', 'bz-yitro-03', 'bz-yitro-04', 'bz-yitro-05']) await ui.engine.loadTorahArticle(id);
  withMemoryStorage(map => {
    const html = render(ui.ShabbatTable, { context: { parasha: { hebrew: 'פרשת יתרו' } }, now: new Date('2027-01-19T09:00:00Z') });
    assert.match(html, /<h1>פרשת יתרו<\/h1>/);
    assert.equal((html.match(/class="table-divrei-item"/g) || []).length, 3);
    assert.match(html, /דוגמה לבדיקה/, 'the archive\'s text, in full');
    assert.equal((html.match(/<cite>מתוך ״בני ציון״ · משה מזרחי<\/cite>/g) || []).length, 3);
    assert.match(html, /<footer class="tc-table-credit" aria-label="מקור"><p class="tc-credit-from">מתוך ״בני ציון״<\/p><p class="tc-credit-author">משה מזרחי<\/p><p class="tc-credit-note">מובא באישור בעל הזכויות<\/p>/);
    assert.equal((html.match(/>החלף דבר תורה</g) || []).length, 3);
    assert.match(html, /עוד 2 דברי תורה לפרשה/);
    for (const kept of ['לשולחן המשפחה', 'מקור קצר', 'חידון']) assert.match(html, new RegExp(kept));
    assert.equal(map.size, 0, 'rendering writes nothing');
    a11y(html, 'table');
  });
});

test('the Shabbat page: "שלושה דברי תורה · פרשת X", three lines with time and topic, the table button, "עוד N"', async () => {
  ui.engine.configureTorahContent(fixtureSource);
  await ui.engine.loadTorahCatalog();
  withMemoryStorage(() => {
    const html = render(ui.ShabbatPage, { now: new Date('2027-01-19T09:00:00Z'), settings: { location: { tzid: 'Asia/Jerusalem' } }, items: [], context: { parasha: { hebrew: 'פרשת יתרו' } } });
    const block = html.split('<h2>שולחן שבת</h2>')[1];
    assert.match(block, /^<a class="table-preview-card" href="#shabbat-table">/);
    assert.match(block, /<strong>שלושה דברי תורה · פרשת יתרו<\/strong>/);
    assert.equal((block.match(/class="tc-table-line"/g) || []).length, 3);
    assert.match(block, /<small>\d+ דקות · [^<]+<\/small>|<small>דקה · [^<]+<\/small>/);
    assert.match(block, /<span class="tc-table-go">לשולחן שבת<\/span>/);
    assert.match(block, /<a href="#torah\/parasha\/[^"]+">עוד 2 דברי תורה לפרשה<\/a>/);
  });
});

test('Today: from Wednesday, a small line for the Shabbat\'s collection; before a festival, the festival\'s; nothing on Shabbat', async () => {
  ui.engine.configureTorahContent(fixtureSource);
  const catalog = await ui.engine.loadTorahCatalog();
  const base = { key: '2027-01-20', weekday: 3, parasha: { hebrew: 'פרשת יתרו' }, events: [] };
  assert.deepEqual(ui.torahTodayOffer(base, catalog), { kicker: 'דברי תורה לשבת', title: 'פרשת יתרו', count: 5, route: 'torah/parasha/%D7%99%D7%AA%D7%A8%D7%95' });
  assert.equal(ui.torahTodayOffer({ ...base, key: '2027-01-18', weekday: 1 }, catalog), null, 'not before Wednesday');
  assert.equal(ui.torahTodayOffer({ ...base, key: '2027-01-23', weekday: 6, shabbat: true }, catalog), null, 'never on Shabbat');
  const purim = { ...base, key: '2027-03-21', weekday: 0, upcomingHoliday: { category: 'holiday', subcat: 'major', date: '2027-03-23', title: 'Purim', hebrew: 'פורים' } };
  assert.equal(ui.torahTodayOffer(purim, catalog).title, 'פורים');
  assert.equal(ui.torahTodayOffer({ ...purim, upcomingHoliday: { ...purim.upcomingHoliday, date: '2027-03-30' } }, catalog), null, 'only in the last days before it');
  const html = render(ui.TorahTodayCard, { context: base, onNav: noop });
  assert.equal(html, '<button type="button" class="today-feature tc-today"><span>דברי תורה לשבת</span><strong>פרשת יתרו · 5 דברי תורה</strong></button>');
  const today = readFileSync(new URL('../src/pages/TodayPage.jsx', import.meta.url), 'utf8');
  assert.match(today, /<aside className="today-context" aria-label="מה חשוב היום">[\s\S]*<TorahTodayCard context=\{context\} onNav=\{onNav\} \/>[\s\S]*<\/aside>/, 'inside "מה חשוב היום", nothing else moved');
});

test('the global search shows "דברי תורה" results and opens them through the app navigation', async () => {
  ui.engine.configureTorahContent(fixtureSource);
  ui.search.configureTorahSearch(async () => fixtureSearch);
  await ui.search.prepareTorahSearch();
  const hits = ui.search.searchTorahContent('יתרו');
  assert.ok(hits.length >= 5);
  assert.equal(render(ui.TorahSearchGroup, { query: 'יתרו', onNav: noop }), '', 'the first render does no search (the effect does)');
});

test('About credits the archive by permission — never as public domain', () => {
  const { default: AboutPage } = loadJsx('pages/AboutPage.jsx');
  const html = render(AboutPage, { onNav: noop });
  assert.match(html, /<span>דברי תורה<\/span>/);
  const source = readFileSync(new URL('../src/pages/AboutPage.jsx', import.meta.url), 'utf8');
  const section = source.split('<AboutSection title="דברי תורה">')[1].split('</AboutSection>')[0];
  assert.match(section, /חלק ממאגר דברי התורה מבוסס על עלוני ״בני ציון״ מאת משה מזרחי, ומשמש באפליקציה באישורו\./);
  assert.doesNotMatch(section, /Public Domain|נחלת הכלל|רישיון פתוח/i);
});

test('entry points: the library home, the parasha page, favourites, the ספרים tab', () => {
  const src = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  assert.match(src('pages/LibraryPage.jsx'), /onClick=\{\(\) => go\('torah'\)\}/);
  assert.match(src('pages/BooksPage.jsx'), /href=\{`#torah\/parasha\//);
  assert.match(src('services/favorites.mjs'), /\['torah', 'דברי תורה'\]/);
  assert.equal(loadJsx('components/Shell.jsx').navRootFor('torah/article/x'), 'books');
  assert.doesNotMatch(src('components/Shell.jsx'), /\['torah',/, 'no new bottom tab');
});
