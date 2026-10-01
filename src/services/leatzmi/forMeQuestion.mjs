// בשבילי היום — the question card: a small state machine (pure), its grading through the quiz's bank, and the record
// of an answer in the quiz's own progress and in חזרה אליי.
//
//   asking ──choose──▶ grading ──graded──▶ answered ──next──▶ asking (the next question, in the same card)
//                                                    └─next(null)──▶ empty (no question left to ask)
//
// Both a right and a wrong answer move on: after ADVANCE_MS (or at once with "לשאלה הבאה").
// The view never holds the answer: grading asks the bank (quiz/bank.mjs), and the correct option is shown only after a
// miss, and only when the quiz's "להציג את התשובה הנכונה?" (prefs.reveal) is on.
import { isCorrect } from '../quiz/bank.mjs';
import { applyAnswer, readQuizState, writeQuizState } from '../quiz/store.mjs';
import { pointsFor } from '../quiz/scoring.mjs';
import { reviewItemFor } from '../quiz/reviewBridge.mjs';
import { enqueueReviewItem, getReviewItem, recordReviewResult, reviewId } from './review.mjs';
import { defaultStorage } from './storage.mjs';

export const ADVANCE_MS = 1200;
// A miss with the correct option shown stays a little longer, so it can be read.
export const ADVANCE_REVEAL_MS = 2400;
export const FEEDBACK = { right: 'נכון', wrong: 'לא נכון' };

export const initialQuestionState = question => ({ phase: question ? 'asking' : 'empty', question: question || null, chosen: null, outcome: null, revealIndex: null, count: 0 });

export function questionReducer(state, action) {
  switch (action?.type) {
    case 'choose':
      if (state.phase !== 'asking' || !Number.isInteger(action.choice)) return state;
      return { ...state, phase: 'grading', chosen: action.choice };
    case 'graded':
      if (state.phase !== 'grading') return state;
      return { ...state, phase: 'answered', outcome: action.correct ? 'right' : 'wrong', revealIndex: !action.correct && Number.isInteger(action.revealIndex) && action.revealIndex !== state.chosen ? action.revealIndex : null };
    case 'next':
      if (state.phase !== 'answered') return state;
      return { ...initialQuestionState(action.question), count: state.count + 1 };
    default:
      return state;
  }
}

/** How long the answered card waits before the next question. */
export const advanceDelay = state => (state.revealIndex !== null ? ADVANCE_REVEAL_MS : ADVANCE_MS);

/** What the polite live region says once (empty while asking). */
export function announcement(state) {
  if (state.phase !== 'answered') return '';
  if (state.outcome === 'right') return `${FEEDBACK.right}.`;
  const shown = state.revealIndex !== null ? ` התשובה הנכונה: ${state.question.options[state.revealIndex]}.` : '';
  return `${FEEDBACK.wrong}.${shown}`;
}

/**
 * Grades a choice against the bank ({ byId }); a question the bank no longer has is graded by its own `answer` when it
 * carries one (an older stored card), else counts as unknown. → { known, correct, revealIndex }
 * revealIndex: the correct option, only after a miss and only when `reveal` is on.
 */
export function gradeChoice(bank, question, choice, { reveal = false } = {}) {
  const full = bank?.byId?.get(question?.id) || (Number.isInteger(question?.answer) ? question : null);
  const correct = isCorrect(full, choice);
  return { known: Boolean(full), correct, revealIndex: !correct && reveal && full ? full.answer : null };
}

/** The quiz's "להציג את התשובה הנכונה?" setting. */
export const revealSetting = storage => readQuizState(storage).prefs.reveal === true;

/**
 * The answer, recorded as the quiz records its own: the quiz's progress (points, per-category record, seen, mistakes),
 * and חזרה אליי — a miss goes into the review queue (without the answer; missed again, it comes back sooner), a right
 * answer to a question missed before strengthens its review item.
 */
export function recordAnswer({ question, correct, now = Date.now(), quizStorage, reviewStorage = defaultStorage() }) {
  if (!question?.id) return null;
  const before = readQuizState(quizStorage);
  let quiz = applyAnswer(before, { question, correct, points: pointsFor({ correct, difficulty: question.difficulty }), now });
  let review = null;
  if (correct) {
    const id = before.mistakes[question.id]?.reviewId || reviewId('quiz', question.id);
    if (getReviewItem(id, reviewStorage)) review = recordReviewResult(id, 'correct', { storage: reviewStorage, now });
  } else {
    review = enqueueReviewItem(reviewItemFor(question), { storage: reviewStorage, now });
    if (review?.id && quiz.mistakes[question.id]) quiz = { ...quiz, mistakes: { ...quiz.mistakes, [question.id]: { ...quiz.mistakes[question.id], reviewId: review.id } } };
  }
  writeQuizState(quiz, quizStorage);
  return { quiz, review };
}
