// Which parasha (or festival reading) does an article quote? Build-time helper for classify.mjs.
// Every Torah verse (the app's own UXLC text) is cut into word trigrams, spelled without points and without the
// optional ו/י (so "ויאמר משה אל" in a leaflet meets "וַיֹּאמֶר מֹשֶׁה אֶל" in the Torah); a trigram that occurs in more than
// two parashot says nothing and is ignored. An article's quotations are then counted per parasha. The festivals'
// own readings (Ruth for Shavuot, Esther for Purim, …) are indexed the same way.
import { readFileSync } from 'node:fs';
import { normalizeHebrew } from '../../src/content.mjs';
import { skeleton } from '../../src/services/torah/hebrew.mjs';
import { TORAH_ALIYOT } from '../../src/data/torahAliyot.mjs';
import torahText from '../../src/data/torahText.mjs';
import { PARASHA_SLUGS, ROOT } from './lib.mjs';

const BOOK_OF = slug => {
  const order = Object.values(PARASHA_SLUGS);
  const i = order.indexOf(slug);
  return i < 12 ? 'Genesis' : i < 23 ? 'Exodus' : i < 33 ? 'Leviticus' : i < 43 ? 'Numbers' : 'Deuteronomy';
};
// Festival readings (book, from "c:v", to "c:v") and whole books read on them.
const FESTIVAL_READINGS = {
  shavuot: [['Exodus', '19:1', '20:23'], ['Numbers', '28:26', '28:31'], ['Deuteronomy', '15:19', '16:17']],
  pesach: [['Exodus', '12:1', '15:26']],
  'seventh-pesach': [['Exodus', '13:17', '15:26']],
  'rosh-hashana': [['Genesis', '21:1', '22:24'], ['Numbers', '29:1', '29:6']],
  'yom-kippur': [['Leviticus', '16:1', '16:34'], ['Leviticus', '18:1', '18:30']],
  sukkot: [['Leviticus', '22:26', '23:44'], ['Numbers', '29:12', '29:39']],
  purim: [['Exodus', '17:8', '17:16']],
  chanukah: [],
};
const FESTIVAL_BOOKS = { shavuot: ['Ruth'], purim: ['Esther'], 'yom-kippur': ['Jonah'], sukkot: ['Ecclesiastes'], pesach: ['Song_of_songs'] };

const GOD = { 'יהוה': 'ה', 'ידוד': 'ה', 'יקוק': 'ה', 'הויה': 'ה', 'אלקימ': 'אלהימ', 'אלקי': 'אלהי', 'אלוקימ': 'אלהימ' };
export const words = text => normalizeHebrew(String(text)).split(' ').filter(w => /^[א-ת]+$/.test(w)).map(w => GOD[w] || w).map(skeleton);
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1];
const cv = s => s.split(':').map(Number);

let built = null;
let distinctive = null;
const wordCount = new Map();
function build() {
  const grams = new Map(); // trigram → Set(label)
  const add = (label, verseText) => {
    const w = words(verseText);
    for (let i = 0; i + 3 <= w.length; i += 1) {
      const g = `${w[i]} ${w[i + 1]} ${w[i + 2]}`;
      let s = grams.get(g); if (!s) grams.set(g, (s = new Set())); s.add(label);
    }
  };
  const books = Object.fromEntries(torahText.books.map(b => [b.id, b.verses]));
  const inRange = (v, from, to) => cmp([v[0], v[1]], cv(from)) >= 0 && cmp([v[0], v[1]], cv(to)) <= 0;
  for (const slug of Object.values(PARASHA_SLUGS)) {
    const al = TORAH_ALIYOT[slug];
    for (const v of books[BOOK_OF(slug)]) if (inRange(v, al[0][0], al.at(-1)[1])) {
      add(`p:${slug}`, v[2]);
      for (const w of words(v[2])) { if (w.length < 3) continue; let m = wordCount.get(w); if (!m) wordCount.set(w, (m = new Map())); m.set(slug, (m.get(slug) || 0) + 1); }
    }
  }
  // A parasha's own vocabulary: words used at least 3 times in it and (≥ 70%) almost nowhere else in the Torah.
  distinctive = new Map(Object.values(PARASHA_SLUGS).map(sl => [sl, new Set()]));
  for (const [w, m] of wordCount) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    for (const [sl, n] of m) if (n >= 3 && n / total >= 0.7) distinctive.get(sl).add(w);
  }
  for (const [h, ranges] of Object.entries(FESTIVAL_READINGS)) for (const [book, from, to] of ranges) for (const v of books[book]) if (inRange(v, from, to)) add(`h:${h}`, v[2]);
  const tanakh = JSON.parse(readFileSync(`${ROOT}/src/data/tanakh.json`, 'utf8'));
  for (const [h, list] of Object.entries(FESTIVAL_BOOKS)) for (const name of list) {
    const book = tanakh.books.find(b => b.id === name || b.id === name.replace(/ /g, '') || b.englishName === name);
    if (!book) continue;
    for (const v of book.verses || book.chapters?.flat() || []) add(`h:${h}`, Array.isArray(v) ? v[2] : String(v));
  }
  // Keep only telling trigrams: at most two parashot.
  for (const [g, s] of grams) if ([...s].filter(l => l.startsWith('p:')).length > 2) grams.delete(g);
  built = grams;
  return grams;
}

/** Quotations of a text → { 'p:<slug>': n, 'h:<id>': n } (number of distinct trigrams). */
export function locate(text) {
  const grams = built || build();
  // Only quoted passages count (a verse is quoted between quotation marks in these leaflets).
  const quotes = [...String(text).matchAll(/["״“]([^"״”]{6,400})["״”]/g)].map(m => m[1]);
  const seen = new Set();
  const counts = {};
  for (const q of quotes) {
    const w = words(q);
    for (let i = 0; i + 3 <= w.length; i += 1) {
      const g = `${w[i]} ${w[i + 1]} ${w[i + 2]}`;
      if (seen.has(g)) continue; seen.add(g);
      const s = grams.get(g);
      if (s) for (const l of s) counts[l] = (counts[l] || 0) + 1;
    }
  }
  return counts;
}

/** How many of a parasha's own words (its distinctive vocabulary) the text uses. */
export function parashaVocabulary(text, slug) {
  if (!built) build();
  const set = distinctive.get(slug);
  if (!set) return 0;
  const seen = new Set();
  for (const w of words(text)) if (set.has(w)) seen.add(w);
  return seen.size;
}
