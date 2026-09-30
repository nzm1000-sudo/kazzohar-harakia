// Search as people ask: everyday phrasings, colloquial and misspelled, must bring the right verified answer to the top —
// and a question the database cannot answer must not be answered by a word match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchHalacha, questionKeyTerms, entryRelevance, normalizeQuery } from '../src/services/halachaSearch.mjs';
import { newConversation, respond } from '../src/services/ai/halachaConversation.mjs';

// query → the answers that may lead (first place), and optionally an answer that must be in the top three.
const CASES = [
  ['ציפס בשמן של שניצל', ['hal-prk-chips-in-schnitzel-oil']],
  ["צ'יפס שטוגן עם עוף", ['hal-prk-chips-in-schnitzel-oil']],
  ["צ'יפס שטוגן בשמן שבו טוגנו שניצלים", ['hal-prk-chips-in-schnitzel-oil']],
  ['צ׳יפס בשמן בשרי', ['hal-prk-chips-in-schnitzel-oil']],
  ['ציפס מסעדה בשרית צריך שש שעות', ['hal-prk-chips-in-schnitzel-oil']],
  ["צ'יפס במסעדה בשרית צריך לחכות?", ['hal-prk-chips-in-schnitzel-oil']],
  ['חתכתי בצל עם סכין בשרית', ['hal-prk-onion-meat-knife']],
  ['בצל שנחתך בסכין בשרי', ['hal-prk-onion-meat-knife']],
  ['כפית חלבית בסיר בשר', ['hal-bayit-dairy-spoon-old-meat-pot', 'hal-prk-dairy-spoon-hot-meat-pot', 'kashrut-dairy-spoon-meat-pot'], 'hal-prk-dairy-spoon-hot-meat-pot'],
  ['בירכתי שהכל במקום מזונות', ['hal-brachot-shehakol-covers-all']],
  ['שכחתי יעלה ויבוא', ['qa-yaaleh-veyavo', 'prayer-forgot-yaaleh']],
  ['שכחתי יעלה ויבוא בברכת המזון', ['hal-moed-yt-birkat-yaale', 'hal-brachot-forgot-yaale-rc', 'hal-moed-rc-yaale-birkat-hamazon']],
  ['טסתי לחול תפילת הדרך', ['hal-prayer-tefilat-haderech-flight']],
  ['חיממתי אוכל במיקרוגל בעבודה', ['hal-basic3-microwave-meat-dairy']],
  ['שתיתי קפה במטבח ועברתי לסלון לברך שוב', ['hal-prk-coffee-other-room']],
  ['יצאתי לחצר באמצע השתייה', ['hal-prk-left-house-fruit']],
  ['מצאתי כסף ברחוב', ['hal-prk-found-scattered-money']],
  ['לוטו מותר לספרדים', ['hal-prk-lottery-sephardim']],
  ['הילד מפריע לי בתפילה', ['hal-prk-child-disturbs-prayer']],
  ['מזוזה בממד', ['hal-prk-mezuzah-shelter-storage']],
  ['טיסה נחתה בשבת', ['hal-prk-landed-after-shabbat-began']],
  ['אבא עלה לאוטובוס לתת מקום', ['hal-prk-parent-on-bus']],
  ['לשתות קפה בספל חלבי כשאני בשרי', ['hal-prk-tea-in-dairy-cup-meat-meal']],
  ['פגעתי במילים צריך לבקש סליחה', ['hal-prk-hurtful-words']],
];

test('everyday phrasings reach their verified answer first', () => {
  const failures = [];
  for (const [query, leads, inTop] of CASES) {
    const ids = searchHalacha(query).questions.map(item => item.id);
    if (!leads.includes(ids[0])) failures.push(`${query}: first ${ids[0]}`);
    if (inTop && !ids.slice(0, 3).includes(inTop)) failures.push(`${query}: ${inTop} not in top 3`);
  }
  assert.deepEqual(failures, []);
});

test('spelling variants are one word: geresh, gershayim and defective spelling', () => {
  assert.equal(normalizeQuery("צ'יפס"), normalizeQuery('ציפס'));
  assert.equal(normalizeQuery('צ׳יפס'), normalizeQuery('ציפס'));
  assert.equal(normalizeQuery('ר"ח'), normalizeQuery('ראש חודש'));
  assert.deepEqual(searchHalacha("צ'יפס בשמן של שניצל").questions.slice(0, 3).map(item => item.id), searchHalacha('ציפס בשמן של שניצל').questions.slice(0, 3).map(item => item.id));
});

test('a question with no verified answer is not answered by a word match', async () => {
  for (const query of ['מותר לכתוב ביקורת רעה בגוגל', 'ווטסאפ לשון הרע']) {
    const terms = questionKeyTerms(query);
    const strong = searchHalacha(query).questions.filter(item => item.quality === 'verified' && entryRelevance(query, item, terms) === 'strong');
    assert.deepEqual(strong.map(item => item.id), [], query);
    const { response } = await respond(newConversation(), query, {});
    assert.notEqual(response.type, 'answer', query);
  }
  // "ביקורת" (a review) is not "ביקור" (a visit).
  assert.ok(!searchHalacha('ביקורת בגוגל').questions.slice(0, 3).some(item => /ביקור חולים/.test(item.topic || '')));
});

test('the assistant answers a fried-in-meat-oil question with its own answer, not the six-hour calculator', async () => {
  const { response } = await respond(newConversation(), "אכלתי צ'יפס שטוגן בשמן שבו טיגנו שניצלים – צריך לחכות שש שעות?", {});
  assert.equal(response.type, 'answer');
  assert.equal(response.entryIds[0], 'hal-prk-chips-in-schnitzel-oil');
  const meat = await respond(newConversation(), 'אכלתי שניצל וצ\'יפס, מתי אפשר גלידה?', {});
  assert.ok(meat.response.entryIds.includes('hal-bayit-six-hours-meat-to-dairy'));
});
