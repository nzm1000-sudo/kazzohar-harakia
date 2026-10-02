// The multi-rite Siddur: four distinct traditions, each from its own licensed edition, bundled offline; the registry,
// the licence manifest, the layouts, the flows, the day conditions inside every rite's text, and rite switching.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NUSACHIM, NUSACH_IDS, nusachOf, nusachForReference, DEFAULT_NUSACH } from '../src/data/nusach/registry.mjs';
import { SIDDUR_SOURCES, LICENSE_ALLOWLIST, normalizeLicense, licenseAllowed } from '../src/data/nusach/manifest.mjs';
import { SIDDUR_LAYOUTS, siddurLayout, prayerRootFor, halachaConceptForTitle } from '../src/data/nusach/siddurLayouts.mjs';
import { loadSiddur, siddurIndexTitle } from '../src/services/nusach.mjs';
import { siddurRoots, buildSiddurFlows, counterpartIn, resolveRoot } from '../src/services/siddurIndex.mjs';
import { getIndex, getText } from '../src/services/sefaria.mjs';
import { normalizeSettings } from '../src/services.mjs';
import { NUSACH, JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { normalizeSiddurBlocks } from '../src/services/siddurBlocks.mjs';
import { buildSiddurConditionSummary, shouldDisplaySiddurSection } from '../src/services/siddurConditionEngine.mjs';
import { dayServiceSupport } from '../src/services/prayer/dayServicePlan.mjs';
import { prayerRootKey } from '../src/services/smartPrayer.mjs';
import { removeNikud, normalizeHebrewText } from '../src/hebrewText.mjs';
import { SIDDUR_HALACHA } from '../src/data/halachaSiddurLinks.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const packs = Object.fromEntries(await Promise.all(NUSACH_IDS.map(async id => [id, await loadSiddur(id)])));
const CANTILLATION = /[֑-֯]/;
const NIKUD = /[ְ-ּ]/;
const LATIN = /[A-Za-z]{4,}/;
const UNPOINTED_IN_SOURCE = new Set(['Siddur Ashkenaz, Shabbat, Daytime Meal, Kiddusha Rabba', 'Siddur Ashkenaz, Shabbat, Daytime Meal, Zemirot for Second Meal, Ki Eshmera', 'Siddur Ashkenaz, Berachot, Asher Yatzar Etchem Badin',
  // Tehillat Hashem prints the laws of the Sukkah (Shulchan Aruch HaRav) unpointed, with their English translation.
  'Siddur Tehillat Hashem, The Holiday of Sukkot, Laws Regarding the Sukkah']);

test('four distinct rites with stable ids; Sefard is never an alias of Edot HaMizrach; the default stays Edot HaMizrach', () => {
  assert.deepEqual(NUSACH_IDS, ['edot-hamizrach', 'ashkenaz', 'sefard', 'chabad']);
  assert.deepEqual(Object.values(NUSACH), NUSACH_IDS);
  assert.equal(DEFAULT_NUSACH, 'edot-hamizrach');
  assert.equal(NUSACHIM.find(item => item.id === 'sefard').index, 'Siddur Sefard');
  assert.equal(NUSACHIM.find(item => item.id === 'edot-hamizrach').index, 'Siddur Edot HaMizrach');
  assert.notEqual(siddurIndexTitle('sefard'), siddurIndexTitle('edot-hamizrach'));
  // Migration: an install without a rite, or with an unknown one, keeps Edot HaMizrach; a chosen rite is kept.
  assert.equal(normalizeSettings({}).nusach, 'edot-hamizrach');
  assert.equal(normalizeSettings({ nusach: 'sephardi' }).nusach, 'edot-hamizrach');
  assert.equal(normalizeSettings({ nusach: 'chabad' }).nusach, 'chabad');
  assert.equal(nusachOf({ nusach: 'ashkenaz' }), 'ashkenaz');
  assert.equal(JewishContextEngine({ now: new Date('2026-11-03T10:00:00Z'), settings: { nusach: 'sefard', location: { tzid: 'Asia/Jerusalem' } } }).profile.nusach, 'sefard');
  assert.equal(JewishContextEngine({ now: new Date('2026-11-03T10:00:00Z'), settings: { nusach: 'bogus', location: { tzid: 'Asia/Jerusalem' } } }).profile.nusach, 'edot-hamizrach');
});

test('licence manifest: every rite has a source, licence, attribution and access date; every bundled leaf carries an allowed licence', () => {
  for (const id of NUSACH_IDS) {
    const source = SIDDUR_SOURCES[id];
    for (const field of ['index', 'work', 'version', 'editor', 'provider', 'sourceUrl', 'license', 'licenseUrl', 'attribution', 'accessedAt']) assert.ok(source[field], `${id}.${field}`);
    assert.equal(source.modified, false, `${id}: the edition is never retyped`);
    assert.match(source.accessedAt, /^\d{4}-\d{2}-\d{2}$/);
    const pack = packs[id];
    assert.ok(Object.keys(pack.texts).length > 40, `${id}: bundled`);
    // A rite may hold a second licensed edition of its own (Chabad: Tehillat Hashem), declared in the manifest.
    const editionOf = ref => [source, ...(source.extraEditions || [])].find(edition => ref.startsWith(`${edition.index}, `));
    for (const extra of source.extraEditions || []) for (const field of ['index', 'work', 'version', 'provider', 'sourceUrl', 'license', 'attribution', 'accessedAt', 'changes']) assert.ok(extra[field], `${id} extra edition ${field}`);
    for (const [ref, text] of Object.entries(pack.texts)) {
      const edition = editionOf(ref);
      assert.ok(edition, `${id}: ${ref} belongs to another edition`);
      const verdict = licenseAllowed(edition, text.heVersionTitle, text.heLicense);
      assert.ok(verdict.ok, `${id}: ${ref} · ${text.heVersionTitle} · ${text.heLicense}`);
      // The one exception to the open-licence list: the owner's own typing, vouched for by name in the manifest.
      if (text.heLicense === 'Owner') { assert.equal(edition.index, 'Siddur Chabad Owner Transcription'); continue; }
      assert.ok(LICENSE_ALLOWLIST.includes(normalizeLicense(text.heLicense) || verdict.license), `${id}: ${ref} licence ${text.heLicense}`);
    }
  }
  assert.equal(normalizeLicense('unknown'), null);
  assert.equal(licenseAllowed(SIDDUR_SOURCES.ashkenaz, 'Some Edition', 'unknown').ok, false, 'an unknown licence is never bundled by accident');
  assert.equal(licenseAllowed(SIDDUR_SOURCES.chabad, 'Wikisource', 'unknown').ok, true, 'the Chabad version vouched for by hand (Wikisource CC BY-SA, public-domain siddur)');
  assert.match(SIDDUR_SOURCES.chabad.provenanceUrl, /he\.wikisource\.org/);
  assert.match(SIDDUR_SOURCES.sefard.work, /נוסח ספרד החסידי/);
});

test('text verification: no empty section, no cantillation, nikud preserved, no Latin, no doubled paragraphs, no cross-rite leaf', () => {
  for (const id of NUSACH_IDS) {
    const pack = packs[id];
    for (const [ref, text] of Object.entries(pack.texts)) {
      const body = text.he.join(' ');
      assert.ok(text.he.some(paragraph => paragraph.trim()), `${id}: ${ref} is empty`);
      // The siddur reading policy strips any te'amim an edition prints in a Torah quotation: none reaches the prayer text.
      assert.ok(!CANTILLATION.test(text.he.map(paragraph => normalizeHebrewText(paragraph, 'siddur')).join(' ')), `${id}: ${ref} shows cantillation`);
      // Nikud is preserved everywhere: the only unpointed leaves are the editions' instruction leaves and three leaves
      // the Ashkenaz edition itself prints without nikud (reported as partial in the completeness matrix).
      // …and a leaf of the edition's own English instructions (Tehillat Hashem's "Laws Regarding the Sukkah").
      const englishOnly = text.he.every(paragraph => !paragraph.trim() || /^\s*<small class="en/.test(paragraph));
      if (!NIKUD.test(body)) assert.ok(englishOnly || UNPOINTED_IN_SOURCE.has(ref) || /^\s*<small>|אומרים|מדלגים|נוהגים|קוראים|יאמר|הש"ץ|הש״ץ/.test(body), `${id}: ${ref} has no nikud`);
      // English appears only as an edition's own marked instructions (<small class="en">), never in the prayer.
      assert.ok(!LATIN.test(body.replace(/<small class="en[^"]*">[\s\S]*?<\/small>/g, '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '')), `${id}: ${ref} has Latin text`);
      const long = text.he.filter(paragraph => removeNikud(paragraph).replace(/<[^>]+>/g, '').length > 120);
      const seen = new Set();
      for (const paragraph of long) {
        const key = removeNikud(paragraph).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
        // A refrain (Hallel, Hoshanot, Kaddish) legitimately repeats; an accidental double is two identical long paragraphs in a row.
        assert.ok(!(seen.has(key) && text.he.indexOf(paragraph) > 0 && text.he[text.he.indexOf(paragraph) - 1] === paragraph), `${id}: ${ref} repeats a paragraph`);
        seen.add(key);
      }
    }
    for (const other of NUSACH_IDS.filter(item => item !== id)) for (const ref of Object.keys(packs[other].texts)) assert.ok(!(ref in pack.texts), `${id} carries ${ref}`);
  }
});

test('the four rites really differ: the weekday Amidah and Kedusha are not the same words', () => {
  const amidah = {
    'edot-hamizrach': 'Siddur Edot HaMizrach, Weekday Shacharit, Amida',
    ashkenaz: 'Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs',
    sefard: 'Siddur Sefard, Weekday Shacharit, Amidah',
    chabad: 'Weekday Siddur Chabad, Shacharit, The Amidah',
  };
  const plain = id => removeNikud(packs[id].texts[amidah[id]].he.join(' ')).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  const texts = Object.fromEntries(NUSACH_IDS.map(id => [id, plain(id)]));
  for (const id of NUSACH_IDS) assert.ok(texts[id].includes('מגן אברהם') || texts[id].includes('אבות'), `${id}: an Amidah`);
  // Ashkenaz Kedusha: "נקדש את שמך"; Sefard/Edot/Chabad: "נקדישך ונעריצך".
  const kedusha = { ashkenaz: packs.ashkenaz.texts['Siddur Ashkenaz, Weekday, Shacharit, Amidah, Kedushah'], sefard: packs.sefard.texts[amidah.sefard], chabad: packs.chabad.texts[amidah.chabad], 'edot-hamizrach': packs['edot-hamizrach'].texts[amidah['edot-hamizrach']] };
  const k = id => removeNikud(kedusha[id].he.join(' ').replace(/\u05BE/g, ' ')).replace(/<[^>]+>/g, '');
  assert.match(k('ashkenaz'), /נקדש את שמך/);
  assert.match(k('sefard'), /נקדישך ונעריצך/);
  assert.match(k('chabad'), /נקדישך ונעריצך/);
  assert.match(k('edot-hamizrach'), /נקדישך ונעריצך/);
  // Sefard is a Chassidic rite: its Hodu precedes Baruch She'amar (a distinct root), and its text is not Edot HaMizrach's.
  assert.ok(packs.sefard.texts['Siddur Sefard, Weekday Shacharit, Hodu']);
  assert.notEqual(texts.sefard, texts['edot-hamizrach']);
  assert.notEqual(texts.ashkenaz, texts.sefard);
  assert.notEqual(texts.chabad, texts.sefard);
  // Chabad: the Alter Rebbe's siddur; "מוריד הטל" in summer is printed in the Amidah itself.
  assert.match(texts.chabad, /מוריד הטל/);
});

test('every rite opens offline through the data layer: index and texts, compound (multi-leaf) pages, paragraph ranges', async () => {
  for (const id of NUSACH_IDS) {
    const index = await getIndex(siddurIndexTitle(id));
    assert.ok(index.schema.nodes.length, id);
  }
  const ashkenazAmidah = await getText('Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs; Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might');
  assert.equal(ashkenazAmidah.bundledOffline, true);
  assert.ok(ashkenazAmidah.hebrew.length > 10);
  const chabadMaariv = await getText('Weekday Siddur Chabad, Maariv');
  assert.equal(chabadMaariv.bundledOffline, true);
  const range = await getText('Siddur Sefard, Weekday Shacharit, Amidah 1-6');
  assert.equal(range.bundledOffline, true);
  assert.equal(range.hebrew.length, 6);
  assert.equal(nusachForReference('Weekday Siddur Chabad, Mincha, Amidah'), 'chabad');
  assert.equal(nusachForReference('Siddur Edot HaMizrach, Weekday Mincha, Amida'), 'edot-hamizrach');
  assert.equal(nusachForReference('Genesis 1'), null);
});

test('layouts: every root of every rite exists in its edition; the weekday and Shabbat prayers resolve; Chabad Shabbat is honestly missing', () => {
  for (const id of NUSACH_IDS) {
    const layout = siddurLayout(id);
    const nodes = packs[id].schema.nodes;
    for (const group of layout.groups) for (const path of group.roots) if (Array.isArray(path)) assert.ok(resolveRoot(nodes, path), `${id}: ${path.join(' > ')}`);
    for (const path of layout.moadimRoots || []) assert.ok(resolveRoot(nodes, path), `${id}: ${path.join(' > ')}`);
    const roots = siddurRoots(nodes, siddurIndexTitle(id), layout, () => true, { has: ref => Boolean(packs[id].texts[ref]) });
    for (const prayer of ['shacharit', 'mincha', 'maariv']) {
      const key = prayerRootFor(id, prayer);
      assert.ok(roots.some(root => root.key === key), `${id}: ${prayer} → ${key}`);
      assert.equal(prayerRootKey(prayer, { nusach: id }), key);
    }
    for (const root of roots) for (const item of root.items) {
      assert.ok(item.reference.split('; ').every(ref => packs[id].texts[ref] || /^Song of Songs \d$/.test(ref)), `${id}: ${root.key} › ${item.en} has an address outside the pack`);
      assert.ok(item.title, `${id}: ${root.key} › ${item.en} has no title`);
    }
  }
  assert.equal(siddurLayout('chabad').prayerRoots.shabbat, null);
  assert.match(siddurLayout('chabad').groups.find(group => group.key === 'shabbat').missing, /אינן במקור המורשה/);
  assert.equal(prayerRootKey('shacharit', { isShabbat: true, nusach: 'chabad' }), 'Shacharit', 'the weekday root, never another rite');
  assert.equal(prayerRootKey('mincha'), 'Weekday Mincha', 'without a rite: Edot HaMizrach, unchanged');
  assert.equal(prayerRootKey('maariv', { isShabbat: true, nusach: 'ashkenaz' }), 'Shabbat, Maariv');
  // Ashkenaz reads its many small leaves as one page per group (the whole Amidah is one row).
  const ashkenaz = siddurRoots(packs.ashkenaz.schema.nodes, 'Siddur Ashkenaz', siddurLayout('ashkenaz'), () => true, { has: ref => Boolean(packs.ashkenaz.texts[ref]) });
  const amidah = ashkenaz.find(root => root.key === 'Weekday, Shacharit').items.find(item => item.en === 'Amidah');
  assert.ok(amidah.reference.split('; ').length >= 19);
  assert.equal(amidah.concept, 'amida');
});

test('the day conditions live inside every rite\'s text: summer/winter, rain, Ten Days, Rosh Chodesh, fast, Chanukah', () => {
  const settings = id => ({ nusach: id, halachicResidenceStatus: 'israel', location: { tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235 } });
  const render = (id, ref, iso, prayerType = 'shacharit') => {
    const context = JewishContextEngine({ now: new Date(iso), settings: settings(id), prayerType });
    const refs = ref.split('; ');
    const paragraphs = refs.flatMap(part => packs[id].texts[part].he.map((text, index) => ({ text: text.replace(/<[^>]+>/g, ' '), source: index })));
    const markup = refs.flatMap(part => packs[id].texts[part].he);
    // What is recited (not the edition's halachic notes, which may quote the other season's words).
    return removeNikud(normalizeSiddurBlocks(paragraphs, { title: ref, markup, context }).filter(block => block.display === 'prayer').map(block => block.text).join(' | '));
  };
  const summer = '2026-06-10T07:00:00Z'; // Sivan: מוריד הטל, ברכה
  const winter = '2026-12-16T07:00:00Z'; // 6 Tevet, a plain Wednesday: משיב הרוח, טל ומטר, no Chanukah, no Rosh Chodesh
  const chanukah = '2026-12-08T07:00:00Z'; // 28 Kislev 5787
  const aseret = '2026-09-15T07:00:00Z'; // 4 Tishrei 5787
  const roshChodesh = '2026-11-10T07:00:00Z'; // 30 Cheshvan 5787
  // Ashkenaz: each blessing is a leaf.
  const ashkGevurot = 'Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might';
  const ashkShanim = 'Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity';
  assert.match(render('ashkenaz', ashkGevurot, summer), /מוריד הטל/); assert.doesNotMatch(render('ashkenaz', ashkGevurot, summer), /משיב הרוח/);
  assert.match(render('ashkenaz', ashkGevurot, winter), /משיב הרוח/); assert.doesNotMatch(render('ashkenaz', ashkGevurot, winter), /מוריד הטל/);
  assert.match(render('ashkenaz', ashkShanim, winter), /טל ומטר לברכה/);
  assert.doesNotMatch(render('ashkenaz', ashkShanim, summer), /טל ומטר/);
  assert.match(render('ashkenaz', 'Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs', aseret), /זכרנו לחיים/);
  assert.doesNotMatch(render('ashkenaz', 'Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs', winter), /זכרנו לחיים/);
  const ashkAvoda = 'Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service';
  assert.match(render('ashkenaz', ashkAvoda, roshChodesh), /יעלה ויבא/);
  assert.doesNotMatch(render('ashkenaz', ashkAvoda, winter), /יעלה ויבא/);
  // Sefard: one Amidah leaf.
  const sefardAmidah = 'Siddur Sefard, Weekday Shacharit, Amidah';
  assert.match(render('sefard', sefardAmidah, summer), /מוריד הטל/); assert.doesNotMatch(render('sefard', sefardAmidah, summer), /משיב הרוח ומוריד הגשם/);
  assert.match(render('sefard', sefardAmidah, winter), /משיב הרוח ומוריד הגשם/); assert.doesNotMatch(render('sefard', sefardAmidah, winter), /מוריד הטל/);
  assert.match(render('sefard', sefardAmidah, chanukah), /ועל הנסים/);
  assert.doesNotMatch(render('sefard', sefardAmidah, winter), /ועל הנסים/);
  assert.match(render('sefard', sefardAmidah, aseret), /המלך הקדוש/);
  // Chabad: captions inside the paragraph.
  const chabadAmidah = 'Weekday Siddur Chabad, Shacharit, The Amidah';
  assert.match(render('chabad', chabadAmidah, summer), /מוריד הטל/); assert.doesNotMatch(render('chabad', chabadAmidah, summer), /משיב הרוח/);
  assert.match(render('chabad', chabadAmidah, winter), /משיב הרוח/); assert.doesNotMatch(render('chabad', chabadAmidah, winter), /מוריד הטל/);
  assert.match(render('chabad', chabadAmidah, winter), /טל ומטר לברכה/);
  assert.match(render('chabad', chabadAmidah, chanukah), /ועל הנסים ועל הפרקן/);
  assert.doesNotMatch(render('chabad', chabadAmidah, winter), /ועל הנסים ועל הפרקן/);
  assert.match(render('chabad', chabadAmidah, aseret), /זכרנו לחיים/);
  assert.doesNotMatch(render('chabad', chabadAmidah, winter), /זכרנו לחיים/);
  // Edot HaMizrach: unchanged.
  const edotAmidah = 'Siddur Edot HaMizrach, Weekday Shacharit, Amida';
  assert.match(render('edot-hamizrach', edotAmidah, winter), /משיב הרוח/);
  assert.doesNotMatch(render('edot-hamizrach', edotAmidah, summer), /משיב הרוח/);
});

test('section rules follow the rite\'s names and the Diaspora: Tachnun, "outside of Israel", Motzaei Shabbat additions', () => {
  const settings = status => ({ nusach: 'ashkenaz', halachicResidenceStatus: status, location: { tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235 } });
  const weekday = JewishContextEngine({ now: new Date('2026-11-03T10:00:00Z'), settings: settings('israel'), prayerType: 'shacharit' });
  const summary = buildSiddurConditionSummary(weekday);
  assert.equal(shouldDisplaySiddurSection('Tachnun', summary), true);
  assert.equal(shouldDisplaySiddurSection("Baruch Hashem Le'olam (outside of Israel)", summary), false, 'Eretz Yisrael: not said');
  const diaspora = buildSiddurConditionSummary(JewishContextEngine({ now: new Date('2026-11-03T10:00:00Z'), settings: settings('diaspora'), prayerType: 'maariv' }));
  assert.equal(shouldDisplaySiddurSection("Baruch Hashem Le'olam (outside of Israel)", diaspora), true);
  const roshChodesh = buildSiddurConditionSummary(JewishContextEngine({ now: new Date('2026-11-10T10:00:00Z'), settings: settings('israel'), prayerType: 'shacharit' }));
  assert.equal(shouldDisplaySiddurSection('Tachnun', roshChodesh), false);
  const sundayNight = buildSiddurConditionSummary({ ...JewishContextEngine({ now: new Date('2026-11-07T20:00:00Z'), settings: settings('israel'), times: { sunset: '2026-11-07T14:45:00Z' }, prayerType: 'maariv' }), weekday: 0 });
  assert.equal(shouldDisplaySiddurSection("Additions for Motza'ei Shabbat", sundayNight), true);
  assert.equal(shouldDisplaySiddurSection("Additions for Motza'ei Shabbat", summary), false);
});

test('the Smart Siddur composes only the rite whose day plan is verified; every other rite reads its printed service', () => {
  const context = JewishContextEngine({ now: new Date('2026-11-10T08:00:00Z'), settings: { nusach: 'ashkenaz', halachicResidenceStatus: 'israel', location: { tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235 } }, prayerType: 'shacharit' });
  assert.equal(dayServiceSupport(context).supported, true, 'Rosh Chodesh, Edot HaMizrach');
  assert.deepEqual(dayServiceSupport(context, { nusach: 'ashkenaz' }), { supported: false, reason: 'nusach' });
  for (const id of ['sefard', 'chabad']) assert.equal(dayServiceSupport(context, { nusach: id }).supported, false, id);
  assert.equal(siddurLayout('edot-hamizrach').smartSiddur, true);
  assert.ok(NUSACH_IDS.filter(id => id !== 'edot-hamizrach').every(id => siddurLayout(id).smartSiddur === false));
});

test('changing the rite mid-prayer keeps the same prayer and section: Mincha › Amidah in every rite; Chabad Shabbat has no counterpart', () => {
  const rootsOf = id => siddurRoots(packs[id].schema.nodes, siddurIndexTitle(id), siddurLayout(id), () => true, { has: ref => Boolean(packs[id].texts[ref]) });
  const edot = rootsOf('edot-hamizrach');
  const current = edot.find(root => root.key === 'Weekday Mincha').items.find(item => item.en === 'Amida');
  for (const id of ['ashkenaz', 'sefard', 'chabad']) {
    const hit = counterpartIn(current, rootsOf(id), { toNusach: id });
    assert.ok(hit, id);
    assert.equal(hit.root.key, prayerRootFor(id, 'mincha'), id);
    assert.equal(hit.item.concept, 'amida', `${id}: ${hit.item.en}`);
  }
  const shabbat = edot.find(root => root.key === 'Shabbat Shacharit').items[0];
  assert.equal(counterpartIn(shabbat, rootsOf('chabad'), { toNusach: 'chabad' }), null, 'no Shabbat service in the licensed Chabad source');
  assert.ok(counterpartIn(shabbat, rootsOf('sefard'), { toNusach: 'sefard' }));
  const flows = buildSiddurFlows(rootsOf('ashkenaz'), () => {});
  const descriptor = flows.navigation.get(rootsOf('ashkenaz').find(root => root.key === 'Weekday, Minchah').items.find(item => item.en === 'Amida').reference);
  assert.equal(descriptor.itemEn, 'Amida');
  assert.equal(descriptor.concept, 'amida');
});

test('Halacha hints follow the prayer concept in every rite (never an Edot HaMizrach text id)', () => {
  for (const [title, concept] of [['Amidah', 'amida'], ['Shemoneh Esrei', 'amida'], ['The Amidah', 'amida'], ['Amida', 'amida'], ['Musaf LeShabbat', 'mussaf'], ['Blessings of the Shema', 'shema'], ['Hallel', 'hallel'], ['Birkat HaMazon', 'birkat-hamazon'], ['Birchat HaMazon', 'birkat-hamazon'], ['Post Meal Blessing', 'birkat-hamazon'], ['Tzitzit and Tallit', 'talit'], ['Order of Tefillin', 'talit'], ['Sefirat HaOmer', 'omer'], ['Lulav', 'lulav'], ['Kaveh', null]]) assert.equal(halachaConceptForTitle(title), concept, title);
  for (const concept of ['amida', 'mussaf', 'shema', 'hallel', 'birkat-hamazon', 'talit', 'omer', 'lulav']) assert.ok(SIDDUR_HALACHA[concept], concept);
  const reader = read('../src/components/SourceReader.jsx');
  assert.match(reader, /halachaConceptForTitle\(/);
  assert.match(reader, /siddur-halacha-hint/);
});

test('the Siddur home and the settings offer the four rites; the reader credits the rite\'s source; the chooser is the user\'s', () => {
  const books = read('../src/pages/BooksPage.jsx');
  assert.match(books, /<NusachSelector value=\{nusach\} onChange=\{onNusachChange\} \/>/);
  assert.match(books, /askNusach && <NusachOnboarding/);
  assert.match(books, /group\.missing&&!\(unplacedIn\[group\.key\]\|\|\[\]\)\.length&&<p className="siddur-missing"/);
  assert.match(books, /go\?\.\('siddur-sources'\)/);
  assert.match(books, /go\?\.\('siddur-compare'\)/);
  const settings = read('../src/pages/SettingsPage.jsx');
  assert.match(settings, /<Selector label="נוסח התפילה"[^\n]*options=\{NUSACHIM\.map\(item => \[item\.id, item\.title, item\.subtitle\]\)\}/, "every rite is offered by the one Selector");
  const selector = read('../src/components/NusachSelector.jsx');
  assert.match(selector, /role="listbox"/);
  assert.match(selector, /aria-checked=\{item\.id === value\}/);
  assert.match(selector, /נוסח ספרד הוא נוסח החסידים/);
  const app = read('../src/NewApp.jsx');
  assert.match(app, /const changeNusach = async id =>/);
  assert.match(app, /counterpartIn\(\{ rootEn: navigation\.flowKey, en: navigation\.itemEn, concept: navigation\.concept \}/);
  assert.match(app, /localStorage\.getItem\('companion-settings-v2'\) === null/, 'only a new install is asked');
  assert.doesNotMatch(app, /navigator\.geolocation[^\n]*nusach/, 'the rite is never inferred from location');
  const reader = read('../src/components/SourceReader.jsx');
  assert.match(reader, /riteSource && <p>\{riteSource\.attribution\}<\/p>/);
  // The other rites are their own chunks, loaded on demand — never in the start-up bundle.
  const registry = read('../src/data/nusach/registry.mjs');
  for (const file of ['siddurAshkenaz', 'siddurSefard', 'siddurChabad']) assert.match(registry, new RegExp(`load: \\(\\) => import\\('./${file}\\.mjs'\\)`));
});

test('a Chabad address ("Weekday Siddur Chabad, …") is read as a siddur: block engine, day conditions, prayer favourite', async () => {
  const { isSiddurReference } = await import('../src/services/sefaria.mjs');
  const { sourceFavorite } = await import('../src/services/favorites.mjs');
  assert.equal(isSiddurReference('Weekday Siddur Chabad, Shacharit, The Amidah'), true);
  assert.equal(isSiddurReference('Siddur Sefard, Weekday Shacharit, Amidah'), true);
  assert.equal(isSiddurReference('Genesis 1'), false);
  assert.equal(sourceFavorite('Weekday Siddur Chabad, Maariv', 'ערבית').kind, 'prayer');
  const text = await getText('Weekday Siddur Chabad, Shacharit, The Amidah');
  assert.ok(Array.isArray(text.siddurMarkup) && text.siddurMarkup.some(markup => /<small>בעשי״ת<\/small>/.test(markup)), 'the edition markup reaches the reader, so its captions are resolved for the day');
  assert.match(read('../src/components/SourceReader.jsx'), /const cacheType = isSiddurReference\(reference\) \? 'siddur' : 'source';/);
});
