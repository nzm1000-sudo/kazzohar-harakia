import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyLearningStorageKey, getDailyProgress, setDailyCompletion } from '../src/services/dailyLearning.mjs';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

test('daily completion is explicit and keyed by Hebrew day', () => {
  const store = storage();
  assert.deepEqual(getDailyProgress('5787-07-09', store), {});
  setDailyCompletion('5787-07-09', 'tehillim', true, store);
  assert.deepEqual(getDailyProgress('5787-07-09', store), { tehillim: true });
  assert.deepEqual(getDailyProgress('5787-07-10', store), {});
  assert.equal(JSON.parse(store.getItem(dailyLearningStorageKey))['5787-07-09'].tehillim, true);
});

test('daily completion history is bounded without touching learning memory', () => {
  const store = storage();
  for (let day = 1; day <= 31; day++) setDailyCompletion(`day-${String(day).padStart(2, '0')}`, 'tehillim', true, store);
  const saved = JSON.parse(store.getItem(dailyLearningStorageKey));
  assert.equal(Object.keys(saved).length, 30);
  assert.equal(saved['day-01'], undefined);
  assert.equal(saved['day-31'].tehillim, true);
});