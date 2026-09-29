// Torah Engine · Hebrew normalization for search: the source text is never changed; only the comparison copy is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { highlightRanges, normalizeText, normalizeWord, prefixSplits, scanTokens, shardOf, skeleton, tokenize } from '../src/services/torah/hebrew.mjs';
import { canonicalReferenceText } from '../src/services/library/search.mjs';

test('nikud and te\'amim are ignored; the pointed verse and the plain query meet', () => {
  assert.equal(normalizeText('בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים'), 'בראשית ברא אלהימ');
  assert.equal(normalizeText('בראשית ברא אלהים'), 'בראשית ברא אלהימ');
});

test('final letters, geresh / gershayim and straight / curly quotes collapse to one form', () => {
  for (const form of ['רמב"ם', 'רמב״ם', "רמב''ם", 'רמב”ם', 'רמבם']) assert.equal(normalizeWord(form), 'רמבמ', form);
  assert.equal(normalizeWord('שו״ע'), normalizeWord('שו"ע'));
  assert.equal(normalizeWord('דף ק״ח'), 'דףקח'.replace('ף', 'פ'));
  assert.deepEqual(tokenize('א׳ ב׳'), ['א', 'ב'], 'a trailing geresh is a separator, not a letter');
});

test('maqaf, hyphens, dashes, punctuation and any whitespace separate words', () => {
  assert.deepEqual(tokenize('עַל־פְּנֵי'), ['על', 'פני']);
  for (const text of ['על-פני', 'על–פני', 'על—פני', 'על   פני', 'על\tפני', 'על פני', '(על) [פני]!']) assert.deepEqual(tokenize(text), ['על', 'פני'], text);
});

test('spans map back to the original text, so highlighting never alters it', () => {
  const verse = 'וַיֹּ֥אמֶר אֱלֹהִ֖ים יְהִ֣י א֑וֹר';
  const ranges = highlightRanges(verse, term => term === 'אור');
  assert.equal(ranges.length, 1);
  assert.equal(verse.slice(...ranges[0]), 'א֑וֹר');
  const tokens = scanTokens(verse);
  assert.equal(tokens.map(token => verse.slice(token.start, token.end)).join(' '), verse);
});

test('prefixes are expansions, never destructive: a core of at least three letters, known prefixes only', () => {
  assert.deepEqual(prefixSplits('ובחלב'), [['ו', 'בחלב'], ['וב', 'חלב']]);
  assert.deepEqual(prefixSplits('בשר'), [], 'בשר is not ב + שר');
  assert.deepEqual(prefixSplits('משה'), [], 'משה is not מ + שה');
  assert.equal(shardOf('חלב'), shardOf('ובחלב'), 'a word and its prefixed forms share a shard');
  assert.equal(skeleton('שולחן'), skeleton('שלחן'));
  assert.equal(skeleton('אבידה'), skeleton('אבדה'));
});

test('edge cases: empty, one letter, digits, mixed Hebrew and numbers, very long text', () => {
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(null), []);
  assert.deepEqual(tokenize('א'), ['א']);
  assert.deepEqual(tokenize('סימן 318 סעיף א'), ['סימנ', '318', 'סעיפ', 'א']);
  assert.deepEqual(tokenize('2a'), ['2']);
  assert.equal(tokenize('מילה '.repeat(5000)).length, 5000);
});

test('reference forms: quotes, abbreviations and the words סימן / סעיף / ס"ק are canonicalized', () => {
  assert.equal(canonicalReferenceText('שו״ע אורח חיים סימן שיח סעיף א'), 'שולחן ערוך אורח חיים שיח א');
  assert.equal(canonicalReferenceText('שו"ע או"ח סי\' שיח ס"א'), 'שולחן ערוך אורח חיים שיח א');
  assert.equal(canonicalReferenceText('משנה ברורה סימן שיח ס"ק ג'), 'משנה ברורה שיח ג');
  assert.equal(canonicalReferenceText('בראשית א, א'), 'בראשית א א');
  assert.equal(canonicalReferenceText('חלב ודגים'), 'חלב ודגים', 'ordinary words are untouched');
});
