// The siddur's "מועדים" shelf: every festival text reachable at any time, in nusach Edot HaMizrach, and the siddur's
// own festival texts (Ushpizin, kiddushim, Zohar for the meals…) opened offline by exact paragraph ranges.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import siddurOffline from '../src/data/siddurOffline.mjs';
import { MOADIM, MOADIM_ROOTS, FESTIVAL_RANGES } from '../src/data/siddurMoadim.mjs';
import { getText } from '../src/services/sefaria.mjs';

const plain = markup => String(markup).replace(/<[^>]+>/g, '').replace(/[֑-ׇ]/g, '').trim();
const RANGE = /^(Siddur .+) (\d+)-(\d+)$/;
const allRefs = MOADIM.flatMap(moed => moed.items.flatMap(item => (item.flow || [item]).map(entry => entry.reference)));

test('every siddur text on the shelf is in the bundled offline siddur, ranges inside their leaf', () => {
  for (const ref of allRefs.filter(ref => ref.startsWith('Siddur '))) {
    const range = ref.match(RANGE);
    const leaf = siddurOffline.texts[range ? range[1] : ref];
    assert.ok(leaf, `${ref} is bundled`);
    if (range) assert.ok(Number(range[2]) >= 1 && Number(range[3]) <= leaf.he.length && Number(range[2]) <= Number(range[3]), `${ref} is inside the leaf`);
  }
});

test('each range starts at its own heading in the festival Mussaf leaf and the ranges tile it without gaps', () => {
  const leaf = siddurOffline.texts['Siddur Edot HaMizrach, Prayers for Three Festivals, Mussaf'].he;
  const heading = ref => plain(leaf[Number(ref.match(RANGE)[2]) - 1]);
  assert.equal(heading(FESTIVAL_RANGES.mussaf), 'מוסף לשלש רגלים');
  assert.equal(heading(FESTIVAL_RANGES.roshHashanaNight), 'קידוש לילי ראש השנה');
  assert.equal(heading(FESTIVAL_RANGES.ushpizin), 'סדר שבעה אושפיזין');
  assert.equal(heading(FESTIVAL_RANGES.festivalNightKiddush), 'קידוש לליל שלש רגלים');
  assert.equal(heading(FESTIVAL_RANGES.zoharSukkah), 'זוהר לסעודת סוכה');
  assert.match(heading(FESTIVAL_RANGES.zoharSheminiAtzeret), /^זוהר לסעודת שמי/);
  assert.equal(heading(FESTIVAL_RANGES.zoharShavuot), 'זוהר לסעודת שבועות');
  assert.equal(heading(FESTIVAL_RANGES.dayKiddush), 'קידוש היום לראש השנה ושלש רגלים');
  assert.equal(heading(FESTIVAL_RANGES.sukkotSongs), 'שירי סוכות');
  const ranges = Object.values(FESTIVAL_RANGES).map(ref => ref.match(RANGE).slice(2).map(Number)).sort((a, b) => a[0] - b[0]);
  ranges.forEach(([from], index) => assert.equal(from, index ? ranges[index - 1][1] + 1 : 1));
  assert.equal(ranges.at(-1)[1], leaf.length);
});

test('the Ushpizin open offline, cut from the bundled leaf with their original paragraph numbers', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('no network in this test'); };
  try {
    const text = await getText(FESTIVAL_RANGES.ushpizin, 'nikud');
    assert.equal(text.bundledOffline, true);
    assert.equal(text.indexes[0], 158);
    assert.equal(text.hebrew.length, text.siddurMarkup.length);
    assert.match(plain(text.siddurMarkup[0]), /סדר שבעה אושפיזין/);
    assert.ok(text.hebrew.some(line => plain(line).includes('ליעול אברהם')));
    assert.ok(!text.hebrew.some(line => plain(line).includes('קידוש לליל שלש רגלים')), 'stops before the next section');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the shelf covers the festivals, stays in nusach Edot HaMizrach and replaces the old season rows', () => {
  assert.deepEqual(MOADIM.map(moed => moed.key), ['rosh-hashana', 'sukkot', 'hanukkah', 'purim', 'pesach', 'shavuot']);
  for (const moed of MOADIM) {
    const refs = moed.items.map(item => item.reference);
    assert.equal(new Set(refs).size, refs.length, `${moed.title}: no item twice`);
  }
  assert.ok(allRefs.every(ref => /^(Siddur Edot HaMizrach|Haggadah Edot Hamizrah|Selichot Edot HaMizrach|Esther \d+)/.test(ref)), 'no other nusach');
  const pesach = MOADIM.find(moed => moed.key === 'pesach');
  assert.equal(pesach.items[0].flow.length, 31, 'the whole Haggadah, part by part');
  assert.equal(MOADIM.find(moed => moed.key === 'purim').items.find(item => item.title === 'מגילת אסתר').flow.length, 10);
  const page = readFileSync(new URL('../src/pages/BooksPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /title: 'ראש חודש ותעניות', roots: \['Rosh Hodesh', 'Blessing of the Moon', 'Fast Days and Mourning'\]/);
  assert.match(page, /\.\.\.MOADIM_ROOTS\]/, 'the moved roots do not fall into "עוד בסידור"');
  assert.deepEqual(MOADIM_ROOTS, ['Hanukkah', 'Purim', 'Prayers for Three Festivals', 'Counting of the Omer', 'Nissan']);
});

test('the shelf follows "ראש חודש ותעניות" and, like every siddur group, opens only when tapped', () => {
  const page = readFileSync(new URL('../src/pages/BooksPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /<\/details>,group\.key==='seasons'&&moadimGroup\]/);
  assert.match(page, /open=\{isOpen\('group:moadim'\)\}/);
  assert.match(page, /className="siddur-collection" open=\{isOpen\(key\)\}/);
  assert.doesNotMatch(page, /open: true/, 'no group starts open');
  assert.doesNotMatch(page, /moedNow/);
});
