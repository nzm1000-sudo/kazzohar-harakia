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
  // In halacha questions "הספירה" alone is the omer count.
  [word('הספירה', 'בספירה', 'לספירה'), 'ספירת העומר'],
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
  // Single characters (a stray digit or letter) carry no meaning on their own and would match unrelated measures.
  return normalizeQuery(value).split(' ').filter(Boolean).map(stripPrefix).filter(t => t && t.length > 1 && !STOP.has(t));
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
  const contentHits = contentTokens.filter(token => bag.has(token) || [...bag].some(b => stemMatch(b, token) || pluralMatch(b, token) || prefixSlip(b, token)));
  if (contentTokens.length && contentHits.length === 0) return 0;
  for (const text of haystacks) {
    const n = normalizeQuery(text);
    if (n === normalizedRaw) score += 100;
    else if (normalizedRaw.length > 3 && n.includes(normalizedRaw)) score += 40;
  }
  let hits = 0;
  for (const t of tokens) {
    if (bag.has(t)) { hits++; score += POLARITY.has(t) ? 12 : 8; continue; }
    if ([...bag].some(b => stemMatch(b, t) || prefixSlip(b, t) || pluralMatch(b, t) || (family(b) !== null && family(b) === family(t)))) { hits++; score += 4; }
  }
  // "כמה" (how many / how much) is a stop word for matching, but a question that asks it should meet one that answers it.
  if (/(?:^|\s)כמה(?:\s|$)/.test(normalizedRaw) && haystacks.some(text => /(?:^|\s)כמה(?:\s|$)/.test(normalizeQuery(text)))) score += 12;
  if (tokens.length && hits === 0) return 0;
  // Whole-word hits (e.g. בורא, מקווה) outrank stem-only hits; adjacent pairs preserve word order (בשר אחרי חלב ≠ חלב אחרי בשר).
  for (const w of words(raw)) if (wordBag.has(w)) score += 3;
  const queryPairs = new Set([...bigrams(words(raw)), ...bigrams(tokens.map(stemKey))]);
  for (const pair of queryPairs) if (bigramBag.has(pair)) score += 10;
  return (score + (hits / Math.max(tokens.length, 1)) * 20) * (q.trackTier ? 0.75 : 1); // a learning-track case yields to a general answer
}

export const TRACK_TIER_WEIGHT = 0.6;
// עונג שבת is a practical Shabbat digest: for a question asked about Shabbat, its halacha leads, and the Yalkut Yosef
// answer and sections stay beside it (source depth), never merged into it. Most of its halachot are specific cases
// (a sick person's meat-and-milk wait, Chanukah candles on a Friday): like a learning-track case, a book halacha whose
// question names something the user did not ask about yields to a general answer.
export const ONG_SHABBAT_BOOST = 1.18;
export const ONG_SPECIFIC_WEIGHT = 0.75;
const SHABBAT_WORDS = /(?:^|\s)[והבלמש]?(?:שבת|שבתות|מוצ"ש|מוצש|מוצאי שבת|בשבת)(?:\s|$)/;
const specificsCache = new Map();
// Who the halacha is about changes it: a book halacha asked about a non-Jew, a child, a sick person or a woman after
// childbirth is a particular case unless the user named that person.
const ROLE = /(?:^|\s)[והבלמשכ]{0,2}(גוי|גויה|נכרי|קטן|קטנה|ילד|ילדה|ילדים|תינוק|תינוקת|חולה|יולדת|מינקת|עיוור|עיורת|עיור|אשכנזי|אורח|אורחים)(?=\s|$)/g;
const roles = text => new Set([...normalizeQuery(text).matchAll(ROLE)].map(match => match[1].replace(/[הת]$/, '').replace(/ים$/, '')));
// A book halacha that lacks the question's most specific word ("חנוכה" in "עד מתי מדליקים נרות חנוכה") is not about it.
const bagCache = new Map();
const entryBag = q => { if (!bagCache.has(q.id)) bagCache.set(q.id, [q.question, ...(q.variants || []), ...(q.searchKeywords || [])].flatMap(tokenize)); return bagCache.get(q.id); };
export const ONG_UNMARKED_WEIGHT = 0.8;
function bookWeight(q, rawQuery, shabbatQuery, rarest) {
  if (q.sourceBook !== 'ong-shabbat') return 1;
  const asked = roles(rawQuery);
  if ([...roles(q.question)].some(role => !asked.has(role)) || extraSpecifics(rawQuery, q).length || (rarest && !contains(entryBag(q), rarest))) return ONG_SPECIFIC_WEIGHT;
  // Asked about Shabbat: the book leads. Asked without saying so: the book stands beside the general answers.
  return shabbatQuery ? ONG_SHABBAT_BOOST : ONG_UNMARKED_WEIGHT;
}
// A high-stakes record's "short answer" is only a pointer to the book's words and a rabbi: never matched as content.
const answerWords = doc => (doc.answerIsRouting ? null : doc.shortAnswer);
export function searchHalacha(rawQuery, { limit = 12 } = {}) {
  const tokens = tokenize(rawQuery);
  if (!normalizeQuery(rawQuery)) return { state: 'empty', questions: [], topics: [], categories: [], yalkut: [] };
  // A learning-track case (stage 5) comes first only when it fits the words clearly better than every general answer:
  // a general question keeps its general answer, a specific one still reaches its case.
  const shabbatQuery = SHABBAT_WORDS.test(normalizeQuery(rawQuery));
  const rarest = questionKeyTerms(rawQuery).ranked[0] || null;
  const verifiedMatches = publishedPracticalQuestions()
    .map(q => ({ q, score: scoreQuestion(q, tokens, rawQuery) * (q.trackTier ? TRACK_TIER_WEIGHT : 1) }))
    .filter(x => x.score > 0)
    .map(x => ({ ...x, score: x.score * bookWeight(x.q, rawQuery, shabbatQuery, rarest) }))
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
    // With a large verified corpus, keep room for the source sections themselves: answers first, sources still in view.
    ...verifiedMatches.slice(0, yalkut.length ? Math.max(3, limit - 3) : limit).map(({ q, score }) => ({ kind: 'question', item: q, score: score + 100 })),
    ...yalkut.map(item => ({ kind: 'yalkut', item, score: item.score * 0.85 + 24 })),
  ].sort((a, b) => b.score - a.score || (a.kind === 'yalkut' ? -1 : 1));
  const state = questions.length || yalkut.length ? 'questions' : (topics.length || categories.length) ? 'topic-only' : 'no-match';
  return { state, questions, topics, categories, yalkut, unified, sensitive };
}

// ---- Relevance gate: a search match is not a relevant answer ----
// An entry (or source) counts as relevant to a question only if it contains the question's most specific word — the
// rarest word of the question in the corpus — and covers at least half of the question's content words. A question
// with a word the corpus has never seen (e.g. a food with no entry) has no relevant entry: an honest gap, not a list.
const GENERIC = new Set(['ואם', 'ומה', 'וגם', 'אז', 'בין', 'ביניהן', 'ביניהם', 'כזו', 'כזה', 'כאלה', 'הזה', 'הזו', 'אותו', 'אותה', 'בו', 'בה', 'להם', 'שלי', 'שלו', 'שלה', 'בעצם', 'בטוח', 'שואלת', 'שואל', 'שואלים', 'שאלתי', 'ששאל', 'צריכה', 'צריכות', 'מתפללים', 'להתפלל', 'מתפלל', 'נותנים', 'שמים', 'שם', 'עושים', 'עושה', 'לעשות', 'שכחתי', 'היום', 'אומרים', 'אומר', 'לומר', 'מברכים', 'מברך', 'לברך', 'ברכה', 'אכלתי', 'לאכול', 'שבת', 'בשבת', 'חג', 'יום', 'דבר', 'כך', 'אני', 'הוא', 'היא', 'אנחנו', 'לפני', 'אחרי', 'לא', 'כן', 'גם', 'רק', 'עוד', 'כבר', 'עכשיו', 'זמן', 'חייב', 'חייבים', 'צריכים', 'מותרת', 'אסורה', 'בלי', 'עם', 'כל', 'אחד', 'דין', 'הלכה', 'השאלה', 'קרה', 'ומה', 'שאני', 'אצלי', 'איפה', 'באיזה', 'איזו', 'מי', 'מדוע']);
let vocabulary = null;
function corpusVocabulary() {
  if (vocabulary) return vocabulary;
  const df = new Map();
  const docs = [...publishedPracticalQuestions(), ...HALACHA_QUESTIONS];
  for (const doc of docs) {
    const words = new Set([doc.question, ...(doc.variants || []), ...(doc.aliases || []), doc.topic, doc.subtopic, ...(doc.searchKeywords || []), answerWords(doc)].filter(Boolean).flatMap(tokenize));
    for (const word of words) df.set(word, (df.get(word) || 0) + 1);
  }
  vocabulary = { df, total: docs.length, words: [...df.keys()] };
  return vocabulary;
}
// Word families: conjugations and forms that plain prefix/stem matching cannot join (אוכל ↔ לאכול, אשתי ↔ אישה).
// Keys are compared after the one-letter proclitic strip that tokenize() applies.
const FAMILIES = [
  ['אכל', 'אוכל', 'אוכלת', 'אוכלים', 'אכול', 'אכלתי', 'אכלה', 'אכלנו', 'אכילה', 'אכילת'],
  ['שתה', 'שתיתי', 'תיתי', 'שתות', 'שותה', 'שותים', 'שתייה', 'שתיה', 'שתינו'],
  ['אישה', 'אשתי', 'אשה', 'נשים', 'אשת', 'אישתי', 'לאשתי'],
  ['הדלקה', 'מדליקים', 'דליקים', 'הדליק', 'הדלקת', 'דליקה', 'מדליקה', 'מדליק', 'דליק', 'דלקת'],
  ['ספירה', 'סופרים', 'ספור', 'ספירת', 'סופרת', 'סופרות', 'ספרתי', 'סופר', 'לספור'],
  ['תספורת', 'הסתפר', 'מסתפר', 'מסתפרים', 'סתפר', 'מסתפרת', 'סתפרים'],
  ['טבילה', 'הטביל', 'טבילת', 'מטבילים', 'טבילים', 'טבול', 'הטבלה', 'טבילו', 'הטבילו'],
  ['נטילה', 'נוטלים', 'נטילת', 'יטול', 'ליטול', 'נטלתי', 'נוטל'],
  ['הנחה', 'מניחים', 'ניחים', 'הניח', 'הנחת', 'מניח', 'ניח'],
  ['דיבור', 'דיברתי', 'דבר', 'מדברים', 'דברים', 'דיבר', 'ברתי', 'לדבר'],
  ['ילד', 'ילדים', 'ילדה', 'בני', 'בנים', 'קטן', 'קטנים', 'קטנה'],
  ['שמיעה', 'שמוע', 'לשמוע', 'שומעים', 'שמעתי', 'שומע'],
  ['נסיעה', 'נוסע', 'נוסעים', 'נסוע', 'נסעתי', 'נסיעת', 'נוסעת'],
];
const FAMILY_OF = new Map(FAMILIES.flatMap(([head, ...forms]) => [head, ...forms].flatMap(form => [[form, head], [stripPrefix(form), head]])));
const family = token => FAMILY_OF.get(token) || null;
// tokenize() strips a first letter that may belong to the word itself (שולחן → ולחן); compare both ways.
// Only when the extra first letter is a real proclitic (so ביצה → יצה never meets פיצה).
const PROCLITIC = /^[והבלמשכ]/;
const prefixSlip = (a, b) => (a.length >= 3 && b.length >= 2 && PROCLITIC.test(a) && a.slice(1) === b) || (b.length >= 3 && a.length >= 2 && PROCLITIC.test(b) && b.slice(1) === a);
const editOne = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};
// Typo tolerance (one letter) only for longer words, where a one-letter difference is still the same word.
const fuzzy = (a, b) => a.length >= 5 && b.length >= 5 && editOne(a, b);
// Singular and plural (תות ↔ תותים, ברק ↔ ברקים, מצווה ↔ מצוות).
const singular = w => { const plural = w.length > 4 ? w.replace(/(?:ים|ות)$/, '') : w; return plural === w && w.length >= 4 ? w.replace(/ה$/, '') : plural; };
const pluralMatch = (a, b) => a.length >= 3 && b.length >= 3 && a !== b && singular(a) === singular(b) && singular(a).length >= 2 && Math.abs(a.length - b.length) <= 3;
const sameWord = (word, token) => word === token || stemMatch(word, token) || fuzzy(word, token) || prefixSlip(word, token) || pluralMatch(word, token) || (family(word) !== null && family(word) === family(token));
const known = (token, vocab) => vocab.df.has(token) || vocab.words.some(word => sameWord(word, token));
const contains = (bag, token) => bag.some(word => sameWord(word, token));

// Words that only look like a proclitic and a particle (מ+רק, ב+רק): nouns, kept as content words.
const NOT_A_PARTICLE = new Set(['מרק', 'ברק']);
export function questionKeyTerms(query) {
  const vocab = corpusVocabulary();
  // Generic words are recognised on the raw word (before the proclitic is stripped), then compared as stems.
  const content = [...new Set(normalizeQuery(query).split(' ').filter(word => word && !/\d/.test(word) && !STOP.has(word) && !GENERIC.has(word) && (NOT_A_PARTICLE.has(word) || !GENERIC.has(word.replace(/^[והבלמשכ]/, '')))).map(stripPrefix))].filter(token => token.length > 1 && !GENERIC.has(token) && !GENERIC_ACTIONS.has(token));
  const unknown = content.filter(token => token.length >= 3 && !known(token, vocab));
  const knownTerms = content.filter(token => !unknown.includes(token));
  const idf = token => Math.log(vocab.total / (1 + (vocab.df.get(token) || [...vocab.df.entries()].filter(([word]) => sameWord(word, token)).reduce((sum, [, n]) => sum + n, 0))));
  const ranked = knownTerms.sort((a, b) => idf(b) - idf(a));
  return { content, unknown, ranked };
}

// How well an entry is about the question: 'strong' (all the specific words; two thirds when there are four or more),
// 'weak' (only the most specific word), or null.
export function entryRelevance(query, entry, terms = questionKeyTerms(query)) {
  // A word the corpus has never seen is usually the subject ("מה מברכים על פיטאיה?"): as many unknown words as known
  // ones means no entry is about the question; fewer still weigh double against coverage.
  if (!terms.ranked.length || terms.unknown.length >= terms.ranked.length) return null;
  const bag = [entry.question, ...(entry.variants || []), ...(entry.aliases || []), entry.topic, entry.subtopic, ...(entry.searchKeywords || []), answerWords(entry)].filter(Boolean).flatMap(tokenize);
  const covered = terms.ranked.filter(token => contains(bag, token)).length;
  const total = terms.ranked.length + 2 * terms.unknown.length;
  const needed = total >= 4 ? Math.ceil(total * 2 / 3) : total;
  if (!contains(bag, terms.ranked[0])) {
    if (terms.unknown.length) return null;
    // The rarest word may be incidental ("קפה שהכין עובד גוי"): with four or more words, an entry that has all the
    // others is still about the question.
    return terms.ranked.length >= 4 && covered >= terms.ranked.length - 1 && contains(bag, terms.ranked[1]) ? 'strong' : null;
  }
  return covered >= needed ? 'strong' : 'weak';
}
export const isRelevantEntry = (query, entry, terms) => entryRelevance(query, entry, terms) === 'strong';

// true when a Yalkut Yosef section is about the question's subject: its title names the most specific word.
export function isRelevantSection(query, section, terms = questionKeyTerms(query)) {
  if (!terms.ranked.length || terms.unknown.length) return false;
  const title = tokenize(`${section.section || ''} ${section.title || ''} ${section.chapter || ''}`);
  const lead = tokenize(String(section.snippet || section.text || '').slice(0, 220));
  return contains(title, terms.ranked[0]) || (contains(lead, terms.ranked[0]) && terms.ranked.slice(1).some(token => contains(lead, token)));
}

// Does the entry's own question (not its answer text) name this word? For "מה מברכים על X?" the entry must be about X.
export function questionNames(entry, word, { questionOnly = false } = {}) {
  const raw = normalizeQuery(word);
  const forms = [...new Set([raw, stripPrefix(raw)])].filter(form => form.length > 1);
  const hit = text => { const bag = normalizeQuery(text).split(' ').filter(Boolean).flatMap(token => [token, stripPrefix(token)]); return forms.some(form => contains(bag, form)); };
  if (hit(entry.question)) return true;
  if (questionOnly) {
    // A variant counts when it asks about the word itself ("ברכה על בירה"), not when it merely mentions it.
    return (entry.variants || []).some(variant => new RegExp(`(?:^|\\s)(?:על|ברכה|מברכים על)\\s+(?:ה)?${raw.replace(/^ה/, '')}(?:\\s|$)`).test(normalizeQuery(variant)));
  }
  return [...(entry.variants || []), ...(entry.aliases || [])].some(hit);
}

// Content words of the entry's question that the user's question does not have: a general question answered by a much
// more specific entry ("איך מכשירים כלי?" → "איך מכשירים קומקום חשמלי?") is one case of it, not its answer.
// Only rare words count (a common word like "סדר" or "שעה" does not make an entry more particular).
export function extraSpecifics(query, entry) {
  const asked = tokenize(query);
  const vocab = corpusVocabulary();
  if (!specificsCache.has(entry.question)) specificsCache.set(entry.question, questionKeyTerms(entry.question).ranked.filter(token => token.length >= 3 && (vocab.df.get(token) || 0) <= 12));
  return specificsCache.get(entry.question).filter(token => !contains(asked, token));
}
