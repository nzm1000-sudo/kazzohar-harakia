// The parasha of the week, on the device (no network): the weekly reading of the coming Shabbat from @hebcal/core's
// Sedra (Israel or the Diaspora), as an id of the Shnayim Mikra catalog (data/shnayimMikraRanges.mjs), and its seven
// aliyot (data/torahAliyot.mjs, from @hebcal/leyning). A Shabbat whose reading is a festival's has no parasha of its
// own: the week then prepares the next regular parasha — the one read next in the synagogue.
import { HDate, Locale, ParshaEvent, getSedra } from '@hebcal/core';
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

// What is READ on the coming Shabbat — the one label of "this week's reading" for the whole app (Today, the Shabbat
// pages, the calendar context, the widget snapshot). From Sunday (the Jewish day, so from the sunset that ends
// Shabbat) until Shabbat itself: the reading of that Shabbat, from @hebcal/core's Sedra for Israel or the Diaspora.
//   • A regular Shabbat → its parasha ("פרשת בראשית", "פרשת ויקהל-פקודי").
//   • A festival Shabbat → the festival ("שבת חול המועד פסח", "שמיני עצרת", "יום כיפור"), never the next parasha —
//     that one belongs to the week after, from Motzaei Shabbat.
//   • Shemini Atzeret in Eretz Yisrael is Simchat Torah, the day וזאת הברכה is read (Megillah 31a; Hebcal's leyning
//     reads "Simchat Torah" on Israel's Shmini Atzeret) → "פרשת וזאת הברכה". Abroad Simchat Torah is the Sunday after,
//     so that Shabbat is "שמיני עצרת".
// → { kind: 'parasha' | 'festival', name, label, shabbatKey, festival } or null. `festival` is Hebcal's name of the
//   festival that Shabbat, when there is one (also when the reading is וזאת הברכה).
const READ_ON_FESTIVAL = Object.freeze({ il: Object.freeze({ 'Shmini Atzeret': 'Vezot Haberakhah' }), diaspora: Object.freeze({}) });
const he = name => Locale.gettext(name, 'he-x-NoNikud');
export function weekReadingOf(dateKey, il = true) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
  const shabbatKey = shabbatOfWeek(dateKey);
  const hd = hdateOf(shabbatKey);
  let found = null;
  try { found = getSedra(hd.getFullYear(), Boolean(il)).lookup(hd); } catch { found = null; }
  if (!found?.parsha?.length) return null;
  if (!found.chag) {
    const label = new ParshaEvent(found).render('he-x-NoNikud');
    return { kind: 'parasha', name: label.replace(/^פרשת\s+/, ''), label, shabbatKey, festival: null };
  }
  const festival = found.parsha.join(' ');
  const parasha = READ_ON_FESTIVAL[il ? 'il' : 'diaspora'][festival];
  if (parasha) return { kind: 'parasha', name: he(parasha), label: `פרשת ${he(parasha)}`, shabbatKey, festival };
  return { kind: 'festival', name: he(festival), label: he(festival), shabbatKey, festival };
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
