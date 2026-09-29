// Torah Engine · one commentary engine: only commentators with content at the exact place, real text behind each, and a
// reader that reaches every published commentary (the test fails if one cannot be reached).
import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKS, workById } from '../src/data/library/registry.mjs';
import { commentariesAt, commentaryRoute, commentatorsOnVerse, getCommentaries } from '../src/services/torah/commentaries.mjs';
import { commentaryReachability } from '../src/services/torah/audit.mjs';
import { layersAt, loadLayerUnits } from '../src/services/library/relations.mjs';
import { loadLocalAmud } from '../src/services/talmudLocal.mjs';
import { loadJsx } from './helpers/jsx.mjs';
import { diskFetch } from './helpers/diskAssets.mjs';
import { routeParts } from '../src/services/safeRoute.mjs';

const ids = list => list.map(item => item.workId);
const layerOf = (baseWorkId, chapter, workId) => layersAt(baseWorkId, chapter).find(layer => layer.work.workId === workId);
async function commentsOn(baseWorkId, chapter, verse, workId) {
  const units = await loadLayerUnits(layerOf(baseWorkId, chapter, workId), { fetchImpl: diskFetch });
  return units.filter(unit => unit.v === verse);
}

test('בראשית א:א — Rashi and the other bundled commentators, each with real text on that verse', async () => {
  const at = commentatorsOnVerse('Genesis', 1, 1);
  assert.deepEqual(ids(at).slice(0, 2), ['Rashi_on_Genesis', 'Ramban_on_Genesis']);
  assert.ok(at.length >= 5);
  for (const layer of at) {
    const comments = await commentsOn('Genesis', 1, 1, layer.workId);
    assert.ok(comments.length > 0 && comments.every(unit => unit.text.trim()), `${layer.workId} has text on Genesis 1:1`);
  }
  const rashi = await commentsOn('Genesis', 1, 1, 'Rashi_on_Genesis');
  assert.match(rashi[0].text, /אמר רבי יצחק/);
  assert.equal(commentaryRoute({ workId: 'Genesis', section: 1, segment: 1 }), 'books/r/Genesis/1/1/m');
});

test('changing the verse changes the context: no commentator is listed where he has nothing', async () => {
  for (const [book, c, v] of [['Genesis', 12, 1], ['Exodus', 20, 1], ['Leviticus', 1, 1], ['Isaiah', 1, 1], ['Psalms', 1, 1]]) {
    const at = commentatorsOnVerse(book, c, v);
    assert.ok(at.length > 0, `${book} ${c}:${v}`);
    for (const layer of at) assert.ok((await commentsOn(book, c, v, layer.workId)).length > 0, `${layer.workId} on ${book} ${c}:${v}`);
  }
  // Every Rashi comment of Genesis 1 sits on the verse the map names, and the map names no verse Rashi skips.
  const units = await loadLayerUnits(layerOf('Genesis', 1, 'Rashi_on_Genesis'), { fetchImpl: diskFetch });
  const verses = new Set(units.map(unit => unit.v));
  for (let v = 1; v <= 31; v += 1) assert.equal(ids(commentatorsOnVerse('Genesis', 1, v)).includes('Rashi_on_Genesis'), verses.has(v), `Genesis 1:${v}`);
  assert.deepEqual(commentatorsOnVerse('Genesis', 1, 999), []);
  assert.deepEqual(commentatorsOnVerse('Genesis', 999, 1), []);
});

test('Mishnah: Bartenura and Tosafot Yom Tov on ברכות א:א', async () => {
  assert.deepEqual(ids(commentatorsOnVerse('Mishnah_Berakhot', 1, 1)), ['Bartenura_on_Mishnah_Berakhot', 'Tosafot_Yom_Tov_on_Mishnah_Berakhot']);
  const bartenura = await commentsOn('Mishnah_Berakhot', 1, 1, 'Bartenura_on_Mishnah_Berakhot');
  assert.ok(bartenura.length > 0 && bartenura[0].text.length > 20);
});

test('Talmud: Rashi and Tosafot per segment on the device; the reader opens the named panel', async () => {
  globalThis.fetch = diskFetch;
  const all = await getCommentaries({ workId: 'Bavli_Berakhot', section: 1 }, { loadAmud: (tractate, amud) => loadLocalAmud(tractate, amud, { fetchImpl: diskFetch }) });
  assert.deepEqual(ids(all), ['Rashi_on_Berakhot', 'Tosafot_on_Berakhot']);
  const amud = await loadLocalAmud({ title: 'Berakhot' }, '2a', { fetchImpl: diskFetch });
  const segment = amud.segments.find(seg => seg.commentaries.some(c => c.commentator === 'תוספות'));
  const one = await getCommentaries({ workId: 'Bavli_Berakhot', section: 1, segment: segment.n }, { loadAmud: async () => amud });
  assert.ok(ids(one).includes('Tosafot_on_Berakhot'));
  const route = commentaryRoute({ workId: 'Bavli_Berakhot', section: 1, segment: segment.n }, 'Tosafot_on_Berakhot');
  assert.equal(route, `talmud/Berakhot/2a/${segment.n}/tosafot`);
  const parsed = loadJsx('pages/TalmudPage.jsx').parseTalmudRoute(route);
  assert.deepEqual([parsed.tractate.title, parsed.amud, parsed.segment, parsed.layer], ['Berakhot', '2a', segment.n, 'tosafot']);
  // The Rif is a book on its own pages (no licensed link to the Gemara): read in the library, not as a Gemara layer.
  assert.equal(workById('Rif_Berakhot').relation, null);
});

test('Shulchan Arukh: MB, Biur Halacha, Be\'er Heitev and Kaf HaChaim by seif — only where they speak', () => {
  const seif1 = ids(commentariesAt({ workId: 'Shulchan_Arukh__Orach_Chayim', section: 318, segment: 1 }));
  for (const id of ['Mishnah_Berurah', 'Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim']) assert.ok(seif1.includes(id), id);
  const all = new Set();
  for (let seif = 1; seif <= 19; seif += 1) for (const id of ids(commentariesAt({ workId: 'Shulchan_Arukh__Orach_Chayim', section: 318, segment: seif }))) all.add(id);
  for (const id of ['Mishnah_Berurah', 'Biur_Halacha', 'Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim', 'Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim']) assert.ok(all.has(id), `${id} somewhere on siman 318`);
  assert.equal(commentaryRoute({ workId: 'Shulchan_Arukh__Orach_Chayim', section: 318, segment: 1 }), 'books/r/Shulchan_Arukh__Orach_Chayim/318/1/m');
});

test('Zohar: the page commentaries (Yahel Ohr, Nefesh David…) from the page index', () => {
  assert.ok(ids(commentariesAt({ workId: 'Zohar', section: 29 })).includes('Yahel_Ohr_on_Zohar'));
});

test('every published commentary is reachable from a reader of its base text (fails on an orphan)', () => {
  assert.deepEqual(commentaryReachability(), []);
  // The check really fails on an unreachable layer.
  const fake = { workId: 'Fake_Commentary', title: 'x', public: true, kind: 'pack', relation: { relationType: 'commentary', baseWorkId: 'Genesis', anchorScheme: 'sefaria-ref' }, editions: [{ anchorNodes: [], seifCounts: null }] };
  assert.equal(commentaryReachability([...WORKS, fake]).length, 1);
  const orphan = { ...fake, workId: 'Orphan', relation: { ...fake.relation, baseWorkId: 'No_Such_Book' } };
  assert.match(commentaryReachability([...WORKS, orphan])[0].problem, /orphan/);
});

test('a commentary route parses back to the reader and the tab', () => {
  const parts = routeParts('books/r/Genesis/1/1/m/Rashi_on_Genesis.1.3');
  assert.deepEqual(parts.slice(1), ['r', 'Genesis', '1', '1', 'm', 'Rashi_on_Genesis.1.3']);
});
