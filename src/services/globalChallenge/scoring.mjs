// האתגר העולמי — the rules of a day's score and its global numbers. Shared by the app and the server (the server is the
// one that scores for the leaderboard; the app scores the same way for the player's own result, offline too). Pure.

export const GLOBAL_SIZE = 5;
// The difficulties of the day's five questions, in order: two easy, two medium, one advanced.
export const SLOT_DIFFICULTIES = Object.freeze([1, 1, 2, 2, 3]);
// The leaderboard's points for a right answer, by difficulty (the quiz's own base points — services/quiz/scoring.mjs).
export const DAY_POINTS = Object.freeze({ 1: 10, 2: 15, 3: 20 });
export const DAY_MAX_POINTS = SLOT_DIFFICULTIES.reduce((sum, d) => sum + DAY_POINTS[d], 0);
// The clock of each question (the ladder's 30 seconds — services/quiz/clock.mjs TIMER_SECONDS). A question whose clock
// ran out is a wrong answer.
export const QUESTION_SECONDS = 30;
export const QUESTION_MS = QUESTION_SECONDS * 1000;
// The beat an answer may claim beyond its clock (the tap landing as the clock reaches 0). An answer that claims more
// scores 0 — on the server and in the app alike (scoreAnswers).
export const ANSWER_GRACE_MS = 1500;
export const MAX_ANSWER_MS = QUESTION_MS + ANSWER_GRACE_MS;
// From the server's start to the submission: the five clocks and a small grace for the network and the beats between
// the questions (the app moves on by itself after each verdict — services/quiz/clock.mjs AUTO_ADVANCE_MS). The server
// refuses a later submission as 'late' (owner, 2026-10-03: 30 seconds a question, enforced by the server).
export const NETWORK_GRACE_MS = 20 * 1000;
export const TIME_BUDGET_MS = GLOBAL_SIZE * QUESTION_MS + NETWORK_GRACE_MS;
// Garbage guard only: an `ms` beyond this is not a time at all (the request is refused as 'ms').
export const MS_SANITY_MAX = 24 * 60 * 60 * 1000;

const isChoice = c => c === null || (Number.isInteger(c) && c >= 0 && c <= 3);

// Validates the answers of a submission against the day's key ([[qid, answer, difficulty] × 5]). Returns the problem
// ('answers' · 'qid' · 'choice' · 'ms') or null.
export function answersProblem(key, answers) {
  if (!Array.isArray(answers) || answers.length !== GLOBAL_SIZE || !Array.isArray(key) || key.length !== GLOBAL_SIZE) return 'answers';
  for (let i = 0; i < GLOBAL_SIZE; i += 1) {
    const a = answers[i];
    if (!a || typeof a !== 'object') return 'answers';
    if (a.qid !== key[i][0]) return 'qid';
    if (!isChoice(a.choice ?? null)) return 'choice';
    if (!Number.isInteger(a.ms) || a.ms < 0 || a.ms > MS_SANITY_MAX) return 'ms';
  }
  return null;
}

// An answer within its clock (and the beat): only such an answer can be right. A missing `ms` (an old record) is taken
// as within.
export const answerInTime = a => !Number.isFinite(a?.ms) || a.ms <= MAX_ANSWER_MS;

// The score: right answers, points, and each question right or not (a choice of null is a question whose clock ran out;
// an answer that claims more than its clock allows scores 0).
export function scoreAnswers(key, answers) {
  const perQuestion = key.map(([qid, answer], i) => answers[i]?.qid === qid && Number.isInteger(answers[i]?.choice) && answers[i].choice === answer && answerInTime(answers[i]));
  const correct = perQuestion.filter(Boolean).length;
  const points = key.reduce((sum, [, , difficulty], i) => sum + (perQuestion[i] ? DAY_POINTS[difficulty] || DAY_POINTS[1] : 0), 0);
  return { correct, points, perQuestion };
}

// The day's global numbers as the server keeps them (counters updated on each submission, never a scan): n answered,
// c[i] right on question i, h[k] answered exactly k right. → percentages for the screen.
// The timing of a submission with a signed start, against the server's own clock: 'late' — it arrived after the
// five clocks and the grace (TIME_BUDGET_MS from the start); 'timing' — its answers claim more time than has passed
// since the start (beyond the grace); null — possible.
export function timingProblem(answers, elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs > TIME_BUDGET_MS) return 'late';
  const claimed = (answers || []).reduce((sum, a) => sum + (Number.isFinite(a?.ms) ? a.ms : 0), 0);
  if (claimed > Math.max(0, elapsedMs) + NETWORK_GRACE_MS) return 'timing';
  return null;
}

export function emptyDayStats() { return { n: 0, c: Array(GLOBAL_SIZE).fill(0), h: Array(GLOBAL_SIZE + 1).fill(0) }; }
export function addToDayStats(stats, perQuestion) {
  const out = { n: stats.n + 1, c: [...stats.c], h: [...stats.h] };
  perQuestion.forEach((right, i) => { if (right) out.c[i] += 1; });
  out.h[perQuestion.filter(Boolean).length] += 1;
  return out;
}
export const percent = (part, whole) => (whole > 0 ? Math.round((100 * part) / whole) : 0);
export const correctPercents = stats => stats.c.map(c => percent(c, stats.n));
// The share of today's players who answered fewer right than `correct` (whole percent, rounded down so "more than" is
// always true).
export function shareBelow(stats, correct) {
  if (!stats || !(stats.n > 0)) return 0;
  const below = stats.h.slice(0, Math.max(0, correct)).reduce((a, b) => a + b, 0);
  return Math.floor((100 * below) / stats.n);
}
