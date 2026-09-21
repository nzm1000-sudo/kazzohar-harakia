import test from 'node:test';
import assert from 'node:assert/strict';
import { getText, splitReference } from '../src/services/sefaria.mjs';

test('compound Sefaria references split into independent ranges', () => {
  assert.deepEqual(splitReference('Leviticus 22:26-23:44; Numbers 29:12-16'), [
    'Leviticus 22:26-23:44',
    'Numbers 29:12-16',
  ]);
});

test('compound Torah reading opens as one combined source', async () => {
  const text = await getText('Leviticus 22:26-23:44; Numbers 29:12-16', 'cantillation');
  assert.equal(text.ref, 'Leviticus 22:26-23:44; Numbers 29:12-16');
  assert.deepEqual(text.compoundReferences, ['Leviticus 22:26-23:44', 'Numbers 29:12-16']);
  assert.ok(text.hebrew.length > 1);
  assert.ok(text.hebrew.some(verse => verse.includes('וַיְדַבֵּ֥ר')));
});
