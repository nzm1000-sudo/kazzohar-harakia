// בחן אותי — a session: the next question, the answer, the adaptive level. Pure (the clock and the randomness are
// passed in), so it can be tested exactly.
import { LEVELS } from './catalog.mjs';
import { isCorrect } from './bank.mjs';
import { adaptAfter, pointsFor } from './scoring.mjs';

const DAY = 24 * 60 * 60 * 1000;
export const MAX_REVIEW_PER_SESSION = 2; // mistakes that come back within an ordinary session
export const REVIEW_SLOT_EVERY = 4; // … at the 4th and 8th question

export function createSession({ category = 'all', level = 'adaptive', size = 10, adaptiveStart = 1, mode = 'play', reviewIds = [], dueIds = [] } = {}) {
  const fixed = LEVELS.find(l => l.id === level)?.difficulty;
  return {
    category, level, size: mode === 'review' ? Math.min(size, reviewIds.length) : size, mode,
    difficulty: fixed || Math.min(3, Math.max(1, Number(adaptiveStart) || 1)), up: 0, down: 0,
    asked: [], results: [], points: 0, run: 0, bestRun: 0, hardRun: 0, maxHardRun: 0, reviewed: 0,
    queue: mode === 'review' ? [...reviewIds] : [], due: mode === 'review' ? [] : [...dueIds],
  };
}

// How recently a question was seen, in bands: 0 never · 1 over a month ago · 2 over a week · 3 over a day · 4 today.
export function recencyBand(seenAt, now) {
  if (seenAt === undefined || seenAt === null) return 0;
  const age = now - seenAt;
  if (age >= 30 * DAY) return 1;
  if (age >= 7 * DAY) return 2;
  if (age >= DAY) return 3;
  return 4;
}

const inCategory = (session, q) => session.category === 'all' || q.category === session.category;

// The next question, or null when the session is complete (or nothing is left to ask).
export function pickNext(session, bank, { seen = {}, now = Date.now(), rng = Math.random } = {}) {
  if (session.asked.length >= session.size) return null;
  const asked = new Set(session.asked);
  if (session.mode === 'review') {
    const id = session.queue.find(x => !asked.has(x) && bank.byId.has(x));
    return id ? bank.byId.get(id) : null;
  }
  // A missed question comes back now and then (its answer was never shown).
  if (session.reviewed < MAX_REVIEW_PER_SESSION && (session.asked.length + 1) % REVIEW_SLOT_EVERY === 0) {
    const id = session.due.find(x => !asked.has(x) && bank.byId.has(x) && inCategory(session, bank.byId.get(x)));
    if (id) return bank.byId.get(id);
  }
  const target = session.difficulty;
  const candidates = bank.questions.filter(q => !asked.has(q.id) && inCategory(session, q));
  if (!candidates.length) return null;
  // Prefer: not seen this past week › the level asked for (nearest first) › the least recently seen.
  const keyOf = q => { const band = recencyBand(seen[q.id], now); return [band >= 3 ? 1 : 0, Math.abs(q.difficulty - target), band]; };
  let best = null; let group = [];
  for (const q of candidates) {
    const k = keyOf(q);
    const cmp = best ? (k[0] - best[0]) || (k[1] - best[1]) || (k[2] - best[2]) : -1;
    if (cmp < 0) { best = k; group = [q]; } else if (cmp === 0) group.push(q);
  }
  // Among questions seen before, only the older half is eligible (the seen set decays gradually, not all at once).
  if (best[2] > 0) { group.sort((a, b) => (seen[a.id] ?? 0) - (seen[b.id] ?? 0) || a.id.localeCompare(b.id)); group = group.slice(0, Math.max(1, Math.ceil(group.length / 2))); }
  return group[Math.min(group.length - 1, Math.floor(rng() * group.length))];
}

// Answers the current question. `choice` null means the optional timer ran out (counted as a miss, nothing revealed).
// Returns the new session and the result { correct, points } — never the correct option.
export function answerQuestion(session, question, choice) {
  const correct = isCorrect(question, choice);
  const run = correct ? session.run + 1 : 0;
  const points = pointsFor({ correct, difficulty: question.difficulty, run });
  const adaptive = session.level === 'adaptive' ? adaptAfter(session, correct) : { difficulty: session.difficulty, up: 0, down: 0 };
  const hardRun = correct && question.difficulty === 3 ? session.hardRun + 1 : 0;
  const wasDue = session.due.includes(question.id);
  const next = {
    ...session, ...adaptive,
    asked: [...session.asked, question.id],
    results: [...session.results, { id: question.id, correct, points, difficulty: question.difficulty, category: question.category }],
    points: session.points + points, run, bestRun: Math.max(session.bestRun, run), hardRun, maxHardRun: Math.max(session.maxHardRun, hardRun),
    reviewed: session.reviewed + (wasDue ? 1 : 0),
  };
  return { session: next, result: { correct, points } };
}

export const sessionDone = session => session.asked.length >= session.size;
export function sessionSummary(session) {
  const correct = session.results.filter(r => r.correct).length;
  return { answered: session.results.length, correct, points: session.points, bestRun: session.bestRun, maxDifficultyRun: session.maxHardRun };
}
