import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchHalacha } from '../src/services/halachaSearch.mjs';
import { searchYalkut } from '../src/services/yalkutYosef.mjs';
import { YALKUT_YOSEF } from '../src/data/yalkutYosef.mjs';
import { formatTanakhReferences, formatVisibleSourceTitle } from '../src/services/tanakhReferences.mjs';
import { learningResumeKind, learningResumeSubtitle } from '../src/services/learningPresentation.mjs';

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

test('legacy resume titles are translated to Hebrew display labels', () => {
  assert.equal(formatVisibleSourceTitle('Yalkut Yosef yalkut-yosef-1-1-1', 'Yalkut Yosef yalkut-yosef-1-1-1'), 'ילקוט יוסף · קיצור שולחן ערוך');
  assert.equal(formatVisibleSourceTitle('ילקוט יוסף · ילקוט יוסף · סימן רטו - עניית אמן אחר הברכות', 'Yalkut Yosef yalkut-yosef-16-16-12'), 'ילקוט יוסף · עניית אמן אחר הברכות');
  assert.equal(formatVisibleSourceTitle('ילקוט יוסף · עניית אמן אחר הברכות · סימן רטו - עניית אמן אחר הברכות', 'Yalkut Yosef yalkut-yosef-16-16-12'), 'ילקוט יוסף · עניית אמן אחר הברכות');
  assert.equal(formatVisibleSourceTitle('Leviticus 22:26-23:44; Numbers 29:12-16'), 'ויקרא כ״ב, כ״ו–כ״ג, מ״ד · במדבר כ״ט, י״ב–ט״ז');
  assert.equal(formatVisibleSourceTitle('תהילים פרק כ״ב', 'Psalms 22'), 'תהילים פרק כ״ב');
});

test('rice question uses focused Yalkut sections with clean Hebrew titles', async () => {
  const { searchYalkut } = await import('../src/services/yalkutYosef.mjs');
  const results = searchYalkut('מה מברכים על אורז', 3);
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'דין ברכה מעין שלש');
  assert.doesNotMatch(results[0].title, /סימן/);
});

test('resume cards identify Siddur sources by their actual reference', () => {
  assert.equal(learningResumeKind({ source: 'source', reference: 'Siddur Edot HaMizrach, Weekday Shacharit, Alenu', title: 'עלינו' }), 'סידור');
  assert.equal(learningResumeKind({ source: 'source', reference: 'Yalkut Yosef yalkut-yosef-16-7-15', title: 'ילקוט יוסף · דין ברכה מעין שלש' }), 'לימוד');
  assert.equal(learningResumeSubtitle({ source: 'source', reference: 'Siddur Edot HaMizrach, Weekday Shacharit, Petichat Eliyahu', title: 'פתיחת אליהו' }), 'סידור · המשך תפילה');
  assert.doesNotMatch(learningResumeSubtitle({ source: 'source', reference: 'Siddur Edot HaMizrach, Weekday Shacharit, Alenu', title: 'עלינו' }), /[A-Za-z]/);
});
