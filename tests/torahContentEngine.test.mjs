// The Torah content engine ("בני ציון", docs/bnei-zion/SCHEMA.md) against the hand-made fixture
// (tests/fixtures/torahContentSample — placeholder text marked "דוגמה לבדיקה"): the data contract, the calendar,
// the weekly selection, and the search.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import fixtureIndex from './fixtures/torahContentSample/index.mjs';
import fixtureSearch from './fixtures/torahContentSample/search.mjs';
import { memoryStorage } from './helpers/memoryStorage.mjs';
import {
  BNEI_ZION, articleMetaLine, articleNeighbours, articlesForHoliday, articlesForParasha, buildCatalog, configureTorahContent, currentTorahCatalog,
  filterArticles, loadTorahArticle, loadTorahCatalog, parashaCounts, parseTorahRoute, sortArticles, torahRoute, validateIndex, validatePack,
} from '../src/services/torahContent.mjs';
import { canonicalParasha, parashotOfReading, PARASHOT, holidayIdsFor, specialShabbatIdFor } from '../src/services/torahTaxonomy.mjs';
import { collectionFocus, replaceWeeklyPick, selectWeeklyTorah, torahWeekFocus, weeklyTorah } from '../src/services/torahSelection.mjs';
import { configureTorahSearch, prepareTorahSearch, searchTorahContent, torahSearchStats, _resetTorahSearch } from '../src/services/torahSearch.mjs';
import { markTorahRead, readTorahIds } from '../src/services/torahReadHistory.mjs';
import { checksum } from '../src/services/prayer/checksum.mjs';
import { packBytesToText } from '../src/services/library/packs.mjs';

const packFile = file => new Uint8Array(readFileSync(new URL(`./fixtures/torahContentSample/packs/${file}`, import.meta.url)));
const fixtureSource = { loadIndex: async () => fixtureIndex, loadSearch: async () => fixtureSearch, loadPack: async (name, entry) => packFile(entry.file) };
const useFixture = () => configureTorahContent(fixtureSource);
const useEmpty = () => configureTorahContent({ loadIndex: async () => null, loadSearch: async () => null, loadPack: async () => { throw new Error('none'); } });
const fixtureCatalog = () => buildCatalog(fixtureIndex);

// ---- the data contract ----
test('the fixture follows the data contract: index, packs (gzip and plain, checksummed), credit and rights', async () => {
  assert.deepEqual(validateIndex(fixtureIndex).problems, []);
  for (const [name, entry] of Object.entries(fixtureIndex.packs)) {
    const text = await packBytesToText(packFile(entry.file));
    assert.equal(checksum(text), entry.checksum, `${name}: checksum`);
    const pack = JSON.parse(text);
    assert.deepEqual(validatePack(pack, { index: fixtureIndex }).problems, [], name);
    for (const body of Object.values(pack.articles)) assert.match(body.paragraphs.join(' '), /דוגמה לבדיקה/, 'fixture text is marked as a placeholder');
  }
  assert.ok(fixtureIndex.packs.moadim.file.endsWith('.gz'), 'one pack in the shipping format');
});

test('the contract helpers catch what would break the app', () => {
  assert.equal(validateIndex(null).ok, false);
  assert.equal(validateIndex({ articles: [{ id: 'a', title: 'x', pack: 'p', readMinutes: 2 }, { id: 'a', title: 'y', pack: 'p', readMinutes: 2 }] }).ok, false, 'duplicate ids');
  assert.equal(validateIndex({ articles: [{ id: 'a', title: '', pack: 'p', readMinutes: 2 }] }).ok, false, 'no title');
  assert.equal(validatePack({ articles: { a: { paragraphs: ['טקסט'], source: { collection: 'אחר', author: 'x' }, rights: { permission: 'granted', creditRequired: true } } } }).ok, false, 'wrong source');
  assert.equal(validatePack({ articles: { a: { paragraphs: ['טקסט'], source: { collection: 'בני ציון', author: 'משה מזרחי' }, rights: { permission: 'public-domain' } } } }).ok, false, 'rights must be the permission, never public domain');
});

test('parasha names: every spelling and Hebcal form reaches the canonical name; combined readings split', () => {
  assert.equal(PARASHOT.length, 54);
  for (const [variant, canonical] of [['תצוה', 'תצווה'], ['פרשת קרח', 'קורח'], ['חקת', 'חוקת'], ['פנחס', 'פינחס'], ['נצבים', 'ניצבים'], ['בחקתי', 'בחוקותי'], ['Yitro', 'יתרו'], ['Parashat Lech-Lecha', 'לך לך'], ["Sh'lach", 'שלח']]) assert.equal(canonicalParasha(variant), canonical, variant);
  assert.deepEqual(parashotOfReading('פרשת תזריע-מצורע'), ['תזריע', 'מצורע']);
  assert.deepEqual(parashotOfReading('Parashat Achrei Mot-Kedoshim'), ['אחרי מות', 'קדושים']);
  assert.deepEqual(parashotOfReading('ויקהל־פקודי'), ['ויקהל', 'פקודי']);
});

// ---- the catalog: archive and fallback ----
test('an empty or missing database falls back to the app\'s own divrei torah — never an empty screen', async () => {
  useEmpty();
  const catalog = await loadTorahCatalog();
  assert.equal(catalog.hasArchive, false);
  assert.equal(catalog.loaded, true);
  const counts = parashaCounts(catalog);
  assert.ok(PARASHOT.every(name => counts[name] === 3), 'three for each of the 54 parashot');
  assert.equal(articlesForHoliday(catalog, 'purim').length, 3);
  const article = await loadTorahArticle(articlesForParasha(catalog, 'יתרו')[0].id);
  assert.ok(article.paragraphs[0].length > 80);
  assert.equal(article.collection, 'app');
  // Before anything has loaded, the same fallback is there synchronously (a first render has three to show).
  configureTorahContent(fixtureSource);
  assert.equal(currentTorahCatalog().hasArchive, false);
  assert.equal(articlesForParasha(currentTorahCatalog(), 'בראשית').length, 3);
});

test('the archive replaces the fallback where it has material, and only there', () => {
  const catalog = fixtureCatalog();
  assert.equal(catalog.hasArchive, true);
  assert.ok(articlesForParasha(catalog, 'בראשית').every(item => item.collection === 'bnei-zion'));
  assert.equal(articlesForParasha(catalog, 'בראשית').length, 6);
  assert.ok(articlesForParasha(catalog, 'נח').every(item => item.collection === 'app'), 'נח has no archive material: the app\'s own three');
  assert.equal(articlesForParasha(catalog, 'נח').length, 3);
});

test('bodies load per pack on demand, checksum-verified, gzip or plain', async () => {
  useFixture();
  const article = await loadTorahArticle('bz-purim-02');
  assert.equal(article.title, 'משלוח מנות של אהבה');
  assert.equal(article.paragraphs.length, 3);
  assert.equal(article.source.collection, BNEI_ZION.collection);
  assert.equal(article.rights.permission, 'granted');
  const plain = await loadTorahArticle('bz-yitro-02');
  assert.equal(plain.paragraphs.length, 5);
  // A pack that does not match its checksum is refused.
  configureTorahContent({ ...fixtureSource, loadPack: async () => new TextEncoder().encode('{"articles":{}}') });
  await assert.rejects(loadTorahArticle('bz-yitro-02'), /חתימה/);
});

// ---- the calendar (the app's context in, the right collection out) ----
const parashaItem = (date, hebrew) => ({ category: 'parashat', date, hebrew, title: hebrew });
test('calendar: the parasha of the week brings its own divrei torah', () => {
  const catalog = fixtureCatalog();
  const focus = torahWeekFocus({ items: [parashaItem('2027-01-23', 'פרשת יתרו')], todayKey: '2027-01-20', parashaName: 'פרשת יתרו', catalog });
  assert.equal(focus.kind, 'parasha');
  assert.equal(focus.name, 'פרשת יתרו');
  assert.equal(focus.shabbatKey, '2027-01-23');
  assert.equal(focus.route, torahRoute.parasha('יתרו'));
  assert.ok(selectWeeklyTorah({ focus, catalog }).every(item => item.parashot.includes('יתרו')));
});

test('calendar: a festival during the week brings the festival\'s divrei torah', () => {
  const catalog = fixtureCatalog();
  const items = [{ category: 'holiday', subcat: 'major', date: '2027-03-23', title: 'Purim', hebrew: 'פורים' }];
  const focus = torahWeekFocus({ items, todayKey: '2027-03-21', parashaName: 'צו', catalog });
  assert.equal(focus.kind, 'holiday');
  assert.equal(focus.id, 'purim');
  assert.ok(selectWeeklyTorah({ focus, catalog }).every(item => item.holidays.includes('purim')));
  assert.equal(torahWeekFocus({ items, todayKey: '2027-03-28', parashaName: 'שמיני', catalog }).kind, 'parasha', 'a past festival does not linger');
});

test('calendar: a special Shabbat does not erase the parasha', () => {
  const catalog = fixtureCatalog();
  const items = [{ category: 'holiday', subcat: 'shabbat', date: '2027-03-20', title: 'Shabbat Zachor', hebrew: 'שבת זכור' }];
  assert.equal(specialShabbatIdFor(items[0]), 'shabbat-zachor');
  assert.deepEqual(holidayIdsFor(items[0]), [], 'a special Shabbat is not a festival');
  const focus = torahWeekFocus({ items, todayKey: '2027-03-17', parashaName: 'ויקרא', catalog: buildCatalog({ ...fixtureIndex, articles: fixtureIndex.articles.map(item => (item.id === 'bz-tetzave-01' ? { ...item, parashot: ['ויקרא'] } : item)) }) });
  assert.equal(focus.kind, 'parasha');
  assert.equal(focus.specialShabbat, 'shabbat-zachor');
  assert.deepEqual(focus.parashot, ['ויקרא']);
  const yitroWeek = torahWeekFocus({ items: [{ ...items[0], date: '2027-01-23' }], todayKey: '2027-01-20', parashaName: 'יתרו', catalog });
  const picks = selectWeeklyTorah({ focus: yitroWeek, catalog });
  assert.equal(picks.length, 3);
  assert.equal(picks[0].id, 'bz-tetzave-01', 'the special Shabbat brings one of its own');
  assert.ok(picks.slice(1).every(item => item.parashot.includes('יתרו')), 'and the parasha keeps the other two');
});

test('calendar: a combined reading finds both halves; an article on both appears once and under each', () => {
  const catalog = fixtureCatalog();
  const both = articlesForParasha(catalog, ['תזריע', 'מצורע']).map(item => item.id);
  assert.deepEqual([...both].sort(), ['bz-metzora-01', 'bz-tazria-01', 'bz-tazria-metzora-01']);
  assert.ok(articlesForParasha(catalog, 'תזריע').some(item => item.id === 'bz-tazria-metzora-01'));
  assert.ok(articlesForParasha(catalog, 'מצורע').some(item => item.id === 'bz-tazria-metzora-01'));
  const focus = torahWeekFocus({ todayKey: '2027-04-14', parashaName: 'פרשת תזריע-מצורע', catalog });
  assert.equal(focus.name, 'פרשת תזריע־מצורע');
  assert.equal(new Set(selectWeeklyTorah({ focus, catalog }).map(item => item.id)).size, 3);
});

test('calendar: a festival on Shabbat takes priority and keeps the parasha and the special Shabbat with it', () => {
  const catalog = fixtureCatalog();
  const items = [{ category: 'holiday', subcat: 'major', date: '2027-04-24', title: 'Pesach VII', hebrew: 'פסח ז׳' }, { category: 'holiday', subcat: 'shabbat', date: '2027-04-24', title: 'Shabbat HaGadol', hebrew: 'שבת הגדול' }];
  const focus = torahWeekFocus({ items, todayKey: '2027-04-20', parashaName: 'אחרי מות', catalog });
  assert.equal(focus.kind, 'holiday');
  assert.equal(focus.id, 'pesach', 'שביעי של פסח has no material of its own: פסח');
  assert.deepEqual(focus.parashot, ['אחרי מות']);
  assert.equal(focus.specialShabbat, 'shabbat-hagadol');
});

// ---- the weekly selection ----
const week = (overrides = {}) => ({ ...collectionFocus('parasha', 'בראשית', { todayKey: '2026-10-07' }), ...overrides });
test('selection: the same week gives the same three; three different ones; a short, a deep and a story', () => {
  const catalog = fixtureCatalog();
  const a = selectWeeklyTorah({ focus: week(), catalog });
  const b = selectWeeklyTorah({ focus: week(), catalog });
  assert.deepEqual(a.map(item => item.id), b.map(item => item.id));
  assert.equal(new Set(a.map(item => item.id)).size, 3);
  assert.deepEqual(a.map(item => item.slot), ['short', 'deep', 'story']);
  // The spec's own signature works too.
  const c = selectWeeklyTorah({ parasha: 'בראשית', weekKey: week().weekKey, jewishYear: week().jewishYear, catalog });
  assert.deepEqual(c.map(item => item.id), a.map(item => item.id));
});

test('selection: another year may bring other picks', () => {
  const catalog = fixtureCatalog();
  const seen = new Set();
  for (let year = 2026; year < 2034; year += 1) {
    const focus = collectionFocus('parasha', 'בראשית', { todayKey: `${year}-10-14` });
    seen.add(selectWeeklyTorah({ focus, catalog }).map(item => item.id).join('|'));
  }
  assert.ok(seen.size > 1, 'the years do not all repeat one selection');
});

test('selection: what was read on this device is chosen less', () => {
  const catalog = fixtureCatalog();
  const first = selectWeeklyTorah({ focus: week(), catalog });
  const after = selectWeeklyTorah({ focus: week(), catalog, readHistory: first.map(item => item.id) });
  assert.equal(after.filter(item => first.some(pick => pick.id === item.id)).length, 0, 'six in the pool: three unread replace the three read');
});

test('selection: with an empty database the old three are the week\'s three', () => {
  const catalog = buildCatalog(null);
  const focus = torahWeekFocus({ todayKey: '2026-10-05', parashaName: 'בראשית', catalog });
  const picks = selectWeeklyTorah({ focus, catalog });
  assert.equal(picks.length, 3);
  assert.ok(picks.every(item => item.collection === 'app'));
});

test('selection: the week\'s three stay (reading one does not reshuffle), and a replaced one never returns that week', () => {
  const store = memoryStorage();
  const catalog = { ...fixtureCatalog(), loaded: true };
  const focus = week();
  const first = weeklyTorah(focus, { catalog, store, persist: true });
  assert.equal(first.total, 6);
  assert.equal(first.more, 3);
  const again = weeklyTorah(focus, { catalog, store, readHistory: [first.picks[0].id] });
  assert.deepEqual(again.picks.map(item => item.id), first.picks.map(item => item.id));
  const replaced = replaceWeeklyPick(focus, 1, { catalog, store });
  assert.notEqual(replaced.picks[1].id, first.picks[1].id);
  assert.equal(replaced.picks[0].id, first.picks[0].id, 'only one changes');
  assert.equal(replaced.picks[2].id, first.picks[2].id);
  const persisted = weeklyTorah(focus, { catalog, store });
  assert.deepEqual(persisted.picks.map(item => item.id), replaced.picks.map(item => item.id), 'the change holds for the week');
  let current = persisted;
  const shown = new Set([...first.picks, ...replaced.picks].map(item => item.id));
  for (let i = 0; i < 4; i += 1) { current = replaceWeeklyPick(focus, 1, { catalog, store }); shown.add(current.picks[1].id); }
  assert.ok(!current.picks.slice(0, 1).some(item => item.id === first.picks[1].id));
  assert.ok(!current.picks.some(item => current.replaced.includes(item.id)), 'no replaced pick comes back');
  // A new week starts afresh.
  const next = weeklyTorah({ ...focus, weekKey: '2026-10-17' }, { catalog, store });
  assert.equal(next.replaced.length, 0);
});

test('the read list is the device\'s own, bounded, newest first', () => {
  const store = memoryStorage();
  markTorahRead('a', { store }); markTorahRead('b', { store }); markTorahRead('a', { store });
  assert.deepEqual(readTorahIds(store), ['a', 'b']);
});

// ---- queries, routes, presentation ----
test('filters, sorts, neighbours and the reader\'s quiet line', () => {
  const catalog = fixtureCatalog();
  const all = articlesForParasha(catalog, 'יתרו');
  assert.equal(filterArticles(all, { contentType: 'dvar-torah' }).length, 2);
  assert.equal(filterArticles(all, { topic: 'משפחה' }).length, 2);
  assert.ok(filterArticles(all, { readTime: 'short' }).every(item => item.readMinutes <= 3));
  assert.deepEqual(sortArticles(all, 'short').map(item => item.readMinutes), [...all.map(item => item.readMinutes)].sort((a, b) => a - b));
  const { previous, next } = articleNeighbours(catalog, 'bz-yitro-02');
  assert.equal(previous.id, 'bz-yitro-01');
  assert.equal(next.id, 'bz-yitro-03');
  assert.equal(articleMetaLine(catalog.byId.get('bz-yitro-02')), 'פרשת יתרו · 6 דקות');
  assert.deepEqual(parseTorahRoute(torahRoute.parasha('לך לך')), { view: 'parasha', id: 'לך לך' });
  assert.deepEqual(parseTorahRoute(torahRoute.article('bz-yitro-02')), { view: 'article', id: 'bz-yitro-02' });
  assert.deepEqual(parseTorahRoute('torah'), { view: 'home' });
});

// ---- search ----
test('search: by parasha, festival, title, topic, inside the text, with Hebrew normalisation', async () => {
  useFixture();
  _resetTorahSearch();
  configureTorahSearch(async () => fixtureSearch);
  assert.equal(searchTorahContent('יתרו'), null, 'nothing before the fields are loaded (no work on a keystroke)');
  await prepareTorahSearch();
  const ids = query => searchTorahContent(query).map(hit => hit.id);
  assert.ok(ids('יתרו').includes('bz-yitro-03'), 'by parasha');
  assert.ok(ids('פרשת לך לך').includes('bz-lechlecha-02'), 'by parasha with its word');
  assert.ok(ids('פורים').includes('bz-purim-01'), 'by festival');
  assert.equal(ids('משלוח מנות')[0], 'bz-purim-02', 'by title, first');
  assert.ok(ids('שמירת הלשון').includes('bz-metzora-01'), 'by topic');
  assert.ok(ids('מנוחה וקדושה').includes('bz-bereshit-02'), 'inside the text');
  assert.ok(ids('תצוה').includes('bz-tetzave-01'), 'a parasha spelled חסר still finds it');
  assert.ok(ids('הָאֱמוּנָה'.replace('הָ', '')).length > 0, 'nikud is ignored');
  assert.ok(ids('בני ציון').length >= 20, 'by source');
  assert.deepEqual(ids('zzzz'), []);
});

test('search: typing narrows the previous hits instead of scanning everything again; well within a keystroke', async () => {
  useFixture();
  _resetTorahSearch();
  configureTorahSearch(async () => fixtureSearch);
  await prepareTorahSearch();
  const phrase = 'שמירת הלשון';
  searchTorahContent(phrase.slice(0, 2));
  const before = torahSearchStats().scanned;
  for (let end = 3; end <= phrase.length; end += 1) searchTorahContent(phrase.slice(0, end));
  const scanned = torahSearchStats().scanned - before;
  assert.ok(scanned < (phrase.length - 2) * 23, `narrowing scans fewer records (${scanned})`);
  const start = performance.now();
  for (let i = 0; i < 200; i += 1) searchTorahContent(i % 2 ? 'אמונה' : 'שבת');
  assert.ok((performance.now() - start) / 200 < 5, 'a query takes well under a frame');
});

test('search architecture: lazy, off the render path, in the global search and the library', () => {
  const src = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  const group = src('components/torah/TorahSearchGroup.jsx');
  assert.match(group, /useEffect\(/);
  assert.match(group, /prepareTorahSearch\(\)/);
  assert.doesNotMatch(group.split('useEffect(')[0], /searchTorahContent\(/, 'no search in the render');
  assert.match(src('pages/LearningSearch.jsx'), /divrei=\{<TorahSearchGroup query=\{text\} onNav=\{onNav\}\/>\}/);
  assert.match(group, /onNav\(torahRoute\.article\(hit\.id\)\)/, 'opened through the app navigation: Back returns to the results');
  const page = src('pages/TorahContentPage.jsx');
  assert.match(page, /useSearchState\('torah-query'\)/, 'the library search keeps its results for Back (searchReturn)');
  assert.match(page, /<ClearableInput id="tc-search-field"[^\n]*? deferred \/>/, 'the field is deferred: the letter appears at once');
  assert.match(page, /data-kz-results/);
  const engine = src('services/torahContentSource.mjs');
  assert.match(engine, /import\.meta\.glob\('\.\.\/data\/torahContent\/index\.mjs'\)/, 'the index is its own lazy chunk');
  assert.doesNotMatch(src('NewApp.jsx'), /import .*data\/torahContent/, 'nothing of the archive on the launch path');
});
