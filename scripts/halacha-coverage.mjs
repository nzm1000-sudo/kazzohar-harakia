// Prints the Halacha coverage matrix from the question layer.
import { HALACHA_QUESTIONS } from '../src/data/halachaQuestions.mjs';
import { HALACHA_TOPICS } from '../src/data/halachaLibrary.mjs';

const rows = HALACHA_TOPICS.map(cat => {
  const qs = HALACHA_QUESTIONS.filter(q => q.category === cat.id);
  const refs = new Set(qs.flatMap(q => q.sources.map(s => s.ref)));
  const sephardic = qs.filter(q => q.sources.some(s => s.role === 'sephardic')).length;
  const modern = qs.filter(q => q.sources.some(s => s.role === 'modern')).length;
  return { category: cat.title, topics: cat.children.length, questions: qs.length, sources: refs.size, withSephardic: sephardic, withModernHebrew: modern, personal: qs.filter(q => q.personal).length, reviewed: 0, summaries: 0 };
});
console.table(rows);
console.log('total questions', HALACHA_QUESTIONS.length, '| unique refs', new Set(HALACHA_QUESTIONS.flatMap(q => q.sources.map(s => s.ref))).size);
