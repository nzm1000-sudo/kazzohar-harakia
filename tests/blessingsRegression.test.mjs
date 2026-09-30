// מנוע הברכות — regressions for the errors the owner found (2026-09-30), and the guarantees that keep them from coming
// back. The expected blessings are NOT read from the engine's data: each is written here from the source named beside
// it (opened and read; see WEB_SOURCES in src/data/blessings/rules.mjs and docs/halacha/blessings-engine.md §12).
// Passing tests are not a halachic approval — they check that the engine says what those sources say.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { BOOK_ROWS, BOOK_HALACHA_RECORDS, BLESSING_SOURCES, FOODS_VERSION } from '../src/data/blessings/bookTable.mjs';
import { RULES, SHIUR, WEB_SOURCES } from '../src/data/blessings/rules.mjs';
import { indexRecord, normalizeFood, openDataRecord, presentRecord, searchFoods } from '../src/services/blessingsEngine.mjs';
import { plainNut, knownIdentity, nameProblem } from '../scripts/halacha/blessings/identify.mjs';
import { classifyProduct } from '../scripts/halacha/blessings/offRules.mjs';
import { blessingAnswer } from '../src/services/torah/verifiedAnswers.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const FOODS = JSON.parse(gunzipSync(read('public/blessings/foods.json.gz')).toString('utf8'));
const OPEN = FOODS.records.map(row => openDataRecord(row, BOOK_ROWS));
const INDEX = [...BOOK_ROWS, ...BOOK_HALACHA_RECORDS, ...OPEN].map(indexRecord);
const search = (query, limit = 10) => searchFoods(INDEX, query, limit).results;
const view = record => presentRecord(record, { nusach: 'edot-hamizrach', sources: BLESSING_SOURCES });
const byName = name => OPEN.find(record => record.name === name);
const rowN = name => BOOK_ROWS.find(row => row.name === name).n;
const classify = (name, brand = '', extra = {}) => classifyProduct({ name, brand, categories: [], ingredientTags: [], ingredients: [], ...extra }, { rows: BOOK_ROWS }).target;
const ETZ = 'בורא פרי העץ'; const NEFASHOT = 'בורא נפשות'; const SHEHAKOL = 'שהכל נהיה בדברו'; const MEZONOT = 'בורא מיני מזונות';

// ------------------------------------------------------------------------------------------- the five screenshots
test('walnuts and pecans are nuts (העץ / נפשות), never the "אגוזי" chocolate bar', () => {
  // Expected: שו״ע ר״ב א (פרות האילן – העץ), ר״ז א (not of the seven species – בורא נפשות); לוח הרב אופיר מלכא "אגוז";
  // הללויה: "אגוזי מלך טבעיים קליית גת", "אגוזי פקאן טבעיים קליית גת" – העץ / נפשות.
  for (const name of ['אגוזי מלך קלופים', 'אגוזי פקאן קלופים']) {
    const [first] = search(name);
    assert.equal(first.name, name);
    const card = view(first);
    assert.equal(card.before.label, ETZ, name);
    assert.equal(card.after.label, NEFASHOT, name);
    assert.equal(first.ruleId, 'tree-nut');
    assert.notEqual(first.bookRow?.name, 'אגוזי [חטיף]');
    assert.ok(card.ruleSources.some(source => source.id === 'sa-202-1') && card.ruleSources.some(source => source.id === 'sa-207-1'), 'the decision cites the Shulchan Arukh');
    assert.ok(card.web.some(source => source.id === 'malka-egoz'));
    assert.doesNotMatch(JSON.stringify(card), /הברכה והלכותיה עמוד 431/, 'the bar\'s citation is not attached to nuts');
  }
  assert.equal(plainNut('אגוזי מלך קלופים'), 'tree');
  assert.equal(plainNut('אגוזי פקאן קלופים'), 'tree');
  assert.equal(plainNut('שקדים קלופים קלויים ומומלחים'), 'tree');
  assert.equal(plainNut('בוטנים קלויים'), 'peanut');
  assert.equal(plainNut('פקאן מסוכר'), null, 'a candied nut is not a plain nut');
  assert.equal(classify('אגוזי מלך קלופים', 'קליית גת'), 'r:tree-nut');
  assert.equal(classify('אגוזי', 'עלית'), `b:${rowN('אגוזי [חטיף]')}`, 'the bar itself is still the table\'s row');
  // Only the Elite bar may point to the bar's row.
  for (const record of OPEN) if (record.bookRow?.name === 'אגוזי [חטיף]') assert.match(record.brand || '', /עלית|Elite/i, record.name);
});

test('a hazelnut spread is a sweet spread (שהכל / נפשות, on bread – נפטר), never burekas or pizza', () => {
  // Expected: הללויה "ממרח אגוזי לוז נוטלה" – שהכל / נפשות; לוח הרב אופיר מלכא "ממרח" – שהכל; שו״ע רי״ב א (טפל ללחם).
  const [first] = search('ממרח אגוזי לוז');
  assert.equal(first.name, 'ממרח אגוזי לוז');
  const card = view(first);
  assert.equal(first.ruleId, 'sweet-spread');
  assert.equal(card.before.label, SHEHAKOL);
  assert.equal(card.after.label, NEFASHOT);
  assert.ok(card.conditions.some(item => /על לחם, עוגה או ביסקוויט/.test(item.text)), 'eaten on bread: covered by the bread');
  assert.ok(!card.examples.some(name => /בורקס|פיצה/.test(name)), 'no burekas or pizza rows beside a spread');
  assert.ok(!card.ruleSources.some(source => source.id === 'yy-168-3'), 'the pizza/burekas halacha is not its source');
  assert.ok(card.web.some(source => source.id === 'haleluya-nutella'));
  assert.equal(knownIdentity('ממרח אגוזי לוז').target, 'r:sweet-spread');
  assert.equal(knownIdentity('חמאת בוטנים').target, 'r:nut-butter');
  assert.equal(RULES.mixture.bookRows, undefined, 'the general "mixture" rule offers no book rows as examples');
});

test('the Energy cereal bar: a proofread name, and its blessing by what it is made of (מזונות / נפשות)', () => {
  // Expected: לוח הרב אופיר מלכא "אנרג'י" (חטיף דגנים) – מזונות / נפשות.
  const record = byName('חטיף דגנים שברי אגוזים ושוקולד');
  assert.ok(record, 'shown under its proofread name');
  assert.ok(!OPEN.some(item => /אגוזיםצושוקלד|אגוזיםושוקולד/.test(item.name)), 'the joined words are never a shown name');
  assert.ok(record.aliases.includes('חטיף דגנים שברי אגוזיםצושוקלד'), 'the name as typed is still searchable');
  assert.equal(search('אגוזיםצושוקלד')[0]?.id, record.id, '…and finds the same product');
  const card = view(record);
  assert.equal(record.ruleId, 'cereal-bar-grain');
  assert.equal(card.before.label, MEZONOT);
  assert.equal(card.after.label, NEFASHOT);
  assert.ok(card.web.some(source => source.id === 'malka-energy'));
  // Another maker's "חטיף דגנים" is not given Energy's answer: it asks what it is made of.
  assert.equal(knownIdentity('חטיף דגנים', { brand: 'Free' }).target, 'r:cereal-bar');
  assert.ok(RULES['cereal-bar'].question);
});

test('Magnum: a cone is a cone, a stick is a stick — both שהכל, and no last blessing on ice cream (Sephardi)', () => {
  // Expected: הלכה יומית "ברכה אחרונה על גלידה" (יביע אומר ח״ה י״ח; חזון עובדיה) – אין ברכה אחרונה כלל; ילקוט יוסף רי״ב ד –
  // גלידה בגביע: שהכל בלבד; לוח הרב אופיר מלכא "גלידה": בני ספרד אינם מברכים נפשות בשום מצב.
  const cone = byName('טילון מגנום');
  assert.ok(cone, 'the typed "טילון מגנון" is shown proofread');
  assert.equal(cone.ruleId, 'ice-cream-cone');
  assert.deepEqual([view(cone).before.label, view(cone).after.label], [SHEHAKOL, 'אין ברכה אחרונה']);
  const stick = byName('שלגון דואט שוקולד עם נוגט');
  assert.equal(stick.ruleId, 'ice-cream');
  const card = view(stick);
  assert.deepEqual([card.before.label, card.after.label], [SHEHAKOL, 'אין ברכה אחרונה']);
  assert.ok(card.web.some(source => source.id === 'hy-5332'));
  assert.ok(!card.examples.some(name => /קסטה|גביע/.test(name)), 'a stick ice cream is not shown beside the biscuit sandwich or the cone');
  assert.ok(!RULES['ice-cream'].conditions.some(text => /קסטה|27 גרם בתוך 7.5/.test(text)));
  // Ice cream with biscuit pieces is its own question, not the plain rule.
  assert.equal(knownIdentity('גלידת וניל עוגיות').target, 'r:ice-cream-grain');
  assert.equal(knownIdentity('טילון פיסטוק').target, 'r:ice-cream-cone');
});

test('Tortit is a chocolate-coated wafer: מזונות first; the last blessing by the dough alone (not by the first)', () => {
  // Identity: the maker's ingredients (ופל מצופה 30%, קמח חיטה). Expected: הלכה יומית "ברכת הוופלים" – עלי ופל עם שוקולד:
  // מזונות בלי ספק; "ברכה אחרונה על וופלים" – על המחיה רק בכזית מן הבצק עצמו, כזית מן הקרם – נפשות; לוח הרב אופיר מלכא
  // "אגו (וופלים מצופים)" – מזונות.
  const [first] = search('טורטית');
  assert.equal(first.name, 'טורטית', 'the exact name beats a name with the same stem (טורטייה)');
  assert.equal(first.ruleId, 'coated-wafer');
  const card = view(first);
  assert.equal(card.before.label, MEZONOT);
  assert.equal(card.after.label, null, 'the last blessing depends on how much of the wafer itself was eaten');
  assert.ok(card.conditions.some(item => /מן הבצק עצמו/.test(item.text)));
  assert.ok(card.conditions.some(item => /בורא נפשות/.test(item.text)));
  assert.ok(['hy-4328', 'hy-4332'].every(id => card.web.some(source => source.id === id)));
  assert.equal(knownIdentity('שוקולד טורטית').target, 'r:coated-wafer');
  assert.equal(knownIdentity('משקה בטעם טורטית'), null, 'a drink named after the bar is not the bar');
  assert.equal(search('טורטיה')[0].ruleId === 'coated-wafer', false, 'a tortilla search does not become Tortit');
});

// ------------------------------------------------------------------------------------------- the general guarantees
test('an unknown food gets no blessing; "טרם אומת" never shows one; שהכל is never a default', () => {
  assert.equal(searchFoods(INDEX, 'זרזבזגלוף').total, 0);
  for (const record of OPEN.filter(item => item.kind === 'pending')) {
    const card = view(record);
    assert.equal(card.before.label, null, record.name);
    assert.equal(card.after.label, null, record.name);
  }
  for (const id of ['mixture', 'unverified']) assert.equal(RULES[id].status, 'pending');
});

test('a typo is searchable but never shown as the name, and never turns one product into another', () => {
  for (const record of OPEN) assert.equal(nameProblem(record.name), null, record.name);
  // Known joins, typos and suspicious long words are gone from every shown name.
  const bad = /אגוזיםצ|אגוזיםו|קראנצ׳מקסיקני|מגנון|אגוזי חוז|מריא$|קלשיפון|עןגיות|חלוןה|פסיפלןרה|ציםס|מעושנץ|טובב|במקרם|גבאודה|טנובה/;
  for (const record of OPEN) assert.doesNotMatch(record.name, bad, record.name);
  for (const record of OPEN) for (const word of record.name.split(/\s+/)) assert.ok(!/^[א-ת]{13,}$/.test(word), `${record.name}: ${word}`);
  assert.equal(search('טילון מגנון')[0]?.name, 'טילון מגנום');
});

test('a name that only BEGINS like a row of the table is not that row', () => {
  const rowOf = record => record.bookRow?.name;
  for (const record of OPEN) {
    if (rowOf(record) === 'פריכיות אורז') assert.match(record.name, /אורז/, record.name);
    if (rowOf(record) === 'מצה [לא בפסח]') assert.doesNotMatch(record.name, /תפוחי אדמה|תפו"א/, record.name);
    if (rowOf(record) === 'אטריות') assert.doesNotMatch(record.name, /אורז|קונג/, record.name);
    if (rowOf(record) === "צ'יפס") assert.doesNotMatch(record.name, /אורז|תירס/, record.name);
    if (rowOf(record) === 'בוטנים') assert.doesNotMatch(record.name, /אמריקא|מצופ/, record.name);
  }
  assert.notEqual(classify('אטריות אורז'), `b:${rowN('אטריות')}`);
  assert.notEqual(classify('פריכיות חיטה'), `b:${rowN('פריכיות אורז')}`);
  assert.notEqual(classify('מצות מתפוחי אדמה'), `b:${rowN('מצה [לא בפסח]')}`);
  assert.notEqual(classify('נתחי טונה בהירה בשמן צמחי'), 'r:meat-substitute', 'tuna in vegetable oil is not a plant-based meat');
});

test('the last blessing follows the right shiur: 27 g for food, 81 ml for drink, the dough alone for filled dough, none where none', () => {
  // עונג שבת כ״ה א–ב (27 גרם, 7.5 דקות; 81 מ״ל); הלכה יומית hy-540 (27 גרם; לכתחילה 4.5 דקות); hy-4332 (dough alone).
  assert.match(BLESSING_SOURCES['ong-25-1'].excerpt, /27 גרם[\s\S]*7\.5 דקות/);
  assert.match(WEB_SOURCES['hy-540'].says, /27 גרם[\s\S]*4\.5/);
  assert.match(SHIUR.food, /27 גרם/); assert.match(SHIUR.food, /7\.5/); assert.match(SHIUR.food, /4\.5/);
  assert.match(SHIUR.drink, /81 מ״ל/); assert.doesNotMatch(SHIUR.drink, /27 גרם/);
  assert.match(SHIUR.dough, /מן הבצק עצמו/);
  for (const [id, rule] of Object.entries(RULES)) {
    if (rule.after === 'none') assert.ok(!rule.conditions.includes(SHIUR.food), `${id}: no shiur where there is no last blessing`);
    if (['drink', 'plant-milk', 'fruit-wine'].includes(id)) assert.ok(!rule.conditions.includes(SHIUR.food), id);
  }
  const burekas = BOOK_ROWS.find(row => row.name === 'בורקס [בצק עלים]');
  assert.equal(burekas.shiur.text, SHIUR.dough);
  const milk = BOOK_ROWS.find(row => row.name === 'חלב');
  assert.equal(milk.shiur.text, SHIUR.drink);
  const icecream = BOOK_ROWS.find(row => row.name === 'גלידה');
  assert.equal(icecream.shiur, null, 'the book names the condition itself');
  // A row whose own words already give the quantity ("כשאכל שניים וחצי ביסקויטים") gets no second, different quantity.
  assert.equal(BOOK_ROWS.find(row => row.name === 'ביסקוויט').shiur, null);
});

test('search and list give the same decision; one name never carries two different answers', () => {
  for (const query of ['אגוזי מלך קלופים', 'ממרח אגוזי לוז', 'טורטית', 'טילון מגנום', 'חטיף דגנים שברי אגוזים ושוקולד']) {
    const [found] = search(query);
    const listed = OPEN.find(record => record.id === found.id) || BOOK_ROWS.find(row => row.id === found.id);
    assert.deepEqual(view(found), view(listed), query);
  }
  const byNormalized = new Map();
  for (const row of FOODS.records) {
    const key = normalizeFood(row[0]);
    assert.ok(!byNormalized.has(key) || byNormalized.get(key) === row[4], `"${row[0]}" has two answers`);
    byNormalized.set(key, row[4]);
  }
  const rowNames = new Set(BOOK_ROWS.flatMap(row => [row.name, ...row.aliases].map(normalizeFood)));
  for (const row of FOODS.records) assert.ok(!rowNames.has(normalizeFood(row[0])), `"${row[0]}" duplicates a row of the table`);
});

test('the data served is the data built: its version is in the URL the page asks for', () => {
  assert.equal(FOODS.version, FOODS_VERSION);
  assert.ok(FOODS_VERSION >= 2);
  const page = readFileSync(new URL('../src/pages/BlessingsEngine.jsx', import.meta.url), 'utf8');
  assert.match(page, /blessings\/foods\.json\.gz\?v=\$\{book\.FOODS_VERSION/);
});

test('every web source is a named ruling with a link, and no build script sends personal data', () => {
  for (const [id, source] of Object.entries(WEB_SOURCES)) {
    assert.match(source.url, /^https:\/\//, id);
    assert.ok(source.posek && source.citation && source.says, id);
  }
  for (const file of ['fetch-open-food-facts.mjs', 'fetch-wikidata.mjs', 'build.mjs']) {
    const text = readFileSync(new URL(`../scripts/halacha/blessings/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /@[a-z0-9-]+\.[a-z]{2,}/i, `${file}: no e-mail address`);
    assert.doesNotMatch(text, /nizoza/i, file);
  }
});

test('the Torah search\'s blessing answer never takes a shorter row for a longer food name', async () => {
  assert.equal(await blessingAnswer('מה מברכים על אגוזי מלך'), null, 'walnuts are not the "אגוזי" bar (and the table has no walnut row)');
  assert.equal(await blessingAnswer('מה מברכים על אגוזי פקאן קלופים'), null);
  assert.equal((await blessingAnswer('מה מברכים על אגוזי'))?.name, 'אגוזי [חטיף]', 'the bar by its own name');
  assert.equal((await blessingAnswer('מה מברכים על מאכל שעשוי מאורז'))?.name, 'אורז');
});
