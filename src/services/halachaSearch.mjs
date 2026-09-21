// Local Halacha search over the question layer. No network, no model calls.
import { HALACHA_QUESTIONS } from '../data/halachaQuestions.mjs';
import { publishedPracticalQuestions } from '../data/practicalHalachaQa.mjs';
import { HALACHA_TOPICS } from '../data/halachaLibrary.mjs';
import { searchYalkut } from './yalkutYosef.mjs';

// \b is ASCII-only in JS; build Hebrew word boundaries explicitly.
const H = '[\\u0590-\\u05FF"]';
const word = (...forms) => new RegExp(`(?<!${H})(?:${forms.join('|')})(?!${H})`, 'g');
const SYNONYMS = [
  [word('מקוה'), 'מקווה'], [word('אשה'), 'אישה'], [word('ק"ש', 'קש'), 'קריאת שמע'],
  [word('פלאפון', 'סלולרי', 'נייד'), 'טלפון'], [word('חלביים', 'חלבית'), 'חלבי'],
  [word('בשריים', 'בשרית'), 'בשרי'],
  [word('יו"ט'), 'יום טוב'], [word('ר"ח'), 'ראש חודש'], [word('ברהמ"ז', 'בהמ"ז'), 'ברכת המזון'],
  [word('עכו"ם', 'עכום', 'נכרי'), 'גוי'], [word('חול'), 'חו"ל'],
  [word('אבדה'), 'אבידה'], [word('טבילת כלים'), 'טבילת כלים'],
];
const STOP = new Set(['מה', 'איך', 'האם', 'מותר', 'אסור', 'צריך', 'אפשר', 'של', 'על', 'את', 'עם', 'לי', 'יש', 'זה', 'או', 'אם', 'כש', 'ו', 'ב', 'ל', 'ה', 'מתי', 'למה', 'איזה', 'כמה']);
// Words that flip the question; kept as tokens and boosted when present on both sides.
const POLARITY = new Set(['לפני', 'אחרי', 'שכחתי', 'כחתי', 'לא', 'בשרי', 'חלבי', 'שבת', 'צום']);
const GENERIC_ACTIONS = new Set(['הניח', 'שים', 'עשה', 'קח', 'אמר', 'ספר', 'חזור', 'ברך', 'אכל', 'תפלל']);

export function normalizeQuery(value) {
  let text = String(value || '').normalize('NFKD').replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '');
  text = text.replace(/[״"׳']+/g, '"').replace(/[?!.,;:()\[\]\-–—]/g, ' ');
  for (const [pattern, replacement] of SYNONYMS) text = text.replace(pattern, replacement);
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function tokenize(value) {
  return normalizeQuery(value).split(' ').filter(Boolean).map(stripPrefix).filter(t => t && !STOP.has(t));
}

// Raw words (no prefix stripping) for exact-word and adjacency matching.
function words(value) {
  return normalizeQuery(value).split(' ').filter(t => t && !STOP.has(t));
}

function bigrams(list) {
  return list.slice(1).map((token, index) => `${list[index]} ${token}`);
}

// Collapse adjective forms (בשרי/חלבי → בשר/חלב) so ordered pairs compare on the noun.
function stemKey(token) {
  return token.length > 3 && /י$/.test(token) ? token.slice(0, -1) : token;
}

// Strip common Hebrew proclitics (ו, ה, ב, ל, מ, ש, כ) once, keep the stem.
function stripPrefix(token) {
  if (token.length > 3 && /^[והבלמשכ]/.test(token)) return token.slice(1);
  return token;
}

// Fuzzy prefix match only when the shared stem is long enough to be meaningful (avoids נפשות ↔ נפש).
function stemMatch(a, b) {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 4) return false;
  return (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2;
}

function scoreQuestion(q, tokens, raw) {
  const haystacks = [q.question, ...q.variants, q.topic];
  const normalizedRaw = normalizeQuery(raw);
  let score = 0;
  const contentTokens = tokens.filter(token => !POLARITY.has(token) && !GENERIC_ACTIONS.has(token));
  const bag = new Set(haystacks.flatMap(tokenize));
  const wordBag = new Set(haystacks.flatMap(words));
  const bigramBag = new Set(haystacks.flatMap(text => [...bigrams(words(text)), ...bigrams(tokenize(text).map(stemKey))]));
  const contentHits = contentTokens.filter(token => bag.has(token) || [...bag].some(b => stemMatch(b, token)));
  if (contentTokens.length && contentHits.length === 0) return 0;
  for (const text of haystacks) {
    const n = normalizeQuery(text);
    if (n === normalizedRaw) score += 100;
    else if (normalizedRaw.length > 3 && n.includes(normalizedRaw)) score += 40;
  }
  let hits = 0;
  for (const t of tokens) {
    if (bag.has(t)) { hits++; score += POLARITY.has(t) ? 12 : 8; continue; }
    if ([...bag].some(b => stemMatch(b, t))) { hits++; score += 4; }
  }
  if (tokens.length && hits === 0) return 0;
  // Whole-word hits (e.g. בורא, מקווה) outrank stem-only hits; adjacent pairs preserve word order (בשר אחרי חלב ≠ חלב אחרי בשר).
  for (const w of words(raw)) if (wordBag.has(w)) score += 3;
  const queryPairs = new Set([...bigrams(words(raw)), ...bigrams(tokens.map(stemKey))]);
  for (const pair of queryPairs) if (bigramBag.has(pair)) score += 10;
  return score + (hits / Math.max(tokens.length, 1)) * 20;
}

export function searchHalacha(rawQuery, { limit = 12 } = {}) {
  const tokens = tokenize(rawQuery);
  if (!normalizeQuery(rawQuery)) return { state: 'empty', questions: [], topics: [], categories: [], yalkut: [] };
  const verifiedMatches = publishedPracticalQuestions()
    .map(q => ({ q, score: scoreQuestion(q, tokens, rawQuery) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const questionMatches = HALACHA_QUESTIONS
    .map(q => ({ q, score: scoreQuestion(q, tokens, rawQuery) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const questions = [...verifiedMatches.map(item => ({ ...item, score: item.score + 12 })), ...questionMatches]
    .filter((item, index, list) => index === list.findIndex(other => other.q.id === item.q.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit).map(x => x.q);
  const norm = normalizeQuery(rawQuery);
  const categories = HALACHA_TOPICS.filter(c => [c.title, ...c.aliases].some(a => norm.includes(normalizeQuery(a)) || normalizeQuery(a).includes(norm)));
  const topics = [...new Set(HALACHA_QUESTIONS.map(q => q.topic))].filter(t => norm.includes(normalizeQuery(t)) || normalizeQuery(t).includes(norm));
  const sensitive = questions.some(q => q.sensitivity === 'sensitive' || q.personal);
  const yalkut = searchYalkut(rawQuery, limit);
  const unified = [
    ...verifiedMatches.slice(0, limit).map(({ q, score }) => ({ kind: 'question', item: q, score: score + 100 })),
    ...yalkut.map(item => ({ kind: 'yalkut', item, score: item.score * 0.85 + 24 })),
  ].sort((a, b) => b.score - a.score || (a.kind === 'yalkut' ? -1 : 1));
  const state = questions.length || yalkut.length ? 'questions' : (topics.length || categories.length) ? 'topic-only' : 'no-match';
  return { state, questions, topics, categories, yalkut, unified, sensitive };
}
