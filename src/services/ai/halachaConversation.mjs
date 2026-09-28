// The conversational Halacha assistant. Deterministic first: the verified answer, the guided flow (with replies
// understood from the user's own words and the calendar), the prayer-time windows, then sources. A language model,
// when one is available for free, is asked only to (1) map an unclear reply onto the open question's options, or
// (2) interpret a question nothing else recognized — and whatever it returns passes the gate or is ignored.
//
// Response contract (internal; the UI renders it, never shows JSON):
// { type: 'answer'|'clarification'|'multiple_cases'|'sources_only'|'disagreement'|'insufficient'|'refer_to_rabbi',
//   text, clarification: { question, options: [label], whyAsked: [entryId] } | null,
//   entryIds, sourceIds, relatedEntryIds, claims: [{ text, sourceIds, support }], confidence, sensitive,
//   notes: [string], flow: { id, title } | null, time: prayerTimeStatus | null, via: 'deterministic' | providerId }
import { HALACHA_FLOW_INDEX } from '../../data/halachaFlows.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../../data/practicalHalachaQa.mjs';
import { YALKUT_YOSEF } from '../../data/yalkutYosef.mjs';
import { walkFlow, autoAdvance, matchOption, stepHints } from '../halachaDecision.mjs';
import { routeHalachaQuery, INTENTS } from '../halachaIntent.mjs';
import { activeContexts, relatedHalachot } from '../halachaEngine.mjs';
import { detectPrayerTimeQuestion, prayerNamed, prayerTimeStatus, timesFromContext, PRAYERS } from '../halachaTime.mjs';
import { normalizeQuery } from '../halachaSearch.mjs';
import { validateAssistantResponse } from './halachaGate.mjs';

const MAX_TURNS = 6;
const MAX_ENTRIES = 4;
const FORGOT_ONLY = /^(שכחתי|שכחתי משהו|טעיתי|שכחתי מה עושים|מה עושים)$/;
const SOURCE_REQUEST = /(?:^|\s)(מקור|המקור|מאיפה|איפה כתוב|מה המקור|למה|מדוע)(?:\s|$|\?)/;
const FORGOT_MENU = [
  { label: 'משהו בתפילה', flow: 'prayer-forgot' },
  { label: 'ברכה – לברך, או ברכה לא נכונה', flow: 'bracha-mistake' },
  { label: 'לספור ספירת העומר', flow: 'omer' },
  { label: 'קידוש או הבדלה', flow: 'kiddush-havdala' },
];
const PRAYER_MENU = ['shacharit', 'mincha', 'arvit', 'shema', 'tefillin'];
// Nearest verified answers are offered as a list only above this search score (measured: real questions ~170–200,
// unrelated overlaps and junk ~120–150).
const MIN_LIST_SCORE = 160;
// Requests to drop the sources or invent: answered with the rule, never followed.
const OVERRIDE_REQUEST = /(?:^|\s)(תתעלם|התעלם|תשכח מה|בלי מקורות|בלי המקורות|רק תגיד|תמציא|תעשה את עצמך|אתה הרב|תפסוק לי|ignore)(?:\s|$)/i;

export const newConversation = () => ({ turns: [], topic: '', active: null, last: null });

let sectionIndex = null;
const sectionById = id => (sectionIndex ||= new Map(YALKUT_YOSEF.sections.map(section => [section.id, section]))).get(id);
const entryById = id => PRACTICAL_HALACHA_QA_INDEX[id];
const sourceIdsOf = entry => (entry.sources || []).map(source => source.localSourceId).filter(Boolean);

function base(overrides) {
  return { type: 'insufficient', text: '', clarification: null, entryIds: [], sourceIds: [], relatedEntryIds: [], claims: [], confidence: 'incomplete', sensitive: false, notes: [], flow: null, time: null, via: 'deterministic', ...overrides };
}

function answerFromEntries(entries, extra = {}) {
  const disputed = extra.disagreement || entries.some(entry => entry.ruleType === 'machloket');
  const related = entries.length ? relatedHalachot(entries[0], { limit: 3 }).map(entry => entry.id).filter(id => !entries.some(entry => entry.id === id)) : [];
  return base({
    type: disputed ? 'disagreement' : 'answer',
    text: disputed ? 'יש בזה מחלוקת פוסקים. כך כתוב במקור:' : entries.length > 1 ? 'אלה התשובות המאומתות למקרה שתיארת:' : 'זו התשובה המאומתת למקרה שתיארת:',
    entryIds: entries.map(entry => entry.id),
    sourceIds: [...new Set(entries.flatMap(sourceIdsOf))],
    relatedEntryIds: related,
    claims: entries.map(entry => ({ text: entry.shortAnswer, sourceIds: [entry.id], support: 'direct' })),
    confidence: disputed ? 'grounded_synthesis' : 'direct',
    ...extra,
  });
}

function clarificationFor(flow, state, notes = []) {
  return base({
    type: 'clarification',
    text: 'כדי לענות נכון צריך לדעת עוד פרט אחד:',
    clarification: { question: state.step.question, options: state.step.options.map(option => option.label), whyAsked: stepHints(flow.id, state.stepId)?.whyAsked || [] },
    flow: { id: flow.id, title: flow.title },
    confidence: 'incomplete',
    notes,
  });
}

function outcomeResponse(flow, outcome, notes) {
  if (outcome.entries.length) return answerFromEntries(outcome.entries, { flow: { id: flow.id, title: flow.title }, notes, disagreement: outcome.disagreement });
  return base({
    type: 'refer_to_rabbi',
    text: outcome.note || 'למקרה הזה אין עדיין תשובה מקוצרת מאומתת במאגר.',
    sourceIds: outcome.sources.map(source => source.id),
    flow: { id: flow.id, title: flow.title },
    notes,
  });
}

// Continue a flow from `path` using everything the user has said on this topic, plus today's calendar.
function runFlow(flowId, path, topicText, env) {
  const flow = HALACHA_FLOW_INDEX[flowId];
  const { path: next, state, inferred } = autoAdvance(flowId, path, topicText, { active: env.active });
  const notes = inferred.map(label => `לפי הלוח, היום: ${label}.`);
  if (state?.handoff) return runFlow(state.handoff, [], topicText, env);
  if (state?.outcome) return { response: outcomeResponse(flow, state.outcome, notes), active: null };
  return { response: clarificationFor(flow, state, notes), active: { kind: 'flow', flowId, path: next } };
}

function timeResponse(prayer, env) {
  const status = prayerTimeStatus(prayer, env.now, env.times);
  if (!status || status.status === 'unknown') return base({ type: 'insufficient', text: 'אין כרגע זמני היום (מיקום או חיבור), ולכן אי אפשר לחשב. אפשר לעיין בזמני התפילה במסך זמני היום.', time: status });
  const response = status.entries.length ? answerFromEntries(status.entries) : base({ type: 'sources_only' });
  return { ...response, text: `השעה ${status.now}. ${status.summary}`, time: status, notes: [] };
}

function sourcesResponse(entryIds) {
  const entries = entryIds.map(entryById).filter(Boolean);
  return base({
    type: 'sources_only',
    text: 'המקורות של התשובה:',
    entryIds: entries.map(entry => entry.id),
    sourceIds: [...new Set(entries.flatMap(sourceIdsOf))],
    confidence: 'direct',
  });
}

// A compact, local-first packet: only what retrieval found, for a model that may help — never the corpus.
export function buildPacket({ question, conversation, entries = [], sources = [], openStep = null, env = {} }) {
  return {
    question: String(question).slice(0, 400),
    turns: conversation.turns.slice(-4).map(turn => ({ role: turn.role, text: String(turn.text).slice(0, 200) })),
    openQuestion: openStep ? { question: openStep.question, options: openStep.options.map(option => option.label) } : null,
    context: { date: env.context?.hebrewDate?.label || null, active: env.active ? [...env.active].filter(key => !['daily', 'meal', 'home'].includes(key)) : [], activity: env.activity || null },
    entries: entries.slice(0, MAX_ENTRIES).map(entry => ({ id: entry.id, question: entry.question, shortAnswer: entry.shortAnswer, excerpt: entry.sources?.[0]?.excerpt || null, citation: entry.sources?.[0]?.citation || null, work: entry.sources?.[0]?.work || null, ruleType: entry.ruleType || null, sourceIds: sourceIdsOf(entry) })),
    sources: sources.slice(0, 2).map(source => ({ id: source.id, citation: source.citation || source.title, work: 'קיצור שולחן ערוך ילקוט יוסף', text: (sectionById(source.id)?.text || source.snippet || '').slice(0, 500) })),
  };
}

// One turn. Returns { conversation, response }. `env`: { context, now, activity, model (a model chain or null) }.
export async function respond(conversation, userText, envIn = {}) {
  const text = String(userText || '').trim();
  const env = { now: new Date(), ...envIn };
  env.active = activeContexts(env.context || {}, env.now);
  env.times = env.times || timesFromContext(env.context || {});
  const turns = [...conversation.turns, { role: 'user', text }].slice(-MAX_TURNS);
  const done = (response, active, topic) => ({ conversation: { turns: [...turns, { role: 'assistant', text: response.text }].slice(-MAX_TURNS), topic: topic ?? conversation.topic, active, last: response }, response });
  if (!text) return { conversation, response: null };

  // 1. An open question from the previous turn: understand the reply against its options.
  const active = conversation.active;
  if (active?.kind === 'flow') {
    const state = walkFlow(active.flowId, active.path);
    const match = state?.step && matchOption(active.flowId, state.stepId, text);
    if (match) { const topic = `${conversation.topic} ${text}`; const run = runFlow(active.flowId, [...active.path, match.index], topic, env); return done(run.response, run.active, topic); }
    if (!looksLikeNewQuestion(text) && state?.step) {
      const mapped = await modelMapOption(env.model, text, state, conversation);
      if (mapped) { const topic = `${conversation.topic} ${text}`; const run = runFlow(active.flowId, [...active.path, mapped.index], topic, env); return done({ ...run.response, via: mapped.providerId, notes: [...run.response.notes, `הבנתי: "${state.step.options[mapped.index].label}".`] }, run.active, topic); }
      // A reply that only restates the topic ("בשבת" inside "חימום אוכל בשבת") is agreement, not confusion.
      const flow = HALACHA_FLOW_INDEX[active.flowId];
      const words = normalizeQuery(text).split(' ').filter(word => word.length > 1);
      const restates = words.length && words.every(word => normalizeQuery(flow.title).split(' ').some(titleWord => titleWord === word || titleWord === word.replace(/^[בוהלמ]/, '')));
      const again = clarificationFor(flow, state, [restates ? `כן – ${flow.title}.` : 'לא הצלחתי להבין את התשובה – אפשר לבחור אחת מהאפשרויות.']);
      return done(again, active);
    }
  }
  if (active?.kind === 'menu') {
    const choice = matchMenu(active.menu, text);
    if (choice) { const run = runFlow(choice.flow, [], `${conversation.topic} ${text}`, env); return done(run.response, run.active, `${conversation.topic} ${text}`); }
  }
  if (active?.kind === 'time') {
    const prayer = prayerNamed(text) || PRAYER_MENU.find(key => normalizeQuery(text) === normalizeQuery(PRAYERS[key].label));
    if (prayer) return done(timeResponse(prayer, env), null);
  }

  // 2. A follow-up about the last answer: "מה המקור?", "למה?"
  if (SOURCE_REQUEST.test(normalizeQuery(text)) && conversation.last?.entryIds?.length && normalizeQuery(text).split(' ').length <= 4) return done(sourcesResponse(conversation.last.entryIds), null);

  // 3. A new question.
  const topic = text;
  const normalized = normalizeQuery(text);
  if (FORGOT_ONLY.test(normalized)) {
    const activity = env.activity;
    if (activity?.section === 'omer') { const run = runFlow('omer', [], topic, env); return done(run.response, run.active, topic); }
    if (activity?.section === 'birkat-hamazon' || activity?.prayer) {
      const hint = activity.section === 'birkat-hamazon' ? 'ברכת המזון' : PRAYERS[activity.prayer]?.label || '';
      const run = runFlow('prayer-forgot', [], `${topic} ${hint}`, env);
      return done({ ...run.response, notes: [...run.response.notes, `לפי מה שפתוח עכשיו בסידור: ${activity.title || hint}.`] }, run.active, `${topic} ${hint}`);
    }
    return done(base({ type: 'clarification', text: 'מה שכחת?', clarification: { question: 'מה שכחת?', options: FORGOT_MENU.map(item => item.label), whyAsked: [] } }), { kind: 'menu', menu: FORGOT_MENU }, topic);
  }

  const time = detectPrayerTimeQuestion(text);
  if (time) {
    const prayer = time.prayer || (env.activity?.prayer && PRAYERS[env.activity.prayer] ? env.activity.prayer : null);
    if (prayer) return done(timeResponse(prayer, env), null, topic);
    return done(base({ type: 'clarification', text: 'על איזו תפילה מדובר?', clarification: { question: 'על איזו תפילה?', options: PRAYER_MENU.map(key => PRAYERS[key].label), whyAsked: [] } }), { kind: 'time' }, topic);
  }

  if (OVERRIDE_REQUEST.test(normalized)) return done(base({ type: 'insufficient', text: 'אני עונה רק מתוך המקורות המאומתים שבספרייה, ולא אתן תשובה שאין לה מקור. אפשר לשאול את השאלה עצמה, ואחפש לה מקור.' }), null, topic);
  if (normalized.split(' ').length < 2) return done(base({ type: 'insufficient', text: 'אפשר לפרט קצת יותר? למשל: "שכחתי יעלה ויבוא במנחה" או "אפשר לחמם מרק בשבת?"' }), null, topic);

  const route = routeHalachaQuery(text);
  if (route.intent === INTENTS.SENSITIVE) {
    return done(base({ type: 'refer_to_rabbi', sensitive: true, text: 'זה נושא אישי ורגיש. כאן אפשר ללמוד מהמקורות; להכרעה במקרה אישי פונים למורה הוראה או ליועצת הלכה.', sourceIds: (route.results.yalkut || []).slice(0, 2).map(item => item.id) }), null, topic);
  }
  if (route.intent === INTENTS.SITUATION && route.flow) { const run = runFlow(route.flow.id, [], topic, env); return done(run.response, run.active, topic); }
  if (route.answer) return done(answerFromEntries([route.answer]), null, topic);
  const verified = (route.results.unified || []).filter(item => item.kind === 'question' && item.score >= MIN_LIST_SCORE).slice(0, 3).map(item => item.item);
  if (verified.length) return done({ ...answerFromEntries(verified), type: 'multiple_cases', text: 'לא מצאתי התאמה מדויקת. אלה התשובות הקרובות ביותר:', confidence: 'grounded_synthesis' }, null, topic);

  // 4. Nothing deterministic: a model may interpret the question (never answer it from its own knowledge).
  const interpreted = await modelInterpret(env.model, text, conversation, env);
  if (interpreted) return done(interpreted.response, interpreted.active, topic);
  const sources = (route.results.yalkut || []).slice(0, 3);
  if (sources.length) return done(base({ type: 'sources_only', text: 'אין לי תשובה מאומתת לשאלה הזו. אלה המקורות הקרובים לעיון:', sourceIds: sources.map(item => item.id) }), null, topic);
  return done(base({ type: 'insufficient', text: 'אין במאגר המאומת מספיק מידע כדי לענות על זה. לא ננחש – כדאי לשאול רב.' }), null, topic);
}

function looksLikeNewQuestion(text) {
  if (normalizeQuery(text).split(' ').length <= 2) return Boolean(detectPrayerTimeQuestion(text));
  const route = routeHalachaQuery(text);
  return Boolean(detectPrayerTimeQuestion(text)) || route.intent === INTENTS.SENSITIVE || (route.flow && route.intent === INTENTS.SITUATION) || Boolean(route.answer);
}

function matchMenu(menu, text) {
  const normalized = normalizeQuery(text);
  return menu.find(item => normalized === normalizeQuery(item.label)) || menu.find(item => normalizeQuery(item.label).split(' ').some(word => word.length > 2 && normalized.includes(word))) || null;
}

// Model task 1: which option did the user mean? The model returns { index }; anything else is ignored.
async function modelMapOption(model, text, state, conversation) {
  if (!model) return null;
  const packet = buildPacket({ question: text, conversation, openStep: state.step });
  const result = await model.complete({ task: 'map-option', packet, maxOutputTokens: 40 });
  const index = result?.json?.index;
  return Number.isInteger(index) && index >= 0 && index < state.step.options.length ? { index, providerId: result.providerId } : null;
}

// Model task 2: an unrecognized question → { flowId } or { query } (a clearer rewording), re-run deterministically.
// The model is never asked for the halacha itself; any answer text it sends is ignored.
async function modelInterpret(model, text, conversation, env) {
  if (!model) return null;
  const packet = buildPacket({ question: text, conversation, env });
  const result = await model.complete({ task: 'interpret', packet: { ...packet, flows: Object.values(HALACHA_FLOW_INDEX).map(flow => ({ id: flow.id, title: flow.title })) }, maxOutputTokens: 80 });
  const json = result?.json;
  if (json?.flowId && HALACHA_FLOW_INDEX[json.flowId]) { const run = runFlow(json.flowId, [], text, env); return { response: { ...run.response, via: result.providerId }, active: run.active }; }
  if (typeof json?.query === 'string' && json.query.trim() && normalizeQuery(json.query) !== normalizeQuery(text)) {
    const route = routeHalachaQuery(json.query);
    if (route.intent === INTENTS.SITUATION && route.flow) { const run = runFlow(route.flow.id, [], json.query, env); return { response: { ...run.response, via: result.providerId }, active: run.active }; }
    if (route.answer) return { response: { ...answerFromEntries([route.answer]), via: result.providerId, notes: [`הבנתי את השאלה כך: "${json.query.slice(0, 80)}".`] }, active: null };
  }
  return null;
}

// Model task 3 (optional): a friendlier explanation of an answer that is already decided. Displayed only if the gate
// passes; the verified entries are shown either way.
export async function explainWithModel(model, response, conversation, question) {
  if (!model || !['answer', 'disagreement', 'multiple_cases'].includes(response.type)) return null;
  const entries = response.entryIds.map(entryById).filter(Boolean);
  const packet = buildPacket({ question, conversation, entries });
  const result = await model.complete({ task: 'explain', packet, maxOutputTokens: 500 });
  if (!result?.json) return null;
  const verdict = validateAssistantResponse(result.json, packet);
  return verdict.ok ? { ...result.json, via: result.providerId } : { rejected: verdict.errors };
}
