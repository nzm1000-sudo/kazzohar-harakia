// Decision engine for the guided flows in data/halachaFlows.mjs. Deterministic and offline: a path of answers
// resolves to a step, an outcome, or a hand-off to another flow. Outcomes resolve to verified entries only.
import { HALACHA_FLOWS, HALACHA_FLOW_INDEX } from '../data/halachaFlows.mjs';
import { FLOW_HINTS } from '../data/halachaFlowHints.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../data/practicalHalachaQa.mjs';
import { YALKUT_YOSEF } from '../data/yalkutYosef.mjs';
import { normalizeQuery } from './halachaSearch.mjs';
import { hebrewNumeral } from './hebrewNumerals.mjs';

let sectionIndex = null;
const sectionById = id => (sectionIndex ||= new Map(YALKUT_YOSEF.sections.map(section => [section.id, section]))).get(id);

// Walks a flow along the chosen option indexes. Returns { flow, step, stepId, trail, outcome?, handoff? }.
export function walkFlow(flowId, path = []) {
  const flow = HALACHA_FLOW_INDEX[flowId];
  if (!flow) return null;
  let stepId = flow.start;
  const trail = [];
  for (const choice of path) {
    const step = flow.steps[stepId];
    const option = step?.options[choice];
    if (!option) break;
    trail.push({ question: step.question, answer: option.label });
    if (option.flow) return { flow, trail, handoff: option.flow };
    if (option.outcome) return { flow, trail, outcome: resolveOutcome(flow, option.outcome) };
    stepId = option.next;
  }
  return { flow, trail, stepId, step: flow.steps[stepId] };
}

export function resolveOutcome(flow, key) {
  const outcome = flow.outcomes[key];
  if (!outcome) return null;
  const entries = (outcome.entryIds || []).map(id => PRACTICAL_HALACHA_QA_INDEX[id]).filter(Boolean);
  const sources = (outcome.sourceIds || []).map(sectionById).filter(Boolean)
    .map(section => ({ id: section.id, ref: `Yalkut Yosef ${section.id}`, title: `${section.section.split(/\s*-\s*/)[0].trim()}, סעיף ${hebrewNumeral(section.halachaIndex)}`, section: section.section }));
  return { key, entries, sources, rabbi: Boolean(outcome.rabbi) || !entries.length, disagreement: Boolean(outcome.disagreement), note: outcome.note || null };
}

// Integrity check used by the tests: every option leads somewhere real, every step is reachable, every outcome
// points to published entries or to an explicit rabbi route, and every flow hand-off exists.
export function validateFlows(flows = HALACHA_FLOWS) {
  const errors = [];
  for (const flow of flows) {
    if (!flow.steps[flow.start]) errors.push(`${flow.id}: missing start step`);
    const reached = new Set([flow.start]);
    const usedOutcomes = new Set();
    for (const [stepId, step] of Object.entries(flow.steps)) {
      if (!step.options?.length) errors.push(`${flow.id}/${stepId}: no options`);
      for (const option of step.options || []) {
        const targets = [option.next, option.outcome, option.flow].filter(Boolean);
        if (targets.length !== 1) errors.push(`${flow.id}/${stepId}: option "${option.label}" must have exactly one target`);
        if (option.next) { if (!flow.steps[option.next]) errors.push(`${flow.id}/${stepId}: dead end → ${option.next}`); reached.add(option.next); }
        if (option.flow && !HALACHA_FLOW_INDEX[option.flow]) errors.push(`${flow.id}/${stepId}: unknown flow ${option.flow}`);
        if (option.outcome) {
          usedOutcomes.add(option.outcome);
          const outcome = flow.outcomes[option.outcome];
          if (!outcome) { errors.push(`${flow.id}/${stepId}: unknown outcome ${option.outcome}`); continue; }
          for (const id of outcome.entryIds || []) {
            const entry = PRACTICAL_HALACHA_QA_INDEX[id];
            if (!entry || entry.answerStatus !== 'published') errors.push(`${flow.id}/${option.outcome}: entry ${id} is not published`);
          }
          for (const id of outcome.sourceIds || []) if (!sectionById(id)) errors.push(`${flow.id}/${option.outcome}: source ${id} missing`);
          if (!(outcome.entryIds || []).length && !outcome.rabbi) errors.push(`${flow.id}/${option.outcome}: no verified entry and no rabbi route`);
        }
      }
    }
    for (const stepId of Object.keys(flow.steps)) if (!reached.has(stepId)) errors.push(`${flow.id}/${stepId}: unreachable step`);
    for (const key of Object.keys(flow.outcomes)) if (!usedOutcomes.has(key)) errors.push(`${flow.id}: unused outcome ${key}`);
  }
  return errors;
}

// Every verified entry a flow can end on, including flows it hands off to.
export function flowEntryIds(flow, seen = new Set()) {
  const ids = new Set();
  if (!flow || seen.has(flow.id)) return ids;
  seen.add(flow.id);
  for (const outcome of Object.values(flow.outcomes)) for (const id of outcome.entryIds || []) ids.add(id);
  for (const step of Object.values(flow.steps)) for (const option of step.options) if (option.flow) for (const id of flowEntryIds(HALACHA_FLOW_INDEX[option.flow], seen)) ids.add(id);
  return ids;
}

// Which flow, if any, a free-text situation belongs to: the longest matching trigger wins.
export function matchFlow(query) {
  const text = normalizeQuery(query);
  if (!text) return null;
  let best = null;
  for (const flow of HALACHA_FLOWS) {
    if ((flow.excludeTerms || []).some(term => text.includes(normalizeQuery(term)))) continue;
    for (const term of flow.triggerTerms) {
      const normalized = normalizeQuery(term);
      if (normalized && text.includes(normalized) && (!best || normalized.length > best.length)) best = { flow, length: normalized.length, term };
    }
  }
  return best ? best.flow : null;
}

// A plain-text question for a human rabbi, assembled from what the user chose and what the app found.
// Nothing is sent anywhere; the user copies or shares it.
export function rabbiQuestionDraft({ topic, trail = [], details = '', sources = [], entries = [] }) {
  const lines = [`הנושא: ${topic}`, ''];
  if (trail.length) { lines.push('מה קרה:'); for (const step of trail) lines.push(`• ${step.question} ${step.answer}`); lines.push(''); }
  if (details.trim()) lines.push('פרטים נוספים:', details.trim(), '');
  const found = [...entries.map(entry => `${entry.question} — ${entry.sources?.[0]?.work || ''}, ${entry.sources?.[0]?.citation || ''}`), ...sources.map(source => `ילקוט יוסף, ${source.title}`)];
  if (found.length) { lines.push('מקורות שמצאתי:'); for (const item of found) lines.push(`• ${item}`); lines.push(''); }
  lines.push('השאלה לרב:', `מה הדין במקרה שלי בנושא "${topic}"?`);
  return lines.join('\n');
}

// ---- Conversation helpers: understanding a free-text reply against the open step ----

export const stepHints = (flowId, stepId) => FLOW_HINTS[flowId]?.[stepId] || null;

// Option matching compares plain words: niqqud and punctuation removed, but none of the search synonyms (which turn
// "חול" into חו"ל and would break "חול המועד").
const plain = value => String(value || '').normalize('NFKD').replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '').replace(/[״"׳']+/g, '"').replace(/[?!.,;:()\[\]\-–—]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// Whole-word/phrase match that tolerates one Hebrew proclitic (ב, ו, ה, ש, ל, כ, מ) on the first word.
function containsPhrase(text, phrase) {
  const p = plain(phrase);
  if (!p) return false;
  const H = '[\\u0590-\\u05FF"]';
  return new RegExp(`(?<!${H})[בוהשלכמ]?${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!${H})`).test(text);
}

// Which option of this step the user's words choose. The option with the most alias hits wins; a tie is no answer.
// Falls back to the calendar when exactly one option is what today is (e.g. "ראש חודש" on Rosh Chodesh).
export function matchOption(flowId, stepId, userText, { active = null } = {}) {
  const flow = HALACHA_FLOW_INDEX[flowId];
  const step = flow?.steps[stepId];
  if (!step) return null;
  const text = plain(userText);
  const hints = stepHints(flowId, stepId)?.options || {};
  const scores = step.options.map(option => {
    const words = [option.label, ...(hints[option.label]?.aliases || [])];
    // Tapping or typing the start of an option ("מקרה אחר") chooses it outright.
    const head = plain(option.label.split(/\s[–-]\s|[,;]/)[0]);
    const prefix = text.length >= 3 && (plain(option.label) === text || head === text || plain(option.label).startsWith(text)) ? 3 : 0;
    return prefix + words.filter(word => containsPhrase(text, word)).length;
  });
  const best = Math.max(...scores);
  if (best > 0 && scores.filter(score => score === best).length === 1) return { index: scores.indexOf(best), how: 'words' };
  if (active) {
    const today = step.options.map((option, index) => ({ index, keys: [].concat(hints[option.label]?.contextKey || []) })).filter(item => item.keys.some(key => active.has(key)));
    if (today.length === 1) return { index: today[0].index, how: 'calendar' };
  }
  return null;
}

// Answer as many steps as the words already given (and the calendar) settle; stop at the first open question.
export function autoAdvance(flowId, path, userText, { active = null } = {}) {
  let current = [...path];
  const inferred = [];
  for (let guard = 0; guard < 8; guard++) {
    const state = walkFlow(flowId, current);
    if (!state?.step) return { path: current, state, inferred };
    const match = matchOption(flowId, state.stepId, userText, { active });
    if (!match) return { path: current, state, inferred };
    if (match.how === 'calendar') inferred.push(state.step.options[match.index].label);
    current = [...current, match.index];
  }
  return { path: current, state: walkFlow(flowId, current), inferred };
}

// The guided flows in which a verified entry is one of the answers ("שאלות המשך" on its page).
export function flowsForEntry(entryId) {
  return HALACHA_FLOWS.filter(flow => Object.values(flow.outcomes).some(outcome => (outcome.entryIds || []).includes(entryId)));
}
