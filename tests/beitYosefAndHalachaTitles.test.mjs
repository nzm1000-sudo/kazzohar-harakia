// The Beit Yosef in its four parts (on the device, beside the Tur), one reading size for halacha, Hebrew numerals for
// every place in a book, and titled contents for the halacha books (קיצור שולחן ערוך: "סימן קל״ט · הלכות חנכה").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { CORPUS_INDEX, PUBLIC_WORKS, WORKS, workById, worksInCategory } from '../src/data/library/registry.mjs';
import { validateWorkChunk } from '../src/services/library/integrity.mjs';
import { checksum } from '../src/services/prayer/checksum.mjs';
import { loadEditionChunk } from '../src/services/library/packs.mjs';
import { layersAt, loadLayerUnits } from '../src/services/library/relations.mjs';
import { localPlaceForRef, localRouteForRef } from '../src/services/torah/localSources.mjs';
import { localLibraryRoute } from '../src/services/library/localRefs.mjs';
import { glossParagraphs, glossRuns } from '../src/services/library/glosses.mjs';
import { contentsKey, contentsMatch, topicLabel } from '../src/services/library/topics.mjs';
import { classifyHebrewParagraph, isHalachaText, readingParagraphs } from '../src/hebrewText.mjs';
import { hebrewLocations } from '../src/services/hebrewNumerals.mjs';
import { yalkutOutline, yalkutSections, yalkutText, searchYalkut } from '../src/services/yalkutYosef.mjs';
import HALACHA_TOPICS from '../src/data/library/halachaTopics.mjs';
import { loadJsx } from './helpers/jsx.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const diskFetch = async url => new Response(readFileSync(`${root}public/${decodeURIComponent(new URL(url, 'http://app/').pathname.slice(1))}`));
const PACK_ID = 'sefaria-beit-yosef-public-domain';
const pack = CORPUS_INDEX.find(item => item.packId === PACK_ID);
const by = workById('Beit_Yosef');
const tur = workById('Tur');
const provenance = JSON.parse(read('sources/beit-yosef/provenance.json'));
const PARTS = [['אורח חיים', 697], ['יורה דעה', 403], ['אבן העזר', 178], ['חושן משפט', 426]];
const library = loadJsx('pages/LibraryPage.jsx');
const render = mode => renderToStaticMarkup(React.createElement(library.default, { route: library.parseLibraryRoute(mode), go: () => {}, openSource: () => {} }));

// ---------- 1 · The Beit Yosef, four parts ----------
test('the Beit Yosef: all four parts, each siman of the Tur, one public-domain print (the Tur\'s), honest coverage', () => {
  assert.ok(pack && by, 'the pack is registered');
  const edition = by.editions[0];
  assert.deepEqual(edition.sections.map(section => section.title), ['הקדמה', ...PARTS.map(([he]) => he)]);
  for (const [he, simanim] of PARTS) {
    const section = edition.sections.find(item => item.title === he);
    assert.equal(section.to - section.from + 1, simanim, `${he}: ${simanim} simanim`);
    const turPart = tur.editions[0].sections.find(item => item.title === he);
    assert.equal(turPart.to - turPart.from + 1, simanim, `the Tur has the same simanim in ${he}`);
  }
  assert.equal(by.license, 'public-domain');
  assert.equal(edition.recordedLicense, 'Public Domain');
  assert.equal(edition.versionSource, tur.editions[0].versionSource, 'the same print (one NLI record) as the Tur');
  assert.deepEqual(provenance.parts.map(part => part.versionTitle), ['Tur Orach Chaim, Vilna, 1923', 'Tur Yoreh Deah, Vilna, 1923', 'Tur Even HaEzer, Vilna, 1923', 'Tur Choshen Mishpat: Vilna, 1923']);
  assert.ok(provenance.parts.every(part => part.recordedLicense === 'Public Domain'));
  assert.ok(provenance.notUsed.every(version => !/public domain/i.test(version.license || '') || /not a complete/.test(version.why)), 'no other version is used');
  const coverage = by.coverageDetail;
  assert.ok(coverage.coveragePercent >= 99, `coverage ${coverage.coveragePercent}%`);
  assert.equal(coverage.missingUnits.length, coverage.expectedUnits - coverage.importedUnits);
  assert.equal(by.coverage, coverage.missingUnits.length ? 'PARTIAL' : 'FULL');
  // Every missing unit is listed; a siman the print leaves empty is one of them.
  for (const [he, simanim] of [['אורח חיים', [34, 486]], ['יורה דעה', [169]], ['חושן משפט', [411]]]) {
    const section = edition.sections.find(item => item.title === he);
    for (const siman of simanim) assert.ok(coverage.missingUnits.includes(`Beit_Yosef.${section.from + siman - 1}.1`), `${he} ${siman}`);
  }
});

test('the Beit Yosef files: split by siman range inside each part, gzip, checksummed, re-validated from disk, no markup', () => {
  const edition = by.editions[0];
  const manifest = JSON.parse(read(`public/library/packs/${PACK_ID}/manifest.json`));
  assert.deepEqual(manifest.files.map(file => file.file), edition.parts.map(part => part.file));
  const nodes = [];
  for (const part of edition.parts) {
    const body = gunzipSync(readFileSync(`${root}public/library/packs/${PACK_ID}/${part.file}`)).toString('utf8');
    assert.equal(checksum(body), part.checksum, part.file);
    assert.ok(part.bytes < 400_000, `${part.file}: ${part.bytes} bytes`);
    const inPart = edition.sections.find(section => part.from >= section.from && part.from <= section.to);
    assert.ok(part.to <= inPart.to, `${part.file} stays inside ${inPart.title}`);
    const chunk = JSON.parse(body);
    assert.ok(!/<\/?(?:small|i|b)\b/.test(body), 'no markup');
    nodes.push(...chunk.nodes);
  }
  const report = validateWorkChunk({ workId: 'Beit_Yosef', nodes }, edition.expected.map((units, i) => ({ n: i + 1, units })));
  for (const key of ['duplicateIds', 'emptyUnits', 'invalidRefs', 'unexpectedUnits', 'orderErrors']) assert.deepEqual(report[key], [], key);
  assert.equal(report.importedUnits, by.coverageDetail.importedUnits);
  const total = edition.parts.reduce((sum, part) => sum + part.bytes, 0);
  assert.equal(total, pack.bytes);
  assert.ok(total < 8 * 1024 * 1024, `bundled: ${(total / 1048576).toFixed(2)} MB`);
});

test('the Beit Yosef sits beside the Tur: the same siman in each part; the old remote entry is hidden; the shelf reads טור › בית יוסף', async () => {
  assert.deepEqual(by.relation, { relationType: 'commentary', baseWorkId: 'Tur', anchorScheme: 'siman' });
  for (const [he, siman] of [['אורח חיים', 1], ['יורה דעה', 87], ['אבן העזר', 17], ['חושן משפט', 426]]) {
    const turNode = tur.editions[0].sections.find(item => item.title === he).from + siman - 1;
    const byNode = by.editions[0].sections.find(item => item.title === he).from + siman - 1;
    const [layer] = layersAt('Tur', turNode).filter(item => item.work.workId === 'Beit_Yosef');
    assert.ok(layer, `${he} ${siman}: the Beit Yosef is a layer of the Tur there`);
    assert.deepEqual(layer.segments.map(segment => segment.node), [byNode]);
    assert.equal(tur.editions[0].nodeTitles[turNode - 1], by.editions[0].nodeTitles[byNode - 1]);
  }
  const [layer] = layersAt('Tur', 2);
  const units = await loadLayerUnits(layer, { fetchImpl: diskFetch });
  assert.match(units[0].text, /^יהודה בן תימא אומר הוי עז כנמר/, 'אורח חיים סימן א׳ opens as printed');
  const old = WORKS.find(work => work.workId === 'halacha.beit-yosef-oc');
  assert.equal(old.public, false);
  assert.equal(old.supersededBy, 'Beit_Yosef');
  const shelf = worksInCategory('halacha').filter(work => work.group === 'tur-beit-yosef').sort((a, b) => (a.relation ? 1 : 0) - (b.relation ? 1 : 0)).map(work => work.workId);
  assert.deepEqual(shelf, ['Tur', 'Beit_Yosef']);
  assert.ok(PUBLIC_WORKS.some(work => work.workId === 'Beit_Yosef'));
});

test('the reader: the Tur opens with a מפרשים tab; a Beit Yosef siman of יורה דעה is titled and placed in its halachot', () => {
  const turPage = render('books/r/Tur/2');
  assert.match(turPage, /role="tab"[^>]*>מפרשים</);
  const byPage = render('books/r/Beit_Yosef/699');
  assert.match(byPage, /<h1>בית יוסף · יורה דעה · סימן א׳/);
  assert.match(byPage, /library-parasha-range">הלכות שחיטה</);
  const contents = render('books/w/Beit_Yosef');
  for (const [he] of PARTS) assert.match(contents, new RegExp(`<summary><strong>${he}</strong>`));
});

test('Sefaria refs of the Tur and the Beit Yosef open the book on the device, by part', () => {
  assert.equal(localRouteForRef('Beit Yosef, Orach Chayim 1:3'), 'books/r/Beit_Yosef/2/3');
  assert.equal(localRouteForRef("Beit Yosef, Yoreh De'ah 1"), 'books/r/Beit_Yosef/699');
  assert.equal(localRouteForRef('Beit Yosef, Choshen Mishpat 2:1'), 'books/r/Beit_Yosef/1281', 'a seif of Choshen Mishpat opens its siman');
  assert.equal(localRouteForRef('Tur, Orach Chayim 263'), 'books/r/Tur/264');
  assert.equal(localPlaceForRef('Beit Yosef, Even HaEzer 179'), null, 'beyond the part');
  assert.equal(localLibraryRoute('Beit Yosef, Orach Chayim 263'), 'books/r/Beit_Yosef/264');
});

// ---------- 2 · One reading size ----------
test('בדק הבית: the additions the print sets in smaller type are ranges on the unit, shown at the same size', async () => {
  const edition = by.editions[0];
  const chunk = await loadEditionChunk(edition, { node: 12, fetchImpl: diskFetch });
  const unit = chunk.nodes.find(node => node.n === 12).units.find(item => item.g);
  assert.ok(unit, 'אורח חיים סימן י״א carries an addition');
  const added = unit.g.map(([from, to]) => unit.text.slice(from, to));
  assert.ok(added.every(text => /^\(?ב"ה\)?/.test(text)), `each addition opens "(ב"ה)": ${added[0].slice(0, 20)}`);
  const runs = glossRuns(unit.text, unit.g);
  assert.equal(runs.map(run => run.text).join(''), unit.text, 'the words are unchanged');
  assert.deepEqual(glossParagraphs(unit).flat().filter(run => run.gloss).map(run => run.text), added);
  const css = read('src/styles/base.css');
  const rule = /\.library-gloss\{([^}]*)\}/.exec(css)?.[1];
  assert.ok(rule && !/font-size|font-family/.test(rule), 'the same size and face as the text around it');
  const panel = read('src/components/CommentaryPanel.jsx');
  assert.match(panel, /className="library-gloss"/);
});

test('halacha reads at one size: no seif is taken for a small source line or an instruction (the siddur keeps its roles)', () => {
  const seifim = ['יש אומרים שצריך לברך (עיין בית יוסף)', 'אם שכח ולא התפלל', '(שו"ע סימן קכח) כך נוהגים', 'והוא הדין בסעיף', 'הגה: וכן נוהגין (טור)'];
  for (const text of ['Shulchan Arukh, Orach Chayim 1', 'Beit Yosef, Orach Chayim 1', 'Tur, Orach Chayim 1', 'Mishnah Berurah 1']) {
    const paragraphs = readingParagraphs({ hebrew: seifim, indexes: null, ref: text }, '', text);
    assert.deepEqual([...new Set(paragraphs.map(item => item.type))], ['halacha'], text);
  }
  assert.ok(isHalachaText({ category: 'Halakhah' }), 'every Sefaria halacha text');
  // The siddur is unchanged: the same lines keep their roles there.
  assert.equal(classifyHebrewParagraph('יש אומרים שצריך'), 'instruction');
  assert.equal(readingParagraphs({ hebrew: ['אם שכח ולא אמר'], ref: 'Siddur Edot HaMizrach, Weekday Shacharit' }, '', 'Siddur Edot HaMizrach, Weekday Shacharit')[0].type, 'instruction');
  assert.match(read('src/components/SourceReader.jsx'), /readingParagraphs\(text, displayTitle, reference\)/);
  assert.doesNotMatch(read('src/styles/base.css'), /\.reading-halacha\{/, 'no size of its own');
});

// ---------- 3 · Hebrew numerals ----------
test('places in a book are shown in Hebrew numerals; counts, pages and years are not', () => {
  assert.equal(hebrewLocations('שולחן ערוך, אורח חיים סימן 263, סעיף 1'), 'שולחן ערוך, אורח חיים סימן רס״ג, סעיף א׳');
  assert.equal(hebrewLocations('פרק 3, הלכה 15'), 'פרק ג׳, הלכה ט״ו');
  assert.equal(hebrewLocations('סימנים 1–50'), 'סימנים א׳–נ׳');
  for (const civil of ['17 סעיפים', 'עמוד 431', 'עמ׳ 45', 'דף 14a', 'שנת 2026']) assert.equal(hebrewLocations(civil), civil);
  const sections = yalkutSections(yalkutOutline()[10].key);
  assert.ok(sections.length > 1);
  assert.ok(sections.every(item => !/הלכה \d/.test(item.label)), 'Yalkut Yosef: "· הלכה א׳"');
  assert.doesNotMatch(yalkutText(sections[0].ref).heRef, /\d/);
  assert.ok(searchYalkut('נר חנוכה').slice(0, 5).every(item => !/סעיף \d/.test(item.citation)));
  const halachaPage = read('src/pages/HalachaLibrary.jsx');
  assert.doesNotMatch(halachaPage, /' סימן \$1, סעיף \$2'|' פרק \$1, הלכה \$2'|סימנים \$\{u\.from\}/);
  const books = read('src/services/halachaBooks.mjs');
  assert.doesNotMatch(books, /`סימן \$\{n\}`|`סימנים \$\{from\}|`פרק \$\{ci \+ 1\}/);
  assert.match(read('src/pages/TalmudPage.jsx'), /unitLabel: amudLabel\(amud\)/);
  assert.match(read('src/Tehillim.jsx'), /\(\{hebrewNumeral\(/);
  assert.doesNotMatch(read('src/components/SourceReader.jsx'), /`דף \$\{unitId\}`/);
});

// ---------- 4 · Titled contents ----------
test('Kitzur Shulchan Arukh: every siman carries its printed name; the contents are titled and searchable', () => {
  const kitzur = workById('Kitzur_Shulchan_Arukh');
  const titles = kitzur.editions[0].nodeTitles;
  assert.equal(titles.length, 221);
  assert.equal(titles[138], 'סימן קל״ט · הלכות חנכה');
  assert.equal(titles[0], 'סימן א׳ · דיני השכמת הבקר');
  assert.equal(HALACHA_TOPICS.works.Kitzur_Shulchan_Arukh.source.field, 'alt_structs.Topic');
  const contents = render('books/w/Kitzur_Shulchan_Arukh');
  assert.match(contents, /סימן קל״ט · הלכות חנכה/);
  assert.match(contents, /placeholder="חיפוש בתוכן העניינים"/);
  assert.match(render('books/r/Kitzur_Shulchan_Arukh/139'), /<h1>קיצור שלחן ערוך · סימן קל״ט · הלכות חנכה/);
  // "חנוכה" finds "הלכות חנכה" (the print's spelling); "קלט" finds "סימן קל״ט".
  assert.ok(contentsMatch('חנוכה', titles[138]));
  assert.ok(contentsMatch('קלט', titles[138]));
  const found = titles.filter(title => contentsMatch('חנוכה', title));
  assert.deepEqual(found, ['סימן קל״ט · הלכות חנכה']);
  assert.equal(contentsKey('הַלָכוֹת חֲנֻכָּה'), contentsKey('הלכות חנוכה'));
});

test('the Shulchan Arukh, Tur, Beit Yosef and the other halacha books: groups of simanim from their own structure', () => {
  const expected = { Shulchan_Arukh__Orach_Chayim: 29, Shulchan_Arukh__Yoreh_Deah: 61, Shulchan_Arukh__Even_HaEzer: 8, Shulchan_Arukh__Choshen_Mishpat: 36, Tur: 134, Beit_Yosef: 134, Chayyei_Adam: 15 };
  for (const [workId, count] of Object.entries(expected)) assert.equal(workById(workId).editions[0].topics.length, count, workId);
  const oc = workById('Shulchan_Arukh__Orach_Chayim').editions[0];
  assert.equal(topicLabel(oc, 670), 'הלכות חנוכה');
  assert.equal(topicLabel(oc, 1), 'הלכות הנהגת האדם בבוקר');
  // The commentaries on Orach Chayim follow its simanim and its groups.
  assert.equal(topicLabel(workById('Mishnah_Berurah').editions[0], 670), 'הלכות חנוכה');
  const contents = render('books/w/Shulchan_Arukh__Orach_Chayim');
  assert.match(contents, /library-toc-topic">הלכות ציצית · ח׳–כ״ד</);
  // The filter keeps a whole group by its name, or the simanim whose title matches.
  const items = Array.from({ length: 30 }, (_, i) => ({ node: i + 1, title: `סימן ${['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳'][i] || 'ט׳'}`, numbered: { name: 'סימן', numeral: 'x' } }));
  const runs = library.topicRuns(items.slice(0, 8), oc.topics, null);
  assert.deepEqual(runs.map(run => run.topicTitle), ['הלכות הנהגת האדם בבוקר', 'הלכות ציצית']);
  assert.deepEqual(library.filterRuns(runs, 'ציצית', null).map(run => run.topicTitle), ['הלכות ציצית']);
  assert.deepEqual(library.filterRuns(runs, 'שבת', null), []);
  // Tur prints two groups in one siman (כלאי זרעים, כלאי בהמה): both list it.
  const turTopics = workById('Tur').editions[0].topics.filter(topic => /כלאי (זרעים|בהמה)/.test(topic.title));
  assert.equal(turTopics.length, 2);
  assert.equal(turTopics[0].from, turTopics[1].from);
});
