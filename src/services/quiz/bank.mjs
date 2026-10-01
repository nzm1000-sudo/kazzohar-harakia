// בחן אותי — the question bank: validation of the content files (src/data/quiz/*.mjs, see SCHEMA.md) and the lazy
// loader. The bank is imported only when the quiz opens (a separate chunk): nothing here runs at app start.
import { CATEGORY_IDS } from './catalog.mjs';

const text = value => (typeof value === 'string' ? value.trim() : '');

// One question: a list of problems ('' when it is valid). Strict: a question that is not exactly right never plays.
export function questionProblems(item) {
  const problems = [];
  if (!item || typeof item !== 'object') return ['not an object'];
  if (!text(item.id)) problems.push('missing id');
  if (!text(item.q)) problems.push('missing question');
  if (!Array.isArray(item.options) || item.options.length !== 4) problems.push('needs exactly 4 options');
  else {
    const options = item.options.map(text);
    if (options.some(o => !o)) problems.push('an empty option');
    if (new Set(options).size !== 4) problems.push('options are not distinct');
  }
  if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3) problems.push('answer index out of range');
  if (!CATEGORY_IDS.includes(item.category)) problems.push(`unknown category ${item.category}`);
  if (![1, 2, 3].includes(item.difficulty)) problems.push(`bad difficulty ${item.difficulty}`);
  if (item.tags !== undefined && !Array.isArray(item.tags)) problems.push('tags must be a list');
  if (item.note !== undefined && typeof item.note !== 'string') problems.push('note must be text');
  return problems;
}

// Validates every file's questions together: ids are unique across the whole bank (a duplicate keeps the first and
// reports the second). Returns the valid questions (frozen, normalised) and the errors, never throws.
export function validateBank(files) {
  const questions = [];
  const errors = [];
  const ids = new Set();
  for (const [file, list] of Object.entries(files || {})) {
    if (!Array.isArray(list)) { errors.push({ file, id: null, problems: ['the file does not export a list'] }); continue; }
    list.forEach((item, index) => {
      const problems = questionProblems(item);
      const id = text(item?.id);
      if (id && ids.has(id)) problems.push('duplicate id');
      if (problems.length) { errors.push({ file, id: id || `#${index}`, problems }); return; }
      ids.add(id);
      questions.push(Object.freeze({
        id,
        q: text(item.q),
        options: Object.freeze(item.options.map(text)),
        answer: item.answer,
        category: item.category,
        difficulty: item.difficulty,
        tags: Object.freeze((item.tags || []).map(String)),
        note: text(item.note),
      }));
    });
  }
  return { questions, errors };
}

// The bank, indexed for the session builder.
export function indexBank(questions) {
  const byId = new Map(questions.map(q => [q.id, q]));
  return { questions, byId, size: questions.length };
}

export function countsByCategory(bank) {
  const counts = {};
  for (const q of bank?.questions || []) counts[q.category] = (counts[q.category] || 0) + 1;
  return counts;
}

// Grading lives here, not in the view: the view is told only right/wrong, never which option was correct.
export function isCorrect(question, choice) {
  return Boolean(question) && Number.isInteger(choice) && choice === question.answer;
}

// Grades a choice for another screen (בשבילי היום, חזרה אליי) without handing it the answer: { known, correct }.
export async function checkAnswer(id, choice, bankPromise) {
  const bank = await (bankPromise || loadBank());
  const question = bank.byId.get(id);
  return { known: Boolean(question), correct: isCorrect(question, choice) };
}

let cached = null;
// Loads the content files once (lazily, on first use). `loader` is for tests; the app uses src/data/quiz/index.mjs.
export async function loadBank(loader) {
  if (cached && !loader) return cached;
  const load = loader || (async () => (await import('../../data/quiz/index.mjs')).loadQuizFiles());
  const promise = (async () => {
    let files = {};
    try { files = await load(); } catch { files = {}; }
    const { questions, errors } = validateBank(files);
    if (errors.length && typeof console !== 'undefined') console.warn?.(`[quiz] ${errors.length} invalid question(s) skipped`, errors.slice(0, 5));
    return { ...indexBank(questions), errors };
  })();
  if (!loader) cached = promise;
  return promise;
}
export function _resetBankCache() { cached = null; }
