import test from 'node:test';
import assert from 'node:assert/strict';
import { PRACTICAL_HALACHA_QA, publishedPracticalQuestions } from '../src/data/practicalHalachaQa.mjs';
import { YALKUT_YOSEF } from '../src/data/yalkutYosef.mjs';
import { normalizeQuery, searchHalacha } from '../src/services/halachaSearch.mjs';

const localSourceIds = new Set(YALKUT_YOSEF.sections.map(section => section.id));

test('published practical answers pass the offline quality gate', () => {
  const ids = new Set(PRACTICAL_HALACHA_QA.map(item => item.id));
  const canonicalQuestions = new Set();

  for (const item of publishedPracticalQuestions()) {
    assert.equal(item.reviewStatus, 'verified', `${item.id} is not verified`);
    assert.equal(item.answerStatus, 'published', `${item.id} is not published`);
    assert.ok(item.shortAnswer.trim().length > 0 && item.shortAnswer.length <= 240, `${item.id} answer length is invalid`);
    assert.ok(item.aliases.length >= 3, `${item.id} needs at least three aliases`);
    assert.ok(item.sources.length > 0, `${item.id} has no source`);
    for (const source of item.sources) assert.ok(localSourceIds.has(source.localSourceId), `${item.id} source ${source.localSourceId} is missing locally`);
    for (const relatedId of item.relatedQuestionIds) assert.ok(ids.has(relatedId), `${item.id} links to missing ${relatedId}`);

    const canonical = normalizeQuery(item.question);
    assert.ok(!canonicalQuestions.has(canonical), `${item.id} duplicates a canonical question`);
    canonicalQuestions.add(canonical);
  }
});

test('production publication excludes records needing review', () => {
  const draft = { ...PRACTICAL_HALACHA_QA[0], id: 'draft', reviewStatus: 'needs-review' };
  PRACTICAL_HALACHA_QA.push(draft);
  try {
    assert.ok(!publishedPracticalQuestions().some(item => item.id === draft.id));
  } finally {
    PRACTICAL_HALACHA_QA.pop();
  }
});

test('mandatory practical queries return a verified answer first without network access', () => {
  const queries = [
    'מה מברכים על בננה', 'מה מברכים על אורז', 'מה מברכים על פיצה', 'מה מברכים על מסטיק',
    'שכחתי יעלה ויבוא', 'שכחתי המלך הקדוש', 'מותר לחמם אוכל בשבת', 'אפשר לשים אוכל על הפלטה',
    'מותר לפתוח מקרר בשבת', 'מותר להתקלח בשבת', 'מותר לקחת תרופה בשבת', 'מותר לאישה לעשות קידוש',
    'מותר לשתות לפני תפילה', 'שכחתי לספור את העומר', 'מתי מדליקים נרות שבת', 'דיברתי אחרי הברכה',
    'בורר בשבת', 'מוקצה בשבת', 'קדיש בלי מניין', 'עד מתי אפשר להניח תפילין',
  ];
  for (const query of queries) {
    const first = searchHalacha(query).questions[0];
    assert.equal(first?.quality, 'verified', `${query} did not return a verified answer first`);
    assert.ok(first.shortAnswer, `${query} returned no short answer`);
    assert.ok(first.sources.every(source => localSourceIds.has(source.localSourceId)), `${query} returned a non-local source`);
  }
});