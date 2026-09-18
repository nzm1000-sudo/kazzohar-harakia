import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasNikud,
  hasTrope,
  normalizeHebrewText,
  removeNikud,
  removeTrope,
  resolvePolicyName,
  HEBREW_POLICIES,
} from '../src/hebrewText.mjs';
import { woffCodePoints, hex } from '../scripts/font-cmap.mjs';

const vocalized = 'אֱלֹהֵֽינוּ בָּרוּךְ אַתָּה֑ שָׁלוֹם';

test('Siddur mode removes all cantillation but preserves Hebrew nikud', () => {
  const normalized = normalizeHebrewText(vocalized, 'nikud');
  assert.equal(hasTrope(normalized), false);
  assert.equal(hasNikud(normalized), true);
  assert.match(normalized, /ֽ/); // meteg
  assert.match(normalized, /שׁ/); // shin dot
  assert.match(normalized, /בָּ/); // kamatz and dagesh
  assert.doesNotMatch(normalized, /[□�]/);
});

test('Tanakh mode preserves cantillation and nikud', () => {
  const normalized = normalizeHebrewText(vocalized, 'cantillation');
  assert.equal(hasTrope(normalized), true);
  assert.equal(hasNikud(normalized), true);
  assert.match(normalized, /֑/);
  assert.doesNotMatch(normalized, /[□�]/);
});

test('plain mode removes every nikud and trope mark', () => {
  const normalized = normalizeHebrewText(vocalized, 'plain');
  assert.equal(hasTrope(normalized), false);
  assert.equal(hasNikud(normalized), false);
  assert.equal(normalized, 'אלהינו ברוך אתה שלום');
});

test('range helpers remove all occurrences, not only the first', () => {
  assert.equal(removeTrope('א֑ב֤גֽ'), 'אבגֽ'); // meteg is nikud, not trope
  assert.equal(removeNikud('אֱבּגָ'), 'אבג');
});

test('HTML and entities do not become visible text', () => {
  const normalized = normalizeHebrewText('<b>בָּרוּךְ</b>&nbsp;אַתָּה', 'nikud');
  assert.equal(normalized, 'בָּרוּךְ אַתָּה');
  assert.doesNotMatch(normalized, /&(?:nbsp|[a-z]+);|[□�]/i);
});

test('suspicious missing-glyph characters are rejected by the regression fixture', () => {
  const normalized = normalizeHebrewText('תפילה אֱלֹהֵֽינוּ', 'nikud');
  assert.doesNotMatch(normalized, /[\uFFFD\u25A1\uE000-\uF8FF]/);
});

// ---- Regression: Deuteronomy 11:13 exactly as Sefaria delivers it (Miqra according to the Masorah).
// This verse rendered with square boxes: Heebo has no glyphs for te'amim, meteg (U+05BD) or sof pasuq (U+05C3).
const DEUT_11_13_RAW = 'וְהָיָ֗ה אִם־שָׁמֹ֤עַ תִּשְׁמְעוּ֙ אֶל־מִצְוֺתַ֔י אֲשֶׁ֧ר אָנֹכִ֛י מְצַוֶּ֥ה אֶתְכֶ֖ם הַיּ֑וֹם לְאַהֲבָ֞ה אֶת־יְהֹוָ֤ה אֱלֹֽהֵיכֶם֙ וּלְעׇבְד֔וֹ בְּכׇל־לְבַבְכֶ֖ם וּבְכׇל־נַפְשְׁכֶֽם׃';
const DEUT_11_21_RAW = 'כִּימֵ֥י הַשָּׁמַ֖יִם עַל־הָאָֽרֶץ<sup class="footnote-marker">*</sup><i class="footnote">(בספרי תימן הָאָֽרֶ<big>ץ</big> בצד״י גדולה)</i>׃ <span class="mam-spi-samekh">{ס}</span>';
const cps = s => [...s].map(c => c.codePointAt(0));

test('tanakh policy returns the verse code-point-for-code-point (no reordering, nothing added or removed)', () => {
  const out = normalizeHebrewText(DEUT_11_13_RAW, 'tanakh');
  assert.deepEqual(cps(out), cps(DEUT_11_13_RAW));
  assert.equal(out, normalizeHebrewText(DEUT_11_13_RAW, 'cantillation'), 'legacy alias must map to tanakh');
  // Marks the source uses on this verse, each still present:
  for (const cp of [0x0597, 0x05A4, 0x0599, 0x0594, 0x05A7, 0x059B, 0x05A5, 0x0596, 0x0591, 0x059E, 0x05BD, 0x05C7, 0x05BA, 0x05BE, 0x05C3, 0x05C1, 0x05BC]) {
    assert.ok(out.includes(String.fromCodePoint(cp)), `lost U+${cp.toString(16).toUpperCase()}`);
  }
});

test('no Unicode normalization is applied: Masoretic mark order (dagesh → vowel → accent) survives', () => {
  // תִּשְׁמְעוּ֙ exactly as Sefaria delivers it: ת U+05BC(dagesh) U+05B4(hiriq), ש U+05C1(shin dot) U+05B0(sheva) …
  const word = '\u05EA\u05BC\u05B4\u05E9\u05C1\u05B0\u05DE\u05B0\u05E2\u05D5\u05BC\u0599';
  assert.notEqual(word.normalize('NFC'), word, 'fixture must be a sequence NFC would reorder');
  assert.deepEqual(cps(normalizeHebrewText(word, 'tanakh')), cps(word));
  assert.deepEqual(cps(normalizeHebrewText(word, 'source')), cps(word));
  assert.deepEqual(cps(normalizeHebrewText(word, 'siddur')), cps(word.replace('\u0599', '')));
});

test('siddur policy removes only U+0591–U+05AF; meteg, dagesh, shin/sin dots, qamats qatan, maqaf, paseq and sof pasuq stay', () => {
  const out = normalizeHebrewText(DEUT_11_13_RAW + ' ׀ ', 'siddur');
  assert.equal(hasTrope(out), false);
  const expected = DEUT_11_13_RAW.replace(/[\u0591-\u05AF]/g, '') + ' ׀';
  assert.deepEqual(cps(out), cps(expected));
  for (const cp of [0x05BD, 0x05BC, 0x05C1, 0x05C7, 0x05BE, 0x05C0, 0x05C3]) assert.ok(out.includes(String.fromCodePoint(cp)), `siddur lost U+${cp.toString(16).toUpperCase()}`);
});

test('source policy keeps text exactly (Talmud / commentaries / Halacha), removing markup only', () => {
  const html = '<b>הַכּוֹסֵס</b> אֶת הָאוֹרֶז֑ &nbsp;מברך';
  assert.equal(normalizeHebrewText(html, 'source'), 'הַכּוֹסֵס אֶת הָאוֹרֶז֑ מברך');
});

test('Sefaria footnote apparatus is not rendered inline; parasha markers stay', () => {
  const out = normalizeHebrewText(DEUT_11_21_RAW, 'tanakh');
  assert.equal(out, 'כִּימֵ֥י הַשָּׁמַ֖יִם עַל־הָאָֽרֶץ׃ {ס}');
  assert.doesNotMatch(out, /בספרי תימן|\*/);
});

test('numeric and named entities decode instead of leaving remnants', () => {
  assert.equal(normalizeHebrewText('א&#1468;&nbsp;ב&amp;ג&#x5B7;', 'source'), 'אּ ב&גַ');
  assert.doesNotMatch(normalizeHebrewText('א&zzz;ב', 'source'), /&/);
});

test('policy names resolve deterministically', () => {
  assert.equal(resolvePolicyName('cantillation'), 'tanakh');
  assert.equal(resolvePolicyName('nikud'), 'siddur');
  assert.equal(resolvePolicyName('exact'), 'source');
  assert.equal(resolvePolicyName('plain'), 'plain');
  assert.equal(resolvePolicyName('unknown-mode'), 'siddur');
  assert.deepEqual(Object.keys(HEBREW_POLICIES).sort(), ['plain', 'siddur', 'source', 'tanakh']);
});

test('the shipped reading font has a glyph for every Hebrew mark the fixture uses; Heebo alone does not', () => {
  const serif = woffCodePoints(new URL('../node_modules/@fontsource/noto-serif-hebrew/files/noto-serif-hebrew-hebrew-400-normal.woff', import.meta.url));
  const heebo = woffCodePoints(new URL('../node_modules/@fontsource/heebo/files/heebo-hebrew-400-normal.woff', import.meta.url));
  const marks = [...new Set(cps(DEUT_11_13_RAW))].filter(cp => cp >= 0x0591 && cp <= 0x05F4);
  const serifMissing = marks.filter(cp => !serif.has(cp)).map(hex);
  assert.deepEqual(serifMissing, []);
  // Documented root cause: Heebo's Hebrew subset lacks all cantillation, meteg and sof pasuq.
  const heeboMissing = marks.filter(cp => !heebo.has(cp)).map(hex);
  assert.ok(heeboMissing.includes('U+0597') && heeboMissing.includes('U+05BD') && heeboMissing.includes('U+05C3'), heeboMissing.join(','));
  // Full Biblical range that the reading face must cover (accents, points, punctuation, geresh/gershayim).
  const required = [];
  for (let cp = 0x0591; cp <= 0x05C7; cp++) required.push(cp);
  required.push(0x05F3, 0x05F4);
  assert.deepEqual(required.filter(cp => !serif.has(cp)).map(hex), []);
});
