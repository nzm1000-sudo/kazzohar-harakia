import test from 'node:test';
import assert from 'node:assert/strict';
import { hebrewEventLabel } from '../src/services/hebrewCalendarLabels.mjs';

test('translates real Hebcal event names into Hebrew, including Erev/Chol HaMoed prefixes', () => {
  assert.equal(hebrewEventLabel('Erev Sukkot'), 'ערב סוכות');
  assert.equal(hebrewEventLabel('Sukkot I'), 'סוכות א׳');
  assert.equal(hebrewEventLabel('Chol HaMoed Sukkot'), 'חול המועד סוכות');
  assert.equal(hebrewEventLabel('Shmini Atzeret'), 'שמיני עצרת');
  assert.equal(hebrewEventLabel('Simchat Torah'), 'שמחת תורה');
  assert.equal(hebrewEventLabel('Erev Rosh Hashana'), 'ערב ראש השנה');
  assert.equal(hebrewEventLabel('Yom Kippur'), 'יום הכיפורים');
  assert.equal(hebrewEventLabel('Erev Yom Kippur'), 'ערב יום הכיפורים');
  assert.equal(hebrewEventLabel('Purim'), 'פורים');
  assert.equal(hebrewEventLabel('Erev Pesach'), 'ערב פסח');
  assert.equal(hebrewEventLabel('Pesach I'), 'פסח א׳');
  assert.equal(hebrewEventLabel('Chol HaMoed Pesach'), 'חול המועד פסח');
  assert.equal(hebrewEventLabel('Shavuot'), 'שבועות');
  assert.equal(hebrewEventLabel('Rosh Chodesh Adar'), 'ראש חודש אדר');
  assert.equal(hebrewEventLabel("Rosh Chodesh Sh'vat"), 'ראש חודש שבט');
  assert.equal(hebrewEventLabel('Tzom Gedaliah'), 'צום גדליה');
  assert.equal(hebrewEventLabel("Asara B'Tevet"), 'עשרה בטבת');
  assert.equal(hebrewEventLabel("Tisha B'Av"), 'תשעה באב');
  assert.equal(hebrewEventLabel('Tu BiShvat'), 'ט״ו בשבט');
  assert.equal(hebrewEventLabel('Lag BaOmer'), 'ל״ג בעומר');
});

test('translates internal English fallback day labels', () => {
  assert.equal(hebrewEventLabel('Rosh Chodesh'), 'ראש חודש');
  assert.equal(hebrewEventLabel('Shabbat'), 'שבת');
  assert.equal(hebrewEventLabel('Fast Day'), 'יום צום');
  assert.equal(hebrewEventLabel('Weekday'), 'יום חול');
});

test('leaves already-Hebrew text untouched', () => {
  assert.equal(hebrewEventLabel('סוכות א׳'), 'סוכות א׳');
  assert.equal(hebrewEventLabel('פרשת האזינו'), 'פרשת האזינו');
});

test('never leaks raw untranslatable English into the UI: prefers a Hebrew fallback, else a neutral Hebrew label', () => {
  assert.equal(hebrewEventLabel('Some Untranslated Thing', 'תרגום מקומי'), 'תרגום מקומי');
  const fallback = hebrewEventLabel('Some Untranslated Thing');
  assert.doesNotMatch(fallback, /[A-Za-z]/);
});

test('empty/missing input returns an empty string, not a placeholder', () => {
  assert.equal(hebrewEventLabel(''), '');
  assert.equal(hebrewEventLabel(undefined), '');
});

test('REGRESSION: representative calendar contexts never surface raw English in the rendered label', () => {
  const representativeContexts = [
    'Erev Sukkot', 'Sukkot I', 'Sukkot II', 'Chol HaMoed Sukkot', 'Shmini Atzeret', 'Simchat Torah',
    'Erev Rosh Hashana', 'Rosh Hashana 5787', 'Yom Kippur', 'Erev Yom Kippur',
    'Chanukah: 1 Candle', 'Purim', 'Erev Pesach', 'Pesach I', 'Chol HaMoed Pesach', 'Shavuot',
    'Tzom Gedaliah', "Asara B'Tevet", "Tisha B'Av", 'Tu BiShvat', 'Lag BaOmer',
  ];
  for (const value of representativeContexts) {
    const label = hebrewEventLabel(value);
    assert.doesNotMatch(label, /[A-Za-z]/, `"${value}" must not leak English as "${label}"`);
  }
});
