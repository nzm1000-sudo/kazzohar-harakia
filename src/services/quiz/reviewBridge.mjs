// בחן אותי ↔ חזרה אליי (src/services/leatzmi/review.mjs). A missed question is handed to the personal review queue —
// its id, its wording, its options and its area: never the answer. The review opens it again in the
// quiz (route `leatzmi/quiz/q/<id>`), where it is asked afresh — or grades a choice with bank.mjs checkAnswer(id, choice),
// which answers only right/wrong. The answer itself is never stored in the review queue. The module is optional: when it is not present the quiz
// keeps its own list of mistakes (store.mjs) and works the same.

const modules = (() => {
  try { return import.meta.glob('../leatzmi/review.mjs'); } catch { return {}; }
})();

let api;
async function reviewApi() {
  if (api !== undefined) return api;
  const load = Object.values(modules || {})[0];
  try { api = load ? await load() : null; } catch { api = null; }
  return api;
}

export const quizRoute = id => `leatzmi/quiz/q/${encodeURIComponent(id)}`;

// The review item for a question: no answer in it (tests check this).
export const reviewItemFor = question => ({
  kind: 'quiz', refId: question.id, title: question.q,
  payload: { questionId: question.id, q: question.q, options: [...question.options], category: question.category, difficulty: question.difficulty, route: quizRoute(question.id) },
});

export async function sendMistakeToReview(question) {
  const review = await reviewApi();
  if (!review?.enqueueReviewItem) return null;
  try {
    const item = await review.enqueueReviewItem(reviewItemFor(question));
    return (item && typeof item === 'object' ? item.id : item) || null;
  } catch { return null; }
}

// grade words as חזרה אליי reads them: 'correct' (quality 4) · 'wrong' (quality 1).
export async function reportReviewResult(reviewId, correct) {
  const review = await reviewApi();
  if (!reviewId || !review?.recordReviewResult) return;
  try { await review.recordReviewResult(reviewId, correct ? 'correct' : 'wrong'); } catch { /* the quiz's own list still holds it */ }
}
export function _setReviewApi(value) { api = value; }
