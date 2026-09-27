// Display-time typography repair: the edition typing errors are corrected, references stay intact.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixHebrewTypography, repairBrackets } from '../src/services/hebrewTypography.mjs';

test('a closing bracket typed the wrong way is turned around (Mussaf: זכרון תרועה באהבה)', () => {
  assert.equal(fixHebrewTypography('יום תרועה (זכרון תרועה באהבה( מקרא קדש'), 'יום תרועה (זכרון תרועה באהבה) מקרא קדש');
});

test('an unclosed gloss is closed before the next source bracket, or at the end before the final mark', () => {
  assert.equal(repairBrackets('אותם (ושניהם פורעים שכר הסופר (ריב״ש סי׳ תע״ה):'), 'אותם (ושניהם פורעים שכר הסופר) (ריב״ש סי׳ תע״ה):');
  assert.equal(repairBrackets('הלכה (וכן נוהגין:'), 'הלכה (וכן נוהגין):');
  assert.equal(repairBrackets('ואלו הן. א) חגב. ב) מין (גדול) חגב'), 'ואלו הן. א) חגב. ב) מין (גדול) חגב', 'balanced text is untouched');
});

test('gershayim, geresh, range dash and maqaf', () => {
  assert.equal(fixHebrewTypography('ביו"ט סי\' י"א'), 'ביו״ט סי׳ י״א');
  assert.equal(fixHebrewTypography('(תהלים ס"ז:א\'-ג\')'), '(תהלים ס״ז:א׳–ג׳)');
  assert.equal(fixHebrewTypography('(בא״ח וארא ה״ו-ז)'), '(בא״ח וארא ה״ו–ז)');
  assert.equal(fixHebrewTypography('מִכָּל-עָם'), 'מִכָּל־עָם');
  assert.equal(fixHebrewTypography('מכל-עם'), 'מכל-עם', 'unpointed text keeps its hyphen');
});

test('spacing: a space after a colon between words, none before punctuation; references and ellipses kept', () => {
  assert.equal(fixHebrewTypography('בתפלין:אם ישכח'), 'בתפלין: אם ישכח');
  assert.equal(fixHebrewTypography('(ישעיה נג:מג)'), '(ישעיה נג:מג)');
  assert.equal(fixHebrewTypography('ברוך יהוה , לעולם'), 'ברוך יהוה, לעולם');
  assert.equal(fixHebrewTypography('ויאמר ליצחק ...'), 'ויאמר ליצחק ...');
  assert.equal(fixHebrewTypography('(ג:ט)עננו'), '(ג:ט) עננו');
});

test('idempotent', () => {
  for (const s of ['יום (זכרון באהבה( מקרא', 'אותם (ושניהם (ריב"ש):', 'בתפלין:אם', 'מִכָּל-עָם']) {
    const once = fixHebrewTypography(s);
    assert.equal(fixHebrewTypography(once), once, s);
  }
});
