// Nusach Ashkenaz, second edition: Birnbaum's HaSiddur HaShalem (1949), from the Hebrew Wikisource page transcription
// (CC BY-SA 4.0), used ONLY for what the Metsudah edition lacks. Presence, placement, day conditions, fidelity to the
// proofread pages, provenance, and the separation of its licence from the rest of the app.
// Import notes: docs/siddur/birnbaum-ashkenaz-import.md; provenance: sources/birnbaum-ashkenaz/provenance.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPOSITIONS } from '../src/data/nusach/compositions/index.mjs';
import { NUSACHIM, NUSACH_IDS, nusachForReference } from '../src/data/nusach/registry.mjs';
import { SIDDUR_SOURCES, normalizeLicense, licenseAllowed, LICENSE_ALLOWLIST } from '../src/data/nusach/manifest.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { composeRiteService, resolveService, compositionConditions } from '../src/services/prayer/riteServiceComposer.mjs';
import { checkRite } from '../src/services/prayer/siddurQa.mjs';
import { pirkeiAvotChapters } from '../src/services/prayer/pirkeiAvot.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { removeNikud } from '../src/hebrewText.mjs';
import birnbaum from '../src/data/nusach/siddurAshkenazBirnbaum.mjs';

const INDEX = 'HaSiddur HaShalem Birnbaum';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const provenance = JSON.parse(read('../sources/birnbaum-ashkenaz/provenance.json'));
const pack = await loadSiddur('ashkenaz');
const composition = COMPOSITIONS.ashkenaz;
const fromBirnbaum = ref => String(ref).startsWith(`${INDEX}, `);

function compose(serviceId, date, prayer = 'shacharit', { place = 'il', mode = 'prayer' } = {}) {
  const il = place === 'il';
  const settings = { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: il ? 'israel' : 'diaspora', il };
  const hour = prayer === 'maariv' ? '19:30' : prayer === 'mincha' ? '13:30' : '08:00';
  const now = new Date(`${date}T${hour}:00+02:00`);
  const context = { ...JewishContextEngine({ now, settings, times: { sunset: new Date(`${date}T17:00:00+02:00`) }, prayerType: prayer === 'mussaf' ? 'shacharit' : prayer }), servicePrayer: prayer };
  return composeRiteService({ composition, serviceId, texts: pack.texts, context, mode });
}
const ids = doc => doc.sections.map(section => section.id);
const textOf = (doc, id) => removeNikud(doc.sections.filter(section => section.id === id).flatMap(section => section.blocks.map(block => block.text)).join(' '));
const avotIn = doc => ids(doc).filter(id => id.startsWith('pirkei-avot-')).map(id => Number(id.slice(-1)));

// Dates: 5787 unless noted.
const D = {
  friday: '2026-10-16', shabbat: '2026-10-17', motzaeiShabbat: '2026-10-17', sunday: '2026-10-18', monday: '2026-10-19',
  chanukahFriday: '2026-12-11', sheminiAtzeretEve: '2026-10-02', cholHamoedPesachEve: '2027-04-23', shavuotFriday: '2027-06-11',
  avotFirst: '2027-05-01', avotSixth: '2027-07-17', avotThreeFour: '2027-09-18', avotFiveSix: '2027-09-25', shavuot2Shabbat: '2027-06-12', shabbatCholHamoed: '2027-04-24',
  tishaBavShabbat5789: '2029-07-21',
};

test('Birnbaum pack: its own index, source, licence and pages — only proofread or validated Wikisource pages', () => {
  const { source } = birnbaum;
  assert.equal(source.index, INDEX);
  assert.equal(source.nusach, 'ashkenaz');
  assert.equal(source.license, 'CC BY-SA 4.0');
  assert.equal(source.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0/');
  assert.equal(source.attributionRequired, true);
  assert.equal(source.shareAlike, true);
  assert.match(source.editor, /Birnbaum/);
  assert.equal(source.year, 1949);
  assert.match(decodeURIComponent(source.url), /^https:\/\/he\.wikisource\.org\/wiki\/מפתח:Philip_Birnbaum_-_ha-Siddur_ha-Shalem_\(The_Daily_Prayer_Book,1949\)\.pdf$/);
  assert.equal(source.modified, true);
  const refs = Object.keys(birnbaum.texts);
  assert.equal(refs.length, 11);
  for (const [ref, text] of Object.entries(birnbaum.texts)) {
    assert.ok(fromBirnbaum(ref), ref);
    assert.equal(text.heLicense, 'CC BY-SA 4.0');
    assert.equal(normalizeLicense(text.heLicense), 'CC-BY-SA');
    assert.ok(text.pages.length >= 1, ref);
    for (const page of text.pages) {
      assert.ok(['proofread', 'validated'].includes(page.status), `${ref} p.${page.bookPage} ${page.status}`);
      assert.match(decodeURIComponent(page.url), /^https:\/\/he\.wikisource\.org\/wiki\/עמוד:Philip_Birnbaum_-_ha-Siddur_ha-Shalem_\(The_Daily_Prayer_Book,1949\)\.pdf\/\d+$/);
      assert.ok(Number.isInteger(page.revid) && page.revid > 0);
      assert.equal(page.bookPage % 2, 1, 'Hebrew pages are odd');
    }
  }
  // Nothing from the assembled (adapted) Wikisource edition: every page is a Page: namespace page.
  assert.ok(provenance.pages.every(page => page.title.startsWith('עמוד:Philip Birnbaum - ha-Siddur ha-Shalem')));
});

test('Birnbaum pack: every paragraph is the proofread page as rendered (markup and page breaks aside)', () => {
  const raw = page => JSON.parse(read(`../sources/birnbaum-ashkenaz/raw/page-${page}.json`));
  const plainHtml = html => html
    .replace(/<div class="prp-page-qualityheader[^>]*>[^<]*<\/div>/g, '')
    .replace(/<div style="padding: 1px;">[\s\S]*?<\/div><div style="text-align: center;">[^<]*<\/div><div style="clear: both;"><\/div>/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/[\u200e\u200f]/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#160;|&nbsp;/g, ' ').replace(/\s+/g, ' ');
  for (const [ref, text] of Object.entries(birnbaum.texts)) {
    const pages = text.pages.map(page => page.bookPage);
    const body = pages.map(page => plainHtml(raw(page).html)).join(' ').replace(/\s+/g, ' ');
    for (const paragraph of text.he) {
      const words = paragraph.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      assert.ok(body.includes(words), `${ref}: «${words.slice(0, 60)}…» is not on pages ${pages.join(', ')}`);
    }
  }
  // The editors' renderings of Birnbaum's English directions, his source lines and the Reader marks are small print
  // of class "direction" (the reader shows them as the edition's notes, never as prayer).
  const directions = Object.values(birnbaum.texts).flatMap(text => text.he).filter(p => p.includes('class="direction"'));
  assert.ok(directions.some(p => p.includes('אין אומרים')));
  assert.ok(directions.some(p => p.includes('ש"ץ')));
});

test('provenance.json: page → URL, revision, status and the sections that use it; base pages and variants recorded', () => {
  assert.equal(provenance.license, 'CC BY-SA 4.0');
  assert.equal(provenance.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0/');
  assert.equal(provenance.shareAlike, true);
  assert.match(provenance.editor, /Birnbaum/);
  assert.equal(provenance.year, 1949);
  assert.ok(provenance.index.revid > 0);
  assert.equal(provenance.bookStatus.pages, 815);
  assert.equal(provenance.pages.length, 43);
  const usedPages = new Set(Object.values(birnbaum.texts).flatMap(text => text.pages.map(page => page.bookPage)));
  for (const page of provenance.pages) {
    assert.ok(['proofread', 'validated'].includes(page.status), `p.${page.bookPage}`);
    assert.ok(page.revid > 0 && page.url && page.oldidUrl.endsWith(String(page.revid)));
    assert.ok(page.transcludes.every(base => base.revid > 0), `p.${page.bookPage} base revisions`);
    assert.equal(page.usedIn.length > 0, usedPages.has(page.bookPage), `p.${page.bookPage} usedIn`);
    for (const ref of page.usedIn) assert.ok(birnbaum.texts[ref], ref);
  }
  // Where the transcription records a reading other than Birnbaum's print, the provenance says so.
  assert.ok(provenance.pages.flatMap(page => page.variants).some(v => v.birnbaum && v.inImportedText));
});

test('licence separation: one manifest entry for Birnbaum, under Ashkenaz only; nothing else becomes CC BY-SA', () => {
  const extra = SIDDUR_SOURCES.ashkenaz.extraEditions.find(edition => edition.index === INDEX);
  assert.ok(extra);
  assert.equal(extra.license, 'CC BY-SA 4.0');
  assert.equal(extra.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0/');
  assert.equal(extra.attributionRequired, true);
  assert.equal(extra.shareAlike, true);
  assert.equal(extra.modified, true);
  assert.match(extra.editor, /Birnbaum/);
  assert.equal(extra.year, 1949);
  assert.match(extra.attribution, /בירנבוים.*1949.*ויקיטקסט.*CC BY-SA 4\.0/);
  assert.match(extra.sectionCredit, /CC BY-SA 4\.0/);
  for (const field of ['index', 'work', 'version', 'provider', 'sourceUrl', 'license', 'attribution', 'accessedAt', 'changes']) assert.ok(extra[field], field);
  // The Metsudah edition keeps its own licence; the rite's main entry is not CC BY-SA.
  assert.equal(SIDDUR_SOURCES.ashkenaz.modified, false);
  assert.doesNotMatch(SIDDUR_SOURCES.ashkenaz.license, /SA/);
  assert.equal(licenseAllowed(SIDDUR_SOURCES.ashkenaz, 'x', 'CC BY-SA 4.0').license, 'CC-BY-SA');
  assert.ok(LICENSE_ALLOWLIST.includes('CC-BY-SA'));
  // No other rite names Birnbaum; the only CC-licensed edition with a per-section credit line is this one (the other
  // credited section is the owner's own typing of the Chabad Shabbat Yotzer — not CC-licensed, see chabadOwner tests).
  for (const id of NUSACH_IDS.filter(item => item !== 'ashkenaz')) assert.doesNotMatch(JSON.stringify(SIDDUR_SOURCES[id]), /Birnbaum|בירנבוים/, id);
  const credited = Object.values(SIDDUR_SOURCES).flatMap(source => source.extraEditions || []).filter(edition => edition.sectionCredit);
  assert.deepEqual(credited.map(edition => edition.index), [INDEX, 'Siddur Chabad Owner Transcription']);
  assert.deepEqual(credited.filter(edition => /CC/.test(edition.license)).map(edition => edition.index), [INDEX]);
  // Registry: a second edition of Ashkenaz only; its addresses belong to Ashkenaz.
  assert.deepEqual(NUSACHIM.find(item => item.id === 'ashkenaz').extras.map(extra => extra.index), [INDEX]);
  assert.equal(nusachForReference(`${INDEX}, Pirkei Avot, Chapter 1`), 'ashkenaz');
  for (const id of NUSACH_IDS.filter(item => item !== 'ashkenaz')) {
    for (const service of Object.values(COMPOSITIONS[id].services)) for (const section of service.sections) assert.ok(!fromBirnbaum(section.ref), `${id}: ${section.ref}`);
  }
});

test('only the sections that were missing read Birnbaum — each one its own leaf, so its credit sits on it alone', () => {
  const used = [];
  for (const [serviceId, service] of Object.entries(composition.services)) {
    for (const section of resolveService(service, pack.texts)) {
      assert.ok(!section.error, `${serviceId}/${section.id}: ${section.error}`);
      if (fromBirnbaum(section.ref)) used.push(`${serviceId}/${section.id}`);
    }
  }
  assert.deepEqual(used.sort(), [
    'kabbalat-shabbat/bameh-madlikin', 'kabbalat-shabbat/rabbi-elazar',
    'shabbat-mincha/pirkei-avot-1', 'shabbat-mincha/pirkei-avot-2', 'shabbat-mincha/pirkei-avot-3', 'shabbat-mincha/pirkei-avot-4', 'shabbat-mincha/pirkei-avot-5', 'shabbat-mincha/pirkei-avot-6', 'shabbat-mincha/shir-hamaalot',
    'shabbat-shacharit/al-hakol', 'shabbat-shacharit/av-harachamim-hu',
    'weekday-maariv/veyiten-lecha',
  ].sort());
  // The composed sections keep their own address (the reader's credit line is looked up from it).
  const doc = compose('kabbalat-shabbat', D.friday, 'maariv');
  assert.deepEqual(doc.sections.filter(section => fromBirnbaum(section.ref)).map(section => section.id), ['bameh-madlikin', 'rabbi-elazar']);
  assert.ok(doc.sections.filter(section => !fromBirnbaum(section.ref)).every(section => section.ref.startsWith('Siddur Ashkenaz, ')));
  // The QA: no problem in any service; the two source gaps are closed.
  for (const result of checkRite(composition, pack.texts)) {
    assert.deepEqual(result.problems, [], result.serviceId);
    assert.ok(!(composition.services[result.serviceId].missing || []).some(item => ['bameh-madlikin', 'pirkei-avot'].includes(item.concept)), result.serviceId);
  }
});

test('במה מדליקין: after Kabbalat Shabbat, then אמר רבי אלעזר and Kaddish DeRabbanan — not on Yom Tov, Shabbat Chol HaMoed or after a Friday Yom Tov', () => {
  const doc = compose('kabbalat-shabbat', D.friday, 'maariv');
  const order = ids(doc);
  assert.deepEqual(order.slice(-4), ['kaddish-yatom', 'bameh-madlikin', 'rabbi-elazar', 'kaddish-derabanan']);
  assert.match(textOf(doc, 'bameh-madlikin'), /^.*במה מדליקין ובמה אין מדליקין/);
  assert.match(textOf(doc, 'bameh-madlikin'), /ומערבין, וטומנין את החמין\.$/);
  assert.match(textOf(doc, 'rabbi-elazar'), /תלמידי חכמים מרבים שלום בעולם[\s\S]*יברך את עמו בשלום\.$/);
  assert.match(textOf(doc, 'kaddish-derabanan'), /על ישראל ועל רבנן/);
  assert.match(textOf(doc, 'kaddish-derabanan'), /עושה שלום/);
  // Chanukah: said (the edition names only the festivals).
  for (const place of ['il', 'diaspora']) assert.ok(ids(compose('kabbalat-shabbat', D.chanukahFriday, 'maariv', { place })).includes('bameh-madlikin'), place);
  // Yom Tov on Shabbat, Shabbat Chol HaMoed, the Shabbat after a Yom Tov on Friday (IL) / the second day (diaspora).
  for (const [date, place] of [[D.sheminiAtzeretEve, 'il'], [D.cholHamoedPesachEve, 'il'], [D.cholHamoedPesachEve, 'diaspora'], [D.shavuotFriday, 'il'], [D.shavuotFriday, 'diaspora']]) {
    const hidden = ids(compose('kabbalat-shabbat', date, 'maariv', { place }));
    for (const id of ['bameh-madlikin', 'rabbi-elazar', 'kaddish-derabanan']) assert.ok(!hidden.includes(id), `${date} ${place} ${id}`);
  }
  // The full edition shows it with its condition.
  const edition = compose('kabbalat-shabbat', D.friday, 'maariv', { mode: 'edition' });
  assert.match(edition.sections.find(section => section.id === 'bameh-madlikin').whenLabel, /לא ביום טוב/);
});

test('Shabbat Shacharit: על הכל and אב הרחמים הוא ירחם between לך ה׳ and ויעזור', () => {
  const doc = compose('shabbat-shacharit', D.shabbat);
  const order = ids(doc);
  const at = order.indexOf('lecha-hashem');
  assert.deepEqual(order.slice(at, at + 4), ['lecha-hashem', 'al-hakol', 'av-harachamim-hu', 'veyaazor']);
  assert.match(textOf(doc, 'al-hakol'), /^על הכל יתגדל ויתקדש[\s\S]*כי פי יי דבר\.$/);
  assert.match(textOf(doc, 'av-harachamim-hu'), /אב הרחמים, הוא ירחם עם עמוסים[\s\S]*ישועה ורחמים\.$/);
  assert.equal(doc.sections.find(section => section.id === 'av-harachamim-hu').role, 'chazzan');
});

test('Shabbat Mincha: the Songs of Ascents after ברכי נפשי in winter; Pirkei Avot, this Shabbat\'s chapter, in summer', () => {
  const winter = compose('shabbat-mincha', D.shabbat, 'mincha');
  assert.deepEqual(ids(winter).slice(-2), ['barchi-nafshi', 'shir-hamaalot']);
  const psalms = winter.sections.find(section => section.id === 'shir-hamaalot').blocks.filter(block => /^שיר (?:ה|ל)מעלות/.test(removeNikud(block.text)));
  assert.equal(psalms.length, 15);
  assert.deepEqual(avotIn(winter), []);
  // Summer (Israel): chapter by chapter; the last weeks double up.
  for (const [date, want, place = 'il'] of [[D.avotFirst, [1]], [D.avotFirst, [1], 'diaspora'], [D.avotSixth, [6]], [D.avotThreeFour, [3, 4]], [D.avotFiveSix, [5, 6]], [D.shavuot2Shabbat, [], 'diaspora'], [D.shabbatCholHamoed, []]]) {
    const doc = compose('shabbat-mincha', date, 'mincha', { place });
    assert.deepEqual(avotIn(doc), want, `${date} ${place}`);
    assert.ok(!ids(doc).includes('barchi-nafshi') && !ids(doc).includes('shir-hamaalot'), `${date}: no winter psalms`);
    if (want.length) assert.equal(ids(doc).at(-want.length - 1), 'kaddish-yatom', 'after Mincha');
  }
  // Each chapter as printed: כל ישראל before it, רבי חנניא after it.
  const edition = compose('shabbat-mincha', D.shabbat, 'mincha', { mode: 'edition' });
  assert.deepEqual(avotIn(edition), [1, 2, 3, 4, 5, 6]);
  for (let n = 1; n <= 6; n += 1) {
    const text = textOf(edition, `pirkei-avot-${n}`);
    assert.match(text, /כל ישראל יש להם חלק לעולם הבא/, `chapter ${n}`);
    assert.match(text, /רבי חנניא בן עקשיא אומר[\s\S]*יגדיל תורה ויאדיר\.$/, `chapter ${n}`);
  }
  assert.match(textOf(edition, 'pirkei-avot-1'), /משה קבל תורה מסיני/);
  assert.match(textOf(edition, 'pirkei-avot-6'), /חמשה קנינים קנה הקדוש ברוך הוא/);
});

test('the Pirkei Avot schedule (the luach custom; Hebcal\'s pirkeiAvotSummer)', () => {
  const date = (day, month, year) => ({ day, month, year });
  // 5787: Pesach 15 Nisan = Thursday 22 April 2027. The first Shabbat after the festival: chapter 1 (Israel and abroad).
  assert.deepEqual(pirkeiAvotChapters(date(24, 1, 5787), true), [1]);
  assert.deepEqual(pirkeiAvotChapters(date(24, 1, 5787), false), [1]);
  assert.equal(pirkeiAvotChapters(date(17, 1, 5787), true), null, 'Shabbat Chol HaMoed');
  assert.equal(pirkeiAvotChapters(date(23, 1, 5787), true), null, 'not a Shabbat');
  // 5786: 7 Sivan (diaspora Shavuot) is a Shabbat — skipped, the week not counted.
  assert.equal(pirkeiAvotChapters(date(7, 3, 5786), false), null);
  assert.deepEqual(pirkeiAvotChapters(date(7, 3, 5786), true), [1]);
  assert.deepEqual(pirkeiAvotChapters(date(14, 3, 5786), false), [1]);
  // 5789: Tisha B'Av is a Shabbat — no chapter.
  assert.equal(pirkeiAvotChapters(date(9, 5, 5789), true), null);
  // Every Shabbat from the one after Pesach to the one before Rosh Hashana has a chapter (except the skipped ones), and
  // the summer ends with 5–6.
  for (const year of [5786, 5787, 5788, 5789, 5790]) for (const il of [true, false]) {
    const conditions = compositionConditions({ hebrewDate: { day: 29, month: 6, year }, isIsrael: il });
    assert.equal(typeof conditions.avot1, 'boolean');
  }
});

test('ויתן לך: at the end of Maariv on Motzaei Shabbat only (not on Tisha B\'Av)', () => {
  const doc = compose('weekday-maariv', D.motzaeiShabbat, 'maariv');
  assert.equal(ids(doc).at(-1), 'veyiten-lecha');
  const text = textOf(doc, 'veyiten-lecha');
  assert.match(text, /^ויתן[־ ]?לך האלהים מטל השמים/);
  assert.match(text, /שיר המעלות\. אשרי כל ירא יי[\s\S]*שלום על ישראל\.$/);
  assert.ok(!ids(compose('weekday-maariv', D.monday, 'maariv')).includes('veyiten-lecha'));
  assert.ok(!ids(compose('weekday-maariv', D.tishaBavShabbat5789, 'maariv')).includes('veyiten-lecha'));
});

test('open-siddur-sources: the four sources with conflicting licences are blocked, and Birnbaum is recorded as imported', () => {
  const sources = JSON.parse(read('../docs/siddur/open-siddur-sources.json'));
  const records = sources.records || sources.sources || sources;
  const blocked = records.filter(record => record.status === 'blocked pending license clarification');
  assert.equal(blocked.length, 4);
  for (const name of [/Avodat Yisroel/i, /Wasserman|Shabbat Shacharit from Seder Avodat/i, /Far[ḥh]i/i, /Kol Peh/i]) assert.ok(blocked.some(record => name.test(JSON.stringify(record))), String(name));
  assert.ok(blocked.every(record => record.usableAs !== 'import'));
});
