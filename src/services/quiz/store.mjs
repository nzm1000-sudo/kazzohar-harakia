// שעשועון טריוויה יהודי (formerly בחן אותי) — the player's progress, on this device only (localStorage, one versioned key; nothing is ever sent).
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
    // confirm: the ladder asks "תשובה סופית?" before grading (on by default); sound: soft generated sounds (off by default).
    // timer: 30 seconds a question, in the ladder, the challenge and free practice (off by default).
    // explain ("הסבר קצר", on by default): after an answer the question's short explanation stays until "לשאלה הבאה" —
    // after a right answer, or after a miss only when reveal is on (it would tell the answer); otherwise the game moves on
    // by itself after the verdict.
    prefs: { category: 'all', level: 'adaptive', size: DEFAULT_SESSION_SIZE, timer: false, variant: 'classic', reveal: false, confirm: true, sound: false, explain: true },
    // הסולם — the game's records: games played, ladders completed, the highest step, the best and total points of the
    // ladder (its own score; the star grows by the ordinary answer points), and the daily challenge by day.
    ladder: emptyLadderRecord(),
  };
}

// The challenge (still called אתגר יומי) renews every four hours of the device's clock: 00–04, 04–08 … 20–24. A round's key
// is its day and its first hour — '2026-10-01@12' is 12:00–16:00 — the seed of its fifteen questions, and the key of its
// one result. Results kept: the last DAILY_KEEP_ROUNDS rounds played (60 days' worth at one a day, as before).
export const DAILY_WINDOW_HOURS = 4;
export const DAILY_ROUNDS = 24 / DAILY_WINDOW_HOURS;
export const DAILY_KEEP_ROUNDS = 180;
export const LOG_KEEP_DAYS = 120;
const ROUND_KEY = /^(\d{4}-\d{2}-\d{2})@(\d{2})$/;
const two = n => String(n).padStart(2, '0');
export function windowKey(now = Date.now()) {
  const d = new Date(now);
  return `${dayKey(now)}@${two(Math.floor(d.getHours() / DAILY_WINDOW_HOURS) * DAILY_WINDOW_HOURS)}`;
}
export const isWindowKey = key => { const m = ROUND_KEY.exec(String(key || '')); return Boolean(m) && Number(m[2]) % DAILY_WINDOW_HOURS === 0 && Number(m[2]) < 24; };
// A round: its day, its number in the day (1–6), its hours ('12:00–16:00'), and when it starts and ends (ms, local clock).
export function windowOf(key) {
  if (!isWindowKey(key)) return null;
  const [, day, hh] = ROUND_KEY.exec(key);
  const [y, m, d] = day.split('-').map(Number);
  const from = Number(hh);
  const to = from + DAILY_WINDOW_HOURS;
  return { key, day, round: from / DAILY_WINDOW_HOURS + 1, from, to, hours: `${two(from)}:00–${two(to % 24)}:00`,
    start: new Date(y, m - 1, d, from).getTime(), end: new Date(y, m - 1, d, to).getTime() };
}
// How a round is named in words (the share text, the card): 'סבב 4 · 12:00–16:00' — the hours isolated left-to-right
// (U+2066 … U+2069), so they never read backwards inside Hebrew.
export function windowLabel(key) {
  const w = windowOf(key);
  return w ? `סבב ${w.round} · \u2066${w.hours}\u2069` : '';
}
// The time left in the current round (the next challenge opens when it is 0).
export function msToNextWindow(now = Date.now()) {
  const d = new Date(now);
  const to = (Math.floor(d.getHours() / DAILY_WINDOW_HOURS) + 1) * DAILY_WINDOW_HOURS;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), to, 0, 0).getTime() - now;
}
// A stored result's key: a round's key as is; a day's key from before the rounds (one challenge a day) becomes the round
// it was played in (by its time, when that time is on that day), else the day's first round.
function roundKeyOf(key, at) {
  if (isWindowKey(key)) return key;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  return at > 0 && dayKey(at) === key ? windowKey(at) : `${key}@00`;
}
// `log`: the ladder points banked per day (day → points), for the weekly record against the player's own weeks.
// `beginner`: מסלול למתחילים (three mistakes allowed) keeps its own records — its games, wins, highest step, best and
// total points and its own day log — so a beginner's game never touches the champion's records above (השיאים שלי, the
// ladder achievements, the week's chart: those stay one-mistake games only).
export const emptyLadderRecord = () => ({ games: 0, wins: 0, best: 0, bestPoints: 0, total: 0, last: null, daily: {}, log: {}, beginner: emptyBeginnerRecord() });
export const emptyBeginnerRecord = () => ({ games: 0, wins: 0, best: 0, bestPoints: 0, total: 0, log: {} });
const MARKS = ['right', 'wrong', 'open'];
const normalizeLog = raw => Object.fromEntries(Object.entries(obj(raw)).filter(([day, v]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Number(v)))
  .sort((a, b) => b[0].localeCompare(a[0])).slice(0, LOG_KEEP_DAYS).map(([day, v]) => [day, num(v)]));
function normalizeBeginner(raw) {
  const input = obj(raw);
  const out = emptyBeginnerRecord();
  for (const k of ['games', 'wins', 'bestPoints', 'total']) out[k] = num(input[k]);
  out.best = Math.min(15, num(input.best));
  out.log = normalizeLog(input.log);
  return out;
}
function normalizeLadder(raw) {
  const input = obj(raw);
  const out = { ...emptyLadderRecord() };
  for (const k of ['games', 'wins', 'bestPoints', 'total']) out[k] = num(input[k]);
  out.best = Math.min(15, num(input.best));
  out.beginner = normalizeBeginner(input.beginner);
  out.last = typeof input.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.last) ? input.last : null;
  // Rounds kept by key (an older day's result migrates to its round; when two land on one round the first played stands).
  const rounds = {};
  for (const [key, v] of Object.entries(obj(input.daily))) {
    const round = roundKeyOf(key, num(v?.at));
    if (!round) continue;
    const entry = { climbed: Math.min(15, num(v?.climbed)), banked: num(v?.banked), status: ['won', 'lost', 'walked'].includes(v?.status) ? v.status : 'walked',
      marks: Array.isArray(v?.marks) && v.marks.length === 15 ? v.marks.map(m => (MARKS.includes(m) ? m : 'open')) : Array(15).fill('open'), at: num(v?.at) };
    if (!rounds[round] || (entry.at && entry.at < rounds[round].at)) rounds[round] = entry;
  }
  out.daily = Object.fromEntries(Object.entries(rounds).sort((a, b) => b[0].localeCompare(a[0])).slice(0, DAILY_KEEP_ROUNDS));
  out.log = normalizeLog(input.log);
  return out;
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
    confirm: prefs.confirm !== false,
    sound: prefs.sound === true,
    explain: prefs.explain !== false,
  };
  out.ladder = normalizeLadder(input.ladder);
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

// The end of a ladder game (הסולם or the challenge): its records, and the round's result for the challenge (kept for the
// result card; at most one per four-hour round — the first). `summary` comes from ladder.mjs ladderSummary.
export function applyLadderEnd(state, summary, now = Date.now()) {
  const rec = normalizeLadder(state.ladder);
  if (summary.track === 'beginner' && summary.kind !== 'daily') {
    const b = rec.beginner;
    const today = dayKey(now);
    const beginner = { games: b.games + 1, wins: b.wins + (summary.status === 'won' ? 1 : 0), best: Math.max(b.best, summary.climbed),
      bestPoints: Math.max(b.bestPoints, summary.banked), total: b.total + summary.banked,
      log: Object.fromEntries(Object.entries({ ...b.log, [today]: (b.log[today] || 0) + summary.banked }).sort((x, y) => y[0].localeCompare(x[0])).slice(0, LOG_KEEP_DAYS)) };
    return { ...state, ladder: { ...rec, beginner } };
  }
  const ladder = { ...rec, games: rec.games + 1, wins: rec.wins + (summary.status === 'won' ? 1 : 0), best: Math.max(rec.best, summary.climbed),
    bestPoints: Math.max(rec.bestPoints, summary.banked), total: rec.total + summary.banked, last: dayKey(now), daily: { ...rec.daily },
    log: Object.fromEntries(Object.entries({ ...rec.log, [dayKey(now)]: (rec.log[dayKey(now)] || 0) + summary.banked }).sort((a, b) => b[0].localeCompare(a[0])).slice(0, LOG_KEEP_DAYS)) };
  const round = summary.kind === 'daily' && summary.day ? roundKeyOf(summary.day, now) : null;
  if (round && !ladder.daily[round]) {
    ladder.daily[round] = { climbed: summary.climbed, banked: summary.banked, status: summary.status, marks: [...summary.marks], at: now };
    ladder.daily = Object.fromEntries(Object.entries(ladder.daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, DAILY_KEEP_ROUNDS));
  }
  return { ...state, ladder };
}
// The track chosen at the ladder's way in (מסלול אלוף · מסלול למתחילים), remembered on this device. Guarded: a storage
// that throws reads as the champion's track and simply does not remember.
export const LADDER_TRACK_KEY = 'kz-quiz-track';
export function readLadderTrack(storage) {
  try { return storageOf(storage)?.getItem(LADDER_TRACK_KEY) === 'beginner' ? 'beginner' : 'champion'; } catch { return 'champion'; }
}
export function writeLadderTrack(track, storage) {
  try { storageOf(storage)?.setItem(LADDER_TRACK_KEY, track === 'beginner' ? 'beginner' : 'champion'); return true; } catch { return false; }
}
// The result of a round (the current one by default).
export const dailyResult = (state, key = windowKey()) => state?.ladder?.daily?.[key] || null;

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
    playedToday: state.days.last === dayKey(now), dueMistakes: dueMistakes(state, now).length, answered: state.answered,
    ladderBest: state.ladder?.best || 0, dailyDone: Boolean(state.ladder?.daily?.[windowKey(now)]) };
}
