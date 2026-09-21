import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchHalacha } from '../src/services/halachaSearch.mjs';
import { searchYalkut } from '../src/services/yalkutYosef.mjs';
import { YALKUT_YOSEF } from '../src/data/yalkutYosef.mjs';
import { formatTanakhReferences } from '../src/services/tanakhReferences.mjs';

test('Yalkut Yosef is present in unified practical Halacha search coverage', () => {
  assert.equal(YALKUT_YOSEF.sections.length, 14305);
  for (const query of ['ברכות', 'בורר בשבת', 'ברכה על בננה', 'ברכת המזון', 'תפילין', 'קדיש', 'תפילה', 'טלית', 'מוקצה']) {
    const result = searchHalacha(query, { limit: 10 });
    assert.ok(result.unified.some(item => item.kind === 'yalkut'), query);
  }
});

test('Yalkut practical section beats introduction noise for borer on Shabbat', () => {
  const results = searchYalkut('בורר בשבת', 10);
  assert.equal(results.some(item => item.introduction), false);
  assert.ok(results.slice(0, 3).some(item => /בורר/.test(`${item.title} ${item.section}`)));
});

test('an exact curated practical question remains ahead of weaker Yalkut matches', () => {
  const result = searchHalacha('תפילין', { limit: 10 });
  assert.equal(result.unified[0].kind, 'question');
  assert.match(result.unified[0].item.question, /תפילין/);
  assert.ok(result.unified.slice(0, 10).some(item => item.kind === 'yalkut'));
});

test('multi-reference Torah readings are visible in Hebrew', () => {
  assert.equal(formatTanakhReferences('Leviticus 22:26-23:44; Numbers 29:12-16'), 'ויקרא כ״ב, כ״ו–כ״ג, מ״ד · במדבר כ״ט, י״ב–ט״ז');
});
