// לעצמי · בהפתעה — the verse and word wheels: every verse and word they can draw exists in the bundled Tanakh, opens
// the reader at that verse, comes once per bag; the word is exactly as its verse has it; gematria is the app's own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { PUBLIC_WORKS } from '../src/data/library/registry.mjs';
import { BOOKS } from '../src/data/leatzmi/tanakhVerses.mjs';
import { WORDS } from '../src/data/leatzmi/tanakhWords.mjs';
import { TANAKH_SECTIONS } from '../src/data/tanakhCatalog.mjs';
import { SURPRISE_KEY, WHEELS, bagIndex, drawVerse, drawWord, nextInBag, readSurprise, remainingInLargeBag, setSurpriseWheel, verseAt, versesOf, wordAt } from '../src/services/leatzmi/surprise.mjs';
import { baseLetters, isMeaningfulShape, verseDisplay, verseWords } from '../src/services/leatzmi/tanakhWords.mjs';
import { gematriaAll, standardValue, torahWordsWithValue } from '../src/services/gematriaCalc.mjs';
import { parseLeatzmiRoute, leatzmiRoute } from '../src/services/leatzmi/routes.mjs';
import { parseLibraryRouteForTest } from './helpers/libraryRoute.mjs';
import { memoryStorage } from './helpers/memoryStorage.mjs';
import torahText from '../src/data/torahText.mjs';

const works = new Map(PUBLIC_WORKS.map(work => [work.workId, work]));
const chunks = new Map();
const chunkOf = workId => {
  if (!chunks.has(workId)) chunks.set(workId, JSON.parse(gunzipSync(readFileSync(new URL(`../public/library/packs/uxlc-2.5/${workId}.json.gz`, import.meta.url))).toString('utf8')));
  return chunks.get(workId);
};
const seeded = (seed = 11) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test('the verse catalogue is the library\'s Tanakh: every book, every chapter, every verse count', () => {
  const ids = TANAKH_SECTIONS.flatMap(section => section.books.map(([english]) => english.replace(/ /g, '_')));
  assert.deepEqual(BOOKS.map(book => book[0]), ids);
  for (const [workId, , section, counts] of BOOKS) {
    const work = works.get(workId);
    assert.equal(work.primaryCategory, 'tanakh', workId);
    assert.deepEqual(counts, work.editions[0].nodes, `${workId}: verses per chapter as the registry has them`);
    assert.ok(TANAKH_SECTIONS.find(item => item.id === section).books.some(([english]) => english.replace(/ /g, '_') === workId));
  }
  const all = versesOf(BOOKS, 'all');
  assert.equal(all.total, BOOKS.reduce((sum, book) => sum + book[3].reduce((a, b) => a + b, 0), 0));
  assert.equal(versesOf(BOOKS, 'torah').total + versesOf(BOOKS, 'neviim').total + versesOf(BOOKS, 'ketuvim').total, all.total);
  // Index ↔ verse: the first and last verse of every book.
  assert.deepEqual(verseAt(all, 0), { workId: 'Genesis', book: 'בראשית', section: 'torah', chapter: 1, verse: 1 });
  const last = verseAt(all, all.total - 1);
  assert.equal(last.workId, 'II_Chronicles');
  assert.equal(last.verse, BOOKS.at(-1)[3].at(-1));
});

test('a drawn verse exists in the pack and opens the Tanakh reader at that verse', () => {
  const storage = memoryStorage();
  const random = seeded(5);
  for (let i = 0; i < 60; i += 1) {
    const scope = ['all', 'torah', 'neviim', 'ketuvim'][i % 4];
    const item = drawVerse(BOOKS, scope, { storage, random });
    if (scope !== 'all') assert.equal(item.section, scope);
    const unit = chunkOf(item.workId).nodes[item.chapter - 1].units[item.verse - 1];
    assert.ok(unit && unit.n === item.verse, `${item.ref} exists`);
    assert.match(item.route, /^books\/r\/[A-Za-z_]+\/\d+\/\d+$/);
    const parsed = parseLibraryRouteForTest(item.route);
    assert.equal(parsed.view, 'read');
    assert.equal(parsed.id, item.workId);
    assert.equal(parsed.node, item.chapter);
    assert.equal(parsed.unit, item.verse, 'the reader marks and scrolls to the verse');
    assert.ok(item.label.startsWith(item.book));
    assert.match(item.ref, /^[A-Za-z ]+ \d+:\d+$/);
  }
});

test('the verse bag: every verse of a scope once before any again; it survives a reload; no repeat across a refill', () => {
  const storage = memoryStorage();
  const random = seeded(3);
  const size = versesOf(BOOKS, 'torah').total;
  const seen = new Set();
  let last = null;
  for (let i = 0; i < size; i += 1) {
    const item = drawVerse(BOOKS, 'torah', { storage, random });
    const key = `${item.workId}/${item.chapter}/${item.verse}`;
    assert.ok(!seen.has(key), `${key} twice within one bag`);
    seen.add(key);
    last = key;
  }
  assert.equal(seen.size, size);
  assert.equal(remainingInLargeBag(readSurprise(storage).verseBags.torah, size), 0);
  const next = drawVerse(BOOKS, 'torah', { storage, random });
  assert.notEqual(`${next.workId}/${next.chapter}/${next.verse}`, last);
  assert.equal(remainingInLargeBag(readSurprise(storage).verseBags.torah, size), size - 1);
  // The stored bag is a permutation and a position — a few numbers, not 5,800 indices.
  assert.ok(JSON.stringify(readSurprise(storage).verseBags.torah).length < 80);
});

test('the permutation bag is a true permutation for any size, and a damaged bag is rebuilt', () => {
  for (const size of [1, 2, 3, 10, 97, 100, 929]) {
    let bag = null;
    const seen = new Set();
    for (let i = 0; i < size; i += 1) { const step = nextInBag(bag, size, seeded(size)); seen.add(step.index); bag = step.bag; }
    assert.equal(seen.size, size, `size ${size}`);
    assert.ok([...seen].every(index => index >= 0 && index < size));
  }
  const fixed = nextInBag({ size: 10, a: 3, b: 4, pos: 2 }, 10, Math.random);
  assert.equal(fixed.index, bagIndex({ size: 10, a: 3, b: 4, pos: 2 }));
  for (const damaged of [{ size: 10, a: 5, b: 1, pos: 0 }, { size: 9, a: 1, b: 0, pos: 0 }, { size: 10, a: 'x' }, null]) {
    const step = nextInBag(damaged, 10, seeded(2));
    assert.ok(step.index >= 0 && step.index < 10);
    assert.equal(step.bag.size, 10);
  }
});

test('every word of מילה בהפתעה is exactly as its verse has it (te\'amim removed), meaningful, and opens that verse', () => {
  assert.ok(WORDS.length >= 3000, `${WORDS.length} words`);
  const seenBases = new Set();
  for (const [word, bookIndex, chapter, verse] of WORDS) {
    const [workId] = BOOKS[bookIndex];
    const unit = chunkOf(workId).nodes[chapter - 1].units[verse - 1];
    assert.ok(verseWords(unit.text).includes(word), `${word} in ${workId} ${chapter}:${verse}`);
    assert.ok(verseDisplay(unit.text).includes(word));
    assert.ok(isMeaningfulShape(word), word);
    assert.ok(!/[֑-֯]/.test(word), 'no te\'amim');
    assert.ok(/[ְ-ּ]/.test(word), `${word} has its nikud`);
    const base = baseLetters(word);
    assert.ok(base.length >= 3, word);
    assert.ok(!seenBases.has(base), `${base} once`);
    seenBases.add(base);
  }
  // Function words and the divine names never come up.
  for (const stop of ['אשר', 'הנה', 'אליו', 'עליהם', 'יהוה', 'אלהים']) assert.ok(!seenBases.has(baseLetters(stop)), stop);
});

test('the word bag: each word once per round, persisted; the word carries its verse route', () => {
  const storage = memoryStorage();
  const random = seeded(17);
  const seen = new Set();
  for (let i = 0; i < 400; i += 1) {
    const item = drawWord(WORDS, BOOKS, { storage, random });
    assert.ok(!seen.has(item.index));
    seen.add(item.index);
    assert.equal(item.word, WORDS[item.index][0]);
    assert.equal(parseLibraryRouteForTest(item.route).unit, item.verse);
  }
  assert.equal(remainingInLargeBag(readSurprise(storage).wordBag, WORDS.length), WORDS.length - 400);
  assert.deepEqual(wordAt(WORDS, BOOKS, 0).word, WORDS[0][0]);
});

test('gematria of the wheel\'s word is the app\'s own calculator, and the Torah words share its value', () => {
  const torah = torahText.books.filter(book => ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'].includes(book.id));
  const item = wordAt(WORDS, BOOKS, WORDS.findIndex(([word]) => baseLetters(word) === 'שלומ'));
  assert.ok(item.word, 'שָׁלוֹם is a word of the wheel');
  const result = gematriaAll(item.word);
  assert.equal(result.standard, 376);
  assert.equal(standardValue(item.word), 376, 'nikud does not change the value');
  const same = torahWordsWithValue(torah, result.standard, { limit: 6, exclude: item.word });
  assert.ok(same.length > 0 && same.length <= 6);
  for (const entry of same) { assert.equal(standardValue(entry.word), 376); assert.notEqual(baseLetters(entry.word), 'שלומ'); }
  // A sample across the list: every word has letters to count.
  for (let i = 0; i < WORDS.length; i += 97) assert.ok(gematriaAll(WORDS[i][0]).standard > 0);
});

test('the chosen wheel is remembered; the route can name a wheel', () => {
  const storage = memoryStorage();
  assert.equal(readSurprise(storage).wheel, 'chapter');
  setSurpriseWheel('word', storage);
  assert.equal(readSurprise(storage).wheel, 'word');
  setSurpriseWheel('nonsense', storage);
  assert.equal(readSurprise(storage).wheel, 'word');
  assert.deepEqual(WHEELS.map(([id]) => id), ['chapter', 'verse', 'word']);
  assert.deepEqual(parseLeatzmiRoute('leatzmi/surprise'), { view: 'surprise' });
  assert.deepEqual(parseLeatzmiRoute('leatzmi/surprise/verse'), { view: 'surprise', wheel: 'verse' });
  assert.deepEqual(parseLeatzmiRoute('leatzmi/surprise/x'), { view: 'surprise' });
  assert.equal(leatzmiRoute.surprise('word'), 'leatzmi/surprise/word');
  // An old store (chapter bags only) still reads, and keeps its chapter bag.
  const old = memoryStorage({ [SURPRISE_KEY]: JSON.stringify({ v: 1, scope: 'torah', bags: { torah: { size: 187, remaining: [1, 2] } } }) });
  const state = readSurprise(old);
  assert.equal(state.wheel, 'chapter');
  assert.deepEqual(state.bags.torah.remaining, [1, 2]);
  drawVerse(BOOKS, 'torah', { storage: old, random: seeded(1) });
  assert.deepEqual(readSurprise(old).bags.torah.remaining, [1, 2]);
});
