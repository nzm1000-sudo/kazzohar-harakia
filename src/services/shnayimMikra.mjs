import { formatTanakhReference } from './tanakhReferences.mjs';
import { SHNAYIM_MIKRA_CANONICAL_RANGES } from '../data/shnayimMikraRanges.mjs';
import SHNAYIM_INDEX from '../data/library/shnayimIndex.mjs';

const BOOKS = [
  ['Genesis', 'בראשית'], ['Exodus', 'שמות'], ['Leviticus', 'ויקרא'], ['Numbers', 'במדבר'], ['Deuteronomy', 'דברים'],
];

export const SHNAYIM_MIKRA_PROGRESS_KEY = 'shnayim-mikra-progress-v1';

export function weeklyParashaForShnayimMikra(context = {}) {
  const parasha = context.parasha || null;
  const reading = context.shabbatReading || null;
  const festivalOverride = reading?.category === 'holiday';
  return {
    parasha,
    reference: parasha?.leyning?.torah || null,
    festivalOverride,
    festivalReading: festivalOverride ? reading : null,
  };
}

export function parseTorahRange(reference) {
  // Hebcal may append a maftir (";") or a special reading (", 30:11-16"). Shnayim Mikra
  // follows only the weekly Torah reading itself.
  const primaryReading = String(reference || '').split(/[;,]/)[0].trim();
  const match = primaryReading.match(/^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\s+(\d+):(\d+)-(?:([0-9]+):)?(\d+)$/);
  if (!match) return null;
  const [, book, startChapter, startVerse, specifiedEndChapter, endVerse] = match;
  return {
    book,
    hebrewBook: BOOKS.find(([english]) => english === book)?.[1] || book,
    startChapter: Number(startChapter),
    startVerse: Number(startVerse),
    endChapter: Number(specifiedEndChapter || startChapter),
    endVerse: Number(endVerse),
  };
}

export function verseReferences(range, chapterLengths = {}) {
  if (!range) return [];
  const refs = [];
  for (let chapter = range.startChapter; chapter <= range.endChapter; chapter += 1) {
    const first = chapter === range.startChapter ? range.startVerse : 1;
    const chapterEnd = Number(chapterLengths[chapter]);
    // A missing shape must not turn a continuous parasha into a chapter-sized
    // fragment. The caller retries after verified lengths are available.
    if (!Number.isInteger(chapterEnd) || chapterEnd < first) return [];
    const last = chapter === range.endChapter ? Math.min(range.endVerse, chapterEnd) : chapterEnd;
    if (chapter === range.endChapter && last !== range.endVerse) return [];
    for (let verse = first; verse <= last; verse += 1) refs.push(`${range.book} ${chapter}:${verse}`);
  }
  return refs;
}

export function onkelosReference(mikraReference) {
  return `Onkelos ${mikraReference}`;
}

export function parseVerseIdentity(reference) {
  const match = String(reference || '').match(/^(?:Onkelos )?(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\s+(\d+):(\d+)$/);
  if (!match) return null;
  const [, book, chapter, verse] = match;
  return { book, chapter: Number(chapter), verse: Number(verse), key: `${book}:${chapter}:${verse}` };
}

export function hasMatchingVerseIdentity(verse) {
  const expected = parseVerseIdentity(verse?.reference);
  const mikra = parseVerseIdentity(verse?.mikraReference || verse?.reference);
  const onkelos = parseVerseIdentity(verse?.onkelosReference || onkelosReference(verse?.reference));
  return Boolean(expected && mikra && onkelos && expected.key === mikra.key && expected.key === onkelos.key);
}

export function validateShnayimSequence(verses = [], expectedReferences = verses.map(verse => verse?.reference)) {
  if (verses.length !== expectedReferences.length) return { ok: false, reason: 'length' };
  for (let index = 0; index < expectedReferences.length; index += 1) {
    const expected = parseVerseIdentity(expectedReferences[index]);
    const verse = verses[index];
    if (!expected || !verse?.mikra || !verse?.onkelos || !hasMatchingVerseIdentity(verse)) return { ok: false, reason: 'identity', index };
    if (parseVerseIdentity(verse.reference)?.key !== expected.key) return { ok: false, reason: 'order', index };
  }
  return { ok: true, verseCount: expectedReferences.length };
}

export function validateShnayimParashaCatalog(chapterLengths) {
  const results = SHNAYIM_MIKRA_CANONICAL_RANGES.map(reading => {
    const references = verseReferences(parseTorahRange(reading.reference), chapterLengths[parseTorahRange(reading.reference)?.book]);
    return { ...reading, verseCount: references.length, valid: references.length > 0 };
  });
  return {
    results,
    parashaCount: results.filter(item => !item.combined).length,
    combinedCount: results.filter(item => item.combined).length,
    verseCount: results.reduce((total, item) => total + item.verseCount, 0),
    mismatches: results.filter(item => !item.valid),
  };
}

export function buildShnayimSequence(verses = [], expectedReferences) {
  if (!validateShnayimSequence(verses, expectedReferences).ok) return [];
  return verses.map((verse, index) => ({
    index,
    reference: verse.reference,
    identity: parseVerseIdentity(verse.reference),
    label: formatTanakhReference(verse.reference),
    blocks: [
      { type: 'mikra', text: verse.mikra, repeat: 1 },
      { type: 'mikra', text: verse.mikra, repeat: 2 },
      { type: 'targum', text: verse.onkelos, label: 'תרגום אונקלוס' },
    ],
  }));
}

export function shnayimProgressKey(parasha) {
  const date = parasha?.date?.slice?.(0, 10) || 'undated';
  const name = parasha?.hebrew || parasha?.title || 'unknown';
  return `${date}:${name}`;
}

// ---------- Parasha catalog on the verified local pack ----------
export const SHNAYIM_PROGRESS_V2 = 'shnayim-mikra-progress-v2';
export const SHNAYIM_PACK = SHNAYIM_INDEX;
const BOOK_HE = Object.fromEntries(BOOKS);
export const shnayimEdition = book => {
  const entry = SHNAYIM_INDEX.books.find(item => item.book === book);
  return entry ? { editionId: entry.editionId, packId: entry.packId, file: entry.file, checksum: entry.checksum } : null;
};
const lengthsFor = book => Object.fromEntries((SHNAYIM_INDEX.books.find(item => item.book === book)?.chapters || []).map((count, index) => [index + 1, count]));
const refToId = reference => reference.replace(/ (\d+):(\d+)$/, '.$1.$2');

export function shnayimParashot() {
  return SHNAYIM_MIKRA_CANONICAL_RANGES.map(reading => {
    const range = parseTorahRange(reading.reference);
    return { ...reading, range, bookHe: BOOK_HE[range.book], verseIds: verseReferences(range, lengthsFor(range.book)).map(refToId) };
  });
}
export const shnayimParashaById = id => shnayimParashot().find(item => item.id === id) || null;

// Hebcal's weekly reading → catalog entry, matched on the exact primary range (never by name guessing).
export function shnayimParashaForContext(context = {}) {
  const range = parseTorahRange(context.parasha?.leyning?.torah);
  if (!range) return null;
  const same = other => other.book === range.book && other.startChapter === range.startChapter && other.startVerse === range.startVerse && other.endChapter === range.endChapter && other.endVerse === range.endVerse;
  return shnayimParashot().find(item => same(item.range)) || null;
}

// Mikra, Mikra, Onkelos per verse, joined by canonical ID. Returns null if any verse is missing a source.
export function shnayimVerses(parasha, chunk) {
  const units = new Map(chunk.nodes.flatMap(node => node.units.map(unit => [unit.id, unit])));
  const verses = [];
  for (const id of parasha.verseIds) {
    const unit = units.get(id);
    if (!unit?.text || !unit?.targum) return null;
    const [, chapter, verse] = id.split('.').map(Number);
    verses.push({ id, chapter, verse, label: formatTanakhReference(`${parasha.range.book} ${chapter}:${verse}`), mikra: unit.text, targum: unit.targum, chapterStart: verse === 1 });
  }
  return verses;
}

// Validates every catalog parasha against the pack: first/last verse, no gaps, no duplicates,
// no early chapter jump, and Mikra/Onkelos present for the same canonical ID.
export function validateShnayimCatalog(chunks) {
  const mismatches = [];
  let verses = 0;
  const parashot = shnayimParashot();
  for (const parasha of parashot) {
    const { range, verseIds: ids } = parasha;
    const chapters = SHNAYIM_INDEX.books.find(item => item.book === range.book)?.chapters || [];
    const problem = (kind, detail) => mismatches.push({ parasha: parasha.id, kind, detail });
    if (!ids.length) { problem('empty-sequence'); continue; }
    if (ids[0] !== `${range.book}.${range.startChapter}.${range.startVerse}`) problem('first-verse', ids[0]);
    if (ids.at(-1) !== `${range.book}.${range.endChapter}.${range.endVerse}`) problem('last-verse', ids.at(-1));
    if (new Set(ids).size !== ids.length) problem('duplicate');
    for (let i = 1; i < ids.length; i += 1) {
      const [, pc, pv] = ids[i - 1].split('.').map(Number);
      const [, c, v] = ids[i].split('.').map(Number);
      const continues = (c === pc && v === pv + 1) || (c === pc + 1 && v === 1 && pv === chapters[pc - 1]);
      if (!continues) problem('gap-or-early-jump', `${ids[i - 1]} → ${ids[i]}`);
    }
    const chunk = chunks?.[range.book];
    if (chunk) {
      const units = new Map(chunk.nodes.flatMap(node => node.units.map(unit => [unit.id, unit])));
      for (const id of ids) {
        const unit = units.get(id);
        if (!unit) problem('missing-verse', id);
        else if (!unit.text?.trim()) problem('missing-mikra', id);
        else if (!unit.targum?.trim()) problem('missing-onkelos', id);
      }
    }
    verses += ids.length;
  }
  return { parashot: parashot.filter(item => !item.combined).length, combined: parashot.filter(item => item.combined).length, verses, mismatches };
}
