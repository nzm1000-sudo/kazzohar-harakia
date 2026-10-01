// The engine against the archive's real generated data (src/data/torahContent, public/torah-content — agent A's
// pipeline output; the pilot now, the full archive later). Counts are never pinned: the data grows. Skipped when the
// build has no archive (the app then runs on its own divrei torah, tested in torahContentEngine.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { packBytesToText } from '../src/services/library/packs.mjs';
import { checksum } from '../src/services/prayer/checksum.mjs';
import { BNEI_ZION, articlesForHoliday, articlesForParasha, buildCatalog, configureTorahContent, groupArticles, loadTorahArticle, loadTorahCatalog, validateIndex, validatePack } from '../src/services/torahContent.mjs';
import { CONTENT_TYPES, SLOT_OF } from '../src/services/torahTaxonomy.mjs';
import { collectionFocus, selectWeeklyTorah } from '../src/services/torahSelection.mjs';
import { configureTorahSearch, prepareTorahSearch, searchTorahContent, _resetTorahSearch } from '../src/services/torahSearch.mjs';
import { searchEntry } from '../src/services/torahContentSource.mjs';

const url = path => new URL(`../${path}`, import.meta.url);
const present = existsSync(url('src/data/torahContent/index.mjs'));
const skip = present ? false : 'no archive in this build';
const load = async () => (await import('../src/data/torahContent/index.mjs')).default;
const manifest = () => (existsSync(url('public/torah-content/packs/manifest.json')) ? JSON.parse(readFileSync(url('public/torah-content/packs/manifest.json'), 'utf8')) : null);
const packBytes = file => new Uint8Array(readFileSync(url(`public/torah-content/packs/${file}`)));
async function searchFields() {
  const entry = searchEntry(manifest());
  if (existsSync(url(`public/torah-content/${entry.file}`))) {
    const text = await packBytesToText(new Uint8Array(readFileSync(url(`public/torah-content/${entry.file}`))));
    if (entry.checksum) assert.equal(checksum(text), entry.checksum, 'the search file matches its checksum');
    return JSON.parse(text);
  }
  return existsSync(url('src/data/torahContent/search.mjs')) ? (await import('../src/data/torahContent/search.mjs')).default : null;
}
async function useArchive() {
  const index = await load();
  configureTorahContent({ loadIndex: async () => index, loadSearch: searchFields, loadPack: async (name, entry) => packBytes(entry.file) });
  return index;
}

test('the archive follows the contract: index, kinds, packs with checksums, paragraphs, credit and permission', { skip }, async () => {
  const index = await load();
  assert.deepEqual(validateIndex(index).problems.filter(problem => !/unknown parasha/.test(problem)), []);
  assert.ok(index.articles.length > 0);
  for (const item of index.articles) assert.ok(CONTENT_TYPES[item.contentType], `${item.id}: a known kind (${item.contentType})`);
  const listed = manifest()?.packs || index.packs;
  for (const [name, entry] of Object.entries(index.packs)) {
    assert.equal(listed[name]?.checksum, entry.checksum, `${name}: index and manifest agree`);
    const text = await packBytesToText(packBytes(entry.file));
    assert.equal(checksum(text), entry.checksum, `${name}: checksum`);
    const pack = JSON.parse(text);
    assert.deepEqual(validatePack(pack, { index }).problems, [], name);
  }
});

test('the archive reads: every collection organised (stories, short, longer), articles open with the credit', { skip }, async () => {
  const index = await useArchive();
  const catalog = await loadTorahCatalog();
  assert.equal(catalog.hasArchive, true);
  for (const name of Object.keys(index.parashot)) {
    const list = articlesForParasha(catalog, name);
    assert.ok(list.length >= Number(index.parashot[name]) && list.length > 0, name);
    const groups = groupArticles(list);
    assert.equal(groups.reduce((sum, group) => sum + group.items.length, 0), list.length, `${name}: every article in one group`);
  }
  const first = index.articles[0];
  const article = await loadTorahArticle(first.id);
  assert.ok(article.paragraphs.length > 0);
  assert.equal(article.source.collection, BNEI_ZION.collection);
  assert.equal(article.rights.permission, 'granted');
  for (const item of index.articles.filter(entry => entry.heading).slice(0, 3)) assert.ok(catalog.byId.get(item.id).heading || item.heading === item.title);
});

test('the week\'s three from real material: three different, a story when the collection has one', { skip }, async () => {
  const index = await useArchive();
  const catalog = buildCatalog(index);
  for (const name of Object.keys(index.parashot)) {
    const focus = collectionFocus('parasha', name, { todayKey: '2027-01-27' });
    const picks = selectWeeklyTorah({ focus, catalog });
    const pool = articlesForParasha(catalog, name);
    assert.equal(new Set(picks.map(item => item.id)).size, Math.min(3, pool.length), name);
    if (pool.some(item => SLOT_OF(item) === 'story') && pool.length > 3) assert.ok(picks.some(item => item.slot === 'story'), `${name}: a story`);
  }
  for (const id of Object.keys(index.holidays)) assert.ok(selectWeeklyTorah({ holiday: id, weekKey: '2027-05-15', catalog }).length > 0, id);
});

test('search over the archive: either name of a combined issue (נשא / שבועות) finds its articles', { skip }, async () => {
  const index = await useArchive();
  _resetTorahSearch();
  configureTorahSearch(searchFields);
  await prepareTorahSearch();
  const catalog = buildCatalog(index);
  const combined = index.articles.filter(item => item.parashot.includes('נשא') && item.holidays.includes('shavuot'));
  const ids = query => new Set(searchTorahContent(query, { limit: 1000 }).map(hit => hit.id));
  if (index.parashot['נשא']) {
    const naso = ids('נשא');
    assert.ok(articlesForParasha(catalog, 'נשא').every(item => naso.has(item.id)), 'every article of נשא by "נשא"');
    assert.ok(ids('פרשת נשא').size > 0);
  }
  if (index.holidays.shavuot) {
    const shavuot = ids('שבועות');
    assert.ok(articlesForHoliday(catalog, 'shavuot').every(item => shavuot.has(item.id)), 'every article of שבועות by "שבועות"');
  }
  for (const item of combined) for (const query of ['נשא', 'שבועות']) assert.ok(ids(query).has(item.id), `${item.id} by ${query}`);
  if (index.parashot['יתרו']) assert.ok(ids('יתרו').size >= Number(index.parashot['יתרו']));
});

test('final data: counts at the top level match the lists built from the entries; Elul is a festival collection; headings kept', { skip }, async () => {
  const index = await load();
  const catalog = buildCatalog(index);
  // (וזאת הברכה also gathers all of שמחת תורה, so its own tag count is compared against the tag alone.)
  for (const [name, count] of Object.entries(index.parashot)) if (typeof count === 'number') assert.equal(name === 'וזאת הברכה' ? (catalog.byParasha.get(name) || []).length : articlesForParasha(catalog, name).filter(item => item.collection === 'bnei-zion').length, count, name);
  for (const [id, count] of Object.entries(index.holidays)) if (typeof count === 'number') assert.equal(articlesForHoliday(catalog, id).filter(item => item.collection === 'bnei-zion').length, count, id);
  const { holidayLabel } = await import('../src/services/torahTaxonomy.mjs');
  if (index.holidays.elul) assert.equal(holidayLabel('elul'), 'אלול');
  const withHeading = index.articles.filter(item => item.heading && item.heading !== item.title);
  assert.ok(withHeading.every(item => catalog.byId.get(item.id).heading === item.heading.trim()));
  assert.ok(index.articles.every(item => !item.length || ['short', 'medium', 'long'].includes(item.length)));
});

test('final data: the search file is found where the manifest names it, with no search module needed', { skip }, async () => {
  const entry = searchEntry(manifest());
  assert.ok(existsSync(url(`public/torah-content/${entry.file}`)), entry.file);
  assert.ok(entry.checksum, 'verified by its checksum');
  const fields = await searchFields();
  assert.ok(fields.docs.length >= (await load()).articles.length * 0.95);
});

test('search timing on the full archive (first load, then per query)', { skip }, async t => {
  await useArchive();
  _resetTorahSearch();
  configureTorahSearch(searchFields);
  const start = performance.now();
  await prepareTorahSearch();
  const first = performance.now() - start;
  const queries = ['כיבוד הורים', 'נשא', 'שבועות', 'יתרו', 'אמונה', 'שבת', 'חנוכה', 'ויאמר משה'];
  const q0 = performance.now();
  for (const query of queries) { _lastReset(); searchTorahContent(query, { limit: 30 }); }
  const fresh = (performance.now() - q0) / queries.length;
  const phrase = 'כיבוד הורים';
  const q1 = performance.now();
  for (let end = 2; end <= phrase.length; end += 1) searchTorahContent(phrase.slice(0, end), { limit: 30 });
  const typed = (performance.now() - q1) / (phrase.length - 1);
  t.diagnostic(`first load ${first.toFixed(0)} ms · fresh query ${fresh.toFixed(1)} ms · while typing ${typed.toFixed(1)} ms/letter`);
  assert.ok(fresh < 150, `fresh query ${fresh.toFixed(1)} ms`);
  assert.ok(searchTorahContent('כיבוד הורים', { limit: 30 }).length > 0);
});
// A fresh query (not narrowing the previous one): search something unrelated first.
function _lastReset() { searchTorahContent('zz'); }

test('וזאת הברכה shows its own pieces together with all of שמחת תורה (owner, 2026-10-01)', async t => {
  const engine = await import('../src/services/torahContent.mjs');
  const { existsSync } = await import('node:fs');
  if (!existsSync(new URL('../src/data/torahContent/index.mjs', import.meta.url))) { t.skip('no archive'); return; }
  const index = (await import('../src/data/torahContent/index.mjs')).default;
  const catalog = engine.buildCatalog ? engine.buildCatalog(index) : null;
  if (!catalog) { t.skip('no catalog builder exported'); return; }
  const vezot = engine.articlesForParasha(catalog, 'וזאת הברכה').map(a => a.id);
  const simchat = engine.articlesForHoliday(catalog, 'simchat-torah').map(a => a.id);
  assert.ok(simchat.length > 0);
  for (const id of simchat) assert.ok(vezot.includes(id), id);
  assert.equal(engine.parashaCounts(catalog)['וזאת הברכה'], vezot.length);
});
