// לימוד יומי: the daily cycles computed on the device, checked against known dates (the start and end of Daf Yomi
// cycles) and against Sefaria's own learning calendar (api/calendars, captured 2026-09-30) for three dates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAILY_FOLLOW_KEY, DAILY_TRACKS, PENDING_TRACKS, chokPortion, civilNoon, dafYomiPortion, dailyPortions, getFollowedTracks, isPortionDone, mishnaYomitPortion, portionSourceId, rambamPortion, recordPortionDone, setTrackFollowed, stableDailyHalacha } from '../src/services/dailyLearningSchedule.mjs';
import { getEvents, recordStudyCompletion, repeatPolicy } from '../src/services/mitzvotJournal.mjs';
import { MAZKIR_LEARNING_TRACKS, normalizeMazkir } from '../src/services/reminders/mazkir.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../src/data/practicalHalachaQa.mjs';

const storage = () => { const map = new Map(); return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; };
const day = key => civilNoon(key);

test('Daf Yomi: known cycle dates — 13th and 14th cycles begin at Berakhot 2, the 14th ends at Niddah 73', () => {
  assert.equal(dafYomiPortion(day('2012-08-03')).unitId, 'Berakhot 2');
  assert.equal(dafYomiPortion(day('2020-01-05')).unitId, 'Berakhot 2');
  assert.equal(dafYomiPortion(day('2027-06-07')).unitId, 'Niddah 73');
  assert.equal(dafYomiPortion(day('2020-01-05')).label, 'ברכות ב׳');
});

// Sefaria's calendar (https://www.sefaria.org/api/calendars?year=…&month=…&day=…), captured 2026-09-30.
const SEFARIA = [
  { date: '2026-09-30', daf: 'Bekhorot 12', dafHe: 'בכורות י״ב', rambam1: 'הלכות גירושין ט׳', rambam3: 'הלכות מקואות ה׳–ז׳', mishnah: 'אהלות ו׳, ו׳–ז׳' },
  { date: '2025-03-10', daf: 'Sanhedrin 83', dafHe: 'סנהדרין פ״ג', rambam1: 'הלכות כלים ג׳', rambam3: 'הלכות דעות ו׳–ז׳ · הלכות תלמוד תורה א׳', mishnah: 'שבועות ח׳, ב׳–ג׳' },
  { date: '2024-04-08', daf: 'Bava Metzia 40', dafHe: 'בבא מציעא מ׳', rambam1: 'הלכות ערכים וחרמין ה׳', rambam3: 'הלכות עבודה זרה וחוקות הגויים א׳–ג׳', mishnah: 'נזיר א׳, ו׳–ז׳' },
];

test('Daf Yomi, Rambam (1 and 3 chapters) and Mishnah Yomit agree with Sefaria\'s calendar on three dates', () => {
  for (const row of SEFARIA) {
    const daf = dafYomiPortion(day(row.date));
    assert.equal(daf.unitId, row.daf, row.date);
    assert.equal(daf.label, row.dafHe, row.date);
    assert.equal(rambamPortion(day(row.date), 1).label, row.rambam1, row.date);
    assert.equal(rambamPortion(day(row.date), 3).label, row.rambam3, row.date);
    assert.equal(mishnaYomitPortion(day(row.date)).label, row.mishnah, row.date);
  }
});

test('every portion opens in the app\'s own reader, offline: the Talmud reader, the library packs, the halacha page', () => {
  const portions = dailyPortions({ civil: '2026-09-30', key: '5787-07-19' }, { storage: storage() });
  assert.deepEqual(portions.map(portion => portion.trackId), DAILY_TRACKS.map(track => track.id));
  const byId = Object.fromEntries(portions.map(portion => [portion.trackId, portion]));
  assert.deepEqual(byId['daf-yomi'].parts[0], { ...byId['daf-yomi'].parts[0], route: 'talmud/Bekhorot/12a', offline: true });
  assert.equal(byId['rambam-3'].parts[0].route, 'books/r/Mishneh_Torah__Immersion_Pools/5');
  assert.equal(byId['rambam-1'].parts[0].route, 'books/r/Mishneh_Torah__Divorce/9');
  assert.equal(byId['mishna-yomit'].parts[0].route, 'books/r/Mishnah_Oholot/6/6');
  assert.match(byId['halacha-yomit'].parts[0].route, /^halacha\/q\//);
  for (const portion of portions) for (const part of portion.parts) assert.equal(part.offline, true, `${portion.trackId}: ${part.label}`);
});

test('a whole Daf Yomi cycle and a whole Rambam cycle map to the offline library, except the parts it does not carry (named, never guessed)', () => {
  const dafMissing = new Set();
  for (let i = 0; i < 2711; i += 1) { const portion = dafYomiPortion(new Date(2020, 0, 5 + i, 12)); if (!portion.parts[0].offline) dafMissing.add(portion.label.split(' ')[0]); }
  assert.deepEqual([...dafMissing], ['שקלים'], 'only Yerushalmi Shekalim is outside the offline Bavli');
  let offline = 0;
  let total = 0;
  for (let i = 0; i < 1017; i += 1) {
    for (const part of rambamPortion(new Date(2025, 0, 1 + i, 12), 1).parts) {
      total += 1;
      if (part.offline) offline += 1;
      else { assert.equal(part.route, null); assert.match(part.sefariaRef, /^Mishneh Torah, /); assert.match(part.note, /טרם נכלל/); }
    }
  }
  assert.ok(offline / total > 0.95, `${offline}/${total} Rambam chapters offline`);
});

test('הלכה יומית is the app\'s own verified daily halacha, one per day (the first pick is kept), and a new one the next day', () => {
  const store = storage();
  const first = stableDailyHalacha({ key: '5787-07-19', civil: '2026-09-30' }, { storage: store });
  const again = stableDailyHalacha({ key: '5787-07-19', civil: '2026-09-30' }, { storage: store });
  assert.ok(first?.id);
  assert.equal(again.id, first.id);
  assert.equal(PRACTICAL_HALACHA_QA_INDEX[first.id].answerStatus, 'published');
  assert.ok(!PRACTICAL_HALACHA_QA_INDEX[first.id].highStakes);
  const next = stableDailyHalacha({ key: '5787-07-20', civil: '2026-10-01' }, { storage: store });
  assert.ok(next?.id);
});

test('"סיימתי" on a track records it once for the day; a daf read in the Talmud reader (both amudim) also counts', () => {
  const store = storage();
  const now = new Date('2026-09-30T09:00:00Z');
  const [daf] = dailyPortions({ civil: '2026-09-30', key: 'k' }, { storage: store });
  assert.equal(isPortionDone(daf, { now, storage: store }), false);
  recordStudyCompletion({ workId: 'Bavli_Bekhorot', unitId: '12a', source: 'talmud-reader', occurredAt: now, tzid: 'Asia/Jerusalem', storage: store });
  assert.equal(isPortionDone(daf, { now, storage: store }), false, 'one amud is not the daf');
  recordStudyCompletion({ workId: 'Bavli_Bekhorot', unitId: '12b', source: 'talmud-reader', occurredAt: now, tzid: 'Asia/Jerusalem', storage: store });
  assert.equal(isPortionDone(daf, { now, storage: store }), true);
  const rambam = dailyPortions({ civil: '2026-09-30', key: 'k' }, { storage: store })[1];
  recordStudyCompletion({ workId: 'daily-rambam-3', unitId: rambam.unitId, source: 'daily-learning', occurredAt: now, tzid: 'Asia/Jerusalem', storage: store });
  assert.equal(isPortionDone(rambam, { now, storage: store }), true);
  assert.match(portionSourceId(rambam), /daily-rambam-3/);
});

test('חק לישראל is a daily cycle: the week\'s parasha and the edition\'s own day, opening its reader on that day', () => {
  assert.equal(PENDING_TRACKS.length, 0);
  assert.equal(DAILY_TRACKS[DAILY_TRACKS.length - 1].id, 'chok-leyisrael', 'after the existing cycles, their order unchanged');
  const cases = [
    // [context, label, route]
    [{ civil: '2026-10-01', key: '2026-10-01' }, 'פרשת וזאת הברכה · יום חמישי', 'chok-leyisrael/d/vezot-haberakhah/thu'],
    // Thursday after sunset: the Jewish date is Friday's, and it is night → ליל שישי.
    [{ civil: '2026-10-01', key: '2026-10-02', afterSunset: true }, 'פרשת וזאת הברכה · ליל שישי', 'chok-leyisrael/d/vezot-haberakhah/fri-night'],
    // Shabbat: the week's Friday.
    [{ civil: '2026-10-03', key: '2026-10-03' }, 'פרשת וזאת הברכה · יום שישי', 'chok-leyisrael/d/vezot-haberakhah/fri'],
    // A weekday of a regular week.
    [{ civil: '2026-11-04', key: '2026-11-04' }, 'פרשת חיי שרה · יום רביעי', 'chok-leyisrael/d/chayei-sara/wed'],
    // Two parashot read together: both.
    [{ civil: '2027-07-27', key: '2027-07-27' }, 'פרשות מטות ומסעי · יום שלישי', 'chok-leyisrael/d/matot+masei/tue'],
  ];
  for (const [context, label, route] of cases) {
    const portion = chokPortion(context);
    assert.equal(portion.label, label, context.key);
    assert.equal(portion.parts[0].route, route, context.key);
    assert.equal(portion.parts[0].offline, true);
    assert.equal(portion.unitId, route.replace('chok-leyisrael/d/', ''));
  }
  assert.match(chokPortion({ civil: '2026-10-03', key: '2026-10-03' }).parts[0].note, /בשבת/);
  assert.equal(chokPortion({ civil: '2027-07-27', key: '2027-07-27' }).shortLabel, 'מטות ומסעי · יום שלישי');
  // Friday before dawn (civil Friday, no sunset passed yet): still ליל שישי, by the app's zmanim.
  const times = { alotHaShachar: '2026-10-02T03:30:00Z' };
  assert.equal(chokPortion({ civil: '2026-10-02', key: '2026-10-02' }, { times, now: new Date('2026-10-02T01:00:00Z') }).day, 'fri-night');
  assert.equal(chokPortion({ civil: '2026-10-02', key: '2026-10-02' }, { times, now: new Date('2026-10-02T06:00:00Z') }).day, 'fri');
  // In the list of every cycle, last, with its label.
  const all = dailyPortions({ civil: '2026-10-01', key: '2026-10-01' }, { storage: storage() });
  assert.equal(all.at(-1).trackId, 'chok-leyisrael');
  assert.equal(all.at(-1).track.title, 'חק לישראל');
});

test('Today follows only the cycles the user chose (none by default); חק לישראל can be followed and shows its day', () => {
  const store = storage();
  assert.deepEqual(getFollowedTracks(store), []);
  assert.deepEqual(dailyPortions({ civil: '2026-10-01', key: '2026-10-01' }, { storage: store, only: getFollowedTracks(store) }), []);
  setTrackFollowed('chok-leyisrael', true, store);
  setTrackFollowed('nonsense', true, store);
  assert.deepEqual(getFollowedTracks(store), ['chok-leyisrael']);
  const followed = dailyPortions({ civil: '2026-10-01', key: '2026-10-02', afterSunset: true }, { storage: store, only: getFollowedTracks(store) });
  assert.deepEqual(followed.map(portion => [portion.trackId, portion.label]), [['chok-leyisrael', 'פרשת וזאת הברכה · ליל שישי']]);
  setTrackFollowed('chok-leyisrael', false, store);
  assert.deepEqual(JSON.parse(store.getItem(DAILY_FOLLOW_KEY)), []);
  // Today (NewApp) adds the followed portions to "מה נשאר לי היום" and records them through recordPortionDone.
  const app = readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /useDailyPortions\(context, settings\.location\.tzid, \{ times: solar\.data, settings, now, only: followedTracks \}\)/);
  assert.match(app, /\.\.\.followedPortions\.map\(portion => \(\{ id: `learning:\$\{portion\.trackId\}`/);
  assert.match(app, /recordPortionDone\(portion,/);
});

test('"סיימתי" of חק לישראל follows the hourly rule of study (Today and the cycle page write the same entry); done for its day once recorded', () => {
  const store = storage();
  const now = new Date('2026-10-01T09:00:00Z');
  const [chok] = dailyPortions({ civil: '2026-10-01', key: '2026-10-01' }, { storage: store, only: ['chok-leyisrael'] });
  assert.equal(isPortionDone(chok, { now, storage: store }), false);
  assert.equal(recordPortionDone(chok, { now, tzid: 'Asia/Jerusalem', storage: store }).created, true);
  // Within the hour: the same completion, nothing new.
  assert.equal(recordPortionDone(chok, { now: new Date('2026-10-01T09:30:00Z'), tzid: 'Asia/Jerusalem', storage: store }).created, false);
  assert.equal(getEvents({}, store).filter(event => event.source === 'daily-learning').length, 1);
  // Done for Today for the rest of the day, also after the hour has passed.
  assert.equal(isPortionDone(chok, { now: new Date('2026-10-01T12:00:00Z'), storage: store }), true);
  // After an hour, like all study, a new recording is allowed (its own entry).
  assert.equal(recordPortionDone(chok, { now: new Date('2026-10-01T10:05:00Z'), tzid: 'Asia/Jerusalem', storage: store }).created, true);
  assert.equal(getEvents({}, store).filter(event => event.source === 'daily-learning').length, 2);
  assert.equal(repeatPolicy(getEvents({}, store).find(event => event.source === 'daily-learning')), 'hourly');
  // The reader's own "סיימתי" (source chok-leyisrael, the same day of the edition) counts too.
  const other = storage();
  recordStudyCompletion({ workId: 'chok-leyisrael', unitId: chok.unitId, source: 'chok-leyisrael', occurredAt: now, tzid: 'Asia/Jerusalem', storage: other });
  assert.equal(isPortionDone(chok, { now, storage: other }), true);
});

test('the learning reminder can name חק לישראל among its cycles', () => {
  assert.ok(MAZKIR_LEARNING_TRACKS.some(([id, label]) => id === 'chok-leyisrael' && label === 'חק לישראל'));
  assert.deepEqual(normalizeMazkir({ learning: { enabled: true, tracks: ['chok-leyisrael'] } }).learning.tracks, ['chok-leyisrael']);
  assert.deepEqual(normalizeMazkir({}).learning.tracks, ['daf-yomi'], 'the default stays דף יומי');
});

test('the page and the Talmud hub use the tracks; the Today page itself stays as it is (followed cycles come as its items)', () => {
  const learning = readFileSync(new URL('../src/pages/LearningSearch.jsx', import.meta.url), 'utf8');
  const talmud = readFileSync(new URL('../src/pages/TalmudPage.jsx', import.meta.url), 'utf8');
  const today = readFileSync(new URL('../src/pages/TodayPage.jsx', import.meta.url), 'utf8');
  assert.match(learning, /useDailyPortions\(context,tzid,\{times,settings\}\)/);
  assert.match(talmud, /<DailyLearningCard /);
  assert.doesNotMatch(today, /DailyLearning|dailyLearningSchedule/);
});
