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

test('Chol HaMoed readings with a second range in the same book split into valid references', () => {
  assert.deepEqual(splitReference('Numbers 29:17-25, 29:17-22'), ['Numbers 29:17-25', 'Numbers 29:17-22']);
  assert.deepEqual(splitReference('Deuteronomy 33:1-34:12; Genesis 1:1-2:3; Numbers 29:35-30:1'), ['Deuteronomy 33:1-34:12', 'Genesis 1:1-2:3', 'Numbers 29:35-30:1']);
  assert.deepEqual(splitReference('Siddur Edot HaMizrach, Weekday Shacharit, Amida'), ['Siddur Edot HaMizrach, Weekday Shacharit, Amida'], 'Siddur commas are part of the name');
  assert.deepEqual(splitReference('Genesis 1:1-6:8'), ['Genesis 1:1-6:8']);
});
