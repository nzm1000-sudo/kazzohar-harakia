import { classifyHebrewParagraph, normalizeHebrewText, removeNikud } from '../hebrewText.mjs';
import { fixHebrewTypography } from './hebrewTypography.mjs';
import { dayConditionsFromContext, evaluateRubric } from './prayer/rubricConditions.mjs';
import { resolveConditionalMarkup } from './prayer/conditionalMarkup.mjs';
import { withPresentation } from './prayer/prayerPresentation.mjs';

// One normalization layer for every Siddur paragraph. JSX must not scatter
// text.includes checks — it renders the typed blocks this function returns.
const TYPE_CLASS = { heading: 'siddur-block-heading', instruction: 'siddur-block-instruction', rubric: 'siddur-block-rubric', recitedText: 'siddur-block-recited', conditionalAddition: 'siddur-block-addition' };
export const PRAYER_ROLE = Object.freeze({ RECITED: 'prayer-recited', HEADING: 'prayer-heading', INSTRUCTION: 'prayer-instruction', REFERENCE: 'prayer-reference', COMMENTARY: 'prayer-commentary', CONDITIONAL: 'prayer-conditional', CHAZAN_INSTRUCTION: 'prayer-chazan-instruction', TRANSLATION: 'prayer-translation', TRANSLITERATION: 'prayer-transliteration', ALTERNATIVE: 'prayer-alternative' });
const ROLE_BY_TYPE = { heading: PRAYER_ROLE.HEADING, instruction: PRAYER_ROLE.INSTRUCTION, rubric: PRAYER_ROLE.CONDITIONAL, recitedText: PRAYER_ROLE.RECITED, conditionalAddition: PRAYER_ROLE.ALTERNATIVE };
const semanticBlock = (type, block) => ({ ...block, type, role: ROLE_BY_TYPE[type], className: `${TYPE_CLASS[type]} ${ROLE_BY_TYPE[type]}` });

const plain = text => removeNikud(text).replace(/[״׳"']/g, '').replace(/\s+/g, ' ');
const EDITORIAL_ONLY = new Set(['בקיץ:', 'בחורף:', 'בראש חודש:', 'בחול המועד:', 'בחנוכה:', 'בפורים:', 'פסח:', 'סוכות:']);

function conditionsFor(context = {}) {
  const date = context.hebrewDate || {};
  const day = Number(date.day);
  const month = Number(date.month);
  const israel = Boolean(context.isIsrael);
  const holidayText = String(context.specialDay?.desc || context.specialDay?.getDesc?.() || context.specialDay?.title || context.specialDay?.hebrew || '');
  const holiday = `${holidayText} ${context.specialDay?.getFlags?.() || ''}`;
  return {
    summer: context.seasonal?.mashivHaruch === false,
    winter: context.seasonal?.mashivHaruch === true,
    rainSummer: context.seasonal?.vetenTalUmatar === false,
    rainWinter: context.seasonal?.vetenTalUmatar === true,
    rain: context.seasonal?.vetenTalUmatar === true,
    roshChodesh: Boolean(context.isRoshChodesh),
    aseret: Boolean(context.isAseretYemeiTeshuvah),
    chanukah: Boolean(context.chanukah),
    purim: Boolean(context.purim),
    fast: Boolean(context.fast),
    sukkot: /sukkot|סוכות/i.test(holiday) || (month === 7 && day >= 15 && day <= (israel ? 21 : 22)),
    cholHamoed: Boolean(context.isCholHaMoed),
    day: dayConditionsFromContext(context),
  };
}

// A season caption alone in its paragraph precedes a whole Birkat HaShanim (YY 117:2), not Gevurot.
function rubricApplies(label, conditions, standalone = false) {
  const verdict = evaluateRubric(label, conditions.day, { strict: true });
  if (verdict.season && standalone) return /קיץ/.test(label) ? conditions.rainSummer : conditions.rainWinter;
  return verdict.applies;
}

function markupParts(markup, fallbackText, dayResolved = false) {
  const source = fixHebrewTypography(String(markup || fallbackText || ''));
  const parts = [];
  const token = /<\/?small\b[^>]*>/gi;
  let offset = 0;
  let depth = 0;
  let match;
  while ((match = token.exec(source))) {
    const fragment = normalizeHebrewText(source.slice(offset, match.index), 'siddur');
    if (fragment) parts.push({ type: depth > 0 ? 'rubricText' : 'recitedText', text: fragment });
    depth = /^<\s*small\b/i.test(match[0]) ? depth + 1 : Math.max(0, depth - 1);
    offset = token.lastIndex;
  }
  const after = normalizeHebrewText(source.slice(offset), 'siddur');
  if (after) parts.push({ type: depth > 0 ? 'rubricText' : 'recitedText', text: after });
  for (const part of parts) {
    if (part.type !== 'rubricText') continue;
    const value = plain(part.text);
    // With a known day every known caption is a condition; with an unknown day the edition shows as printed.
    const isRubric = EDITORIAL_ONLY.has(value) || (dayResolved && value.length < 90 && evaluateRubric(part.text, {}).known) || /^(?:בעשרת ימי תשובה|בראש חודש|בחול המועד|בתענית|בחנוכה|בפורים|אין אומרים|יש אומרים|אומרים(?: כאן)?|אומר(?: כאן)?|בתשעה באב|נוסח עננו|נוסח)/.test(value);
    if (isRubric) part.type = 'rubric';
    else part.type = 'conditionalAddition';
  }
  return attachLeadingPunctuation(rebalanceParentheses(parts.length ? parts : [{ type: 'recitedText', text: normalizeHebrewText(source, 'siddur') }].filter(part => part.text)));
}

// Punctuation that closes a small-print word (":", ",", ".") lands at the start of the next piece
// after the split. It belongs to the end of the previous piece; a piece that is only punctuation goes.
export function attachLeadingPunctuation(parts) {
  const out = [];
  for (const part of parts) {
    const match = /^\s*([.,:;]+)\s*/.exec(part.text);
    if (match && out.length) {
      const previous = out[out.length - 1];
      out[out.length - 1] = { ...previous, text: `${previous.text.trimEnd()}${match[1]}` };
      const rest = part.text.slice(match[0].length);
      if (rest.trim()) out.push({ ...part, text: rest });
      continue;
    }
    out.push(part);
  }
  return out;
}

// The edition writes conditional additions as "( <small>בשבת</small> וברשות שבת מלכתא.)". Splitting at
// the <small> tags orphans the brackets: "(" at the end of the previous piece, ")" inside the next one —
// where it also marks where the conditional words end and the fixed text resumes. The condition itself
// is shown as its own instruction line, so the wrapping brackets are dropped and the text is split at ")".
// Brackets that are balanced inside one piece (e.g. "(בעשרה ויותר: אלהינו)") are left exactly as printed.
const firstUnmatchedClose = text => {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') { if (depth === 0) return i; depth -= 1; }
  }
  return -1;
};
const endsWithUnmatchedOpen = text => {
  const trimmed = text.trimEnd();
  if (!trimmed.endsWith('(')) return false;
  let depth = 0;
  for (const ch of trimmed) { if (ch === '(') depth += 1; else if (ch === ')') depth = Math.max(0, depth - 1); }
  return depth > 0;
};
export function rebalanceParentheses(parts) {
  const out = [];
  let open = 0;
  for (const original of parts) {
    let part = { ...original };
    if (open > 0 && part.type !== 'rubric') {
      const at = firstUnmatchedClose(part.text);
      if (at >= 0) {
        const inside = part.text.slice(0, at).trim();
        const rest = part.text.slice(at + 1).trim();
        open -= 1;
        if (inside) out.push({ ...part, text: inside });
        if (!rest) continue;
        // What follows the closing bracket is the fixed text again — always said.
        part = { type: 'recitedText', text: rest, always: true };
      }
    }
    if (part.type !== 'rubric' && endsWithUnmatchedOpen(part.text)) {
      part.text = part.text.trimEnd().slice(0, -1).trim();
      open += 1;
      if (!part.text) continue;
    }
    out.push(part);
  }
  return out;
}

export function normalizeSiddurBlocks(paragraphs = [], { title = '', markup = [], context = {} } = {}) {
  const blocks = [];
  const conditions = conditionsFor(context);
  // The day's conditions resolve the edition's own conditional structure first (captions and their scope).
  markup = resolveConditionalMarkup(paragraphs.map((raw, index) => markup[index] || (typeof raw === 'string' ? raw : raw?.text) || ''), conditions.day);
  paragraphs = paragraphs.map((raw, index) => (markup[index] ? raw : ''));
  let pendingAllowed = true;
  paragraphs.forEach((raw, index) => {
    const text = String(typeof raw === 'string' ? raw : raw?.text || '').trim();
    if (!text) return;
    const source = typeof raw === 'object' && raw !== null ? raw.source ?? index : index;
    const classified = classifyHebrewParagraph(text, index, title);
    const heading = classified === 'section-heading' || /<big\b/i.test(markup[index] || '');
    if (heading) {
      blocks.push(semanticBlock('heading', { text, source, legacyType: 'section-heading' }));
      return;
    }
    const parts = markupParts(markup[index], text, conditions.day.resolved);
    for (const part of parts) {
      if (part.type === 'rubric') {
        pendingAllowed = rubricApplies(part.text, conditions, parts.length === 1);
        if (pendingAllowed) blocks.push(semanticBlock('instruction', { text: part.text, source, legacyType: 'instruction' }));
        continue;
      }
      if (!pendingAllowed && !part.always) {
        pendingAllowed = true;
        continue;
      }
      if (part.type === 'conditionalAddition') {
        blocks.push(semanticBlock('conditionalAddition', { text: part.text, source, legacyType: 'prayer' }));
        pendingAllowed = true;
        continue;
      }
      const isInstruction = /^(יש אומרים|בעשרת ימי תשובה|בראש חודש|בחול המועד|בתענית|בחנוכה|בפורים|אומרים|אומר:|אין אומרים)/.test(part.text);
      if (isInstruction) {
        pendingAllowed = rubricApplies(part.text, conditions);
        if (pendingAllowed) blocks.push(semanticBlock('instruction', { text: part.text, source, legacyType: 'instruction' }));
        continue;
      }
      blocks.push(semanticBlock('recitedText', { text: part.text, source, legacyType: 'prayer' }));
      pendingAllowed = true;
    }
  });
  // Presentation only: how each block looks (prayer / heading / instruction / minhag / reference).
  return withPresentation(blocks);
}

export const SIDDUR_BLOCK_CLASS = TYPE_CLASS;
