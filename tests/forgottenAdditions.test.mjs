import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORGOTTEN_ADDITIONS, REVIEW_STATES, getTopic, isPractical, listForgottenTopics, resolvePath } from '../src/services/forgottenAdditions.mjs';
import { shabbatTableContent, shabbatTableParashaCount } from '../src/services/shabbatTable.mjs';

test('all five required forgotten-addition topics exist', () => {
  const ids = listForgottenTopics().map(topic => topic.id);
  assert.deepEqual(ids.sort(), ['al-hanissim', 'aneinu', 'mashiv-haruach', 'veten-tal-umatar', 'yaaleh-veyavo'].sort());
});

test('a decision tree only asks the questions needed to reach a branch', () => {
  const start = resolvePath('yaaleh-veyavo', []);
  assert.equal(start.current.text, 'באיזו תפילה שכחת?');
  assert.equal(start.outcome, null);

  const arvit = resolvePath('yaaleh-veyavo', [0, 0]);
  assert.ok(arvit.outcome, 'Arvit on Rosh Chodesh resolves in two questions');
  assert.equal(arvit.steps.length, 2);
  assert.equal(arvit.steps[0].answer, 'ערבית');

  const deeper = resolvePath('yaaleh-veyavo', [1, 0, 0]);
  assert.ok(deeper.outcome, 'Shacharit asks where and whether the seal was said');
  assert.equal(deeper.steps.length, 3);
  assert.match(deeper.steps[2].question, /שם ה׳/);
});

test('every outcome carries an exact source and a review status', () => {
  for (const topic of Object.values(FORGOTTEN_ADDITIONS)) {
    for (const node of Object.values(topic.nodes)) {
      for (const option of node.options) {
        if (!option.outcome) continue;
        assert.ok(option.outcome.source.primary, `${topic.id} missing primary source`);
        assert.ok(option.outcome.source.secondary, `${topic.id} missing secondary source`);
        assert.ok(Object.values(REVIEW_STATES).includes(option.outcome.reviewState));
        assert.ok(option.outcome.summary.length > 0);
      }
    }
  }
});

test('nothing below production-approved is presented as a practical ruling', () => {
  let outcomes = 0;
  for (const topic of Object.values(FORGOTTEN_ADDITIONS)) {
    for (const node of Object.values(topic.nodes)) {
      for (const option of node.options) {
        if (!option.outcome) continue;
        outcomes += 1;
        assert.equal(isPractical(option.outcome.reviewState), false, `${topic.id} must not auto-promote`);
      }
    }
  }
  assert.ok(outcomes > 10, 'the trees actually contain branches');
  assert.equal(isPractical(REVIEW_STATES.PRODUCTION_APPROVED), true);
  assert.equal(isPractical(REVIEW_STATES.SOURCE_VERIFIED), false);
  assert.equal(isPractical(REVIEW_STATES.HALACHICALLY_REVIEWED), false);
});

test('ambiguous branches are explicitly flagged for a rav', () => {
  const ambiguous = resolvePath('yaaleh-veyavo', [1, 2]);
  assert.equal(ambiguous.outcome.needsRav, true);
  assert.match(ambiguous.outcome.detail, /מורה הוראה/);
});

test('invalid topics and paths degrade instead of throwing', () => {
  assert.equal(getTopic('does-not-exist'), null);
  assert.deepEqual(resolvePath('does-not-exist', [0]), { topic: null, steps: [], current: null, outcome: null });
  const overrun = resolvePath('veten-tal-umatar', [99]);
  assert.equal(overrun.outcome, null);
  assert.ok(overrun.current, 'an unknown answer keeps the current question');
});

test('Shabbat table content is deterministic and source grounded', () => {
  assert.equal(shabbatTableParashaCount, 54, 'all parashot are covered');
  const content = shabbatTableContent('בראשית');
  assert.equal(content.summary.length > 0, true);
  assert.ok(content.familyQuestion);
  assert.ok(content.childQuestion);
  assert.ok(content.source.ref);
  assert.ok(content.source.text);
  assert.ok(content.quiz.question && content.quiz.answer);
  assert.deepEqual(shabbatTableContent('בראשית'), content, 'repeated lookups are identical');
});

test('Shabbat table handles prefixes, combined readings and missing data', () => {
  assert.equal(shabbatTableContent('פרשת נח').source.ref, 'בראשית ו׳, ט׳');
  assert.ok(shabbatTableContent('תזריע־מצורע'), 'combined readings fall back to an available half');
  assert.equal(shabbatTableContent('פרשה שאינה קיימת'), null);
  assert.equal(shabbatTableContent(null), null);
  assert.equal(shabbatTableContent(''), null);
});
