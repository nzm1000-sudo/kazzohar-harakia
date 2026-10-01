// לימוד יומי — the recognised daily cycles, computed on the device for a civil date (no network, deterministic):
//   • דף יומי (Bavli) · רמב״ם יומי (3 chapters and 1 chapter) · משנה יומית — the schedules of @hebcal/learning
//     (BSD-2-Clause; the library behind hebcal.com), checked in tests against known dates and Sefaria's calendar.
//   • הלכה יומית — the app's own daily halacha (services/halachaContext.mjs pickDailyHalacha), held stable for the day.
//   • חק לישראל — the Torat Emet edition in the app's own reader (services/chokLeYisrael.mjs): the week's parasha and
//     the edition's day by its own rules (ליל שישי from Thursday's sunset until Friday's dawn, on Shabbat the Friday,
//     two parashot read together → both, a festival's Shabbat → the parasha read next), for Israel or the Diaspora.
// Every portion opens in the app's own reader (Talmud reader, the library's offline packs, the Halacha question page);
// a portion whose text is not in the offline library says so and names the online reference instead of guessing.
import { DafYomi } from '@hebcal/learning/dafYomiBase';
import { dailyRambam1 } from '@hebcal/learning/rambam1Base';
import { dailyRambam3 } from '@hebcal/learning/rambam3Base';
import { MishnaYomiIndex } from '@hebcal/learning/mishnaYomiBase';
import { findTractate } from './talmud.mjs';
import { hasLocalTalmud } from './talmudLocal.mjs';
import { hebrewNumeral } from './hebrewNumerals.mjs';
import { WORKS, workById } from '../data/library/registry.mjs';
import { pickDailyHalacha } from './halachaContext.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../data/practicalHalachaQa.mjs';
import { getJewishDateKey, hasRecordedToday, recordStudyCompletion, studyUnitSourceId } from './mitzvotJournal.mjs';
import { CHOK_TITLE, chokParasha, chokRoute, chokToday, dayDef, dayTitle } from './chokLeYisrael.mjs';

export const DAILY_LEARNING_SOURCE = 'daily-learning';

export const DAILY_TRACKS = Object.freeze([
  { id: 'daf-yomi', title: 'דף יומי', short: 'דף יומי', about: 'תלמוד בבלי · דף אחד בכל יום, כל הש״ס בשבע שנים וחצי' },
  { id: 'rambam-3', title: 'רמב״ם יומי · שלושה פרקים', short: 'רמב״ם · ג׳ פרקים', about: 'משנה תורה לרמב״ם · שלושה פרקים ביום, כל החיבור בשנה' },
  { id: 'rambam-1', title: 'רמב״ם יומי · פרק אחד', short: 'רמב״ם · פרק אחד', about: 'משנה תורה לרמב״ם · פרק אחד ביום, כל החיבור בכשלוש שנים' },
  { id: 'mishna-yomit', title: 'משנה יומית', short: 'משנה יומית', about: 'שתי משניות בכל יום, כל ששת סדרי משנה בכשש שנים' },
  { id: 'halacha-yomit', title: 'הלכה יומית', short: 'הלכה יומית', about: 'הלכה מעשית מאומתת מתוך מאגר ההלכה של האפליקציה' },
  { id: 'chok-leyisrael', title: CHOK_TITLE, short: CHOK_TITLE, about: 'תורה, נביאים, כתובים, משנה, גמרא, זוהר, הלכה ומוסר לכל יום לפי פרשת השבוע (סדר החיד״א)' },
]);

// A cycle that is named but not yet computed would be listed here with its reason (never an invented schedule).
// חק לישראל was here until its full edition entered the app (2026-10-01); none is pending now.
export const PENDING_TRACKS = Object.freeze([]);

// Hebcal's transliterations → the app's (Sefaria's) tractate titles.
const BAVLI_ALIASES = { Berachot: 'Berakhot', 'Rosh Hashana': 'Rosh Hashanah', Gitin: 'Gittin', 'Baba Kamma': 'Bava Kamma', 'Baba Metzia': 'Bava Metzia', 'Baba Batra': 'Bava Batra', Bechorot: 'Bekhorot', Arachin: 'Arakhin', Midot: 'Middot' };
// Tractates of the Daf Yomi that are Mishnah only in the Bavli (or Yerushalmi): opened in the offline Mishnah.
const MISHNAH_ONLY = { Kinnim: { workId: 'Mishnah_Kinnim', he: 'קינים' }, Middot: { workId: 'Mishnah_Middot', he: 'מדות' } };

// Sections of the Mishneh Torah the offline pack does not carry (Hebrew names as in the printed editions).
const RAMBAM_HE = {
  'Transmission of the Oral Law': 'הקדמת הרמב״ם · מסירת תורה שבעל פה',
  'Positive Mitzvot': 'מניין המצוות · מצוות עשה',
  'Negative Mitzvot': 'מניין המצוות · מצוות לא תעשה',
  'Overview of Mishneh Torah Contents': 'תוכן החיבור',
  'Tefillin, Mezuzah and the Torah Scroll': 'הלכות תפילין ומזוזה וספר תורה',
  Fringes: 'הלכות ציצית',
  Blessings: 'הלכות ברכות',
  Circumcision: 'הלכות מילה',
  'The Order of Prayer': 'סדר התפילות',
};

const slug = name => String(name).replace(/['’]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
// Sefaria's work ids keep one "_" per character ("Shofar,_Sukkah" → "Shofar__Sukkah"); Hebcal's names differ in case
// ("Those who" / "Those_Who"), so the lookup is case-insensitive over the library's Mishneh Torah works.
let rambamIndex = null;
function rambamWork(name) {
  rambamIndex ||= new Map(WORKS.filter(work => work.workId.startsWith('Mishneh_Torah__')).map(work => [work.workId.toLowerCase(), work]));
  const id = `Mishneh_Torah__${String(name).replace(/['’]/g, '').replace(/[^A-Za-z0-9]/g, '_')}`.toLowerCase();
  return rambamIndex.get(id) || null;
}
const rambamTitle = (name, work) => (work ? work.title.replace(/^משנה תורה,\s*/, '') : RAMBAM_HE[name] || name);

// A civil date key ("2026-09-30") as a local noon Date — the calendar day, whatever the device's timezone.
export function civilNoon(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12);
}

const libraryRead = (workId, node, unit) => `books/r/${encodeURIComponent(workId)}/${node}${unit ? `/${unit}` : ''}`;
const talmudAmud = (tractate, amud) => `talmud/${encodeURIComponent(tractate.title)}/${amud}`;
const nodeCount = work => work?.editions?.[0]?.nodes?.length || 0;

export function dafYomiPortion(date) {
  let daf;
  try { daf = new DafYomi(date); } catch { return null; }
  const raw = daf.getName();
  const blatt = Number(daf.getBlatt());
  const name = BAVLI_ALIASES[raw] || raw;
  const base = { trackId: 'daf-yomi', unitId: `${name} ${blatt}` };
  const mishnah = MISHNAH_ONLY[name];
  if (mishnah) {
    const work = workById(mishnah.workId);
    return { ...base, label: `${mishnah.he} ${hebrewNumeral(blatt)}`, parts: [{ label: `${mishnah.he} ${hebrewNumeral(blatt)}`, route: work ? `books/w/${encodeURIComponent(mishnah.workId)}` : null, offline: Boolean(work), note: 'מסכת זו היא משנה בלבד; נפתחת במשנה שבמכשיר.' }] };
  }
  if (name === 'Shekalim') {
    const label = `שקלים ${hebrewNumeral(blatt)}`;
    return { ...base, label, parts: [{ label: `${label} · תלמוד ירושלמי`, route: null, offline: false, sefariaRef: `Jerusalem Talmud Shekalim`, note: 'מסכת שקלים במחזור הדף היומי היא מן התלמוד הירושלמי, שאינו בקורא הבבלי שבמכשיר.' }] };
  }
  const tractate = findTractate(name);
  if (!tractate) return { ...base, label: `${name} ${blatt}`, parts: [{ label: `${name} ${blatt}`, route: null, offline: false, note: 'המסכת אינה בקטלוג הבבלי.' }] };
  const label = `${tractate.heTitle} ${hebrewNumeral(blatt)}`;
  return { ...base, label, tractate: tractate.title, daf: blatt, parts: [{ label, route: talmudAmud(tractate, `${blatt}a`), offline: hasLocalTalmud(tractate.title), note: hasLocalTalmud(tractate.title) ? 'הגמרא, רש״י ותוספות במכשיר' : 'נטען מספריא' }] };
}

// Consecutive chapters of one section become one part ("הלכות מקואות ה׳–ז׳").
function rambamParts(readings) {
  const groups = [];
  for (const reading of readings) {
    const last = groups[groups.length - 1];
    if (last && last.name === reading.name) last.perakim.push(reading.perek);
    else groups.push({ name: reading.name, perakim: [reading.perek] });
  }
  return groups.map(group => {
    const work = rambamWork(group.name);
    const first = Number.parseInt(String(group.perakim[0]), 10);
    const lastRaw = String(group.perakim[group.perakim.length - 1]);
    const last = Number.parseInt(lastRaw.split('-').pop(), 10);
    const range = first === last ? hebrewNumeral(first) : `${hebrewNumeral(first)}–${hebrewNumeral(last)}`;
    const title = rambamTitle(group.name, work);
    const available = Boolean(work) && first <= nodeCount(work);
    return {
      label: `${title} ${range}`,
      route: available ? libraryRead(work.workId, first) : null,
      offline: available,
      sefariaRef: `Mishneh Torah, ${group.name} ${first}${last !== first ? `-${last}` : ''}`,
      note: available ? (last > nodeCount(work) ? 'חלק מהפרקים אינו בספרייה שבמכשיר' : 'במכשיר · ללא אינטרנט') : 'טרם נכלל בספרייה שבמכשיר · נפתח מספריא כשיש רשת',
    };
  });
}

export function rambamPortion(date, chapters = 3) {
  let readings;
  try { readings = chapters === 1 ? [dailyRambam1(date)] : dailyRambam3(date); } catch { return null; }
  const parts = rambamParts(readings);
  return { trackId: chapters === 1 ? 'rambam-1' : 'rambam-3', unitId: readings.map(item => `${item.name} ${item.perek}`).join(' | '), label: parts.map(part => part.label).join(' · '), parts };
}

let mishnaIndex = null;
export function mishnaYomitPortion(date) {
  let items;
  try { mishnaIndex ||= new MishnaYomiIndex(); items = mishnaIndex.lookup(date); } catch { return null; }
  if (!items?.length) return null;
  const groups = [];
  for (const item of items) {
    const [chapter, mishnah] = String(item.v).split(':').map(Number);
    const last = groups[groups.length - 1];
    if (last && last.k === item.k && last.chapter === chapter) last.mishnayot.push(mishnah);
    else groups.push({ k: item.k, chapter, mishnayot: [mishnah] });
  }
  const parts = groups.map(group => {
    const workId = group.k === 'Avot' ? 'Pirkei_Avot' : `Mishnah_${slug(group.k)}`;
    const work = workById(workId);
    const he = work ? work.title.replace(/^משנה\s+/, '') : group.k;
    const first = group.mishnayot[0];
    const last = group.mishnayot[group.mishnayot.length - 1];
    const label = `${he} ${hebrewNumeral(group.chapter)}, ${first === last ? hebrewNumeral(first) : `${hebrewNumeral(first)}–${hebrewNumeral(last)}`}`;
    return { label, route: work ? libraryRead(workId, group.chapter, first) : null, offline: Boolean(work), sefariaRef: `Mishnah ${group.k} ${group.chapter}:${first}${last !== first ? `-${last}` : ''}`, note: work ? 'במכשיר · ללא אינטרנט' : 'טרם נכלל בספרייה שבמכשיר' };
  });
  return { trackId: 'mishna-yomit', unitId: items.map(item => `${item.k} ${item.v}`).join(' | '), label: parts.map(part => part.label).join(' · '), parts };
}

// The app's daily halacha, one per Jewish day: the first pick of the day is kept, so every screen that shows
// "הלכה יומית" shows the same one (pickDailyHalacha rotates on each call).
const HALACHA_PICK_KEY = 'kz-daily-halacha-pick-v1';
export function stableDailyHalacha(context = {}, { storage = globalThis.localStorage, pick = pickDailyHalacha } = {}) {
  const day = context?.key || context?.civil || null;
  let saved = null;
  try { saved = JSON.parse(storage?.getItem(HALACHA_PICK_KEY) || 'null'); } catch { saved = null; }
  const known = saved?.entry?.id ? PRACTICAL_HALACHA_QA_INDEX[saved.entry.id] : null;
  // The kept pick, re-read from the verified pool (a pick no longer published is replaced, never shown stale).
  if (day && saved?.day === day && known?.answerStatus === 'published' && !known.highStakes) return { ...known, ...saved.entry };
  const entry = pick(context, { storage });
  if (!entry) return null;
  const kept = { id: entry.id, question: entry.question, shortAnswer: entry.shortAnswer, topic: entry.topic, contextTag: entry.contextTag || null, requestedTag: entry.requestedTag || null, fallback: Boolean(entry.fallback) };
  try { if (day) storage?.setItem(HALACHA_PICK_KEY, JSON.stringify({ day, entry: kept })); } catch { /* storage unavailable */ }
  return { ...entry, ...kept };
}

export function halachaYomitPortion(context, options) {
  const entry = stableDailyHalacha(context, options);
  if (!entry) return null;
  return { trackId: 'halacha-yomit', unitId: entry.id, halachaId: entry.id, label: entry.question, parts: [{ label: entry.question, route: `halacha/q/${encodeURIComponent(entry.id)}`, offline: true, note: 'תשובה מאומתת · במכשיר' }] };
}

// חק לישראל of the day, by the edition's own day (services/chokLeYisrael.mjs chokToday): its day turns with the app's
// Jewish date (sunset), Thursday night until Friday's dawn is ליל שישי, on Shabbat the week's Friday. `times` are the
// app's zmanim (their alotHaShachar is Friday's dawn); `il` — the Israel or Diaspora reading.
export function chokPortion(context = {}, { times = null, now = new Date(), il = true } = {}) {
  let today = null;
  try { today = chokToday({ context, times, now, il }); } catch { today = null; }
  if (!today) return null;
  const label = dayTitle(today.ids, today.day);
  return {
    trackId: 'chok-leyisrael',
    unitId: `${today.ids.join('+')}/${today.day}`,
    ids: today.ids,
    day: today.day,
    shabbat: today.shabbat,
    label,
    // Under the cycle's name (Today's row): "וזאת הברכה · ליל שישי".
    shortLabel: `${today.ids.map(id => chokParasha(id).he).join(' ו')} · ${dayDef(today.day).he}`,
    parts: [{ label, route: chokRoute.day(today.ids, today.day), offline: true, note: today.shabbat ? 'בשבת — הלימוד של יום שישי · במכשיר' : 'במכשיר · ללא אינטרנט' }],
  };
}

const PORTION_OF = {
  'daf-yomi': (context, date) => dafYomiPortion(date),
  'rambam-3': (context, date) => rambamPortion(date, 3),
  'rambam-1': (context, date) => rambamPortion(date, 1),
  'mishna-yomit': (context, date) => mishnaYomitPortion(date),
  'halacha-yomit': (context, date, options) => halachaYomitPortion(context, options),
  'chok-leyisrael': (context, date, options) => chokPortion(context, options),
};

// Today's portions of every track (or of `options.only`, a list of track ids), in the order of DAILY_TRACKS.
// `context` is the app's dayContext (civil + key + afterSunset); options: { storage, times, now, il, only }.
export function dailyPortions(context = {}, options = {}) {
  const date = civilNoon(context.civil);
  if (!date) return [];
  const only = Array.isArray(options.only) ? new Set(options.only) : null;
  return DAILY_TRACKS.filter(track => !only || only.has(track.id)).map(track => {
    let portion = null;
    try { portion = PORTION_OF[track.id](context, date, options); } catch { portion = null; }
    return portion ? { ...portion, track } : null;
  }).filter(Boolean);
}

// The cycles the user follows on Today ("מה נשאר לי היום"): opt-in, none by default — Today stays as it is until the
// user chooses a cycle on its page. Kept on the device; a change is announced so Today and the cycle's page agree.
export const DAILY_FOLLOW_KEY = 'kz-daily-follow-v1';
export const DAILY_FOLLOW_EVENT = 'kz-daily-follow-change';
export function getFollowedTracks(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(DAILY_FOLLOW_KEY) || '[]');
    return Array.isArray(value) ? DAILY_TRACKS.map(track => track.id).filter(id => value.includes(id)) : [];
  } catch { return []; }
}
export function setTrackFollowed(trackId, followed, storage = globalThis.localStorage) {
  if (!DAILY_TRACKS.some(track => track.id === trackId)) return getFollowedTracks(storage);
  const current = new Set(getFollowedTracks(storage));
  if (followed) current.add(trackId); else current.delete(trackId);
  const next = DAILY_TRACKS.map(track => track.id).filter(id => current.has(id));
  try { storage?.setItem(DAILY_FOLLOW_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  try { if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent === 'function') globalThis.dispatchEvent(new CustomEvent(DAILY_FOLLOW_EVENT)); } catch { /* no DOM */ }
  return next;
}

// The completion of a portion: a record "סיימתי" from the daily page, or — where the reader records the same unit —
// the reader's own records (both amudim of the daf; the halacha question page; חק לישראל's own "סיימתי" on that day).
export const dailyWorkId = trackId => `daily-${trackId}`;
export function portionSourceId(portion) { return studyUnitSourceId(dailyWorkId(portion.trackId), portion.unitId); }
export function isPortionDone(portion, { tzid = 'Asia/Jerusalem', now = new Date(), storage } = {}) {
  if (!portion) return false;
  const jewishDate = getJewishDateKey(now, tzid);
  const has = (source, sourceId) => { try { return storage ? hasRecordedToday({ jewishDate, source, sourceId }, storage) : hasRecordedToday({ jewishDate, source, sourceId }); } catch { return false; } };
  if (has(DAILY_LEARNING_SOURCE, portionSourceId(portion))) return true;
  if (portion.trackId === 'daf-yomi' && portion.tractate && portion.daf) {
    const workId = `Bavli_${portion.tractate}`;
    return has('talmud-reader', studyUnitSourceId(workId, `${portion.daf}a`)) && has('talmud-reader', studyUnitSourceId(workId, `${portion.daf}b`));
  }
  if (portion.trackId === 'chok-leyisrael') return has('chok-leyisrael', studyUnitSourceId('chok-leyisrael', portion.unitId));
  if (portion.trackId === 'halacha-yomit' && portion.halachaId) {
    return has('halacha-question', studyUnitSourceId('halacha-questions', portion.halachaId)) || has('halacha-question', studyUnitSourceId('ong-shabbat-questions', portion.halachaId));
  }
  return false;
}

// "סיימתי" of a portion from outside its page (Today's "סימון כהושלם"): the same journal entry as the page's own button
// (workId daily-<track>, source daily-learning) — a unit of study, so the journal's hourly rule applies (a second tap
// within the hour records nothing; after an hour "סיימתי" returns); the portion counts as done for its day once recorded.
export function recordPortionDone(portion, { now = new Date(), tzid = 'Asia/Jerusalem', storage } = {}) {
  if (!portion?.trackId) return { created: false, unsupported: true };
  return recordStudyCompletion({ workId: dailyWorkId(portion.trackId), workTitle: portion.track?.title || null, unitId: portion.unitId, unitLabel: portion.label, source: DAILY_LEARNING_SOURCE, occurredAt: now, tzid, ...(storage ? { storage } : {}) });
}
