import test from 'node:test';
import assert from 'node:assert/strict';
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
  assert.ok(PUBLISHED_BABY_NAMES.every(item => /^[\u0590-\u05FF\u05B0-\u05C7 ]+$/.test(item.name)));
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