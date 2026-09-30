// The Tanakh and Mishnah commentary corpora: integrity, licences (verified live at build time), anchors to the verse or
// mishnah, honest coverage, remote layers, and the reader tabs (מקרא | מפרשים, משנה | מפרשים) only where content exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire, Module } from 'node:module';
import { buildSync } from 'esbuild';
import { ACQUISITION_QUEUE, CORPUS_INDEX, COVERAGE, EDITIONS, LICENSES, PUBLIC_WORKS, REMOTE_LAYERS, WORKS, categoryById, workById, worksInCategory } from '../src/data/library/registry.mjs';
import { COMMENTATORS, CORPUS_REPORTS } from '../src/data/library/corpusIndex.mjs';
import { validateWorkChunk } from '../src/services/library/integrity.mjs';
import { checksum } from '../src/services/prayer/checksum.mjs';
import { loadEditionChunk, verifyChunkText } from '../src/services/library/packs.mjs';
import { groupByVerse, layerTabNames, layersAt, layersForRef, layersOf, loadAnchors, loadLayerUnits, loadRemoteLayerUnits, remoteRef } from '../src/services/library/relations.mjs';
import { searchWorks } from '../src/services/library/search.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const packPath = (packId, file) => fileURLToPath(new URL(`../public/library/packs/${packId}/${file}`, import.meta.url));
const text = (packId, file) => gunzipSync(readFileSync(packPath(packId, file))).toString('utf8');
const diskFetch = async url => new Response(readFileSync(`${root}public/${decodeURIComponent(new URL(url, 'http://app/').pathname.slice(1))}`));
const PACKS = CORPUS_INDEX.filter(pack => /^sefaria-(tanakh|mishnah)-commentary-/.test(pack.packId));
const works = PACKS.flatMap(pack => pack.works.map(work => ({ ...work, pack })));
const provenance = JSON.parse(readFileSync(new URL('../sources/sefaria-commentaries/provenance.json', import.meta.url), 'utf8'));
const editionsBuilt = Object.values(provenance.corpora).flatMap(corpus => corpus.editions);
const remoteBuilt = Object.values(provenance.corpora).flatMap(corpus => corpus.remoteLayers);
const chunkOf = work => verifyChunkText(text(work.pack.packId, work.file), workById(work.workId).editions[0]);
const firstOn = (workId, chapter, verse) => { const work = works.find(item => item.workId === workId); return chunkOf(work).nodes.find(node => node.n === chapter).units.find(unit => unit.v === verse); };

test('integrity: every commentary file re-validates from disk — checksum, edition, ids, order, verse, no markup', () => {
  assert.deepEqual(PACKS.map(pack => pack.packId).sort(), ['sefaria-mishnah-commentary-public-domain', 'sefaria-tanakh-commentary-cc-by-sa', 'sefaria-tanakh-commentary-public-domain']);
  const ids = new Set();
  for (const pack of PACKS) {
    const manifest = JSON.parse(readFileSync(packPath(pack.packId, 'manifest.json'), 'utf8'));
    for (const work of pack.works) {
      const body = text(pack.packId, work.file);
      assert.equal(checksum(body), work.checksum, work.workId);
      assert.ok(manifest.files.some(file => file.file === work.file && file.checksum === work.checksum), `${work.workId} in manifest`);
      const chunk = verifyChunkText(body, workById(work.workId).editions[0]);
      const report = validateWorkChunk(chunk, work.expected.map((units, i) => ({ n: i + 1, units })));
      assert.equal(report.status, work.status, work.workId);
      assert.deepEqual([report.duplicateIds, report.emptyUnits, report.invalidRefs, report.unexpectedUnits, report.orderErrors].map(list => list.length), [0, 0, 0, 0, 0], work.workId);
      assert.deepEqual(report.missingUnits, work.missingUnits, work.workId);
      for (const node of chunk.nodes) for (const unit of node.units) {
        assert.equal(ids.has(unit.id), false, unit.id);
        ids.add(unit.id);
        assert.doesNotMatch(`${unit.dh || ''} ${unit.text}`, /[<>]|&[a-z]+;/, unit.id);
        if (node.n <= (work.nodeTitles ? work.nodeTitles.filter(title => title.startsWith('פרק')).length : work.expected.length)) assert.ok(Number.isInteger(unit.v) && unit.v > 0, `${unit.id} sits on a verse`);
      }
      if (work.anchorsFile) assert.ok(manifest.files.some(file => file.role === 'anchors' && file.file === work.anchorsFile && file.checksum === work.anchorsChecksum), `${work.workId} anchors in manifest`);
      const report2 = CORPUS_REPORTS.find(item => item.workId === work.workId);
      assert.deepEqual([report2.importedUnits, report2.status, report2.checksum], [report.importedUnits, report.status, work.checksum]);
    }
  }
  // One file per book or tractate, so a chapter loads only the commentary on its own book.
  assert.equal(new Set(works.map(work => work.file)).size, works.length);
  assert.ok(works.every(work => work.bytes < 450 * 1024), 'no single commentary file is large');
  assert.equal(WORKS.filter(work => works.some(item => item.workId === work.workId)).length, works.length, 'each work once in the library');
});

test('licences: the exact editions, re-verified live, open only — never NC, unknown or the blocked Rashi edition', () => {
  assert.equal(editionsBuilt.length, works.length);
  const OPEN = ['public domain', 'pd', 'cc0', 'cc-by', 'cc-by-sa'];
  for (const work of works) {
    const record = editionsBuilt.find(item => item.workId === work.workId);
    assert.ok(record, work.workId);
    assert.equal(record.versionTitle, work.editionTitle, work.workId);
    assert.ok(OPEN.includes(record.recordedLicense.toLowerCase()), `${work.workId}: ${record.recordedLicense}`);
    assert.match(record.licenseVerifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(work.licenseVerifiedAt, record.licenseVerifiedAt);
    assert.equal(work.recordedLicense, record.recordedLicense);
    assert.equal(record.export, `https://www.sefaria.org/download/version/${encodeURIComponent(`${record.title} - he - ${record.versionTitle}`)}.json`);
    assert.equal(LICENSES[work.license].offlineAllowed, true);
    assert.equal(LICENSES[work.license].commercialUseAllowed, true, `${work.workId} carries no NC licence`);
    assert.equal(work.license, work.pack.license);
    // A transcription taken from Wikisource ships as CC BY-SA 4.0 with its credit, whatever the provider records.
    if (record.wikisourceSourced) {
      assert.equal(work.license, 'cc-by-sa', work.workId);
      assert.match(work.attribution.text, /ויקיטקסט.*CC BY-SA 4\.0/);
      assert.equal(work.attribution.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0/');
    } else assert.equal(work.license, 'public-domain', work.workId);
  }
  assert.deepEqual(works.filter(work => work.license === 'cc-by-sa').map(work => work.workId).sort(), ['Ibn_Ezra_on_Ecclesiastes', 'Ibn_Ezra_on_Lamentations']);
  // Rashi on the Torah is "On Your Way"; the Rosenbaum–Silbermann edition stays BLOCKED, and no Torat-Emet NC version is used.
  for (const book of ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']) assert.equal(workById(`Rashi_on_${book}`).editions[0].title, 'On Your Way');
  assert.equal(EDITIONS.some(edition => /Rosenbaum and A\.M\. Silbermann/.test(edition.title || '')), false);
  assert.equal(EDITIONS.some(edition => /^Torat-Emet$/.test(edition.title || '')), false);
  assert.ok(works.filter(work => work.group === 'tosafot-yom-tov').every(work => work.editionTitle === 'Mishnah, ed. Romm, Vilna 1913'));
  assert.ok(works.filter(work => work.group === 'bartenura').every(work => ['On Your Way', 'ToratEmet'].includes(work.editionTitle)));
  for (const item of ACQUISITION_QUEUE.filter(entry => entry.match && ['PERMISSION_REQUIRED', 'BLOCKED'].includes(entry.status))) {
    const hit = EDITIONS.filter(edition => (!item.match.title || edition.sourceIdentifier === item.match.title) && (!item.match.versionTitle || edition.title === item.match.versionTitle || edition.versionTitle === item.match.versionTitle) && (!item.match.provider || edition.sourceProvider === item.match.provider));
    assert.deepEqual(hit.map(edition => edition.editionId), [], item.title);
  }
  // Remote layers: public domain as recorded, never a Wikisource-sourced text, licence checked at build time.
  const tanakhRemote = REMOTE_LAYERS.filter(layer => layer.category === 'tanakh-commentary');
  assert.ok(tanakhRemote.length >= 100);
  for (const layer of tanakhRemote) {
    assert.equal(layer.license, 'public-domain', layer.workId);
    assert.match(layer.recordedLicense, /^(Public Domain|PD)$/, layer.workId);
    assert.doesNotMatch(layer.versionSource || '', /wikisource/i, layer.workId);
    assert.ok(remoteBuilt.some(item => item.workId === layer.workId && item.versionTitle === layer.versionTitle), layer.workId);
    assert.equal(workById(layer.workId).public, false, 'a remote layer is reached from the verse, not listed as a book');
  }
});

test('anchors: known comments land on their verse or mishnah, and every anchor points at real base text', async () => {
  const rashi = firstOn('Rashi_on_Genesis', 1, 1);
  assert.equal(rashi.id, 'Rashi_on_Genesis.1.1');
  assert.equal(rashi.dh, 'בראשית.');
  assert.match(rashi.text, /^אמר רבי יצחק לא היה צריך להתחיל/);
  const bartenura = firstOn('Bartenura_on_Mishnah_Berakhot', 1, 1);
  assert.match(bartenura.dh, /^מאימתי קורין/);
  assert.match(bartenura.text, /^כהנים שנטמאו וטבלו/);
  assert.match(firstOn('Tosafot_Yom_Tov_on_Mishnah_Berakhot', 1, 1).dh, /^מאימתי קורין את שמע בערבית/);
  assert.equal(firstOn('Rashi_on_Exodus', 12, 2).dh, 'החדש הזה.');
  assert.equal(firstOn('Rashi_on_Psalms', 23, 1).dh, 'מזמור לדוד.');
  assert.equal(firstOn('Bartenura_on_Mishnah_Shabbat', 2, 1).dh, 'במה מדליקין.');
  assert.match(firstOn('Bartenura_on_Pirkei_Avot', 1, 1).dh.replace(/[\u0591-\u05C7]/g, ''), /^משה קבל תורה מסיני/);
  const anchors = await loadAnchors(workById('Rashi_on_Genesis'), { fetchImpl: diskFetch });
  assert.deepEqual(anchors.anchors[0], { unitId: 'Rashi_on_Genesis.1.1', anchorRef: 'Genesis.1.1', canonicalRef: 'Rashi on Genesis 1:1:1', baseCanonicalRef: 'Genesis 1:1' });
  assert.deepEqual([anchors.relationType, anchors.baseWorkId, anchors.anchorScheme], ['commentary', 'Genesis', 'sefaria-ref']);
  // Every anchored unit exists, sits on the verse its anchor names, and that verse exists in the base text.
  const samples = ['Rashi_on_Genesis', 'Ibn_Ezra_on_Psalms', 'Or_HaChaim_on_Numbers', 'Rashi_on_Ecclesiastes', 'Ibn_Ezra_on_Lamentations', 'Bartenura_on_Mishnah_Kelim', 'Tosafot_Yom_Tov_on_Pirkei_Avot', 'Bartenura_on_Mishnah_Bikkurim'];
  for (const workId of samples) {
    const work = workById(workId);
    const record = await loadAnchors(work, { fetchImpl: diskFetch });
    const chunk = await loadEditionChunk(work.editions[0], { fetchImpl: diskFetch });
    const base = workById(work.relation.baseWorkId);
    const unitById = new Map(chunk.nodes.flatMap(node => node.units.map(unit => [unit.id, unit])));
    for (const anchor of record.anchors) {
      const [, chapter, verse] = anchor.anchorRef.match(/\.(\d+)\.(\d+)$/).map(Number);
      const unit = unitById.get(anchor.unitId);
      assert.ok(unit, anchor.unitId);
      assert.equal(unit.v, verse, anchor.unitId);
      assert.equal(Number(anchor.unitId.split('.')[1]), chapter);
      assert.ok(verse <= base.editions[0].nodes[chapter - 1], `${anchor.unitId} → ${anchor.anchorRef}`);
      assert.equal(anchor.baseCanonicalRef, `${base.sourceTitle.replace("Ta'anit", 'Taanit')} ${chapter}:${verse}`);
    }
    const indexed = work.editions[0].anchorNodes.reduce((total, [, , from, to]) => total + to - from + 1, 0);
    assert.equal(indexed, record.anchors.length, workId);
    assert.equal(work.coverageDetail.anchoredUnits, record.anchors.length);
  }
  // Bikkurim's fourth chapter is in Sefaria's Bartenura but not in the Mishnah edition in the library: kept, unanchored.
  assert.equal(workById('Bartenura_on_Mishnah_Bikkurim').coverageDetail.unanchoredUnits, 19);
});

test('relationship: from a verse or a mishnah, the commentators that have something on it, in customary order', async () => {
  const genesis = layersForRef('Genesis.1.1');
  assert.deepEqual(genesis.commentaries.filter(layer => !layer.remote).map(layer => layer.work.layerTitle), ['רש״י', 'רמב״ן', 'אבן עזרא', 'ספורנו', 'אור החיים', 'כלי יקר', 'רשב״ם', 'רבינו בחיי', 'טור הארוך', 'שפתי חכמים', 'העמק דבר']);
  assert.ok(genesis.commentaries.filter(layer => layer.remote).every(layer => layer.work.kind === 'remote'));
  assert.deepEqual(genesis.translations, []);
  assert.equal(genesis.translationNotice, null, 'the Tanakh does not announce a missing translation');
  assert.deepEqual(genesis.parallels, []);
  // Ramban on Exodus has no open edition: no Ramban layer on Exodus.
  assert.equal(layersAt('Exodus', 20).some(layer => layer.work.group === 'ramban'), false);
  assert.ok(layersAt('Leviticus', 1).some(layer => layer.work.group === 'ramban'));
  // Or HaChaim's Rishon LeTzion reaches only the chapters it explains.
  assert.equal(layersAt('Joshua', 1).some(layer => layer.work.workId === 'Rishon_LeTzion_on_Joshua'), layersOf('Joshua').find(work => work.workId === 'Rishon_LeTzion_on_Joshua').editions[0].anchorNodes.some(row => row[0] === 1));
  const mishnah = layersForRef('Mishnah_Berakhot.1.1');
  assert.deepEqual(mishnah.commentaries.map(layer => layer.work.layerTitle), ['ברטנורא', 'תוספות יום טוב']);
  // Loading a layer returns the chapter's comments; grouped by verse they read in order, and one verse can be picked.
  const rashi = genesis.commentaries[0];
  const units = await loadLayerUnits(rashi, { fetchImpl: diskFetch });
  assert.equal(units.length, rashi.count);
  const groups = groupByVerse(units);
  assert.deepEqual(groups.map(group => group.v), [...new Set(units.map(unit => unit.v))]);
  assert.ok(groups.every((group, i) => !i || group.v > groups[i - 1].v));
  assert.ok(units.filter(unit => unit.v === 1).length >= 2);
  // A book no commentator reaches has no layers at all. (The Shulchan Arukh has its own now: shulchanArukhCommentary.)
  assert.deepEqual(layersAt('Mishneh_Torah__Foundations_of_the_Torah', 1), []);
});

test('coverage is honest: counts come from Sefaria’s shape, FULL only when nothing is missing, missing books named', () => {
  for (const work of works) {
    const cover = work.coverage;
    assert.equal(cover.expectedUnits, work.expected.reduce((a, b) => a + b, 0), work.workId);
    assert.equal(cover.importedUnits, work.nodes.reduce((a, b) => a + b, 0), work.workId);
    assert.equal(cover.expectedUnits - cover.importedUnits, cover.missingUnits.length, work.workId);
    assert.equal(cover.coverageStatus, cover.missingUnits.length ? COVERAGE.PARTIAL : COVERAGE.FULL, work.workId);
    assert.equal(workById(work.workId).coverage, cover.coverageStatus);
    assert.equal(cover.anchoredUnits + cover.unanchoredUnits, cover.importedUnits);
  }
  const by = id => [...COMMENTATORS.tanakh.bundled, ...COMMENTATORS.mishnah.bundled].find(item => item.id === id);
  const ramban = by('ramban');
  assert.deepEqual([ramban.importedBooks, ramban.expectedBooks, ramban.coverageStatus], [4, 6, COVERAGE.PARTIAL]);
  assert.deepEqual(ramban.missingBooks.map(book => book.title), ['Ramban on Exodus', 'Ramban on Job']);
  assert.match(ramban.missingBooks[0].reason, /unknown/);
  assert.match(ramban.missingBooks[1].reason, /CC-BY-NC/);
  assert.deepEqual([by('rashi').importedBooks, by('rashi').expectedBooks], [39, 39]);
  assert.deepEqual([by('bartenura').importedBooks, by('tosafot-yom-tov').importedBooks], [63, 64]);
  for (const item of [...COMMENTATORS.tanakh.bundled, ...COMMENTATORS.mishnah.bundled]) {
    const mine = works.filter(work => work.group === item.id);
    assert.equal(item.importedBooks, mine.length, item.id);
    assert.equal(item.importedUnits, mine.reduce((total, work) => total + work.coverage.importedUnits, 0), item.id);
    assert.equal(item.expectedUnits, mine.reduce((total, work) => total + work.coverage.expectedUnits, 0), item.id);
    assert.equal(item.coverageStatus, mine.every(work => work.coverage.coverageStatus === COVERAGE.FULL) && !item.missingBooks.length ? COVERAGE.FULL : COVERAGE.PARTIAL, item.id);
  }
  // A thin edition is shown as it is: Ibn Ezra on Habakkuk has 4 of the 140 comment places Sefaria knows.
  const habakkuk = workById('Ibn_Ezra_on_Habakkuk').coverageDetail;
  assert.deepEqual([habakkuk.importedUnits, habakkuk.expectedUnits, habakkuk.coverageStatus], [4, 140, COVERAGE.PARTIAL]);
  for (const layer of REMOTE_LAYERS.filter(item => item.category === 'tanakh-commentary')) assert.deepEqual([layer.coverage.importedUnits, layer.coverage.coverageStatus], [0, COVERAGE.REMOTE_ONLY]);
});

test('remote layers: a chapter of the registered edition, grouped by verse; refused in any other edition', async () => {
  const exodus = workById('Exodus');
  const malbim = workById('Malbim_on_Exodus');
  assert.equal(remoteRef(malbim, exodus, 3), 'Malbim on Exodus 3');
  assert.equal(remoteRef(workById('Ralbag_on_Torah_Genesis'), workById('Genesis'), 1), 'Ralbag on Torah, Genesis 1');
  assert.equal(remoteRef(malbim, exodus, 41), null, 'no chapter past the book');
  const layer = layersAt('Exodus', 3).find(item => item.work.workId === 'Malbim_on_Exodus');
  assert.ok(layer && layer.remote && layer.count > 0);
  let asked = null;
  const ok = async url => { asked = url; return new Response(JSON.stringify({ versions: [{ versionTitle: 'Mikraei Kodesh, Vilna, 1891', license: 'Public Domain', text: [['<b>ומשה</b> היה רעה', ''], ['וירא']] }] })); };
  const units = await loadRemoteLayerUnits(layer, 3, { fetchImpl: ok });
  assert.match(asked, /\/api\/v3\/texts\/Malbim%20on%20Exodus%203\?version=hebrew%7CMikraei%20Kodesh%2C%20Vilna%2C%201891&return_format=text_only$/);
  assert.deepEqual(units.map(unit => [unit.id, unit.v, unit.text]), [['Malbim_on_Exodus.3.1', 1, 'ומשה היה רעה'], ['Malbim_on_Exodus.3.3', 2, 'וירא']]);
  const other = { ...layer, work: { ...layer.work, editions: [{ ...layer.work.editions[0], editionId: 'other-for-test' }] } };
  await assert.rejects(loadRemoteLayerUnits(other, 4, { fetchImpl: async () => new Response(JSON.stringify({ versions: [{ versionTitle: 'Mikraei Kodesh, Vilna, 1891', license: 'CC-BY-NC', text: [['א']] }] })) }), /אינה המהדורה הרשומה/);
});

test('findable: commentaries are books of their own, grouped by commentator, after the text they explain', () => {
  const tanakh = worksInCategory('tanakh-commentary');
  assert.deepEqual(categoryById('tanakh-commentary').groups.map(([, title]) => title), ['רש״י', 'רמב״ן', 'אבן עזרא', 'ספורנו', 'אור החיים', 'כלי יקר', 'רשב״ם', 'רבינו בחיי', 'טור הארוך', 'שפתי חכמים', 'העמק דבר']);
  assert.equal(tanakh.filter(work => work.group === 'rashi').length, 39);
  assert.equal(tanakh.find(work => work.workId === 'Rashi_on_Genesis').shortTitle, 'בראשית');
  assert.equal(tanakh.find(work => work.workId === 'Rashi_on_Genesis').title, 'רש״י על בראשית');
  assert.deepEqual(categoryById('mishnah-commentary').groups.map(([, title]) => title), ['ברטנורא', 'תוספות יום טוב']);
  assert.equal(worksInCategory('mishnah-commentary').find(work => work.workId === 'Bartenura_on_Mishnah_Berakhot').shortTitle, 'ברכות');
  assert.equal(searchWorks('רש"י על בראשית', PUBLIC_WORKS)[0].work.workId, 'Rashi_on_Genesis');
  assert.equal(searchWorks('בראשית', PUBLIC_WORKS)[0].work.workId, 'Genesis', 'the text before its commentaries');
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

test('reader: מקרא | מפרשים and משנה | מפרשים only where commentary exists; no מקורות / מקבילות without linked sources', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: LibraryPage, parseLibraryRoute, libraryRoute } = loadJsx('pages/LibraryPage.jsx');
  const render = mode => renderToStaticMarkup(React.createElement(LibraryPage, { route: parseLibraryRoute(mode), go: () => {}, openSource: () => {} }));
  const tabs = page => [...page.matchAll(/role="tab"[^>]*>([^<]+)<\/button>/g)].map(match => match[1]);
  assert.deepEqual(tabs(render(libraryRoute.read('Genesis', 1))), ['מקרא', 'מפרשים']);
  assert.deepEqual(tabs(render(libraryRoute.read('Mishnah_Berakhot', 1))), ['משנה', 'מפרשים']);
  assert.deepEqual(tabs(render(libraryRoute.read('Zohar', 29))), ['מקור', 'מפרשים'], 'the Zohar keeps its own names');
  assert.deepEqual(tabs(render(libraryRoute.read('Mishneh_Torah__Foundations_of_the_Torah', 1))), []);
  assert.doesNotMatch(render(libraryRoute.read('Genesis', 1)), /טרם קיים תרגום/);
  // A chapter no commentator reaches has no tab bar (found from the page index, not assumed).
  for (const [workId, count] of [['Nehemiah', 13], ['Mishnah_Kinnim', 3]]) {
    for (let node = 1; node <= count; node += 1) {
      const expected = layersAt(workId, node).length > 0;
      assert.equal(/library-layer-tabs/.test(render(libraryRoute.read(workId, node))), expected, `${workId} ${node}`);
    }
  }
  // The tab names for linked sources exist for the day an open link source is added, and follow the base text.
  assert.deepEqual([layerTabNames(workById('Genesis')).parallel, layerTabNames(workById('Mishnah_Berakhot')).parallel], ['מקורות', 'מקבילות']);
  const fixture = { workId: 'Parallel_Fixture', kind: 'pack', relation: { relationType: 'parallel', baseWorkId: 'Mishnah_Berakhot', anchorScheme: 'sefaria-ref' }, editions: [{ anchorNodes: [[1, 1, 1, 2]] }] };
  const here = layersForRef('Mishnah_Berakhot.1', [...WORKS, fixture]);
  assert.deepEqual(here.parallels.map(layer => layer.work.workId), ['Parallel_Fixture']);
  assert.equal(here.commentaries.some(layer => layer.work.workId === 'Parallel_Fixture'), false);
  // Reading a commentary as a book: comments sit under their verse, which opens the verse in the base text.
  const rashiBook = render(libraryRoute.read('Rashi_on_Genesis', 1));
  assert.deepEqual(tabs(rashiBook), []);
  assert.match(rashiBook, /<h1>רש״י על בראשית · פרק א׳<\/h1>/);
  // The sources page names every commentator with its real counts and the books that are missing and why.
  const { commentaryCredits } = loadJsx('pages/AboutPage.jsx');
  const credits = commentaryCredits();
  assert.deepEqual(credits.map(group => group.title), ['מפרשי המקרא', 'מפרשי המשנה']);
  assert.deepEqual(credits[0].bundled.map(item => item.name), ['רש״י', 'רמב״ן', 'אבן עזרא', 'ספורנו', 'אור החיים', 'כלי יקר', 'רשב״ם', 'רבינו בחיי', 'טור הארוך', 'שפתי חכמים', 'העמק דבר']);
  assert.match(credits[0].bundled[1].line, /^4 מתוך 6 ספרים/);
  assert.equal(credits[0].bundled[1].missing.length, 2);
  assert.deepEqual(credits[0].remote.map(item => item.name), ['מלבי״ם', 'רלב״ג', 'מצודת דוד', 'מצודת ציון', 'אברבנאל', 'רד״ק']);
  const about = readFileSync(new URL('../src/pages/AboutPage.jsx', import.meta.url), 'utf8');
  assert.match(about, /ספריא אינה מפרסמת רישיון לנתוני הקישורים/);
});
