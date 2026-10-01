// לעצמי · חזרה אליי — the spaced-repetition store (and the stable API בחן אותי calls).
import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_KEY, dueReviewItems, enqueueReviewItem, getReviewItem, nextSchedule, readReviewItems, recordReviewResult, removeReviewItem, reviewSession, seedReviewItems, topicStrength } from '../src/services/leatzmi/review.mjs';
import { memoryStorage } from './helpers/memoryStorage.mjs';

const DAY = 86_400_000;
const T0 = Date.parse('2026-10-01T09:00:00Z');

test('the stable API: enqueueReviewItem / recordReviewResult', () => {
  const storage = memoryStorage();
  const item = enqueueReviewItem({ kind: 'quiz', refId: 'tanakh-0001', title: 'מי ראה את הסנה?', payload: { q: 'מי ראה את הסנה?', options: ['משה', 'אהרן'] } }, { storage, now: T0 });
  assert.equal(item.id, 'quiz:tanakh-0001');
  assert.ok(item.due > T0 && item.due <= T0 + DAY, 'a missed question comes back within the day, not in the same breath');
  const after = recordReviewResult(item.id, 'correct', { storage, now: T0 + DAY });
  assert.equal(after.reps, 1);
  assert.equal(recordReviewResult('quiz:missing', 'correct', { storage }), null);
  assert.equal(enqueueReviewItem({ kind: 'quiz' }, { storage }), null, 'an item without an id is refused');
});

test('scheduling: a failed item returns sooner, a mastered one later and later', () => {
  const base = { id: 'x', kind: 'chidush', reps: 0, interval: 0, ease: 2.5, lapses: 0, seen: 0, due: T0, lastGrade: null };
  const failed = nextSchedule(base, 'again', T0);
  const remembered = nextSchedule(base, 'remembered', T0);
  assert.ok(failed.due < remembered.due, 'צריך חזרה → sooner than זכרתי');
  let item = base;
  const gaps = [];
  for (let i = 0; i < 5; i += 1) { const next = nextSchedule(item, 'remembered', T0); gaps.push(next.due - T0); item = next; }
  for (let i = 1; i < gaps.length; i += 1) assert.ok(gaps[i] > gaps[i - 1], `interval grows (${gaps.join(', ')})`);
  const lapsed = nextSchedule(item, 'again', T0);
  assert.equal(lapsed.reps, 0);
  assert.ok(lapsed.ease < item.ease);
  assert.ok(lapsed.due - T0 < gaps[0], 'after a lapse it starts over, sooner than the first interval');
  const snoozed = nextSchedule(item, 'later', T0);
  assert.equal(snoozed.reps, item.reps, '"later" keeps the strength');
  assert.ok(snoozed.due > T0 + DAY);
  assert.ok(nextSchedule(base, 0, T0).ease >= 1.3, 'the ease never drops below 1.3');
});

test('enqueueing a missed question again brings it back sooner and counts as a lapse', () => {
  const storage = memoryStorage();
  enqueueReviewItem({ kind: 'quiz', refId: 'q1', title: 'שאלה' }, { storage, now: T0 });
  recordReviewResult('quiz:q1', 'correct', { storage, now: T0 + DAY });
  recordReviewResult('quiz:q1', 'correct', { storage, now: T0 + 2 * DAY });
  const strong = getReviewItem('quiz:q1', storage);
  const again = enqueueReviewItem({ kind: 'quiz', refId: 'q1', title: 'שאלה' }, { storage, now: T0 + 3 * DAY });
  assert.ok(again.due < strong.due);
  assert.equal(again.lapses, strong.lapses + 1);
  assert.equal(readReviewItems(storage).length, 1, 'never duplicated');
});

test('a session shows about three due items, varied by kind, most overdue first', () => {
  const storage = memoryStorage();
  for (let i = 0; i < 4; i += 1) enqueueReviewItem({ kind: 'favorite', refId: `f${i}`, title: `f${i}` }, { storage, now: T0 - (10 - i) * DAY });
  enqueueReviewItem({ kind: 'chidush', refId: 'c1', title: 'c1' }, { storage, now: T0 - DAY });
  enqueueReviewItem({ kind: 'chidush', refId: 'future', title: 'later' }, { storage, now: T0, due: T0 + 5 * DAY });
  const session = reviewSession({ now: T0, size: 3 }, storage);
  assert.equal(session.length, 3);
  assert.deepEqual(session.map(item => item.kind).sort(), ['chidush', 'favorite', 'favorite']);
  assert.equal(session[0].refId, 'f0', 'the most overdue first');
  assert.ok(!session.some(item => item.refId === 'future'));
  assert.equal(dueReviewItems({ now: T0 }, storage).length, 5);
  assert.equal(removeReviewItem('chidush:c1', storage), true);
});

test('seeding brings the user\'s own material in gently, a few at a time, never twice', () => {
  const storage = memoryStorage();
  const sources = {
    favorites: Array.from({ length: 10 }, (_, i) => ({ key: `psalm:${i + 1}`, title: `תהילים ${i + 1}`, kind: 'tehillim', open: { type: 'psalm', chapter: i + 1 } })),
    chidushim: [{ id: 'new', title: 'חדש מדי', createdAt: new Date(T0 - DAY).toISOString() }, { id: 'old', title: 'ישן', createdAt: new Date(T0 - 10 * DAY).toISOString() }],
    halacha: [{ id: 'qa-gum-blessing', title: 'מה מברכים על מסטיק?' }],
    returned: [{ id: 'tehillim', title: 'תהילים', reference: 'chapter/23', source: 'tehillim', chapter: 23 }],
  };
  assert.equal(seedReviewItems(sources, { storage, now: T0, limit: 3 }), 3);
  const kinds = readReviewItems(storage).map(item => item.kind).sort();
  assert.deepEqual(kinds, ['chidush', 'favorite', 'halacha'], 'one of each kind first');
  assert.ok(!readReviewItems(storage).some(item => item.refId === 'new'), 'a chidush from yesterday is not reviewed yet');
  seedReviewItems(sources, { storage, now: T0, limit: 50 });
  const ids = readReviewItems(storage).map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(readReviewItems(storage).find(item => item.kind === 'halacha').payload.route, 'halacha/q/qa-gum-blessing');
});

test('migration and resilience of the stored shape', () => {
  assert.deepEqual(readReviewItems(memoryStorage()), []);
  assert.deepEqual(readReviewItems(memoryStorage({ [REVIEW_KEY]: 'garbage' })), []);
  const legacy = memoryStorage({ [REVIEW_KEY]: JSON.stringify([{ id: 'favorite:a', kind: 'favorite', title: 'א', due: '2026-09-01T00:00:00Z' }]) });
  const [item] = readReviewItems(legacy);
  assert.equal(item.refId, 'a');
  assert.equal(item.ease, 2.5);
  assert.equal(typeof item.due, 'number');
});

test('topic strength (never shown) grows with remembered items and falls with lapses', () => {
  assert.equal(topicStrength([]), 0.5);
  const strong = [{ reps: 3, lapses: 0, seen: 3 }, { reps: 4, lapses: 0, seen: 4 }];
  const weak = [{ reps: 0, lapses: 2, seen: 2 }, { reps: 1, lapses: 1, seen: 2 }];
  assert.ok(topicStrength(strong) > topicStrength(weak));
});
