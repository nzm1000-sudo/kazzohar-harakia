// פֶּרֶק בְּהַפְתָּעָה — a whole chapter of Tanakh, drawn from a shuffle bag kept on the device: every chapter of the
// chosen scope comes up once before any comes up again, and the bag survives closing the app. The chapter opens in the
// app's own Tanakh reader (the library: books/r/<work>/<chapter>), so it is offline like the rest of the library.
//
// Storage: localStorage 'kz-leatzmi-surprise-v1' = { v: 1, scope, bags: { [scope]: { size, remaining: [index…] } },
//          last: { scope, workId, chapter, at } }
import { TANAKH_SECTIONS } from '../../data/tanakhCatalog.mjs';
import { hebrewNumeral } from '../hebrewNumerals.mjs';
import { defaultStorage, readJSON, toIso, writeJSON } from './storage.mjs';

export const SURPRISE_KEY = 'kz-leatzmi-surprise-v1';
export const SCOPES = Object.freeze([['all', 'הכול'], ['torah', 'תורה'], ['neviim', 'נביאים'], ['ketuvim', 'כתובים']]);
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

export function readSurprise(storage = defaultStorage()) {
  const raw = readJSON(storage, SURPRISE_KEY, {});
  const scope = SCOPES.some(([id]) => id === raw?.scope) ? raw.scope : 'all';
  return { v: 1, scope, bags: raw?.bags && typeof raw.bags === 'object' ? raw.bags : {}, last: raw?.last || null };
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
