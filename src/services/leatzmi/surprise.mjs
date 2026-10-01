// Three wheels on one principle — something from the Tanakh, drawn from a shuffle bag kept on the device: every item
// comes up once before any comes up again, the bag survives closing the app, and the result opens in the app's own
// Tanakh reader (the library), offline like the rest of it.
//   פֶּרֶק בְּהַפְתָּעָה   a whole chapter            books/r/<work>/<chapter>
//   פָּסוּק בְּהַפְתָּעָה  one whole verse              books/r/<work>/<chapter>/<verse>   (the reader marks the verse)
//   מִלָּה בְּהַפְתָּעָה   a meaningful word, with its verse (data/leatzmi/tanakhWords.mjs), and its gematria on request
// The chapter bag keeps its shuffled order; the verse and word bags (23,213 verses, thousands of words) keep only a
// permutation — (a·i + b) mod n, a coprime to n — and a position, so they stay a few bytes.
//
// Storage: localStorage 'kz-leatzmi-surprise-v1' = { v: 1, scope, wheel, bags: { [scope]: { size, remaining: [index…] } },
//          verseBags: { [scope]: { size, a, b, pos } }, wordBag: { size, a, b, pos },
//          last: { scope, workId, chapter, at }, lastVerse: { workId, chapter, verse }, lastWord: { index } }
import { TANAKH_SECTIONS } from '../../data/tanakhCatalog.mjs';
import { hebrewNumeral } from '../hebrewNumerals.mjs';
import { defaultStorage, readJSON, toIso, writeJSON } from './storage.mjs';

export const SURPRISE_KEY = 'kz-leatzmi-surprise-v1';
export const SCOPES = Object.freeze([['all', 'הכול'], ['torah', 'תורה'], ['neviim', 'נביאים'], ['ketuvim', 'כתובים']]);
export const WHEELS = Object.freeze([['chapter', 'פרק', 'פֶּרֶק בְּהַפְתָּעָה'], ['verse', 'פסוק', 'פָּסוּק בְּהַפְתָּעָה'], ['word', 'מילה', 'מִלָּה בְּהַפְתָּעָה']]);
const workIdOf = english => english.replace(/ /g, '_');

const cache = new Map();
// Every chapter of a scope, in canonical order: [{ workId, book, chapter }].
export function chaptersOf(scope = 'all') {
  if (cache.has(scope)) return cache.get(scope);
  const sections = scope === 'all' ? TANAKH_SECTIONS : TANAKH_SECTIONS.filter(section => section.id === scope);
  const list = [];
  for (const section of sections) for (const [english, he, count] of section.books) for (let chapter = 1; chapter <= count; chapter += 1) list.push({ workId: workIdOf(english), book: he, chapter, section: section.id });
  cache.set(scope, list);
  return list;
}

export const chapterRoute = item => `books/r/${encodeURIComponent(item.workId)}/${item.chapter}`;
export const chapterLabel = item => `${item.book} ${hebrewNumeral(item.chapter)}`;

function shuffled(size, random) {
  const order = Array.from({ length: size }, (_, index) => index);
  for (let i = size - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}

const objectOr = (value, fallback) => (value && typeof value === 'object' && !Array.isArray(value) ? value : fallback);
export function readSurprise(storage = defaultStorage()) {
  const raw = readJSON(storage, SURPRISE_KEY, {});
  const scope = SCOPES.some(([id]) => id === raw?.scope) ? raw.scope : 'all';
  const wheel = WHEELS.some(([id]) => id === raw?.wheel) ? raw.wheel : 'chapter';
  return {
    v: 1, scope, wheel,
    bags: objectOr(raw?.bags, {}), verseBags: objectOr(raw?.verseBags, {}), wordBag: objectOr(raw?.wordBag, null),
    last: raw?.last || null, lastVerse: objectOr(raw?.lastVerse, null), lastWord: objectOr(raw?.lastWord, null),
  };
}
export function setSurpriseWheel(wheel, storage = defaultStorage()) {
  if (!WHEELS.some(([id]) => id === wheel)) return readSurprise(storage);
  const state = { ...readSurprise(storage), wheel };
  writeJSON(storage, SURPRISE_KEY, state);
  return state;
}
export function setSurpriseScope(scope, storage = defaultStorage()) {
  if (!SCOPES.some(([id]) => id === scope)) return readSurprise(storage);
  const state = { ...readSurprise(storage), scope };
  writeJSON(storage, SURPRISE_KEY, state);
  return state;
}

/** Draw the next chapter of `scope` → { workId, book, chapter, section, route, label }. */
export function drawChapter(scope = readSurprise().scope, { storage = defaultStorage(), random = Math.random, now = Date.now() } = {}) {
  const chapters = chaptersOf(scope);
  const state = readSurprise(storage);
  let bag = state.bags[scope];
  // A bag from another catalog size (or a damaged one) is replaced; indices out of range are dropped.
  let remaining = bag && bag.size === chapters.length && Array.isArray(bag.remaining) ? bag.remaining.filter(index => Number.isInteger(index) && index >= 0 && index < chapters.length) : [];
  if (!remaining.length) {
    remaining = shuffled(chapters.length, random);
    // Never the same chapter twice in a row across a refill.
    const last = state.last && chapters.findIndex(item => item.workId === state.last.workId && item.chapter === state.last.chapter);
    if (remaining.length > 1 && remaining[remaining.length - 1] === last) [remaining[0], remaining[remaining.length - 1]] = [remaining[remaining.length - 1], remaining[0]];
  }
  const index = remaining.pop();
  const item = chapters[index];
  bag = { size: chapters.length, remaining };
  writeJSON(storage, SURPRISE_KEY, { ...state, scope, bags: { ...state.bags, [scope]: bag }, last: { scope, workId: item.workId, chapter: item.chapter, at: toIso(now) } });
  return { ...item, route: chapterRoute(item), label: chapterLabel(item) };
}

export const remainingInBag = (scope, storage = defaultStorage()) => {
  const bag = readSurprise(storage).bags[scope];
  return bag && bag.size === chaptersOf(scope).length ? bag.remaining.length : chaptersOf(scope).length;
};

// ---------- the large bags: a permutation and a position ----------
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function freshPermutation(size, random) {
  if (size <= 1) return { size, a: 1, b: 0, pos: 0 };
  let a = 1 + Math.floor(random() * (size - 1));
  while (gcd(a, size) !== 1) a = a % (size - 1) + 1;
  return { size, a, b: Math.floor(random() * size), pos: 0 };
}
const validBag = (bag, size) => bag && bag.size === size && [bag.a, bag.b, bag.pos].every(Number.isInteger) && bag.a >= 1 && bag.a < Math.max(2, size) && gcd(bag.a, size) === 1 && bag.b >= 0 && bag.b < size && bag.pos >= 0 && bag.pos <= size;
export const bagIndex = (bag, pos = bag.pos) => (bag.a * pos + bag.b) % bag.size;
/** The next index of a bag of `size` (every index once per round); never the same index twice in a row across rounds. */
export function nextInBag(bag, size, random = Math.random, last = null) {
  let current = validBag(bag, size) && bag.pos < size ? bag : null;
  if (!current) {
    current = freshPermutation(size, random);
    if (size > 1 && bagIndex(current, 0) === last) current = { ...current, b: (current.b + 1) % size };
  }
  return { index: bagIndex(current), bag: { ...current, pos: current.pos + 1 } };
}
export const remainingInLargeBag = (bag, size) => (validBag(bag, size) ? size - bag.pos : size);

// ---------- פָּסוּק בְּהַפְתָּעָה ----------
// books: data/leatzmi/tanakhVerses.mjs BOOKS — [[workId, hebrewName, section, [verses per chapter]]].
const verseCache = new WeakMap();
export function versesOf(books, scope = 'all') {
  let byScope = verseCache.get(books);
  if (!byScope) verseCache.set(books, byScope = new Map());
  if (byScope.has(scope)) return byScope.get(scope);
  // A compact catalogue: one row per chapter, with the running count of verses before it.
  const rows = [];
  let total = 0;
  for (const [workId, book, section, counts] of books) {
    if (scope !== 'all' && section !== scope) continue;
    counts.forEach((count, index) => { rows.push({ workId, book, section, chapter: index + 1, start: total, count }); total += count; });
  }
  const catalogue = { rows, total };
  byScope.set(scope, catalogue);
  return catalogue;
}
export function verseAt(catalogue, index) {
  let low = 0;
  let high = catalogue.rows.length - 1;
  while (low < high) { const mid = (low + high + 1) >> 1; if (catalogue.rows[mid].start <= index) low = mid; else high = mid - 1; }
  const row = catalogue.rows[low];
  return { workId: row.workId, book: row.book, section: row.section, chapter: row.chapter, verse: index - row.start + 1 };
}
export const verseRoute = item => `books/r/${encodeURIComponent(item.workId)}/${item.chapter}/${item.verse}`;
const plainNumeral = n => hebrewNumeral(n).replace(/[׳״]/g, '');
export const verseLabel = item => `${item.book} ${plainNumeral(item.chapter)}, ${plainNumeral(item.verse)}`;
// The reference the Tanakh helper reads ("I Samuel 3:10").
export const verseRef = item => `${item.workId.replace(/_/g, ' ')} ${item.chapter}:${item.verse}`;

/** Draw the next verse of `scope` → { workId, book, chapter, verse, route, label, ref }. */
export function drawVerse(books, scope = 'all', { storage = defaultStorage(), random = Math.random } = {}) {
  const catalogue = versesOf(books, scope);
  const state = readSurprise(storage);
  const last = state.lastVerse ? catalogue.rows.find(row => row.workId === state.lastVerse.workId && row.chapter === state.lastVerse.chapter) : null;
  const lastIndex = last ? last.start + state.lastVerse.verse - 1 : null;
  const { index, bag } = nextInBag(state.verseBags[scope], catalogue.total, random, lastIndex);
  const item = verseAt(catalogue, index);
  writeJSON(storage, SURPRISE_KEY, { ...state, verseBags: { ...state.verseBags, [scope]: bag }, lastVerse: { workId: item.workId, chapter: item.chapter, verse: item.verse } });
  return { ...item, route: verseRoute(item), label: verseLabel(item), ref: verseRef(item) };
}

// ---------- מִלָּה בְּהַפְתָּעָה ----------
// words: data/leatzmi/tanakhWords.mjs WORDS — [[word, bookIndex, chapter, verse]]; books as above.
export function wordAt(words, books, index) {
  const [word, bookIndex, chapter, verse] = words[index];
  const [workId, book, section] = books[bookIndex];
  const item = { word, workId, book, section, chapter, verse, index };
  return { ...item, route: verseRoute(item), label: verseLabel(item), ref: verseRef(item) };
}
/** Draw the next word → { word, workId, book, chapter, verse, route, label, ref, index }. */
export function drawWord(words, books, { storage = defaultStorage(), random = Math.random } = {}) {
  const state = readSurprise(storage);
  const { index, bag } = nextInBag(state.wordBag, words.length, random, state.lastWord?.index ?? null);
  writeJSON(storage, SURPRISE_KEY, { ...state, wordBag: bag, lastWord: { index } });
  return wordAt(words, books, index);
}
