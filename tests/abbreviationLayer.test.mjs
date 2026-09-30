// The abbreviation layer of the open-sources pass: the deterministic extractors (Jastrow's "(abbr. …)", the Ben-Yehuda
// ספר ראשי תיבות), the letter check, the numeral and place-reference guards, and what the shipped dictionary reads per
// reader group (docs/dictionary/source-benchmarks/jastrow-abbreviations.md, ben-yehuda.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as data from '../src/data/dictionary/wordDictionary.mjs';
import { setWordDictionary, getShortGloss, resolveWordContext } from '../src/services/wordLookup/engine.mjs';
import { expandReaderGroups, READER_GROUPS } from '../src/services/wordLookup/aramaic/profiles.mjs';
import { initialsFit, extractJastrowAbbreviations, parseBenYehudaAbbreviations } from '../scripts/dictionary/lexica/abbreviations.mjs';
import { numeralValue, excludedKey } from '../scripts/dictionary/aramaic/abbreviations.mjs';

setWordDictionary(data);
const gloss = (word, family) => getShortGloss(word, resolveWordContext({ family }));
const raw = path => gunzipSync(readFileSync(new URL(`../${path}`, import.meta.url))).toString('utf8');

test('the letter check: an abbreviation spells the beginnings of its expansion\'s words, in order', () => {
  assert.equal(initialsFit('אע״ג', 'אף על גב'), 'strict');
  assert.equal(initialsFit('אח״כ', 'אחר כך'), 'strict');
  assert.equal(initialsFit('עאכ״ו', 'על אחת כמה וכמה'), 'strict');
  assert.equal(initialsFit('אפי׳', 'אפילו'), 'truncation');
  assert.equal(initialsFit('א״כ', 'אם לא'), null);
  assert.equal(initialsFit('ב״ה', 'ברוך'), null);
});

test('numerals and place references are not abbreviations of words', () => {
  assert.equal(numeralValue('ט״ו'), 15);
  assert.equal(numeralValue('ע״ב'), 72);
  assert.equal(numeralValue('ר״ה'), 205);
  assert.equal(numeralValue('סי׳'), 0); // a word cut off, not a numeral
  assert.equal(numeralValue('ג״כ'), 0);
  assert.equal(numeralValue('מ״ש'), 0);
  assert.ok(excludedKey('בפכ״א')); // "in chapter 21"
  assert.ok(excludedKey('ג״פ')); // three times
  assert.ok(excludedKey('ה׳'));
  assert.ok(excludedKey('וי״ו')); // the letter Vav
  assert.ok(!excludedKey('ואח״כ'));
});

test('Jastrow: the abbreviations he prints, from the cleared public-domain source only', () => {
  const rows = extractJastrowAbbreviations(raw('sources/jastrow/raw/entries.jsonl.gz'));
  const has = (key, expansion) => rows.some(r => r.key === key && r.expansion === expansion && r.fit);
  assert.ok(has('א״ה', 'אי הכי'));
  assert.ok(has('א״נ', 'אי נמי'));
  assert.ok(has('אא״ב', 'אי אמרת בשלמא'));
  assert.ok(has('ה״נ', 'הכי נמי') && has('ה״נ', 'הכא נמי')); // two readings: never one global mapping
  assert.ok(has('ת״ש', 'תא שמע'));
  // His headword stands for its own letter-plus-geresh; such a reading is marked (it may be inflected in the phrase).
  assert.ok(rows.some(r => r.key === 'א״ה' && r.expansion === 'אומה העולם' && r.substituted));
  const tsv = readFileSync(new URL('../sources/jastrow/generated/abbreviations.tsv', import.meta.url), 'utf8').split('\n');
  assert.equal(tsv[0], 'abbreviation\texpansion\tprofile\tsourceEntry\trawPattern\tconfidence\tstatus');
  assert.equal(tsv.filter(Boolean).length - 1, rows.length);
});

test('Ben-Yehuda ספר ראשי תיבות: every reading kept, none ranked', () => {
  const rows = parseBenYehudaAbbreviations(raw('sources/ben-yehuda/raw/abbreviations.txt.gz'));
  assert.ok(new Set(rows.map(r => r.key)).size > 13000);
  const readings = key => rows.filter(r => r.key === key).map(r => r.expansion);
  assert.deepEqual(readings('אכמל״ה'), ['אין כאן מקום להאריך']);
  assert.ok(readings('א״כ').includes('אם כן') && readings('א״כ').length > 5);
  assert.ok(readings('א״ב').includes('אחד בנביאים')); // "־בנביאים" continues the reading before it
});

test('reader groups: the data module names a group, the runtime reads its families', () => {
  assert.equal(expandReaderGroups('@talmud'), READER_GROUPS.talmud.join(','));
  assert.equal(expandReaderGroups('*'), '*');
  assert.equal(expandReaderGroups('zohar,kabbalah'), 'zohar,kabbalah');
});

test('the shipped abbreviation layer: what the texts decide, per reader group', () => {
  assert.equal(gloss('וגו׳', 'midrash'), 'וגומר');
  assert.equal(gloss('ואח״כ', 'halacha'), 'ואחר כך');
  assert.equal(gloss('וז״ל', 'responsa'), 'וזה לשונו');
  assert.equal(gloss('שנא׳', 'talmud-commentary'), 'שנאמר');
  assert.equal(gloss('בחי׳', 'chassidut'), 'בחינת');
  assert.equal(gloss('מתני׳', 'talmud'), 'מתניתין');
  // Withheld where the evidence cannot decide, or where the letters are something else.
  assert.equal(gloss('בחי׳', 'talmud'), null); // (not decided in the Gemara's group)
  assert.equal(gloss('וע״ש', 'halacha'), null); // "ועיין שם" outnumbers the source's only reading "וערב שבת"
  assert.equal(gloss('דר׳', 'talmud'), null); // ד + ר׳ "of Rabbi", not "דרך"
  assert.equal(gloss('ט״ו', 'halacha'), null); // fifteen
  assert.equal(gloss('ג״פ', 'liturgy'), null); // three times
  assert.notEqual(gloss('או״א', 'kabbalah'), 'אחד ואחד'); // the Lurianic אבא ואמא: withheld by review
});
