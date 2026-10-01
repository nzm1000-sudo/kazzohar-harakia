// The parasha of the week, on the device (no network): the weekly reading of the coming Shabbat from @hebcal/core's
// Sedra (Israel or the Diaspora), as an id of the Shnayim Mikra catalog (data/shnayimMikraRanges.mjs), and its seven
// aliyot (data/torahAliyot.mjs, from @hebcal/leyning). A Shabbat whose reading is a festival's has no parasha of its
// own: the week then prepares the next regular parasha — the one read next in the synagogue.
import { HDate, getSedra } from '@hebcal/core';
import { SHNAYIM_MIKRA_CANONICAL_RANGES } from '../data/shnayimMikraRanges.mjs';
import { TORAH_ALIYOT } from '../data/torahAliyot.mjs';
import { shiftCivilDate } from '../civilDate.mjs';

const idOf = name => String(name || '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, '-');
const BY_ID = new Map(SHNAYIM_MIKRA_CANONICAL_RANGES.map(reading => [reading.id, reading]));
const weekdayOf = dateKey => new Date(`${dateKey}T12:00:00Z`).getUTCDay();
const hdateOf = dateKey => { const [y, m, d] = dateKey.split('-').map(Number); return new HDate(new Date(y, m - 1, d)); };

// The civil date of the Shabbat that ends the week of a civil date (a Shabbat is its own week's end).
export const shabbatOfWeek = dateKey => shiftCivilDate(dateKey, (6 - weekdayOf(dateKey) + 7) % 7);

/** The catalog reading of the week of `dateKey` → { id, he, reference, combined, shabbatKey, festival } or null. */
export function parashaOfWeek(dateKey, il = true) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
  const first = shabbatOfWeek(dateKey);
  for (let week = 0; week < 4; week += 1) {
    const shabbatKey = shiftCivilDate(first, week * 7);
    const hd = hdateOf(shabbatKey);
    let found = null;
    try { found = getSedra(hd.getFullYear(), Boolean(il)).lookup(hd); } catch { found = null; }
    if (!found || found.chag || !found.parsha?.length) continue;
    const reading = BY_ID.get(idOf(found.parsha.join('-')));
    if (reading) return { ...reading, shabbatKey, festival: week > 0 };
  }
  return null;
}

export const aliyotOf = parashaId => TORAH_ALIYOT[parashaId] || null;

// Sunday → the first aliya … Thursday → the fifth, Friday → the sixth and the seventh; none on Shabbat.
export function aliyotForWeekday(weekday) {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 5) return [];
  return weekday === 5 ? [6, 7] : [weekday + 1];
}

export const ALIYA_NAMES = Object.freeze(['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי']);

// The verse id ("Genesis.2.4") where an aliya begins, for the reader's anchor.
export function aliyaStartId(parashaId, aliya) {
  const reading = BY_ID.get(parashaId);
  const range = aliyotOf(parashaId)?.[aliya - 1];
  if (!reading || !range) return null;
  const [chapter, verse] = range[0].split(':');
  return `${reading.reference.split(' ')[0]}.${chapter}.${verse}`;
}
