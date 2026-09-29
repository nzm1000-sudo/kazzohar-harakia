// The Shulchan Arukh's nosei kelim: integrity of the siman-range files, licences (verified live at build time; never NC
// or unknown), anchors to the seif on samples, honest coverage, one Kaf HaChaim, the owner's shelves, the reader's
// מפרשים tab only where content exists, remote layers in their registered edition, and the Halacha Engine's links.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire, Module } from 'node:module';
import { buildSync } from 'esbuild';
import { CORPUS_INDEX, COVERAGE, LICENSES, PUBLIC_WORKS, REMOTE_LAYERS, WORKS, workById, worksInCategory } from '../src/data/library/registry.mjs';
import { CORPUS_REPORTS, SHULCHAN_ARUKH_COVERAGE } from '../src/data/library/corpusIndex.mjs';
import { validateWorkChunk } from '../src/services/library/integrity.mjs';
import { checksum } from '../src/services/prayer/checksum.mjs';
import { editionPartFor, loadEditionChunk, loadWholeEdition, verifyChunkText } from '../src/services/library/packs.mjs';
import { layersAt, layersBySeif, layersForRef, loadAnchors, loadLayerUnits, loadRemoteLayerUnits, remoteRef } from '../src/services/library/relations.mjs';
import { resolveLibraryReference, searchWorks } from '../src/services/library/search.mjs';
import { localLibraryRoute } from '../src/services/library/localRefs.mjs';
import { ONG_SHABBAT_NOTE_LINKS } from '../src/data/ongShabbatLinks.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const packPath = (packId, file) => fileURLToPath(new URL(`../public/library/packs/${packId}/${file}`, import.meta.url));
const text = (packId, file) => gunzipSync(readFileSync(packPath(packId, file))).toString('utf8');
const diskFetch = async url => new Response(readFileSync(`${root}public/${decodeURIComponent(new URL(url, 'http://app/').pathname.slice(1))}`));
const PACK_IDS = ['wikisource-shulchan-arukh-commentary-cc-by-sa', 'sefaria-shulchan-arukh-commentary-public-domain'];
const PACKS = CORPUS_INDEX.filter(pack => PACK_IDS.includes(pack.packId));
const works = PACKS.flatMap(pack => pack.works.map(work => ({ ...work, pack })));
const provenance = JSON.parse(readFileSync(new URL('../sources/shulchan-arukh-commentaries/provenance.json', import.meta.url), 'utf8'));
const OC = 'Shulchan_Arukh__Orach_Chayim';
const unitAt = async (workId, siman, n) => (await loadEditionChunk(workById(workId).editions[0], { node: siman, fetchImpl: diskFetch })).nodes.find(node => node.n === siman).units.find(unit => unit.n === n);

test('integrity: every siman-range file re-validates from disk — checksum, edition, ids, order, seif, no markup', () => {
  assert.deepEqual(PACKS.map(pack => pack.packId).sort(), [...PACK_IDS].sort());
  assert.deepEqual(works.map(work => work.workId).sort(), ['Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim', 'Biur_Halacha', 'Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim', 'Mishnah_Berurah']);
  const base = workById(OC).editions[0];
  for (const pack of PACKS) {
    const manifest = JSON.parse(readFileSync(packPath(pack.packId, 'manifest.json'), 'utf8'));
    for (const work of pack.works) {
      const edition = workById(work.workId).editions[0];
      // The ranges tile the book in order, with no gap and no overlap.
      assert.equal(work.parts[0].from, 1);
      work.parts.forEach((part, i) => { if (i) assert.equal(part.from, work.parts[i - 1].to + 1, work.workId); });
      assert.equal(work.parts.at(-1).to, work.expected.length);
      assert.equal(work.checksum, checksum(work.parts.map(part => part.checksum).join('|')));
      const nodes = [];
      for (const part of work.parts) {
        const body = text(pack.packId, part.file);
        assert.equal(checksum(body), part.checksum, part.file);
        assert.ok(part.bytes < 450 * 1024, `${part.file}: a siman loads a small file`);
        assert.ok(manifest.files.some(file => file.file === part.file && file.checksum === part.checksum && file.role === 'part'), `${part.file} in manifest`);
        const chunk = verifyChunkText(body, { ...edition, file: part.file, checksum: part.checksum });
        assert.ok(chunk.nodes.every(node => node.n >= part.from && node.n <= part.to), part.file);
        nodes.push(...chunk.nodes);
      }
      const report = validateWorkChunk({ workId: work.workId, nodes }, work.expected.map((units, i) => ({ n: i + 1, units })));
      assert.equal(report.status, work.status, work.workId);
      assert.deepEqual([report.duplicateIds, report.emptyUnits, report.invalidRefs, report.unexpectedUnits, report.orderErrors].map(list => list.length), [0, 0, 0, 0, 0], work.workId);
      assert.deepEqual(report.missingUnits, work.missingUnits, work.workId);
      for (const node of nodes) for (const unit of node.units) {
        assert.doesNotMatch(`${unit.dh || ''} ${unit.title || ''} ${unit.text}`, /[<>]|&[a-z]+;|\{\{|\[\[|'''/, unit.id);
        if (unit.v) assert.ok(node.n <= 697 && unit.v >= 1 && unit.v <= base.nodes[node.n - 1], `${unit.id} sits on a seif of the Shulchan Arukh`);
      }
      assert.ok(manifest.files.some(file => file.role === 'anchors' && file.file === work.anchorsFile && file.checksum === work.anchorsChecksum));
      const reportRow = CORPUS_REPORTS.find(item => item.workId === work.workId);
      assert.deepEqual([reportRow.importedUnits, reportRow.status, reportRow.checksum], [report.importedUnits, report.status, work.checksum]);
    }
  }
  assert.equal(WORKS.filter(work => works.some(item => item.workId === work.workId)).length, works.length, 'each work once in the library');
});

test('files by siman range: a siman loads only its own file; the whole book is still whole', async () => {
  const edition = workById('Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim').editions[0];
  assert.ok(edition.parts.length >= 10);
  const part = editionPartFor(edition, 319);
  assert.ok(part.from <= 319 && part.to >= 319);
  const chunk = await loadEditionChunk(edition, { node: 319, fetchImpl: diskFetch });
  assert.ok(chunk.nodes.some(node => node.n === 319));
  assert.equal(chunk.nodes.some(node => node.n === 1), part.from === 1);
  const whole = await loadWholeEdition(workById('Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim').editions[0], { fetchImpl: diskFetch });
  assert.equal(whole.nodes.reduce((total, node) => total + node.units.length, 0), 5485);
});

test('licences: re-verified live at build time, open only — never NC or unknown; Wikisource texts CC BY-SA with credit', () => {
  assert.match(provenance.builtAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(provenance.licence.wikisource.rightsinfo.url, /creativecommons\.org\/licenses\/by-sa\/4\.0/);
  for (const record of [...provenance.sefaria, ...provenance.markerEditions, ...provenance.remoteLayers]) {
    assert.ok(['Public Domain', 'CC-BY-SA'].includes(record.recordedLicense), `${record.title}: ${record.recordedLicense}`);
    assert.equal(record.licenseVerifiedAt, provenance.builtAt);
  }
  for (const work of works) {
    assert.equal(LICENSES[work.license].commercialUseAllowed, true, `${work.workId} carries no NC licence`);
    assert.equal(work.license, work.pack.license);
    if (work.license === 'cc-by-sa') {
      assert.equal(work.provider, 'wikisource');
      assert.match(work.attribution.text, /ויקיטקסט.*CC BY-SA 4\.0/);
      assert.equal(work.attribution.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0/');
    } else assert.equal(work.recordedLicense, 'Public Domain', work.workId);
  }
  assert.deepEqual(works.filter(work => work.license === 'cc-by-sa').map(work => work.workId).sort(), ['Biur_Halacha', 'Mishnah_Berurah']);
  // Every Wikisource page is pinned to its revision.
  for (const id of ['Mishnah_Berurah', 'Biur_Halacha']) {
    const pages = provenance.wikisource[id].pages;
    assert.ok(pages.length > 450, id);
    for (const page of pages) { assert.ok(Number.isInteger(page.revid) && page.revid > 0); assert.equal(page.oldidUrl, `https://he.wikisource.org/w/index.php?oldid=${page.revid}`); assert.match(page.sha256, /^[0-9a-f]{64}$/); }
  }
  // Remote: public domain, or the one Wikisource transcription (ערוך השולחן, אורח חיים) under CC BY-SA with its credit.
  const remote = REMOTE_LAYERS.filter(layer => layer.relation.baseWorkId.startsWith('Shulchan_Arukh__'));
  assert.equal(remote.length, 15);
  for (const layer of remote) {
    assert.ok(['public-domain', 'cc-by-sa'].includes(layer.license), layer.workId);
    if (layer.license === 'cc-by-sa') assert.deepEqual([layer.workId, layer.recordedLicense, Boolean(layer.attribution?.licenseUrl)], ['Arukh_HaShulchan_Orach_Chaim', 'CC-BY-SA', true]);
    assert.deepEqual([layer.coverage.importedUnits, layer.coverage.coverageStatus], [0, COVERAGE.REMOTE_ONLY]);
    assert.equal(workById(layer.workId).public, false, 'a remote layer is reached from the seif, not listed as a book');
  }
});

test('Kaf HaChaim: one edition in two halves that do not overlap; one book, under הלכה › שולחן ערוך ונושאי כליו', () => {
  const proof = provenance.kafHaChaimOneEdition;
  assert.equal(proof.sameVersionSource, 'https://www.nli.org.il/he/books/NNL_ALEPH001365916');
  assert.deepEqual(proof.overlappingSimanim, []);
  assert.ok(proof.halves[0].to < proof.halves[1].from);
  const kaf = PUBLIC_WORKS.filter(work => /kaf.?hachayim/i.test(work.workId) && /Orach/i.test(`${work.sourceTitle}`));
  assert.deepEqual(kaf.map(work => [work.workId, work.primaryCategory, work.group]), [['Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim', 'halacha', 'shulchan-arukh']]);
  const remote = workById('halacha.kaf-hachayim-oc');
  assert.deepEqual([remote.public, remote.supersededBy, remote.group], [false, 'Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim', 'shulchan-arukh']);
  // The owner's shelves hold: no תפילה or אחרונים shelf; the Haggadah stays out of the books.
  assert.equal(worksInCategory('tefillah').length, 0);
  assert.equal(worksInCategory('acharonim').length, 0);
  assert.equal(workById('Pesach_Haggadah').public, false);
  const shelf = worksInCategory('halacha').filter(work => work.group === 'shulchan-arukh').map(work => work.workId);
  for (const id of ['Mishnah_Berurah', 'Biur_Halacha', 'Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim', 'Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim', OC]) assert.ok(shelf.includes(id), id);
});

test('anchors: known comments land on their seif; two sources agree on the seif of the משנה ברורה', async () => {
  const mb = await unitAt('Mishnah_Berurah', 1, 1);
  assert.deepEqual([mb.v, mb.dh], [1, 'לעבודת בוראו']);
  assert.match(mb.text, /^כי לכך נברא האדם/);
  assert.equal((await unitAt('Mishnah_Berurah', 1, 9)).v, 3);
  assert.deepEqual([(await unitAt('Biur_Halacha', 1, 1)).v, (await unitAt('Biur_Halacha', 1, 1)).dh], [1, 'שיהא הוא מעורר השחר']);
  assert.deepEqual([(await unitAt('Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim', 1, 1)).dh, (await unitAt('Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim', 1, 2)).v], ['כארי.', 1]);
  const kaf = await unitAt('Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim', 319, 1);
  assert.equal(kaf.v, 1);
  assert.match(kaf.dh, /^\[סעיף א'\] הבורר/);
  const anchors = await loadAnchors(workById('Mishnah_Berurah'), { fetchImpl: diskFetch });
  assert.deepEqual(anchors.anchors[0], { unitId: 'Mishnah_Berurah.1.1', anchorRef: `${OC}.1.1`, canonicalRef: 'Mishnah Berurah 1:1', baseCanonicalRef: 'Shulchan Arukh, Orach Chayim 1:1' });
  // The Wikisource headings and the printed markers of the Lemberg 1893 edition agree on ≥ 99.5% of the comments; where
  // they disagree the comment claims no seif.
  const cross = workById('Mishnah_Berurah').coverageDetail.anchorCrossCheck;
  assert.ok(cross.confirmedByPrintedMarkers / (cross.confirmedByPrintedMarkers + cross.disputed) > 0.995);
  assert.equal(provenance.problems.Mishnah_Berurah.seifDisputed.length, cross.disputed);
  // Every anchor names a real seif and a unit that sits on it.
  for (const work of works) {
    const record = await loadAnchors(workById(work.workId), { fetchImpl: diskFetch });
    const whole = await loadWholeEdition(workById(work.workId).editions[0], { fetchImpl: diskFetch });
    const byId = new Map(whole.nodes.flatMap(node => node.units.map(unit => [unit.id, unit])));
    for (const anchor of record.anchors) assert.equal(byId.get(anchor.unitId)?.v, Number(anchor.anchorRef.split('.').at(-1)), anchor.unitId);
    assert.equal(record.anchors.length, work.coverage.anchoredUnits);
  }
});

test('coverage is honest: counts from the printed structure, FULL only when nothing is missing, gaps named', () => {
  for (const work of works) {
    const cover = work.coverage;
    assert.equal(cover.importedUnits + cover.missingUnits.length, cover.expectedUnits, work.workId);
    assert.equal(cover.coverageStatus === COVERAGE.FULL, cover.missingUnits.length === 0, work.workId);
    assert.equal(cover.coveragePercent, Math.round((cover.importedUnits / cover.expectedUnits) * 1000) / 10);
    assert.ok(cover.basis && cover.anchorBasis, work.workId);
  }
  assert.equal(workById('Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim').coverage, COVERAGE.FULL);
  // Siman 36 of the Wikisource Mishnah Berurah is marked incomplete by the site: its gaps are listed, never filled.
  assert.ok(workById('Mishnah_Berurah').missingUnits.filter(id => id.startsWith('Mishnah_Berurah.36.')).length > 50);
  assert.ok(workById('Mishnah_Berurah').coverageDetail.coveragePercent > 99);
  assert.deepEqual(SHULCHAN_ARUKH_COVERAGE.bundled.map(item => item.id).sort(), works.map(work => work.workId).sort());
});

test('relationship: from a seif, the commentaries on it in customary order; tabs only where something exists', () => {
  const here = layersForRef(`${OC}.1.1`);
  assert.deepEqual(here.commentaries.filter(layer => !layer.remote).map(layer => layer.work.layerTitle), ['משנה ברורה', 'ביאור הלכה', 'באר היטב', 'כף החיים']);
  assert.ok(here.commentaries.some(layer => layer.remote && layer.work.layerTitle === 'מגן אברהם'));
  const seif = layersBySeif(OC, 1);
  assert.deepEqual(seif[0].layers.filter(layer => !layer.remote).map(layer => layer.work.layerTitle), ['משנה ברורה', 'ביאור הלכה', 'באר היטב', 'כף החיים']);
  assert.ok(seif.every(row => row.layers.every(layer => layer.count > 0)));
  // An introduction is shown before the comments of its siman, a named treatise after them.
  const rows = workById('Mishnah_Berurah').editions[0].anchorNodes;
  assert.ok(rows.findIndex(row => row[0] === 253 && row[1] > 697) < rows.findIndex(row => row[0] === 253 && row[1] === 253));
  assert.ok(rows.findIndex(row => row[0] === 36 && row[1] > 697) > rows.findIndex(row => row[0] === 36 && row[1] === 36));
  // A siman nothing reaches has no layers (YD 169 in the library's editions).
  assert.deepEqual(layersAt('Shulchan_Arukh__Yoreh_Deah', 169), []);
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

test('reader: שולחן ערוך | מפרשים only where content exists; commentaries are books after the text they explain', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: LibraryPage, parseLibraryRoute, libraryRoute } = loadJsx('pages/LibraryPage.jsx');
  const render = mode => renderToStaticMarkup(React.createElement(LibraryPage, { route: parseLibraryRoute(mode), go: () => {}, openSource: () => {} }));
  const tabs = page => [...page.matchAll(/role="tab"[^>]*>([^<]+)<\/button>/g)].map(match => match[1]);
  assert.deepEqual(tabs(render(libraryRoute.read(OC, 1))), ['מקור', 'מפרשים']);
  assert.deepEqual(tabs(render(libraryRoute.read('Shulchan_Arukh__Yoreh_Deah', 169))), []);
  assert.deepEqual(tabs(render(libraryRoute.read('Mishneh_Torah__Foundations_of_the_Torah', 1))), []);
  // The Mishnah Berurah as a book: simanim in a grid, the introductions and משנת סופרים as rows.
  const book = render(libraryRoute.work('Mishnah_Berurah'));
  assert.match(book, /הקדמה לסימן רנ״ג/);
  assert.match(book, /משנת סופרים/);
  const shelf = render('books/c/halacha');
  assert.ok(shelf.indexOf('שולחן ערוך, אורח חיים') < shelf.indexOf('משנה ברורה'), 'the text before its commentaries');
  assert.equal((shelf.match(/כף החיים/g) || []).length, 1, 'one Kaf HaChaim on the shelf');
  assert.equal(searchWorks('משנה ברורה', PUBLIC_WORKS)[0].work.workId, 'Mishnah_Berurah');
  assert.deepEqual(resolveLibraryReference('משנה ברורה א ג', PUBLIC_WORKS), { kind: 'pack', workId: 'Mishnah_Berurah', node: 1, unit: 3, label: 'משנה ברורה' });
  const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
  assert.match(css, /\.library-seif-layers\{/);
  assert.match(css, /\.library-unit-sk\{display:grid/);
});

test('remote layers: a siman of the registered edition, grouped by seif from the printed markers; refused otherwise', async () => {
  const layer = layersAt(OC, 1).find(item => item.work.workId === 'Magen_Avraham');
  assert.ok(layer?.remote && layer.count > 0);
  assert.equal(remoteRef(layer.work, workById(OC), 1), 'Magen Avraham 1');
  assert.equal(remoteRef(workById('Arukh_HaShulchan_Orach_Chaim'), workById(OC), 1), 'Arukh HaShulchan, Orach Chaim 1');
  const count = layer.count;
  const answer = (license, versionTitle = 'Magen Avraham') => async () => new Response(JSON.stringify({ versions: [{ versionTitle, license, text: Array.from({ length: count }, (_, i) => `ס״ק ${i + 1}`) }] }));
  const units = await loadRemoteLayerUnits(layer, 1, { fetchImpl: async url => (/\/library\/packs\//.test(url) ? diskFetch(url) : answer('Public Domain')()) });
  assert.equal(units.length, count);
  assert.ok(units.every(unit => Number.isInteger(unit.v) && unit.v >= 1), 'every comment sits on its seif');
  const other = { ...layer, work: { ...layer.work, editions: [{ ...layer.work.editions[0], editionId: 'other-for-test' }] } };
  await assert.rejects(loadRemoteLayerUnits(other, 2, { fetchImpl: answer('CC-BY-NC') }), /אינה המהדורה הרשומה/);
  await assert.rejects(loadRemoteLayerUnits(other, 3, { fetchImpl: answer('Public Domain', 'Some other edition') }), /אינה המהדורה הרשומה/);
  const aruch = layersAt(OC, 1).find(item => item.work.workId === 'Arukh_HaShulchan_Orach_Chaim');
  const got = await loadRemoteLayerUnits(aruch, 1, { fetchImpl: async () => new Response(JSON.stringify({ versions: [{ versionTitle: 'Arukh HaShulchan, Orach Chayim -- Wikisource', license: 'CC-BY-SA', text: ['א', 'ב'] }] })) });
  assert.equal(got.length, 2);
  // Kaf HaChaim on YD: a seif katan of several paragraphs arrives as one comment.
  const kafYd = layersAt('Shulchan_Arukh__Yoreh_Deah', 1).find(item => item.work.workId === 'Kaf_HaChayim_on_Shulchan_Arukh_Yoreh_Deah');
  const joined = await loadRemoteLayerUnits(kafYd, 1, { fetchImpl: async url => (/\/library\/packs\//.test(url) ? diskFetch(url) : new Response(JSON.stringify({ versions: [{ versionTitle: 'Kaf Hachayim, Yoreh Deah, Jerusalem 1936-1957', license: 'Public Domain', text: [['א', 'ב'], ['ג']] }] }))) });
  assert.deepEqual(joined.map(unit => unit.text), ['א\nב', 'ג']);
});

test('bundled layer units load from their own ranges (an introduction in another file)', async () => {
  const layer = layersAt(OC, 253).find(item => item.work.workId === 'Mishnah_Berurah');
  const units = await loadLayerUnits(layer, { fetchImpl: diskFetch });
  assert.equal(units[0].title, 'הקדמה');
  assert.ok(units.slice(1).every(unit => unit.v));
});

test('the Halacha Engine: Shulchan Arukh and Mishnah Berurah references open the book on the device', () => {
  assert.equal(localLibraryRoute('Shulchan Arukh, Orach Chayim 107:1'), `books/r/${OC}/107/1`);
  assert.equal(localLibraryRoute('Mishnah Berurah 1:3'), 'books/r/Mishnah_Berurah/1/3');
  assert.equal(localLibraryRoute("Shulchan Arukh, Yoreh De'ah 87:1"), 'books/r/Shulchan_Arukh__Yoreh_Deah/87/1');
  assert.equal(localLibraryRoute('Beit Yosef 1:1'), null, 'not on the device: opens as before');
  assert.equal(localLibraryRoute('Shulchan Arukh, Orach Chayim 900:1'), null);
  const page = readFileSync(new URL('../src/pages/HalachaLibrary.jsx', import.meta.url), 'utf8');
  assert.match(page, /localLibraryRoute\(src\.ref\)/);
  // עונג שבת's links already open the local text; each still names a seif the edition has, now with its commentaries.
  const links = Object.values(ONG_SHABBAT_NOTE_LINKS).flat().filter(link => link.kind === 'shulchan-arukh');
  assert.ok(links.length >= 50);
  for (const link of links) {
    assert.ok(link.unit <= workById(link.workId).editions[0].nodes[link.node - 1], link.label);
    assert.ok(layersAt(link.workId, link.node).length > 0, link.label);
  }
});

test('size: split per part and range, gzipped, checksummed; credits name each text and its licence', () => {
  const dirBytes = packId => readdirSync(packPath(packId, '')).reduce((total, file) => total + statSync(packPath(packId, file)).size, 0);
  assert.ok(PACK_IDS.reduce((total, id) => total + dirBytes(id), 0) < 9 * 1024 * 1024);
  const { shulchanArukhCredits, attributionCredits } = loadJsx('pages/AboutPage.jsx');
  const credits = shulchanArukhCredits();
  assert.deepEqual(credits.bundled.map(item => item.name), ['משנה ברורה', 'ביאור הלכה', 'באר היטב', 'כף החיים']);
  assert.ok(credits.bundled.filter(item => item.license === 'CC BY-SA 4.0').every(item => item.url && item.licenseUrl));
  assert.ok(credits.remote.length >= 6);
  assert.equal(attributionCredits().some(item => /משנה ברורה|ביאור הלכה/.test(item.text)), false, 'credited in their own section');
  const about = readFileSync(new URL('../src/pages/AboutPage.jsx', import.meta.url), 'utf8');
  assert.match(about, /שולחן ערוך ונושאי כליו/);
  assert.match(about, /הרישיון חל על טקסטים אלה בלבד, ולא על האפליקציה/);
});
