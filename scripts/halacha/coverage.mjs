// Basic Halacha coverage: every question in tests/fixtures/halachaCoverage.json is sent to the same conversation engine
// the app uses, and the first reply is classified against the labels (written by independent labellers):
//   PASS          – leads with a verified entry that answers the question (or the right calendar answer for "today")
//   PARTIAL       – the answer is present but not first, or a relevant-but-incomplete entry, or a flow that reaches it
//   WRONG         – confidently shows entries that do not answer the question
//   MISSED        – a verified answer exists, but the engine said it has none
//   GAP           – no verified answer exists, and the engine did not pretend otherwise (it may offer clearly
//                   labelled related halachot)
//   CLARIFICATION – the question genuinely needs one more fact, and the engine asked for it
// Usage: node scripts/halacha/coverage.mjs [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../../', import.meta.url).pathname;
const { respond, newConversation } = await import(`${ROOT}src/services/ai/halachaConversation.mjs`);
const { flowEntryIds } = await import(`${ROOT}src/services/halachaDecision.mjs`);
const { HALACHA_FLOW_INDEX } = await import(`${ROOT}src/data/halachaFlows.mjs`);
const { JewishContextEngine } = await import(`${ROOT}src/services/jewishContextEngine.mjs`);

const d = h => new Date(`2026-11-03T${h}:00`);
export const COVERAGE_TIMES = { alotHaShachar: d('05:00'), misheyakir: d('05:25'), sunrise: d('06:10'), sofZmanShmaMGA: d('08:35'), sofZmanShma: d('09:11'), sofZmanTfilla: d('10:04'), chatzot: d('11:40'), minchaGedola: d('12:10'), plagHaMincha: d('15:55'), sunset: d('17:10'), tzeit85deg: d('17:32') };
export function coverageContext(now = d('14:00')) {
  const engine = JewishContextEngine({ now, settings: { il: true, location: { tzid: 'Asia/Jerusalem' } } });
  return { ...engine, weekday: now.getDay() };
}

export async function classify(item, env) {
  const { response } = await respond(newConversation(), item.q, env);
  const ids = response.entryIds || [];
  const accept = new Set(item.acceptIds || []);
  const partial = new Set(item.partialIds || []);
  const confident = ['answer', 'disagreement', 'multiple_cases'].includes(response.type) && ids.length;
  const reaches = flowId => { const flow = HALACHA_FLOW_INDEX[flowId]; return flow ? [...flowEntryIds(flow)] : []; };
  let result;
  if (item.expect === 'today') {
    if (response.today?.kind === item.today) result = 'PASS';
    else if (ids.some(id => accept.has(id) || partial.has(id))) result = 'PARTIAL';
    else result = confident ? 'WRONG' : 'MISSED';
  } else if (item.expect === 'clarify') {
    if (response.type === 'clarification') result = (item.acceptFlows || []).length && response.flow && !(item.acceptFlows || []).includes(response.flow.id) && !reaches(response.flow.id).some(id => accept.has(id)) ? 'WRONG' : 'CLARIFICATION';
    else if (ids.some(id => accept.has(id))) result = 'PASS';
    else if (ids.some(id => partial.has(id))) result = 'PARTIAL';
    else result = confident ? 'WRONG' : 'MISSED';
  } else if (response.type === 'related' || response.type === 'definition') {
    // Clearly labelled "related, not the answer" (or a term explanation): never counted as a confident answer.
    result = ids.some(id => accept.has(id) || partial.has(id)) ? 'PARTIAL' : item.expect === 'gap' ? 'GAP' : 'MISSED';
  } else if (item.expect === 'answer') {
    if (confident && accept.has(ids[0])) result = 'PASS';
    else if (confident && ids.some(id => accept.has(id) || partial.has(id))) result = 'PARTIAL';
    else if (response.type === 'sources_only' && ids.some(id => accept.has(id))) result = 'PARTIAL';
    else if (response.type === 'clarification') result = response.flow && (reaches(response.flow.id).some(id => accept.has(id)) || (item.acceptFlows || []).includes(response.flow.id)) ? 'PARTIAL' : response.flow ? 'WRONG' : 'MISSED';
    else result = confident ? 'WRONG' : 'MISSED';
  } else {
    if (confident && ids.some(id => partial.has(id))) result = 'PARTIAL';
    else if (confident) result = 'WRONG';
    else if (response.type === 'clarification' && response.flow && !(item.acceptFlows || []).includes(response.flow.id)) result = 'WRONG';
    else result = 'GAP';
  }
  return { q: item.q, category: item.category, expect: item.expect, result, type: response.type, entryIds: ids.slice(0, 3), flow: response.flow?.id || null, sources: response.sourceIds?.slice(0, 2) || [] };
}

export async function runCoverage(items, env) {
  const rows = [];
  for (const item of items) rows.push(await classify(item, env));
  const totals = {};
  const byCategory = {};
  for (const row of rows) {
    totals[row.result] = (totals[row.result] || 0) + 1;
    byCategory[row.category] ||= { questions: 0 };
    byCategory[row.category].questions++;
    byCategory[row.category][row.result] = (byCategory[row.category][row.result] || 0) + 1;
  }
  return { rows, totals, byCategory };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = JSON.parse(readFileSync(`${ROOT}tests/fixtures/halachaCoverage.json`, 'utf8'));
  const context = coverageContext();
  const report = await runCoverage(items, { context, times: COVERAGE_TIMES, now: d('14:00') });
  console.log(items.length, 'questions', report.totals);
  console.table(report.byCategory);
  const out = process.argv.indexOf('--json');
  if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify(report, null, 1));
}
