// דברי חכמים — one saying a day for בשבילי היום (and a quiet line on the לעצמי home), from data/divreiChachamim.mjs:
// exact passages of the library's bundled packs, and public-domain sayings gathered from the web (scripts/leatzmi/
// divrei-chachamim-web.mjs), each with its work, its place, its licence and attribution.
//
// The rotation needs no storage and never repeats soon: day k of the calendar shows saying (a·k + b) mod n, with a
// coprime to n — a fixed permutation, so every saying comes once before any comes again (n days apart), and the same
// day always shows the same saying, on every screen.
import { toMs } from './storage.mjs';

const DAY = 86_400_000;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
// A fixed multiplier (a large prime, reduced until coprime with n) spreads neighbouring days across the collection,
// so two consecutive days rarely come from the same book.
function multiplier(n) {
  let a = 7919 % n || 1;
  while (gcd(a, n) !== 1) a = (a + 1) % n || 1;
  return a;
}
/** The day number of a civil date key ("2026-10-01") — days since 1970-01-01. */
export const dayNumber = day => Math.floor(toMs(`${String(day).slice(0, 10)}T12:00:00Z`) / DAY);
/** The index of the day's saying among n. */
export function sayingIndexForDay(day, n) {
  if (!n) return -1;
  const k = dayNumber(day);
  return ((multiplier(n) * k + 37) % n + n) % n;
}

/** One saying, whole: { id, text, place, workId, title, group, license, licenseTitle, attribution, via, …, route }. */
export function sayingAt(data, index) {
  const row = data?.SAYINGS?.[index];
  if (!row) return null;
  const [id, workIndex, node, unit, place, text, provenanceUrl = null] = row;
  const work = data.WORKS[workIndex];
  const inLibrary = node != null && unit != null;
  return {
    id, text, place, node, unit,
    workId: work.workId, title: work.title, group: work.group, origin: work.origin || 'library',
    license: work.license, licenseTitle: work.licenseTitle, licenseUrl: work.licenseUrl, attribution: work.attribution,
    edition: work.edition, packId: work.packId, nonCommercial: work.nonCommercial,
    // Where the words were read: the library's edition through Sefaria, or (a saying gathered from the web) its source.
    via: work.via || 'דרך ספריא', provenanceUrl,
    // The library reader opens the work at the unit and marks it; a saying whose book the library lacks has no route.
    route: inLibrary ? `books/r/${encodeURIComponent(work.workId)}/${node}/${unit}` : null,
    source: `${work.title} · ${place}`,
  };
}
/** The day's saying (`day` a civil date key). */
export const sayingForDay = (data, day) => sayingAt(data, sayingIndexForDay(day, data?.SAYINGS?.length || 0));

export const loadDivreiChachamim = () => import('../../data/divreiChachamim.mjs');
