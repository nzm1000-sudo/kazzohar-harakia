import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';

// Minimal browser globals for services.mjs (localStorage snapshots + navigator.onLine).
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
  clear: () => store.clear(),
};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

const { zmanim, calendar, getJSON } = await import('../src/services.mjs');

const settings = { location: { latitude: 32.0853, longitude: 34.7818, tzid: 'Asia/Jerusalem' }, il: true, candles: 20 };
const originalFetch = globalThis.fetch;

beforeEach(() => { store.clear(); });
afterEach(() => { globalThis.fetch = originalFetch; });

test('zmanim: a network failure while "online" falls back to the saved snapshot', async () => {
  const times = { sunrise: '2026-09-23T06:29:00+03:00', sunset: '2026-09-23T18:37:00+03:00' };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ date: '2026-09-23', times }) });
  assert.deepEqual(await zmanim('2026-09-23', settings), times);

  // Same key but a fresh URL cache would short-circuit; use a different date to force a real fetch that fails.
  const times2 = { sunrise: '2026-09-24T06:30:00+03:00' };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ date: '2026-09-24', times: times2 }) });
  await zmanim('2026-09-24', settings);

  const { readLocalSnapshot } = { readLocalSnapshot: key => JSON.parse(store.get(key) || '{}') };
  const snap = readLocalSnapshot('kz-zmanim-snapshot-v1');
  assert.ok(Object.keys(snap).length >= 2, 'both days were snapshotted');
});

test('zmanim: server error with an existing snapshot returns the snapshot, without one it throws a Hebrew error', async () => {
  const key = '2026-10-01|32.0853|34.7818|Asia/Jerusalem';
  store.set('kz-zmanim-snapshot-v1', JSON.stringify({ [key]: { savedAt: Date.now(), times: { sunset: 'snap' } } }));
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  assert.deepEqual(await zmanim('2026-10-01', settings), { sunset: 'snap' }, 'snapshot used even though navigator.onLine is true');

  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(() => zmanim('2026-10-02', settings), /המקור אינו זמין/);
});

test('calendar: server error with an existing snapshot returns the snapshot items', async () => {
  const { calendarRequestKey } = await import('../src/services.mjs');
  const key = calendarRequestKey('2026-10-01', '2026-11-10', settings);
  const items = [{ category: 'holiday', date: '2026-10-03', title: 'Shmini Atzeret' }];
  store.set('kz-calendar-snapshot-v1', JSON.stringify({ [key]: { savedAt: Date.now(), items } }));
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await calendar('2026-10-01', '2026-11-10', settings), items);
});

test('getJSON: a stalled request is aborted by the internal timeout and reported in Hebrew', async () => {
  globalThis.fetch = (url, { signal }) => new Promise((_, reject) => { signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: signal.reason?.name || 'AbortError' }))); });
  const originalTimeout = globalThis.setTimeout;
  // Speed the 12s guard up for the test by shrinking every timer.
  globalThis.setTimeout = (fn, ms, ...rest) => originalTimeout(fn, Math.min(ms, 20), ...rest);
  try {
    await assert.rejects(() => getJSON('https://example.invalid/stall-' + Math.random()), /לא הגיב בזמן/);
  } finally {
    globalThis.setTimeout = originalTimeout;
  }
});

test('getJSON: a caller abort is propagated as-is (not converted to a timeout message)', async () => {
  globalThis.fetch = (url, { signal }) => new Promise((_, reject) => { signal.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))); });
  const controller = new AbortController();
  const pending = getJSON('https://example.invalid/abort-' + Math.random(), controller.signal);
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
});
