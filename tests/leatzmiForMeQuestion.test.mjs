// לעצמי · בשבילי היום — the question card: a right and a wrong answer both say so and both move on to the next
// question; the correct option shows only with the quiz's reveal setting; the answer is recorded in the quiz's progress
// and in חזרה אליי; the card's markup (radio group, one polite live region, never the answer before it is earned).
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadJsx } from './helpers/jsx.mjs';
import { memoryStorage } from './helpers/memoryStorage.mjs';
import { ADVANCE_MS, ADVANCE_REVEAL_MS, advanceDelay, announcement, gradeChoice, initialQuestionState, questionReducer, recordAnswer, revealSetting } from '../src/services/leatzmi/forMeQuestion.mjs';
import { indexBank } from '../src/services/quiz/bank.mjs';
import { QUIZ_STORAGE_KEY, readQuizState, writeQuizState, emptyState } from '../src/services/quiz/store.mjs';
import { enqueueReviewItem, getReviewItem, readReviewItems } from '../src/services/leatzmi/review.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const NOW = Date.parse('2026-10-01T09:00:00Z');
const full = [
  { id: 'tanakh-0001', q: 'מי ראה את הסנה?', options: ['משה', 'אהרן', 'יהושע', 'שמואל'], answer: 0, category: 'tanakh', difficulty: 1, note: '' },
  { id: 'tanakh-0002', q: 'כמה ספרים בתורה?', options: ['ארבעה', 'חמישה', 'שישה', 'שבעה'], answer: 1, category: 'tanakh', difficulty: 2, note: '' },
];
const bank = indexBank(full);
const face = q => ({ id: q.id, q: q.q, options: [...q.options], category: q.category, difficulty: q.difficulty, note: '' });

// The card's loop as the component runs it: choose → graded → (after advanceDelay) next.
function play(state, choice, { reveal = false, next } = {}) {
  let s = questionReducer(state, { type: 'choose', choice });
  const graded = gradeChoice(bank, s.question, choice, { reveal });
  s = questionReducer(s, { type: 'graded', ...graded });
  return { answered: s, delay: advanceDelay(s), next: () => questionReducer(s, { type: 'next', question: next }) };
}

test('a right answer says "נכון" and moves on to the next question (the old "stuck when right" bug)', () => {
  const start = initialQuestionState(face(full[0]));
  const { answered, delay, next } = play(start, 0, { next: face(full[1]) });
  assert.equal(answered.phase, 'answered');
  assert.equal(answered.outcome, 'right');
  assert.equal(announcement(answered), 'נכון.');
  assert.equal(delay, ADVANCE_MS);
  const after = next();
  assert.equal(after.phase, 'asking');
  assert.equal(after.question.id, 'tanakh-0002');
  assert.equal(after.chosen, null);
  assert.equal(after.count, 1);
});

test('a wrong answer says "לא נכון" and also moves on; nothing is revealed with the setting off', () => {
  const { answered, delay, next } = play(initialQuestionState(face(full[0])), 2, { reveal: false, next: face(full[1]) });
  assert.equal(answered.outcome, 'wrong');
  assert.equal(answered.revealIndex, null);
  assert.equal(announcement(answered), 'לא נכון.');
  assert.equal(delay, ADVANCE_MS);
  assert.equal(next().question.id, 'tanakh-0002');
});

test('with "להציג את התשובה הנכונה?" on, a miss shows the correct option (and waits a little longer); a right answer never needs it', () => {
  const { answered, delay } = play(initialQuestionState(face(full[1])), 3, { reveal: true });
  assert.equal(answered.revealIndex, 1);
  assert.equal(announcement(answered), 'לא נכון. התשובה הנכונה: חמישה.');
  assert.equal(delay, ADVANCE_REVEAL_MS);
  assert.equal(play(initialQuestionState(face(full[1])), 1, { reveal: true }).answered.revealIndex, null);
  // The setting is the quiz's own.
  const storage = memoryStorage();
  assert.equal(revealSetting(storage), false, 'off by default');
  writeQuizState({ ...emptyState(), prefs: { ...emptyState().prefs, reveal: true } }, storage);
  assert.equal(revealSetting(storage), true);
});

test('the reducer ignores taps while grading or answered, and a card with no next question rests quietly', () => {
  let s = initialQuestionState(face(full[0]));
  s = questionReducer(s, { type: 'choose', choice: 1 });
  assert.equal(questionReducer(s, { type: 'choose', choice: 2 }).chosen, 1, 'one answer per question');
  s = questionReducer(s, { type: 'graded', correct: false, revealIndex: null });
  assert.equal(questionReducer(s, { type: 'choose', choice: 0 }), s);
  assert.equal(questionReducer(s, { type: 'next', question: null }).phase, 'empty');
  assert.equal(questionReducer(initialQuestionState(face(full[0])), { type: 'next', question: face(full[1]) }).question.id, 'tanakh-0001', 'never skips an unanswered question');
  // A question the bank no longer has: unknown, graded as a miss, nothing revealed.
  assert.deepEqual(gradeChoice(bank, { id: 'gone', options: ['a', 'b'] }, 0, { reveal: true }), { known: false, correct: false, revealIndex: null });
});

test('both paths advance on the clock (fake timers): right after 1.2 s, wrong after 1.2 s', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    for (const choice of [0, 3]) {
      let state = initialQuestionState(face(full[0]));
      const { answered } = play(state, choice);
      state = answered;
      setTimeout(() => { state = questionReducer(state, { type: 'next', question: face(full[1]) }); }, advanceDelay(state));
      mock.timers.tick(ADVANCE_MS - 1);
      assert.equal(state.phase, 'answered', 'the feedback stays for a beat');
      mock.timers.tick(1);
      assert.equal(state.phase, 'asking');
      assert.equal(state.question.id, 'tanakh-0002');
    }
  } finally { mock.timers.reset(); }
});

test('recorded like the quiz records: progress and points; a miss into חזרה אליי (no answer), a later right answer strengthens it', () => {
  const quizStorage = memoryStorage();
  const reviewStorage = memoryStorage();
  recordAnswer({ question: full[0], correct: false, now: NOW, quizStorage, reviewStorage });
  let quiz = readQuizState(quizStorage);
  assert.equal(quiz.answered, 1);
  assert.equal(quiz.correct, 0);
  assert.equal(quiz.mistakes['tanakh-0001'].reviewId, 'quiz:tanakh-0001');
  const item = getReviewItem('quiz:tanakh-0001', reviewStorage);
  assert.ok(item);
  assert.equal('answer' in item.payload, false, 'never the answer in the review queue');
  assert.equal(item.payload.route, 'leatzmi/quiz/q/tanakh-0001');
  recordAnswer({ question: full[0], correct: true, now: NOW + 86_400_000, quizStorage, reviewStorage });
  quiz = readQuizState(quizStorage);
  assert.equal(quiz.correct, 1);
  assert.equal(quiz.points, 10);
  assert.equal(quiz.mistakes['tanakh-0001'], undefined, 'the mistake is cleared');
  assert.equal(getReviewItem('quiz:tanakh-0001', reviewStorage).reps, 1, 'the review item is strengthened');
  // A right answer to a question never missed adds nothing to the review queue.
  recordAnswer({ question: full[1], correct: true, now: NOW, quizStorage, reviewStorage });
  assert.equal(readReviewItems(reviewStorage).length, 1);
  assert.equal(readQuizState(quizStorage).byCategory.tanakh.answered, 3);
  assert.ok(quizStorage.dump()[QUIZ_STORAGE_KEY]);
  // A question already in the review queue (enqueued elsewhere) and missed again comes back sooner.
  enqueueReviewItem({ kind: 'quiz', refId: 'tanakh-0002', title: 'x', payload: {} }, { storage: reviewStorage, now: NOW });
  recordAnswer({ question: full[1], correct: false, now: NOW, quizStorage, reviewStorage });
  assert.equal(getReviewItem('quiz:tanakh-0002', reviewStorage).lapses, 1);
});

// ---------- the markup ----------
globalThis.localStorage ??= memoryStorage();
const { QuestionCard } = loadJsx('components/leatzmi/ForMeToday.jsx');
const render = props => renderToStaticMarkup(React.createElement(QuestionCard, props));
const card = { type: 'quiz-new', question: face(full[0]) };

test('markup: a radio group labelled by the question, one polite live region, never the answer before it is earned', () => {
  const before = render({ card });
  assert.match(before, /role="radiogroup" aria-labelledby="[^"]+"/);
  assert.equal((before.match(/role="radio"/g) || []).length, 4);
  assert.equal((before.match(/aria-checked="false"/g) || []).length, 4);
  assert.equal((before.match(/role="status"/g) || []).length, 1, 'exactly one live region');
  assert.match(before, /aria-live="polite"/);
  assert.doesNotMatch(before, /is-right|is-wrong|is-revealed|התשובה הנכונה|לשאלה הבאה/);
  assert.equal((before.match(/tabindex="0"/g) || []).length, 1, 'one tab stop (roving)');
  assert.match(before, /שאלה חדשה/);
  assert.match(render({ card: { type: 'quiz-missed', reviewId: 'quiz:x', question: face(full[0]) } }), /שאלה שחוזרת אליך/);
});

test('markup: after a right answer — "נכון", the chosen option marked, the next-question button; after a miss — "לא נכון", revealed only with the setting', () => {
  const right = play(initialQuestionState(face(full[0])), 0).answered;
  const rightHtml = render({ card, initialState: right });
  assert.match(rightHtml, /fmq-word is-right">נכון</);
  assert.match(rightHtml, /fmq-option is-chosen is-right" aria-checked="true"/);
  assert.match(rightHtml, /לשאלה הבאה/);
  assert.equal((rightHtml.match(/is-faded/g) || []).length, 3);
  const wrongHtml = render({ card, initialState: play(initialQuestionState(face(full[0])), 2).answered });
  assert.match(wrongHtml, /fmq-word is-wrong">לא נכון</);
  assert.doesNotMatch(wrongHtml, /is-revealed|התשובה הנכונה/, 'no reveal with the setting off');
  assert.match(wrongHtml, /לשאלה הבאה/);
  const revealHtml = render({ card, initialState: play(initialQuestionState(face(full[0])), 2, { reveal: true }).answered });
  assert.match(revealHtml, /is-revealed/);
  assert.match(revealHtml, /התשובה הנכונה: <!-- -->משה|התשובה הנכונה: משה/);
  const nextHtml = render({ card, initialState: play(initialQuestionState(face(full[0])), 0, { next: face(full[1]) }).next() });
  assert.match(nextHtml, /כמה ספרים בתורה/);
  assert.doesNotMatch(nextHtml, /לשאלה הבאה|is-chosen/);
  assert.match(render({ card, initialState: initialQuestionState(null) }), /אין כרגע שאלה חדשה/);
});
