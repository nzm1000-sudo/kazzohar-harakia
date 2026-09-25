import { classifyHebrewParagraph, normalizeHebrewText, removeNikud } from '../hebrewText.mjs';

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
  };
}

// A season caption alone in its paragraph precedes a whole Birkat HaShanim (YY 117:2), not Gevurot.
function rubricApplies(label, conditions, standalone = false) {
  const value = plain(label).replace(/\s+/g, ' ').trim();
  if (value === 'בקיץ:') return standalone ? conditions.rainSummer : conditions.summer;
  if (value === 'בחורף:') return standalone ? conditions.rainWinter : conditions.winter;
  if (value === 'בראש חודש:') return conditions.roshChodesh;
  if (value === 'בחול המועד:') return conditions.cholHamoed;
  if (value === 'בחנוכה:') return conditions.chanukah;
  if (value === 'בפורים:') return conditions.purim;
  if (value === 'פסח:') return conditions.cholHamoed;
  if (value === 'סוכות:') return conditions.sukkot;
  if (/בעשרת ימי תשובה/.test(value)) return conditions.aseret;
  if (/נוסח עננו/.test(value)) return conditions.fast;
  if (/בתשעה באב|ביום תענית|בתענית ציבור|בתענית אומר/.test(value)) return conditions.fast;
  if (/בראש חודש ובחול המועד/.test(value)) return conditions.roshChodesh || conditions.cholHamoed;
  if (/בראש חודש/.test(value)) return conditions.roshChodesh;
  if (/בחול המועד/.test(value)) return conditions.cholHamoed;
  if (/בחנוכה ופורים/.test(value)) return conditions.chanukah || conditions.purim;
  if (/בחנוכה/.test(value)) return conditions.chanukah;
  if (/בפורים/.test(value)) return conditions.purim;
  if (/בחוהמ.? סוכות|בחול המועד סוכות/.test(value)) return conditions.sukkot && conditions.cholHamoed;
  if (/בחוהמ.? פסח|בחול המועד פסח/.test(value)) return conditions.cholHamoed;
  return true;
}

function markupParts(markup, fallbackText) {
  const source = String(markup || fallbackText || '');
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
    const isRubric = EDITORIAL_ONLY.has(value) || /^(?:בעשרת ימי תשובה|בראש חודש|בחול המועד|בתענית|בחנוכה|בפורים|אין אומרים|יש אומרים|אומרים(?: כאן)?|אומר(?: כאן)?|בתשעה באב|נוסח עננו|נוסח)/.test(value);
    if (isRubric) part.type = 'rubric';
    else part.type = 'conditionalAddition';
  }
  return parts.length ? parts : [{ type: 'recitedText', text: normalizeHebrewText(source, 'siddur') }].filter(part => part.text);
}

export function normalizeSiddurBlocks(paragraphs = [], { title = '', markup = [], context = {} } = {}) {
  const blocks = [];
  const conditions = conditionsFor(context);
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
    const parts = markupParts(markup[index], text);
    for (const part of parts) {
      if (part.type === 'rubric') {
        pendingAllowed = rubricApplies(part.text, conditions, parts.length === 1);
        if (pendingAllowed) blocks.push(semanticBlock('instruction', { text: part.text, source, legacyType: 'instruction' }));
        continue;
      }
      if (!pendingAllowed) {
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
  return blocks;
}

export const SIDDUR_BLOCK_CLASS = TYPE_CLASS;
