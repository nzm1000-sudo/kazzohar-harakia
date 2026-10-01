// בחן אותי — the player's progress, on this device only (localStorage, one versioned key; nothing is ever sent).
// Pure transitions (state in → state out) plus a thin read/write. A missing, broken or older record migrates safely;
// a record from a newer version of the app is read as far as it is understood and its unknown fields are kept.
import { CATEGORY_IDS, LEVEL_IDS, SESSION_SIZES, DEFAULT_SESSION_SIZE } from './catalog.mjs';
import { stageOf, VARIANTS } from './magenDavid.mjs';
import { ACHIEVEMENTS } from './achievements.mjs';

export const QUIZ_STORAGE_KEY = 'kz-quiz-v1';
export const LEGACY_QUIZ_KEYS = ['kz-quiz'];
export const QUIZ_SCHEMA_VERSION = 1;
export const SEEN_LIMIT = 3000; // the seen set keeps at most this many questions …
export const SEEN_MAX_AGE_DAYS = 180; // … and forgets a question this long after it was seen
const DAY = 24 * 60 * 60 * 1000;

const num = (v, min = 0) => (Number.isFinite(Number(v)) && Number(v) >= min ? Math.floor(Number(v)) : min);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export function emptyState() {
  return {
    schemaVersion: QUIZ_SCHEMA_VERSION,
    points: 0, answered: 0, correct: 0, sessions: 0, perfectSessions: 0, bestRun: 0,
    byCategory: {},
    days: { last: null, streak: 0, best: 0, count: 0 },
    seen: {}, // id → last seen (ms)
    mistakes: {}, // id → { at, misses, reviewId } — never the answer
    adaptive: 1,
    achievements: {}, // id → when earned (ms)
    flagged: {}, // id → when the player marked it "לא מתאימה" (ms): never asked again, listed in שאלות שסימנתי
    // reveal: after a wrong answer, show the correct option (off by default — the quiz never reveals unless asked).
    prefs: { category: 'all', level: 'adaptive', size: DEFAULT_SESSION_SIZE, timer: false, variant: 'classic', reveal: false },
  };
}

// Any stored value → a valid state. Unknown fields are kept (a newer app's data survives a round trip here).
export function normalizeState(raw) {
  const base = emptyState();
  const input = obj(raw);
  // v0 (an early prototype record without a version): { score, seenIds: [] }.
  const legacy = !input.schemaVersion && ('score' in input || 'seenIds' in input);
  const out = { ...input, ...base, schemaVersion: Math.max(QUIZ_SCHEMA_VERSION, num(input.schemaVersion)) };
  out.points = num(legacy ? input.score : input.points);
  for (const k of ['answered', 'correct', 'sessions', 'perfectSessions', 'bestRun']) out[k] = num(input[k]);
  out.answered = Math.max(out.answered, out.correct);
  out.byCategory = {};
  for (const [id, v] of Object.entries(obj(input.byCategory))) if (CATEGORY_IDS.includes(id)) out.byCategory[id] = { answered: num(v?.answered), correct: num(v?.correct) };
  const days = obj(input.days);
  out.days = { last: typeof days.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(days.last) ? days.last : null, streak: num(days.streak), best: num(days.best), count: num(days.count) };
  out.seen = {};
  if (legacy && Array.isArray(input.seenIds)) input.seenIds.forEach(id => { if (typeof id === 'string') out.seen[id] = 0; });
  for (const [id, at] of Object.entries(obj(input.seen))) if (Number.isFinite(Number(at))) out.seen[id] = Number(at);
  out.mistakes = {};
  for (const [id, v] of Object.entries(obj(input.mistakes))) out.mistakes[id] = { at: num(v?.at), misses: Math.max(1, num(v?.misses)), ...(v?.reviewId ? { reviewId: String(v.reviewId) } : {}) };
  out.adaptive = Math.min(3, Math.max(1, num(input.adaptive, 1)));
  out.achievements = {};
  for (const [id, at] of Object.entries(obj(input.achievements))) if (ACHIEVEMENTS.some(a => a.id === id)) out.achievements[id] = num(at);
  out.flagged = {};
  for (const [id, at] of Object.entries(obj(input.flagged))) if (id && Number.isFinite(Number(at))) out.flagged[id] = num(at);
  const prefs = obj(input.prefs);
  out.prefs = {
    category: prefs.category === 'all' || CATEGORY_IDS.includes(prefs.category) ? prefs.category : base.prefs.category,
    level: LEVEL_IDS.includes(prefs.level) ? prefs.level : base.prefs.level,
    size: SESSION_SIZES.includes(Number(prefs.size)) ? Number(prefs.size) : base.prefs.size,
    timer: prefs.timer === true,
    variant: VARIANTS.some(v => v.id === prefs.variant) ? prefs.variant : 'classic',
    reveal: prefs.reveal === true,
  };
  delete out.score; delete out.seenIds;
  return out;
}

const storageOf = storage => { if (storage !== undefined) return storage; try { return globalThis.localStorage || null; } catch { return null; } };

export function readQuizState(storage) {
  const s = storageOf(storage);
  try {
    const raw = s?.getItem(QUIZ_STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
    for (const key of LEGACY_QUIZ_KEYS) {
      const old = s?.getItem(key);
      if (old) { const migrated = normalizeState(JSON.parse(old)); writeQuizState(migrated, s); return migrated; }
    }
  } catch { /* a broken record reads as a fresh one; it is replaced on the next write */ }
  return emptyState();
}

export function writeQuizState(state, storage) {
  const s = storageOf(storage);
  try { s?.setItem(QUIZ_STORAGE_KEY, JSON.stringify(pruneSeen(state, Date.now()))); return true; } catch { return false; }
}

// The seen set decays: very old entries are forgotten, and it never grows past SEEN_LIMIT.
export function pruneSeen(state, now = Date.now()) {
  const cutoff = now - SEEN_MAX_AGE_DAYS * DAY;
  const kept = Object.entries(state.seen || {}).filter(([, at]) => at >= cutoff || at === 0).sort((a, b) => b[1] - a[1]).slice(0, SEEN_LIMIT);
  return { ...state, seen: Object.fromEntries(kept) };
}

// The device's local calendar day (the daily streak counts days with a completed session).
export function dayKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const previousDay = key => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d - 1, 12).getTime()); };

// One answer. Points accrue; a miss is remembered (to come back later, never with its answer), a later correct answer
// clears it.
export function applyAnswer(state, { question, correct, points = 0, now = Date.now(), adaptive }) {
  const next = { ...state, seen: { ...state.seen, [question.id]: now }, mistakes: { ...state.mistakes }, byCategory: { ...state.byCategory } };
  next.answered += 1;
  if (correct) { next.correct += 1; next.points += points; delete next.mistakes[question.id]; }
  else {
    const was = state.mistakes[question.id];
    next.mistakes[question.id] = { ...(was || {}), at: now, misses: (was?.misses || 0) + 1 };
  }
  const cat = next.byCategory[question.category] || { answered: 0, correct: 0 };
  next.byCategory[question.category] = { answered: cat.answered + 1, correct: cat.correct + (correct ? 1 : 0) };
  if (adaptive) next.adaptive = adaptive;
  return next;
}

// The end of a session: the daily streak, the counters, and any achievements newly earned.
export function applySessionEnd(state, { answered, correct, bestRun = 0, maxDifficultyRun = 0 }, now = Date.now()) {
  if (!answered) return { state, earned: [] };
  const today = dayKey(now);
  const days = { ...state.days };
  if (days.last !== today) {
    days.streak = days.last && previousDay(today) === days.last ? days.streak + 1 : 1;
    days.count += 1;
    days.last = today;
    days.best = Math.max(days.best, days.streak);
  }
  const next = { ...state, days, sessions: state.sessions + 1, bestRun: Math.max(state.bestRun, bestRun),
    perfectSessions: state.perfectSessions + (answered >= 10 && correct === answered ? 1 : 0) };
  const facts = { ...next, stage: stageOf(next.points).stage, session: { answered, correct, bestRun, maxDifficultyRun } };
  const earned = ACHIEVEMENTS.filter(a => !next.achievements[a.id] && a.test(facts));
  if (earned.length) next.achievements = { ...next.achievements, ...Object.fromEntries(earned.map(a => [a.id, now])) };
  return { state: next, earned };
}

// "לא מתאימה": the question is skipped (no score change), never asked again, and kept in the player's list. A pending
// mistake of it is dropped too (it would otherwise come back). Un-flagging returns it to the pool.
export function flagQuestion(state, id, now = Date.now()) {
  if (!id) return state;
  const mistakes = { ...state.mistakes };
  delete mistakes[id];
  return { ...state, mistakes, flagged: { ...(state.flagged || {}), [id]: now } };
}
export function unflagQuestion(state, id) {
  if (!state.flagged || !(id in state.flagged)) return state;
  const flagged = { ...state.flagged };
  delete flagged[id];
  return { ...state, flagged };
}
// The flagged ids, the most recent first.
export const flaggedIds = state => Object.entries(state.flagged || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id);

// Mistakes due to come back: after 1, 3, then 7 days (by how often the question was missed).
export const MISTAKE_DELAYS_DAYS = [1, 3, 7];
export function dueMistakes(state, now = Date.now()) {
  return Object.entries(state.mistakes || {})
    .filter(([id]) => !(state.flagged && id in state.flagged))
    .filter(([, m]) => now - m.at >= MISTAKE_DELAYS_DAYS[Math.min(MISTAKE_DELAYS_DAYS.length - 1, m.misses - 1)] * DAY)
    .sort((a, b) => a[1].at - b[1].at)
    .map(([id]) => id);
}

// A short summary for other screens (בשבילי היום): no question content, no answers.
export function quizSummary(state, now = Date.now()) {
  const s = stageOf(state.points);
  return { points: state.points, stage: s.stage, stageName: s.name, streakDays: state.days.last === dayKey(now) || state.days.last === previousDay(dayKey(now)) ? state.days.streak : 0,
    playedToday: state.days.last === dayKey(now), dueMistakes: dueMistakes(state, now).length, answered: state.answered };
}
