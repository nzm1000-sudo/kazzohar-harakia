// חק לישראל: which parasha and day to learn, the reader's routes, and its packs (one per parasha, checksum-verified).
// The week is named by its Shabbat and the day changes at sunset (the app's Jewish date, civilDate.jewishDateKey);
// the reading of that Shabbat comes from @hebcal/core's Sedra for Israel or the Diaspora, as everywhere in the app
// (services/weeklyParasha.mjs). On top of it, the edition's own rules (הקדמת החיד״א, אות ח׳) and the owner's decisions:
//   • a regular Shabbat → its parasha;
//   • two parashot read together → both, each day the portion of the first and then of the second (owner, 2026-10-01 —
//     the Chida, אות ז׳, writes to learn the first one only; recorded in docs/chok-leyisrael.md);
//   • a Shabbat whose reading is a festival's → the parasha read next (the one read at that Shabbat's Mincha, אות ח׳):
//     from the Shabbat of Rosh Hashana… until Simchat Torah that is וזאת הברכה (the only division the edition has for an
//     occasion), otherwise the next regular reading;
//   • Thursday night (from sunset until dawn) is ליל שישי; Friday from dawn is יום שישי; on Shabbat the week's Friday.
import { HDate, getSedra } from '@hebcal/core';
import CHOK from '../data/chokLeYisrael/manifest.mjs';
import { loadPackJson } from './library/packs.mjs';
import { shiftCivilDate } from '../civilDate.mjs';
import { calendarIsIsrael } from './calendarAccuracy.mjs';

export { CHOK };
export const CHOK_TITLE = 'חק לישראל';
export const CHOK_CREDIT = CHOK.credit;
export const CHOK_LICENSE = { title: CHOK.licenseTitle, url: CHOK.licenseUrl };

export const CHOK_DAYS = Object.freeze([
  { key: 'sun', he: 'יום ראשון', short: 'א׳' },
  { key: 'mon', he: 'יום שני', short: 'ב׳' },
  { key: 'tue', he: 'יום שלישי', short: 'ג׳' },
  { key: 'wed', he: 'יום רביעי', short: 'ד׳' },
  { key: 'thu', he: 'יום חמישי', short: 'ה׳' },
  { key: 'fri-night', he: 'ליל שישי', short: 'ליל ו׳' },
  { key: 'fri', he: 'יום שישי', short: 'ו׳' },
]);
export const CHOK_PARTS = Object.freeze({
  torah: 'תורה', neviim: 'נביאים', ketuvim: 'כתובים', haftarah: 'הפטרה', mishnah: 'משנה', gemara: 'גמרא', zohar: 'זוהר', halacha: 'הלכה', mussar: 'מוסר',
});
// The edition's prayers before each kind of learning (in the introduction of Maharchu), by part.
export const CHOK_PRAYERS = Object.freeze({
  torah: 'תפלה לאומרה קודם קריאת התורה',
  neviim: 'תפלה לאומרה קודם קריאת נביאים',
  haftarah: 'תפלה לאומרה קודם קריאת נביאים',
  ketuvim: 'תפלה לאומרה קודם קריאת כתובים',
  mishnah: 'תפלה לאומרה קודם לימוד משנה',
  halacha: 'תפלה לאומרה קודם לימוד הלכה',
  zohar: 'תפלה לאומרה קודם לימוד קבלה',
});

const BY_ID = new Map(CHOK.parashot.map((parasha, index) => [parasha.id, { ...parasha, index }]));
export const chokParasha = id => BY_ID.get(id) || null;
export const dayDef = key => CHOK_DAYS.find(day => day.key === key) || null;

// ---------- The week and the day ----------
const idOf = name => String(name || '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, '-');
const hdateOf = dateKey => { const [y, m, d] = dateKey.split('-').map(Number); return new HDate(new Date(y, m - 1, d)); };
const weekdayOf = dateKey => new Date(`${dateKey}T12:00:00Z`).getUTCDay();
const shabbatOf = dateKey => shiftCivilDate(dateKey, (6 - weekdayOf(dateKey) + 7) % 7);
function sedraOn(shabbatKey, il) {
  const hd = hdateOf(shabbatKey);
  try { return { hd, found: getSedra(hd.getFullYear(), Boolean(il)).lookup(hd) }; } catch { return { hd, found: null }; }
}

/** The parashot of the week of `dateKey` (a Jewish date key, YYYY-MM-DD) → { ids, shabbatKey, kind, festival } or null.
 *  kind: 'parasha' | 'combined' | 'next' (a festival's Shabbat: the reading after it) | 'vezot' (וזאת הברכה). */
export function chokWeekOf(dateKey, il = true) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
  const shabbatKey = shabbatOf(dateKey);
  const { hd, found } = sedraOn(shabbatKey, il);
  if (!found?.parsha?.length) return null;
  const idsOf = parsha => parsha.map(idOf).filter(id => BY_ID.has(id));
  if (!found.chag) {
    const ids = idsOf(found.parsha);
    if (!ids.length) return null;
    return { ids, shabbatKey, kind: ids.length > 1 ? 'combined' : 'parasha', festival: null };
  }
  const festival = found.parsha.join(' ');
  for (let week = 1; week <= 4; week += 1) {
    const next = sedraOn(shiftCivilDate(shabbatKey, week * 7), il).found;
    if (!next?.parsha?.length || next.chag) continue;
    const ids = idsOf(next.parsha);
    if (!ids.length) return null;
    // Before Simchat Torah the reading after the festival is וזאת הברכה (read on Simchat Torah), then בראשית.
    if (ids[0] === 'bereshit' && hd.getMonth() === 7) return { ids: ['vezot-haberakhah'], shabbatKey, kind: 'vezot', festival };
    return { ids, shabbatKey, kind: 'next', festival };
  }
  return null;
}

/** The edition's day for a Jewish date: weekday 0–4 → sun…thu; Friday → ליל שישי while it is night (from Thursday's
 *  sunset until Friday's dawn), else יום שישי; Shabbat → the week's Friday (shabbat: true). */
export function chokDayKey(dateKey, { night = false } = {}) {
  const weekday = weekdayOf(dateKey);
  if (weekday === 6) return { key: 'fri', shabbat: true };
  if (weekday === 5) return { key: night ? 'fri-night' : 'fri', shabbat: false };
  return { key: CHOK_DAYS[weekday].key, shabbat: false };
}

/** Today's learning from the app's day context: { ids, day, shabbat, week }.
 *  `context.key` is the Jewish date (sunset-aware); before dawn on Friday it is still ליל שישי. */
export function chokToday({ context, times, now = new Date(), il = true }) {
  const key = context?.key || context?.civil || null;
  if (!key) return null;
  const week = chokWeekOf(key, il);
  if (!week) return null;
  const dawn = times?.alotHaShachar ? new Date(times.alotHaShachar) : null;
  const beforeDawn = Boolean(dawn && Number.isFinite(dawn.getTime()) && new Date(now) < dawn && context?.civil === key);
  const night = Boolean(context?.afterSunset) || beforeDawn;
  const { key: day, shabbat } = chokDayKey(key, { night });
  return { ids: week.ids, day, shabbat, week };
}

// The Siddur home's card: today's parasha and day under the name ("וזאת הברכה · יום חמישי").
export function chokTileNote({ context, times, now, settings }) {
  const today = chokToday({ context, times, now: now || new Date(), il: calendarIsIsrael(settings || {}) });
  return today ? `${today.ids.map(id => BY_ID.get(id).he).join(' ו')} · ${dayDef(today.day).he}` : null;
}

// ---------- Routes ----------
// chok-leyisrael                         today (opens on the day itself)
// chok-leyisrael/d/<id>[+<id>]/<day>[/<part>]   a day of one parasha (or of two read together)
// chok-leyisrael/intro[/<n>]             the introductions (and the prayers before learning)
// chok-leyisrael/all                     every parasha
export const chokRoute = {
  home: () => 'chok-leyisrael',
  day: (ids, day, part) => `chok-leyisrael/d/${ids.join('+')}/${day}${part ? `/${part}` : ''}`,
  intro: anchor => `chok-leyisrael/intro${anchor ? `/${encodeURIComponent(anchor)}` : ''}`,
  all: () => 'chok-leyisrael/all',
};
export function parseChokRoute(route) {
  const parts = String(route || '').split('/');
  if (parts[0] !== 'chok-leyisrael') return null;
  if (parts[1] === 'd' && parts[2] && parts[3]) {
    const ids = parts[2].split('+').filter(id => BY_ID.has(id));
    if (!ids.length || !dayDef(parts[3])) return { view: 'missing' };
    return { view: 'day', ids, day: parts[3], part: parts[4] && CHOK_PARTS[parts[4]] ? parts[4] : null };
  }
  if (parts[1] === 'intro') return { view: 'intro', anchor: parts[2] ? decodeURIComponent(parts[2]) : null };
  if (parts[1] === 'all') return { view: 'all' };
  if (parts.length === 1) return { view: 'today' };
  return { view: 'missing' };
}

// ---------- Titles and neighbours ----------
export const parashotTitle = ids => (ids.length > 1 ? `פרשות ${ids.map(id => BY_ID.get(id).he).join(' ו')}` : `פרשת ${BY_ID.get(ids[0]).he}`);
export const dayTitle = (ids, day) => `${parashotTitle(ids)} · ${dayDef(day).he}`;

// The day before / after: within the week the edition's order (… ה׳, ליל ו׳, ו׳); after Friday the next parasha's Sunday
// (after the second of two read together), before Sunday the previous parasha's Friday. The cycle closes (וזאת הברכה → בראשית).
export function chokNeighbours(ids, day) {
  const at = CHOK_DAYS.findIndex(item => item.key === day);
  const count = CHOK.parashot.length;
  const step = (targetIds, targetDay) => ({ ids: targetIds, day: targetDay, title: dayTitle(targetIds, targetDay), route: chokRoute.day(targetIds, targetDay) });
  const first = BY_ID.get(ids[0]).index;
  const last = BY_ID.get(ids[ids.length - 1]).index;
  const previous = at > 0 ? step(ids, CHOK_DAYS[at - 1].key) : step([CHOK.parashot[(first - 1 + count) % count].id], 'fri');
  const next = at < CHOK_DAYS.length - 1 ? step(ids, CHOK_DAYS[at + 1].key) : step([CHOK.parashot[(last + 1) % count].id], 'sun');
  return { previous, next };
}

// The parts of a day, in order, over every parasha of the group (two read together: the union, in the edition's order).
const PART_ORDER = Object.keys(CHOK_PARTS);
export function partsOfDay(ids, day) {
  const keys = new Set(ids.flatMap(id => (BY_ID.get(id).days.find(([key]) => key === day)?.[1]) || []));
  return PART_ORDER.filter(key => keys.has(key));
}

// ---------- Packs ----------
export const loadChokParasha = (id, options) => {
  const parasha = BY_ID.get(id);
  if (!parasha) return Promise.reject(new Error('הפרשה אינה בחק לישראל.'));
  return loadPackJson({ packId: CHOK.packId, file: parasha.file, checksum: parasha.checksum }, options);
};
export const loadChokIntro = options => loadPackJson({ packId: CHOK.packId, file: CHOK.intro.file, checksum: CHOK.intro.checksum }, options);

// Web: once the reader is open, this week's packs (and the next week's) are fetched in idle time, so the service worker
// keeps them for reading without a network. The installed app carries every pack in its bundle and fetches nothing.
export function warmChokWeek(ids) {
  const order = CHOK.parashot.map(parasha => parasha.id);
  const last = order.indexOf(ids[ids.length - 1]);
  const targets = [...ids, order[(last + 1) % order.length], 'intro'];
  return Promise.allSettled(targets.map(id => (id === 'intro' ? loadChokIntro() : loadChokParasha(id))));
}

// Inline text of the packs: the edition's <b> and <small>, and line breaks. → [{ text, bold, small }] and '\n' breaks.
export function inlineRuns(text) {
  const runs = [];
  let bold = 0;
  let small = 0;
  for (const piece of String(text || '').split(/(<\/?b>|<\/?small>|\n)/)) {
    if (!piece) continue;
    if (piece === '<b>') bold += 1;
    else if (piece === '</b>') bold = Math.max(0, bold - 1);
    else if (piece === '<small>') small += 1;
    else if (piece === '</small>') small = Math.max(0, small - 1);
    else if (piece === '\n') runs.push({ br: true });
    else runs.push({ text: piece, bold: bold > 0, small: small > 0 });
  }
  return runs;
}

// The edition writes gershayim as two apostrophes; its headings are shown with ״ / ׳ (presentation only).
export const displayHeading = text => String(text || '').replace(/''/g, '״').replace(/(?<=[א-ת])'(?=\s|$)/g, '׳');
