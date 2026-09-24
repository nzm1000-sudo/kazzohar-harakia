import { formatTanakhReference } from './tanakhReferences.mjs';

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
  const match = String(reference || '').match(/^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\s+(\d+):(\d+)-(\d+):(\d+)$/);
  if (!match) return null;
  const [, book, startChapter, startVerse, endChapter, endVerse] = match;
  return {
    book,
    hebrewBook: BOOKS.find(([english]) => english === book)?.[1] || book,
    startChapter: Number(startChapter),
    startVerse: Number(startVerse),
    endChapter: Number(endChapter),
    endVerse: Number(endVerse),
  };
}

export function verseReferences(range, chapterLengths = {}) {
  if (!range) return [];
  const refs = [];
  for (let chapter = range.startChapter; chapter <= range.endChapter; chapter += 1) {
    const first = chapter === range.startChapter ? range.startVerse : 1;
    const chapterEnd = Number(chapterLengths[chapter]) || (chapter === range.endChapter ? range.endVerse : first);
    const last = chapter === range.endChapter ? Math.min(range.endVerse, chapterEnd) : chapterEnd;
    for (let verse = first; verse <= last; verse += 1) refs.push(`${range.book} ${chapter}:${verse}`);
  }
  return refs;
}

export function onkelosReference(mikraReference) {
  return `Onkelos ${mikraReference}`;
}

export function buildShnayimSequence(verses = []) {
  return verses.filter(verse => verse?.mikra && verse?.onkelos).map((verse, index) => ({
    index,
    reference: verse.reference,
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
