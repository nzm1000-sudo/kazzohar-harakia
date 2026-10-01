// לימוד יומי: the daily cycles computed on the device, checked against known dates (the start and end of Daf Yomi
// cycles) and against Sefaria's own learning calendar (api/calendars, captured 2026-09-30) for three dates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAILY_TRACKS, PENDING_TRACKS, civilNoon, dafYomiPortion, dailyPortions, isPortionDone, mishnaYomitPortion, portionSourceId, rambamPortion, stableDailyHalacha } from '../src/services/dailyLearningSchedule.mjs';
import { recordStudyCompletion } from '../src/services/mitzvotJournal.mjs';
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

test('חק לישראל is named as pending with its reason — no invented schedule', () => {
  const chok = PENDING_TRACKS.find(track => track.id === 'chok-leyisrael');
  assert.ok(chok);
  assert.match(chok.reason, /מקור פתוח/);
  assert.ok(!DAILY_TRACKS.some(track => track.id === 'chok-leyisrael'));
});

test('the page and the Talmud hub use the tracks; Today stays as it is', () => {
  const learning = readFileSync(new URL('../src/pages/LearningSearch.jsx', import.meta.url), 'utf8');
  const talmud = readFileSync(new URL('../src/pages/TalmudPage.jsx', import.meta.url), 'utf8');
  const today = readFileSync(new URL('../src/pages/TodayPage.jsx', import.meta.url), 'utf8');
  assert.match(learning, /useDailyPortions\(context,tzid\)/);
  assert.match(talmud, /<DailyLearningCard /);
  assert.doesNotMatch(today, /DailyLearning|dailyLearningSchedule/);
});
