// Local Halacha search over the question layer. No network, no model calls.
import { HALACHA_QUESTIONS } from '../data/halachaQuestions.mjs';
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
const POLARITY = new Set(['לפני', 'אחרי', 'שכחתי', 'לא', 'בשרי', 'חלבי', 'שבת', 'צום']);

export function normalizeQuery(value) {
  let text = String(value || '').normalize('NFKD').replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '');
  text = text.replace(/[״"׳']/g, '"').replace(/[?!.,;:()\[\]\-–—]/g, ' ');
  for (const [pattern, replacement] of SYNONYMS) text = text.replace(pattern, replacement);
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function tokenize(value) {
  return normalizeQuery(value).split(' ').filter(Boolean).map(stripPrefix).filter(t => t && !STOP.has(t));
}

// Strip common Hebrew proclitics (ו, ה, ב, ל, מ, ש, כ) once, keep the stem.
function stripPrefix(token) {
  if (token.length > 3 && /^[והבלמשכ]/.test(token)) return token.slice(1);
  return token;
}

function scoreQuestion(q, tokens, raw) {
  const haystacks = [q.question, ...q.variants, q.topic];
  const normalizedRaw = normalizeQuery(raw);
  let score = 0;
  for (const text of haystacks) {
    const n = normalizeQuery(text);
    if (n === normalizedRaw) score += 100;
    else if (normalizedRaw.length > 3 && n.includes(normalizedRaw)) score += 40;
  }
  const bag = new Set(haystacks.flatMap(tokenize));
  let hits = 0;
  for (const t of tokens) {
    if (bag.has(t)) { hits++; score += POLARITY.has(t) ? 12 : 8; continue; }
    if ([...bag].some(b => b.length > 3 && (b.startsWith(t) || t.startsWith(b)))) { hits++; score += 4; }
  }
  if (tokens.length && hits === 0) return 0;
  return score + (hits / Math.max(tokens.length, 1)) * 20;
}

export function searchHalacha(rawQuery, { limit = 12 } = {}) {
  const tokens = tokenize(rawQuery);
  if (!normalizeQuery(rawQuery)) return { state: 'empty', questions: [], topics: [], categories: [], yalkut: [] };
  const questions = HALACHA_QUESTIONS
    .map(q => ({ q, score: scoreQuestion(q, tokens, rawQuery) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.q);
  const norm = normalizeQuery(rawQuery);
  const categories = HALACHA_TOPICS.filter(c => [c.title, ...c.aliases].some(a => norm.includes(normalizeQuery(a)) || normalizeQuery(a).includes(norm)));
  const topics = [...new Set(HALACHA_QUESTIONS.map(q => q.topic))].filter(t => norm.includes(normalizeQuery(t)) || normalizeQuery(t).includes(norm));
  const sensitive = questions.some(q => q.sensitivity === 'sensitive' || q.personal);
  const yalkut = searchYalkut(rawQuery, limit);
  const state = questions.length || yalkut.length ? 'questions' : (topics.length || categories.length) ? 'topic-only' : 'no-match';
  return { state, questions, topics, categories, yalkut, sensitive };
}
