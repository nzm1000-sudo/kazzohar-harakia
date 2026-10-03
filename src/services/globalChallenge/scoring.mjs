// האתגר העולמי — the rules of a day's score and its global numbers. Shared by the app and the server (the server is the
// one that scores for the leaderboard; the app scores the same way for the player's own result, offline too). Pure.

export const GLOBAL_SIZE = 5;
// The difficulties of the day's five questions, in order: two easy, two medium, one advanced.
export const SLOT_DIFFICULTIES = Object.freeze([1, 1, 2, 2, 3]);
// The leaderboard's points for a right answer, by difficulty (the quiz's own base points — services/quiz/scoring.mjs).
export const DAY_POINTS = Object.freeze({ 1: 10, 2: 15, 3: 20 });
export const DAY_MAX_POINTS = SLOT_DIFFICULTIES.reduce((sum, d) => sum + DAY_POINTS[d], 0);
// The clock of each question (the ladder's 30 seconds — services/quiz/clock.mjs TIMER_SECONDS).
export const QUESTION_SECONDS = 30;
// From the server's start to the submission: five clocks and the pauses between them (the verdict, "הסבר קצר", which
// waits for the tap) — fifteen minutes is generous for a player, short for a search of every answer.
export const TIME_BUDGET_MS = 15 * 60 * 1000;
// The longest time an answer may claim (its clock plus a beat for the tap).
export const MAX_ANSWER_MS = (QUESTION_SECONDS + 5) * 1000;

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
    if (!Number.isInteger(a.ms) || a.ms < 0 || a.ms > MAX_ANSWER_MS) return 'ms';
  }
  return null;
}

// The score: right answers, points, and each question right or not (a choice of null is a question whose clock ran out).
export function scoreAnswers(key, answers) {
  const perQuestion = key.map(([qid, answer], i) => answers[i]?.qid === qid && Number.isInteger(answers[i]?.choice) && answers[i].choice === answer);
  const correct = perQuestion.filter(Boolean).length;
  const points = key.reduce((sum, [, , difficulty], i) => sum + (perQuestion[i] ? DAY_POINTS[difficulty] || DAY_POINTS[1] : 0), 0);
  return { correct, points, perQuestion };
}

// The day's global numbers as the server keeps them (counters updated on each submission, never a scan): n answered,
// c[i] right on question i, h[k] answered exactly k right. → percentages for the screen.
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
