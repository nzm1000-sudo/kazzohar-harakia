// Torah Engine · full-text search: the permanent benchmark (every expectation a real unit re-read here), multi-word in any
// order, Hebrew variants, false positives, rights, offline and speed. Nothing here is answered by query-specific code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORKS, workById } from '../src/data/library/registry.mjs';
import { configureIndexLoader } from '../src/services/torah/searchIndex.mjs';
import { queryVariants, searchTorah, diversify } from '../src/services/torah/search.mjs';
import { SEARCHABLE_RIGHTS } from '../src/services/torah/inventory.mjs';
import { getSegment } from '../src/services/torah/engine.mjs';
import { normalizeText, normalizeWord, skeleton, tokenize } from '../src/services/torah/hebrew.mjs';
import { YALKUT_YOSEF } from '../src/data/yalkutYosef.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../src/data/practicalHalachaQa.mjs';
import { answerText } from '../src/services/torah/documents.mjs';
import { diskFetch } from './helpers/diskAssets.mjs';
import { GOLDEN } from './fixtures/torahGoldenSearch.mjs';
import { WORD_FAMILIES } from '../src/data/torah/topics.mjs';

// Offline by construction: every request is served from public/ on disk, and any network request fails the test.
const remote = [];
globalThis.fetch = url => (/^https?:/.test(String(url)) ? (remote.push(String(url)), Promise.reject(new TypeError('offline'))) : diskFetch(url));
configureIndexLoader({ load: async file => new Uint8Array(readFileSync(new URL(`../public/torah-index/${file}`, import.meta.url))) });

const idOf = hit => (hit.answer ? `answer:${hit.target.route.split('/').pop()}` : hit.target?.source ? `yy:${hit.target.source.reference.replace('Yalkut Yosef ', '')}` : `${hit.workId}:${hit.place.node}.${hit.place.unit}`);
const expectedId = g => (g.answer ? `answer:${g.answer}` : g.section ? `yy:${g.section}` : `${g.source}:${g.ref}`);
async function textOf(g) {
  if (g.answer) return answerText(PRACTICAL_HALACHA_QA_INDEX[g.answer]);
  if (g.section) return YALKUT_YOSEF.sections.find(section => section.id === g.section).text;
  const [section, segment] = g.ref.split('.').map(Number);
  const found = await getSegment({ workId: g.source, section, segment });
  return [found.unit.title, found.unit.dh, found.unit.text].filter(Boolean).join(' ');
}
// Each query word, or its bare form without a prefix, appears in the unit (plene/defective spelling allowed).
function carries(text, query) {
  const words = new Set(tokenize(text).flatMap(word => [word, skeleton(word)]));
  const joined = normalizeText(text);
  return tokenize(query).filter(word => word.length > 2 || !['על'].includes(word)).every(word => {
    const bare = word.replace(/^(?:ו|ה|ב|ל)(?=...)/, '');
    const family = WORD_FAMILIES.find(item => item.words.map(normalizeWord).includes(word))?.words.map(normalizeWord) || [];
    if (family.some(form => words.has(form) || joined.includes(form))) return true;
    return words.has(word) || words.has(bare) || words.has(skeleton(bare)) || joined.includes(bare) || skeleton(joined.replace(/ /g, '')).includes(skeleton(bare));
  });
}

test('golden benchmark: each query finds its verified source within its bound, and that source carries the words', { timeout: 300000 }, async () => {
  for (const g of GOLDEN) {
    const result = await searchTorah(g.query, { limit: 30 });
    const rank = result.results.findIndex(hit => idOf(hit) === expectedId(g)) + 1;
    assert.ok(rank >= 1 && rank <= g.within, `${g.query}: ${expectedId(g)} at ${rank || 'absent'} (bound ${g.within}) — ${g.why}`);
    assert.ok(carries(await textOf(g), g.query), `${g.query}: ${expectedId(g)} does not carry the words`);
    for (const hit of result.results) {
      assert.ok(hit.target && (hit.target.route || hit.target.source), `${g.query}: a result without a navigation target`);
      assert.ok(!/^books\/?$/.test(hit.target.route || ''), 'no result opens the library home');
      assert.ok(SEARCHABLE_RIGHTS.has(hit.rights), `${hit.workId}: ${hit.rights}`);
      assert.ok(hit.snippet.text.length > 0);
    }
  }
});

test('"חלב ודגים": real sources in any word order — the same core found for every phrasing', { timeout: 120000 }, async () => {
  const core = ['Ben_Ish_Hai:1866.1', 'yy:yalkut-yosef-41-10-2', 'answer:hal-bayit-fish-with-dairy'];
  for (const query of ['חלב ודגים', 'דגים וחלב', 'דגים בחלב', 'חלב עם דגים', 'דגים חלב']) {
    const result = await searchTorah(query, { limit: 20 });
    const ids = result.results.map(idOf);
    for (const id of core) assert.ok(ids.includes(id), `${query}: ${id}`);
    assert.equal(result.partial, false);
    assert.ok(result.total >= (tokenize(query).length > 2 ? 30 : 100), `${query}: ${result.total}`);
  }
  // The snippet is the source's own words with both words marked.
  const top = (await searchTorah('חלב ודגים', { limit: 5 })).results;
  const bih = (await searchTorah('דגים בחלב', { limit: 10 })).results.find(hit => idOf(hit) === 'Ben_Ish_Hai:1866.1');
  assert.ok(bih.snippet.text.startsWith('דגים בחלב מותר'));
  assert.deepEqual(bih.snippet.highlights.slice(0, 2).map(([s, e]) => bih.snippet.text.slice(s, e)), ['דגים', 'בחלב']);
  assert.ok(top.every(hit => hit.snippet.highlights.length >= 2));
  // Its navigation target is the exact halacha of the book.
  assert.deepEqual(bih.target, { route: 'books/r/Ben_Ish_Hai/1866/1' });
});

test('a canonical reference outranks keywords and is resolved in the same call', async () => {
  const result = await searchTorah('בראשית א:א');
  assert.equal(result.reference.target.route, 'books/r/Genesis/1/1');
  assert.equal((await searchTorah('ברכות ב ע"א')).reference.target.route, 'talmud/Berakhot/2a');
  assert.equal((await searchTorah('שו"ע או"ח שיח א')).reference.target.route, 'books/r/Shulchan_Arukh__Orach_Chayim/318/1');
  assert.equal((await searchTorah('משנה ברכות א:א')).reference.target.route, 'books/r/Mishnah_Berakhot/1/1');
});

test('Hebrew variants give the same results: nikud, quotes, spaces, punctuation, maqaf', { timeout: 120000 }, async () => {
  const ids = async query => (await searchTorah(query, { limit: 10 })).results.map(idOf).join();
  const base = await ids('נר חנוכה');
  for (const query of ['נֵר חֲנוּכָּה', '  נר   חנוכה  ', 'נר, חנוכה!', 'נר־חנוכה', 'נר-חנוכה']) assert.equal(await ids(query), base, query);
  assert.equal(await ids('רמב"ם'), await ids('רמב״ם'));
  assert.equal(await ids('שו"ע'), await ids('שו״ע'));
});

test('abbreviations expand only where the query supports them', () => {
  assert.ok(queryVariants('שו"ע או"ח').some(variant => variant.tokens.join(' ') === 'שולחנ ערוכ אורח חיימ'));
  assert.ok(queryVariants('לשון הרע').some(variant => variant.tokens.join(' ') === normalizeWord('לה"ר')), 'a written-out phrase also searches its abbreviation');
  assert.equal(queryVariants('מ"ב').length, 1, 'מ"ב alone is also a number: not expanded');
  assert.ok(queryVariants('מ"ב סימן').length > 1, 'with context it is משנה ברורה');
});

test('false positives: prefixes are not over-stripped, stop words do not match alone, partial matches are marked', { timeout: 120000 }, async () => {
  // ברכה must not be read as ב + רכה: the results carry ברכה (or a form of it), never "רכה" alone.
  const bracha = await searchTorah('ברכה', { limit: 20 });
  for (const hit of bracha.results) assert.ok(!hit.snippet.highlights.every(([s, e]) => normalizeWord(hit.snippet.text.slice(s, e)) === 'רכה'), idOf(hit));
  const stop = await searchTorah('של');
  assert.equal(stop.results.length, 0);
  assert.equal(stop.onlyStopWords, true);
  // No unit holds a made-up word: nothing, with a plain notice (and the real word offered alone).
  const none = await searchTorah('דגים קוואנטיים');
  assert.equal(none.results.length === 0 || none.partial, true);
  if (none.results.length) assert.ok(none.results.every(hit => hit.partial));
  const nothing = await searchTorah('זזזזזזז קקקקקקק');
  assert.equal(nothing.total, 0);
  assert.deepEqual(nothing.suggestions, []);
});

test('commentary results point to the verse / seif / segment their comment explains — never another', { timeout: 120000 }, async () => {
  const result = await searchTorah('לשון הרע', { limit: 40 });
  let checked = 0;
  for (const hit of result.results) {
    const work = workById(hit.workId);
    if (!work?.relation || work.kind !== 'pack') continue;
    const unit = (await getSegment({ workId: hit.workId, section: hit.place.node, segment: hit.place.unit })).unit;
    if (!unit.v) continue;
    const route = hit.target.route;
    if (route.startsWith('talmud/')) assert.equal(Number(route.split('/')[3]), unit.v, route);
    else assert.equal(Number(route.split('/')[4]), unit.v, route);
    checked += 1;
  }
  assert.ok(checked >= 5);
});

test('rights: nothing outside the gate is ever a result', { timeout: 120000 }, async () => {
  const blocked = new Set(WORKS.filter(work => !SEARCHABLE_RIGHTS.has(work.license === 'unknown' ? 'UNKNOWN' : 'OPEN')).map(work => work.workId));
  for (const query of ['תשובה', 'אמונה', 'ספר']) for (const hit of (await searchTorah(query, { limit: 40 })).results) assert.ok(!blocked.has(hit.workId), hit.workId);
});

test('filters and in-book search use the same engine', { timeout: 120000 }, async () => {
  const talmud = await searchTorah('חלב ודגים', { family: 'talmud', limit: 20 });
  assert.ok(talmud.results.length > 0 && talmud.results.every(hit => hit.family === 'talmud'));
  const inBook = await searchTorah('נר חנוכה', { workIds: ['Mishnah_Berurah'], limit: 20 });
  assert.ok(inBook.results.length > 0 && inBook.results.every(hit => hit.workId === 'Mishnah_Berurah'));
  assert.equal(inBook.reference, null);
  const more = await searchTorah('נר חנוכה', { workIds: ['Mishnah_Berurah'], offset: 20, limit: 20 });
  assert.equal(new Set([...inBook.results, ...more.results].map(idOf)).size, inBook.results.length + more.results.length, 'pages never repeat a result');
});

test('diversity: after relevance no one series fills the first page; the strongest stays first', () => {
  const results = [...Array(8)].map((_, i) => ({ workId: `A${i}`, series: 'a' })).concat([{ workId: 'B', series: 'b' }, { workId: 'C', series: 'c' }]);
  const ordered = diversify(results);
  assert.equal(ordered[0].workId, 'A0');
  assert.deepEqual(ordered.slice(0, 5).map(item => item.series), ['a', 'a', 'a', 'b', 'c']);
  assert.equal(ordered.length, results.length, 'nothing is hidden');
});

test('edge cases: empty, one letter, very long query, digits', { timeout: 120000 }, async () => {
  assert.equal((await searchTorah('')).results.length, 0);
  assert.equal((await searchTorah('א')).results.length, 0);
  const long = await searchTorah('אמר רבי יוחנן משום רבי שמעון בן יוחאי מנין שאין מתפללין אלא מתוך שמחה של מצוה והלכה כמותו בכל מקום ובכל זמן');
  assert.ok(long.ms < 5000);
  assert.ok(Array.isArray(long.results));
  const mixed = await searchTorah('סימן 318');
  assert.ok(Array.isArray(mixed.results));
});

test('offline and fast: no request leaves the device, and a warm query answers in well under a second', { timeout: 120000 }, async () => {
  await searchTorah('בישול בשבת');
  const started = Date.now();
  const result = await searchTorah('חימום מרק בשבת');
  assert.ok(Date.now() - started < 1000, `${Date.now() - started} ms`);
  assert.ok(result.results.length > 0);
  assert.deepEqual(remote, [], 'no network request');
});
