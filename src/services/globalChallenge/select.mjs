// האתגר העולמי — the day's five questions: the same for every device in the world, offline too.
//
// The set of a day comes from the published schedule (src/data/globalChallenge/schedule.mjs, written by
// scripts/challenge/build-key.mjs, which writes the server's answer key from the same choice). The schedule is
// append-only: a day once scheduled never changes, so an older app and a newer one (with a grown bank) still ask the
// same five. A day beyond the schedule falls back to the same seeded choice made here from the device's bank (the server
// has no key for it, so such a day stays a personal result).
//
// The seeded choice: a generator seeded by the date (ladder.mjs seededRandom — mulberry32 over an FNV hash), questions
// sorted by id (independent of the files' order), the slots' difficulties 1 · 1 · 2 · 2 · 3, five different areas, and
// none of the questions of the recent days (`avoid`, the build script's memory of the schedule).
import { seededRandom } from '../quiz/ladder.mjs';
import { GLOBAL_SIZE, SLOT_DIFFICULTIES } from './scoring.mjs';

// Questions never chosen for the world's challenge (by id). The bank has no "unsuitable" mark of its own (its validator
// keeps only the schema's fields); a question the owner wants out of the global challenge is listed here, and the next
// build of the schedule leaves it out of every day not yet scheduled.
export const GLOBAL_EXCLUDED = Object.freeze(new Set([]));

export const eligibleQuestions = questions => [...(questions || [])].filter(q => q && !GLOBAL_EXCLUDED.has(q.id) && [1, 2, 3].includes(q.difficulty)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

// The ids of the day's five, in the order they are asked.
export function pickDailySet(questions, dateKey, { avoid = new Set() } = {}) {
  const pool = eligibleQuestions(questions);
  const rng = seededRandom(`kz-global:${dateKey}`);
  const byDifficulty = { 1: [], 2: [], 3: [] };
  for (const q of pool) byDifficulty[q.difficulty].push(q);
  const picked = [];
  const areas = new Set();
  for (const difficulty of SLOT_DIFFICULTIES) {
    const list = byDifficulty[difficulty];
    if (!list.length) continue;
    // Strict first (a new area, not recent), then without the area rule, then anything not yet picked.
    const passes = [q => !areas.has(q.category) && !avoid.has(q.id), q => !avoid.has(q.id), () => true];
    let choice = null;
    for (const ok of passes) {
      for (let tries = 0; tries < 64 && !choice; tries += 1) {
        const q = list[Math.floor(rng() * list.length)];
        if (!picked.includes(q.id) && ok(q)) choice = q;
      }
      if (choice) break;
    }
    if (!choice) choice = list.find(q => !picked.includes(q.id)) || null;
    if (choice) { picked.push(choice.id); areas.add(choice.category); }
  }
  return picked.slice(0, GLOBAL_SIZE);
}

// The day's set for this device: the schedule's ids when every one is in the bank; else the seeded choice from the bank.
// { ids, scheduled } — `scheduled` false means the server cannot score it (a personal result only).
export function dailySet(bank, dateKey, schedule = null) {
  const ids = schedule?.days?.[dateKey];
  if (Array.isArray(ids) && ids.length === GLOBAL_SIZE && ids.every(id => bank?.byId?.has(id))) return { ids: [...ids], scheduled: true };
  return { ids: pickDailySet(bank?.questions || [], dateKey), scheduled: false };
}
