import test from 'node:test';
import assert from 'node:assert/strict';
import { canCacheContent, pinContent, readContentCache, unpinContent, writeContentCache } from '../src/services/contentCache.mjs';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};

test.beforeEach(() => storage.clear());

test('content cache keeps the last five automatic Talmud entries', () => {
  for (let i = 1; i <= 5; i++) writeContentCache('talmud', `daf-${i}`, { ref: `daf-${i}`, license: 'CC-BY-NC' });
  assert.equal(readContentCache('talmud', 'daf-1').ref, 'daf-1');
  writeContentCache('talmud', 'daf-6', { ref: 'daf-6', license: 'CC-BY-NC' });
  assert.equal(readContentCache('talmud', 'daf-1'), null);
  assert.equal(readContentCache('talmud', 'daf-6').ref, 'daf-6');
});

test('content cache rejects clearly restricted licenses', () => {
  assert.equal(canCacheContent({ license: 'All rights reserved' }), false);
  assert.equal(canCacheContent({ license: 'CC-BY-NC' }), true);
});

test('pinned content survives recent eviction', () => {
  pinContent('source', 'pinned', { ref: 'pinned', license: 'CC0' });
  for (let i = 1; i <= 11; i++) writeContentCache('source', `recent-${i}`, { ref: `recent-${i}`, license: 'CC0' });
  assert.equal(readContentCache('source', 'pinned').ref, 'pinned');
});

test('a pinned Talmud daf does not consume an automatic slot', () => {
  pinContent('talmud', 'pinned', { ref: 'pinned', license: 'CC0' });
  for (let i = 1; i <= 5; i++) writeContentCache('talmud', `daf-${i}`, { ref: `daf-${i}`, license: 'CC-BY-NC' });
  assert.equal(readContentCache('talmud', 'pinned').ref, 'pinned');
  assert.equal(readContentCache('talmud', 'daf-1').ref, 'daf-1');
  writeContentCache('talmud', 'daf-6', { ref: 'daf-6', license: 'CC-BY-NC' });
  assert.equal(readContentCache('talmud', 'pinned').ref, 'pinned');
  assert.equal(readContentCache('talmud', 'daf-1'), null);
});

test('unpinning a daf immediately returns it to the five-slot automatic LRU', () => {
  pinContent('talmud', 'pinned', { ref: 'pinned', license: 'CC0' });
  for (let i = 1; i <= 5; i++) writeContentCache('talmud', `daf-${i}`, { ref: `daf-${i}`, license: 'CC-BY-NC' });
  assert.equal(unpinContent('talmud', 'pinned'), true);
  assert.equal(readContentCache('talmud', 'pinned'), null);
  assert.equal(readContentCache('talmud', 'daf-1').ref, 'daf-1');
});

test('cached Talmud package keeps Steinsaltz available offline', () => {
  writeContentCache('talmud', 'Berakhot|2a', {
    ref: 'Berakhot 2a',
    baseVersion: { title: 'William Davidson Edition - Vocalized Aramaic', license: 'CC-BY-NC' },
    steinsaltzVersion: { title: 'William Davidson Edition - Hebrew', license: 'CC-BY-NC' },
    segments: [{ gemara: 'גמרא', steinsaltz: 'ביאור שטיינזלץ', commentaries: [] }],
    licenses: ['CC-BY-NC', 'CC-BY-NC'],
  });
  const offlinePackage = readContentCache('talmud', 'Berakhot|2a');
  assert.equal(offlinePackage.offlineCached, true);
  assert.equal(offlinePackage.steinsaltzVersion.title, 'William Davidson Edition - Hebrew');
  assert.equal(offlinePackage.segments[0].steinsaltz, 'ביאור שטיינזלץ');
});

test('reopening a pinned daf preserves its loaded commentary package', () => {
  pinContent('talmud', 'Berakhot|2a', {
    ref: 'Berakhot 2a',
    license: 'CC-BY-NC',
    commentaryCache: [{ ref: 'Rashi on Berakhot 2a:1:1', license: 'CC0' }],
  });
  writeContentCache('talmud', 'Berakhot|2a', { ref: 'Berakhot 2a updated', license: 'CC-BY-NC' });
  const reopened = readContentCache('talmud', 'Berakhot|2a');
  assert.equal(reopened.ref, 'Berakhot 2a updated');
  assert.equal(reopened.commentaryCache[0].ref, 'Rashi on Berakhot 2a:1:1');
});

test('automatic cache survives a storage reload', () => {
  writeContentCache('talmud', 'Berakhot|2a', { ref: 'Berakhot 2a', license: 'CC-BY-NC' });
  const saved = storage.get('kz-content-cache-v1');
  storage.clear();
  storage.set('kz-content-cache-v1', saved);
  assert.equal(readContentCache('talmud', 'Berakhot|2a').ref, 'Berakhot 2a');
});