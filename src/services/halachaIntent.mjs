// Intent router for the Halacha question box. It decides which experience answers a free-text question: a
// verified answer, a guided flow that first asks what changes the ruling, source study, or an honest no-match.
// Deterministic and offline; a future model plugs in behind the same result shape (see halachaAgent.mjs).
import { searchHalacha, normalizeQuery, questionKeyTerms, isRelevantEntry } from './halachaSearch.mjs';
import { matchFlow, flowEntryIds } from './halachaDecision.mjs';

export const INTENTS = Object.freeze({
  VERIFIED: 'practical-question', SITUATION: 'situation-needs-clarification', SOURCES: 'source-search',
  TOPIC: 'study-topic', SENSITIVE: 'personal-case', NONE: 'no-match', EMPTY: 'empty',
});

// A single answer is shown first only for the user's exact question or a very strong match; otherwise a matching
// flow asks what changes the ruling, or the ranked list is shown. (Measured: an exact question scores ~260,
// a loose one-word overlap ~120.)
const DIRECT_SCORE = 240;
// A clear answer (~200+) that the matched flow cannot reach means the flow was the wrong guess ("שכחתי לברך אשר יצר"
// matches the blessing-mistakes flow, which has no asher-yatzar branch): the answer wins.
const OUTSIDE_FLOW_SCORE = 190;
// Family-purity terms mark a question sensitive however it is worded (immersing vessels is not).
const SENSITIVE_WORDS = /(?:^|\s)[והבלמש]?(מקווה|מקוה|נידה|נדה|הפסק טהרה|שבעה נקיים|כתם|כתמים|חציצה|חציצות|טהרת המשפחה|וסת|ווסת)(?:\s|$)|טבילה(?!\s+כלים)|טבילת(?!\s+כלים)/;
// Words that signal a situation ("I forgot", "by mistake") rather than a general question.
const SITUATION_WORDS = /(?:^|\s)(שכחתי|טעיתי|בטעות|לא זוכר|לא בטוח|נזכרתי|קרה|שמתי|אכלתי|שתיתי|בירכתי|התחלתי)(?:\s|$)/;

export function routeHalachaQuery(query, { results: precomputed } = {}) {
  const text = normalizeQuery(query);
  if (!text) return { intent: INTENTS.EMPTY, results: searchHalacha('') };
  const results = precomputed || searchHalacha(query);
  const terms = questionKeyTerms(query);
  const relevant = item => isRelevantEntry(query, item, terms);
  const matched = matchFlow(query);
  // The best candidate that is really about the question (among the first five), not just the first word match.
  const firstFive = (results.unified || []).filter(item => item.kind === 'question').slice(0, 5);
  // A situation ("שכחתי…", "שמתי…") keeps its flow unless the very first answer is outside it; a plain question may
  // lead with the best relevant answer in the first five.
  const situational = SITUATION_WORDS.test(normalizeQuery(query));
  const topCandidate = situational ? firstFive[0] : firstFive.find(item => relevant(item.item)) || firstFive[0];
  // A general flow gives way to a specific verified answer — when that answer is really about the question's subject
  // and the question is not a "what happened to me" situation.
  const specific = topCandidate && relevant(topCandidate.item) && (topCandidate.score >= OUTSIDE_FLOW_SCORE || (!situational && topCandidate.score >= 140));
  // The flow asks what changes the ruling; when the question already names the case (a strong, clearly leading
  // answer), asking again is noise — even if the flow would reach the same answer.
  const second = firstFive.find(item => item !== topCandidate && relevant(item.item));
  // …and the answer is not narrower than the question ("נר שבת כבה" vs "…כבה מיד אחרי ההדלקה": the flow asks when).
  const narrower = topCandidate && questionKeyTerms(topCandidate.item.question).ranked.length - terms.ranked.length >= 2;
  const namesTheCase = !situational && specific && !narrower && topCandidate.score >= OUTSIDE_FLOW_SCORE && (!second || !relevant(second.item) || topCandidate.score - second.score >= 25);
  const flow = matched && specific && (namesTheCase || !flowEntryIds(matched).has(topCandidate.item.id)) ? null : matched;
  const top = (results.unified || []).find(item => item.kind === 'question');
  // Family-purity and similar topics: study material and a referral, never a routed "answer".
  // "כתם דם בביצה" is kashrut, not family purity.
  const food = /(?:^|\s)[בה]?(?:ביצה|ביצים|בשר|עוף|דג|דגים)(?:\s|$)/.test(text);
  if ((SENSITIVE_WORDS.test(text) && !food) || results.questions.slice(0, 3).some(item => item.sensitivity === 'sensitive')) return { intent: INTENTS.SENSITIVE, results, flow: null };
  const exact = Boolean(top) && normalizeQuery(top.item.question) === text;
  const direct = Boolean(top) && (exact || (top.score >= DIRECT_SCORE + 100 && relevant(top.item)));
  if (direct && !(flow && SITUATION_WORDS.test(text) && !exact)) return { intent: INTENTS.VERIFIED, results, flow, answer: top.item };
  if (flow) return { intent: INTENTS.SITUATION, results, flow };
  // The flow was set aside for a clear answer outside it: lead with that answer.
  if (topCandidate && relevant(topCandidate.item)) return { intent: INTENTS.VERIFIED, results, flow: null, answer: matched && !flow ? topCandidate.item : null, terms };
  if (top) return { intent: INTENTS.VERIFIED, results, flow: null, answer: null, weak: true, terms };
  if (results.yalkut?.length) return { intent: INTENTS.SOURCES, results, flow: null };
  if (results.state === 'topic-only') return { intent: INTENTS.TOPIC, results, flow: null };
  return { intent: INTENTS.NONE, results, flow: null };
}
