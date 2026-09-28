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
  assert.match(read('../src/services/siddurIndex.mjs'), /const children = root\.node\.nodes \? root\.node\.nodes : \[root\.node\];/);
  assert.match(read('../src/services/siddurIndex.mjs'), /const path = root\.node\.nodes \? \[\.\.\.root\.path, en\] : root\.path;/);
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
  const layouts = read('../src/data/nusach/siddurLayouts.mjs');
  assert.match(layouts, /'Weekday Arvit': \[\[\['Counting of the Omer'\], 'ספירת העומר'\], \[\['Blessing of the Moon'\], 'ברכת הלבנה'\]\]/);
  assert.match(layouts, /'Weekday Mincha': \[\[\['Fast Days and Mourning', 'Torah Reading for Fast Days'\], 'קריאת התורה לתענית ציבור'\]\]/);
  for (const ref of ['Counting of the Omer', 'Blessing of the Moon', 'Fast Days and Mourning, Torah Reading for Fast Days']) assert.ok(siddurOffline.texts[`Siddur Edot HaMizrach, ${ref}`], ref);
});

test('the Jerusalem Talmud is in the library: 38 tractates, chapter by chapter, halakhah by halakhah, credited CC-BY', async () => {
  const { WORKS, TAXONOMY } = await import('../src/data/library/registry.mjs');
  const yerushalmi = WORKS.filter(work => work.group === 'yerushalmi');
  assert.equal(yerushalmi.length, 38);
  assert.ok(TAXONOMY.find(category => category.id === 'talmud').groups.some(([id, title]) => id === 'yerushalmi' && title === 'תלמוד ירושלמי'));
  const berakhot = yerushalmi.find(work => work.workId === 'Jerusalem_Talmud_Berakhot');
  assert.equal(berakhot.editions[0].license, 'cc-by');
  assert.equal(berakhot.editions[0].sections.length, 9, 'nine chapters');
  assert.equal(berakhot.editions[0].nodeTitles[0], 'פרק א׳ · הלכה א׳');
});

test('a service and its additions read as one row: the divider falls below the additions', () => {
  const css = read('../src/styles/base.css');
  assert.match(css, /\.siddur-entry-with-extras\{display:grid;border-bottom:1px solid var\(--line\)\}\n\.siddur-entry-with-extras>\.siddur-entry\{border-bottom:0;/);
});
