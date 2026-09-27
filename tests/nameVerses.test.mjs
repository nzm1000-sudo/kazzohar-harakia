import test from 'node:test';
import assert from 'node:assert/strict';
import { findNameVerses, findVersesContainingName, searchVerses, nameLetters, NAME_VERSE_RULE_SOURCE, VERSE_INDEX_SIZE } from '../src/services/personalTools.mjs';
import { YALKUT_YOSEF } from '../src/data/yalkutYosef.mjs';
import tanakh from '../src/data/tanakh.json' with { type: 'json' };

const strip = t => String(t).replace(/[֑-ׇ]/g, '');

test('the rule is the one verified in the corpus (Yalkut Yosef 49:2), and the index covers the whole Tanakh', () => {
  const section = YALKUT_YOSEF.sections.find(s => s.id === NAME_VERSE_RULE_SOURCE.ref);
  assert.ok(section, 'citation resolves');
  assert.match(section.text, /פסוק מהתנ''ך שפותח ומסיים באות ראשונה ואחרונה של שמם/);
  assert.equal(VERSE_INDEX_SIZE, tanakh.books.reduce((n, book) => n + book.verses.length, 0));
});

test('שלום: 84 verses by the rule; Psalm 121:1 ends with י so it is not among them — but it is reachable by search', () => {
  assert.deepEqual(nameLetters('שלום'), { first: 'ש', last: 'מ' });
  const byRule = findNameVerses('שלום');
  assert.equal(byRule.length, 84);
  assert.ok(byRule.every(v => { const l = strip(v.text).replace(/[^א-ת]/g, ''); return l[0] === 'ש' && /[םמ]$/.test(l); }));
  assert.equal(byRule.some(v => v.sourceReference === 'Psalms 121:1'), false);
  const found = searchVerses('אשא עיני אל ההרים');
  assert.equal(found.length, 1);
  assert.equal(found[0].sourceReference, 'Psalms 121:1');
  assert.match(strip(found[0].text), /^שיר למעלות/);
});

test('verses containing the name: whole word, with or without a prefix letter, nikud-insensitive', () => {
  const shalom = findVersesContainingName('שלום');
  assert.ok(shalom.length >= 100, `${shalom.length}`);
  assert.ok(shalom.some(v => v.sourceReference === 'Psalms 122:6'), 'שאלו שלום ירושלים');
  assert.ok(shalom.some(v => v.sourceReference === 'Numbers 6:26'), 'וישם לך שלום');
  assert.ok(shalom.every(v => /(^| )(ו|ה|ב|ל|כ|מ|ש|וה|וב|ול|מה|בה|לה)?שלום( |$)/.test(strip(v.text).replace(/[^א-ת\s]/g, ' ').replace(/\s+/g, ' '))));
  const david = findVersesContainingName('דוד');
  assert.ok(david.length > 500);
  assert.equal(findVersesContainingName('').length, 0);
});

test('every one of the 27×27 letter combinations either has rule matches or is a genuine gap in the Tanakh', () => {
  const alef = 'אבגדהוזחטיכלמנסעפצקרשת'.split('');
  const FINAL = { כ: 'ך', מ: 'ם', נ: 'ן', פ: 'ף', צ: 'ץ' };
  const raw = new Map();
  for (const book of tanakh.books) for (const [, , text] of book.verses) { const l = strip(text).replace(/[^א-ת]/g, ''); const key = (l[0]) + (FINAL[l.at(-1)] ? l.at(-1) : l.at(-1)); raw.set(key, (raw.get(key) || 0) + 1); }
  const canon = c => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' }[c] || c);
  const rawCanon = new Map(); for (const [k, n] of raw) { const c = canon(k[0]) + canon(k[1]); rawCanon.set(c, (rawCanon.get(c) || 0) + n); }
  let gaps = 0;
  for (const f of alef) for (const l of alef) {
    const n = findNameVerses(`${f}א${l}`).length;
    assert.equal(n, rawCanon.get(f + l) || 0, `${f}…${l}`);
    if (!n) gaps += 1;
  }
  assert.equal(gaps, 54, 'known gaps (no such verse exists), not missing data');
});

test('free search is nikud-insensitive and bounded', () => {
  assert.equal(searchVerses('בְּרֵאשִׁית בָּרָא')[0].sourceReference, 'Genesis 1:1');
  assert.equal(searchVerses('א').length, 0, 'too short');
  assert.ok(searchVerses('יהוה').length <= 60);
});
