// התבודדות → "המצוות שלי": what a session leaves in the journal when it ends — by any path (its time running out,
// "לסיים", the Back swipe, a link elsewhere, the page unmounting, the Lock Screen's end, a relaunch closing a kept
// session). Silent: nothing is shown; the journal (and with it "המעגל הרוחני") simply has it.
//   · the התבודדות itself (ACTIVITY_TYPE.HITBODEDUT, a prayer — one light) — once at least a third of the chosen time
//     has passed (pauses do not count); a session left earlier records nothing. The quantity is the minutes spent.
//   · Tehillim (the "תהילים ברצף" display) — every chapter read through (its last verse left the centre going forward:
//     controller.noteChapter), whatever the share of time; the chapter that was in the middle is not counted. One
//     entry for the session, as the closing screen's "סיימתי" records (same source / sourceId / instant), so the two
//     never count twice.
// Idempotent per session: an entry already in the journal for the session is never written again (and the journal's
// own eventKey / repeatPolicy dedupe stands behind it — the instant is the session's end, never "now").
// Pure over an injected storage (tests/hitbodedutExitRecording.test.mjs).
import { ACTIVITY_CATEGORY, ACTIVITY_TYPE, createEvent, getEvents, recordEvent } from '../mitzvotJournal.mjs';
import { elapsedMs } from './timer.mjs';

export const RECORD_SHARE_DENOMINATOR = 3;          // a third of the chosen time
export const HITBODEDUT_SOURCE = 'hitbodedut';
export const TEHILLIM_SOURCE = 'tehillim';
export const sessionSourceId = timer => `hitbodedut-${timer?.id}`;

// Has at least a third of the chosen time passed? (A session whose time ran out always has.)
export function reachedRecordShare(timer) {
  if (!timer || !(timer.durationMs > 0)) return false;
  if (timer.endReason === 'completed') return true;
  return elapsedMs(timer, timer.endedAt ?? undefined) * RECORD_SHARE_DENOMINATOR >= timer.durationMs;
}

// The chapters to record: the ones read through, each once, whole numbers 1–150 only.
export function chaptersToRecord(chapters) {
  return [...new Set((chapters || []).filter(chapter => Number.isInteger(chapter) && chapter >= 1 && chapter <= 150))];
}

// What an ended session should record — { hitbodedut: {minutes, …} | null, tehillim: {chapters, count, …} | null }.
export function exitRecordingPlan({ timer, options = {}, chapters = [] } = {}) {
  if (!timer?.endedAt) return { hitbodedut: null, tehillim: null };
  const sourceId = sessionSourceId(timer);
  const occurredAt = new Date(timer.endedAt);
  const tzid = options.tzid || undefined;
  const hitbodedut = reachedRecordShare(timer)
    ? { minutes: Math.max(1, Math.round(elapsedMs(timer, timer.endedAt) / 60000)), source: HITBODEDUT_SOURCE, sourceId, occurredAt, tzid }
    : null;
  const read = options.display === 'tehillim' ? chaptersToRecord(chapters) : [];
  const tehillim = read.length ? { chapters: read, count: read.length, source: TEHILLIM_SOURCE, sourceId, occurredAt, tzid } : null;
  return { hitbodedut, tehillim };
}

const hasEntry = (storage, category, source, sourceId) => {
  try { return getEvents({ category }, storage).some(event => event.source === source && event.sourceId === sourceId); } catch { return false; }
};

// The Tehillim entry of a session — also what the closing screen's "סיימתי" records (so either one finds the other).
export function recordSessionTehillim({ timer, options = {}, chapters = [] } = {}, storage) {
  const plan = exitRecordingPlan({ timer, options, chapters }).tehillim;
  if (!plan || hasEntry(storage, ACTIVITY_CATEGORY.TEHILLIM, plan.source, plan.sourceId)) return null;
  const event = createEvent({
    category: ACTIVITY_CATEGORY.TEHILLIM, type: ACTIVITY_TYPE.TEHILLIM_CHAPTER, occurredAt: plan.occurredAt, tzid: plan.tzid,
    source: plan.source, sourceId: plan.sourceId, unit: 'chapters', quantity: plan.count, metadata: { chapters: plan.chapters },
  });
  return recordEvent(event, storage);
}

// Records an ended session silently. Returns what was written ({ hitbodedut, tehillim }: the journal's result or null).
export function recordSessionEnd(ended, storage) {
  const plan = exitRecordingPlan(ended);
  const out = { hitbodedut: null, tehillim: null };
  if (plan.hitbodedut && !hasEntry(storage, ACTIVITY_CATEGORY.PRAYER, plan.hitbodedut.source, plan.hitbodedut.sourceId)) {
    const event = createEvent({
      category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.HITBODEDUT, occurredAt: plan.hitbodedut.occurredAt, tzid: plan.hitbodedut.tzid,
      source: plan.hitbodedut.source, sourceId: plan.hitbodedut.sourceId, unit: 'minutes', quantity: plan.hitbodedut.minutes,
      metadata: { plannedMinutes: Math.round(ended.timer.durationMs / 60000), timeUp: ended.timer.endReason === 'completed' },
    });
    out.hitbodedut = recordEvent(event, storage);
  }
  if (plan.tehillim) out.tehillim = recordSessionTehillim(ended, storage);
  return out;
}
