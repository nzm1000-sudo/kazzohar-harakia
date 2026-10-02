// Every Shacharit opens with the COMPLETE ברכות השחר of its own rite, in that rite's order, with no word changed —
// in every entry point: the composed service of each rite (weekday and Shabbat, today's prayer and the full edition)
// and the Smart Siddur's day service (Edot HaMizrach, on every day it composes). The blessings are not listed here by
// hand: they are read from each rite's own edition — every paragraph of the leaves the edition titles ברכות השחר,
// ברכות התורה, נטילת ידים, אשר יצר or אלהי נשמה, in the place where that rite prints its morning — and compared letter by
// letter with the opening part of the prayer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HDate } from '@hebcal/core';
import { COMPOSITIONS } from '../src/data/nusach/compositions/index.mjs';
import { NUSACH_INDEX } from '../src/data/nusach/registry.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { composeRiteService, resolveService, whenHolds, compositionConditions, prayerNavItems } from '../src/services/prayer/riteServiceComposer.mjs';
import { planDayService, dayServiceSupport, birchotHashacharSteps, BIRCHOT_HASHACHAR_TITLE } from '../src/services/prayer/dayServicePlan.mjs';
import { composeDayService, liturgyText } from '../src/services/prayer/dayServiceComposer.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { removeNikud } from '../src/hebrewText.mjs';
import siddurOffline from '../src/data/siddurOffline.mjs';

const JERUSALEM = { location: { latitude: 31.778, longitude: 35.235, tzid: 'Asia/Jerusalem', name: 'ירושלים' }, halachicResidenceStatus: 'israel', il: true };
const civil = hdate => { const d = hdate.greg(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const morning = key => JewishContextEngine({ now: new Date(`${key}T05:00:00Z`), settings: JERUSALEM, times: {}, prayerType: 'shacharit' });
const WEEKDAY = civil(new HDate(22, 'Cheshvan', 5787));
const SHABBAT = civil(new HDate(27, 'Cheshvan', 5787));
const TISHA_BAV = civil(new HDate(9, 'Av', 5787));
const dayOf = serviceId => (serviceId.startsWith('shabbat') ? SHABBAT : WEEKDAY);

// Hebrew letters only: the wording, with points, cantillation, punctuation, spacing and markup set aside.
const letters = text => removeNikud(String(text || '').replace(/<[^>]+>/g, ' ')).replace(/[^א-ת]/g, '');
const BIRCHOT_LEAVES = new Set(['ברכות השחר', 'ברכות התורה', 'נטילת ידים', 'נטילת ידיים', 'אשר יצר', 'אלהי נשמה']);
// Where each rite's edition prints its morning (a root of its own tree, not a list of blessings). Shabbat: Ashkenaz
// prints a Shabbat morning of its own; Sefard says "as on a weekday up to Hodu"; Chabad's Shabbat edition (Tehillat
// Hashem) has its own "The Morning Blessings".
const MORNING_ROOTS = {
  'edot-hamizrach': { weekday: 'Siddur Edot HaMizrach, Preparatory Prayers', shabbat: 'Siddur Edot HaMizrach, Preparatory Prayers' },
  ashkenaz: { weekday: 'Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers', shabbat: 'Siddur Ashkenaz, Shabbat, Shacharit, Preparatory Prayers' },
  sefard: { weekday: 'Siddur Sefard, Weekday Shacharit', shabbat: 'Siddur Sefard, Weekday Shacharit' },
  chabad: { weekday: 'Weekday Siddur Chabad, Shacharit', shabbat: 'Siddur Tehillat Hashem, The Morning Blessings' },
};

const packs = {};
for (const id of Object.keys(COMPOSITIONS)) packs[id] = await loadSiddur(id);

// The leaves of a root (its direct children) that the edition itself titles as one of the morning blessings.
function birchotLeaves(nusach, rootRef) {
  const pack = packs[nusach];
  const trees = [{ index: NUSACH_INDEX[nusach].index, nodes: pack.schema.nodes }, ...(pack.extraSchemas || [])];
  for (const tree of trees) {
    if (!rootRef.startsWith(`${tree.index}, `)) continue;
    const path = rootRef.slice(tree.index.length + 2).split(', ');
    let nodes = tree.nodes; let root = null;
    for (const name of path) { root = (nodes || []).find(node => (node.title || node.key) === name); nodes = root?.nodes; }
    assert.ok(root?.nodes, `${nusach}: no root ${rootRef}`);
    return { rootHe: root.heTitle, leaves: root.nodes.filter(node => BIRCHOT_LEAVES.has(node.heTitle)).map(node => ({ ref: `${rootRef}, ${node.title || node.key}`, he: node.heTitle })) };
  }
  throw new Error(`no tree for ${rootRef}`);
}

const shacharitServices = Object.entries(COMPOSITIONS).flatMap(([nusach, composition]) => ['weekday-shacharit', 'shabbat-shacharit'].filter(id => composition.services[id]).map(serviceId => ({ nusach, serviceId, composition })));

test('every rite has both Shacharit services composed (weekday and Shabbat)', () => {
  for (const nusach of Object.keys(COMPOSITIONS)) for (const id of ['weekday-shacharit', 'shabbat-shacharit']) assert.ok(COMPOSITIONS[nusach].services[id], `${nusach}/${id}`);
});

test('the composed Shacharit of every rite opens with the part ברכות השחר — today\'s prayer and the full edition, weekday and Shabbat', () => {
  for (const { nusach, serviceId, composition } of shacharitServices) {
    for (const mode of ['prayer', 'edition']) {
      const doc = composeRiteService({ composition, serviceId, texts: packs[nusach].texts, context: morning(dayOf(serviceId)), mode });
      const where = `${nusach}/${serviceId}/${mode}`;
      assert.equal(doc.parts[0]?.id, 'birchot-hashachar', where);
      assert.equal(doc.parts[0].title, 'ברכות השחר', where);
      assert.equal(doc.sections[0].part, 'birchot-hashachar', `${where}: the first section belongs to ברכות השחר`);
      assert.equal(doc.sections[0].partStart, true, `${where}: the part's heading opens the prayer`);
      // One run from the top: no section of another part inside it.
      const last = doc.sections.map(section => section.part).lastIndexOf('birchot-hashachar');
      assert.ok(doc.sections.slice(0, last + 1).every(section => section.part === 'birchot-hashachar'), `${where}: one run`);
      const concepts = new Set(doc.sections.slice(0, last + 1).map(section => section.concept));
      for (const concept of ['morning-blessings', 'torah-blessings']) assert.ok(concepts.has(concept), `${where}: ${concept}`);
      // The contents list (the docked "תוכן") begins with the part.
      const nav = prayerNavItems(doc.sections);
      assert.deepEqual({ title: nav[0].title, part: nav[0].part, id: nav[0].id }, { title: 'ברכות השחר', part: true, id: 'part-birchot-hashachar' }, where);
      assert.equal(nav.filter(item => item.part).length, 1, `${where}: the part is listed once`);
    }
  }
});

test('ברכות השחר is complete: every paragraph the rite\'s own edition prints in its morning blessings is in the opening part, letter for letter', () => {
  for (const { nusach, serviceId, composition } of shacharitServices) {
    const service = composition.services[serviceId];
    const texts = packs[nusach].texts;
    const context = morning(dayOf(serviceId));
    const conditions = compositionConditions(context);
    const doc = composeRiteService({ composition, serviceId, texts, context, mode: 'prayer' });
    const part = doc.sections.filter(section => section.part === 'birchot-hashachar');
    const partIds = new Set(part.map(section => section.id));
    const partLetters = letters(part.flatMap(section => section.blocks.map(block => block.text)).join(' '));
    const resolved = resolveService(service, texts);
    const titles = new Set([...service.sections.map(section => letters(section.title)), letters('ברכות השחר')].filter(Boolean));
    const { rootHe, leaves } = birchotLeaves(nusach, MORNING_ROOTS[nusach][serviceId.startsWith('shabbat') ? 'shabbat' : 'weekday']);
    assert.ok(leaves.some(leaf => leaf.he === 'ברכות השחר'), `${nusach}/${serviceId}: the edition's ברכות השחר leaf`);
    let checked = 0;
    for (const leaf of leaves) {
      const paragraphs = texts[leaf.ref]?.he || [];
      assert.ok(paragraphs.length, `${nusach}: ${leaf.ref} is in the pack`);
      paragraphs.forEach((markup, index) => {
        const words = letters(markup);
        if (!words) return; // an English instruction (Tehillat Hashem) or an empty line
        if (titles.has(words) || words === letters(leaf.he) || words === letters(rootHe)) return; // an edition heading, replaced by the reviewed title
        const owner = resolved.find(section => section.ref === leaf.ref && section.from <= index && index <= section.to);
        // The edition's own one-line heading at the top of a section ("סדר נטילת ידים", "ברכת אשר יצר"): the section's
        // reviewed title stands in its place — a heading, not a blessing.
        if (owner && !owner.omit && index === owner.from && words.length <= 20 && !words.includes('ברוך')) return;
        if (owner?.omit) { assert.ok(owner.why, `${nusach}/${serviceId}: ${leaf.ref} ¶${index} omitted without a reason`); return; }
        // The same leaf goes on to the Tallit / Tefillin (Chabad's Tehillat Hashem): those sections follow the part.
        if (owner && !partIds.has(owner.id) && ['tallit', 'tefillin'].includes(owner.concept)) return;
        // A section the day does not take (e.g. שעשה לי כל צרכי on Tisha B'Av) — not on the days tested here.
        if (owner?.when && !whenHolds(owner.when, conditions)) return;
        assert.ok(owner && partIds.has(owner.id), `${nusach}/${serviceId}: ${leaf.ref} ¶${index} is not in ברכות השחר`);
        assert.ok(partLetters.includes(words), `${nusach}/${serviceId}: ${leaf.ref} ¶${index} — wording differs or missing: ${removeNikud(markup).slice(0, 60)}`);
        checked += 1;
      });
    }
    assert.ok(checked >= 8, `${nusach}/${serviceId}: ${checked} paragraphs compared`);
  }
});

test('nothing is added or reworded in ברכות השחר: every shown block is its own edition\'s words, from its own section\'s paragraphs', () => {
  for (const { nusach, serviceId, composition } of shacharitServices) {
    const texts = packs[nusach].texts;
    const doc = composeRiteService({ composition, serviceId, texts, context: morning(dayOf(serviceId)), mode: 'prayer' });
    const resolved = new Map(resolveService(composition.services[serviceId], texts).map(section => [section.id, section]));
    for (const section of doc.sections.filter(item => item.part === 'birchot-hashachar')) {
      const source = resolved.get(section.id);
      const sourceLetters = letters(texts[source.ref].he.slice(source.from, source.to + 1).join(' '));
      for (const block of section.blocks) assert.ok(sourceLetters.includes(letters(block.text)), `${nusach}/${serviceId}/${section.id}: "${removeNikud(block.text).slice(0, 50)}" is not the edition's`);
    }
  }
});

test('the rite\'s own condition holds: "בתשעה באב ויום הכיפורים אין אומרים ברכה זו" — שעשה לי כל צרכי is left out on Tisha B\'Av only', () => {
  const sheAsaLi = letters('שעשה לי כל צרכי');
  for (const nusach of ['edot-hamizrach', 'sefard', 'chabad']) {
    const composition = COMPOSITIONS[nusach];
    const at = key => composeRiteService({ composition, serviceId: 'weekday-shacharit', texts: packs[nusach].texts, context: morning(key), mode: 'prayer' });
    const partText = doc => letters(doc.sections.filter(section => section.part === 'birchot-hashachar').flatMap(section => section.blocks.map(block => block.text)).join(' '));
    assert.ok(partText(at(WEEKDAY)).includes(sheAsaLi), `${nusach}: said on a weekday`);
    const tishaBav = at(TISHA_BAV);
    assert.ok(!partText(tishaBav).includes(sheAsaLi), `${nusach}: not on Tisha B'Av`);
    assert.ok(partText(tishaBav).includes(letters('אוזר ישראל בגבורה')), `${nusach}: the blessings after it stay`);
  }
});

// The Smart Siddur (Edot HaMizrach) composes these days itself.
const SMART_DAYS = {
  'rosh-chodesh': new HDate(1, 'Kislev', 5787),
  chanukah: new HDate(27, 'Kislev', 5787),
  fast: new HDate(10, 'Tevet', 5787),
  purim: new HDate(14, 'Adar', 5787),
  'chol-hamoed-sukkot': new HDate(17, 'Tishrei', 5787),
  'chol-hamoed-pesach': new HDate(18, 'Nisan', 5787),
  'shemini-atzeret': new HDate(22, 'Tishrei', 5787),
};

test('the Smart Siddur\'s Shacharit opens with the whole ברכות השחר of Edot HaMizrach on every day it composes', () => {
  const leaves = birchotLeaves('edot-hamizrach', MORNING_ROOTS['edot-hamizrach'].weekday).leaves.map(leaf => leaf.ref);
  const modehAni = 'Siddur Edot HaMizrach, Preparatory Prayers, Modeh Ani';
  for (const [reason, hdate] of Object.entries(SMART_DAYS)) {
    const context = morning(civil(hdate));
    assert.equal(dayServiceSupport(context).reason, reason, civil(hdate));
    const plan = planDayService({ prayer: 'shacharit', context });
    assert.deepEqual(plan.steps.slice(0, 3).map(step => step.ref), [modehAni, ...leaves], reason);
    const doc = composeDayService(plan, context);
    const first = doc.sections[0];
    assert.equal(first.id, 'birchot-hashachar', reason);
    assert.equal(first.title, BIRCHOT_HASHACHAR_TITLE, reason);
    assert.equal(first.part, true, reason);
    assert.ok(!doc.sections.slice(1).some(section => section.part), `${reason}: one part`);
    const shown = letters(first.blocks.map(block => block.text).join(' '));
    for (const ref of [modehAni, ...leaves]) {
      const all = liturgyText(ref);
      all.forEach((markup, index) => {
        const words = letters(markup);
        // The edition's top headings ("סדר השכמת הבוקר", "ברכות השחר") give way to the part's own title.
        if (!words || words === letters('סדר השכמת הבוקר') || words === letters(BIRCHOT_HASHACHAR_TITLE)) return;
        assert.ok(shown.includes(words), `${reason}: ${ref} ¶${index} missing or reworded`);
      });
    }
    // and nothing that is not the edition's
    const source = letters([modehAni, ...leaves].flatMap(ref => liturgyText(ref)).join(' '));
    for (const block of first.blocks) assert.ok(source.includes(letters(block.text)), `${reason}: ${removeNikud(block.text).slice(0, 40)}`);
  }
});

test('the Smart Siddur leaves out שעשה לי כל צרכי where the edition says so (its own caption, ¶15–16)', () => {
  const blessings = liturgyText('Siddur Edot HaMizrach, Preparatory Prayers, Morning Blessings');
  assert.match(removeNikud(blessings[15]), /בתשעה באב ויום הכיפורים אין אומרים ברכה זו/);
  assert.ok(letters(blessings[16]).includes(letters('שעשה לי כל צרכי')));
  const [, onTishaBav] = birchotHashacharSteps({ tishaBav: true });
  assert.deepEqual(onTishaBav.ranges, [[0, 14], [17, blessings.length - 1]]);
  assert.equal(birchotHashacharSteps({})[1].ranges, undefined);
  assert.ok(siddurOffline.texts['Siddur Edot HaMizrach, Preparatory Prayers, Torah Blessings']);
});

test('the part\'s heading is centred with the title ornament; section titles of a composed prayer are centred; the reading text is not', () => {
  const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
  assert.match(css, /\.prayer-part-head\{[^}]*justify-items:center[^}]*text-align:center/);
  assert.match(css, /\.composed-prayer-text \.day-service-section-title[^{]*\{text-align:center\}/);
  assert.match(css, /\.composed-prayer>h2\.siddur-heading,\.composed-prayer>\.composed-status\{text-align:center\}/);
  assert.doesNotMatch(css, /\.composed-prayer-text \.reading-prayer[^{]*\{[^}]*text-align:center/);
  for (const file of ['RiteServiceReader.jsx', 'DayServiceReader.jsx']) {
    const source = readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
    assert.match(source, /prayer-part-head/, file);
    assert.match(source, /<TitleOrnament \/>/, file);
  }
  const nav = readFileSync(new URL('../src/components/PrayerSectionNav.jsx', import.meta.url), 'utf8');
  assert.match(nav, /prayer-nav-part/);
});
