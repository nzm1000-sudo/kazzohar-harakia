import test from 'node:test';
import assert from 'node:assert/strict';
import { canCacheContent, readContentCache, writeContentCache } from '../src/services/contentCache.mjs';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};

test('content cache evicts oldest entries per content type', () => {
  for (let i = 1; i <= 6; i++) writeContentCache('talmud', `daf-${i}`, { ref: `daf-${i}` });
  assert.equal(readContentCache('talmud', 'daf-1'), null);
  assert.equal(readContentCache('talmud', 'daf-6').ref, 'daf-6');
});

test('content cache rejects clearly restricted licenses', () => {
  assert.equal(canCacheContent({ license: 'All rights reserved' }), false);
  assert.equal(canCacheContent({ license: 'CC-BY-NC' }), true);
});