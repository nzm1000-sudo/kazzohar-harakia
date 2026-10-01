// בשבילי היום — a short daily session (three to five minutes) composed by plain rules, never by AI:
//   a halacha to review (or one new one), a quiz question the user missed, a short verse, one of the user's older
//   chidushim, and one new question — fewer cards of a kind the user already knows well, more of a weak one.
// Pure: everything it reads is passed in; the day's plan is kept so the session stays the same all day.
//
// Storage: localStorage 'kz-leatzmi-forme-v1' = { v: 1, day, plan: [Card], done: [index], seenQuiz: [questionId] }
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

// A short verse of the day from Tehillim (chapters of verse strings): the shortest whole verses only.
export function verseOfDay(chapters, day) {
  if (!Array.isArray(chapters) || !chapters.length) return null;
  const random = seeded(`verse:${day}`);
  for (let tries = 0; tries < 40; tries += 1) {
    const chapter = Math.floor(random() * chapters.length) + 1;
    const verses = chapters[chapter - 1] || [];
    const short = verses.map((text, index) => ({ text, verse: index + 1 })).filter(item => item.text && !/[[\]()]/.test(item.text) && item.text.replace(/[֑-ׇ]/g, '').length <= 90);
    const chosen = pick(short, random);
    if (chosen) return { text: chosen.text, chapter, verse: chosen.verse };
  }
  return null;
}

/**
 * composeForMe({ day, now, reviewItems, chidushim, halachaPool, learnedHalacha, quizPool, seenQuiz, verse })
 *   halachaPool: [{ id, question, shortAnswer, category }]   learnedHalacha: { [id]: { at, next } }
 *   quizPool: [{ id, q, options, answer, category, difficulty }]   seenQuiz: [id]   verse: { text, chapter, verse }
 * → [Card] (3–5): { type: 'halacha' | 'quiz-missed' | 'verse' | 'chidush' | 'quiz-new' | 'favorite', … }
 */
export function composeForMe({ day, now = Date.now(), reviewItems = [], chidushim = [], halachaPool = [], learnedHalacha = {}, quizPool = [], seenQuiz = [], verse = null } = {}) {
  const at = toMs(now);
  const random = seeded(`forme:${day}`);
  const alternate = Number(String(day).replace(/\D/g, '').slice(-2)) % 2 === 0;
  const quizItems = reviewItems.filter(item => item.kind === 'quiz');
  const halachaItems = reviewItems.filter(item => item.kind === 'halacha');
  const quizStrength = topicStrength(quizItems);
  const halachaStrength = topicStrength(halachaItems);
  const cards = [];

  // 1. Halacha: one that is due again; else a new one — skipped on alternate days when halacha is already strong.
  const poolById = new Map(halachaPool.map(item => [item.id, item]));
  const dueLearned = Object.entries(learnedHalacha || {}).filter(([id, mark]) => poolById.has(id) && mark?.next && mark.next <= at).sort((a, b) => a[1].next - b[1].next)[0];
  if (dueLearned) cards.push({ type: 'halacha', id: dueLearned[0], review: true, question: poolById.get(dueLearned[0]).question, answer: poolById.get(dueLearned[0]).shortAnswer });
  else if (halachaPool.length && (halachaStrength < 0.7 || alternate)) {
    const fresh = halachaPool.filter(item => !learnedHalacha?.[item.id]);
    const chosen = pick(fresh.length ? fresh : halachaPool, random);
    if (chosen) cards.push({ type: 'halacha', id: chosen.id, review: false, question: chosen.question, answer: chosen.shortAnswer });
  }

  // 2. A question missed before (most overdue first) — every day while weak, every other day once strong.
  const missed = quizItems.filter(item => item.lapses > 0 || item.lastGrade !== null && item.lastGrade < 4 || item.reps === 0).sort((a, b) => a.due - b.due);
  // The quiz keeps the answer out of the review queue: the question is read again from its bank by id.
  const bankById = new Map(quizPool.filter(item => item?.id).map(item => [item.id, item]));
  const fullQuestion = item => bankById.get(item.payload?.questionId || item.refId) || (Number.isInteger(item.payload?.answer) && item.payload?.q ? { id: item.refId, ...item.payload } : null);
  const missedItem = missed.find(fullQuestion);
  if (missedItem && (quizStrength < 0.8 || alternate)) cards.push({ type: 'quiz-missed', reviewId: missedItem.id, question: fullQuestion(missedItem) });

  // 3. A short verse.
  if (verse?.text) cards.push({ type: 'verse', ...verse });

  // 4. One of the user's own older chidushim (not a follow-up note), a different one each day.
  const old = chidushim.filter(item => at - toMs(item.createdAt) >= OLD_CHIDUSH_DAYS * DAY && !item.followUpOf && (item.title || item.body));
  const chidush = pick(old, random);
  if (chidush) cards.push({ type: 'chidush', chidushId: chidush.id, title: chidush.title, excerpt: excerpt(chidush.body) });

  // 5. One new question: from the weakest category the user has met, at an easier level while weak.
  const known = new Set([...quizItems.map(item => item.refId), ...seenQuiz]);
  const valid = quizPool.filter(item => item?.id && !known.has(item.id) && Array.isArray(item.options) && item.options.length >= 2 && Number.isInteger(item.answer));
  if (valid.length) {
    const byCategory = new Map();
    for (const item of quizItems) { const category = item.payload?.category || item.topic || ''; if (!byCategory.has(category)) byCategory.set(category, []); byCategory.get(category).push(item); }
    const weakest = [...byCategory.entries()].filter(([category]) => category).map(([category, items]) => [category, topicStrength(items)]).sort((a, b) => a[1] - b[1])[0];
    let candidates = weakest && weakest[1] < 0.6 ? valid.filter(item => item.category === weakest[0]) : valid;
    if (!candidates.length) candidates = valid;
    if (quizStrength < 0.4) { const easy = candidates.filter(item => Number(item.difficulty) === 1); if (easy.length) candidates = easy; }
    const chosen = pick(candidates, random);
    if (chosen) cards.push({ type: 'quiz-new', question: chosen });
  }

  // At least three when the user has favourites waiting to be revisited.
  if (cards.length < 3) {
    const favorite = reviewItems.filter(item => item.kind === 'favorite' && item.due <= at).sort((a, b) => a.due - b.due)[0];
    if (favorite) cards.push({ type: 'favorite', reviewId: favorite.id, title: favorite.title, open: favorite.payload?.open || null });
  }
  return cards.slice(0, 5);
}

const excerpt = text => { const plain = String(text || '').replace(/\s+/g, ' ').trim(); return plain.length > 160 ? `${plain.slice(0, 157)}…` : plain; };
export const sessionMinutes = cards => Math.max(1, Math.round(cards.reduce((sum, card) => sum + (CARD_MINUTES[card.type] || 0.5), 0)));

// ---------- the day's plan ----------
export function readForMe(storage = defaultStorage()) {
  const raw = readJSON(storage, FOR_ME_KEY, {});
  return { v: 1, day: typeof raw?.day === 'string' ? raw.day : '', plan: Array.isArray(raw?.plan) ? raw.plan : [], done: Array.isArray(raw?.done) ? raw.done : [], seenQuiz: Array.isArray(raw?.seenQuiz) ? raw.seenQuiz.slice(-500) : [] };
}
/** The plan for `day`: the kept one, or a new one from `compose()` (which receives the questions seen before). */
export function planForDay(day, compose, storage = defaultStorage()) {
  const state = readForMe(storage);
  if (state.day === day && state.plan.length) return state;
  const plan = compose({ seenQuiz: state.seenQuiz });
  const newQuiz = plan.filter(card => card.type === 'quiz-new').map(card => card.question.id);
  const next = { v: 1, day, plan, done: [], seenQuiz: [...state.seenQuiz, ...newQuiz].slice(-500) };
  writeJSON(storage, FOR_ME_KEY, next);
  return next;
}
export function markCardDone(index, storage = defaultStorage()) {
  const state = readForMe(storage);
  if (!state.done.includes(index)) state.done = [...state.done, index];
  writeJSON(storage, FOR_ME_KEY, state);
  return state;
}
