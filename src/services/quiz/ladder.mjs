// שעשועון טריוויה יהודי — הסולם: fifteen rising steps (the fifteen steps of the Temple's courtyard, on which the Levites
// sang the fifteen שיר המעלות — Middot 2:5), two safe steps, three lifelines, and the daily challenge. Pure: the bank,
// the clock and the randomness come in, so every rule can be tested exactly. Points here are the game's own score —
// no money, nothing to buy, and they never touch the spiritual circle (the ring).
import { isCorrect } from './bank.mjs';
import { pointsFor } from './scoring.mjs';
import { recencyBand } from './session.mjs';

export const LADDER_SIZE = 15;
export const SAFE_STEPS = [5, 10];
const POINTS = [10, 20, 30, 50, 100, 150, 200, 300, 400, 500, 650, 800, 1000, 1300, 1800];
// Hebrew numerals for the steps (ט״ו and ט״ז, never the letters of the Name).
export const STEP_NUMERALS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳', 'י״א', 'י״ב', 'י״ג', 'י״ד', 'ט״ו'];
export const LADDER_STEPS = Object.freeze(POINTS.map((points, i) => Object.freeze({
  step: i + 1, points, difficulty: i < 5 ? 1 : i < 10 ? 2 : 3, safe: SAFE_STEPS.includes(i + 1), numeral: STEP_NUMERALS[i],
})));
export const LADDER_TOP = POINTS[POINTS.length - 1];

export const LIFELINES = Object.freeze([
  { id: 'fifty', label: 'חמישים–חמישים', short: '50:50', detail: 'שתי תשובות שגויות יוסרו' },
  { id: 'audience', label: 'שאל את הקהל', short: 'הקהל', detail: 'הדמיה של תשובות קהל — לא אנשים אמיתיים' },
  { id: 'swap', label: 'החלפת שאלה', short: 'החלפה', detail: 'שאלה אחרת באותה מדרגה' },
]);
export const AUDIENCE_NOTE = 'הדמיה: חלוקה מחושבת במכשיר, לא קהל אמיתי';

// Points held after `climbed` steps, and the floor a miss falls to (the last safe step reached, or nothing).
export const pointsAt = climbed => (climbed > 0 ? POINTS[Math.min(LADDER_SIZE, climbed) - 1] : 0);
export const safeFloor = climbed => pointsAt(SAFE_STEPS.filter(s => s <= climbed).pop() || 0);
export const nextSafeStep = climbed => SAFE_STEPS.find(s => s > climbed) || null;

// The difficulty asked at a step: 1 for steps 1–5, 2 for 6–10, 3 for 11–15. Adaptive: a player whose level (the
// quiz's own adaptive level, 1–3) is already advanced meets the next band one step early at the top of each band.
export function stepDifficulty(step, skill = 1) {
  const base = step <= 5 ? 1 : step <= 10 ? 2 : 3;
  if (Number(skill) >= 3 && base < 3 && (step === 5 || step === 10)) return base + 1;
  return base;
}

// A deterministic generator (mulberry32) and a string hash, for the daily challenge and its lifelines.
export function seededRandom(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashString(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const shuffled = (list, rng) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

// The challenge: the same fifteen questions for everyone in a given four-hour round (`day` is the round's key,
// store.mjs windowKey — '2026-10-01@12'; any string seeds it) (from every area, by the step's
// difficulty), plus three alternates per step for "החלפת שאלה" and for a question the player set aside. Independent of
// the order of the bank and of anything personal.
export const DAILY_ALTERNATES = 3;
export function dailyPlan(bank, day) {
  const rng = seededRandom(`kz-daily:${day}`);
  const byDifficulty = { 1: [], 2: [], 3: [] };
  for (const q of [...(bank?.questions || [])].sort((a, b) => a.id.localeCompare(b.id))) byDifficulty[q.difficulty]?.push(q.id);
  const lists = { 1: shuffled(byDifficulty[1], rng), 2: shuffled(byDifficulty[2], rng), 3: shuffled(byDifficulty[3], rng) };
  return LADDER_STEPS.map(({ step, difficulty }) => {
    const list = lists[difficulty];
    const k = (step - 1) % 5;
    const ids = [list[k], ...Array.from({ length: DAILY_ALTERNATES }, (_, j) => list[5 + k * DAILY_ALTERNATES + j])];
    return ids.filter(Boolean);
  });
}

// Two tracks of הסולם. מסלול אלוף (the original): one mistake ends the game. מסלול למתחילים: three mistakes are allowed —
// after a mistake (a wrong answer or the clock running out) the verdict shows as ever, one of the three lives is lost,
// and the game goes on at the same step with another question; the third mistake ends it (as the champion's one does:
// the points fall to the last safe step). The daily challenge is always the champion's track (the same game for all).
export const TRACKS = Object.freeze([
  Object.freeze({ id: 'champion', name: 'מסלול אלוף', detail: 'טעות אחת', lives: 1 }),
  Object.freeze({ id: 'beginner', name: 'מסלול למתחילים', detail: 'שלוש טעויות', lives: 3 }),
]);
export const TRACK_IDS = TRACKS.map(t => t.id);
export const BEGINNER_LIVES = 3;
export const trackOf = ladder => (ladder?.track === 'beginner' && ladder.kind !== 'daily' ? 'beginner' : 'champion');
export const livesTotal = ladder => (trackOf(ladder) === 'beginner' ? BEGINNER_LIVES : 1);
// The lives left (a game kept from before the tracks has none written: the champion's one).
export const livesLeft = ladder => (Number.isInteger(ladder?.lives) ? Math.max(0, ladder.lives) : ladder?.status === 'lost' ? 0 : livesTotal(ladder));
// The right answers in a row at the end of the game so far (on the champion's track, the steps climbed).
export const runOf = ladder => { let n = 0; for (let i = (ladder?.results || []).length - 1; i >= 0 && ladder.results[i].correct; i -= 1) n += 1; return n; };

export function createLadder({ category = 'all', skill = 1, daily = null, plan = null, track = 'champion' } = {}) {
  const t = !daily && track === 'beginner' ? 'beginner' : 'champion';
  return {
    kind: daily ? 'daily' : 'ladder', day: daily, category: daily ? 'all' : category, skill: Math.min(3, Math.max(1, Number(skill) || 1)),
    track: t, lives: t === 'beginner' ? BEGINNER_LIVES : 1,
    plan: daily ? plan || [] : null,
    climbed: 0, asked: [], skipped: [], results: [],
    used: { fifty: false, audience: false, swap: false },
    removed: [], audience: null,
    status: 'playing', banked: 0,
  };
}

export const currentStep = ladder => LADDER_STEPS[Math.min(LADDER_SIZE, ladder.climbed + 1) - 1];

// Before the next question: the lifelines' marks of the last one are cleared (they stay on screen with its verdict).
export const clearAids = ladder => (ladder.removed.length || ladder.audience ? { ...ladder, removed: [], audience: null } : ladder);

// The question for the current step, or null when the game is over (or nothing is left). Never a question already
// asked, set aside or flagged "לא מתאימה". The ordinary ladder prefers the step's difficulty exactly, then what was not
// seen this past week, then the least recently seen.
export function ladderPick(ladder, bank, { seen = {}, flagged = {}, now = Date.now(), rng = Math.random } = {}) {
  if (ladder.status !== 'playing' || ladder.climbed >= LADDER_SIZE) return null;
  const excluded = new Set([...ladder.asked, ...ladder.skipped, ...Object.keys(flagged || {})]);
  if (ladder.kind === 'daily') {
    const id = (ladder.plan?.[ladder.climbed] || []).find(x => !excluded.has(x) && bank.byId.has(x));
    if (id) return bank.byId.get(id);
  }
  const target = ladder.kind === 'daily' ? LADDER_STEPS[ladder.climbed].difficulty : stepDifficulty(ladder.climbed + 1, ladder.skill);
  const candidates = bank.questions.filter(q => !excluded.has(q.id) && (ladder.category === 'all' || q.category === ladder.category));
  if (!candidates.length) return null;
  const keyOf = q => { const band = recencyBand(seen[q.id], now); return [Math.abs(q.difficulty - target), band >= 3 ? 1 : 0, band]; };
  let best = null; let group = [];
  for (const q of candidates) {
    const k = keyOf(q);
    const cmp = best ? (k[0] - best[0]) || (k[1] - best[1]) || (k[2] - best[2]) : -1;
    if (cmp < 0) { best = k; group = [q]; } else if (cmp === 0) group.push(q);
  }
  if (best[2] > 0) { group.sort((a, b) => (seen[a.id] ?? 0) - (seen[b.id] ?? 0) || a.id.localeCompare(b.id)); group = group.slice(0, Math.max(1, Math.ceil(group.length / 2))); }
  return group[Math.min(group.length - 1, Math.floor(rng() * group.length))];
}

// The answer (the final one). Right: one step up (the fifteenth ends the game — סיום הסולם). Wrong: a life is lost; with
// none left the game ends and the points fall to the last safe step; with lives left (מסלול למתחילים) the game goes on at
// the same step, the points held as they were. `result.points` is the quiz's ordinary measure (it grows the Magen David).
export function answerLadder(ladder, question, choice) {
  if (ladder.status !== 'playing') return { ladder, result: null };
  const correct = isCorrect(question, choice);
  const step = ladder.climbed + 1;
  const climbed = correct ? step : ladder.climbed;
  const lives = correct ? livesLeft(ladder) : Math.max(0, livesLeft(ladder) - 1);
  const status = !correct ? (lives > 0 ? 'playing' : 'lost') : climbed >= LADDER_SIZE ? 'won' : 'playing';
  const banked = correct || status === 'playing' ? pointsAt(climbed) : safeFloor(ladder.climbed);
  const next = {
    ...ladder, climbed, status, banked, lives,
    asked: [...ladder.asked, question.id],
    results: [...ladder.results, { id: question.id, step, correct, difficulty: question.difficulty, category: question.category }],
  };
  const points = pointsFor({ correct, difficulty: question.difficulty, run: correct ? step : 0 });
  return { ladder: next, result: { correct, points, step, climbed, banked, status, safe: correct && SAFE_STEPS.includes(step), lives, track: trackOf(ladder) } };
}

// "לסיים ולשמור": the points of the steps climbed are kept.
export function walkAway(ladder) {
  if (ladder.status !== 'playing') return ladder;
  return { ...ladder, status: 'walked', banked: pointsAt(ladder.climbed), removed: [], audience: null };
}

// חמישים–חמישים: two wrong options go (chosen at random), never the correct one. Once a game.
export function applyFifty(ladder, question, rng = Math.random) {
  if (ladder.status !== 'playing' || ladder.used.fifty) return ladder;
  const wrong = [0, 1, 2, 3].filter(i => i !== question.answer && !ladder.removed.includes(i));
  const removed = shuffled(wrong, rng).slice(0, 2).sort((a, b) => a - b);
  const audience = ladder.audience ? ladder.audience.map((v, i) => (removed.includes(i) ? 0 : v)) : null;
  return { ...ladder, used: { ...ladder.used, fifty: true }, removed, audience: audience ? rebalance(audience, question.answer, removed) : null };
}

// שאל את הקהל — a simulation, computed on the device: the share of the correct option leans with the step (a clear
// majority on the easy steps, a narrow lead on the hard ones), it is always the largest, never 100, and the shares sum
// to exactly 100. Options removed by 50:50 get nothing.
export function audiencePoll(question, step = 1, removed = [], rng = Math.random) {
  const live = [0, 1, 2, 3].filter(i => !removed.includes(i));
  const t = Math.min(1, Math.max(0, (step - 1) / (LADDER_SIZE - 1)));
  const lead = live.length <= 2 ? 0.66 - 0.12 * t : 0.62 - 0.26 * t; // the expected share of the correct option
  let correctShare = Math.round((lead + (rng() - 0.5) * 0.12) * 100);
  correctShare = Math.min(88, Math.max(live.length <= 2 ? 52 : 30, correctShare));
  const others = live.filter(i => i !== question.answer);
  const weights = others.map(() => 0.55 + rng());
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const rest = 100 - correctShare;
  const raw = others.map((_, k) => (weights[k] / sum) * rest);
  const floor = raw.map(Math.floor);
  let left = rest - floor.reduce((a, b) => a + b, 0);
  raw.map((v, k) => [v - floor[k], k]).sort((a, b) => b[0] - a[0]).forEach(([, k]) => { if (left > 0) { floor[k] += 1; left -= 1; } });
  const poll = [0, 0, 0, 0];
  poll[question.answer] = correctShare;
  others.forEach((i, k) => { poll[i] = floor[k]; });
  return rebalance(poll, question.answer, removed);
}
// Keeps the rules: removed options 0, every live wrong option at least 1, the correct one strictly the largest and at
// most 90, the total exactly 100.
function rebalance(poll, answer, removed) {
  const out = poll.map((v, i) => (removed.includes(i) ? 0 : Math.max(0, Math.round(v))));
  const others = [0, 1, 2, 3].filter(i => i !== answer && !removed.includes(i));
  others.forEach(i => { if (out[i] < 1) out[i] = 1; });
  const total = () => out.reduce((a, b) => a + b, 0);
  out[answer] += 100 - total();
  for (let guard = 0; guard < 400; guard += 1) {
    const top = others.reduce((m, i) => (out[i] > out[m] ? i : m), others[0]);
    if (out[answer] > 90) { const low = others.reduce((m, i) => (out[i] < out[m] ? i : m), others[0]); out[answer] -= 1; out[low] += 1; continue; }
    if (others.length && out[top] >= out[answer]) { out[top] -= 1; out[answer] += 1; continue; }
    break;
  }
  return out;
}
export function applyAudience(ladder, question, rng = Math.random) {
  if (ladder.status !== 'playing' || ladder.used.audience) return ladder;
  return { ...ladder, used: { ...ladder.used, audience: true }, audience: audiencePoll(question, ladder.climbed + 1, ladder.removed, rng) };
}

// החלפת שאלה: the current question is set aside (not answered, no points) and another of the same step takes its place
// (the page picks it with ladderPick — the same step, so the same difficulty).
export function applySwap(ladder, question) {
  if (ladder.status !== 'playing' || ladder.used.swap || !question) return ladder;
  return { ...ladder, used: { ...ladder.used, swap: true }, skipped: [...ladder.skipped, question.id], removed: [], audience: null };
}
// "לא מתאימה" before an answer: set aside like a swap, but without using the lifeline.
export function setAside(ladder, question) {
  if (!question || ladder.asked.includes(question.id) || ladder.skipped.includes(question.id)) return ladder;
  return { ...ladder, skipped: [...ladder.skipped, question.id], removed: [], audience: null };
}

// The marks of a finished game — one per step: 'right' · 'wrong' · 'open' (not reached). A step climbed after a
// mistake (מסלול למתחילים) is 'right'. Never anything about the answers themselves (they can be shared).
export function ladderMarks(ladder) {
  return LADDER_STEPS.map(({ step }) => {
    const at = ladder.results.filter(x => x.step === step);
    return at.length ? (at.some(x => x.correct) ? 'right' : 'wrong') : 'open';
  });
}
export const MARK_GLYPH = { right: '◆', wrong: '◇', open: '·' };

export function ladderSummary(ladder) {
  const correct = ladder.results.filter(r => r.correct).length;
  let run = 0; let bestRun = 0; let hard = 0; let maxHard = 0;
  for (const r of ladder.results) {
    run = r.correct ? run + 1 : 0; bestRun = Math.max(bestRun, run);
    hard = r.correct && r.difficulty === 3 ? hard + 1 : 0; maxHard = Math.max(maxHard, hard);
  }
  return { kind: ladder.kind, day: ladder.day, track: trackOf(ladder), status: ladder.status, climbed: ladder.climbed, banked: ladder.banked, marks: ladderMarks(ladder),
    answered: ladder.results.length, correct, mistakes: ladder.results.length - correct, bestRun, maxDifficultyRun: maxHard };
}

// The words of a shareable result: no question, no answer — the steps, the points and the marks.
// `roundLabel`: the four-hour round (store.mjs windowLabel — 'סבב 4 · 12:00–16:00'), beside the date.
export function dailyShareText({ dateLabel, roundLabel = '', climbed, banked, marks, status }) {
  const line = marks.map(m => MARK_GLYPH[m] || MARK_GLYPH.open).join('');
  const head = status === 'won' ? 'סיימתי את הסולם — ט״ו מעלות' : `עליתי ${climbed} מתוך ${LADDER_SIZE} מעלות`;
  return ['שעשועון טריוויה יהודי · אתגר יומי', [dateLabel, roundLabel].filter(Boolean).join(' · '), head, `${new Intl.NumberFormat('he-IL').format(banked)} נקודות`, line, 'כזוהר הרקיע'].filter(Boolean).join('\n');
}
