// Deterministic halacha reasoning: verified rule (knowledge) + the user's facts + the day's zmanim → a computed,
// explained answer. Knowledge comes only from data/halachaRules.mjs (each number tied to its verified entry); facts from
// halachaFacts.mjs; arithmetic here. A missing fact is asked for; an ambiguous one is asked about — unless every
// reading gives the same answer — never guessed.
import { HALACHA_RULES, RULE_INDEX, RULE_BY_ENTRY, ruleMatches, SWEETS, DAIRY_WORDS } from '../data/halachaRules.mjs';
import { extractTimes, extractPeriod, eventCandidates, extractDuration, extractWho, formatHM, addMinutes } from './halachaFacts.mjs';

// A guided flow whose subject is a computable rule (a fact given mid-flow is applied to it).
const FLOW_RULE = { 'meat-dairy': 'meat-dairy-wait', omer: 'omer-forgot-now' };
const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const PAST = /(?:^|\s)(?:אכלתי|סיימתי|גמרתי|אכל|אכלה|אכלנו|טעמתי|בלעתי|שתיתי|הייתי|יצאתי|הורדתי|פשטתי|חזרתי|נחתתי|התחלתי|בירכתי|נכנסתי)(?:\s|$)/;
const HYPOTHETICAL = /(?:^|\s)ו?אם\s|(?:^|\s)נניח\s/;
const FUTURE = /(?:^|\s)(?:אני אוכל|אוכל ב|אני הולך לאכול|אני הולכת לאכול|אתכנן|אני מתכנן|אני מתכננת)(?:\s|$)/;
const PERSONAL = /(?:^|\s)(?:אכלתי|סיימתי|גמרתי|אכלנו|אני בשרי|אני חלבי|מתי (?:מותר|אפשר) לי|מתי אני|מותר לי|אפשר לי|כמה עוד|כמה נשאר)(?:\s|$)/;
const minutesLabel = minutes => {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  if (!h) return `${m} דקות`;
  const hours = h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`;
  return m ? `${hours} ו־${m} דקות` : hours;
};
const dayNote = (date, now) => (date.toDateString() === now.toDateString() ? '' : date > now ? ' (מחר)' : ' (אתמול)');
const tenseOf = text => (HYPOTHETICAL.test(text) ? 'if' : FUTURE.test(text) ? 'future' : 'past');
const amountOf = text => { const match = String(text).match(/(\d+(?:\.\d+)?)\s*גרם/); return match ? Number(match[1]) : null; };

// Which rule this message is about: its own words first, then the open flow, then the subject of the previous answer
// (a follow-up that supplies a fact, like "ואם אכלתי ב-14:30?").
export function ruleFor(text, conversation = {}) {
  const explicit = HALACHA_RULES.find(rule => ruleMatches(rule, text));
  if (explicit) return { rule: explicit, via: 'words' };
  const fromFlow = conversation.active?.kind === 'flow' && FLOW_RULE[conversation.active.flowId];
  if (fromFlow) return { rule: RULE_INDEX[fromFlow], via: 'context' };
  // Only the rule behind the last answer (its lead entry), not every entry shown with it.
  const previous = [conversation.ruleId, conversation.prevRuleId].map(id => id && RULE_INDEX[id]).find(Boolean) || RULE_INDEX[RULE_BY_ENTRY[conversation.last?.entryIds?.[0]]];
  return previous ? { rule: previous, via: 'context' } : null;
}

// Does this follow-up bring something the rule can use?
function followUpFact(rule, text, now, conversation) {
  const times = extractTimes(text);
  switch (rule.kind) {
    case 'wait': return times.length > 0 || Boolean(conversation.calc?.fromISO && (extractWho(text) || rule.variants?.need?.words.test(text) || DAIRY_WORDS.test(` ${text} `) || SWEETS.test(text)));
    case 'window': return times.length > 0 || Boolean(rule.conditionWords?.test(text));
    case 'interval': return times.length > 0;
    case 'duration-threshold': return extractDuration(text) !== null;
    case 'amount-threshold': return amountOf(text) !== null;
    case 'zman-offset': return times.length > 0 || /עכשיו|כבר|עוד/.test(text) || Object.values(rule.variants || {}).some(variant => variant.words?.test(text));
    case 'omer-status': return rule.fact.test(text);
    default: return false;
  }
}

// Returns null (not a reasoning question), or { response, active } in the conversation's response shape.
export function reason(text, conversation = {}, env = {}) {
  const now = env.now || new Date();
  const found = ruleFor(text, conversation);
  if (!found) return null;
  const { rule, via } = found;
  if (via === 'context' && !followUpFact(rule, text, now, conversation)) return null;
  const who = extractWho(text) || (via === 'context' ? conversation.who : null) || null;
  return compute(rule, { text, who, now, env, via, conversation });
}

// The user's reply to a pending question: which reading of an ambiguous time, or the missing time itself.
export function resolvePending(pending, text, env = {}) {
  const now = env.now || new Date();
  const rule = RULE_INDEX[pending.ruleId];
  if (!rule) return null;
  if (pending.awaiting === 'time') {
    const mentions = extractTimes(text, pending.text);
    if (!mentions.length) return null;
    return compute(rule, { text: `${pending.text} ${text}`, who: pending.who, now, env, via: 'pending', conversation: {}, eventText: text, hint: pending.text });
  }
  const options = pending.options;
  const pick = /לילה|בלילה|לפנות בוקר|לפני הצהריים|בבוקר/.test(text) ? 0 : /צהריים|אחה"צ|אחר הצהריים|ערב/.test(text) ? 1 : options.findIndex(option => text.includes(option.label.slice(0, 5)));
  if (pick < 0) return null;
  return compute(rule, { text: pending.text, who: pending.who, now, env, via: 'pending', conversation: {}, at: new Date(options[pick].iso) });
}

function answer(rule, text, extra = {}) {
  const entryIds = [...new Set([extra.mainEntryId || rule.entryId, ...(extra.moreEntryIds || [])])];
  return {
    type: 'answer', text, entryIds, sourceIds: [], relatedEntryIds: [],
    claims: entryIds.map(id => ({ text: id, sourceIds: [id], support: 'direct' })),
    confidence: 'direct', sensitive: false, notes: extra.notes || [], clarification: null, flow: null, time: null,
    via: 'deterministic', ruleId: rule.id, calc: extra.calc || null, who: extra.who || null,
  };
}

function ask(rule, question, options, active, extra = {}) {
  return {
    response: { type: 'clarification', text: extra.lead || 'כדי לחשב נכון צריך לדעת:', clarification: { question, options, whyAsked: [] }, entryIds: extra.entryIds || [], sourceIds: [], relatedEntryIds: [], claims: [], confidence: 'incomplete', sensitive: false, notes: extra.notes || [], flow: null, time: null, via: 'deterministic', ruleId: rule.id },
    active,
  };
}

// The general rule, when it was asked about without a fact ("כמה זמן מחכים אחרי בשר?").
function overview(rule, who) {
  const variant = who && rule.variants?.[who];
  if (rule.kind === 'wait') {
    if (variant) return { response: answer(rule, 'זו התשובה המאומתת. אם תכתוב מתי סיים לאכול, אחשב את השעה.', { mainEntryId: variant.entryId, moreEntryIds: [rule.note.entryId], who }), active: null };
    return { response: answer(rule, `לפי התשובה המאומתת מחכים ${rule.evidence} מסיום אכילת הבשר. אם תכתוב מתי סיימת לאכול, אחשב את השעה.`, { moreEntryIds: [rule.note.entryId, rule.variants.need.entryId, rule.variants.sick.entryId, rule.variants.child.entryId] }), active: null };
  }
  const invite = rule.kind === 'window' ? ' אם תכתוב מתי זה היה, אחשב אם עוד אפשר.' : rule.kind === 'duration-threshold' ? ' אם תכתוב כמה זמן זה נמשך, אבדוק.' : '';
  return { response: answer(rule, `זו התשובה המאומתת (${rule.evidence}).${invite}`, { moreEntryIds: (rule.topicEntries || []).filter(id => id !== rule.entryId) }), active: null };
}

// The event's moment: a time the user stated (the one nearest the rule's anchor word, before a target time), "now",
// a period of the day, or a remembered moment from the previous turn.
function eventMoment(rule, text, { now, conversation, via, at, eventText, hint }) {
  if (at) return { dates: [at] };
  const source = eventText || text;
  const mentions = extractTimes(source, hint || (via === 'context' ? conversation.topic : ''));
  const invalid = mentions.find(item => item.fact.kind === 'invalid');
  if (invalid) return { invalid };
  const anchorIndex = rule.anchor ? (rule.anchor.exec(` ${source} `)?.index ?? -1) : -1;
  const targetIndex = rule.targetAfter ? (rule.targetAfter.exec(` ${source} `)?.index ?? -1) : -1;
  let event = null, target = null;
  if (mentions.length) {
    const beforeTarget = targetIndex >= 0 ? mentions.filter(item => item.index < targetIndex) : mentions;
    const pool = beforeTarget.length ? beforeTarget : mentions;
    event = anchorIndex >= 0 ? pool.reduce((best, item) => (Math.abs(item.index - anchorIndex) < Math.abs(best.index - anchorIndex) ? item : best)) : pool[0];
    // "עכשיו" is the moment of asking, not the event, when a real time is also stated — or when it goes with the
    // question ("מותר לי עכשיו חלב?").
    if (event.fact.kind === 'relative' && event.fact.minutesAgo === 0 && pool.some(item => item.fact.kind === 'clock')) event = pool.find(item => item.fact.kind === 'clock');
    else if (event.fact.kind === 'relative' && event.fact.minutesAgo === 0 && /(?:מותר|אפשר)(?:\s+לי)?\s+עכשיו|עכשיו\s+(?:מותר|אפשר)/.test(source)) event = null;
    target = event ? mentions.find(item => item !== event && item.index > (targetIndex >= 0 ? targetIndex : event.index) && item.fact.kind === 'clock') || null : null;
  }
  if (!event && via === 'context' && conversation.calc?.fromISO) return { dates: [new Date(conversation.calc.fromISO)], remembered: true };
  if (!event) { const period = extractPeriod(source, now); return period ? { period } : {}; }
  const tense = tenseOf(text);
  const dates = eventCandidates(event.fact, now, tense);
  const targetDates = target ? eventCandidates(target.fact, now, 'future').concat(eventCandidates(target.fact, now, 'if')).filter((date, index, list) => list.findIndex(other => other.getTime() === date.getTime()) === index) : [];
  return { dates, fact: event.fact, target: targetDates.length ? targetDates.sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0] : null };
}

function waitBase(rule, text, who) {
  if (who && rule.variants?.[who]) return { ...rule.variants[who], key: who };
  if (rule.variants?.cooked?.words.test(text)) return { ...rule.variants.cooked, key: 'cooked' };
  return { entryId: rule.entryId, minutes: rule.minutes, evidence: rule.evidence, key: null };
}

function compute(rule, ctx) {
  const { text, who, now, env, via, conversation } = ctx;
  if (rule.kind === 'wait' || rule.kind === 'window') {
    if (rule.kind === 'window' && via === 'context' && rule.conditionWords?.test(text) && !extractTimes(text).length) {
      return { response: answer(rule, `לפי התשובה המאומתת: אם שבעת – ${rule.conditionEvidence}.`, {}), active: null };
    }
    const moment = eventMoment(rule, text, ctx);
    if (moment.invalid) return ask(rule, `"${moment.invalid.fact.raw}" אינה שעה תקינה. באיזו שעה זה היה?`, [], { kind: 'rule', ruleId: rule.id, awaiting: 'time', who, text }, { lead: 'כדי לחשב נכון צריך לדעת:' });
    if (!moment.dates && moment.period) return fromPeriod(rule, moment.period, ctx);
    if (!moment.dates) {
      // A personal question without the time: ask for it (the rule itself is shown with the question).
      if (rule.kind === 'wait' && (PERSONAL.test(` ${text} `) || via === 'context')) {
        const base = waitBase(rule, text, who);
        return ask(rule, 'באיזו שעה סיימת לאכול את הבשר?', [], { kind: 'rule', ruleId: rule.id, awaiting: 'time', who, text }, { lead: `לפי התשובה המאומתת מחכים ${base.evidence} מסיום אכילת הבשר.`, entryIds: [base.entryId, rule.note.entryId] });
      }
      if (rule.kind === 'wait') return overview(rule, who);
      if (via === 'words' && (!rule.overviewWords || rule.overviewWords.test(text))) return overview(rule, who);
      return null;
    }
    if (moment.dates.length === 0) return null;
    if (moment.dates.length > 1) {
      // Two readings: when both lead to the same practical answer, no question is needed.
      const results = moment.dates.map(date => evaluate(rule, date, { ...ctx, target: moment.target }));
      if (results.every(item => item.verdict === results[0].verdict) && results[0].verdict === 'open-now') return { response: results.sort((a, b) => b.at - a.at)[0].response, active: null };
      const options = moment.dates.map(date => ({ iso: date.toISOString(), label: `${formatHM(date)} ${date.getHours() < 12 ? '(לפנות בוקר)' : '(אחר הצהריים)'}${dayNote(date, now)}` }));
      return ask(rule, `הכוונה ל־${options[0].label} או ל־${options[1].label}?`, options.map(option => option.label), { kind: 'rule', ruleId: rule.id, options, who, text });
    }
    return { response: evaluate(rule, moment.dates[0], { ...ctx, target: moment.target }).response, active: null };
  }
  if (rule.kind === 'interval') {
    const mentions = extractTimes(text).filter(item => item.fact.kind === 'clock');
    const dates = mentions.map(item => eventCandidates(item.fact, now, 'if')[0]).filter(Boolean);
    let from = dates[0], to = dates[1];
    if (dates.length === 1 && via === 'context' && conversation.calc?.fromISO) { from = new Date(conversation.calc.fromISO); to = dates[0]; }
    if (!from || !to) return via === 'words' ? overview(rule, who) : null;
    if (to < from) to = addMinutes(to, 12 * 60);
    const minutes = Math.round((to - from) / 60000);
    const within = minutes < rule.minutes;
    return { response: answer(rule, `מ־${formatHM(from)} עד ${formatHM(to)} עברו ${minutesLabel(minutes)} – ${within ? rule.within : rule.beyond} (לפי התשובה המאומתת: ${rule.evidence}).`, { calc: { fromISO: from.toISOString(), from: formatHM(from), to: formatHM(to), minutes, within } }), active: null };
  }
  if (rule.kind === 'duration-threshold') {
    const minutes = extractDuration(text);
    if (minutes === null) return via === 'words' && rule.overviewWords?.test(text) ? overview(rule, who) : null;
    const flight = rule.variants?.flight && /טיסה|מטוס|\sטס\s|בטיסה/.test(` ${text} `);
    const base = flight ? rule.variants.flight : rule;
    const meets = rule.thresholdMeansAtLeast ? minutes >= base.minutes : minutes <= base.minutes;
    const lead = `${minutesLabel(minutes)} – ${meets ? rule.within : rule.beyond} (לפי התשובה המאומתת: ${base.evidence}).`;
    return { response: answer(rule, lead, { mainEntryId: base.entryId, moreEntryIds: (rule.topicEntries || []).filter(id => id !== base.entryId).slice(0, 1), calc: { minutes, threshold: base.minutes, meets } }), active: null };
  }
  if (rule.kind === 'amount-threshold') {
    const grams = amountOf(text);
    if (grams === null) return null;
    const meets = rule.strictlyAbove ? grams > rule.grams : grams >= rule.grams;
    const outcome = meets ? rule.within : rule.beyond;
    const lead = `${grams} גרם – ${outcome.text} (לפי התשובה המאומתת: השיעור ${rule.evidence}).`;
    return { response: answer(rule, lead, { mainEntryId: outcome.entryId, moreEntryIds: (rule.topicEntries || []).filter(id => id !== outcome.entryId), calc: { grams, threshold: rule.grams, meets } }), active: null };
  }
  if (rule.kind === 'zman-offset') return zmanOffset(rule, ctx);
  if (rule.kind === 'omer-status') return omerStatus(rule, ctx);
  if (rule.kind === 'weekday-until') {
    const weekday = env.context?.weekday;
    if (!Number.isInteger(weekday)) return null;
    const open = weekday <= rule.untilWeekday;
    const lead = `היום יום ${WEEKDAYS[weekday]}. לפי התשובה המאומתת מבדילים ${rule.evidence} – ${open ? 'עוד אפשר.' : 'הזמן הזה כבר עבר.'}`;
    return { response: answer(rule, lead, { calc: { weekday, open } }), active: null };
  }
  return null;
}

// One reading of the event time → the answer, and a verdict used to decide whether an ambiguity matters.
function evaluate(rule, when, { text, who, now, target }) {
  const hm = formatHM(when);
  if (rule.kind === 'window') {
    const deadline = addMinutes(when, rule.minutes);
    const open = now <= deadline;
    const lead = `מ־${hm} ועד ${formatHM(deadline)}${dayNote(deadline, now)} (${rule.evidence}) – ${open ? `עוד אפשר, נשארו ${minutesLabel((deadline - now) / 60000)}.` : 'הזמן כבר עבר.'}`;
    return { verdict: open ? 'window-open' : 'window-closed', at: when, response: answer(rule, lead, { notes: rule.condition ? [rule.condition] : [], moreEntryIds: (rule.topicEntries || []).filter(id => id !== rule.entryId).slice(0, 1), calc: { fromISO: when.toISOString(), from: hm, minutes: rule.minutes, result: formatHM(deadline), open } }) };
  }
  const base = waitBase(rule, text, who);
  const until = addMinutes(when, base.minutes);
  const calc = { fromISO: when.toISOString(), from: hm, minutes: base.minutes, result: formatHM(until) };
  const verdict = until <= now ? 'open-now' : 'wait';
  const status = until <= now ? 'כלומר, כבר עכשיו.' : `כלומר, בעוד ${minutesLabel((until - now) / 60000)}.`;
  if (base.key === 'child') {
    const six = addMinutes(when, rule.minutes);
    const sweets = SWEETS.test(text);
    const lead = sweets
      ? `לקטן, לפי התשובה המאומתת, ממתקים ושוקולד חלביים – רק אחרי שש שעות: אם סיים לאכול בשר ב־${hm}, מ־${formatHM(six)}${dayNote(six, now)}. (מאכל חלבי חיוני לסעודה – אפשר להקל כבר אחרי שעה, מ־${formatHM(until)}.)`
      : `לקטן, לפי התשובה המאומתת, אפשר להקל ולא להמתין שש שעות, ואף אחרי שעה המקל יש לו על מה לסמוך: אם סיים לאכול בשר ב־${hm}, זה מ־${formatHM(until)}${dayNote(until, now)}. כל זה במאכל חיוני לסעודה; ממתקים ושוקולד חלביים – רק אחרי שש שעות (${formatHM(six)}).`;
    const targetNote = target && !sweets ? [`ב־${formatHM(target)} ${target >= until ? 'כבר עברה שעה – אפשר, במאכל חיוני לסעודה.' : 'עוד לא עברה שעה.'}`] : [];
    return { verdict, at: when, response: answer(rule, lead, { mainEntryId: base.entryId, moreEntryIds: [rule.entryId, rule.note.entryId], notes: targetNote, who, calc: { ...calc, result: formatHM(sweets ? six : until) } }) };
  }
  const needWords = rule.variants?.need?.words.test(text);
  if (target) {
    // "ב-18:10 אפשר?" — the planned time against the verified waits.
    const full = addMinutes(when, rule.minutes);
    const need = rule.variants?.need && !who ? addMinutes(when, rule.variants.need.minutes) : null;
    let lead;
    if (target >= until) lead = `אם סיימת לאכול בשר ב־${hm}, ${base.evidence} עוברות ב־${formatHM(until)}${dayNote(until, now)}; ב־${formatHM(target)} – מותר (לפי התשובה המאומתת).`;
    else if (need && target >= need) lead = `אם סיימת לאכול בשר ב־${hm}, ב־${formatHM(target)} עוד לא עברו שש שעות (זה ב־${formatHM(full)}), אבל עברו ${rule.variants.need.evidence}: לפי התשובה המאומתת, במקום צורך – מותר.`;
    else lead = `אם סיימת לאכול בשר ב־${hm}, ב־${formatHM(target)} עוד לא עבר הזמן: ${base.evidence} מסתיימות ב־${formatHM(until)}${need ? `, ובמקום צורך (${rule.variants.need.evidence}) ב־${formatHM(need)}` : ''}.`;
    const mainEntryId = need && target < until && target >= need ? rule.variants.need.entryId : base.entryId;
    return { verdict, at: when, response: answer(rule, lead, { mainEntryId, moreEntryIds: [rule.entryId, rule.note.entryId, ...(need ? [rule.variants.need.entryId] : [])], who, calc: { ...calc, target: formatHM(target) } }) };
  }
  if (needWords && !who) {
    const need = addMinutes(when, rule.variants.need.minutes);
    const lead = `במקום צורך, לפי התשובה המאומתת (${rule.variants.need.evidence}): אם סיימת לאכול בשר ב־${hm}, אפשר מאכלי חלב מ־${formatHM(need)}${dayNote(need, now)}. לכתחילה – שש שעות, מ־${formatHM(addMinutes(when, rule.minutes))}.`;
    return { verdict: need <= now ? 'open-now' : 'wait', at: when, response: answer(rule, lead, { mainEntryId: rule.variants.need.entryId, moreEntryIds: [rule.entryId, rule.note.entryId], who, calc: { ...calc, minutes: rule.variants.need.minutes, result: formatHM(need) } }) };
  }
  const lead = base.key === 'sick'
    ? `לחולה, לפי התשובה המאומתת (${base.evidence} אחרי אכילת בשר): אם סיים לאכול בשר ב־${hm}, אפשר מאכלי חלב מ־${formatHM(until)}${dayNote(until, now)} – ${status}`
    : `אם סיימת לאכול בשר ב־${hm}, לפי התשובה המאומתת (${base.evidence}${base.key === 'cooked' ? '' : ' מסיום אכילת הבשר'}), אפשר לאכול מאכלי חלב מ־${formatHM(until)}${dayNote(until, now)} – ${status}`;
  const notes = ['הספירה היא מסיום אכילת הבשר, לא מתחילת הסעודה או מברכת המזון.'];
  if (!who && rule.variants?.need && base.key !== 'cooked') notes.push(`במקום צורך, לפי תשובה מאומתת נוספת: אחרי ${rule.variants.need.evidence} – מ־${formatHM(addMinutes(when, rule.variants.need.minutes))}.`);
  return { verdict, at: when, response: answer(rule, lead, { mainEntryId: base.entryId, moreEntryIds: [...(base.key ? [rule.entryId] : []), rule.note.entryId, ...(!who && base.key !== 'cooked' ? [rule.variants.need.entryId] : [])], notes, who, calc }) };
}

// "אכלתי בשר אתמול בערב": if even the latest moment of that period is long enough ago, the answer is clear; otherwise
// the exact time is needed.
function fromPeriod(rule, period, ctx) {
  const { text, who, now } = ctx;
  if (rule.kind !== 'wait') return null;
  const base = waitBase(rule, text, who);
  const latest = addMinutes(period.to, base.minutes);
  if (latest <= now) return { response: answer(rule, `גם אם סיימת לאכול בשר בסוף הזמן הזה (${period.yesterday ? 'אתמול ' : ''}${period.label}), כבר עברו ${base.evidence} – מותר עכשיו (לפי התשובה המאומתת).`, { mainEntryId: base.entryId, moreEntryIds: [rule.note.entryId], who, calc: { period: period.label, minutes: base.minutes, open: true } }), active: null };
  return ask(rule, 'באיזו שעה בערך סיימת לאכול את הבשר?', [], { kind: 'rule', ruleId: rule.id, awaiting: 'time', who, text }, { lead: `לפי התשובה המאומתת מחכים ${base.evidence} מסיום אכילת הבשר, ואם זה היה ${period.label} ייתכן שעוד לא עברו.`, entryIds: [base.entryId, rule.note.entryId] });
}

function zmanOffset(rule, { text, now, env, via }) {
  const times = env.times || {};
  const active = env.active || new Set();
  if (rule.onlyWhen && !active.has(rule.onlyWhen)) return null;
  if (rule.onlyWeekday !== undefined && env.context?.weekday !== rule.onlyWeekday) return null;
  const variant = Object.values(rule.variants || {}).find(item => item.words?.test(text));
  const base = variant || rule;
  const zman = times[base.zman || rule.zman];
  if (!(zman instanceof Date)) return null;
  const at = addMinutes(zman, base.minutes);
  // A stated clock time ("ואם אתחיל רק ב-16:50?") is the moment checked; otherwise now.
  const stated = extractTimes(text).find(item => item.fact.kind === 'clock');
  const moment = stated ? eventCandidates(stated.fact, now, 'if').sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0] : now;
  const momentLabel = stated ? `ב־${formatHM(moment)}` : `עכשיו (${formatHM(now)})`;
  const notes = [];
  if (!variant && rule.variants) for (const other of Object.values(rule.variants)) notes.push(`${other.words?.source.includes('צורך') ? 'במקום צורך' : 'למי שממהר לעבודתו'} (${other.evidence}): ${formatHM(addMinutes(times[other.zman || rule.zman] || zman, other.minutes))}.`);
  let status = '';
  if (rule.compare === 'from') status = moment >= at ? `${momentLabel} – כבר אפשר.` : `${momentLabel} – עוד לא; מ־${formatHM(at)}.`;
  if (rule.compare === 'until') status = moment <= at ? `${momentLabel} – עוד בזמן.` : `${momentLabel} – הזמן הזה כבר עבר.`;
  if (rule.compare === 'window' && rule.earliest && times[rule.earliest.zman] instanceof Date) {
    const earliest = addMinutes(times[rule.earliest.zman], rule.earliest.minutes);
    notes.push(`לא מדליקים לפני ${formatHM(earliest)} (${rule.earliest.evidence}).`);
    if (via !== 'words' || /עכשיו|כבר/.test(text)) status = moment < earliest ? `${momentLabel} – מוקדם מדי: אפשר להדליק רק מ־${formatHM(earliest)}.` : moment <= at ? `${momentLabel} – אפשר להדליק.` : '';
  }
  const zmanLabel = { sunset: 'השקיעה', sunrise: 'הנץ', alotHaShachar: 'עלות השחר', tzeit85deg: 'צאת הכוכבים' }[base.zman || rule.zman];
  const lead = `היום, ${rule.label}: ${rule.compare === 'until' ? 'עד ' : rule.compare === 'from' ? 'מ־' : ''}${formatHM(at)} (${base.evidence}; ${zmanLabel} במקומך ב־${formatHM(zman)}).${status ? ` ${status}` : ''}`;
  return { response: answer(rule, lead, { mainEntryId: base.entryId, moreEntryIds: rule.earliest ? [rule.earliest.entryId] : [], notes, calc: { zman: base.zman || rule.zman, minutes: base.minutes, result: formatHM(at) } }), active: null };
}

// "לא ספרתי ונזכרתי עכשיו": the verified case depends only on when "now" is — still the night, already day, or a
// whole night and day have passed.
function omerStatus(rule, { text, now, env }) {
  if (rule.onlyWhen && !(env.active || new Set()).has(rule.onlyWhen)) return null;
  const times = env.times || {};
  const alot = times.alotHaShachar, sunset = times.sunset;
  if (!(alot instanceof Date) || !(sunset instanceof Date)) return null;
  const whole = /וגם לא (?:היום|ביום)|כל היום|גם ביום|לילה ויום/.test(text) || (now >= sunset && /אתמול/.test(text));
  if (whole) return { response: answer(rule, `עבר לילה ויום שלם בלי ספירה. לפי התשובה המאומתת: ${rule.whole.evidence}.`, { mainEntryId: rule.whole.entryId, calc: { case: 'whole' } }), active: null };
  if (now < alot) return { response: answer(rule, `עכשיו ${formatHM(now)}, עוד לפני עלות השחר (${formatHM(alot)}) – עדיין אותו לילה. לפי התשובה המאומתת: ${rule.night.evidence}; אפשר לספור עד ${formatHM(alot)}.`, { mainEntryId: rule.night.entryId, moreEntryIds: [rule.entryId], calc: { case: 'night', until: formatHM(alot) } }), active: null };
  if (now < sunset) return { response: answer(rule, `עכשיו ${formatHM(now)} – כבר יום. לפי התשובה המאומתת: ${rule.day.evidence}. עד השקיעה (${formatHM(sunset)}).`, { mainEntryId: rule.day.entryId, calc: { case: 'day', until: formatHM(sunset) } }), active: null };
  return null;
}
