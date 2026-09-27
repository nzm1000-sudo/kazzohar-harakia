// Stage 4d — the daily Tehillim completion records the portion's real chapter count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dailyTehillimChapterCount, getDailyTehillim } from '../src/tehillimDaily.mjs';
import { _clearAllEvents, getEvents, recordTehillimCompletion } from '../src/services/mitzvotJournal.mjs';
function memoryStorage() { const map = new Map(); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }; }

test('portion sizes come from the monthly division (day 1 = Psalms 1–9)', () => {
  assert.deepEqual([getDailyTehillim(1).start, getDailyTehillim(1).end], [1, 9]);
  assert.equal(dailyTehillimChapterCount(getDailyTehillim(1)), 9);
  assert.equal(dailyTehillimChapterCount(null), 1, 'unknown portion → one (never zero)');
});

test('the Today checklist records a multi-chapter portion with its real count, as a daily portion', () => {
  const app = readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /recordTehillimCompletion\(dailyTehillimChapterCount\(getDailyTehillim\(context\.date\?\.day\)\), \{[^}]*sourceId: 'daily-tehillim', isDailyPortion: true/);
  assert.doesNotMatch(app, /recordTehillimCompletion\(1, \{ occurredAt: now, tzid: settings\.location\.tzid, source: 'today'/);
  const storage = memoryStorage(); _clearAllEvents(storage);
  recordTehillimCompletion(dailyTehillimChapterCount(getDailyTehillim(1)), { occurredAt: new Date('2026-11-03T08:00:00Z'), tzid: 'Asia/Jerusalem', source: 'today', sourceId: 'daily-tehillim', isDailyPortion: true, storage });
  const [event] = getEvents({}, storage);
  assert.equal(event.quantity, 9);
  assert.equal(event.type, 'tehillim_daily_portion');
});

test('the Tehillim screen uses the same count function', () => {
  assert.match(readFileSync(new URL('../src/Tehillim.jsx', import.meta.url), 'utf8'), /recordTehillimCompletion\(dailyPortion \? dailyTehillimChapterCount\(dailyPortion\) : 1,/);
});
