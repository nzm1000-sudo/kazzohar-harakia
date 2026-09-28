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
import { activeContexts, relatedWithReasons, outOfSeason } from '../halachaEngine.mjs';
import { HALACHA_GLOSSARY } from '../../data/halachaGlossary.mjs';
import { detectPrayerTimeQuestion, prayerNamed, prayerTimeStatus, timesFromContext, PRAYERS } from '../halachaTime.mjs';
import { normalizeQuery, isRelevantEntry, entryRelevance, isRelevantSection, questionKeyTerms, questionNames, extraSpecifics } from '../halachaSearch.mjs';
import { validateAssistantResponse } from './halachaGate.mjs';
import { reason, resolvePending } from '../halachaReasoning.mjs';
import { detectTodayQuestion, answerToday } from '../halachaToday.mjs';
import { RULE_BY_ENTRY } from '../../data/halachaRules.mjs';
import { conceptFor, fixedRouteFor } from '../../data/halachaConcepts.mjs';
import { extractTime, timeToDate } from '../halachaFacts.mjs';

const MAX_TURNS = 6;
const MAX_ENTRIES = 4;
const FORGOT_ONLY = /^(שכחתי|שכחתי משהו|טעיתי|שכחתי מה עושים|מה עושים)$/;
const SOURCE_REQUEST = /(?:^|\s)ו?(מקור|המקור|מאיפה|מהיכן|איפה כתוב|איפה זה כתוב|מה המקור|על סמך מה|על מה זה מבוסס|מנין|מניין)(?:\s|$|\?)/;
const WHY_REQUEST = /^ו?(למה|מדוע|מה הטעם)$/;
// A named rabbi's ruling that is not in the library is never produced ("מה פסק הרב … ?").
const NAMED_RULING = /(?:פסק|פוסק|פסקי|אומר|אמר|דעת|שיטת|לפי|תביא לי פסק של)\s+(?:ה)?רב(?:\s+(?!(?:שלי|שלנו|שלך|אם|של|על|לי|זה|אחר|כלשהו|אחד)(?:\s|$))([^\s?,.]+(?:\s+(?!(?:אם|על|של|אחרי|לפני|בענין|בעניין)(?:\s|$))[^\s?,.]+)?))?/;
const KNOWN_AUTHORITIES = /עובדיה|יצחק יוסף|ילקוט|שולחן ערוך|מרן|רמב"ם|רמבם|משנה ברורה|בן איש חי|כף החיים/;
// Short follow-ups that lean on the previous question ("ולאשתי?", "ועם גבינה?", "ואחרי?").
const ELLIPTICAL = /^(?:ו|ומה|ואם|ומה אם|ומה לגבי|ולגבי|וגם|אז)/;
// "מה מברכים על X?": the entry's own question must name X (an answer that only mentions X is about something else).
const BLESSING_OBJECT = /(?:מברכים|מברך|מברכת|הברכה|ברכה|לברך)\s+(?:על|ל)\s*([^\s?,.]{2,})/;
// General questions ("מתי…", "איך…", "מה זה…"): a single specific case, or several, is related material, not the answer.
const GENERAL_QUESTION = /^(?:מתי|איך|איפה|היכן|מה זה|מה זו|מהו|מהי)\s/;
const DEFINITION = /^מה (?:זה|זו|הוא|היא|פירוש|הפירוש של|המשמעות של)\s+(.+)$/;
const ELLIPSIS_EXPANSIONS = [[/^ו?אחרי$/, 'ברכה אחרונה אחרי'], [/^ו?מברכים$/, 'ברכה מברכים']];
const FORGOT_MENU = [
  { label: 'משהו בתפילה', flow: 'prayer-forgot' },
  { label: 'ברכה – לברך, או ברכה לא נכונה', flow: 'bracha-mistake' },
  { label: 'לספור ספירת העומר', flow: 'omer' },
  { label: 'קידוש או הבדלה', flow: 'kiddush-havdala' },
];
const PRAYER_MENU = ['shacharit', 'mincha', 'arvit', 'shema', 'tefillin'];
// Nearest verified answers are offered as a list only above this search score (measured: real questions ~170–200,
// unrelated overlaps and junk ~120–150).
const MIN_LIST_SCORE = 100;
// Requests to drop the sources or invent: answered with the rule, never followed.
const OVERRIDE_REQUEST = /(?:^|\s)(תתעלם|התעלם|תשכח מה|בלי מקורות|בלי המקורות|רק תגיד|תמציא|תעשה את עצמך|אתה הרב|תפסוק לי|ignore)(?:\s|$)/i;

// The day of the current turn, for season-aware "related" suggestions (set at the start of each respond()).
let currentContext = null;

export const newConversation = () => ({ turns: [], topic: '', active: null, last: null });

let sectionIndex = null;
const sectionById = id => (sectionIndex ||= new Map(YALKUT_YOSEF.sections.map(section => [section.id, section]))).get(id);
const entryById = id => PRACTICAL_HALACHA_QA_INDEX[id];
const sourceIdsOf = entry => (entry.sources || []).map(source => source.localSourceId).filter(Boolean);

function base(overrides) {
  return { type: 'insufficient', text: '', clarification: null, entryIds: [], sourceIds: [], relatedEntryIds: [], claims: [], confidence: 'incomplete', sensitive: false, notes: [], flow: null, time: null, via: 'deterministic', ...overrides };
}

function answerFromEntries(entries, extra = {}, env = {}) {
  const disputed = extra.disagreement || entries.some(entry => entry.ruleType === 'machloket');
  const related = entries.length ? relatedWithReasons(entries[0], { limit: 3, context: env.context || currentContext, now: env.now }).map(item => item.entry.id).filter(id => !entries.some(entry => entry.id === id)) : [];
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

function additionEntry(context) {
  if (context.isRoshChodesh) return { id: 'hal-moed-rc-yaale-veyavo-reminder', note: 'היום ראש חודש: בעמידה מוסיפים יעלה ויבוא.' };
  if (context.isCholHaMoed) return { id: 'hal-basic-yaale-chol-hamoed', note: 'היום חול המועד: בעמידה מוסיפים יעלה ויבוא.' };
  if (context.chanukah || context.purim) return { id: context.purim ? 'hal-basic-al-hanisim-purim' : 'hal-basic-al-hanisim-chanukah-arvit', note: 'היום מוסיפים על הניסים.' };
  return null;
}

function timeResponse(prayer, env, extraText = '') {
  const status = prayerTimeStatus(prayer, env.now, env.times);
  if (!status || status.status === 'unknown') return base({ type: 'insufficient', text: 'אין כרגע זמני היום (מיקום או חיבור), ולכן אי אפשר לחשב. אפשר לעיין בזמני התפילה במסך זמני היום.', time: status });
  const response = status.entries.length ? answerFromEntries(status.entries) : base({ type: 'sources_only' });
  const opens = status.status === 'not-yet' && status.times[0] ? ` הזמן מתחיל ב־${status.times[0].time} (${status.times[0].label}).` : '';
  const rows = status.times.length ? ` (${status.times.map(row => `${row.label} ${row.time}`).join(' · ')})` : '';
  // A day with an addition to the Amida (ראש חודש, חול המועד…): said with the time, since that is when it is forgotten.
  const addition = ['shacharit', 'mincha', 'arvit'].includes(prayer) ? additionEntry(env.context || {}) : null;
  const entryIds = addition ? (/מיוחד|משהו מיוחד|להוסיף|מוסיפים/.test(extraText) ? [addition.id, ...response.entryIds] : [...response.entryIds, addition.id]) : response.entryIds;
  return { ...response, entryIds, text: `השעה ${status.now}. ${status.summary}${opens}${rows}`, time: status, notes: addition ? [addition.note] : [] };
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
  currentContext = env.context || null;
  env.times = env.times || timesFromContext(env.context || {});
  const turns = [...conversation.turns, { role: 'user', text }].slice(-MAX_TURNS);
  // The conversation remembers its subject: the computable rule behind the last answer, the prayer in question, who.
  const done = (response, active, topic) => ({ conversation: {
    turns: [...turns, { role: 'assistant', text: response.text }].slice(-MAX_TURNS), topic: topic ?? conversation.topic, active, last: response,
    ruleId: response.ruleId || RULE_BY_ENTRY[response.entryIds?.[0]] || (active?.kind === 'rule' ? active.ruleId : null) || (response.type === 'clarification' ? conversation.ruleId : null) || null,
    prevRuleId: conversation.ruleId || null,
    // The event behind the last calculation (for "ושוקולד חלבי?", "ואם אני חולה?").
    calc: response.calc?.fromISO ? response.calc : response.ruleId && response.ruleId === conversation.ruleId ? conversation.calc || null : null,
    prayer: response.time?.prayer || (active?.kind === 'time' ? null : conversation.prayer) || null,
    who: response.who || conversation.who || null,
    question: questionOf ?? conversation.question ?? null,
    lastEntryIds: response.entryIds?.length ? response.entryIds : conversation.lastEntryIds || [],
  }, response });
  let questionOf;
  if (!text) return { conversation, response: null };

  // 1. An open question from the previous turn: understand the reply against its options.
  const active = conversation.active;
  if (active?.kind === 'flow') {
    const state = walkFlow(active.flowId, active.path);
    const match = state?.step && matchOption(active.flowId, state.stepId, text);
    if (match) { const topic = `${conversation.topic} ${text}`; const run = runFlow(active.flowId, [...active.path, match.index], topic, env); return done(run.response, run.active, topic); }
    const reasoned = reason(text, conversation, env);
    if (reasoned) return done(reasoned.response, reasoned.active, `${conversation.topic} ${text}`);
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
  if (active?.kind === 'rule') {
    const resolved = resolvePending(active, text, env);
    if (resolved) return done(resolved.response, resolved.active, conversation.topic);
  }
  if (active?.kind === 'additions') {
    const choice = active.candidates.find(item => normalizeQuery(text) === normalizeQuery(item.label)) || active.candidates.find(item => item.words.some(word => normalizeQuery(text).includes(normalizeQuery(word))));
    if (choice) return done(runAddition(choice, active.prayerLabel, active.where, conversation.topic, env, []), conversationActive(choice, active.prayerLabel, active.where, conversation.topic, env), conversation.topic);
  }
  if (active?.kind === 'time') {
    const prayer = prayerNamed(text) || PRAYER_MENU.find(key => normalizeQuery(text) === normalizeQuery(PRAYERS[key].label));
    if (prayer) return done(timeResponse(prayer, env), null);
  }

  // 2. A follow-up about the last answer: "מה המקור?", "למה?"
  const lastIds = conversation.last?.entryIds?.length ? conversation.last.entryIds : conversation.lastEntryIds || [];
  const asksSource = (SOURCE_REQUEST.test(normalizeQuery(text)) && normalizeQuery(text).split(' ').length <= 8) || WHY_REQUEST.test(normalizeQuery(text));
  if (asksSource && lastIds.length) return done(sourcesResponse(orderByMention(lastIds, text)), null);

  // 3. A new question — or a fact for the current subject. A verified rule plus the user's facts is computed here.
  const topic = text;
  questionOf = text;
  const normalized = normalizeQuery(text);
  // "אפשר כבר עכשיו?" after a prayer-time answer: the same prayer, checked again.
  const statesClock = /\d{1,2}:\d{2}/.test(text);
  const prayerFollowUp = Boolean(conversation.prayer) && (/(?:^|\s)ו?(עכשיו|כבר|עדיין|עוד|מתי|ממתי)(?:\s|$)/.test(normalized) || /גר"א|מגן אברהם|מג"א/.test(normalized)) && normalized.split(' ').length <= (statesClock ? 9 : 6) && !prayerNamed(text);
  if (!prayerFollowUp) {
    const reasoned = reason(text, conversation, env);
    if (reasoned) return done(reasoned.response, reasoned.active, reasoned.response.ruleId ? topic : conversation.topic);
  }
  const fixed = fixedRouteFor(text);
  if (fixed && !OVERRIDE_REQUEST.test(normalized)) return done(answerFromEntries(fixed.entries.map(entryById).filter(Boolean), {}, env), null, topic);
  if (FORGOT_ONLY.test(normalized)) {
    const activity = env.activity;
    if (activity?.section === 'omer') { const run = runFlow('omer', [], topic, env); return done(run.response, run.active, topic); }
    if (activity?.section === 'birkat-hamazon' || activity?.prayer) {
      // What could have been forgotten here today: only the additions this prayer has on this day.
      const where = activity.section === 'birkat-hamazon' ? 'birkat' : 'amida';
      const prayerLabel = where === 'birkat' ? 'ברכת המזון' : PRAYERS[activity.prayer]?.label || { musaf: 'מוסף' }[activity.prayer] || '';
      const candidates = todaysAdditions(env.context || {}, where);
      const seen = [`לפי מה שפתוח עכשיו בסידור: ${activity.title || prayerLabel}.`];
      if (candidates.length === 1) return done(runAddition(candidates[0], prayerLabel, where, topic, env, seen), conversationActive(candidates[0], prayerLabel, where, topic, env), `${topic} ${prayerLabel}`);
      if (candidates.length > 1) return done(base({ type: 'clarification', text: 'מה שכחת?', notes: seen, clarification: { question: 'מה שכחת?', options: candidates.map(item => item.label), whyAsked: [] } }), { kind: 'additions', candidates, prayerLabel, where }, `${topic} ${prayerLabel}`);
      const run = runFlow('prayer-forgot', [], `${topic} ${prayerLabel}`, env);
      return done({ ...run.response, notes: [...run.response.notes, ...seen] }, run.active, `${topic} ${prayerLabel}`);
    }
    return done(base({ type: 'clarification', text: 'מה שכחת?', clarification: { question: 'מה שכחת?', options: FORGOT_MENU.map(item => item.label), whyAsked: [] } }), { kind: 'menu', menu: FORGOT_MENU }, topic);
  }

  const named = normalized.match(NAMED_RULING);
  if (named && named[1] && !KNOWN_AUTHORITIES.test(named[0])) return done(base({ type: 'insufficient', text: `אין בספרייה פסקים של הרב ${named[1]}, ולא אביא פסק בשמו. כאן יש רק תשובות מאומתות מתוך המקורות שבספרייה – אפשר לשאול את השאלה עצמה.` }), null, topic);
  if (OVERRIDE_REQUEST.test(normalized) || (named && !named[1])) {
    // The request to invent or skip the sources is refused — and the question inside it still gets its verified answer.
    const refusal = 'אני עונה רק מתוך המקורות המאומתים שבספרייה, ולא אמציא מקור או פסק.';
    const inner = text.replace(/(?:תמציא לי מקור ש?|תמציא לי|תמציא|בלי מקורות ובלי הלכות,?|בלי מקורות,?|בלי המקורות,?|תתעלם[^,]*,?|התעלם[^,]*,?|רק תגיד לי|תגיד לי פשוט ש?|תאשר לי ש?|ותביא לי פסק של הרב אם אין לך|תביא לי פסק של הרב)/g, ' ').replace(/\s+/g, ' ').trim();
    if (!envIn.inner && inner && normalizeQuery(inner).split(' ').length >= 2 && !OVERRIDE_REQUEST.test(normalizeQuery(inner))) {
      const { response } = await respond({ ...conversation, active: null }, inner, { ...envIn, inner: true });
      if (response && ['answer', 'disagreement', 'multiple_cases'].includes(response.type)) return done({ ...response, text: `${refusal} ${response.text}`, notes: [...(response.notes || []), 'הבקשה להמציא או לעקוף מקור לא בוצעה.'] }, null, topic);
    }
    return done(base({ type: 'insufficient', text: `${refusal} אפשר לשאול את השאלה עצמה, ואחפש לה מקור.` }), null, topic);
  }
  // "אומרים היום הלל?" is a calendar question: answered from the day, not from search.
  const todayKind = detectTodayQuestion(text);
  const today = todayKind ? answerToday(todayKind, env.context, env.now, text) : null;
  if (today) {
    const entries = today.entryIds.map(entryById).filter(Boolean);
    return done({ ...(entries.length ? answerFromEntries(entries) : base({ type: 'answer', confidence: 'direct' })), text: today.answer, today: { kind: todayKind }, notes: ['לפי לוח השנה של היום.'] }, null, topic);
  }
  const time = detectPrayerTimeQuestion(text) || (prayerFollowUp ? { prayer: conversation.prayer } : null);
  if (time) {
    const prayer = time.prayer || conversation.prayer || (env.activity?.prayer && PRAYERS[env.activity.prayer] ? env.activity.prayer : null);
    // "עכשיו 13:05, אפשר כבר מנחה?" — a clock time the user states is the moment to check.
    const stated = extractTime(text, env.now);
    const at = stated && stated.kind === 'clock' && !stated.ambiguous ? timeToDate(stated, env.now) : null;
    if (prayer) return done(timeResponse(prayer, at ? { ...env, now: at } : env, text), null, topic);
    return done(base({ type: 'clarification', text: 'על איזו תפילה מדובר?', clarification: { question: 'על איזו תפילה?', options: PRAYER_MENU.map(key => PRAYERS[key].label), whyAsked: [] } }), { kind: 'time' }, topic);
  }

  // A short follow-up that leans on the previous question: read together with it.
  const carried = followUp(text, conversation, env);
  if (carried) return done(carried, null, `${conversation.question} ${text}`);
  const concept = conceptFor(text);
  if (concept) {
    const entries = [concept.overview, ...concept.occasions].map(entryById).filter(Boolean);
    return done({ ...answerFromEntries(entries.slice(0, 4)), text: 'התשובה תלויה ביום. אלה התשובות המאומתות – הכללית, ולכל מועד:', relatedEntryIds: entries.slice(4).map(entry => entry.id), concept: concept.id }, null, topic);
  }
  if (normalized.split(' ').length < 2) return done(base({ type: 'insufficient', text: 'אפשר לפרט קצת יותר? למשל: "שכחתי יעלה ויבוא במנחה" או "אפשר לחמם מרק בשבת?"' }), null, topic);

  const route = routeHalachaQuery(text);
  if (route.intent === INTENTS.SENSITIVE) {
    return done(base({ type: 'refer_to_rabbi', sensitive: true, text: 'זה נושא אישי ורגיש. כאן אפשר ללמוד מהמקורות; להכרעה במקרה אישי פונים למורה הוראה או ליועצת הלכה.', sourceIds: (route.results.yalkut || []).slice(0, 2).map(item => item.id) }), null, topic);
  }
  if (route.intent === INTENTS.SITUATION && route.flow) { const run = runFlow(route.flow.id, [], topic, env); return done(run.response, run.active, topic); }
  // "מה זה מוקצה?": a term is explained from the glossary (an explanation, not a ruling), with entries that name it.
  const definition = normalized.match(DEFINITION);
  if (definition) {
    const asked = definition[1].trim();
    const term = HALACHA_GLOSSARY.find(item => item.forms.some(form => normalizeQuery(asked).includes(normalizeQuery(form))));
    const naming = (route.results.unified || []).filter(item => item.kind === 'question' && item.score >= MIN_LIST_SCORE && normalizeQuery(asked).split(' ').filter(word => word.length > 1 && !/^ו?(של|את|על)$/.test(word)).every(word => questionNames(item.item, word))).slice(0, 3).map(item => item.item);
    // A verified entry that itself asks what the term is ("מה זה מוקצה?", "כמה זה כזית?") is the answer.
    const phrase = normalizeQuery(asked);
    const defining = naming.find(entry => /^(?:מה|מהו|מהי|מהם|מהן|כמה)\s/.test(normalizeQuery(entry.question)) && extraSpecifics(text, entry).length <= 2)
      || (phrase.split(' ').length >= 2 && naming.find(entry => normalizeQuery(entry.question).includes(phrase)));
    if (defining) return done({ ...answerFromEntries([defining]), notes: term ? [`${term.term}: ${term.text} (הסבר מונח)`] : [] }, null, topic);
    if (term) return done({ ...base({ type: 'definition', confidence: 'incomplete' }), text: `${term.term}: ${term.text}`, entryIds: naming.map(entry => entry.id), notes: ['הסבר מונח – לא פסק הלכה.'], glossary: term.id }, null, topic);
    if (naming.length) return done({ ...answerFromEntries(naming), type: 'related', text: 'אין במאגר הגדרה למונח הזה. אלה הלכות מאומתות שעוסקות בו:', confidence: 'incomplete', claims: [] }, null, topic);
  }
  // Only verified answers that are about the question's subject; a word match alone is not an answer.
  const terms = questionKeyTerms(text);
  const object = normalized.match(BLESSING_OBJECT)?.[1];
  const general = GENERAL_QUESTION.test(normalized);
  const fits = entry => !object || questionNames(entry, object, { questionOnly: true });
  const inSeason = item => ({ ...item, score: item.score - (outOfSeason(item.item, env.active) && !normalizeQuery(item.item.topic || '').split(' ').some(word => word.length > 2 && normalized.includes(word)) ? 30 : 0) });
  // More particular words than shared ones: "איך מכשירים כלי?" vs "איך מכשירים קומקום חשמלי?".
  const tooSpecific = entry => { if (!general) return false; const extra = extraSpecifics(text, entry).length; const shared = terms.ranked.filter(term => questionNames(entry, term)).length; return extra >= 2 && extra > shared; };
  if (route.answer && fits(route.answer) && !tooSpecific(route.answer) && !outOfSeason(route.answer, env.active)) return done(answerFromEntries([route.answer]), null, topic);
  const ranked = (route.results.unified || []).filter(item => item.kind === 'question' && item.score >= MIN_LIST_SCORE && isRelevantEntry(text, item.item, terms) && fits(item.item)).map(inSeason).sort((a, b) => b.score - a.score);
  const verified = ranked.slice(0, 3).map(item => item.item);
  // One relevant answer that clearly leads is the answer; several close ones are shown as cases — unless the question is
  // general and the entries are particular cases of it: then they are related material.
  const leads = ranked.length === 1 || (ranked.length > 1 && ranked[0].score - ranked[1].score >= 25);
  if (leads && !tooSpecific(ranked[0].item)) return done(answerFromEntries([ranked[0].item]), null, topic);
  if (verified.length && !tooSpecific(verified[0])) return done({ ...answerFromEntries(verified), type: 'multiple_cases', text: 'אלה התשובות המאומתות הקרובות לשאלה:', confidence: 'grounded_synthesis' }, null, topic);
  if (verified.length) return done({ ...answerFromEntries(verified), type: 'related', text: 'אין במאגר תשובה מאומתת אחת לשאלה הכללית הזו. אלה הלכות מאומתות על מקרים ממנה:', confidence: 'incomplete', claims: [] }, null, topic);
  // Verified halachot on the same subject, but not the question itself: offered as related, never as the answer.
  const related = (route.results.unified || []).filter(item => item.kind === 'question' && item.score >= MIN_LIST_SCORE && entryRelevance(text, item.item, terms) === 'weak' && fits(item.item)).slice(0, 3).map(item => item.item);
  if (related.length) return done({ ...answerFromEntries(related), type: 'related', text: 'אין במאגר תשובה מאומתת לשאלה עצמה. אלה הלכות מאומתות באותו נושא:', confidence: 'incomplete', claims: [] }, null, topic);

  // 4. Nothing deterministic: a model may interpret the question (never answer it from its own knowledge).
  const interpreted = await modelInterpret(env.model, text, conversation, env);
  if (interpreted) return done(interpreted.response, interpreted.active, topic);
  // A source is offered for study only when it is about the question's subject (its title names the key word).
  const sources = (route.results.yalkut || []).filter(item => isRelevantSection(text, item, terms)).slice(0, 3);
  if (sources.length) return done(base({ type: 'sources_only', text: 'אין עדיין תשובה מאומתת לשאלה הזו. אלה מקורות שעוסקים בנושא, לעיון:', sourceIds: sources.map(item => item.id) }), null, topic);
  return done(base({ type: 'insufficient', text: 'אין במאגר המאומת מספיק מידע כדי לענות על זה. לא ננחש – כדאי לשאול רב.' }), null, topic);
}

// The additions a prayer (or birkat hamazon) has on this day, from the calendar flags JewishContextEngine provides.
function todaysAdditions(context, where) {
  const list = [];
  if (context.isRoshChodesh || context.isCholHaMoed || context.isYomTov) list.push({ kind: 'yaaleh', label: 'יעלה ויבוא', words: ['יעלה ויבוא', 'יעלה'] });
  if (context.chanukah || context.purim) list.push({ kind: 'hanisim', label: 'על הניסים', words: ['על הניסים', 'הניסים'] });
  if (where === 'amida' && context.isAseretYemeiTeshuvah) list.push({ kind: 'teshuva', label: 'המלך הקדוש / זכרנו לחיים', words: ['המלך', 'זכרנו'] });
  if (where === 'amida' && context.seasonal?.vetenTalUmatar) list.push({ kind: 'tal', label: 'ותן טל ומטר', words: ['טל ומטר', 'טל'] });
  if (where === 'birkat' && context.weekday === 6) list.push({ kind: 'retzeh', label: 'רצה', words: ['רצה'] });
  return list;
}

function runAddition(item, prayerLabel, where, topic, env, notes) {
  const say = `${topic} ${where === 'birkat' ? 'ברכת המזון' : `עמידה ${prayerLabel}`}`;
  const flowFor = { yaaleh: ['yaaleh-veyavo', `${say} יעלה ויבוא`], teshuva: ['aseret-yemei-teshuva', say], tal: ['prayer-forgot', `${say} טל ומטר`], retzeh: ['prayer-forgot', `${say} רצה`] };
  if (item.kind === 'hanisim') {
    const entry = entryById(where === 'birkat' ? 'hal-brachot-forgot-al-hanisim' : 'hal-chag-forgot-al-hanisim');
    return { ...answerFromEntries([entry], {}, env), notes };
  }
  const [flowId, words] = flowFor[item.kind];
  const run = runFlow(flowId, [], words, env);
  return { ...run.response, notes: [...notes, ...run.response.notes] };
}

function conversationActive(item, prayerLabel, where, topic, env) {
  if (item.kind === 'hanisim') return null;
  const say = `${topic} ${where === 'birkat' ? 'ברכת המזון' : `עמידה ${prayerLabel}`}`;
  const flowFor = { yaaleh: ['yaaleh-veyavo', `${say} יעלה ויבוא`], teshuva: ['aseret-yemei-teshuva', say], tal: ['prayer-forgot', `${say} טל ומטר`], retzeh: ['prayer-forgot', `${say} רצה`] };
  const [flowId, words] = flowFor[item.kind];
  return runFlow(flowId, [], words, env).active;
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

// The sources of the last answer, the entry the question names first ("ומאיפה יודעים לספור מסוף האכילה?").
function orderByMention(entryIds, text) {
  const words = normalizeQuery(text).split(' ').filter(word => word.length > 2);
  const score = id => { const entry = entryById(id); const hay = normalizeQuery(`${entry?.question || ''} ${entry?.shortAnswer || ''}`); return words.filter(word => hay.includes(word.replace(/^[והבלמש]/, ''))).length; };
  return [...entryIds].sort((a, b) => score(b) - score(a));
}

// "ולאשתי?" after "מותר להסתפר היום?": the new words, read with the previous question's subject. Returns a response,
// or null when the message stands on its own.
function followUp(text, conversation, env) {
  const previous = conversation.question;
  const normalized = normalizeQuery(text);
  const count = normalized.split(' ').length;
  // Elliptical ("ולאשתי?"), very short, or without a subject of its own ("אני לא בטוח אם אמרתי").
  if (!previous || count > 8 || !(ELLIPTICAL.test(normalized) || count <= 2 || !questionKeyTerms(text).ranked.length)) return null;
  const expanded = ELLIPSIS_EXPANSIONS.find(([pattern]) => pattern.test(normalized))?.[1] || text;
  const own = questionKeyTerms(expanded);
  const prior = questionKeyTerms(previous);
  const shown = new Set([...(conversation.last?.entryIds || []), ...(conversation.lastEntryIds || [])]);
  const lastTopic = entryById([...shown][0])?.topic;
  const route = routeHalachaQuery(`${previous} ${expanded}`);
  const ownOnly = routeHalachaQuery(expanded);
  const pool = new Map();
  for (const item of [...(route.results.unified || []), ...(ownOnly.results.unified || [])]) if (item.kind === 'question' && !pool.has(item.item.id)) pool.set(item.item.id, item);
  const onSubject = entry => entry.topic === lastTopic || prior.ranked.slice(0, 3).some(term => entryRelevance(term, entry, { content: [term], unknown: [], ranked: [term] }) !== null);
  // The new words must be covered by the entry (all of them when there are one or two); an entry already shown
  // qualifies only when the new words point at it.
  const coversOwn = entry => { if (!own.ranked.length) return !shown.has(entry.id); const level = entryRelevance(expanded, entry, { ...own, unknown: [] }); return level === 'strong' || (level === 'weak' && entry.topic === lastTopic); };
  // With no content words of its own ("מברכים?"), the follow-up is about the same topic: the entries of that topic whose
  // question has the follow-up's words.
  if (!own.ranked.length && lastTopic) {
    const asked = normalizeQuery(expanded).split(' ').map(word => word.replace(/^ו/, '')).filter(word => word.length > 2);
    for (const entry of Object.values(PRACTICAL_HALACHA_QA_INDEX)) {
      if (entry.topic !== lastTopic || shown.has(entry.id) || pool.has(entry.id)) continue;
      const hits = asked.filter(word => normalizeQuery(entry.question).includes(word)).length;
      if (hits) pool.set(entry.id, { kind: 'question', item: entry, score: MIN_LIST_SCORE + hits * 10 });
    }
  }
  const candidates = [...pool.values()].filter(item => item.score >= MIN_LIST_SCORE - 20 && coversOwn(item.item) && onSubject(item.item));
  candidates.sort((a, b) => (b.item.topic === lastTopic) - (a.item.topic === lastTopic) || b.score - a.score);
  const pick = candidates[0];
  if (!pick) return null;
  return { ...answerFromEntries([pick.item], {}, env), notes: [`בהמשך לשאלה: "${String(previous).slice(0, 60)}"`] };
}
