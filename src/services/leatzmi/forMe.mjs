// בשבילי היום — a short daily session (three to five minutes) composed by plain rules, never by AI:
//   a halacha to review (or one new one), a quiz question the user missed, a short verse, one of the user's older
//   chidushim, and one new question — fewer cards of a kind the user already knows well, more of a weak one.
// Pure: everything it reads is passed in. A plan is kept while it is fresh and composed anew when it has stood two hours,
// or when the user comes back after ten minutes away (never while the screen is open in front of them). What a plan
// showed is remembered per kind for a while (the recent sets, each with its own decay), so a new plan brings new items.
//
// Storage: localStorage 'kz-leatzmi-forme-v1' = { v: 1, day, plan: [Card], done: [index], seenQuiz: [questionId],
//   composedAt (ms), lastSeenAt (ms), seq, sageIndex, recent: { halacha|verse|chidush|missed|sage: { key: ms } } }
import { topicStrength } from './review.mjs';
import { defaultStorage, readJSON, toMs, writeJSON } from './storage.mjs';

export const FOR_ME_KEY = 'kz-leatzmi-forme-v1';
const DAY = 24 * 60 * 60 * 1000;
const OLD_CHIDUSH_DAYS = 14;
const CARD_MINUTES = { halacha: 1, 'quiz-missed': 0.5, verse: 0.5, chidush: 1, 'quiz-new': 0.5, favorite: 1 };

// A small seeded generator, so a day's choices are stable (mulberry32 over the day key).
export function seeded(text) {
  let h = 1779033703 ^ String(text).length;
  for (let i = 0; i < String(text).length; i += 1) { h = Math.imul(h ^ String(text).charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (list, random) => (list.length ? list[Math.floor(random() * list.length)] : null);

// A short verse from Tehillim (chapters of verse strings): the shortest whole verses only, stable for its seed (a day
// key, or a plan's seed), and not one of `exclude` ('chapter:verse' keys shown lately) while another can be found.
export function verseOfDay(chapters, seed, exclude = null) {
  if (!Array.isArray(chapters) || !chapters.length) return null;
  const random = seeded(`verse:${seed}`);
  let fallback = null;
  for (let tries = 0; tries < 60; tries += 1) {
    const chapter = Math.floor(random() * chapters.length) + 1;
    const verses = chapters[chapter - 1] || [];
    const short = verses.map((text, index) => ({ text, verse: index + 1 })).filter(item => item.text && !/[[\]()]/.test(item.text) && item.text.replace(/[֑-ׇ]/g, '').length <= 90);
    const fresh = exclude ? short.filter(item => !has(exclude, `${chapter}:${item.verse}`)) : short;
    const chosen = pick(fresh, random);
    if (chosen) return { text: chosen.text, chapter, verse: chosen.verse };
    fallback = fallback || (short.length ? { ...short[0], chapter } : null);
  }
  return fallback ? { text: fallback.text, chapter: fallback.chapter, verse: fallback.verse } : null;
}

// ---------- not again soon: what a plan showed, per kind, forgotten after a while ----------
const HOUR = 60 * 60 * 1000;
export const RECENT_WINDOWS = { halacha: 3 * DAY, verse: 14 * DAY, chidush: 2 * DAY, missed: 6 * HOUR, sage: 120 * DAY };
const RECENT_LIMIT = 400;
const has = (set, key) => (set instanceof Set ? set.has(key) : Boolean(set && Object.prototype.hasOwnProperty.call(set, key)));
/** The recent sets with every entry older than its kind's window dropped (and at most RECENT_LIMIT kept per kind). */
export function decayRecent(recent, now = Date.now()) {
  const out = {};
  for (const [kind, window] of Object.entries(RECENT_WINDOWS)) {
    const entries = Object.entries(recent?.[kind] && typeof recent[kind] === 'object' ? recent[kind] : {})
      .filter(([, at]) => Number.isFinite(at) && now - at < window).sort((a, b) => b[1] - a[1]).slice(0, RECENT_LIMIT);
    out[kind] = Object.fromEntries(entries);
  }
  return out;
}
// Items not shown lately; when every one was, the one shown longest ago (so a short list still gives something).
function freshFirst(list, keyOf, recentKind = {}) {
  const fresh = list.filter(item => !has(recentKind, keyOf(item)));
  if (fresh.length || !list.length) return fresh;
  return [list.reduce((best, item) => ((recentKind[keyOf(item)] ?? 0) < (recentKind[keyOf(best)] ?? 0) ? item : best))];
}
/** A saying's index out of `n`, not one shown lately. */
export function pickSayingIndex(n, recentSage = {}, random = Math.random) {
  if (!Number.isInteger(n) || n <= 0) return null;
  for (let tries = 0; tries < 60; tries += 1) { const index = Math.floor(random() * n); if (!has(recentSage, String(index))) return index; }
  for (let index = 0; index < n; index += 1) if (!has(recentSage, String(index))) return index;
  return Math.floor(random() * n);
}

/**
 * composeForMe({ day, now, seed, reviewItems, chidushim, halachaPool, learnedHalacha, quizPool, seenQuiz, skipQuiz,
 *                categoryStats, recent, verse })
 *   halachaPool: [{ id, question, shortAnswer, category }]   learnedHalacha: { [id]: { at, next } }
 *   quizPool: [{ id, q, options, answer, category, difficulty }]   seenQuiz / skipQuiz: [id]   verse: { text, chapter, verse }
 *   recent: the plan's recent sets (decayRecent)   categoryStats: the quiz's { [category]: { answered, correct } }
 * → [Card] (3–5): { type: 'halacha' | 'quiz-missed' | 'verse' | 'chidush' | 'quiz-new' | 'favorite', … }
 * A question card carries the question's public face only (publicQuestion): the answer stays in the bank.
 */
export function composeForMe({ day, now = Date.now(), seed = null, reviewItems = [], chidushim = [], halachaPool = [], learnedHalacha = {}, quizPool = [], seenQuiz = [], skipQuiz = [], categoryStats = null, recent = {}, verse = null } = {}) {
  const at = toMs(now);
  const random = seeded(seed || `forme:${day}`);
  const alternate = Number(String(day).replace(/\D/g, '').slice(-2)) % 2 === 0;
  const quizItems = reviewItems.filter(item => item.kind === 'quiz');
  const halachaItems = reviewItems.filter(item => item.kind === 'halacha');
  const quizStrength = topicStrength(quizItems);
  const halachaStrength = topicStrength(halachaItems);
  const cards = [];

  // 1. Halacha: one that is due again; else a new one — skipped on alternate days when halacha is already strong.
  const poolById = new Map(halachaPool.map(item => [item.id, item]));
  const dueLearned = Object.entries(learnedHalacha || {}).filter(([id, mark]) => poolById.has(id) && mark?.next && mark.next <= at && !has(recent.halacha, id)).sort((a, b) => a[1].next - b[1].next)[0];
  if (dueLearned) cards.push({ type: 'halacha', id: dueLearned[0], review: true, question: poolById.get(dueLearned[0]).question, answer: poolById.get(dueLearned[0]).shortAnswer });
  else if (halachaPool.length && (halachaStrength < 0.7 || alternate)) {
    const unlearned = halachaPool.filter(item => !learnedHalacha?.[item.id]);
    const chosen = pick(freshFirst(unlearned.length ? unlearned : halachaPool, item => item.id, recent.halacha), random);
    if (chosen) cards.push({ type: 'halacha', id: chosen.id, review: false, question: chosen.question, answer: chosen.shortAnswer });
  }

  // 2. A question missed before (most overdue first) — every day while weak, every other day once strong.
  const missed = quizItems.filter(item => item.lapses > 0 || item.lastGrade !== null && item.lastGrade < 4 || item.reps === 0).sort((a, b) => a.due - b.due);
  // The quiz keeps the answer out of the review queue: the question is read again from its bank by id.
  const bankById = new Map(quizPool.filter(item => item?.id).map(item => [item.id, item]));
  const fullQuestion = item => bankById.get(item.payload?.questionId || item.refId) || (Number.isInteger(item.payload?.answer) && item.payload?.q ? { id: item.refId, ...item.payload } : null);
  const skipped = new Set(skipQuiz);
  const missedItem = missed.find(item => fullQuestion(item) && !has(recent.missed, item.id) && !skipped.has(item.refId));
  if (missedItem && (quizStrength < 0.8 || alternate)) cards.push({ type: 'quiz-missed', reviewId: missedItem.id, question: publicQuestion(fullQuestion(missedItem)) });

  // 3. A short verse.
  if (verse?.text) cards.push({ type: 'verse', ...verse });

  // 4. One of the user's own older chidushim (not a follow-up note), a different one each day.
  const old = chidushim.filter(item => at - toMs(item.createdAt) >= OLD_CHIDUSH_DAYS * DAY && !item.followUpOf && (item.title || item.body));
  const chidush = pick(freshFirst(old, item => item.id, recent.chidush), random);
  if (chidush) cards.push({ type: 'chidush', chidushId: chidush.id, title: chidush.title, excerpt: excerpt(chidush.body) });

  // 5. One new question: from the weakest category the user has met, at an easier level while weak.
  const exclude = new Set([...seenQuiz, ...skipQuiz, ...cards.filter(card => card.question).map(card => card.question.id)]);
  const chosen = chooseNewQuestion({ quizPool, reviewItems, exclude, categoryStats, random });
  if (chosen) cards.push({ type: 'quiz-new', question: publicQuestion(chosen) });

  // At least three when the user has favourites waiting to be revisited.
  if (cards.length < 3) {
    const favorite = reviewItems.filter(item => item.kind === 'favorite' && item.due <= at).sort((a, b) => a.due - b.due)[0];
    if (favorite) cards.push({ type: 'favorite', reviewId: favorite.id, title: favorite.title, open: favorite.payload?.open || null });
  }
  return cards.slice(0, 5);
}

// The face of a question a card may keep (and store): never its answer — grading is the bank's (quiz/bank.mjs).
export const publicQuestion = q => (q ? { id: q.id, q: q.q, options: [...q.options], category: q.category || '', difficulty: q.difficulty ?? null, note: q.note || '' } : null);

/**
 * The next new question: never one in `exclude` or met in the review queue; from the weakest area (the review queue's
 * topic strength, else the quiz's own per-category record), at an easier level while the user is weak overall.
 */
export function chooseNewQuestion({ quizPool = [], reviewItems = [], exclude = new Set(), categoryStats = null, random = Math.random } = {}) {
  const quizItems = reviewItems.filter(item => item.kind === 'quiz');
  const known = new Set([...quizItems.map(item => item.refId), ...exclude]);
  const valid = quizPool.filter(item => item?.id && !known.has(item.id) && Array.isArray(item.options) && item.options.length >= 2 && Number.isInteger(item.answer));
  if (!valid.length) return null;
  const byCategory = new Map();
  for (const item of quizItems) { const category = item.payload?.category || item.topic || ''; if (!byCategory.has(category)) byCategory.set(category, []); byCategory.get(category).push(item); }
  let weakest = [...byCategory.entries()].filter(([category]) => category).map(([category, items]) => [category, topicStrength(items)]).sort((a, b) => a[1] - b[1])[0];
  if (!(weakest && weakest[1] < 0.6) && categoryStats) {
    weakest = Object.entries(categoryStats).filter(([, s]) => s?.answered >= 5).map(([category, s]) => [category, s.correct / s.answered]).sort((a, b) => a[1] - b[1])[0];
  }
  let candidates = weakest && weakest[1] < 0.6 ? valid.filter(item => item.category === weakest[0]) : valid;
  if (!candidates.length) candidates = valid;
  if (topicStrength(quizItems) < 0.4) { const easy = candidates.filter(item => Number(item.difficulty) === 1); if (easy.length) candidates = easy; }
  return pick(candidates, random);
}

const excerpt = text => { const plain = String(text || '').replace(/\s+/g, ' ').trim(); return plain.length > 160 ? `${plain.slice(0, 157)}…` : plain; };
export const sessionMinutes = cards => Math.max(1, Math.round(cards.reduce((sum, card) => sum + (CARD_MINUTES[card.type] || 0.5), 0)));

// ---------- the plan: fresh every two hours, or on coming back after ten minutes away ----------
export const REFRESH_AFTER_MS = 2 * HOUR;
export const AWAY_AFTER_MS = 10 * 60 * 1000;
const finite = value => (Number.isFinite(value) ? value : 0);

export function readForMe(storage = defaultStorage()) {
  const raw = readJSON(storage, FOR_ME_KEY, {});
  return {
    v: 1, day: typeof raw?.day === 'string' ? raw.day : '', plan: Array.isArray(raw?.plan) ? raw.plan : [], done: Array.isArray(raw?.done) ? raw.done : [],
    seenQuiz: Array.isArray(raw?.seenQuiz) ? raw.seenQuiz.slice(-500) : [],
    composedAt: finite(raw?.composedAt), lastSeenAt: finite(raw?.lastSeenAt), seq: finite(raw?.seq),
    sageIndex: Number.isInteger(raw?.sageIndex) ? raw.sageIndex : null,
    recent: raw?.recent && typeof raw.recent === 'object' ? raw.recent : {},
  };
}

/**
 * Does the kept plan give way to a new one? A new day; two hours since it was composed; or — `entering` the screen
 * (opening it, or the app coming back to it) — ten minutes or more since the user was last on it. Never otherwise:
 * a screen that stays open keeps its plan.
 */
export function planIsStale(state, { day, now = Date.now(), entering = false } = {}) {
  if (!state?.composedAt || state.day !== day) return true;
  if (now - state.composedAt >= REFRESH_AFTER_MS) return true;
  if (entering && state.lastSeenAt && now - state.lastSeenAt >= AWAY_AFTER_MS) return true;
  return false;
}

// What a plan shows goes into the recent sets (and its new questions into seenQuiz).
function remember(state, plan, sageIndex, now) {
  const recent = decayRecent(state.recent, now);
  for (const card of plan) {
    if (card.type === 'halacha') recent.halacha[card.id] = now;
    if (card.type === 'verse') recent.verse[`${card.chapter}:${card.verse}`] = now;
    if (card.type === 'chidush') recent.chidush[card.chidushId] = now;
    if (card.type === 'quiz-missed') recent.missed[card.reviewId] = now;
  }
  if (Number.isInteger(sageIndex)) recent.sage[String(sageIndex)] = now;
  const newQuiz = plan.filter(card => card.question?.id).map(card => card.question.id);
  return { recent, seenQuiz: [...state.seenQuiz.filter(id => !newQuiz.includes(id)), ...newQuiz].slice(-500) };
}

/**
 * Entering the screen: the kept plan while it is fresh, else a new one from `compose({ seenQuiz, recent, seed, seq })`
 * → [Card] (and, with `sayings`, a saying not shown lately). Either way the visit is noted (lastSeenAt).
 */
export function openPlan(day, compose, { now = Date.now(), storage = defaultStorage(), entering = true, sayings = 0 } = {}) {
  const state = readForMe(storage);
  if (!planIsStale(state, { day, now, entering })) {
    const kept = { ...state, lastSeenAt: now };
    writeJSON(storage, FOR_ME_KEY, kept);
    return { ...kept, fresh: false };
  }
  const seq = state.seq + 1;
  const seed = `forme:${day}:${seq}:${now}`;
  const recentNow = decayRecent(state.recent, now);
  const plan = compose({ seenQuiz: state.seenQuiz, recent: recentNow, seed, seq }) || [];
  const sageIndex = sayings > 0 ? pickSayingIndex(sayings, recentNow.sage, seeded(`sage:${seed}`)) : null;
  const next = { v: 1, day, plan, done: [], composedAt: now, lastSeenAt: now, seq, sageIndex, ...remember({ ...state, recent: recentNow }, plan, sageIndex, now) };
  writeJSON(storage, FOR_ME_KEY, next);
  return { ...next, fresh: true };
}
/** The day's plan (kept until it is stale) — openPlan without a visit, for callers that only read. */
export const planForDay = (day, compose, storage = defaultStorage(), now = Date.now()) => openPlan(day, compose, { now, storage, entering: false });

/** The user is on the screen (a heartbeat, or leaving it): only the time of the visit changes. */
export function touchPlan(now = Date.now(), storage = defaultStorage()) {
  const state = readForMe(storage);
  if (!state.composedAt) return state;
  const next = { ...state, lastSeenAt: Math.max(state.lastSeenAt, now) };
  writeJSON(storage, FOR_ME_KEY, next);
  return next;
}

export function markCardDone(index, storage = defaultStorage()) {
  const state = readForMe(storage);
  if (!state.done.includes(index)) state.done = [...state.done, index];
  writeJSON(storage, FOR_ME_KEY, state);
  return state;
}

/** A question card moves on to its next question (kept, so coming back within ten minutes shows the same one). */
export function replaceCardQuestion(index, question, storage = defaultStorage()) {
  const state = readForMe(storage);
  if (!state.plan[index] || !question?.id) return state;
  const plan = state.plan.map((card, i) => (i === index ? { type: 'quiz-new', question: publicQuestion(question), next: true } : card));
  const next = { ...state, plan, seenQuiz: [...state.seenQuiz.filter(id => id !== question.id), question.id].slice(-500) };
  writeJSON(storage, FOR_ME_KEY, next);
  return next;
}
