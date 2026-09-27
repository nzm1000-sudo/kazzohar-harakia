// Stage 4b — journal and study sessions follow the Jewish day (sunset), using the app's own sunset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerDaySunset, _clearKnownSunsets, getEvents, _clearAllEvents } from '../src/services/mitzvotJournal.mjs';
import { _clearAllSessions, createPendingSession, pauseStudySession, recordInteraction, startStudySession } from '../src/services/studySession.mjs';

function memoryStorage() { const map = new Map(); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }; }
function withClock(startIso, run) {
  const RealDate = Date; let clock = RealDate.parse(startIso);
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [clock])); } static now() { return clock; } };
  try { return run(ms => { clock += ms; }); } finally { globalThis.Date = RealDate; }
}
const TZ = 'Asia/Jerusalem';
const SUNSET = '2026-11-03T14:52:00Z'; // 16:52 local

test('NewApp hands the journal the same sunsets dayContext uses (today and tomorrow)', () => {
  const app = readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /registerDaySunset\(\{ sunset: solar\.data\?\.sunset, tzid: settings\.location\.tzid \}\)/);
  assert.match(app, /registerDaySunset\(\{ sunset: solar\.data\?\.nextDay\?\.sunset/);
});

test('study at 23:50 civil time (after sunset) belongs to the next Jewish day', () => {
  _clearKnownSunsets(); registerDaySunset({ sunset: SUNSET, tzid: TZ });
  const storage = memoryStorage(); const saved = globalThis.localStorage; globalThis.localStorage = storage;
  try {
    _clearAllEvents(storage); _clearAllSessions(storage);
    withClock('2026-11-03T21:50:00Z', advance => { // 23:50 local
      const session = startStudySession(createPendingSession({ workId: 'Genesis', workTitle: 'בראשית', tzid: TZ }), storage);
      assert.equal(session.jewishDate, '2026-11-04');
      advance(90_000); recordInteraction(storage);
    });
    assert.equal(getEvents({ category: 'torah_study' }, storage)[0].jewishDate, '2026-11-04');
  } finally { globalThis.localStorage = saved; _clearKnownSunsets(); }
});

test('a session that starts before sunset and continues past it stays with the day it started', () => {
  _clearKnownSunsets(); registerDaySunset({ sunset: SUNSET, tzid: TZ });
  const storage = memoryStorage(); const saved = globalThis.localStorage; globalThis.localStorage = storage;
  try {
    _clearAllEvents(storage); _clearAllSessions(storage);
    withClock('2026-11-03T14:45:00Z', advance => { // 16:45 local, 7 minutes before sunset
      const session = startStudySession(createPendingSession({ workId: 'Exodus', workTitle: 'שמות', tzid: TZ }), storage);
      assert.equal(session.jewishDate, '2026-11-03');
      for (let i = 0; i < 6; i += 1) { advance(120_000); recordInteraction(storage); } // runs until 16:57
      pauseStudySession(storage);
    });
    const study = getEvents({ category: 'torah_study' }, storage);
    assert.equal(study.length, 1, 'one entry, not split across the boundary');
    assert.equal(study[0].jewishDate, '2026-11-03');
    assert.equal(study[0].quantity, 12);
  } finally { globalThis.localStorage = saved; _clearKnownSunsets(); }
});
