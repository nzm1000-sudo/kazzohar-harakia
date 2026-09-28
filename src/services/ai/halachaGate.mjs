// The Halacha gate for conversational output. A model's response is displayed only if every check passes; otherwise
// the assistant shows its deterministic answer instead. The packet is what retrieval actually gave the model — the
// only material a response may rest on.
import { normalizeQuery } from '../halachaSearch.mjs';

export const RESPONSE_TYPES = ['answer', 'clarification', 'multiple_cases', 'sources_only', 'disagreement', 'insufficient', 'refer_to_rabbi'];
const CONFIDENCE = ['direct', 'grounded_synthesis', 'incomplete'];
const SUPPORT = ['direct', 'synthesis'];

// Works and authorities a response might name. Naming one is allowed only if the retrieved material names it.
const KNOWN_WORKS = ['שולחן ערוך', 'שו"ע', 'משנה ברורה', 'כף החיים', 'בן איש חי', 'ילקוט יוסף', 'יביע אומר', 'יחוה דעת', 'חזון עובדיה', 'הליכות עולם', 'בית יוסף', 'רמב"ם', 'ערוך השולחן', 'אור לציון', 'פניני הלכה', 'שמירת שבת כהלכתה', 'אגרות משה', 'מגן אברהם', 'ט"ז', 'רמ"א'];
const AUTHORITY = /(?:הרב|הגאון|הגר"[א-ת]|מרן|רבי|רבנו|החכם)\s+([א-ת"']+(?:\s+[א-ת"']+)?)/g;
const PERSONAL_RULING = /אני פוסק|הלכה למעשה עבורך|במקרה שלך מותר|במקרה שלך אסור|אתה יכול לסמוך עליי|אין צורך לשאול רב/;
const REF = /סימן\s+([א-ת"׳״']{1,6})(?:[,\s]+סעיף\s+([א-ת"׳״']{1,6}))?/g;

const clean = text => normalizeQuery(text).replace(/["׳״']/g, '');

export function validateAssistantResponse(response, packet) {
  const errors = [];
  if (!response || typeof response !== 'object') return { ok: false, errors: ['not an object'] };
  const entryIds = new Set((packet.entries || []).map(entry => entry.id));
  const sourceIds = new Set([...(packet.sources || []).map(source => source.id), ...(packet.entries || []).flatMap(entry => entry.sourceIds || [])]);
  const texts = [...(packet.entries || []).flatMap(entry => [entry.question, entry.shortAnswer, entry.excerpt, entry.citation, entry.work]), ...(packet.sources || []).flatMap(source => [source.text, source.citation, source.work])].filter(Boolean);
  const corpus = clean(texts.join(' \n '));
  const textById = new Map([...(packet.entries || []).map(entry => [entry.id, clean([entry.excerpt, entry.shortAnswer].join(' '))]), ...(packet.sources || []).map(source => [source.id, clean(source.text || '')])]);

  if (!RESPONSE_TYPES.includes(response.type)) errors.push(`unknown type ${response.type}`);
  if (response.confidence && !CONFIDENCE.includes(response.confidence)) errors.push(`unknown confidence ${response.confidence}`);
  for (const id of response.entryIds || []) if (!entryIds.has(id)) errors.push(`entry ${id} was not retrieved`);
  for (const id of [...(response.sourceIds || []), ...(response.relatedEntryIds || []).filter(id => !entryIds.has(id))]) if (!sourceIds.has(id) && !entryIds.has(id)) errors.push(`source ${id} was not retrieved`);

  const claims = Array.isArray(response.claims) ? response.claims : [];
  for (const [index, claim] of claims.entries()) {
    const label = `claim ${index + 1}`;
    if (!claim?.text) { errors.push(`${label}: empty`); continue; }
    const ids = claim.sourceIds || [];
    if (!ids.length) errors.push(`${label}: no source`);
    for (const id of ids) if (!entryIds.has(id) && !sourceIds.has(id)) errors.push(`${label}: ${id} was not retrieved`);
    if (claim.support && !SUPPORT.includes(claim.support)) errors.push(`${label}: unknown support`);
    if (claim.quote) {
      const quote = clean(claim.quote);
      if (!ids.some(id => (textById.get(id) || '').includes(quote))) errors.push(`${label}: quote is not verbatim in its source`);
    }
  }

  // A practical answer must rest on something: a verified entry, or claims that each cite retrieved material.
  if (['answer', 'multiple_cases', 'disagreement'].includes(response.type) && !(response.entryIds || []).length && !claims.length) errors.push('an answer with no evidence');
  if (response.type === 'sources_only' && response.confidence === 'direct') errors.push('source-only material presented as a direct ruling');
  if (packet.openQuestion && response.type !== 'clarification') errors.push('a decisive detail is still open; the response must ask for it');
  const disputed = (packet.entries || []).filter(entry => entry.ruleType === 'machloket' && (response.entryIds || []).includes(entry.id));
  if (disputed.length && response.type === 'answer' && response.confidence === 'direct') errors.push('a disputed ruling presented as settled');

  const visible = [response.answer, response.clarification?.question, response.text, ...claims.map(claim => claim.text)].filter(Boolean).join(' \n ');
  const visibleClean = clean(visible);
  for (const work of KNOWN_WORKS) if (visibleClean.includes(clean(work)) && !corpus.includes(clean(work))) errors.push(`names a work that was not retrieved: ${work}`);
  for (const match of visible.matchAll(AUTHORITY)) if (!corpus.includes(clean(match[0])) && !corpus.includes(clean(match[1]))) errors.push(`attributes to an authority not in the sources: ${match[0]}`);
  for (const match of visible.matchAll(REF)) if (!corpus.includes(clean(match[0]))) errors.push(`reference not among the retrieved citations: ${match[0]}`);
  if (PERSONAL_RULING.test(visible)) errors.push('personal ruling language');
  return { ok: errors.length === 0, errors };
}
