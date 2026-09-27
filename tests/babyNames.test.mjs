import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BABY_NAMES, PUBLISHED_BABY_NAMES, REVIEW_BABY_NAMES } from '../src/data/babyNames.mjs';
import { filterBabyNames, gematria, getBabyName, loadBabyNameFavorites, saveBabyNameFavorites } from '../src/services/babyNames.mjs';
import tanakh from '../src/data/tanakh.json' with { type: 'json' };

const hebrewNumerals = Object.freeze({ א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90, ק: 100, ר: 200, ש: 300, ת: 400 });
const numeralValue = value => [...value].filter(letter => hebrewNumerals[letter]).reduce((sum, letter) => sum + hebrewNumerals[letter], 0);
const hasTanakhReference = reference => {
  const [bookText, verseText] = reference.split(',').map(value => value.trim());
  const chapterText = bookText.match(/([א-ת״׳]+)$/)?.[1]?.replace(/[״׳]/g, '');
  const bookName = bookText.replace(/\s*[א-ת״׳]+$/, '').trim();
  const chapter = numeralValue(chapterText || '');
  const verse = numeralValue((verseText || '').replace(/[״׳]/g, ''));
  const book = tanakh.books.find(item => item.hebrewName.replace(/[״׳]/g, '') === bookName.replace(/[״׳]/g, ''));
  return Boolean(book && chapter > 0 && verse > 0 && book.verses.some(([bookChapter, bookVerse]) => bookChapter === chapter && bookVerse === verse));
};

test('baby-name catalog has unique records, required names, and no blocked recommendations', () => {
  assert.ok(PUBLISHED_BABY_NAMES.length >= 200);
  assert.ok(REVIEW_BABY_NAMES.length > 0);
  assert.equal(new Set(BABY_NAMES.map(item => item.name)).size, BABY_NAMES.length);
  for (const name of ['ארי', 'שילה', 'אליה', 'שלום', 'ברק', 'אברהם', 'משה', 'דוד', 'שלמה', 'יוסף', 'אליהו', 'רפאל', 'שרה', 'רבקה', 'רחל', 'לאה', 'אביגיל', 'תמר', 'יעל', 'נועה', 'איילה', 'חיה', 'ליבי', 'מאיר', 'מנחם', 'ידידיה']) assert.ok(PUBLISHED_BABY_NAMES.some(item => item.canonicalHebrew === name), name);
  for (const name of ['ניק', 'אן', 'שון', 'בארק']) assert.equal(PUBLISHED_BABY_NAMES.some(item => item.canonicalHebrew === name), false, name);
  assert.ok(PUBLISHED_BABY_NAMES.every(item => item.id && item.canonicalHebrew === item.name && item.meaning && item.evidence.length > 0 && item.quality === 'verified' && item.status === 'published'));
});

test('baby-name gematria follows exact Hebrew spelling and final-letter values', () => {
  const expected = { ארי: [211, 4], אריה: [216, 9], שילה: [345, 3], שילו: [346, 4], אליה: [46, 1], הדסה: [74, 2], תמר: [640, 1], נועה: [131, 5] };
  for (const [name, [total, reduced]] of Object.entries(expected)) assert.deepEqual([gematria(name).total, gematria(name).reduced], [total, reduced]);
  assert.equal(gematria('מֶלֶךְ').total, gematria('מלך').total);
  assert.equal(gematria('123'), null);
});

test('baby-name filtering combines gender, query, type, number, and favorites', () => {
  const ari = PUBLISHED_BABY_NAMES.find(item => item.name === 'ארי');
  assert.equal(filterBabyNames({ query: 'ארי' }).some(item => item.name === 'ארי'), true);
  assert.equal(filterBabyNames({ gender: 'בנות' }).some(item => item.name === 'ארי'), false);
  assert.equal(filterBabyNames({ reduced: 4 }).every(item => gematria(item.name).reduced === 4), true);
  assert.deepEqual(filterBabyNames({ favorites: [ari.id], favoritesOnly: true }).map(item => item.id), [ari.id]);
  assert.deepEqual(filterBabyNames({ favorites: [], favoritesOnly: true }), []);
});

test('published records use canonical quality fields and valid Hebrew names', () => {
  assert.ok(PUBLISHED_BABY_NAMES.every(item => /^[\u0590-\u05FF\u05B0-\u05C7 -]+$/.test(item.name))); // a hyphen is kept as written (שי-לי, בן-ציון)
  assert.ok(PUBLISHED_BABY_NAMES.every(item => ['male', 'female', 'unisex'].includes(item.gender)));
  assert.ok(PUBLISHED_BABY_NAMES.every(item => ['biblical', 'rabbinic', 'traditional', 'modern-hebrew', 'modern-israeli'].includes(item.sourceType)));
  assert.ok(PUBLISHED_BABY_NAMES.every(item => item.quality === 'verified' && item.meaning.trim() && item.source.reference));
  assert.ok(REVIEW_BABY_NAMES.every(item => item.status === 'review' && item.quality === 'needs-review'));
  assert.equal(BABY_NAMES.filter(item => item.status === 'rejected').length, 0);
});

test('search matches explicit spelling aliases', () => {
  assert.ok(filterBabyNames({ query: 'אור-י' }).some(item => item.name === 'אורי'));
});

test('review records never appear in published filters', () => {
  assert.deepEqual(filterBabyNames({ query: REVIEW_BABY_NAMES[0].name }), []);
});

test('favorites migrate names to canonical IDs', () => {
  const values = new Map([['kz-baby-names-favorites-v1', JSON.stringify(['ארי', 'missing-id'])]]);
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  try {
      assert.deepEqual(loadBabyNameFavorites(), ['baby-name-ארי-legacy']);
      assert.equal(values.get('kz-baby-names-favorites-v1'), JSON.stringify(['baby-name-ארי-legacy']));
      assert.deepEqual(saveBabyNameFavorites(['baby-name-בארק-27']), ['baby-name-ברק-legacy']);
      assert.equal(getBabyName('אילה')?.name, 'איילה');
  } finally {
    globalThis.localStorage = previous;
  }
});

test('canonical schema stores deterministic gematria and biblical evidence', () => {
  assert.ok(PUBLISHED_BABY_NAMES.every(item => item.gematria?.total > 0 && item.reducedNumber >= 1 && item.reducedNumber <= 9));
  for (const item of PUBLISHED_BABY_NAMES.filter(record => record.sourceType === 'biblical')) {
    assert.ok(item.biblicalReference && item.evidence.some(evidence => evidence.kind === 'Tanakh'), item.name);
    assert.ok(hasTanakhReference(item.biblicalReference), `${item.name}: ${item.biblicalReference}`);
  }
});
test('a name listed in several source lists is one record with one unique id, keeping its strongest evidence', () => {
  assert.equal(new Set(BABY_NAMES.map(item => item.id)).size, BABY_NAMES.length, 'every record id is unique');
  assert.equal(PUBLISHED_BABY_NAMES.filter(item => !item.usageCount).length, 234 + 6, 'the original catalog without רחב, plus six added names with no registration row');
  const byName = name => PUBLISHED_BABY_NAMES.find(item => item.name === name);
  // Biblical in one list, modern/traditional in another: the biblical reference is kept, not overwritten.
  assert.deepEqual([byName('אבישי').sourceType, byName('אבישי').biblicalReference], ['biblical', 'שמואל א׳ כ״ו, ו׳']);
  assert.deepEqual([byName('אריאל').sourceType, byName('אריאל').gender], ['biblical', 'unisex']);
  assert.equal(byName('מיכל').biblicalReference, 'שמואל א׳ י״ח, כ׳');
  assert.equal(byName('מנחם').biblicalReference, 'מלכים ב׳ ט״ו, י״ד');
  // Listed for boys and for girls → unisex.
  assert.equal(byName('שמחה').gender, 'unisex');
  assert.equal(byName('הדר').gender, 'unisex');
  assert.equal(byName('טל').gender, 'unisex');
  // Ids are unchanged, so saved favourites still resolve; aliases apply whichever list a name came from.
  assert.equal(byName('טל').id, 'baby-name-טל-legacy');
  assert.equal(getBabyName('נעם')?.name, 'נועם');
});

test('CBS candidates (babynamesIL, Jewish sector) wait in review, never published, each cited and counted', () => {
  const cbs = REVIEW_BABY_NAMES.filter(item => item.usageCount);
  assert.equal(cbs.length + PUBLISHED_BABY_NAMES.filter(item => item.usageCount).length, 332 + 33, 'plus 33 user-added names with registration counts');
  assert.equal(new Set(BABY_NAMES.map(item => item.id)).size, BABY_NAMES.length);
  assert.equal(new Set(BABY_NAMES.map(item => item.name)).size, BABY_NAMES.length);
  for (const item of cbs) {
    assert.ok(item.status === 'review' && item.quality === 'needs-review', item.name);
    assert.ok(['male', 'female', 'unisex'].includes(item.gender), item.name);
    assert.ok(item.usageCount.total >= 2000 && item.usageCount.total === item.usageCount.male + item.usageCount.female, item.name);
    assert.ok(item.evidence.some(e => /babynamesIL/.test(e.label)) && item.evidence.some(e => e.url.includes('cbs.gov.il')), item.name);
    const sourced = item.evidence.some(e => e.url.startsWith('https://www.sefaria.org/BDB,_'));
    if (!sourced) assert.equal(item.literalMeaning, 'המשמעות המדויקת אינה ודאית.', `${item.name}: no meaning without a source`);
    assert.equal(filterBabyNames({ query: item.name }).some(record => record.id === item.id), false, item.name);
  }
  // The hyphen is kept as written and flagged.
  assert.ok(BABY_NAMES.find(item => item.name === 'שי-לי'), 'the hyphen is kept');
  assert.ok(BABY_NAMES.find(item => item.name === 'בת שבע'), 'a space is allowed');
});

test('alternative CBS spellings resolve to the existing record', () => {
  for (const [spelling, name] of [['אהרון', 'אהרן'], ['צפורה', 'ציפורה'], ['נגה', 'נוגה'], ['אילת', 'איילת'], ['אוסנת', 'אסנת'], ['שלומית', 'שולמית']]) {
    assert.equal(getBabyName(spelling)?.name, name, spelling);
    assert.ok(filterBabyNames({ query: spelling }).some(item => item.name === name), spelling);
    assert.equal(REVIEW_BABY_NAMES.some(item => item.name === spelling), false, `${spelling} is not a separate candidate`);
  }
});

test('meanings come only from a cited source: 57 BDB entries, each linked to its own Sefaria page; the rest keep the default', () => {
  const DEFAULT = 'שם עברי בשימוש יהודי ישראלי.';
  const bdb = item => item.evidence.find(e => e.url.startsWith('https://www.sefaria.org/BDB,_'));
  const published = PUBLISHED_BABY_NAMES.filter(bdb), inReview = REVIEW_BABY_NAMES.filter(bdb);
  assert.equal(published.length, 39 + 18);
  assert.equal(inReview.length, 0);
  for (const item of [...published, ...inReview]) {
    // The wording follows the published type: a traditional record never calls itself biblical.
    if (item.sourceType === 'traditional') assert.match(item.literalMeaning, /^שם מסורתי/, item.name);
    if (item.sourceType === 'biblical') assert.match(item.literalMeaning, /^שם מקראי/, item.name);
    if (item.sourceType === 'modern-israeli') assert.match(item.literalMeaning, /^שם שמופיע במקרא; פירושו /, item.name);
    assert.ok(item.meaning.startsWith(item.literalMeaning), item.name);
    assert.match(bdb(item).reference, /^BDB, /, item.name);
  }
  assert.equal(PUBLISHED_BABY_NAMES.filter(item => item.literalMeaning === DEFAULT).length, 444);
  assert.equal(REVIEW_BABY_NAMES.filter(item => item.usageCount && item.literalMeaning === 'המשמעות המדויקת אינה ודאית.').length, 73);
  assert.equal(PUBLISHED_BABY_NAMES.find(item => item.name === 'נפתלי').literalMeaning.startsWith('שם מסורתי'), true);
  assert.equal(PUBLISHED_BABY_NAMES.find(item => item.name === 'רות').literalMeaning, 'שם מקראי שפירושו רעות, חברות.');
  assert.equal(bdb(PUBLISHED_BABY_NAMES.find(item => item.name === 'דבורה')).url, `https://www.sefaria.org/BDB,_${encodeURIComponent('דְּבוֹרָה²')}`);
});

test('the hand-reviewed CBS batch: 292 published with counts, the 54 exclusions and every flagged name stay in review', () => {
  const moved = PUBLISHED_BABY_NAMES.filter(item => item.usageCount);
  assert.equal(moved.length, 292);
  assert.equal(moved.filter(item => item.sourceType === 'traditional').length, 18, 'BDB meanings publish as traditional');
  assert.equal(moved.filter(item => item.sourceType === 'modern-israeli').length, 274);
  for (const item of moved) {
    assert.ok(item.status === 'published' && item.quality === 'verified' && item.id === `baby-name-${item.name.replace(/[^א-ת]/g, '')}-legacy`, item.name);
    assert.ok(item.evidence.some(e => /babynamesIL/.test(e.label)), item.name);
    if (item.sourceType === 'modern-israeli') assert.equal(item.literalMeaning, 'שם עברי בשימוש יהודי ישראלי.', item.name);
    assert.ok(filterBabyNames({ query: item.name }).some(record => record.id === item.id), item.name);
  }
  const inReview = name => REVIEW_BABY_NAMES.some(item => item.name === name) && !PUBLISHED_BABY_NAMES.some(item => item.name === name);
  for (const name of ['מקסים', 'שון', 'אן', 'נטלי', 'בלה', 'הינדא']) assert.ok(inReview(name), name);
  for (const name of ['אילן', 'דנה', 'טובה']) assert.ok(inReview(name), `${name}: variant hint, separate pass`);
  for (const name of ['אלכסנדר', 'איתי', 'נדב', 'בת שבע', 'ינאי', 'יאיר', 'חוה', 'יותם']) assert.ok(PUBLISHED_BABY_NAMES.some(item => item.name === name), name);
  assert.equal(PUBLISHED_BABY_NAMES.find(item => item.name === 'נדב').type, 'מסורתי');
  assert.equal(REVIEW_BABY_NAMES.find(item => item.name === 'תקומה').id, 'baby-name-review-תקומה-24', 'review ids do not shift');
});

test('a name without a sourced meaning says exactly "שם עברי בשימוש יהודי ישראלי." and nothing more', () => {
  const plain = PUBLISHED_BABY_NAMES.filter(item => item.literalMeaning === 'שם עברי בשימוש יהודי ישראלי.');
  assert.equal(plain.length, 444);
  for (const item of plain) assert.ok(item.meaning === item.literalMeaning && item.origin === null, item.name);
  assert.equal(PUBLISHED_BABY_NAMES.some(item => item.meaning.includes('המשמעות המדויקת אינה ודאית')), false);
  for (const name of ['לאה', 'רבקה', 'אלעד']) assert.equal(PUBLISHED_BABY_NAMES.find(item => item.name === name).meaning, 'שם עברי בשימוש יהודי ישראלי.', name);
  // Sourced meanings keep their text and their origin line.
  assert.equal(PUBLISHED_BABY_NAMES.find(item => item.name === 'רות').meaning, 'שם מקראי שפירושו רעות, חברות. עברית מקראית; אומת מול הקשר המקראי המקומי.');
});

test("the user's removals and additions (2026-09-27)", () => {
  const published = name => PUBLISHED_BABY_NAMES.some(item => item.name === name);
  for (const name of 'אלכסנדרה אלכסיי אנה אנסטסיה דיאנה דמיטרי ולדימיר יקטרינה לאוניד לורן מרגריטה ניקול סמיון פולינה רחב'.split(' ')) assert.equal(published(name), false, name);
  for (const name of 'עלמא גולדה פיגא גיטל בלומה שיינא שייה פרידה רוזה ריי ליאם ריף אלה מאי ליה רומי מיקה אווה לין אלין דריה אריק לירוי לני הלני יולי אודל אדל מלי נאיה האני קציעה קרן תרצה מילכה אחינועם אליה נוריאל נורי הילה הילי אליעזר שי-לי לימור דורין אודיה הודיה מאירה בן-ציון ישי דויד עידו עדן אלדר עוז עוזיאל אורן חזי צחי פרי פרח פנינה חנה שרה שרי רחל רחלי חלי רבקה גאולה יורם לאון שירן עומרי נויה ענבל יעל אושיר אביבה אילנה אילנית נוריה נורית שרונה גואל אביגדור אייל ימית עברי אברי מתניה אבישג אושרה אושרית שיר שירה עמיר עמירן עמירם עדינה חושן עופרה דקלה זיוה עזר אילאי יתיר'.split(' ')) assert.ok(published(name), name);
  assert.equal(PUBLISHED_BABY_NAMES.length, 532);
  assert.equal(PUBLISHED_BABY_NAMES.find(item => item.name === 'דויד').gender, 'male');
  assert.equal(PUBLISHED_BABY_NAMES.find(item => item.name === 'בן-ציון').id, 'baby-name-בןציון-legacy');
  assert.equal(new Set(BABY_NAMES.map(item => item.id)).size, BABY_NAMES.length);
});

test('the names list has a clear-X in its search field and an arrow back to the top', () => {
  const page = readFileSync(new URL('../src/pages/PersonalTools.jsx', import.meta.url), 'utf8');
  assert.match(page, /<ClearableInput value=\{query\} onChange=\{event => setQuery\(event\.currentTarget\.value\)\}/);
  assert.match(page, /<ScrollTopButton \/><\/section>;/);
  const button = readFileSync(new URL('../src/components/ScrollTopButton.jsx', import.meta.url), 'utf8');
  assert.match(button, /window\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/);
});
