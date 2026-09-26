import test from 'node:test';
import assert from 'node:assert/strict';
import { computePresence, computePresenceLevel, PRESENCE_STATE, shiftDay, isRestDay } from '../src/services/presenceGlow.mjs';
import { _clearAllEvents, getEvents, recordPrayerCompletion, recordTehillimCompletion } from '../src/services/mitzvotJournal.mjs';
import { _clearAllSessions, createPendingSession, pauseStudySession, recordInteraction, startStudySession } from '../src/services/studySession.mjs';

const { DIM, GLOWING, BRIGHT } = PRESENCE_STATE;
const RANK = { [DIM]: 0, [GLOWING]: 1, [BRIGHT]: 2 };
const ev = (jewishDate, type = 'mincha', category = 'prayer') => ({ jewishDate, type, category });
// A quiet stretch of weekdays with no festivals (Cheshvan 5787).
const START = '2026-11-02';
const daily = (from, days) => Array.from({ length: days }, (_, i) => ev(shiftDay(from, i)));

test('no activity ever → dim, today not lit', () => {
  assert.deepEqual(computePresence([], START), { state: DIM, litToday: false });
});

test('activity every day for two weeks → bright', () => {
  const events = daily(START, 14);
  assert.equal(computePresenceLevel(events, shiftDay(START, 13)), BRIGHT);
});

test('the very first day of activity already lights something (glowing, not bright)', () => {
  assert.deepEqual(computePresence([ev(START)], START), { state: GLOWING, litToday: true });
});

test('a 10-day gap declines gradually, never an instant drop to dim', () => {
  const events = daily(START, 14);
  const last = shiftDay(START, 13);
  const states = Array.from({ length: 10 }, (_, i) => computePresenceLevel(events, shiftDay(last, i + 1)));
  assert.notEqual(states[0], DIM, 'one missed day does not extinguish the glow');
  assert.ok(states.includes(GLOWING), 'passes through glowing on the way down');
  for (let i = 1; i < states.length; i += 1) assert.ok(RANK[states[i]] <= RANK[states[i - 1]], 'never jumps back up without activity');
});

test('activity resumes after a gap → gradual rise, not an instant jump to bright', () => {
  const events = daily(START, 14);
  const resume = shiftDay(START, 14 + 20);
  assert.equal(computePresenceLevel(events, shiftDay(resume, -1)), DIM, 'fully faded before resuming');
  const after = [...events, ...daily(resume, 6)];
  const states = Array.from({ length: 6 }, (_, i) => computePresenceLevel(after, shiftDay(resume, i)));
  assert.notEqual(states[0], BRIGHT);
  assert.equal(states.at(-1), BRIGHT);
  for (let i = 1; i < states.length; i += 1) assert.ok(RANK[states[i]] >= RANK[states[i - 1]]);
});

test('five events in one day ≡ one event in that day', () => {
  const day = shiftDay(START, 3);
  const one = [...daily(START, 3), ev(day)];
  const five = [...daily(START, 3), ...Array.from({ length: 5 }, () => ev(day))];
  assert.deepEqual(computePresence(five, day), computePresence(one, day));
});

test('different event types on the same day count as one day, with no weighting', () => {
  const day = shiftDay(START, 3);
  const base = daily(START, 3);
  const prayerOnly = [...base, ev(day, 'mincha', 'prayer')];
  const mixed = [...base, ev(day, 'mincha', 'prayer'), ev(day, 'tehillim_chapter', 'tehillim'), ev(day, 'custom_learning', 'torah_study')];
  const studyOnly = [...base, ev(day, 'custom_learning', 'torah_study')];
  assert.deepEqual(computePresence(mixed, day), computePresence(prayerOnly, day));
  assert.deepEqual(computePresence(studyOnly, day), computePresence(prayerOnly, day));
});

test('Shabbat and Yom Tov never dim the glow; today without activity never shows a penalty', () => {
  // Fri 2026-11-06 active, Shabbat 11-07 (no app use), Sunday morning 11-08 before any activity.
  const events = daily(START, 5);
  assert.ok(isRestDay('2026-11-07'));
  assert.equal(computePresenceLevel(events, '2026-11-08'), computePresenceLevel(events, '2026-11-06'));
  assert.equal(isRestDay('2026-10-04', { il: true }), false, 'Simchat Torah abroad is a weekday in Israel');
  assert.equal(isRestDay('2026-10-04', { il: false }), true);
});

test('the result carries no numbers for the UI to show', () => {
  const result = computePresence(daily(START, 14), shiftDay(START, 13));
  assert.deepEqual(Object.keys(result).sort(), ['litToday', 'state']);
  assert.ok(Object.values(PRESENCE_STATE).includes(result.state));
});

function memoryStorage() {
  const map = new Map();
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
}

test('study of a minute or more is recorded in המצוות שלי, one entry per work per day', () => {
  const storage = memoryStorage();
  const saved = globalThis.localStorage;
  globalThis.localStorage = storage;
  try {
    _clearAllEvents(storage);
    _clearAllSessions(storage);
    const realNow = Date.now;
    let clock = Date.parse('2026-11-03T08:00:00Z');
    Date.now = () => clock;
    const RealDate = Date;
    globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } };
    try {
      const session = startStudySession(createPendingSession({ workId: 'Genesis', workTitle: 'בראשית', tzid: 'Asia/Jerusalem' }), storage);
      clock += 40_000; recordInteraction(storage);
      assert.equal(getEvents({ category: 'torah_study' }, storage).length, 0, 'under a minute: nothing recorded');
      clock += 40_000; recordInteraction(storage);
      let study = getEvents({ category: 'torah_study' }, storage);
      assert.equal(study.length, 1);
      assert.equal(study[0].quantity, 1);
      assert.equal(study[0].unit, 'minutes');
      assert.equal(study[0].jewishDate, session.jewishDate);
      clock += 150_000; pauseStudySession(storage);
      study = getEvents({ category: 'torah_study' }, storage);
      assert.equal(study.length, 1, 'more minutes update the same entry');
      assert.equal(study[0].quantity, 3, 'time up to the pause is kept (it used to be lost)');
    } finally {
      globalThis.Date = RealDate;
      Date.now = realNow;
    }
  } finally {
    globalThis.localStorage = saved;
  }
});

test('prayer, Tehillim and study all feed the same journal the glow reads', () => {
  const storage = memoryStorage();
  _clearAllEvents(storage);
  recordPrayerCompletion('mincha', { occurredAt: new Date('2026-11-03T12:00:00Z'), tzid: 'Asia/Jerusalem', storage });
  recordTehillimCompletion(1, { occurredAt: new Date('2026-11-04T12:00:00Z'), tzid: 'Asia/Jerusalem', storage });
  const events = getEvents({}, storage);
  assert.equal(computePresence(events, '2026-11-04').litToday, true);
});
