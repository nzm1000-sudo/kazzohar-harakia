import test from 'node:test';
import assert from 'node:assert/strict';
import { HALACHA_FLOWS, HALACHA_FLOW_INDEX, QUICK_SITUATIONS } from '../src/data/halachaFlows.mjs';
import { CONTEXT_GUIDES } from '../src/data/halachaContextGuides.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../src/data/practicalHalachaQa.mjs';
import { validateFlows, walkFlow, matchFlow, rabbiQuestionDraft, flowEntryIds } from '../src/services/halachaDecision.mjs';
import { guideForNow } from '../src/services/halachaEngine.mjs';
import { routeHalachaQuery } from '../src/services/halachaIntent.mjs';
import { HALACHA_EVAL } from './fixtures/halachaEval.mjs';

test('every flow is complete: no dead ends, no unreachable steps, outcomes are published entries or a rabbi route', () => {
  assert.deepEqual(validateFlows(), []);
});

test('every path through every flow ends in an answer, an honest rabbi route, or an existing flow', () => {
  for (const flow of HALACHA_FLOWS) {
    const stack = [[]];
    let endings = 0;
    while (stack.length) {
      const path = stack.pop();
      assert.ok(path.length < 8, `${flow.id}: path too deep (loop?)`);
      const state = walkFlow(flow.id, path);
      if (state.handoff) { assert.ok(HALACHA_FLOW_INDEX[state.handoff], `${flow.id}: handoff ${state.handoff}`); endings++; continue; }
      if (state.outcome) {
        assert.ok(state.outcome.entries.length || state.outcome.rabbi, `${flow.id} ${path}: empty outcome`);
        for (const entry of state.outcome.entries) assert.equal(entry.answerStatus, 'published');
        endings++;
        continue;
      }
      assert.ok(state.step, `${flow.id} ${path}: no step`);
      state.step.options.forEach((_, index) => stack.push([...path, index]));
    }
    assert.ok(endings > 0, flow.id);
  }
});

test('the rabbi route is honest: it says no verified answer exists and offers a draft', () => {
  const state = walkFlow('meat-dairy', [2, 6, 1]);
  assert.equal(state.outcome.rabbi, true);
  assert.equal(state.outcome.entries.length, 0);
  assert.ok(state.outcome.sources.length);
  const draft = rabbiQuestionDraft({ topic: state.flow.title, trail: state.trail, sources: state.outcome.sources, details: 'הסיר היה על האש' });
  assert.match(draft, /הנושא: בשר וחלב/);
  assert.match(draft, /מה היה בסיר, ומתי השתמשו בכלים\? מקרה אחר/);
  assert.match(draft, /הסיר היה על האש/);
  assert.match(draft, /ילקוט יוסף, סימן צ', סעיף ט״ז/);
});

test('closed gaps route to verified entries, and a disputed case says so', () => {
  assert.deepEqual(walkFlow('omer', [3]).outcome.entries.map(entry => entry.id), ['hal-moed-omer-doubt']);
  assert.deepEqual(walkFlow('yaaleh-veyavo', [0, 1]).outcome.entries.map(entry => entry.id), ['hal-moed-chm-yaale-amida']);
  const mezonot = walkFlow('bracha-mistake', [0, 2]).outcome;
  assert.equal(mezonot.disagreement, true);
  assert.equal(mezonot.entries[0].ruleType, 'machloket');
});

test('walking with an out-of-range answer stops safely at the current step', () => {
  const state = walkFlow('yaaleh-veyavo', [9]);
  assert.equal(state.stepId, 'where');
  assert.equal(walkFlow('no-such-flow'), null);
});

test('quick situations and guides point only at real flows and published entries', () => {
  for (const id of QUICK_SITUATIONS) assert.ok(HALACHA_FLOW_INDEX[id], id);
  for (const guide of CONTEXT_GUIDES) for (const step of guide.steps) {
    assert.ok(step.entryIds.length, `${guide.id}/${step.label}`);
    for (const id of step.entryIds) assert.equal(PRACTICAL_HALACHA_QA_INDEX[id]?.answerStatus, 'published', `${guide.id}: ${id}`);
    if (step.flowId) assert.ok(HALACHA_FLOW_INDEX[step.flowId], `${guide.id}: flow ${step.flowId}`);
  }
});

test('the guide for now follows the day: Friday, motzei Shabbat, Chol HaMoed Sukkot, Tisha b\'Av before a plain fast', () => {
  const day = (month, dayOfMonth, weekday, extra = {}) => guideForNow({ hebrewDate: { day: dayOfMonth, month, year: 5787 }, weekday, isIsrael: true, ...extra }, new Date('2026-10-01T09:00:00'));
  assert.equal(day(8, 12, 5).id, 'erev-shabbat');
  assert.equal(day(8, 11, 4), null, 'Thursday has no Friday guide');
  assert.equal(day(8, 13, 0, { afterSunset: true }).id, 'motzei-shabbat');
  assert.equal(day(7, 17, 1, { isCholHaMoed: true }).id, 'sukkot');
  assert.equal(day(5, 9, 0, { fast: true }).id, 'tisha-bav');
  assert.equal(day(4, 17, 2, { fast: true }).id, 'fast-day');
  assert.equal(day(8, 20, 2), null, 'an ordinary Cheshvan Tuesday has no curated guide');
});

test('flow matching: exclusions keep Chanukah candles out of the Shabbat candles flow', () => {
  assert.equal(matchFlow('איך מדליקים נרות שבת'), HALACHA_FLOW_INDEX['shabbat-candles']);
  assert.equal(matchFlow('הדלקת נרות חנוכה'), null);
  assert.ok(flowEntryIds(HALACHA_FLOW_INDEX['prayer-forgot']).has('qa-yaaleh-veyavo'), 'hand-off flows count toward coverage');
});

test('evaluation set: natural questions reach the right experience', () => {
  const failures = [];
  for (const item of HALACHA_EVAL) {
    const route = routeHalachaQuery(item.q);
    const { intent, flow, answer, top } = item.expect;
    if (intent && route.intent !== intent) failures.push(`${item.q}: intent ${route.intent} ≠ ${intent}`);
    if (flow && route.flow?.id !== flow) failures.push(`${item.q}: flow ${route.flow?.id} ≠ ${flow}`);
    if (answer && route.answer?.id !== answer) failures.push(`${item.q}: answer ${route.answer?.id} ≠ ${answer}`);
    if (top && !top.includes(route.results.questions[0]?.id)) failures.push(`${item.q}: top ${route.results.questions[0]?.id} ∉ ${top}`);
  }
  assert.deepEqual(failures, []);
});
