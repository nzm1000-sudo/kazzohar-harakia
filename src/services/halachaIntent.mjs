// Intent router for the Halacha question box. It decides which experience answers a free-text question: a
// verified answer, a guided flow that first asks what changes the ruling, source study, or an honest no-match.
// Deterministic and offline; a future model plugs in behind the same result shape (see halachaAgent.mjs).
import { searchHalacha, normalizeQuery } from './halachaSearch.mjs';
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
  const matched = matchFlow(query);
  const topCandidate = (results.unified || []).find(item => item.kind === 'question');
  const flow = matched && topCandidate && topCandidate.score >= OUTSIDE_FLOW_SCORE && !flowEntryIds(matched).has(topCandidate.item.id) ? null : matched;
  const top = (results.unified || []).find(item => item.kind === 'question');
  // Family-purity and similar topics: study material and a referral, never a routed "answer".
  if (SENSITIVE_WORDS.test(text) || results.questions.slice(0, 3).some(item => item.sensitivity === 'sensitive')) return { intent: INTENTS.SENSITIVE, results, flow: null };
  const exact = Boolean(top) && normalizeQuery(top.item.question) === text;
  const direct = Boolean(top) && (exact || top.score >= DIRECT_SCORE + 100);
  if (direct && !(flow && SITUATION_WORDS.test(text) && !exact)) return { intent: INTENTS.VERIFIED, results, flow, answer: top.item };
  if (flow) return { intent: INTENTS.SITUATION, results, flow };
  // The flow was set aside for a clear answer outside it: lead with that answer.
  if (top) return { intent: INTENTS.VERIFIED, results, flow: null, answer: matched && !flow ? top.item : null };
  if (results.yalkut?.length) return { intent: INTENTS.SOURCES, results, flow: null };
  if (results.state === 'topic-only') return { intent: INTENTS.TOPIC, results, flow: null };
  return { intent: INTENTS.NONE, results, flow: null };
}
