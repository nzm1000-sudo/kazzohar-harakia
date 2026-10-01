// התבודדות → "המצוות שלי": the owner's rule — leaving a session (any way out) records the התבודדות silently once at
// least a third of the chosen time has passed; every Tehillim chapter read through is recorded, the one in the middle
// is not; a natural end keeps its closing screen, and nothing is ever recorded twice (src/services/hitbodedut/
// exitRecording.mjs, wired to the controller's onEnd as in index.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHitbodedutController, SESSION_KEY } from '../src/services/hitbodedut/session.mjs';
import { leaveSession } from '../src/services/hitbodedut/exitGuard.mjs';
import { recoverHitbodedutAtLaunch } from '../src/services/hitbodedut/launchRecovery.mjs';
import {
  exitRecordingPlan, reachedRecordShare, recordSessionEnd, recordSessionTehillim, sessionSourceId, chaptersToRecord,
} from '../src/services/hitbodedut/exitRecording.mjs';
import { ACTIVITY_CATEGORY, ACTIVITY_TYPE, TYPE_LABELS, completionState, getEvents, formatEventForDisplay } from '../src/services/mitzvotJournal.mjs';
import { lightsOf } from '../src/services/spiritualCircle.mjs';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 1, 9, 0, 0);
function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map };
}
// The controller as index.mjs builds it (no screen / audio / live: only the journal matters here).
function rig(storage = memoryStorage()) {
  let now = T0;
  const controller = createHitbodedutController({ storage, clock: () => now, onEnd: ended => { recordSessionEnd(ended, storage); } });
  return { controller, storage, setNow: value => { now = value; } };
}
const journal = storage => getEvents({}, storage);
const hitbodedutEntries = storage => journal(storage).filter(event => event.type === ACTIVITY_TYPE.HITBODEDUT);
const tehillimEntries = storage => journal(storage).filter(event => event.category === ACTIVITY_CATEGORY.TEHILLIM);
const doc = { documentElement: { setAttribute() {}, removeAttribute() {}, hasAttribute: () => false } };

test('left before a third of the time: nothing is recorded, nothing is shown', async () => {
  const r = rig();
  await r.controller.start({ minutes: 30, tzid: 'Asia/Jerusalem' });
  r.setNow(T0 + 9 * MIN + 59_000);                         // just under 10 of 30 minutes
  await leaveSession(r.controller, { doc });
  assert.equal(r.controller.active, false);
  assert.equal(r.controller.summary, null, 'no closing screen');
  assert.deepEqual(journal(r.storage), []);
});

test('left after a third of the time: the התבודדות is recorded once, silently', async () => {
  const r = rig();
  await r.controller.start({ minutes: 30, tzid: 'Asia/Jerusalem' });
  r.setNow(T0 + 10 * MIN);                                  // exactly a third
  await leaveSession(r.controller, { doc });
  assert.equal(r.controller.summary, null, 'no closing screen, no message');
  const [entry, ...more] = hitbodedutEntries(r.storage);
  assert.equal(more.length, 0);
  assert.equal(entry.category, ACTIVITY_CATEGORY.PRAYER);
  assert.equal(entry.unit, 'minutes');
  assert.equal(entry.quantity, 10);
  assert.equal(entry.source, 'hitbodedut');
  assert.equal(entry.sourceId, sessionSourceId({ id: `h-${T0}` }));
  assert.equal(entry.occurredAt, new Date(T0 + 10 * MIN).toISOString(), 'the instant of the end, never "now"');
  assert.equal(lightsOf(entry), 1, 'one light in המעגל הרוחני');
  assert.equal(TYPE_LABELS[ACTIVITY_TYPE.HITBODEDUT], 'התבודדות');
  assert.equal(formatEventForDisplay(entry).type, 'התבודדות');
  // The same end replayed (a second path firing, a re-run of the hook): still one entry.
  const timer = { id: `h-${T0}`, durationMs: 30 * MIN, startedAt: T0, endsAt: T0 + 30 * MIN, pausedAt: null, pausedTotalMs: 0, endedAt: T0 + 10 * MIN, endReason: 'ended' };
  assert.equal(recordSessionEnd({ timer, options: { display: 'timer' }, chapters: [] }, r.storage).hitbodedut, null);
  await leaveSession(r.controller, { doc });                // nothing left to end
  assert.equal(hitbodedutEntries(r.storage).length, 1);
});

test('every way out records the same: "לסיים", the Lock Screen\'s end, a new session over a running one', async () => {
  for (const leave of [
    async c => leaveSession(c, { doc }),
    async c => c.apply({ action: 'end', at: T0 + 20 * MIN, id: 'x' }),
    async c => c.start({ minutes: 15 }),
  ]) {
    const r = rig();
    await r.controller.start({ minutes: 30 });
    r.setNow(T0 + 20 * MIN);
    await leave(r.controller);
    assert.equal(hitbodedutEntries(r.storage).length, 1);
    assert.equal(hitbodedutEntries(r.storage)[0].quantity, 20);
  }
});

test('the paused time does not count toward the third', async () => {
  const r = rig();
  await r.controller.start({ minutes: 30 });
  r.setNow(T0 + 5 * MIN); await r.controller.pause();
  r.setNow(T0 + 25 * MIN); await r.controller.resume();
  r.setNow(T0 + 29 * MIN);                                   // 9 minutes of session, 20 paused
  await leaveSession(r.controller, { doc });
  assert.deepEqual(hitbodedutEntries(r.storage), []);
  assert.equal(reachedRecordShare({ durationMs: 30 * MIN, endsAt: T0 + 50 * MIN, endedAt: T0 + 29 * MIN, pausedAt: null, endReason: 'ended' }), false);
  assert.equal(reachedRecordShare({ durationMs: 30 * MIN, endsAt: T0 + 50 * MIN, endedAt: T0 + 30 * MIN, pausedAt: null, endReason: 'ended' }), true);
});

test('Tehillim: the chapters read through are recorded; the chapter in the middle is not', async () => {
  const r = rig();
  await r.controller.start({ minutes: 30, display: 'tehillim', startChapter: 23 });
  r.controller.noteChapter(23);                             // read through
  r.controller.noteChapter(24);                             // read through
  // chapter 25 is on the wheel, half read — never noted, so never recorded
  r.setNow(T0 + 4 * MIN);                                   // well under a third
  await leaveSession(r.controller, { doc });
  assert.equal(r.controller.summary, null);
  assert.deepEqual(hitbodedutEntries(r.storage), [], 'the התבודדות itself: under a third');
  const [entry, ...more] = tehillimEntries(r.storage);
  assert.equal(more.length, 0);
  assert.equal(entry.type, ACTIVITY_TYPE.TEHILLIM_CHAPTER);
  assert.equal(entry.quantity, 2);
  assert.deepEqual(entry.metadata.chapters, [23, 24]);
  assert.equal(entry.source, 'tehillim');
  assert.equal(entry.sourceId, `hitbodedut-h-${T0}`);
  assert.equal(lightsOf(entry), 2, 'one light per chapter');
});

test('Tehillim with nothing read through, or the quiet clock: no Tehillim entry', async () => {
  const a = rig();
  await a.controller.start({ minutes: 15, display: 'tehillim' });
  a.setNow(T0 + 10 * MIN);
  await leaveSession(a.controller, { doc });
  assert.deepEqual(tehillimEntries(a.storage), []);
  assert.equal(hitbodedutEntries(a.storage).length, 1);
  assert.equal(exitRecordingPlan({ timer: { id: 'h', durationMs: MIN, endsAt: 1, endedAt: 1, endReason: 'completed' }, options: { display: 'timer' }, chapters: [5] }).tehillim, null);
  assert.deepEqual(chaptersToRecord([3, 3, 0, 151, 2.5, 'x', 4]), [3, 4]);
});

test('natural end: the closing screen stays, everything is recorded once — and its "סיימתי" never adds a second entry', async () => {
  const r = rig();
  await r.controller.start({ minutes: 15, display: 'tehillim', startChapter: 1, tzid: 'Asia/Jerusalem' });
  r.controller.noteChapter(1); r.controller.noteChapter(2); r.controller.noteChapter(3);
  r.setNow(T0 + 15 * MIN + 500);
  const summary = await r.controller.tick();
  assert.equal(summary.timer.endReason, 'completed');
  assert.equal(r.controller.summary?.timer.endReason, 'completed', 'the closing screen is there until חזרה');
  assert.equal(hitbodedutEntries(r.storage).length, 1);
  assert.equal(hitbodedutEntries(r.storage)[0].quantity, 15);
  assert.equal(tehillimEntries(r.storage).length, 1);
  assert.equal(tehillimEntries(r.storage)[0].quantity, 3);
  // The closing screen's CompletionButton reads the session's entry: "ישר כח!" at once.
  assert.equal(completionState({ source: 'tehillim', sourceId: `hitbodedut-h-${T0}`, now: new Date(T0 + 16 * MIN) }, r.storage).done, true);
  // A tap anyway (or after the hour): the same entry, never a second one.
  assert.equal(recordSessionTehillim(summary, r.storage), null);
  recordSessionEnd(summary, r.storage);
  r.controller.dismissSummary();
  await leaveSession(r.controller, { doc });
  assert.equal(tehillimEntries(r.storage).length, 1);
  assert.equal(hitbodedutEntries(r.storage).length, 1);
  // Undone in the journal, a later "סיימתי" brings back the very same entry (same instant).
  const fresh = memoryStorage();
  const again = recordSessionTehillim(summary, fresh);
  assert.equal(again.created, true);
  assert.equal(again.event.occurredAt, new Date(T0 + 15 * MIN).toISOString());
  assert.equal(recordSessionTehillim(summary, fresh), null);
});

test('relaunch on another screen: a kept session is closed, recorded (by the same rule) and no closing screen waits', async () => {
  const storage = memoryStorage();
  const before = rig(storage);
  await before.controller.start({ minutes: 15, display: 'tehillim', startChapter: 10 });
  before.controller.noteChapter(10);
  assert.ok(storage.getItem(SESSION_KEY));
  // The app is killed; it opens on Today 20 minutes later (the time ran out meanwhile).
  const after = rig(storage);
  after.setNow(T0 + 20 * MIN);
  const load = async () => ({ leaveSession, hitbodedut: ({ resume }) => { after.controller.ready = after.controller.recover(undefined, { resume }); return after.controller; } });
  assert.equal(await recoverHitbodedutAtLaunch({ doc, hash: '#today', storage, load }), true);
  assert.equal(after.controller.summary, null, 'no closing screen waiting for the next visit');
  assert.equal(hitbodedutEntries(storage).length, 1);
  assert.equal(tehillimEntries(storage)[0].quantity, 1);

  // Killed early (2 of 15 minutes) and relaunched on another screen soon after: under a third — nothing.
  const s2 = memoryStorage();
  const early = rig(s2);
  await early.controller.start({ minutes: 15 });
  const later = rig(s2);
  later.setNow(T0 + 2 * MIN);
  await later.controller.recover(undefined, { resume: false });
  assert.deepEqual(hitbodedutEntries(s2), []);
});

test('the page wires it: tzid kept with the session, the closing screen records the session\'s own entry', () => {
  const index = readFileSync(new URL('../src/services/hitbodedut/index.mjs', import.meta.url), 'utf8');
  assert.match(index, /onEnd: ended => \{ recordSessionEnd\(ended/);
  const page = readFileSync(new URL('../src/pages/HitbodedutPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /chime: prefs\.chime, tzid \}/);
  assert.match(page, /recordSessionTehillim\(summary/);
  assert.doesNotMatch(page, /recordTehillimCompletion/);
});
