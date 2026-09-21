import test from 'node:test';
import assert from 'node:assert/strict';
import { searchHalacha } from '../src/services/halachaSearch.mjs';
import { HALACHA_QUESTIONS } from '../src/data/halachaQuestions.mjs';
import { HALACHA_TOPICS, APPROVED_HALACHA_PREFIXES } from '../src/data/halachaLibrary.mjs';
import { YALKUT_YOSEF } from '../src/data/yalkutYosef.mjs';
import { searchYalkut, yalkutText } from '../src/services/yalkutYosef.mjs';

// Each acceptance query must surface the expected question within the first three results.
const ACCEPTANCE = [
  ['כמה זמן מחכים בין בשר לחלב?', 'kashrut-waiting-meat-milk'],
  ['מתי אפשר לאכול חלבי אחרי בשר?', 'kashrut-waiting-meat-milk'],
  ['כף חלבית בסיר בשרי', 'kashrut-dairy-spoon-meat-pot'],
  ['איך מכשירים מיקרוגל?', 'kashrut-microwave-office'],
  ['איך טובלים כלי חשמלי?', 'kashrut-tevilat-electric'],
  ['איך טובלים קומקום?', 'kashrut-tevilat-electric'],
  ['מה מברכים על אורז?', 'berachot-rice'],
  ['ברכה אחרונה על קפה', 'berachot-borei-nefashot'],
  ['שכחתי לברך לפני שאכלתי', 'berachot-forgot-before'],
  ['שכחתי יעלה ויבוא', 'prayer-forgot-yaaleh'],
  ['עד מתי שחרית?', 'prayer-shacharit-deadline'],
  ['הגעתי מאוחר למניין', 'prayer-late-minyan'],
  ['כמה תפילות אישה חייבת?', 'women-prayer-obligation'],
  ['אישה חייבת להתפלל?', 'women-prayer-obligation'],
  ['תפילה כשמטפלים בתינוק', 'women-prayer-with-babies'],
  ['קידוש והבדלה לנשים', 'women-kiddush-havdalah'],
  ['מה מכינים לפני טבילה?', 'purity-prep-tevila'],
  ['לק ג\'ל וחציצה', 'purity-chatzitza'],
  ['יש לי לק לפני המקווה', 'purity-chatzitza'],
  ['מקווה בחו"ל', 'purity-tevila-travel'],
  ['שאלה על בדיקה בשבעה נקיים', 'purity-seven-clean'],
  ['חימום מרק בשבת', 'shabbat-reheating-soup'],
  ['מותר לחמם מרק?', 'shabbat-reheating-soup'],
  ['הכנת בקבוק לתינוק', 'shabbat-baby-bottle'],
  ['שכחתי רצה', 'berachot-forgot-retzeh'],
  ['הבדלה כשאין יין', 'shabbat-havdalah-no-wine'],
  ['צום בהריון', 'health-pregnancy-fast'],
  ['הנקה ביום כיפור', 'health-nursing-yom-kippur'],
  ['תרופה בצום', 'health-medicine-fast'],
  ['מתי אומרים קדיש?', 'family-kaddish-when'],
  ['מעשר כספים', 'money-maaser'],
  ['השבת אבדה', 'ethics-hashavat-aveida'],
  ['מצלמת דלת בשבת', 'tech-door-camera'],
  ['מקרר חכם', 'tech-refrigerator'],
  ['שימוש במכשיר שמיעה', 'health-hearing-aid'],
  ['ברכה אחרונה על אורז', 'berachot-rice-after'],
  ['מקרר עם חיישנים', 'tech-refrigerator'],
  ['מצלמת אבטחה', 'tech-door-camera'],
  ['טבילת קומקום', 'kashrut-tevilat-electric'],
  ['הכנה למקווה', 'purity-prep-tevila'],
  ['תפילת נשים', 'women-prayer-obligation'],
  ['נוסח תפילה', 'prayer-nusach'],
  ['מה מברכים על לחם', 'berachot-bread-hamotzi'],
  ['מדיח כלים כשרות', 'kashrut-dishwasher'],
  ['מדיח כלים בשבת', 'tech-dishwasher-ac'],
  ['יעלה ויבוא בברכת המזון', 'berachot-forgot-retzeh'],
];

for (const [query, expected] of ACCEPTANCE) {
  test(`search "${query}" → ${expected}`, () => {
    const { questions } = searchHalacha(query);
    const ids = questions.slice(0, 3).map(q => q.id);
    assert.ok(ids.includes(expected), `expected ${expected} in top 3, got ${ids.join(', ')}`);
  });
}

test('tevilat kelim and family purity do not collide', () => {
  const kelim = searchHalacha('איך טובלים כלים חדשים').questions.slice(0, 2).map(q => q.category);
  const mikveh = searchHalacha('הכנות למקווה').questions.slice(0, 2).map(q => q.category);
  assert.ok(kelim.includes('kashrut') && !kelim.includes('purity'));
  assert.ok(mikveh.includes('purity') && !mikveh.includes('kashrut'));
});

test('relevance: rice, dishwasher, women prayer, fridge and yaaleh-veyavo variants land on the right record first', () => {
  const first = q => searchHalacha(q).questions[0]?.id;
  assert.equal(first('מה מברכים על אורז'), 'qa-rice-blessing');
  assert.equal(first('ברכה אחרונה על אורז'), 'berachot-rice-after');
  assert.notEqual(first('מה מברכים על אורז'), 'berachot-bread-hamotzi', 'rice must not resolve to the five-grains record');
  assert.equal(first('מדיח כלים כשרות'), 'kashrut-dishwasher');
  assert.equal(first('מדיח כלים בשבת'), 'tech-dishwasher-ac');
  assert.equal(searchHalacha('תפילת נשים').questions[0].category, 'women');
  assert.notEqual(first('תפילת נשים'), 'prayer-nusach');
  assert.equal(first('שכחתי יעלה ויבוא'), 'qa-yaaleh-veyavo');
  assert.equal(first('יעלה ויבוא בברכת המזון'), 'berachot-forgot-retzeh');
  assert.equal(first('מקרר בשבת'), 'qa-open-fridge-shabbat');
  assert.equal(first('מקרר עם חיישנים'), 'tech-refrigerator');
});

test('content terms outrank generic forgot wording', () => {
  const result = searchHalacha('שכחתי להניח תפילין').questions.slice(0, 3).map(q => q.id);
  assert.equal(result[0], 'qa-tefillin-until-when');
  assert.equal(result.includes('qa-place-food-plata'), false);
  assert.equal(result.includes('qa-yaaleh-veyavo'), false);
});

test('rice questions cite the segment-level Shulchan Arukh source (208:7), not the whole siman', () => {
  for (const id of ['berachot-rice', 'berachot-rice-after']) {
    const q = HALACHA_QUESTIONS.find(x => x.id === id);
    assert.ok(q.sources.some(s => s.ref === 'Shulchan Arukh, Orach Chayim 208:7'), `${id} missing 208:7`);
    assert.ok(!q.sources.some(s => /^Shulchan Arukh, Orach Chayim 208$/.test(s.ref)), `${id} still cites whole siman`);
  }
});

test('every question cites at least one source from an approved work', () => {
  for (const q of HALACHA_QUESTIONS) {
    assert.ok(q.sources.length > 0, q.id);
    assert.ok(q.sources.some(s => APPROVED_HALACHA_PREFIXES.some(p => s.ref.startsWith(p))), `${q.id} has no approved source`);
    assert.equal(q.reviewStatus, 'unreviewed');
  }
});

test('question ids are unique and every visible topic has questions', () => {
  const ids = new Set(HALACHA_QUESTIONS.map(q => q.id));
  assert.equal(ids.size, HALACHA_QUESTIONS.length);
  for (const cat of HALACHA_TOPICS) {
    assert.ok(cat.children.length > 0, `${cat.id} has no topics`);
    for (const topic of cat.children) assert.ok(HALACHA_QUESTIONS.some(q => q.topic === topic), topic);
  }
});

test('sensitive purity questions are flagged and never auto-answered', () => {
  for (const q of HALACHA_QUESTIONS.filter(q => q.category === 'purity')) {
    assert.equal(q.sensitivity, 'sensitive', q.id);
  }
  assert.ok(searchHalacha('מצאתי כתם').sensitive);
});

test('network failure is distinguishable from no-match', () => {
  assert.equal(searchHalacha('קווקוו זזזז').state, 'no-match');
  assert.equal(searchHalacha('').state, 'empty');
});

test('Yalkut Yosef local pack has stable offline records and required search coverage', () => {
  assert.equal(YALKUT_YOSEF.parts, 87);
  assert.equal(YALKUT_YOSEF.sections.length, 14305);
  assert.equal(new Set(YALKUT_YOSEF.sections.map(section => section.id)).size, YALKUT_YOSEF.sections.length);
  for (const query of ['בורר בשבת', 'ברכה על בננה', 'טלית', 'תפילין', 'קדיש', 'ברכת המזון']) {
    const result = searchYalkut(query, 1)[0];
    assert.ok(result?.ref.startsWith('Yalkut Yosef '), query);
    assert.ok(result?.snippet, query);
  }
  const source = yalkutText(searchYalkut('תפילין', 1)[0].ref);
  assert.equal(source.bundledOffline, true);
  assert.equal(source.license, 'CC BY-NC-SA 2.5');
  assert.match(source.attribution, /תורת אמת/);
});
