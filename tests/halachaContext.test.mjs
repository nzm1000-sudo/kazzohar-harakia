import test from 'node:test';
import assert from 'node:assert/strict';
import { contextualHalachaCategory, pickDailyHalacha } from '../src/services/halachaContext.mjs';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('Wednesday through Friday prioritizes Shabbat halachot', () => {
  assert.equal(contextualHalachaCategory({ weekday: 3 }), 'shabbat');
  assert.equal(contextualHalachaCategory({ weekday: 4 }), 'shabbat');
  assert.equal(contextualHalachaCategory({ weekday: 5 }), 'shabbat');
});

test('Sunday through Tuesday is an ordinary rotation day', () => {
  assert.equal(contextualHalachaCategory({ weekday: 0 }), null);
  assert.equal(contextualHalachaCategory({ weekday: 1 }), null);
  assert.equal(contextualHalachaCategory({ weekday: 2 }), null);
});

test('Rosh Chodesh takes priority and selects the prayer category', () => {
  assert.equal(contextualHalachaCategory({ weekday: 5, isRoshChodesh: true }), 'prayer');
});

test('a holiday window of about two days before selects holiday halachot', () => {
  assert.equal(contextualHalachaCategory({ key: '2026-09-23', upcomingHoliday: { date: '2026-09-25' } }), 'holidays');
  assert.equal(contextualHalachaCategory({ key: '2026-09-25', upcomingHoliday: { date: '2026-09-25' } }), 'holidays');
  assert.equal(contextualHalachaCategory({ key: '2026-09-20', upcomingHoliday: { date: '2026-09-25' } }), null);
});

test('the holiday itself and Chol HaMoed select holiday halachot', () => {
  assert.equal(contextualHalachaCategory({ isYomTov: true }), 'holidays');
  assert.equal(contextualHalachaCategory({ isCholHaMoed: true }), 'holidays');
});

test('picking is deterministic per day and filters by the contextual category', () => {
  const wednesday = { key: '2026-09-23', weekday: 3 };
  const picked = pickDailyHalacha(wednesday, { storage: storage() });
  assert.equal(picked.category, 'shabbat');
  const pickedAgain = pickDailyHalacha(wednesday, { storage: storage() });
  assert.equal(picked.id, pickedAgain.id);
});

test('rotation avoids immediately repeating the same halacha', () => {
  const context = { key: '2026-09-23', weekday: 3 };
  const store = storage();
  const first = pickDailyHalacha(context, { storage: store });
  const second = pickDailyHalacha({ ...context, key: '2026-09-24' }, { storage: store });
  assert.notEqual(first.id, second.id);
});

test('does not invent content: every pick comes from the existing verified pool', () => {
  const pool = [
    { id: 'a', category: 'shabbat', answerStatus: 'published' },
    { id: 'b', category: 'shabbat', answerStatus: 'published' },
  ];
  const picked = pickDailyHalacha({ key: '2026-09-23', weekday: 3 }, { storage: storage(), pool });
  assert.ok(['a', 'b'].includes(picked.id));
});
