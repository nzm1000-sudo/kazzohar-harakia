// "סיימתי" again after an hour: blessings, Tehillim chapters and units of study return to "סיימתי" one hour after their
// last recording (each recording its own entry and its own light); prayers, the Omer and Shnayim Mikra stay done for
// their day. Fake time throughout: every recording and every check is given its instant.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { memoryStorage } from './helpers/memoryStorage.mjs';
import {
  ACTIVITY_CATEGORY, ACTIVITY_TYPE, REPEAT_AFTER_MS, completionState, getEvents, recordReadingCompletion, recordSiddurCompletion,
  recordStudyCompletion, recordTehillimCompletion, repeatPolicy,
} from '../src/services/mitzvotJournal.mjs';
import { computeCircle } from '../src/services/spiritualCircle.mjs';

const TZ = 'Asia/Jerusalem';
const T0 = new Date('2026-11-03T08:00:00Z'); // a Tuesday morning in Israel
const at = minutes => new Date(T0.getTime() + minutes * 60000);
const state = (storage, source, sourceId, minutes) => completionState({ source, sourceId, now: at(minutes), tzid: TZ }, storage);

test('the policy: blessings, Tehillim chapters and units of study hourly; prayers, Omer, Shnayim Mikra daily', () => {
  assert.equal(REPEAT_AFTER_MS, 60 * 60 * 1000);
  const hourly = [
    { category: ACTIVITY_CATEGORY.BIRKAT_HAMAZON, type: ACTIVITY_TYPE.BIRKAT_HAMAZON_FULL },
    { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.MEIN_SHALOSH },
    { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.BORE_NEFASHOT },
    { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.BIRCHOT_HANEHENIN },
    { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.TEFILAT_HADERECH },
    { category: ACTIVITY_CATEGORY.TEHILLIM, type: ACTIVITY_TYPE.TEHILLIM_CHAPTER, sourceId: 'chapter-23' },
    { category: ACTIVITY_CATEGORY.TORAH_STUDY, type: ACTIVITY_TYPE.STUDY_UNIT },
  ];
  const daily = [
    { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.SHACHARIT },
    { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.MINCHA },
    { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.ARVIT },
    { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.MORNING_BLESSINGS },
    { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.SHALOM_RAV_PRAYER },
    { category: ACTIVITY_CATEGORY.OMER_COUNT, type: ACTIVITY_TYPE.OMER_DAY },
    { category: ACTIVITY_CATEGORY.SHNAYIM_MIKRA, type: ACTIVITY_TYPE.SHNAYIM_MIKRA_PORTION },
    { category: ACTIVITY_CATEGORY.TEHILLIM, type: ACTIVITY_TYPE.TEHILLIM_DAILY_PORTION, sourceId: 'daily-tehillim' },
    { category: ACTIVITY_CATEGORY.TORAH_STUDY, type: ACTIVITY_TYPE.CUSTOM_LEARNING },
  ];
  for (const kind of hourly) assert.equal(repeatPolicy(kind), 'hourly', kind.type);
  for (const kind of daily) assert.equal(repeatPolicy(kind), 'daily', kind.type);
});

test('Birkat HaMazon: "ישר כח!" for the hour, "סיימתי" again after 60 minutes — not before — and both entries in the journal', () => {
  const storage = memoryStorage();
  const say = minutes => recordSiddurCompletion('Post Meal Blessing', { occurredAt: at(minutes), tzid: TZ, storage });
  assert.equal(say(0).created, true);
  assert.deepEqual(state(storage, 'siddur', 'Post Meal Blessing', 0), { done: true, until: at(60).getTime() });
  assert.equal(state(storage, 'siddur', 'Post Meal Blessing', 59).done, true, 'still done at 59 minutes');
  assert.equal(state(storage, 'siddur', 'Post Meal Blessing', 59.9).done, true);
  assert.equal(say(30).created, false, 'a second tap within the hour records nothing');
  assert.equal(say(59).created, false);
  assert.deepEqual(state(storage, 'siddur', 'Post Meal Blessing', 60), { done: false, until: null }, 'the button returns at 60 minutes');
  assert.equal(say(120).created, true, 'two hours later: a new recording');
  assert.equal(state(storage, 'siddur', 'Post Meal Blessing', 121).done, true);
  const events = getEvents({}, storage);
  assert.equal(events.length, 2, 'the journal keeps both');
  assert.ok(events.every(e => e.category === ACTIVITY_CATEGORY.BIRKAT_HAMAZON && e.sourceId === 'Post Meal Blessing'));
  assert.notEqual(events[0].eventKey, events[1].eventKey);
  assert.equal(computeCircle(events, '2026-11-03').week, 2, 'each recording is a light');
});

test('a blessing exactly at the hour is new; the same blessing from another rite within the hour is the same', () => {
  const storage = memoryStorage();
  assert.equal(recordSiddurCompletion('Al Hamihya', { occurredAt: at(0), tzid: TZ, storage }).created, true);
  assert.equal(recordSiddurCompletion('Berachot, Birkat Hanehenin', { itemEn: 'Al Hamichyah', perItem: true, occurredAt: at(10), tzid: TZ, storage }).created, false);
  assert.equal(recordSiddurCompletion('Al Hamihya', { occurredAt: at(60), tzid: TZ, storage }).created, true);
  assert.equal(getEvents({}, storage).length, 2);
});

test('a Tehillim chapter and a unit of study: again after an hour', () => {
  const storage = memoryStorage();
  const chapter = minutes => recordTehillimCompletion(1, { occurredAt: at(minutes), tzid: TZ, source: 'tehillim', sourceId: 'chapter-121', storage });
  assert.equal(chapter(0).created, true);
  assert.equal(chapter(45).created, false);
  assert.equal(state(storage, 'tehillim', 'chapter-121', 45).done, true);
  assert.equal(state(storage, 'tehillim', 'chapter-121', 61).done, false);
  assert.equal(chapter(61).created, true);
  const unit = minutes => recordStudyCompletion({ workId: 'Bavli_Berakhot', unitId: '2a', source: 'talmud-reader', occurredAt: at(minutes), tzid: TZ, storage });
  assert.equal(unit(0).created, true);
  assert.equal(unit(59).created, false);
  assert.equal(state(storage, 'talmud-reader', 'Bavli_Berakhot#2a', 59).done, true);
  assert.equal(state(storage, 'talmud-reader', 'Bavli_Berakhot#2a', 60).done, false);
  assert.equal(unit(60).created, true);
  assert.equal(getEvents({}, storage).length, 4);
});

test('a prayer stays done all its day: Shacharit two and six hours later records nothing; the next Jewish day it returns', () => {
  const storage = memoryStorage();
  const pray = minutes => recordSiddurCompletion('Weekday Shacharit', { occurredAt: at(minutes), tzid: TZ, storage });
  assert.equal(pray(0).created, true);
  for (const minutes of [1, 59, 61, 120, 360]) {
    assert.deepEqual(state(storage, 'siddur', 'Weekday Shacharit', minutes), { done: true, until: null }, `${minutes} minutes`);
  }
  assert.equal(pray(120).created, false);
  assert.equal(pray(360).created, false);
  assert.equal(getEvents({}, storage).length, 1);
  // The next morning (civil = Jewish day here; no sunset registered): the button returns.
  assert.equal(state(storage, 'siddur', 'Weekday Shacharit', 24 * 60).done, false);
  assert.equal(pray(24 * 60).created, true);
});

test('the Omer and Shnayim Mikra: once a day, as before', () => {
  const storage = memoryStorage();
  assert.equal(recordSiddurCompletion('Counting of the Omer', { occurredAt: at(0), tzid: TZ, storage }).created, true);
  assert.equal(recordSiddurCompletion('Counting of the Omer', { occurredAt: at(180), tzid: TZ, storage }).created, false);
  const parasha = { category: ACTIVITY_CATEGORY.SHNAYIM_MIKRA, type: ACTIVITY_TYPE.SHNAYIM_MIKRA_PORTION, source: 'shnayim-mikra', sourceId: 'bereshit', tzid: TZ, storage };
  assert.equal(recordReadingCompletion({ ...parasha, occurredAt: at(0) }).created, true);
  assert.equal(recordReadingCompletion({ ...parasha, occurredAt: at(180) }).created, false);
  assert.equal(state(storage, 'shnayim-mikra', 'bereshit', 180).done, true);
});

test('an entry recorded before this change (a day key, no hour) still holds a blessing for its hour only', () => {
  const legacy = { id: 'old', category: 'birkat_hamazon', type: 'birkat_hamazon_full', occurredAt: at(0).toISOString(), jewishDate: '2026-11-03', completed: true, quantity: 1, unit: 'count', source: 'siddur', sourceId: 'Post Meal Blessing', metadata: {}, schemaVersion: 1, eventKey: 'legacy-day-key' };
  const storage = memoryStorage({ 'kz-mitzvot-journal-v1': JSON.stringify({ events: [legacy], schemaVersion: 1 }) });
  assert.equal(state(storage, 'siddur', 'Post Meal Blessing', 30).done, true);
  assert.equal(recordSiddurCompletion('Post Meal Blessing', { occurredAt: at(30), tzid: TZ, storage }).created, false);
  assert.equal(state(storage, 'siddur', 'Post Meal Blessing', 90).done, false);
  assert.equal(recordSiddurCompletion('Post Meal Blessing', { occurredAt: at(90), tzid: TZ, storage }).created, true);
});

test('the button re-checks by itself: a timer at the end of the hour, the app returning, and every journal change', () => {
  const button = readFileSync(new URL('../src/components/CompletionButton.jsx', import.meta.url), 'utf8');
  assert.match(button, /completionState\(\{ source, sourceId, now: new Date\(\), tzid \}\)/);
  assert.match(button, /setTimeout\(refresh, Math\.min\(Math\.max\(0, now\.until - Date\.now\(\)\) \+ 250/);
  assert.match(button, /clearTimeout\(timer\)/);
  assert.match(button, /document\.addEventListener\('visibilitychange', onVisible\)/);
  assert.match(button, /window\.addEventListener\(JOURNAL_CHANGE_EVENT, refresh\)/);
  assert.doesNotMatch(button, /hasRecordedToday/, 'the button follows the policy, not "today"');
});
