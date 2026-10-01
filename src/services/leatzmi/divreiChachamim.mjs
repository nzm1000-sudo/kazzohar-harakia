// דברי חכמים — one saying a day for בשבילי היום, and a new one every two hours on the לעצמי home, from data/divreiChachamim.mjs:
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

// ---- every two hours: the saying of the לעצמי home ----
// The day is cut into twelve two-hour slots of local time (00–02, 02–04, …); slot k since 1970 shows saying
// (a·k + b) mod m among the candidates — the same fixed permutation idea as the day's saying, so every saying comes
// once before any comes again, neighbouring slots come from different books more often than not, and the same slot
// shows the same saying on every screen. No storage. A screen left open turns to the next saying at the slot's end.
export const SAYING_SLOT_MS = 2 * 3_600_000;
const letterCount = text => String(text || '').replace(/[\u0591-\u05C7]/g, '').length;
/** Milliseconds of `at` read as a wall clock in `tzid` (the device's zone when none or unknown). */
export function localWallMs(at = Date.now(), tzid = null) {
  const t = at instanceof Date ? at.getTime() : Number(at);
  if (tzid) {
    try {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tzid, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(t)).map(part => [part.type, part.value]));
      return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second) + (t % 1000 + 1000) % 1000;
    } catch { /* an unknown zone: the device's clock */ }
  }
  return t - new Date(t).getTimezoneOffset() * 60_000;
}
/** The two-hour slot of local time that `at` falls in (slots since 1970-01-01 00:00 local). */
export const sayingSlotAt = (at = Date.now(), tzid = null) => Math.floor(localWallMs(at, tzid) / SAYING_SLOT_MS);
/** How long until the next slot begins (at least one second). */
export function msUntilNextSayingSlot(at = Date.now(), tzid = null) {
  const wall = localWallMs(at, tzid);
  return Math.max(1000, (Math.floor(wall / SAYING_SLOT_MS) + 1) * SAYING_SLOT_MS - wall);
}
/** The index (into SAYINGS) of slot `slot`'s saying, among those of at most `maxLetters` letters (nikud not counted). */
export function sayingIndexForSlot(data, slot, { maxLetters = Infinity } = {}) {
  const rows = data?.SAYINGS || [];
  const candidates = [];
  rows.forEach((row, index) => { if (letterCount(row[5]) <= maxLetters) candidates.push(index); });
  const m = candidates.length;
  if (!m) return -1;
  return candidates[((multiplier(m) * slot + 53) % m + m) % m];
}
/** The saying for the two-hour slot of `at`: { …sayingAt, slot, until } (until: when the next one comes, ms). */
export function sayingForSlot(data, at = Date.now(), { tzid = null, maxLetters = Infinity } = {}) {
  const slot = sayingSlotAt(at, tzid);
  const saying = sayingAt(data, sayingIndexForSlot(data, slot, { maxLetters }));
  const t = at instanceof Date ? at.getTime() : Number(at);
  return saying ? { ...saying, slot, until: t + msUntilNextSayingSlot(t, tzid) } : null;
}

export const loadDivreiChachamim = () => import('../../data/divreiChachamim.mjs');
