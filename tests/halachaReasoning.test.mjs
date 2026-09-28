// Stage 4 — basic coverage audit and deterministic reasoning. Regression tests for the two reported failures
// ("מתי אומרים הלל" answered by an unrelated source; the meat/milk follow-up that returned "insufficient"), the fact
// extractor, the structured rules (every number tied to words in its verified entry), and the measured thresholds of
// the coverage (448 questions) and conversation (120 scenarios) evaluations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PRACTICAL_HALACHA_QA_INDEX } from '../src/data/practicalHalachaQa.mjs';
import { HALACHA_RULES } from '../src/data/halachaRules.mjs';
import { HALACHA_CONCEPTS, FIXED_ROUTES } from '../src/data/halachaConcepts.mjs';
import { extractTimes, extractTime, extractPeriod, eventCandidates, extractDuration, extractWho } from '../src/services/halachaFacts.mjs';
import { newConversation, respond } from '../src/services/ai/halachaConversation.mjs';
import { coverageContext, COVERAGE_TIMES, runCoverage } from '../scripts/halacha/coverage.mjs';
import { runConversations, scenarioEnv } from '../scripts/halacha/conversations.mjs';
import { readFileSync } from 'node:fs';

const at = hm => new Date(`2026-11-03T${hm}:00`);
const weekday = (now = '14:00') => ({ context: coverageContext(at('12:00')), times: COVERAGE_TIMES, now: at(now) });
async function talk(lines, env) {
  let conversation = newConversation();
  const out = [];
  for (const line of lines) { const result = await respond(conversation, line, env); conversation = result.conversation; out.push(result.response); }
  return out;
}
const entryText = id => { const entry = PRACTICAL_HALACHA_QA_INDEX[id]; return [entry?.shortAnswer, entry?.answer, ...(entry?.sources || []).map(source => source.excerpt), ...(entry?.extraSources || []).map(source => source.excerpt)].filter(Boolean).join(' '); };

// ---- Hallel: the reported failure ----
test('"מתי אומרים הלל" is answered by the verified Hallel entries, never by an unrelated source', async () => {
  for (const question of ['מתי אומרים הלל', 'מתי אומרים הלל?', 'באילו ימים אומרים הלל?', 'באילו ימים גומרים את ההלל?']) {
    const [response] = await talk([question], weekday());
    assert.notEqual(response.type, 'sources_only', question);
    assert.equal(response.entryIds[0], 'hal-basic-hallel-full-or-no-bracha', question);
    assert.ok(response.entryIds.every(id => /hallel/.test(id)), `${question}: ${response.entryIds}`);
  }
  const [rc] = await talk(['איזה הלל אומרים בראש חודש?'], weekday());
  assert.ok(rc.entryIds.includes('hal-basic-hallel-rosh-chodesh-dilug'));
});

test('"אומרים היום הלל?" is a calendar answer with the verified entry for the day', async () => {
  const rc = scenarioEnv('rosh-chodesh', '08:00');
  const [response] = await talk(['אומרים היום הלל?'], rc);
  assert.equal(response.today?.kind, 'hallel');
  assert.match(response.text, /הלל/);
  assert.ok(response.entryIds.includes('hal-basic-hallel-rosh-chodesh-dilug'));
});

test('concepts and fixed routes name only verified entries', () => {
  for (const concept of HALACHA_CONCEPTS) for (const id of [concept.overview, ...concept.occasions]) assert.ok(PRACTICAL_HALACHA_QA_INDEX[id], `${concept.id}: ${id}`);
  for (const route of FIXED_ROUTES) for (const id of route.entries) assert.ok(PRACTICAL_HALACHA_QA_INDEX[id], `${route.id}: ${id}`);
});

// ---- Meat and milk: the reported failure ----
test('meat → dairy: the rule, then "אם אכלתי בשלוש" asks which three, then computes', async () => {
  const [rule, ask, result] = await talk(['כמה זמן מחכים בין בשר לחלב?', 'אם אכלתי בשלוש מתי מותר לי לאכול חלב', 'אחר הצהריים'], weekday('14:00'));
  assert.equal(rule.entryIds[0], 'hal-bayit-six-hours-meat-to-dairy');
  assert.equal(ask.type, 'clarification');
  assert.match(ask.clarification.question, /03:00/);
  assert.match(ask.clarification.question, /15:00/);
  assert.equal(result.type, 'answer');
  assert.match(result.text, /21:00/);
  assert.equal(result.entryIds[0], 'hal-bayit-six-hours-meat-to-dairy');
});

test('meat → dairy: explicit times, relative times, a planned time, need, sick and child', async () => {
  const cases = [
    ['סיימתי בשר ב-13:00, מתי חלבי?', '15:00', /19:00/, 'hal-bayit-six-hours-meat-to-dairy'],
    ['אכלתי המבורגר לפני שעתיים, מתי מותר פיצה?', '16:10', /20:10/, 'hal-bayit-six-hours-meat-to-dairy'],
    ['אכלתי בשר ב-23:30, מתי חלב?', '02:00', /05:30/, 'hal-bayit-six-hours-meat-to-dairy'],
    ['סיימתי בשר ב-13:00 ויש לי אירוע חלבי חשוב ב-18:30. אני יכול לאכול שם?', '18:00', /18:30/, 'hal-bayit-five-and-half-hours'],
    ['אני חולה, סיימתי בשר ב-12:15, מתי מותר חלבי?', '13:00', /13:15/, 'hal-bayit-sick-one-hour'],
    ['הבן שלי בן 8 אכל בשר ב-13:00 ועכשיו רוצה ארטיק חלבי, מותר?', '15:30', /19:00/, 'hal-bayit-children-wait-meat-dairy'],
  ];
  for (const [question, now, time, entry] of cases) {
    const [response] = await talk([question], { ...weekday(now), now: new Date(`2026-11-0${now < '03:00' ? 4 : 3}T${now}:00`) });
    assert.equal(response.type, 'answer', question);
    assert.match(response.text, time, question);
    assert.equal(response.entryIds[0], entry, question);
  }
});

test('meat → dairy: the wrong direction and other subjects are not the six hours', async () => {
  for (const [question, entry] of [
    ['אכלתי טוסט גבינה ב-12:00, מתי מותר לי בשר?', 'hal-bayit-meat-after-cheese'],
    ['שתיתי קפה עם חלב ב-11:30, כמה צריך לחכות לפני בשר?', 'hal-bayit-milk-drink-then-meat'],
    ['טעמתי את הרוטב של החמין ופלטתי. מותר לי עכשיו גבינה?', 'hal-bayit-tasting-meat-spit'],
  ]) {
    const [response] = await talk([question], weekday('12:30'));
    assert.equal(response.entryIds[0], entry, question);
    assert.ok(!response.calc, question);
  }
  const [utensil] = await talk(['שמתי כפית חלבית בסיר בשרי'], weekday());
  assert.ok(!utensil.ruleId);
});

test('a follow-up keeps the subject: "ושוקולד חלבי?", "ואם אני חולה?", "מה המקור?"', async () => {
  const [, chocolate] = await talk(['הבן שלי בן 7 אכל שניצל ב-12:30. אפשר לתת לו יוגורט בארוחת הערב ב-17:00?', 'ושוקולד חלבי?'], weekday('13:00'));
  assert.match(chocolate.text, /18:30/);
  const [, sick] = await talk(['אכלתי ב-11:50 בשר, מתי חלבי?', 'ואם אני חולה?'], weekday('12:30'));
  assert.match(sick.text, /12:50/);
  assert.equal(sick.entryIds[0], 'hal-bayit-sick-one-hour');
  const [, source] = await talk(['אכלתי בשר ב-13:00, מתי חלבי?', 'מה המקור?'], weekday('15:00'));
  assert.equal(source.type, 'sources_only');
  assert.ok(source.entryIds.includes('hal-bayit-six-hours-meat-to-dairy'));
});

test('a vague time is asked about, never guessed: periods and impossible times', async () => {
  const [late] = await talk(['אכלתי בשר אתמול בערב, מותר לי עכשיו חלב?'], { ...weekday('02:00'), now: new Date('2026-11-04T02:00:00') });
  assert.equal(late.type, 'clarification');
  const [clear] = await talk(['אכלתי בשר אתמול בערב. מותר לי עכשיו קפה עם חלב?'], { ...weekday('07:00'), now: new Date('2026-11-04T07:00:00') });
  assert.equal(clear.type, 'answer');
  const [bad] = await talk(['אכלתי בשר ב-25:00, מתי חלבי?'], weekday());
  assert.equal(bad.type, 'clarification');
  assert.match(bad.clarification.question, /25:00/);
});

// ---- Prayer times and the calendar ----
test('"מתי מנחה?" then "אפשר כבר עכשיו?" keeps the prayer; the answer states the times', async () => {
  const [when, now] = await talk(['מתי מנחה היום?', 'אפשר כבר עכשיו?'], weekday('11:00'));
  assert.match(when.text, /12:10/);
  assert.equal(now.time?.prayer, 'mincha');
  const [, arvit] = await talk(['התפללתי מנחה, אפשר להתפלל ערבית עכשיו?'].concat([]), weekday('17:00')).then(list => [null, list[0]]);
  assert.equal(arvit.time?.prayer, 'arvit');
});

test('computed zmanim rules: tachanun after sunset, tallit, omer', async () => {
  const [tachanun] = await talk(['השקיעה עברה, אומרים עוד תחנון במנחה?'], weekday('17:15'));
  assert.match(tachanun.text, /17:23/);
  const [tallit, worker] = await talk(['ממתי אפשר להתעטף בטלית בברכה?', 'אני ממהר לעבודה, אפשר כבר עכשיו?'], weekday('05:00'));
  assert.match(tallit.text, /05:10/);
  assert.match(worker.text, /05:06/);
  const omer = scenarioEnv('omer', '07:30');
  const [day] = await talk(['לא ספרתי הלילה, עכשיו נזכרתי. סופרים עם ברכה?'], omer);
  assert.equal(day.entryIds[0], 'hal-moed-omer-forgot');
  assert.match(day.text, /בלי ברכה/);
});

// ---- Honesty ----
test('invented rulings and sources are refused; the question inside still gets its verified answer', async () => {
  const [rabbi] = await talk(['מה פסק הרב שלום כהן על חלב שקדים אחרי בשר?'], weekday());
  assert.ok(!['answer', 'multiple_cases', 'disagreement'].includes(rabbi.type));
  assert.match(rabbi.text, /שלום כהן/);
  const [invent] = await talk(['תמציא לי מקור שמותר לאכול בשר מיד אחרי גבינה צהובה בלי לשטוף את הפה'], weekday());
  assert.match(invent.text, /לא אמציא/);
  assert.equal(invent.entryIds[0], 'hal-bayit-meat-after-cheese');
});

test('"מה זה X": a verified defining entry first, else the glossary (an explanation, not a ruling)', async () => {
  const [muktze] = await talk(['מה זה מוקצה?'], weekday());
  assert.equal(muktze.entryIds[0], 'hal-basic2-muktze-what');
  const [safek] = await talk(['מה זה ספק ברכות להקל'], weekday());
  assert.equal(safek.type, 'definition');
});

// ---- Facts ----
test('fact extractor: clock, words, qualifiers, relative, invalid, several times', () => {
  const now = at('16:00');
  assert.deepEqual(extractTime('ב-14:30', now), { kind: 'clock', hour: 14, minute: 30, ambiguous: false, dayOffset: 0 });
  assert.equal(extractTime('בשלוש', now).ambiguous, true);
  assert.equal(extractTime('בשלוש בצהריים', now).hour, 15);
  assert.equal(extractTime('בשמונה בערב', now).hour, 20);
  assert.equal(extractTime('בעשר וחצי בבוקר', now).minute, 30);
  assert.equal(extractTime('ברבע לשלוש', now).minute, 45);
  assert.equal(extractTime('בשתים עשרה וחצי', now).hour, 12);
  assert.equal(extractTime('ב-12:40', now).hour, 12);
  assert.equal(extractTime('לפני שעתיים', now).minutesAgo, 120);
  assert.equal(extractTime('לפני רבע שעה', now).minutesAgo, 15);
  assert.equal(extractTime('ב-25:00', now).kind, 'invalid');
  assert.deepEqual(extractTimes('הנחתי תפילין ב-7:00 ואכלתי בשר ב-12:00').map(item => item.fact.hour), [7, 12]);
  assert.equal(extractPeriod('אתמול בערב', now).label, 'בערב');
  assert.equal(extractDuration('נסיעה של שעה וחצי'), 90);
  assert.equal(extractDuration('תוך 5 דקות'), 5);
  assert.equal(extractWho('הבן שלי בן 7 אכל'), 'child');
  assert.equal(extractWho('יש לי שפעת'), 'sick');
});

test('ambiguous event times: a later reading of a past event is dropped by day, kept just after midnight', () => {
  const three = extractTime('אכלתי בשלוש');
  assert.equal(eventCandidates(three, at('09:00'), 'past').length, 1);
  assert.equal(eventCandidates(three, new Date('2026-11-03T04:30:00'), 'past').length, 2);
  assert.equal(eventCandidates(three, at('16:00'), 'past').length, 2);
  assert.equal(eventCandidates(three, at('14:00'), 'if').length, 2);
});

// ---- Rules: every number is in its verified entry ----
test('every structured rule states its number in the words of its verified entry', () => {
  for (const rule of HALACHA_RULES) {
    const check = (id, phrase, where) => { if (id && phrase) assert.ok(entryText(id).includes(phrase), `${rule.id}${where}: "${phrase}" not in ${id}`); };
    assert.ok(PRACTICAL_HALACHA_QA_INDEX[rule.entryId], `${rule.id}: ${rule.entryId}`);
    check(rule.entryId, rule.evidence, '');
    for (const [key, variant] of Object.entries(rule.variants || {})) { check(variant.entryId, variant.evidence, `.${key}`); check(variant.entryId, variant.sweetsEvidence, `.${key}.sweets`); }
    if (rule.note) check(rule.note.entryId, rule.note.evidence, '.note');
    if (rule.earliest) check(rule.earliest.entryId, rule.earliest.evidence, '.earliest');
    if (rule.conditionEvidence) check(rule.entryId, rule.conditionEvidence, '.condition');
    for (const key of ['night', 'day', 'whole']) if (rule[key]) check(rule[key].entryId, rule[key].evidence, `.${key}`);
    if (rule.beyond?.evidence) check(rule.beyond.entryId, rule.beyond.evidence, '.beyond');
    for (const id of rule.topicEntries || []) assert.ok(PRACTICAL_HALACHA_QA_INDEX[id], `${rule.id}: ${id}`);
  }
});

// ---- Measured thresholds (the audit's numbers must not regress) ----
test('coverage audit (448 basic questions): wrong retrieval stays rare, verified answers stay the majority', async () => {
  const items = JSON.parse(readFileSync(new URL('./fixtures/halachaCoverage.json', import.meta.url), 'utf8'));
  assert.ok(items.length >= 300 && items.length <= 500);
  const { totals } = await runCoverage(items, { context: coverageContext(), times: COVERAGE_TIMES, now: at('14:00') });
  assert.ok((totals.WRONG || 0) <= 18, `WRONG ${totals.WRONG}`);
  assert.ok((totals.PASS || 0) >= 295, `PASS ${totals.PASS}`);
});

test('conversation evaluation (120 multi-turn scenarios): no failed calculation or extraction', async () => {
  const scenarios = JSON.parse(readFileSync(new URL('./fixtures/halachaConversations.json', import.meta.url), 'utf8'));
  assert.ok(scenarios.length >= 100);
  const { summary } = await runConversations(scenarios);
  assert.equal(summary.failures.FAILED_CALCULATION || 0, 0);
  assert.equal(summary.failures.FAILED_EXTRACTION || 0, 0);
  assert.ok(summary.passed >= 104, `passed ${summary.passed}`);
});

// ---- Calendar Torah reading: Chol HaMoed Sukkot per SA OC 663:1 ----
test('calendar reading on Chol HaMoed Sukkot: in Israel only the day\'s offering; Shabbat keeps its own reading', async () => {
  const { correctCalendarLeyning } = await import('../src/services/prayer/festivalReadings.mjs');
  const hebcal = { title: 'Sukkot III (CH’’M)', leyning: { torah: 'Numbers 29:20-28, 29:20-25' } };
  assert.equal(correctCalendarLeyning(hebcal, { israel: true }).leyning.torah, 'Numbers 29:20-22');
  assert.equal(correctCalendarLeyning({ title: 'Sukkot VII (Hoshana Raba)', leyning: { torah: 'Numbers 29:26-34' } }, { israel: true }).leyning.torah, 'Numbers 29:32-34');
  assert.equal(correctCalendarLeyning(hebcal, { israel: false }).leyning.torah, 'Numbers 29:17-19, 29:20-22, 29:17-22');
  const shabbat = { title: 'Sukkot IV (CH’’M)', leyning: { torah: 'Exodus 33:12-34:26; Numbers 29:23-28' } };
  assert.equal(correctCalendarLeyning(shabbat, { israel: true }), shabbat);
  const pesach = { title: 'Pesach III (CH’’M)', leyning: { torah: 'Exodus 22:24-23:19; Numbers 28:19-25' } };
  assert.equal(correctCalendarLeyning(pesach, { israel: true }), pesach);
});
