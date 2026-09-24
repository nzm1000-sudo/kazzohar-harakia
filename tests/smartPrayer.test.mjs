import test from 'node:test';
import assert from 'node:assert/strict';
import { choosePrayerType, PRAYER_TYPE_LABELS, prayerRootKey } from '../src/services/smartPrayer.mjs';

test('before dawn is still maariv, continuing the previous night', () => {
  const now = new Date('2026-09-24T02:00:00Z');
  const times = { alotHaShachar: '2026-09-24T04:10:00Z', chatzot: '2026-09-24T10:30:00Z', sunset: '2026-09-24T18:00:00Z' };
  assert.equal(choosePrayerType(now, times), 'maariv');
});

test('morning before halachic midday is shacharit', () => {
  const now = new Date('2026-09-24T06:00:00Z');
  const times = { alotHaShachar: '2026-09-24T04:10:00Z', chatzot: '2026-09-24T10:30:00Z', sunset: '2026-09-24T18:00:00Z' };
  assert.equal(choosePrayerType(now, times), 'shacharit');
});

test('afternoon between midday and sunset is mincha', () => {
  const now = new Date('2026-09-24T14:00:00Z');
  const times = { alotHaShachar: '2026-09-24T04:10:00Z', chatzot: '2026-09-24T10:30:00Z', sunset: '2026-09-24T18:00:00Z' };
  assert.equal(choosePrayerType(now, times), 'mincha');
});

test('after sunset is maariv', () => {
  const now = new Date('2026-09-24T19:00:00Z');
  const times = { alotHaShachar: '2026-09-24T04:10:00Z', chatzot: '2026-09-24T10:30:00Z', sunset: '2026-09-24T18:00:00Z' };
  assert.equal(choosePrayerType(now, times), 'maariv');
});

test('falls back to a coarse clock guess only when zmanim have not loaded', () => {
  assert.equal(choosePrayerType(new Date(2026, 8, 24, 5), null), 'shacharit');
  assert.equal(choosePrayerType(new Date(2026, 8, 24, 14), null), 'mincha');
  assert.equal(choosePrayerType(new Date(2026, 8, 24, 20), null), 'maariv');
});

test('every prayer type has a Hebrew label', () => {
  assert.deepEqual(PRAYER_TYPE_LABELS, { shacharit: 'שחרית', mincha: 'מנחה', maariv: 'ערבית' });
});

test('root key selects the existing weekday or Shabbat Siddur node, never a new nusach', () => {
  assert.equal(prayerRootKey('shacharit', { isShabbat: false }), 'Weekday Shacharit');
  assert.equal(prayerRootKey('mincha', { isShabbat: false }), 'Weekday Mincha');
  assert.equal(prayerRootKey('maariv', { isShabbat: false }), 'Weekday Arvit');
  assert.equal(prayerRootKey('shacharit', { isShabbat: true }), 'Shabbat Shacharit');
  assert.equal(prayerRootKey('mincha', { isShabbat: true }), 'Shabbat Mincha');
  assert.equal(prayerRootKey('maariv', { isShabbat: true }), 'Shabbat Arvit');
});
