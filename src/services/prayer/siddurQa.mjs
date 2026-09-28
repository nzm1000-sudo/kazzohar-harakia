// Siddur QA: checks a rite's compositions against the canonical schema and the edition's own text, and audits the
// text itself. Pure functions — used by scripts/siddur-qa.mjs (the reports in docs/siddur/) and by the tests.
// A service is VERIFIED COMPLETE only when every check passes AND the mapping was read through (reviewed: true).
import { SERVICES, SERVICE_INDEX, CONCEPTS, COMPLETENESS } from '../../data/nusach/prayerSchema.mjs';
import { resolveService, plainText } from './riteServiceComposer.mjs';
import { evaluateRubric } from './rubricConditions.mjs';

const POINTED = /[ְ-ׇּׁׂ]/;
const SMALL_ONLY = markup => /^\s*(?:<(?!small)[^>]+>\s*)*<small/i.test(markup) && !String(markup).replace(/<small\b[^>]*>[\s\S]*?<\/small>/gi, '').replace(/<[^>]+>/g, '').trim();

const CONDITION_LIKE = /^(?:ו?(?:ב|ל))(?:ר"ח|ראש|חנוכה|פורים|תענית|תעניות|חול|חוה"מ|פסח|סוכות|סכות|שבועות|שבת|יום|ימי|ימות|ימים|עשי"ת|עשרת|מוצאי|מוצ"ש|ערב|מנחת|קיץ|חורף|שמיני|הושענא|שנה|ליל|מועד|מועדים|צום|ט' באב|תשעה באב|שבעה עשר|עשרה בטבת|יו"ט)/;
// The small-print captions of a text that the condition table does not know ("בערב ראש חודש:" …): where the app
// cannot yet decide by itself whether the words after it are said today.
export function unknownCaptions(markups) {
  const out = [];
  for (const markup of markups) {
    for (const match of String(markup || '').matchAll(/<small\b[^>]*>([^<]{2,90})<\/small>/gi)) {
      const text = plainText(match[1]);
      if (!/:\s*$/.test(text) || POINTED.test(match[1])) continue;
      // Only a caption that names a time or a day is a condition; directions ("ואומר החזן חצי קדיש:") and speaker
      // cues ("קהל וחזן:") are structure, shown as instructions.
      if (!CONDITION_LIKE.test(text) || text.length > 45) continue;
      const verdict = evaluateRubric(text, { resolved: true });
      if (!verdict.known && !verdict.skip) out.push(text);
    }
  }
  return [...new Set(out)];
}

// One service of one rite.
export function checkService(serviceId, service, texts) {
  const schema = SERVICE_INDEX[serviceId];
  const problems = [];
  if (!schema) return { serviceId, level: COMPLETENESS.UNVERIFIED, problems: [`unknown service ${serviceId}`], sections: [] };
  const ids = new Set();
  for (const section of service.sections) {
    if (ids.has(section.id)) problems.push(`duplicate section id ${section.id}`);
    ids.add(section.id);
    if (!section.omit && !CONCEPTS[section.concept]) problems.push(`${section.id}: unknown concept ${section.concept}`);
    if (!section.omit && section.title === undefined) problems.push(`${section.id}: no reviewed Hebrew title`);
  }
  const resolved = resolveService(service, texts);
  for (const section of resolved) if (section.error) problems.push(`${section.id}: ${section.error}`);
  // Coverage: every paragraph of every leaf used is in a section, or omitted with a reason; none is used twice.
  const coverage = new Map();
  const duplicates = [];
  for (const section of resolved) {
    if (section.error) continue;
    const seen = coverage.get(section.ref) || new Map();
    for (let i = section.from; i <= section.to; i += 1) {
      if (seen.has(i) && !section.rewind && !seen.get(i).rewind) duplicates.push(`${section.id} ¶${i} (also in ${seen.get(i).id})`);
      if (!seen.has(i)) seen.set(i, section);
    }
    coverage.set(section.ref, seen);
  }
  const uncovered = [];
  for (const [ref, seen] of coverage) {
    const total = texts[ref].he.length;
    const missing = [];
    for (let i = 0; i < total; i += 1) if (!seen.has(i) && plainText(texts[ref].he[i])) missing.push(i);
    if (missing.length) uncovered.push(`${ref.split(', ').slice(1).join(', ')} ¶${missing.join(',')}`);
  }
  if (duplicates.length) problems.push(...duplicates.map(item => `paragraph used twice: ${item}`));
  if (uncovered.length) problems.push(...uncovered.map(item => `not covered and not omitted: ${item}`));
  // Required concepts, and the spine's order.
  const shown = resolved.filter(section => !section.omit && !section.error);
  const concepts = shown.map(section => section.concept);
  const declaredMissing = new Set((service.missing || []).map(item => item.concept));
  const absent = schema.required.filter(concept => !concepts.includes(concept));
  const undeclared = absent.filter(concept => !declaredMissing.has(concept));
  const order = schema.spine.filter(concept => concepts.includes(concept)).map(concept => [concept, concepts.indexOf(concept)]);
  const outOfOrder = order.filter(([, at], i) => i > 0 && at < order[i - 1][1]).map(([concept]) => concept);
  if (outOfOrder.length) problems.push(`spine out of order at: ${outOfOrder.join(', ')}`);
  const captions = unknownCaptions(shown.flatMap(section => texts[section.ref].he.slice(section.from, section.to + 1)));
  let level;
  if (service.sourceGap) level = COMPLETENESS.SOURCE_GAP;
  else if (problems.length || !service.reviewed) level = COMPLETENESS.UNVERIFIED;
  else if (absent.length) level = absent.every(concept => declaredMissing.has(concept)) && absent.some(concept => schema.spine.includes(concept)) ? COMPLETENESS.SOURCE_GAP : COMPLETENESS.PARTIAL;
  else if (captions.length || (service.conditionsPending || []).length) level = COMPLETENESS.CONDITIONS_PENDING;
  else level = COMPLETENESS.VERIFIED;
  return {
    serviceId,
    title: service.title || schema.title,
    level,
    reviewed: Boolean(service.reviewed),
    problems,
    absent,
    undeclaredAbsent: undeclared,
    unknownCaptions: captions,
    conditionsPending: service.conditionsPending || [],
    sections: resolved.map((section, index) => ({ order: index + 1, id: section.id, concept: section.concept, title: section.title, ref: section.ref, from: section.from, to: section.to, when: section.when || null, role: section.role || null, omit: Boolean(section.omit), why: section.why || null, required: Boolean(section.concept && schema.required.includes(section.concept)), error: section.error || null })),
  };
}

// Every schema service for one rite: composed ones checked, the others SOURCE GAP (declared) or UNVERIFIED (not yet mapped).
export function checkRite(composition, texts) {
  return SERVICES.map(schema => {
    const service = composition?.services?.[schema.id];
    if (!service) {
      const gap = composition?.sourceGaps?.[schema.id];
      return { serviceId: schema.id, title: schema.title, level: gap ? COMPLETENESS.SOURCE_GAP : COMPLETENESS.UNVERIFIED, problems: gap ? [] : ['not composed yet'], gap: gap || null, sections: [], absent: [], unknownCaptions: [], conditionsPending: [] };
    }
    return checkService(schema.id, service, texts);
  });
}

// ── Text audit ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Suspicious text in a pack, paragraph by paragraph. Findings are reported with the exact address and words; the
// source is never silently repaired (a display rule that changes nothing in the words is listed as such).
const CHECKS = [
  ['glued-at-line-break', 'שתי מילים שהשבירה ביניהן (<br>) נמחקה — מוצגות דבוקות', markup => /[א-תְ-ׇ]<br\s*\/?>[א-ת]/i.test(markup)],
  ['glued-at-small', 'מילה של הוראה דבוקה למילת תפילה בגבול האותיות הקטנות', markup => /[א-ת]<\/small>[א-ת]|[א-ת]<small[^>]*>[א-ת]/i.test(markup)],
  ['paseq', 'קו פסק (׀ / |) של טעמי המקרא בתוך טקסט הסידור', markup => /[׀|]/.test(plainTextKeepPaseq(markup))],
  ['entity', 'ישות HTML שלא פוענחה', markup => /&(?!nbsp;|thinsp;)[a-z#0-9]+;/i.test(markup)],
  ['latin', 'אותיות לטיניות בתוך הטקסט', markup => /[A-Za-z]{2,}/.test(markup.replace(/<[^>]+>/g, ''))],
  ['isolated-mark', 'סימן ניקוד בודד (אחרי רווח או בתחילת שורה)', markup => /(^|[\s>])[ְ-ׇּׁׂ]/.test(markup.replace(/<[^>]+>/g, ' '))],
  ['unbalanced-parentheses', 'סוגריים לא מאוזנים בתוך הפסקה', markup => { const t = markup.replace(/<[^>]+>/g, ''); return (t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length; }],
  ['unbalanced-small', 'תגית <small> לא מאוזנת', markup => (markup.match(/<small\b/gi) || []).length !== (markup.match(/<\/small>/gi) || []).length],
  ['name-combination', 'צירוף אותיות של שמות (כוונה) בתוך הטקסט', markup => /(?:^|\s)[יהוא]{7,}(?=\s|$|[,:.])|יאהדונהי|אהדונהי/.test(plainText(markup))],
  ['double-punctuation', 'סימני פיסוק כפולים', markup => /[:.,]\s*[:.,](?![.])/.test(markup.replace(/<[^>]+>/g, '').replace(/\.\.\./g, ''))],
];
function plainTextKeepPaseq(markup) { return String(markup || '').replace(/<[^>]+>/g, ' ').replace(/[֑-֯]/g, ''); }

export function auditText(pack) {
  const findings = [];
  for (const [ref, text] of Object.entries(pack.texts)) {
    const seen = new Map();
    (text.he || []).forEach((markup, index) => {
      const value = String(markup || '');
      for (const [code, label, test] of CHECKS) if (test(value)) findings.push({ code, label, ref, index, excerpt: excerptOf(value, code) });
      const plain = plainText(value);
      if (plain.length > 60) {
        if (seen.has(plain)) findings.push({ code: 'duplicate-paragraph', label: 'פסקה זהה חוזרת באותו קטע', ref, index, excerpt: `= ¶${seen.get(plain)}: ${plain.slice(0, 60)}…` });
        else seen.set(plain, index);
      }
    });
    const last = (text.he || []).map(String).filter(item => plainText(item)).at(-1) || '';
    const tail = plainText(last);
    if (tail && POINTED.test(last) && !SMALL_ONLY(last) && !/[:.׃!?)\]"'״׳]\s*$/.test(tail)) findings.push({ code: 'truncated-end', label: 'הקטע מסתיים באמצע משפט', ref, index: text.he.length - 1, excerpt: `…${tail.slice(-50)}` });
  }
  return findings;
}
function excerptOf(markup, code) {
  const value = String(markup);
  const at = { 'glued-at-line-break': /<br/i, 'glued-at-small': /<\/?small/i, paseq: /[׀|]/, entity: /&[a-z#0-9]+;/i, latin: /[A-Za-z]{2,}/ }[code];
  if (at) { const i = value.search(at); if (i >= 0) return plainText(value.slice(Math.max(0, i - 60), i + 60)); }
  return plainText(value).slice(0, 110);
}

// Titles a user should never see as a prayer's name.
export const GENERIC_TITLES = new Set(['ברכה', 'תפילה', 'המשך', 'סוף', 'פתיחה', 'הקדמה', 'שונות', 'תוספות']);
