import test from 'node:test';
import assert from 'node:assert/strict';
import { insertPersonalVerses, isElohaiNetzor, isYihyuLeratzon, loadPersonalVerses, savePersonalVerses, versesFromProfile, MAX_PERSONAL_VERSES } from '../src/services/personalVerses.mjs';
import { normalizeSiddurBlocks } from '../src/services/siddurBlocks.mjs';
import { getText } from '../src/services/sefaria.mjs';
import { composeWeekdayMincha } from '../src/services/prayer/weekdayMinchaComposer.mjs';

const strip = text => String(text).replace(/[֑-ׇ]/g, '');
const V = [
  { id: 'Genesis.1.1', text: 'בראשית ברא אלהים', reference: 'בראשית א, א', sourceReference: 'Genesis 1:1', name: 'ברוך' },
  { id: 'Psalms.23.1', text: 'מזמור לדוד יהוה רעי לא אחסר', reference: 'תהלים כג, א', sourceReference: 'Psalms 23:1', name: 'משה' },
  { id: 'Psalms.34.15', text: 'סור מרע ועשה טוב בקש שלום ורדפהו', reference: 'תהלים לד, טו', sourceReference: 'Psalms 34:15', name: 'שלמה' },
  { id: 'Extra', text: 'פסוק רביעי', reference: 'x', sourceReference: 'x', name: 'x' },
];
function memoryStorage() { const map = new Map(); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }; }

test('anchors are nikud-insensitive and exact', () => {
  assert.ok(isElohaiNetzor('אֱלֹהַי, נְצֹר לְשׁוֹנִי מֵרָע'));
  assert.ok(isElohaiNetzor('אלהי נצור לשוני'));
  assert.ok(isYihyuLeratzon('יִהְיוּ לְרָצוֹן אִמְרֵי־פִי'));
  assert.equal(isYihyuLeratzon('ואמרו יהיו לרצון'), false, 'must start the block');
  assert.equal(isElohaiNetzor('אלהינו ואלהי אבותינו'), false);
});

test('up to three verses; a fourth is ignored; the old single verse migrates', () => {
  assert.equal(MAX_PERSONAL_VERSES, 3);
  assert.equal(versesFromProfile({ personalVerses: V }).length, 3);
  const migrated = versesFromProfile({ personalVerse: V[0], personalHebrewName: 'ברוך', showPersonalVerseInSiddur: false });
  assert.deepEqual(migrated, [V[0]]);
  const storage = memoryStorage();
  storage.setItem('kz-personal-tools-v1', JSON.stringify({ personalHebrewName: 'ברוך', personalVerse: V[0], showPersonalVerseInSiddur: false, other: 1 }));
  assert.deepEqual(loadPersonalVerses(storage), [V[0]]);
  savePersonalVerses([V[0], V[1]], storage);
  const saved = JSON.parse(storage.getItem('kz-personal-tools-v1'));
  assert.equal(saved.other, 1, 'unrelated profile fields survive');
  assert.equal(saved.personalVerse, undefined);
  assert.equal(saved.showPersonalVerseInSiddur, undefined);
  assert.deepEqual(loadPersonalVerses(storage), [V[0], V[1]]);
});

test('insertion: after אלהי נצור, before the FIRST יהיו לרצון that follows it; input never mutated', () => {
  const blocks = [{ t: 'יהיו לרצון (first, before netzor)' }, { t: 'אלהי נצור לשוני מרע' }, { t: 'ולמקללי נפשי תדום' }, { t: 'יהיו לרצון אמרי פי' }, { t: 'עושה שלום' }];
  const frozen = JSON.stringify(blocks);
  const out = insertPersonalVerses(blocks, [V[0], V[1]], { textOf: b => b.t, makeBlock: (v, i) => ({ t: v.text, personal: i }) });
  assert.equal(out.inserted, true);
  assert.deepEqual(out.blocks.map(b => b.t), ['יהיו לרצון (first, before netzor)', 'אלהי נצור לשוני מרע', 'ולמקללי נפשי תדום', V[0].text, V[1].text, 'יהיו לרצון אמרי פי', 'עושה שלום']);
  assert.equal(JSON.stringify(blocks), frozen);
  assert.equal(insertPersonalVerses([{ t: 'אשרי יושבי ביתך' }], [V[0]], { textOf: b => b.t, makeBlock: v => v }).inserted, false, 'no anchor → nothing inserted');
  assert.equal(insertPersonalVerses(blocks, [], { textOf: b => b.t, makeBlock: v => v }).inserted, false);
});

test('every Amidah in the Siddur gets the verses at the same structural place (printed reader)', async () => {
  const refs = ['Weekday Shacharit, Amida', 'Weekday Arvit, Amidah', 'Shabbat Shacharit, Amidah', 'Shabbat Mussaf, Amida', 'Shabbat Mincha, Amida', 'Shabbat Arvit, Magen Avot', 'Prayers for Three Festivals, Amidah'];
  for (const ref of refs) {
    const text = await getText(`Siddur Edot HaMizrach, ${ref}`, 'nikud');
    const paras = text.hebrew.map((value, index) => ({ text: value, source: text.indexes?.[index] ?? index }));
    const blocks = normalizeSiddurBlocks(paras, { title: ref, markup: paras.map(p => text.siddurMarkup?.[p.source] || p.text), context: {} });
    const out = insertPersonalVerses(blocks, V.slice(0, 3), { textOf: b => b.text, makeBlock: (v, i) => ({ text: v.text, personal: i, role: 'personal-verse' }) });
    assert.equal(out.inserted, true, ref);
    const texts = out.blocks.map(b => strip(b.text));
    const netzor = texts.findIndex(t => /^אלהי,? נצ/.test(t));
    const first = texts.indexOf(V[0].text);
    assert.ok(netzor >= 0 && first > netzor, `${ref}: verses after אלהי נצור`);
    assert.equal(texts[first + 3].startsWith('יהיו לרצון'), true, `${ref}: closing יהיו לרצון right after the third verse`);
    assert.equal(out.blocks.filter(b => b.role === 'personal-verse').length, 3, ref);
    assert.equal(blocks.length + 3, out.blocks.length, `${ref}: no prayer block removed`);
  }
});

test('a section without an Amidah is left untouched (Ashrei)', async () => {
  const text = await getText('Siddur Edot HaMizrach, Weekday Mincha, Offerings', 'nikud').catch(() => null);
  if (!text) return;
  const paras = text.hebrew.map((value, index) => ({ text: value, source: index }));
  const blocks = normalizeSiddurBlocks(paras, { title: 'x', markup: paras.map(p => p.text), context: {} });
  assert.equal(insertPersonalVerses(blocks, V, { textOf: b => b.text, makeBlock: v => v }).inserted, false);
});

test('composed Mincha: verses become their own blocks, recorded in the plan, prayer blocks untouched', () => {
  const settings = { location: { tzid: 'Asia/Jerusalem', latitude: 31.78, longitude: 35.23 }, halachicResidenceStatus: 'israel' };
  const base = { now: new Date('2026-11-24T12:00:00Z'), settings, times: { sunrise: '2026-11-24T04:20:00Z', sunset: '2026-11-24T14:37:00Z' } };
  const plain = composeWeekdayMincha(base);
  const withVerses = composeWeekdayMincha({ ...base, preferences: { personalVerses: V.slice(0, 2) } });
  const amida = withVerses.document.sections.find(s => s.id === 'amida').blocks;
  const ids = amida.map(b => b.sourceId);
  const netzor = amida.findIndex(b => /^אלהי,? נצ/.test(strip(b.text)));
  assert.deepEqual(ids.slice(netzor + 1).filter(id => id.startsWith('personal.verse.')), ['personal.verse.1', 'personal.verse.2']);
  const v1 = ids.indexOf('personal.verse.1');
  assert.ok(v1 > netzor);
  assert.ok(strip(amida[v1 + 2].text).startsWith('יהיו לרצון'), 'closing יהיו לרצון follows the verses');
  assert.equal(amida[v1].type, 'personalVerse');
  assert.equal(amida[v1].caption, V[0].reference);
  assert.deepEqual(withVerses.plan.filter(op => op.op === 'insert').map(op => op.blockId), ['personal.verse.1', 'personal.verse.2']);
  const prayerOnly = doc => doc.sections.flatMap(s => s.blocks).filter(b => !b.personal).map(b => `${b.sourceId}|${b.text}`);
  assert.deepEqual(prayerOnly(withVerses.document), prayerOnly(plain.document), 'not one prayer block changed');
});
