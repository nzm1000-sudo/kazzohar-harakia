// סדר השכמת הבוקר is ONE page (owner, 2026-10-03): "כל ברכות השחר ממודה אני ועד ואני אברכם צריכים להיות בלשונית
// אחת", one "סיימתי", and at its end "הבא · שחרית" — Shacharit opened right after ברכות השחר. The texts are the
// edition's own leaves, whole: compared here byte for byte with the source data, as each leaf was read before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HDate } from '@hebcal/core';
import { NUSACH_INDEX } from '../src/data/nusach/registry.mjs';
import { siddurLayout } from '../src/data/nusach/siddurLayouts.mjs';
import { COMPOSITIONS } from '../src/data/nusach/compositions/index.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { getText, normalizeText } from '../src/services/sefaria.mjs';
import { siddurRoots, buildSiddurFlows, counterpartIn } from '../src/services/siddurIndex.mjs';
import { serializeReaderNavigation, restoreReaderNavigation } from '../src/services/readerHistory.mjs';
import { resolveSiddurCompletion, ACTIVITY_TYPE } from '../src/services/mitzvotJournal.mjs';
import { composeRiteService, resolveService } from '../src/services/prayer/riteServiceComposer.mjs';
import { planDayService, birchotHashacharSteps } from '../src/services/prayer/dayServicePlan.mjs';
import { composeDayService } from '../src/services/prayer/dayServiceComposer.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { normalizeSiddurBlocks } from '../src/services/siddurBlocks.mjs';
import { removeNikud } from '../src/hebrewText.mjs';
import {
  HASHKAMA_TITLE, HASHKAMA_CONTINUE, AFTER_HASHKAMA, hashkamaLeaves, hashkamaReference, hashkamaOf, hashkamaSections,
  hashkamaNavigation, migrateHashkamaReference, migrateSourceEntry, withHashkamaHeadings, afterBirchotIndex, isHashkamaContinue,
} from '../src/services/hashkama.mjs';

const RITES = ['edot-hamizrach', 'sefard'];
const packs = {};
for (const id of Object.keys(NUSACH_INDEX)) packs[id] = await loadSiddur(id);
const letters = text => removeNikud(String(text || '').replace(/<[^>]+>/g, ' ')).replace(/[^א-ת]/g, '');
const rootsOf = nusach => siddurRoots(packs[nusach].schema.nodes, NUSACH_INDEX[nusach].index, siddurLayout(nusach), () => true, { has: ref => Boolean(packs[nusach].texts[ref]) });
const hashkamaRootOf = nusach => rootsOf(nusach).find(root => root.key === siddurLayout(nusach).hashkama.root);

const JERUSALEM = { location: { latitude: 31.778, longitude: 35.235, tzid: 'Asia/Jerusalem', name: 'ירושלים' }, halachicResidenceStatus: 'israel', il: true };
const civil = hdate => { const d = hdate.greg(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const WEEKDAY = civil(new HDate(22, 'Cheshvan', 5787));
// The Smart Siddur composes the day itself on the days it supports (Rosh Chodesh here); other days open the rite's
// composed Shacharit — the same route "תפילות היום" takes.
const ROSH_CHODESH = civil(new HDate(1, 'Kislev', 5787));
const morning = (key = WEEKDAY) => JewishContextEngine({ now: new Date(`${key}T05:00:00Z`), settings: JERUSALEM, times: {}, prayerType: 'shacharit' });

test('the morning-rising order is ONE row of its root: מודה אני first, ואני אברכם at the end, in order', () => {
  for (const nusach of RITES) {
    const root = hashkamaRootOf(nusach);
    assert.equal(root.title, HASHKAMA_TITLE, nusach);
    assert.equal(root.items.length, 1, `${nusach}: one page`);
    const [item] = root.items;
    assert.equal(item.reference, hashkamaReference(nusach));
    assert.deepEqual(item.reference.split('; '), hashkamaLeaves(nusach));
    const leaves = hashkamaLeaves(nusach);
    assert.match(leaves[0], /Modeh Ani$/, `${nusach}: opens with מודה אני`);
    const all = leaves.map(ref => packs[nusach].texts[ref].he.join(' '));
    const flat = letters(all.join(' '));
    assert.ok(flat.indexOf('מודהאני') >= 0, `${nusach}: מודה אני`);
    assert.ok(flat.indexOf('ואניאברכם') > flat.indexOf('מודהאני'), `${nusach}: ואני אברכם after מודה אני`);
    // Every ברכות השחר blessing of the rite, in the order of the leaves.
    const order = ['מודהאני', 'עלנטילתידים', 'אשריצר', 'אלהינשמה', 'לשכוי', 'המעביר', 'דבריתורה', 'ואניאברכם'].map(word => flat.indexOf(word));
    assert.ok(order.every(at => at >= 0), `${nusach}: every blessing is on the page ${order}`);
  }
  // Edot HaMizrach: the page ends with ברכת כהנים, "…ואני אברכם" — its last words.
  const edot = hashkamaLeaves('edot-hamizrach');
  assert.match(letters(packs['edot-hamizrach'].texts[edot.at(-1)].he.at(-1)), /ואניאברכם$/);
});

test('the page holds exactly the leaves its rite\'s Shacharit names ברכות השחר (nothing added, nothing missing)', () => {
  for (const nusach of RITES) {
    const service = COMPOSITIONS[nusach].services['weekday-shacharit'];
    const part = service.parts.find(item => item.id === 'birchot-hashachar');
    const ids = service.sections.map(section => section.id);
    const run = service.sections.slice(ids.indexOf(part.from), ids.indexOf(part.to) + 1);
    assert.deepEqual([...new Set(run.map(section => section.ref))], hashkamaLeaves(nusach), nusach);
  }
  // The Smart Siddur (Edot HaMizrach) opens Shacharit with the same leaves.
  assert.deepEqual(birchotHashacharSteps().map(step => step.ref), hashkamaLeaves('edot-hamizrach'));
});

test('the text is byte-identical to the leaves as they were read one by one, and to the source data', async () => {
  for (const nusach of RITES) {
    const joined = await getText(hashkamaReference(nusach));
    const parts = await Promise.all(hashkamaLeaves(nusach).map(ref => getText(ref)));
    assert.deepEqual(joined.hebrew, parts.flatMap(part => part.hebrew), `${nusach}: hebrew`);
    assert.deepEqual(joined.siddurMarkup, parts.flatMap(part => part.siddurMarkup), `${nusach}: markup`);
    const source = hashkamaLeaves(nusach).flatMap(ref => normalizeText(packs[nusach].texts[ref]).hebrew);
    assert.deepEqual(joined.hebrew, source, `${nusach}: source data`);
    const raw = hashkamaLeaves(nusach).flatMap(ref => packs[nusach].texts[ref].he.filter(item => normalizeText({ he: [item] })));
    assert.deepEqual(joined.siddurMarkup, raw, `${nusach}: raw markup`);
  }
});

test('headings: one per leaf, centred in the reader; added headings are titles only — every word of the text stays', async () => {
  for (const nusach of RITES) {
    const text = await getText(hashkamaReference(nusach));
    const paragraphs = text.hebrew.map((value, index) => ({ text: value, source: text.indexes[index] }));
    const blocks = normalizeSiddurBlocks(paragraphs, { title: HASHKAMA_TITLE, markup: text.siddurMarkup });
    const sections = hashkamaSections(nusach, packs[nusach].schema.nodes);
    const shaped = withHashkamaHeadings(blocks, sections);
    assert.equal(Object.keys(shaped.anchors).length, sections.length, `${nusach}: every leaf has its place in "תוכן"`);
    const kept = shaped.blocks.filter(block => !block.added);
    assert.deepEqual(kept.map(block => block.text), blocks.map(block => block.text), `${nusach}: no block lost or changed`);
    for (const block of shaped.blocks.filter(item => item.added)) assert.ok(sections.some(section => section.title === block.text), block.text);
  }
  const edot = hashkamaSections('edot-hamizrach', packs['edot-hamizrach'].schema.nodes).map(section => section.title);
  assert.deepEqual(edot, ['מודה אני', 'ברכות השחר', 'ברכות התורה']);
});

test('one completion for the whole page, recorded in המצוות שלי as ברכות השחר', () => {
  for (const nusach of RITES) {
    const root = hashkamaRootOf(nusach);
    const flows = buildSiddurFlows([root], () => {});
    const navigation = flows.navigation.get(root.items[0].reference);
    assert.equal(navigation.flow.length, 1, `${nusach}: one stop, one "סיימתי"`);
    const resolved = resolveSiddurCompletion(navigation.flowKey, { itemEn: navigation.itemEn, title: HASHKAMA_TITLE, flowTitle: navigation.flowTitle });
    assert.equal(resolved.sourceId, 'Preparatory Prayers', nusach);
    assert.equal(resolved.kind.type, ACTIVITY_TYPE.MORNING_BLESSINGS, nusach);
    // The same record as before, from whichever leaf it used to be marked.
    for (const en of ['Modeh Ani', 'Morning Blessings', 'Torah Blessings']) assert.equal(resolveSiddurCompletion(navigation.flowKey, { itemEn: en }).sourceId, 'Preparatory Prayers');
  }
});

test('"הבא" is שחרית: kept through History state, and handed to the Siddur\'s route', () => {
  for (const nusach of RITES) {
    const root = hashkamaRootOf(nusach);
    let continued = null;
    const flows = buildSiddurFlows([root], () => { throw new Error('not a text'); }, { onContinue: target => { continued = target; } });
    const navigation = flows.navigation.get(root.items[0].reference);
    assert.equal(navigation.next.title, 'שחרית');
    assert.ok(isHashkamaContinue(navigation.next));
    navigation.onSelect(navigation.next);
    assert.equal(continued.reference, HASHKAMA_CONTINUE);
    const saved = JSON.parse(JSON.stringify(serializeReaderNavigation(navigation)));
    let after = null;
    const restored = restoreReaderNavigation(saved, { openSource: () => { throw new Error('not a text'); }, navigate: () => {}, onContinue: target => { after = target; } });
    assert.equal(restored.next.title, 'שחרית');
    assert.equal(restored.previous, null);
    restored.onSelect(restored.next);
    assert.equal(after.reference, HASHKAMA_CONTINUE);
    // The plain-data flow (an opening without the Siddur home: "המשך קריאה", a favourite) says the same.
    assert.equal(restoreReaderNavigation(hashkamaNavigation(nusach), { openSource: () => {}, navigate: () => {} }).next.title, 'שחרית');
  }
});

test('Shacharit opened from the page starts right after ברכות השחר — per rite', () => {
  // The Smart Siddur (Edot HaMizrach, the day's service): פתח אליהו.
  const smartDay = morning(ROSH_CHODESH);
  const document = composeDayService(planDayService({ prayer: 'shacharit', context: smartDay }), smartDay);
  const context = morning();
  const at = afterBirchotIndex(document.sections);
  assert.equal(document.sections[at].id, 'petichat-eliyahu');
  assert.ok(document.sections.slice(0, at).every(section => section.group === 'birchot-hashachar'));
  // The composed Shacharit of each rite (the route "תפילות היום" takes when the day service does not).
  const expected = { 'edot-hamizrach': 'petichat-eliyahu', sefard: 'akeda', ashkenaz: null, chabad: null };
  for (const [nusach, id] of Object.entries(expected)) {
    const composed = composeRiteService({ composition: COMPOSITIONS[nusach], serviceId: 'weekday-shacharit', texts: packs[nusach].texts, context });
    const index = afterBirchotIndex(composed.sections);
    assert.ok(index > 0, nusach);
    if (id) assert.equal(composed.sections[index].id, id, nusach);
    assert.ok(composed.sections.slice(0, index).every(section => section.part === 'birchot-hashachar'), nusach);
    assert.notEqual(composed.sections[index].part, 'birchot-hashachar', nusach);
  }
});

test('normal Shacharit is unchanged: it still opens with the whole ברכות השחר, and only the anchor moves the reader', () => {
  const smartDay = morning(ROSH_CHODESH);
  const document = composeDayService(planDayService({ prayer: 'shacharit', context: smartDay }), smartDay);
  assert.equal(document.sections[0].id, 'birchot-hashachar');
  assert.ok(document.sections[0].part);
  for (const nusach of Object.keys(COMPOSITIONS)) {
    const service = COMPOSITIONS[nusach].services['weekday-shacharit'];
    assert.equal(service.parts[0].id, 'birchot-hashachar', nusach);
    assert.ok(resolveService(service, packs[nusach].texts).every(section => !section.error), nusach);
  }
  assert.equal(AFTER_HASHKAMA, 'after-hashkama');
  // No other row of the Siddur gains a "הבא" beyond its own flow.
  for (const nusach of Object.keys(NUSACH_INDEX)) {
    const flows = buildSiddurFlows(rootsOf(nusach), () => {});
    for (const [reference, navigation] of flows.navigation) {
      if (hashkamaOf(reference)) continue;
      assert.ok(!navigation.continueTo && !isHashkamaContinue(navigation.next), `${nusach}: ${reference}`);
    }
  }
});

test('an old resume key (one leaf, from when each was a page) still opens — the page, at that leaf', () => {
  const leaves = hashkamaLeaves('edot-hamizrach');
  const page = hashkamaReference('edot-hamizrach');
  assert.deepEqual(migrateHashkamaReference(leaves[1]), { reference: page, anchor: 'leaf:1', migrated: true, nusach: 'edot-hamizrach' });
  assert.equal(migrateHashkamaReference(leaves[0]).anchor, null);
  assert.equal(migrateHashkamaReference(page).reference, page);
  assert.equal(migrateHashkamaReference('Siddur Edot HaMizrach, Weekday Shacharit, Hodu').reference, 'Siddur Edot HaMizrach, Weekday Shacharit, Hodu');
  // The Siddur home's "המשך קריאה" (reader-progress-v1 kept { flowKey: leaf }) finds the page.
  const root = hashkamaRootOf('edot-hamizrach');
  const progress = { 'Preparatory Prayers': leaves[2] };
  const kept = Object.values(progress).map(value => migrateHashkamaReference(value).reference);
  assert.ok(root.items.find(item => kept.includes(item.reference)));
  // A History entry (or "להמשיך מהיכן שהפסקת") of the old three-page flow becomes the page with its flow.
  const old = { reference: leaves[2], title: 'ברכות התורה', mode: 'nikud', navigation: { flowKey: 'Preparatory Prayers', flow: leaves.map(reference => ({ reference, title: 'x', mode: 'nikud' })), index: 2, returnRoute: 'siddur' } };
  const entry = migrateSourceEntry(old);
  assert.equal(entry.reference, page);
  assert.equal(entry.anchor, 'leaf:2');
  assert.equal(entry.navigation.flow.length, 1);
  assert.equal(entry.navigation.continueTo.reference, HASHKAMA_CONTINUE);
  assert.equal(migrateSourceEntry({ reference: leaves[0], title: 'מודה אני' }).reference, page);
  assert.equal(migrateSourceEntry({ reference: page, title: HASHKAMA_TITLE }).navigation.flowKey, 'Preparatory Prayers');
  // Sefard: a leaf the page shares with the printed Shacharit flow stays where that flow opened it.
  const sefardShacharit = 'Siddur Sefard, Weekday Shacharit, Morning Blessings';
  const inShacharit = { reference: sefardShacharit, title: 'ברכות השחר', navigation: { flowKey: 'Weekday Shacharit', flow: [{ reference: sefardShacharit, title: 'ברכות השחר' }], index: 0 } };
  assert.equal(migrateSourceEntry(inShacharit), inShacharit);
  // Changing the rite on the page keeps the reader on the other rite's page.
  const hit = counterpartIn({ rootEn: 'Preparatory Prayers', en: 'Modeh Ani' }, rootsOf('sefard'), { toNusach: 'sefard' });
  assert.equal(hit.item.reference, hashkamaReference('sefard'));
});
