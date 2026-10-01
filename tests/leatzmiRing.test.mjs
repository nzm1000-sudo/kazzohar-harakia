// לעצמי and the spiritual ring: writing or reviewing counts as Torah study by ACTIVE TIME only, through the existing
// study-session engine; creating notes, answering or drawing chapters adds nothing by itself, and one action can
// never complete a circle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as studySession from '../src/services/studySession.mjs';
import { getEvents, STORAGE_KEY_EXPORT as JOURNAL_KEY } from '../src/services/mitzvotJournal.mjs';
import { WEEK_GOAL, lightsOf } from '../src/services/spiritualCircle.mjs';
import { createChidush, updateChidush } from '../src/services/leatzmi/chidushim.mjs';
import { enqueueReviewItem, recordReviewResult } from '../src/services/leatzmi/review.mjs';
import { drawChapter } from '../src/services/leatzmi/surprise.mjs';
import { memoryStorage } from './helpers/memoryStorage.mjs';

function backdate(storage, seconds) {
  const data = JSON.parse(storage.getItem(studySession.STORAGE_KEY_EXPORT));
  data.activeSession.lastActiveAt = new Date(Date.now() - seconds * 1000).toISOString();
  storage.setItem(studySession.STORAGE_KEY_EXPORT, JSON.stringify(data));
}

test('notes, answers and draws alone never touch the journal', () => {
  const storage = memoryStorage();
  const item = createChidush({ title: 'חידוש', body: 'x' }, { storage });
  updateChidush(item.id, { body: 'y' }, { storage });
  enqueueReviewItem({ kind: 'chidush', refId: item.id, title: 'x' }, { storage });
  recordReviewResult(`chidush:${item.id}`, 'remembered', { storage });
  drawChapter('all', { storage });
  assert.equal(storage.getItem(JOURNAL_KEY), null, 'no journal entry from counts');
});

test('writing chidushim: under one active minute nothing; a minute or more is study, one light — never a circle', () => {
  const storage = memoryStorage();
  const pending = studySession.createPendingSession({ workId: 'leatzmi-chidushim', workTitle: 'חידושי התורה שלי', category: 'torah_study', source: 'leatzmi', tzid: 'Asia/Jerusalem' });
  studySession.startStudySession(pending, storage);
  backdate(storage, 40);
  studySession.recordInteraction(storage);
  assert.equal(getEvents({}, storage).length, 0, '40 active seconds are not yet study');
  backdate(storage, 30);
  studySession.recordInteraction(storage);
  const events = getEvents({}, storage);
  assert.equal(events.length, 1);
  assert.equal(events[0].category, 'torah_study');
  assert.equal(events[0].unit, 'minutes');
  assert.equal(events[0].metadata.workTitle, 'חידושי התורה שלי');
  assert.equal(lightsOf(events[0]), 1);
  assert.ok(lightsOf(events[0]) < WEEK_GOAL);
  // An idle stretch (longer than the idle timeout) adds nothing.
  backdate(storage, 60 * 60);
  studySession.recordInteraction(storage);
  assert.equal(getEvents({}, storage)[0].quantity, 1);
});

test('every לעצמי study screen uses the existing study timer, by active time', () => {
  for (const [file, workId] of [['components/leatzmi/Chidushim.jsx', 'leatzmi-chidushim'], ['components/leatzmi/ReviewSession.jsx', 'leatzmi-review'], ['components/leatzmi/ForMeToday.jsx', 'leatzmi-today']]) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.match(source, new RegExp(`useStudyTimer\\(\\{ workId: '${workId}'`), file);
    assert.ok(!/recordTorahStudy|recordEvent\(|upsertTorahStudyMinutes/.test(source), `${file} never writes study by itself`);
  }
});
