import test from 'node:test';
import assert from 'node:assert/strict';
import { canCacheContent, pinContent, readContentCache, writeContentCache } from '../src/services/contentCache.mjs';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};

test('content cache evicts oldest entries per content type', () => {
  for (let i = 1; i <= 13; i++) writeContentCache('talmud', `daf-${i}`, { ref: `daf-${i}`, license: 'CC-BY-NC' });
  assert.equal(readContentCache('talmud', 'daf-1'), null);
  assert.equal(readContentCache('talmud', 'daf-13').ref, 'daf-13');
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