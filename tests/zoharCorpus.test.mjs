// The Zohar corpus pack: integrity, licences, honest coverage and the relationship model (base page → its layers).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire, Module } from 'node:module';
import { buildSync } from 'esbuild';
import { ACQUISITION_QUEUE, CORPUS_INDEX, COVERAGE, EDITIONS, LICENSES, PACK_INDEX, COLLECTION_INDEX, PUBLIC_WORKS, REMOTE_LAYERS, WORKS, workById, worksInCategory } from '../src/data/library/registry.mjs';
import { BLOCKED_LAYERS, CORPUS_REPORTS } from '../src/data/library/corpusIndex.mjs';
import { coverageRecord, validateWorkChunk } from '../src/services/library/integrity.mjs';
import { checksum } from '../src/services/prayer/checksum.mjs';
import { loadEditionChunk, packBytesToText, verifyChunkText } from '../src/services/library/packs.mjs';
import { gunzipBytes } from '../src/services/library/inflate.mjs';
import { nodeForRef, paginationNodes } from '../src/services/library/pagination.mjs';
import { NO_TRANSLATION_NOTICE, layersAt, layersForRef, layersOf, loadAnchors, loadLayerUnits, loadRemoteLayerUnits, parseBaseRef, remoteRef } from '../src/services/library/relations.mjs';
import { resolveLibraryReference, searchWorks } from '../src/services/library/search.mjs';
import { tocGroups } from '../src/services/library/toc.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const packPath = (packId, file) => fileURLToPath(new URL(`../public/library/packs/${packId}/${file}`, import.meta.url));
const text = (packId, file) => gunzipSync(readFileSync(packPath(packId, file))).toString('utf8');
const diskFetch = async url => new Response(readFileSync(`${root}public/${decodeURIComponent(new URL(url, 'http://app/').pathname.slice(1))}`));
// This file covers the Zohar pack; the Tanakh and Mishnah commentary corpora have their own tests (commentaryCorpus).
const ZOHAR_PACKS = CORPUS_INDEX.filter(pack => pack.packId === 'wikisource-zohar-cc-by-sa');
const corpusWorks = ZOHAR_PACKS.flatMap(pack => pack.works.map(work => ({ ...work, pack })));
const zohar = workById('Zohar');
const provenance = JSON.parse(readFileSync(new URL('../sources/wikisource-zohar/provenance.json', import.meta.url), 'utf8'));

test('integrity: every corpus file re-validates from disk — checksum, edition, ids, order, no markup', () => {
  assert.equal(corpusWorks.length, 4);
  const manifest = JSON.parse(readFileSync(packPath('wikisource-zohar-cc-by-sa', 'manifest.json'), 'utf8'));
  const ids = new Set();
  for (const work of corpusWorks) {
    const body = text(work.pack.packId, work.file);
    assert.equal(checksum(body), work.checksum, work.workId);
    assert.ok(manifest.files.some(file => file.file === work.file && file.checksum === work.checksum), `${work.workId} in manifest`);
    const chunk = verifyChunkText(body, workById(work.workId).editions[0]);
    const report = validateWorkChunk(chunk, work.expected.map((units, i) => ({ n: i + 1, units })));
    assert.equal(report.status, work.status, work.workId);
    assert.deepEqual([report.duplicateIds, report.emptyUnits, report.invalidRefs, report.unexpectedUnits, report.orderErrors].map(list => list.length), [0, 0, 0, 0, 0], work.workId);
    for (const node of chunk.nodes) for (const unit of node.units) {
      assert.match(unit.id, /^[A-Z][A-Za-z_]*\.\d+\.\d+$/);
      assert.doesNotMatch(unit.text, /[<>]/, unit.id);
      assert.doesNotMatch(unit.text, /\{\{|\}\}|\[\[|\]\]|''|^[:*#]/, `${unit.id}: wiki markup left`);
      assert.equal(ids.has(unit.id), false, unit.id);
      ids.add(unit.id);
    }
    const report2 = CORPUS_REPORTS.find(item => item.workId === work.workId);
    assert.deepEqual([report2.importedUnits, report2.status, report2.checksum], [report.importedUnits, report.status, work.checksum]);
  }
  const others = WORKS.filter(work => !corpusWorks.some(item => item.workId === work.workId)).map(work => work.workId);
  for (const work of corpusWorks) assert.equal(others.includes(work.workId), false, `${work.workId} is unique in the library`);
});

test('the Zohar keeps its printed pagination: three Mantua volumes, every amud a node, parashot as sections', () => {
  const edition = zohar.editions[0];
  assert.deepEqual(edition.pagination.volumes.map(v => [v.title, v.first, v.last]), [['חלק א', '1a', '251a'], ['חלק ב', '2a', '269a'], ['חלק ג', '2a', '299b']]);
  const pages = paginationNodes(edition.pagination);
  assert.equal(pages.length, 1632);
  assert.equal(edition.expected.length, 1632);
  assert.equal(edition.nodeTitles[nodeForRef(edition.pagination, '1:15a') - 1], 'חלק א · דף ט״ו ע״א');
  assert.equal(pages[nodeForRef(edition.pagination, '3:299b') - 1].title, 'חלק ג · דף רצ״ט ע״ב');
  // Sections tile the book, each named by volume and parasha; the page a parasha starts on opens it.
  assert.equal(edition.sections[0].from, 1);
  edition.sections.forEach((section, i) => { if (i) assert.equal(section.from, edition.sections[i - 1].to + 1); });
  assert.equal(edition.sections.at(-1).to, 1632);
  const start = title => pages[edition.sections.find(section => section.title === title).from - 1].ref;
  assert.equal(start('חלק א · בראשית'), '1:15a');
  assert.equal(start('חלק א · נח'), '1:59b');
  assert.equal(start('חלק ב · תרומה'), '2:126a');
  assert.equal(start('חלק ג · במדבר'), '3:116a', 'the title pages between the books go with the book they open');
  assert.deepEqual(tocGroups(edition).flatMap(group => group.nodes), Array.from({ length: 1632 }, (_, i) => i + 1));
  // Streams printed on a page (רעיא מהימנא, סתרי תורה…) are marked where they begin; the Aramaic itself is untouched.
  const chunk = verifyChunkText(text('wikisource-zohar-cc-by-sa', 'Zohar.json.gz'), edition);
  const first = chunk.nodes[0].units[0].text;
  assert.match(first, /^רבי חזקיה פתח, כתיב \(שיר השירים ב\) כשושנה בין החוחים, מאן שושנה\? דא כנסת ישראל\./);
  const heads = new Set(chunk.nodes.flatMap(node => node.units.map(unit => unit.head).filter(Boolean)));
  for (const stream of ['רעיא מהימנא', 'סתרי תורה', 'מדרש הנעלם', 'תוספתא']) assert.ok(heads.has(stream), stream);
  assert.ok(chunk.nodes.reduce((total, node) => total + node.units.length, 0) > 17000);
});

test('licences: every corpus pack is redistributable offline, CC BY-SA carries attribution, remote layers are public domain', () => {
  for (const pack of ZOHAR_PACKS) {
    assert.ok(['public-domain', 'cc-by', 'cc-by-sa'].includes(pack.license), pack.packId);
    assert.equal(LICENSES[pack.license].offlineAllowed, true);
    for (const work of pack.works) {
      assert.equal(work.license, pack.license, work.workId);
      if (work.license === 'cc-by-sa') {
        assert.match(work.attribution.text, /CC BY-SA 4\.0/, work.workId);
        assert.match(work.attribution.text, /ויקיטקסט/, work.workId);
        assert.equal(work.attribution.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0/');
        assert.match(work.attribution.url, /^https:\/\/(he\.wikisource\.org|www\.sefaria\.org)\//);
      }
    }
  }
  // Every Wikisource page used is pinned by revision.
  assert.equal(provenance.license, 'CC BY-SA 4.0');
  assert.equal(provenance.pages.filter(page => page.role === 'amud').length, 1632);
  for (const page of provenance.pages) {
    assert.ok(Number.isInteger(page.revid) && page.revid > 0, page.title);
    assert.equal(page.oldidUrl, `https://he.wikisource.org/w/index.php?oldid=${page.revid}`);
    assert.match(page.sha256, /^[0-9a-f]{64}$/);
  }
  for (const layer of REMOTE_LAYERS) {
    assert.equal(layer.license, 'public-domain', layer.workId);
    assert.equal(layer.recordedLicense, 'Public Domain', layer.workId);
    assert.equal(workById(layer.workId).coverage, COVERAGE.REMOTE_ONLY);
    assert.equal(workById(layer.workId).public, false, 'a remote layer is reached from its page, not listed as a book');
  }
  // The credits page names these texts and says the licence is theirs, not the whole app's.
  const about = readFileSync(new URL('../src/pages/AboutPage.jsx', import.meta.url), 'utf8');
  assert.match(about, /הרישיון חל על טקסטים אלה בלבד, ולא על האפליקציה ועל שאר תכניה/);
  assert.match(about, /attributionCredits\(\)/);
  const { attributionCredits } = loadJsx('pages/AboutPage.jsx');
  assert.equal(attributionCredits().filter(item => item.key.startsWith('wikisource-zohar-cc-by-sa:')).length, 4);
  assert.ok(attributionCredits().every(item => /CC BY-SA 4\.0/.test(item.text)));
});

test('the permission queue is never packaged; the Wikisource translation is held back with its reasons', () => {
  const held = ACQUISITION_QUEUE.filter(item => ['PERMISSION_REQUIRED', 'BLOCKED'].includes(item.status));
  assert.ok(held.length >= 20);
  for (const title of ['שו״ת יביע אומר', 'שו״ת יחוה דעת', 'חזון עובדיה', 'הליכות עולם', 'אור יקר (רמ״ק)']) assert.ok(held.some(item => item.title === title), title);
  for (const version of ['Hebrew Translation', 'Sulam Edition, Jerusalem 1945', 'Vocalized Zohar, Israel 2013']) assert.ok(held.some(item => item.match?.versionTitle === version), version);
  for (const item of held.filter(entry => entry.match)) {
    const hit = EDITIONS.filter(edition => (!item.match.title || edition.sourceIdentifier === item.match.title || edition.sourceIdentifier === item.match.title.replace(/ /g, '_'))
      && (!item.match.versionTitle || edition.title === item.match.versionTitle || edition.versionTitle === item.match.versionTitle)
      && (!item.match.provider || edition.sourceProvider === item.match.provider));
    assert.deepEqual(hit.map(edition => edition.editionId), [], item.title);
  }
  // Nefesh David: the Wikisource copy is used, never Sefaria's version of unknown licence.
  assert.equal(workById('Nefesh_David_on_Zohar').editions[0].sourceProvider, 'wikisource');
  // The translation: recorded, BLOCKED, never a work, never a layer.
  assert.equal(provenance.translation.decision, 'BLOCKED — not imported, not shown');
  assert.match(provenance.translation.reasons[0], /מבוסס על הסולם/);
  assert.deepEqual(BLOCKED_LAYERS.map(layer => [layer.relation.relationType, layer.coverage.coverageStatus, layer.coverage.importedUnits]), [['translation', COVERAGE.BLOCKED, 0]]);
  assert.equal(WORKS.some(work => work.relation?.relationType === 'translation'), false);
  assert.equal(readdirSync(fileURLToPath(new URL('../public/library/packs/wikisource-zohar-cc-by-sa', import.meta.url))).some(file => /Translat|מתורגם/i.test(file)), false);
});

test('coverage is honest: counts come from the data, FULL only when nothing is missing, no translation shown outside coverage', () => {
  const cover = zohar.coverageDetail;
  assert.deepEqual([cover.expectedUnits, cover.importedUnits, cover.coveragePercent], [1630, 1630, 100]);
  assert.deepEqual(cover.noTextInPrint, ['3:116a', '3:116b'], 'the title pages carry no text in print');
  assert.equal(cover.coverageStatus, COVERAGE.PARTIAL, 'the transcription marks incomplete passages; the pack says so');
  assert.ok(cover.incompletePassages.length > 0 && cover.incompletePassages.every(item => /^\d:\d+[ab]$/.test(item.ref)));
  assert.equal(zohar.coverage, COVERAGE.PARTIAL);
  const yahel = workById('Yahel_Ohr_on_Zohar');
  assert.deepEqual([yahel.coverageDetail.expectedUnits, yahel.coverageDetail.importedUnits, yahel.coverageDetail.missingUnits.length, yahel.coverage], [5763, 5761, 2, COVERAGE.PARTIAL]);
  assert.deepEqual([workById('Beur_HaGra_on_Sifra_DeTzniuta').coverageDetail.importedUnits, workById('Beur_HaGra_on_Sifra_DeTzniuta').coverage], [297, COVERAGE.FULL]);
  for (const layer of REMOTE_LAYERS) assert.deepEqual([layer.coverage.importedUnits, layer.coverage.coverageStatus], [0, COVERAGE.REMOTE_ONLY]);
  assert.throws(() => coverageRecord({ expectedUnits: 10, importedUnits: 9, coverageStatus: COVERAGE.FULL }), /FULL/);
  assert.equal(coverageRecord({ expectedUnits: 1630, importedUnits: 165 }).coverageStatus, COVERAGE.PARTIAL);
  assert.equal(coverageRecord({ expectedUnits: 1630, importedUnits: 165 }).coveragePercent, 10.1);
  // No open translation exists: every page of the Zohar shows exactly the notice, and never a translation.
  for (let node = 1; node <= 1632; node += 1) {
    const layers = layersForRef(`Zohar.${node}`);
    assert.deepEqual(layers.translations, []);
    assert.equal(layers.translationNotice, 'טרם קיים תרגום פתוח לקטע זה');
  }
  // A PARTIAL translation (model check with a stand-in layer): offered only on the pages it covers.
  const partial = { workId: 'Zohar_Translation_Fixture', kind: 'pack', relation: { relationType: 'translation', baseWorkId: 'Zohar', anchorScheme: 'mantua-page' }, editions: [{ anchorNodes: [[29, 1, 1, 12], [30, 2, 1, 9]] }], coverage: COVERAGE.PARTIAL };
  const works = [...WORKS, partial];
  assert.equal(layersForRef('Zohar 1:15a', works).translations[0].work.workId, 'Zohar_Translation_Fixture');
  assert.equal(layersForRef('Zohar 1:15a', works).translationNotice, null);
  assert.deepEqual(layersForRef('Zohar 1:16a', works).translations, []);
  assert.equal(layersForRef('Zohar 1:16a', works).translationNotice, NO_TRANSLATION_NOTICE);
});

test('relationship lookup: a Zohar page returns its commentaries with their segments, anchored per unit', async () => {
  assert.deepEqual(parseBaseRef('Zohar 1:15a'), { workId: 'Zohar', node: 29, unit: null });
  assert.deepEqual(parseBaseRef('Zohar.29.3'), { workId: 'Zohar', node: 29, unit: 3 });
  assert.deepEqual(layersOf('Zohar').map(work => work.workId).sort(), ['Beur_HaGra_on_Sifra_DeTzniuta', 'Ketem_Paz_on_Zohar', 'Mikdash_Melekh_RaMaZ_on_Zohar', 'Mikdash_Melekh_on_Zohar', 'Nefesh_David_on_Zohar', 'Ohr_HaChammah_on_Zohar', 'Yahel_Ohr_on_Zohar']);
  const here = layersForRef('Zohar 1:15a');
  assert.equal(here.base.title, 'חלק א · דף ט״ו ע״א');
  assert.deepEqual(here.commentaries.map(layer => [layer.work.workId, layer.remote]), [['Yahel_Ohr_on_Zohar', false], ['Ketem_Paz_on_Zohar', true], ['Mikdash_Melekh_on_Zohar', true], ['Ohr_HaChammah_on_Zohar', true]]);
  const yahel = here.commentaries[0];
  const units = await loadLayerUnits(yahel, { fetchImpl: diskFetch });
  assert.equal(units.length, yahel.count);
  const anchors = await loadAnchors(yahel.work, { fetchImpl: diskFetch });
  assert.equal(anchors.relationType, 'commentary');
  assert.equal(anchors.baseWorkId, 'Zohar');
  const byUnit = new Map(anchors.anchors.map(anchor => [anchor.unitId, anchor]));
  for (const unit of units) {
    assert.equal(byUnit.get(unit.id).anchorRef, 'Zohar.29');
    assert.match(byUnit.get(unit.id).canonicalRef, /^Yahel Ohr on Zohar 1:15a:\d+$/);
  }
  // Every anchor of every bundled layer points at a Zohar page that has text, and the page index agrees with it.
  const zoharChunk = await loadEditionChunk(zohar.editions[0], { fetchImpl: diskFetch });
  const withText = new Set(zoharChunk.nodes.map(node => node.n));
  for (const work of layersOf('Zohar').filter(item => item.kind === 'pack')) {
    const record = await loadAnchors(work, { fetchImpl: diskFetch });
    const chunk = await loadEditionChunk(work.editions[0], { fetchImpl: diskFetch });
    const unitIds = new Set(chunk.nodes.flatMap(node => node.units.map(unit => unit.id)));
    for (const anchor of record.anchors) {
      assert.ok(unitIds.has(anchor.unitId), anchor.unitId);
      assert.ok(withText.has(Number(anchor.anchorRef.split('.')[1])), `${anchor.unitId} → ${anchor.anchorRef}`);
    }
    const indexed = work.editions[0].anchorNodes.reduce((total, [, , from, to]) => total + to - from + 1, 0);
    assert.equal(indexed, record.anchors.length, work.workId);
  }
  // Beur HaGra on Sifra DeTzniuta sits on the pages of the Sifra DeTzniuta (II 176b–179a), through Sefaria's links.
  const sdt = layersForRef('Zohar 2:176b').commentaries.find(layer => layer.work.workId === 'Beur_HaGra_on_Sifra_DeTzniuta');
  assert.ok(sdt && sdt.count > 0);
  assert.deepEqual(layersAt('Zohar', 1).map(layer => layer.work.workId).includes('Beur_HaGra_on_Sifra_DeTzniuta'), false);
});

test('remote layers: the exact registered public-domain edition, refused otherwise', async () => {
  const layer = layersForRef('Zohar 1:15a').commentaries.find(item => item.work.workId === 'Mikdash_Melekh_on_Zohar');
  assert.equal(remoteRef(layer.work, zohar, 29), 'Mikdash Melekh on Zohar 1:15a');
  assert.equal(remoteRef(workById('Ketem_Paz_on_Zohar'), zohar, 29), 'Ketem Paz on Zohar 15a');
  let asked = null;
  const ok = async url => { asked = url; return new Response(JSON.stringify({ versions: [{ versionTitle: 'Zholkva, 1864', license: 'Public Domain', text: ['<b>בריש</b> הורמנותא', '', 'ב'] }] })); };
  const units = await loadRemoteLayerUnits(layer, 29, { fetchImpl: ok });
  assert.match(asked, /^https:\/\/www\.sefaria\.org\/api\/v3\/texts\/Mikdash%20Melekh%20on%20Zohar%201%3A15a\?version=hebrew%7CZholkva%2C%201864&return_format=text_only$/);
  assert.deepEqual(units.map(unit => [unit.id, unit.text]), [['Mikdash_Melekh_on_Zohar.29.1', 'בריש הורמנותא'], ['Mikdash_Melekh_on_Zohar.29.3', 'ב']]);
  const other = { ...layer, work: { ...layer.work, editions: [{ ...layer.work.editions[0], editionId: 'x' }] } };
  await assert.rejects(loadRemoteLayerUnits(other, 30, { fetchImpl: async () => new Response(JSON.stringify({ versions: [{ versionTitle: 'Zholkva, 1864', license: 'CC-BY-NC', text: ['א'] }] })) }), /אינה המהדורה הרשומה/);
  await assert.rejects(loadRemoteLayerUnits(other, 31, { fetchImpl: async () => new Response(JSON.stringify({ versions: [{ versionTitle: 'Other', license: 'Public Domain', text: ['א'] }] })) }), /אינה המהדורה הרשומה/);
  await assert.rejects(loadRemoteLayerUnits(other, 32, { fetchImpl: async () => { throw new TypeError('offline'); } }), /חיבור לאינטרנט/);
});

test('findable: the Zohar leads the Kabbalah foundations, its commentaries have their own group, printed pages resolve', () => {
  const kabbalah = worksInCategory('kabbalah');
  assert.equal(kabbalah.find(work => work.group === 'yesod').workId, 'Zohar');
  assert.deepEqual(kabbalah.filter(work => work.group === 'zohar-commentary').map(work => work.workId), ['Yahel_Ohr_on_Zohar', 'Beur_HaGra_on_Sifra_DeTzniuta', 'Nefesh_David_on_Zohar']);
  assert.equal(searchWorks('זוהר', PUBLIC_WORKS)[0].work.workId, 'Zohar');
  assert.equal(searchWorks('ספר הזהר', PUBLIC_WORKS)[0].work.workId, 'Zohar');
  const resolve = query => resolveLibraryReference(query, PUBLIC_WORKS);
  assert.deepEqual(resolve('זוהר ח"א טו ע"א'), { kind: 'pack', workId: 'Zohar', node: 29, unit: null, label: 'ספר הזהר' });
  assert.equal(resolve('זהר חלק ב דף קכג:').node, nodeForRef(zohar.editions[0].pagination, '2:123b'));
  assert.equal(resolve('זוהר ג קטז א'), null, 'a page without text in print is not offered as a place');
  assert.equal(resolve('זוהר א רנב א'), null, 'no such page in the Mantua volume');
});

function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false }) }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}

test('reader: מקור | מפרשים tabs only where layers exist, the exact notice where no translation covers, printed-page contents', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: LibraryPage, parseLibraryRoute, libraryRoute, readerNeighbors } = loadJsx('pages/LibraryPage.jsx');
  const render = mode => renderToStaticMarkup(React.createElement(LibraryPage, { route: parseLibraryRoute(mode), go: () => {}, openSource: () => {} }));
  const page = render(libraryRoute.read('Zohar', 29));
  assert.match(page, /<h1>ספר הזהר · חלק א · דף ט״ו ע״א<\/h1>/);
  assert.match(page, /<p class="library-parasha-range">פרשת בראשית<\/p>/);
  assert.match(page, /role="tab"[^>]*>מקור<\/button>/);
  assert.match(page, /role="tab"[^>]*>מפרשים<\/button>/);
  assert.doesNotMatch(page, />תרגום<\/button>/, 'no translation tab without a translation');
  assert.match(page, /<p class="library-layer-note">טרם קיים תרגום פתוח לקטע זה<\/p>/);
  assert.match(page, /CC BY-SA 4\.0 · <a href="https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/"/, 'the share-alike credit is under the text');
  // A page no commentary reaches has no tab bar at all, but still says there is no open translation.
  const bare = layersAt('Zohar', 2).length ? null : render(libraryRoute.read('Zohar', 2));
  if (bare) { assert.doesNotMatch(bare, /library-layer-tabs/); assert.match(bare, /טרם קיים תרגום פתוח לקטע זה/); }
  // Books with no layers are untouched: no tabs, no notice.
  const plain = render(libraryRoute.read('Shulchan_Arukh__Orach_Chayim', 1));
  assert.doesNotMatch(plain, /library-layer-tabs|library-layer-note|library-credit/);
  // Contents: volumes fold open to parashot, each a grid of pages; pages without text are shown but disabled.
  const book = render(libraryRoute.work('Zohar'));
  assert.equal((book.match(/<button type="button"[^>]*aria-label="חלק [אבג] · דף/g) || []).length, 1632);
  assert.equal((book.match(/aria-label="[^"]*אין בו טקסט"/g) || []).length, 2);
  assert.match(book, /<button type="button" disabled="" aria-label="חלק ג · דף קט״ז ע״א · אין בו טקסט">קט״ז\.<\/button>/);
  assert.match(book, /<p class="library-toc-caption">הקדמת הזהר<\/p>/);
  // A commentary lists only the pages it reaches, and reading steps over the pages it does not.
  const yahel = workById('Yahel_Ohr_on_Zohar');
  const yahelBook = render(libraryRoute.work('Yahel_Ohr_on_Zohar'));
  assert.equal((yahelBook.match(/aria-label="חלק [אבג] · דף [^"]*">/g) || []).length, yahel.editions[0].nodes.slice(0, 1632).filter(Boolean).length);
  const next = readerNeighbors(yahel, 1).next;
  assert.ok(next.node > 1 && yahel.editions[0].nodes[next.node - 1] > 0);
  assert.equal(readerNeighbors(zohar, nodeForRef(zohar.editions[0].pagination, '3:115b')).next.node, nodeForRef(zohar.editions[0].pagination, '3:117a'), 'the title pages are stepped over');
});

test('size: the five older packs are stored gzip-compressed and read back byte-for-byte, with or without DecompressionStream', async () => {
  for (const pack of PACK_INDEX) for (const work of pack.works) {
    assert.match(work.file, /\.json\.gz$/, work.workId);
    assert.equal(existsSync(packPath(pack.packId, work.file.replace(/\.gz$/, ''))), false, `${work.workId}: no plain copy left`);
  }
  // The JavaScript inflater (iOS < 16.4) returns exactly what zlib does, on real packs and on stored/fixed/dynamic blocks.
  const samples = [['uxlc-2.5', 'Genesis.json.gz'], ['sefaria-shulchan-arukh-pd', 'Shulchan_Arukh__Orach_Chayim.json.gz'], ['wikisource-zohar-cc-by-sa', 'Zohar.json.gz'], [COLLECTION_INDEX[0].packId, COLLECTION_INDEX[0].works[0].file]];
  for (const [packId, file] of samples) {
    const bytes = readFileSync(packPath(packId, file));
    assert.equal(Buffer.compare(Buffer.from(gunzipBytes(bytes)), gunzipSync(bytes)), 0, file);
    assert.equal(await packBytesToText(bytes, { native: false }), gunzipSync(bytes).toString('utf8'));
  }
  for (const level of [0, 1, 9]) {
    const body = Buffer.from(`${'בראשית ברא '.repeat(5000)}${level}`);
    assert.equal(Buffer.compare(Buffer.from(gunzipBytes(gzipSync(body, { level }))), body), 0, `level ${level}`);
  }
  assert.throws(() => gunzipBytes(new Uint8Array([1, 2, 3])), /gzip/);
});
