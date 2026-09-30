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
  // A geresh that marks a foreign sound (צ'יפס, ג'חנון, צ׳יפס) is dropped, so "ציפס" and "צ'יפס" are one word.
  text = text.replace(/([גזצץת])['׳’](?=[א-ת])/g, '$1');
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
// Words that share a stem but not a meaning: a review (ביקורת) is not a visit (ביקור), a WhatsApp group (קבוצה) is not
// a set time (קבוע). They never count as the same word.
// (Listed as written; tokenize() may have dropped a first letter it took for a proclitic, so both forms are kept.)
const FALSE_FRIENDS = new Set([['ביקור', 'ביקורת'], ['ביקור', 'ביקורות'], ['קבוע', 'קבוצה'], ['קבוע', 'קבוצת']]
  .flatMap(([a, b]) => [[a, b], [a.slice(1), b.slice(1)]]).map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`)));
const falseFriends = (a, b) => FALSE_FRIENDS.has(a < b ? `${a}|${b}` : `${b}|${a}`);
function stemMatch(a, b) {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 4) return false;
  return (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2 && !falseFriends(a, b);
}

// A question's own words never change: they are normalized and bagged once per record (the search used to redo this
// for all ~2,500 records on every query — most of the time a search took, and the keyboard waited for it).
const questionIndex = new WeakMap();
// How many records have been prepared, ever: a keystroke must never add to it once the index is warm (tests read it).
let recordsPrepared = 0;
export const halachaSearchStats = () => ({ recordsPrepared, recordWords: recordWords.size, nearCached: nearCache.size });
function indexOfQuestion(q) {
  let index = questionIndex.get(q);
  if (index) return index;
  recordsPrepared++;
  const haystacks = [q.question, ...q.variants, q.topic];
  const bag = new Set(haystacks.flatMap(tokenize));
  for (const word of bag) if (!recordWords.has(word)) { recordWords.add(word); nearCache.clear(); }
  index = {
    normalized: haystacks.map(normalizeQuery),
    bag,
    wordBag: new Set(haystacks.flatMap(words)),
    bigramBag: new Set(haystacks.flatMap(text => [...bigrams(words(text)), ...bigrams(tokenize(text).map(stemKey))])),
    hasHowMany: haystacks.some(text => /(?:^|\s)כמה(?:\s|$)/.test(normalizeQuery(text))),
  };
  questionIndex.set(q, index);
  return index;
}

// Every word any record's question is made of (its bag), gathered once. A query word's near forms (stem, plural,
// proclitic slip, word family) are looked up in it once per query, so a record is scored by set lookups instead of
// comparing each query word with each of its words — the same matches, without ~2,500 × words comparisons per key.
const recordWords = new Set();
const nearCache = new Map();
function nearForms(token) {
  let near = nearCache.get(token);
  if (near) return near;
  const loose = [], withFamily = [];
  const own = family(token);
  for (const word of recordWords) {
    const close = stemMatch(word, token) || prefixSlip(word, token) || pluralMatch(word, token);
    if (close) loose.push(word);
    if (close || (own !== null && family(word) === own)) withFamily.push(word);
  }
  near = { loose, withFamily };
  if (nearCache.size > 400) nearCache.clear();
  nearCache.set(token, near);
  return near;
}
const hasAny = (bag, list) => { for (const word of list) if (bag.has(word)) return true; return false; };

// All records are prepared before a query's near forms are looked up (the warm-up usually did this already).
let allIndexed = false;
function indexAllQuestions() {
  if (allIndexed) return;
  for (const q of publishedPracticalQuestions()) indexOfQuestion(q);
  for (const q of HALACHA_QUESTIONS) indexOfQuestion(q);
  allIndexed = true;
}

// What a query contributes to every record's score, computed once per search (not once per record).
const queryShape = (tokens, raw) => ({
  normalizedRaw: normalizeQuery(raw), rawWords: words(raw), queryPairs: new Set([...bigrams(words(raw)), ...bigrams(tokens.map(stemKey))]),
  contentTokens: tokens.filter(token => !POLARITY.has(token) && !GENERIC_ACTIONS.has(token)),
  hasHowMany: /(?:^|\s)כמה(?:\s|$)/.test(normalizeQuery(raw)),
});
function scoreQuestion(q, tokens, raw, shape = queryShape(tokens, raw)) {
  const { normalizedRaw, rawWords, queryPairs, contentTokens } = shape;
  const { normalized, bag, wordBag, bigramBag, hasHowMany } = indexOfQuestion(q);
  let score = 0;
  if (contentTokens.length && !contentTokens.some(token => bag.has(token) || hasAny(bag, nearForms(token).loose))) return 0;
  for (const n of normalized) {
    if (n === normalizedRaw) score += 100;
    else if (normalizedRaw.length > 3 && n.includes(normalizedRaw)) score += 40;
  }
  let hits = 0;
  for (const t of tokens) {
    if (bag.has(t)) { hits++; score += POLARITY.has(t) ? 12 : 8; continue; }
    if (hasAny(bag, nearForms(t).withFamily)) { hits++; score += 4; }
  }
  // "כמה" (how many / how much) is a stop word for matching, but a question that asks it should meet one that answers it.
  if (shape.hasHowMany && hasHowMany) score += 12;
  if (tokens.length && hits === 0) return 0;
  // Whole-word hits (e.g. בורא, מקווה) outrank stem-only hits; adjacent pairs preserve word order (בשר אחרי חלב ≠ חלב אחרי בשר).
  for (const w of rawWords) if (wordBag.has(w)) score += 3;
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
// Category and topic names, normalized once.
let topicNamesCache = null;
const topicIndex = () => (topicNamesCache ||= {
  categoryNames: HALACHA_TOPICS.map(c => [c.title, ...c.aliases].map(normalizeQuery)),
  topicNames: [...new Set(HALACHA_QUESTIONS.map(q => q.topic))].map(t => [t, normalizeQuery(t)]),
});
export function searchHalacha(rawQuery, { limit = 12 } = {}) {
  const tokens = tokenize(rawQuery);
  if (!normalizeQuery(rawQuery)) return { state: 'empty', questions: [], topics: [], categories: [], yalkut: [] };
  // A learning-track case (stage 5) comes first only when it fits the words clearly better than every general answer:
  // a general question keeps its general answer, a specific one still reaches its case.
  const shabbatQuery = SHABBAT_WORDS.test(normalizeQuery(rawQuery));
  const rarest = questionKeyTerms(rawQuery).ranked[0] || null;
  const shape = queryShape(tokens, rawQuery);
  indexAllQuestions();
  const verifiedMatches = publishedPracticalQuestions()
    .map(q => ({ q, score: scoreQuestion(q, tokens, rawQuery, shape) * (q.trackTier ? TRACK_TIER_WEIGHT : 1) }))
    .filter(x => x.score > 0)
    .map(x => ({ ...x, score: x.score * bookWeight(x.q, rawQuery, shabbatQuery, rarest) }))
    .sort((a, b) => b.score - a.score);
  const questionMatches = HALACHA_QUESTIONS
    .map(q => ({ q, score: scoreQuestion(q, tokens, rawQuery, shape) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const questions = [...verifiedMatches.map(item => ({ ...item, score: item.score + 12 })), ...questionMatches]
    .filter((item, index, list) => index === list.findIndex(other => other.q.id === item.q.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit).map(x => x.q);
  const norm = normalizeQuery(rawQuery);
  const { categoryNames, topicNames } = topicIndex();
  const categories = HALACHA_TOPICS.filter((c, i) => categoryNames[i].some(a => norm.includes(a) || a.includes(norm)));
  const topics = topicNames.filter(([, n]) => norm.includes(n) || n.includes(norm)).map(([t]) => t);
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
// Whether the corpus knows a word, and how rare it is: fixed for a fixed corpus, so looked up once per word.
const knownCache = new Map();
const known = (token, vocab) => {
  if (vocab.df.has(token)) return true;
  if (!knownCache.has(token)) { if (knownCache.size > 2000) knownCache.clear(); knownCache.set(token, vocab.words.some(word => sameWord(word, token))); }
  return knownCache.get(token);
};
const idfCache = new Map();
const idfOf = (token, vocab) => {
  if (!idfCache.has(token)) {
    if (idfCache.size > 2000) idfCache.clear();
    idfCache.set(token, Math.log(vocab.total / (1 + (vocab.df.get(token) || [...vocab.df.entries()].filter(([word]) => sameWord(word, token)).reduce((sum, [, n]) => sum + n, 0)))));
  }
  return idfCache.get(token);
};
// An entry's words for the relevance gate never change: bagged once per entry.
const relevanceBags = new WeakMap();
const relevanceBag = entry => {
  let bag = relevanceBags.get(entry);
  if (!bag) { bag = [entry.question, ...(entry.variants || []), ...(entry.aliases || []), entry.topic, entry.subtopic, ...(entry.searchKeywords || []), answerWords(entry)].filter(Boolean).flatMap(tokenize); relevanceBags.set(entry, bag); }
  return bag;
};
const contains = (bag, token) => bag.some(word => sameWord(word, token));

// Words that only look like a proclitic and a particle (מ+רק, ב+רק): nouns, kept as content words.
const NOT_A_PARTICLE = new Set(['מרק', 'ברק']);
export function questionKeyTerms(query) {
  const vocab = corpusVocabulary();
  // Generic words are recognised on the raw word (before the proclitic is stripped), then compared as stems.
  const content = [...new Set(normalizeQuery(query).split(' ').filter(word => word && !/\d/.test(word) && !STOP.has(word) && !GENERIC.has(word) && (NOT_A_PARTICLE.has(word) || !GENERIC.has(word.replace(/^[והבלמשכ]/, '')))).map(stripPrefix))].filter(token => token.length > 1 && !GENERIC.has(token) && !GENERIC_ACTIONS.has(token));
  const unknown = content.filter(token => token.length >= 3 && !known(token, vocab));
  const knownTerms = content.filter(token => !unknown.includes(token));
  const idf = token => idfOf(token, vocab);
  const ranked = knownTerms.sort((a, b) => idf(b) - idf(a));
  return { content, unknown, ranked };
}

// How well an entry is about the question: 'strong' (all the specific words; two thirds when there are four or more),
// 'weak' (only the most specific word), or null.
export function entryRelevance(query, entry, terms = questionKeyTerms(query)) {
  // A word the corpus has never seen is usually the subject ("מה מברכים על פיטאיה?"): as many unknown words as known
  // ones means no entry is about the question; fewer still weigh double against coverage.
  if (!terms.ranked.length || terms.unknown.length >= terms.ranked.length) return null;
  const bag = relevanceBag(entry);
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

// Prepares the search's word index ahead of the first query, in small slices while the Halacha page is idle, so even
// the first letter typed never waits for it and no slice holds the main thread long enough to delay a key. The results
// are unchanged (it only fills the caches the search itself fills). Returns a function that stops it.
export function warmHalachaSearch({ slice = 150, schedule = callback => setTimeout(callback, 16) } = {}) {
  const steps = [() => corpusVocabulary(), () => topicIndex()];
  const records = [...publishedPracticalQuestions(), ...HALACHA_QUESTIONS];
  for (let i = 0; i < records.length; i += slice) steps.push(() => records.slice(i, i + slice).forEach(indexOfQuestion));
  steps.push(() => searchYalkut('שבת', 1));
  let stopped = false;
  const next = () => { if (stopped || !steps.length) return; steps.shift()(); schedule(next); };
  schedule(next);
  return () => { stopped = true; };
}
