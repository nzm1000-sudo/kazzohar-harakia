import test from 'node:test';
import assert from 'node:assert/strict';
import { BABY_NAMES, PUBLISHED_BABY_NAMES, REVIEW_BABY_NAMES } from '../src/data/babyNames.mjs';
import { filterBabyNames, gematria, getBabyName, loadBabyNameFavorites, saveBabyNameFavorites } from '../src/services/babyNames.mjs';

test('baby-name catalog has unique records, required names, and no blocked recommendations', () => {
  assert.ok(PUBLISHED_BABY_NAMES.length >= 300);
  assert.ok(REVIEW_BABY_NAMES.length > 0);
  assert.equal(new Set(BABY_NAMES.map(item => item.name)).size, BABY_NAMES.length);
  for (const name of ['ארי', 'שילה', 'אליה']) assert.ok(PUBLISHED_BABY_NAMES.some(item => item.name === name));
  for (const name of ['ניק', 'אן', 'שון']) assert.equal(PUBLISHED_BABY_NAMES.some(item => item.name === name), false);
  assert.ok(PUBLISHED_BABY_NAMES.every(item => item.id && item.meaning && item.source?.label && item.source?.reference && item.status === 'published'));
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
  assert.ok(PUBLISHED_BABY_NAMES.every(item => ['tanakh', 'traditional', 'modern-hebrew'].includes(item.sourceType)));
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
    assert.deepEqual(loadBabyNameFavorites(), ['baby-name-ארי-24']);
    assert.equal(values.get('kz-baby-names-favorites-v1'), JSON.stringify(['baby-name-ארי-24']));
    assert.deepEqual(saveBabyNameFavorites(['אליה']), ['baby-name-אליה-244']);
    assert.equal(getBabyName('אור-י')?.name, 'אורי');
  } finally {
    globalThis.localStorage = previous;
  }
});