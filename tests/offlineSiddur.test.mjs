// Offline: every siddur entry opens from the bundled copy (a section-less root is addressed by itself, never
// "Root, Root"); Tanakh comes from the bundled UXLC pack; the public-domain Selichot are bundled; weekday Arvit and
// Mincha offer their additions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import siddurOffline from '../src/data/siddurOffline.mjs';
import festivalOffline from '../src/data/festivalOffline.mjs';
import { localTanakhText, parseTanakhRef } from '../src/services/localTanakh.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const loadChunk = edition => JSON.parse(readFileSync(new URL(`../public/library/packs/uxlc-2.5/${edition.editionId.split(':')[1]}.json`, import.meta.url), 'utf8'));

test('a siddur root without sections is addressed by itself — the doubled address sent it online', () => {
  assert.match(read('../src/pages/BooksPage.jsx'), /\(root\.nodes \? collectSiddurLeaves\(root\.nodes, rootEn, rootHe, \[rootEn\]\) : collectSiddurLeaves\(\[root\], rootEn, rootHe, \[\]\)\)/);
  for (const ref of ['Blessing of the Moon', 'Counting of the Omer', 'Post Meal Blessing', 'Bedtime Shema', 'Kabbalat Shabbat']) {
    assert.ok(siddurOffline.texts[`Siddur Edot HaMizrach, ${ref}`], ref);
    assert.ok(!siddurOffline.texts[`Siddur Edot HaMizrach, ${ref}, ${ref}`]);
  }
});

test('Tanakh opens from the bundled pack: chapters, cross-chapter readings, single verses', async () => {
  assert.deepEqual(parseTanakhRef('Numbers 29:35-30:1'), { workId: 'Numbers', startChapter: 29, startVerse: 35, endChapter: 30, endVerse: 1 });
  assert.equal((await localTanakhText('Genesis 1:1-2:3', { loadChunk })).hebrew.length, 34);
  assert.equal((await localTanakhText('Deuteronomy 33:1-34:12', { loadChunk })).hebrew.length, 41);
  assert.equal((await localTanakhText('Esther 10', { loadChunk })).hebrew.length, 3);
  assert.equal((await localTanakhText('I Samuel 20:18-42', { loadChunk })).hebrew.length, 25);
  assert.equal(await localTanakhText('Shulchan Arukh, Orach Chayim 1', { loadChunk }), null);
  assert.match(read('../src/services/sefaria.mjs'), /const tanakh = await localTanakhText\(ref\)\.catch\(\(\) => null\);/);
});

test('the public-domain Selichot are bundled', () => {
  const selichot = festivalOffline.texts['Selichot Edot HaMizrach'];
  assert.ok(selichot.he.length > 200);
  assert.match(selichot.heLicense, /Public Domain/i);
  assert.match(read('../src/services/sefaria.mjs'), /siddurOffline\.texts\[ref\] \|\| festivalOffline\.texts\[ref\]/);
});

test('weekday Arvit offers the Omer and the blessing of the moon; weekday Mincha the fast-day Torah reading', () => {
  const books = read('../src/pages/BooksPage.jsx');
  assert.match(books, /'Weekday Arvit': \[\[\['Counting of the Omer'\], 'ספירת העומר'\], \[\['Blessing of the Moon'\], 'ברכת הלבנה'\]\]/);
  assert.match(books, /'Weekday Mincha': \[\[\['Fast Days and Mourning', 'Torah Reading for Fast Days'\], 'קריאת התורה לתענית ציבור'\]\]/);
  for (const ref of ['Counting of the Omer', 'Blessing of the Moon', 'Fast Days and Mourning, Torah Reading for Fast Days']) assert.ok(siddurOffline.texts[`Siddur Edot HaMizrach, ${ref}`], ref);
});
