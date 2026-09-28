// Conversational reasoning evaluation: multi-turn scenarios (tests/fixtures/halachaConversations.json) run through the
// same conversation engine the app uses. A turn passes when the reply does what the scenario expects:
//   calc   – the reply contains the expected computed time and rests on an expected verified entry
//   answer – the reply leads with (or includes first) an expected verified entry
//   clarify– the reply asks for the missing fact
//   source – "מה המקור?" shows the expected entry's sources
//   gap    – no confident answer is invented
// Failures are classified: WRONG, LOST_CONTEXT, FAILED_EXTRACTION, FAILED_CALCULATION, SHOULD_CLARIFY.
import { readFileSync } from 'node:fs';
const ROOT = new URL('../../', import.meta.url).pathname;
const { respond, newConversation } = await import(`${ROOT}src/services/ai/halachaConversation.mjs`);
const { JewishContextEngine } = await import(`${ROOT}src/services/jewishContextEngine.mjs`);

const ENV_DATES = { weekday: '2026-11-03', 'rosh-chodesh': '2026-11-10', omer: '2027-04-27', friday: '2026-11-06' };
const ZMANIM = { alotHaShachar: '05:00', misheyakir: '05:25', sunrise: '06:10', sofZmanShmaMGA: '08:35', sofZmanShma: '09:11', sofZmanTfilla: '10:04', chatzot: '11:40', minchaGedola: '12:10', plagHaMincha: '15:55', sunset: '17:10', tzeit85deg: '17:32' };

export function scenarioEnv(envName, now) {
  const day = ENV_DATES[envName] || ENV_DATES.weekday;
  const at = hm => new Date(`${day}T${hm}:00`);
  const times = Object.fromEntries(Object.entries(ZMANIM).map(([key, hm]) => [key, at(hm)]));
  const nowDate = at(now || '12:00');
  const engine = JewishContextEngine({ now: at('12:00'), settings: { il: true, location: { tzid: 'Asia/Jerusalem' } } });
  return { context: { ...engine, weekday: at('12:00').getDay() }, times, now: nowDate };
}

const CONFIDENT = new Set(['answer', 'disagreement', 'multiple_cases']);
export function judgeTurn(expect, response, turnIndex) {
  const ids = response.entryIds || [];
  const wanted = expect.entryIds || [];
  const leads = wanted.length ? wanted.includes(ids[0]) || (ids.length && wanted.some(id => ids.slice(0, 2).includes(id))) : true;
  switch (expect.kind) {
    case 'calc': {
      const text = [response.text, ...(response.notes || [])].join(' ');
      if (text.includes(expect.time) && leads) return { pass: true };
      if (response.calc && !text.includes(expect.time)) return { pass: false, as: 'FAILED_CALCULATION' };
      if (response.type === 'clarification' && response.ruleId) return { pass: false, as: 'FAILED_EXTRACTION' };
      return { pass: false, as: turnIndex > 0 && !response.ruleId ? 'LOST_CONTEXT' : (expect.failAs || 'WRONG') };
    }
    case 'clarify':
      return response.type === 'clarification' ? { pass: true } : { pass: false, as: 'SHOULD_CLARIFY' };
    case 'source':
      return response.type === 'sources_only' && wanted.some(id => ids.includes(id)) ? { pass: true } : { pass: false, as: 'LOST_CONTEXT' };
    case 'gap':
      return CONFIDENT.has(response.type) && ids.length && response.confidence === 'direct' ? { pass: false, as: 'WRONG' } : { pass: true };
    default:
      if (CONFIDENT.has(response.type) && leads) return { pass: true };
      if (response.type === 'answer' && response.calc && leads) return { pass: true };
      return { pass: false, as: turnIndex > 0 && expect.failAs === 'LOST_CONTEXT' ? 'LOST_CONTEXT' : response.type === 'clarification' ? 'SHOULD_CLARIFY' : 'WRONG' };
  }
}

export async function runConversations(scenarios) {
  const results = [];
  for (const scenario of scenarios) {
    const env = scenarioEnv(scenario.env, scenario.now);
    let conversation = newConversation();
    const turns = [];
    for (const [index, turn] of scenario.turns.entries()) {
      const { conversation: next, response } = await respond(conversation, turn.say, env);
      conversation = next;
      turns.push({ say: turn.say, expect: turn.expect.kind, ...judgeTurn(turn.expect, response, index), got: { type: response.type, text: response.text, ids: (response.entryIds || []).slice(0, 3) } });
    }
    results.push({ id: scenario.id, class: scenario.class, pass: turns.every(turn => turn.pass), turns });
  }
  const summary = { scenarios: results.length, passed: results.filter(item => item.pass).length, turns: results.reduce((n, item) => n + item.turns.length, 0), turnsPassed: results.reduce((n, item) => n + item.turns.filter(turn => turn.pass).length, 0), failures: {}, byClass: {} };
  for (const item of results) {
    summary.byClass[item.class] ||= { scenarios: 0, passed: 0 };
    summary.byClass[item.class].scenarios++;
    if (item.pass) summary.byClass[item.class].passed++;
    for (const turn of item.turns) if (!turn.pass) summary.failures[turn.as] = (summary.failures[turn.as] || 0) + 1;
  }
  return { summary, results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const scenarios = JSON.parse(readFileSync(`${ROOT}tests/fixtures/halachaConversations.json`, 'utf8'));
  const { summary, results } = await runConversations(scenarios);
  console.log(JSON.stringify(summary, null, 1));
  if (process.argv.includes('--failures')) for (const item of results.filter(entry => !entry.pass)) for (const turn of item.turns.filter(entry => !entry.pass)) console.log(`${item.id} | ${turn.say} | ${turn.as} | ${turn.got.type} | ${String(turn.got.text).slice(0, 90)} | ${turn.got.ids.join(',')}`);
}
