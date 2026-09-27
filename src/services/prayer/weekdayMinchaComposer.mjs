import siddurOffline from '../../data/siddurOffline.mjs';
import { insertPersonalVerses, isElohaiNetzor, isYihyuLeratzon, MAX_PERSONAL_VERSES, PERSONAL_VERSE_BLOCK_PREFIX } from '../personalVerses.mjs';
import PACK from '../../data/prayerPacks/edotHaMizrachWeekdayMincha.mjs';
import { normalizeHebrewText } from '../../hebrewText.mjs';
import { checksum } from './checksum.mjs';
import { buildTimeContext } from './timeContext.mjs';
import { buildCalendarContext } from './calendarContext.mjs';
import { CONDITIONS, RULES_VERSION, STATUS, resolveWeekdayMinchaRules } from './weekdayMinchaRules.mjs';

export const WEEKDAY_MINCHA_ROOT = 'Siddur Edot HaMizrach, Weekday Mincha';
export const WEEKDAY_MINCHA_PACK = PACK;
export const isWeekdayMinchaReference = reference => String(reference || '').startsWith(`${WEEKDAY_MINCHA_ROOT}, `);

const TYPE_BY_ROLE = { heading: 'heading', recited: 'recitedText', instruction: 'instruction', source: 'source', label: 'instruction' };

// Verifies once that every pack slice still matches the canonical bundled text.
let integrity = null;
export function verifyPackIntegrity() {
  if (integrity) return integrity;
  const problems = [];
  PACK.sections.forEach(section => {
    const he = siddurOffline.texts[section.ref]?.he;
    if (!he) { problems.push(`${section.ref}: missing`); return; }
    section.blocks.forEach(block => {
      const markup = he[block.segment];
      if (typeof markup !== 'string' || checksum(markup.slice(block.start, block.end)) !== block.checksum) problems.push(block.id);
    });
  });
  integrity = { ok: problems.length === 0, problems };
  return integrity;
}

export function buildPracticeProfile({ settings = {}, preferences = {} } = {}) {
  return {
    nusach: settings.nusach || 'edot-hamizrach',
    setting: preferences.setting === 'individual' ? 'individual' : 'minyan',
  };
}

function decide(block, rules, adapted) {
  if (!block.when) return { include: true, status: 'fixed', rules: [] };
  const condition = CONDITIONS[block.when];
  if (!condition) throw new Error(`Unknown condition "${block.when}" on ${block.id}`);
  if (!adapted) return { include: true, status: STATUS.UNSUPPORTED, rules: ['scope.weekday-mincha'] };
  const { include, rules: used } = condition(rules);
  if (include === null) {
    const status = used.map(id => rules[id]?.status).find(value => value === STATUS.NEEDS_INPUT) || STATUS.UNRESOLVED;
    return { include: true, status, rules: used };
  }
  return { include, status: include ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE, rules: used };
}

// Deterministic: the same request, context and pack/rule versions always yield the same document.
export function composeWeekdayMincha({ now, settings = {}, times = null, preferences = {}, answers = {} } = {}) {
  const time = buildTimeContext({ now, settings, times, answers });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings });
  const profile = buildPracticeProfile({ settings, preferences });
  const rules = resolveWeekdayMinchaRules({ time, calendar, profile, location: settings.location });
  const pack = verifyPackIntegrity();
  const adapted = pack.ok && rules['scope.weekday-mincha'].status === STATUS.APPLICABLE;
  const plan = [];
  const sections = PACK.sections.map(section => {
    const he = siddurOffline.texts[section.ref].he;
    const blocks = [];
    section.blocks.forEach(block => {
      const decision = decide(block, rules, adapted);
      // Selection captions ("בקיץ:") only make sense where both options are shown.
      const hideCaption = adapted && block.role === 'label' && decision.status !== STATUS.UNRESOLVED && decision.status !== STATUS.NEEDS_INPUT;
      const include = decision.include && !hideCaption;
      plan.push({ op: include ? 'include' : 'omit', blockId: block.id, status: decision.status, rules: decision.rules, reason: hideCaption ? 'selection-made' : null });
      if (!include) return;
      const text = normalizeHebrewText(he[block.segment].slice(block.start, block.end), 'siddur');
      blocks.push({ id: `${PACK.id}.${block.id}`, sourceId: block.id, sectionId: section.id, type: TYPE_BY_ROLE[block.role], text, undecided: decision.status === STATUS.UNRESOLVED || decision.status === STATUS.NEEDS_INPUT, rules: decision.rules });
    });
    // Personal verses (user's choice) after אלהי נצור, before the closing יהיו לרצון — separate blocks, prayer text untouched.
    const withVerses = insertPersonalVerses(blocks, preferences.personalVerses, {
      textOf: block => block.text,
      makeBlock: (verse, index) => ({ id: `${PACK.id}.${PERSONAL_VERSE_BLOCK_PREFIX}${index}`, sourceId: `${PERSONAL_VERSE_BLOCK_PREFIX}${index}`, sectionId: section.id, type: 'personalVerse', text: verse.text, caption: verse.reference, undecided: false, rules: [], personal: true }),
    });
    if (withVerses.inserted) withVerses.blocks.filter(block => block.personal).forEach(block => plan.push({ op: 'insert', blockId: block.sourceId, status: 'fixed', rules: [], reason: 'personal-verse' }));
    return { id: section.id, ref: section.ref, title: section.title, blocks: withVerses.blocks };
  });
  const open = Object.values(rules).filter(rule => rule.status === STATUS.NEEDS_INPUT || rule.status === STATUS.UNRESOLVED);
  const status = !adapted ? 'unsupported' : open.some(rule => rule.status === STATUS.NEEDS_INPUT) ? 'needs-input' : open.length ? 'partial' : 'adapted';
  const document = {
    id: PACK.id,
    title: 'מנחה לימי החול',
    status,
    packVersion: PACK.version,
    rulesVersion: RULES_VERSION,
    source: PACK.source,
    unsupportedReasons: pack.ok ? rules['scope.weekday-mincha'].value || [] : ['שלמות תוכן הסידור'],
    openRules: adapted ? open.map(rule => ({ id: rule.id, status: rule.status, reason: rule.reason })) : [],
    sections,
  };
  return { request: { prayer: 'mincha', dayType: 'weekday', nusach: profile.nusach }, time, calendar, profile, rules, plan, document, integrity: pack };
}

// Structural invariants that must hold for every composed document.
export function validatePrayerDocument(document) {
  const errors = [];
  const all = document.sections.flatMap(section => section.blocks);
  if (new Set(all.map(block => block.id)).size !== all.length) errors.push('duplicate-block');
  // Personal verses are the only blocks allowed from outside the pack: at most three, contiguous,
  // after אלהי נצור and immediately before the closing יהיו לרצון.
  const personal = all.filter(block => block.personal);
  if (personal.length > MAX_PERSONAL_VERSES) errors.push('personal-verses-too-many');
  if (personal.length) {
    const first = all.indexOf(personal[0]);
    const last = all.indexOf(personal[personal.length - 1]);
    if (last - first + 1 !== personal.length) errors.push('personal-verses-not-contiguous');
    const next = all[last + 1];
    if (!next || next.personal || !isYihyuLeratzon(next.text)) errors.push('personal-verses-not-before-yihyu-leratzon');
    if (!all.slice(0, first).some(block => isElohaiNetzor(block.text))) errors.push('personal-verses-not-after-elohai-netzor');
  }
  const packBlocks = all.filter(block => !block.personal);
  const ids = packBlocks.map(block => block.id);
  const order = new Map(PACK.sections.flatMap(section => section.blocks.map(block => `${PACK.id}.${block.id}`)).map((id, index) => [id, index]));
  ids.forEach((id, index) => {
    if (!order.has(id)) errors.push(`unknown-block:${id}`);
    else if (index > 0 && order.get(id) <= order.get(ids[index - 1])) errors.push(`order:${id}`);
  });
  if (document.status !== 'unsupported') {
    const has = id => ids.includes(`${PACK.id}.${id}`);
    if (has('amida.4.1') && has('amida.4.3')) errors.push('gevurot-summer-and-winter');
    if (!has('amida.4.1') && !has('amida.4.3')) errors.push('gevurot-missing');
    if (has('amida.18') && has('amida.20')) errors.push('hashanim-summer-and-winter');
    if (!has('amida.18') && !has('amida.20')) errors.push('hashanim-missing');
  }
  return errors;
}
