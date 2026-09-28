import { SHNAYIM_MIKRA_CANONICAL_RANGES } from '../data/shnayimMikraRanges.mjs';

// The weekly portions of a book of the Torah (single parashot, in order), each with its chapter:verse range.
export function parashotOf(workId) {
  return SHNAYIM_MIKRA_CANONICAL_RANGES.filter(item => !item.combined && item.reference.startsWith(`${workId} `)).map(item => {
    const match = /(\d+):(\d+)-(\d+):(\d+)$/.exec(item.reference);
    return match ? { id: item.id, title: `פרשת ${item.he}`, he: item.he, from: [Number(match[1]), Number(match[2])], to: [Number(match[3]), Number(match[4])] } : null;
  }).filter(Boolean);
}
