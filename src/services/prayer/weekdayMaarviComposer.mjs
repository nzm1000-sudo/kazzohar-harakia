import siddurOffline from '../../data/siddurOffline.mjs';
import PACK from '../../data/prayerPacks/edotHaMizrachWeekdayMaariv.mjs';
import { normalizeHebrewText } from '../../hebrewText.mjs';
import { checksum } from './checksum.mjs';
import { buildTimeContext } from './timeContext.mjs';
import { buildCalendarContext } from './calendarContext.mjs';
import { CONDITIONS, RULES_VERSION, STATUS, resolveWeekdayMaarivRules } from './weekdayMaarviRules.mjs';

export const WEEKDAY_MAARIV_ROOT = 'Siddur Edot HaMizrach, Weekday Maariv';
export const WEEKDAY_MAARIV_PACK = PACK;
export const isWeekdayMaarivReference = reference => String(reference || '').startsWith(`${WEEKDAY_MAARIV_ROOT}, `);

const TYPE_BY_ROLE = { heading: 'heading', recited: 'recitedText', instruction: 'instruction', source: 'source', label: 'instruction' };

// Verifies that every pack slice still matches the canonical bundled text.
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
    havdalahMode: preferences.havdalahMode || 'full',
  };
}

function decide(block, rules, adapted) {
  if (!block.when) return { include: true, status: 'fixed', rules: [] };
  const condition = CONDITIONS[block.when];
  if (!condition) throw new Error(`Unknown condition "${block.when}" on ${block.id}`);
  if (!adapted) return { include: true, status: STATUS.UNSUPPORTED, rules: ['scope.weekday-maariv'] };
  const { include, rules: used } = condition(rules);
  if (include === null) {
    const status = used.map(id => rules[id]?.status).find(value => value === STATUS.NEEDS_INPUT) || STATUS.UNRESOLVED;
    return { include: true, status, rules: used };
  }
  return { include, status: include ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE, rules: used };
}

// Deterministic: the same request and context always yield the same document.
export function composeWeekdayMaariv({ now, settings = {}, times = null, preferences = {}, answers = {} } = {}) {
  const time = buildTimeContext({ now, settings, times, answers });
  const calendar = buildCalendarContext({ prayerDate: time.prayerDate, tzid: time.tzid, settings });
  const profile = buildPracticeProfile({ settings, preferences });
  const rules = resolveWeekdayMaarivRules({ time, calendar, profile, location: settings.location });
  const pack = verifyPackIntegrity();
  const adapted = pack.ok && rules['scope.weekday-maariv'].status === STATUS.APPLICABLE;
  const plan = [];
  const sections = PACK.sections.map(section => {
    const he = siddurOffline.texts[section.ref].he;
    const blocks = [];
    section.blocks.forEach(block => {
      const decision = decide(block, rules, adapted);
      const hideCaption = adapted && block.role === 'label' && decision.status !== STATUS.UNRESOLVED && decision.status !== STATUS.NEEDS_INPUT;
      const include = decision.include && !hideCaption;
      plan.push({ op: include ? 'include' : 'omit', blockId: block.id, status: decision.status, rules: decision.rules, reason: hideCaption ? 'selection-made' : null });
      if (!include) return;
      const text = normalizeHebrewText(he[block.segment].slice(block.start, block.end), 'siddur');
      blocks.push({ id: `${PACK.id}.${block.id}`, sourceId: block.id, sectionId: section.id, type: TYPE_BY_ROLE[block.role], text, undecided: decision.status === STATUS.UNRESOLVED || decision.status === STATUS.NEEDS_INPUT, rules: decision.rules });
    });
    return { id: section.id, ref: section.ref, title: section.title, blocks };
  });
  const open = Object.values(rules).filter(rule => rule.status === STATUS.NEEDS_INPUT || rule.status === STATUS.UNRESOLVED);
  const status = !adapted ? 'unsupported' : open.some(rule => rule.status === STATUS.NEEDS_INPUT) ? 'needs-input' : open.length ? 'partial' : 'adapted';
  const document = {
    id: PACK.id,
    title: 'ערבית לימי החול',
    status,
    packVersion: PACK.version,
    rulesVersion: RULES_VERSION,
    source: PACK.source,
    unsupportedReasons: pack.ok ? rules['scope.weekday-maariv'].value || [] : ['שלמות תוכן הסידור'],
    openRules: adapted ? open.map(rule => ({ id: rule.id, status: rule.status, reason: rule.reason })) : [],
    sections,
  };
  return { request: { prayer: 'maariv', dayType: 'weekday', nusach: profile.nusach }, time, calendar, profile, rules, plan, document, integrity: pack };
}

// Structural invariants that must hold for every composed Maarvi document.
export function validatePrayerDocument(document) {
  const errors = [];
  const ids = document.sections.flatMap(section => section.blocks.map(block => block.id));
  if (new Set(ids).size !== ids.length) errors.push('duplicate-block');
  const order = new Map(PACK.sections.flatMap(section => section.blocks.map(block => `${PACK.id}.${block.id}`)).map((id, index) => [id, index]));
  ids.forEach((id, index) => {
    if (!order.has(id)) errors.push(`unknown-block:${id}`);
    else if (index > 0 && order.get(id) <= order.get(ids[index - 1])) errors.push(`order:${id}`);
  });
  if (document.status !== 'unsupported') {
    const has = id => ids.includes(`${PACK.id}.${id}`);
    // Verify essential Maarvi structure
    if (!has('barechu.half-kaddish-before')) errors.push('barechu-missing');
    if (!has('shema.shema-full')) errors.push('shema-missing');
    if (!has('amida.1-avot')) errors.push('amida-missing');
  }
  return errors;
}
