import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTanakhChapterOnly } from '../src/services/tanakhReferences.mjs';
import { learningResumeCompactTitle } from '../src/services/learningPresentation.mjs';

test('a whole-chapter Torah reference becomes book + chapter only', () => {
  assert.deepEqual(formatTanakhChapterOnly('Genesis 12'), { book: 'בראשית', chapterLabel: 'פרק י״ב' });
  assert.deepEqual(formatTanakhChapterOnly('Exodus 3'), { book: 'שמות', chapterLabel: 'פרק ג׳' });
});

test('a verse-range reference is still reduced to book + chapter, dropping the verses', () => {
  assert.deepEqual(formatTanakhChapterOnly('Genesis 12:1-3'), { book: 'בראשית', chapterLabel: 'פרק י״ב' });
});

test('a non-Tanakh reference is left for the caller to handle', () => {
  assert.equal(formatTanakhChapterOnly('Mishnah Berakhot 1:1'), null);
  assert.equal(formatTanakhChapterOnly(''), null);
});

test('the Today resume card compacts Tanakh chapter items but leaves Tehillim and Talmud alone', () => {
  assert.deepEqual(learningResumeCompactTitle({ reference: 'Genesis 12:1-3' }), { book: 'בראשית', chapterLabel: 'פרק י״ב' });
  assert.equal(learningResumeCompactTitle({ reference: 'chapter/12', source: 'tehillim' }), null);
  assert.equal(learningResumeCompactTitle({ reference: 'Berakhot 2a', source: 'talmud' }), null);
});
