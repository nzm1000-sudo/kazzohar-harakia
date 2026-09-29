// Halacha agent layer (RAG-ready, no generation). The app never issues rulings: an answer is either a verified entry
// quoted with its source, or an honest "not enough in the approved corpus". This module is the contract any future
// model must pass through — it retrieves only from approved material and rejects a model answer that states anything
// the retrieved sources do not carry.
import { searchHalacha, normalizeQuery } from './halachaSearch.mjs';
import { yalkutText } from './yalkutYosef.mjs';
import { PRACTICAL_HALACHA_QA } from '../data/practicalHalachaQa.mjs';
import { HIGH_STAKES_NOTE } from './ongShabbatGate.mjs';

// The words of a עונג שבת halacha the app carries without loading the book: the excerpts its records quote.
let ongExcerpts = null;
const ongText = id => (ongExcerpts ||= PRACTICAL_HALACHA_QA.filter(entry => entry.sourceBook === 'ong-shabbat').reduce((map, entry) => map.set(entry.sources[0].localSourceId, `${map.get(entry.sources[0].localSourceId) || ''} ${entry.sources[0].excerpt}`), new Map())).get(id) || '';

export const ANSWER_STATUS = Object.freeze({ VERIFIED: 'verified-entry', SOURCES_ONLY: 'sources-only', INSUFFICIENT: 'insufficient', SENSITIVE: 'refer-to-rabbi' });
const MIN_ENTRY_SCORE = 60;

// Retrieval: verified practical entries first (each already carries its quoted excerpt), then raw Yalkut Yosef sections.
export function retrieve(question, { limit = 5 } = {}) {
  const results = searchHalacha(question, { limit });
  const entries = (results.unified || []).filter(item => item.kind === 'question').map(item => ({ entry: item.item, score: item.score }));
  const sections = (results.yalkut || []).slice(0, limit).map(item => ({ id: item.id, citation: item.citation, snippet: item.snippet, score: item.score }));
  return { entries, sections, sensitive: Boolean(results.sensitive) };
}

// A grounded answer object — the only shape the UI (or a model) may present. It is assembled, never written.
export function groundedAnswer(question, options = {}) {
  const { entries, sections, sensitive } = retrieve(question, options);
  const citations = entry => entry.sources.map(source => ({ sourceId: source.localSourceId, citation: `${source.work}, ${source.citation}`, excerpt: source.excerpt || null }));
  const strong = entries.filter(item => item.score >= MIN_ENTRY_SCORE);
  // חולה, יולדת, תרופות in עונג שבת: the book's words and a rabbi — never a derived answer, never a personal ruling. Where
  // the book itself says that in danger one acts at once, those words come with it.
  const book = strong.find(item => item.entry.highStakes);
  if (book && (strong[0] === book || sensitive)) return { status: ANSWER_STATUS.SENSITIVE, question, entryId: book.entry.id, answer: null, citations: citations(book.entry), conflicts: [], note: HIGH_STAKES_NOTE, dangerExcerpt: book.entry.dangerExcerpt || null };
  if (sensitive) return { status: ANSWER_STATUS.SENSITIVE, question, answer: null, citations: [], conflicts: [], note: 'שאלה אישית ורגישה — פונים למורה הוראה או ליועצת הלכה.' };
  if (strong.length) {
    const [top, ...rest] = strong;
    // Two verified entries that answer the same question differently are shown side by side, never merged.
    const conflicts = rest.filter(item => normalizeQuery(item.entry.question) === normalizeQuery(top.entry.question) && item.entry.shortAnswer !== top.entry.shortAnswer)
      .map(item => ({ id: item.entry.id, answer: item.entry.shortAnswer, citations: citations(item.entry) }));
    return { status: ANSWER_STATUS.VERIFIED, question, entryId: top.entry.id, answer: top.entry.shortAnswer, ruleType: top.entry.ruleType || null, citations: citations(top.entry), conflicts, alsoSee: rest.slice(0, 3).map(item => item.entry.id) };
  }
  if (sections.length) return { status: ANSWER_STATUS.SOURCES_ONLY, question, answer: null, citations: sections.map(section => ({ sourceId: section.id, citation: `ילקוט יוסף, ${section.citation}`, excerpt: null })), conflicts: [], note: 'אין תשובה מאומתת לשאלה זו; אלה המקורות הקרובים לעיון. לשאלה מעשית — פונים לרב.' };
  return { status: ANSWER_STATUS.INSUFFICIENT, question, answer: null, citations: [], conflicts: [], note: 'אין במאגר המאושר מספיק מידע כדי לענות. לא ננחש — פונים לרב.' };
}

const clean = text => normalizeQuery(text).replace(/"/g, '');

// Gate for any future model output: every sentence must cite an approved source, every quote must be verbatim in the
// cited section, and a model may not answer when retrieval found nothing. Returns { ok, errors }.
export function validateModelAnswer(modelAnswer, retrieved, { sectionText = id => { if (String(id).startsWith('ong-shabbat-')) return ongText(id); try { return yalkutText(`Yalkut Yosef ${id}`).hebrew.join(' '); } catch { return ''; } } } = {}) {
  const errors = [];
  const allowed = new Set([...(retrieved?.entries || []).flatMap(item => item.entry.sources.map(source => source.localSourceId)), ...(retrieved?.sections || []).map(section => section.id)]);
  const claims = Array.isArray(modelAnswer?.claims) ? modelAnswer.claims : [];
  if (!allowed.size && claims.length) errors.push('no approved source was retrieved, so no answer may be given');
  if (!claims.length && modelAnswer?.status !== ANSWER_STATUS.INSUFFICIENT) errors.push('an answer without claims must be marked insufficient');
  for (const [index, claim] of claims.entries()) {
    if (!claim?.text) { errors.push(`claim ${index + 1}: empty`); continue; }
    if (!claim.sourceId) { errors.push(`claim ${index + 1}: no source`); continue; }
    if (!allowed.has(claim.sourceId)) { errors.push(`claim ${index + 1}: source ${claim.sourceId} was not retrieved from the approved corpus`); continue; }
    if (!claim.quote) { errors.push(`claim ${index + 1}: no supporting quote`); continue; }
    const text = clean(sectionText(claim.sourceId));
    if (!text || !text.includes(clean(claim.quote))) errors.push(`claim ${index + 1}: quote is not verbatim in ${claim.sourceId}`);
  }
  if (/אני פוסק|הלכה למעשה עבורך|במקרה שלך מותר|במקרה שלך אסור/.test(String(modelAnswer?.text || ''))) errors.push('personal ruling language is not allowed');
  return { ok: errors.length === 0, errors };
}
