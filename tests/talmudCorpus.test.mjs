// The Talmud's canonical local layer: the Gemara (Wikisource, CC BY-SA 4.0), Rashi and Tosafot anchored to the
// segment, the Rif on his own pages, the remote Rishonim in one registered edition each — integrity, licences, anchors,
// honest coverage per tractate, and reading an amud with no network at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { ACQUISITION_QUEUE, CORPUS_INDEX, COVERAGE, EDITIONS, LICENSES, PUBLIC_WORKS, REMOTE_LAYERS, WORKS, categoryById, workById, worksInCategory } from '../src/data/library/registry.mjs';
import { CORPUS_REPORTS, TALMUD_COVERAGE } from '../src/data/library/corpusIndex.mjs';
import { validateWorkChunk } from '../src/services/library/integrity.mjs';
import { checksum } from '../src/services/prayer/checksum.mjs';
import { loadEditionChunk, verifyChunkText } from '../src/services/library/packs.mjs';
import { layersAt, layersForRef, loadAnchors, loadLayerUnits, remoteRef } from '../src/services/library/relations.mjs';
import { amudIndex, indexAmud } from '../src/services/library/pagination.mjs';
import { findTractate, TRACTATES, loadAmud, loadCommentary } from '../src/services/talmud.mjs';
import { loadLocalAmud, loadLocalCommentary, registeredRemoteEdition, segmentHtml } from '../src/services/talmudLocal.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const packPath = (packId, file) => fileURLToPath(new URL(`../public/library/packs/${packId}/${file}`, import.meta.url));
const text = (packId, file) => gunzipSync(readFileSync(packPath(packId, file))).toString('utf8');
const diskFetch = async url => new Response(readFileSync(`${root}public/${decodeURIComponent(new URL(url, 'http://app/').pathname.slice(1))}`));
const PACK_IDS = ['wikisource-talmud-cc-by-sa', 'sefaria-talmud-commentary-public-domain', 'sefaria-talmud-commentary-cc-by-sa'];
const PACKS = CORPUS_INDEX.filter(pack => PACK_IDS.includes(pack.packId));
const works = PACKS.flatMap(pack => pack.works.map(work => ({ ...work, pack })));
const bases = works.filter(work => work.reader === 'talmud');
const segmentLayers = works.filter(work => ['rashi', 'tosafot'].includes(work.group));
const rif = works.filter(work => work.group === 'rif');
const provenance = JSON.parse(readFileSync(new URL('../sources/sefaria-talmud/provenance.json', import.meta.url), 'utf8'));
const chunkOf = work => verifyChunkText(text(work.pack.packId, work.file), workById(work.workId).editions[0]);
const firstAmudNode = work => amudIndex(work.pagination.volumes[0].first);

test('integrity: every Talmud file re-validates from disk — checksum, edition, ids, order, segment, no markup', () => {
  assert.deepEqual(PACKS.map(pack => pack.packId), PACK_IDS);
  assert.deepEqual([bases.length, segmentLayers.filter(work => work.group === 'rashi').length, segmentLayers.filter(work => work.group === 'tosafot').length, rif.length], [37, 36, 36, 25]);
  const ids = new Set();
  for (const pack of PACKS) {
    const manifest = JSON.parse(readFileSync(packPath(pack.packId, 'manifest.json'), 'utf8'));
    assert.equal(manifest.license, pack.license);
    const onDisk = readdirSync(packPath(pack.packId, '.')).filter(file => file !== 'manifest.json').sort();
    assert.deepEqual(onDisk, manifest.files.map(file => file.file).sort(), `${pack.packId}: every file listed, nothing extra`);
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
        if (work.relation) assert.ok(Number.isInteger(unit.v) && unit.v >= 1 && unit.v <= workById(work.relation.baseWorkId).editions[0].expected[node.n - 1], `${unit.id} sits on a real segment`);
        for (const [from, to] of unit.em || []) assert.ok(from >= 0 && from < to && to <= unit.text.length, `${unit.id} emphasis`);
      }
      if (work.anchorsFile) assert.ok(manifest.files.some(file => file.role === 'anchors' && file.file === work.anchorsFile && file.checksum === work.anchorsChecksum), `${work.workId} anchors in manifest`);
      const indexed = CORPUS_REPORTS.find(item => item.workId === work.workId);
      assert.deepEqual([indexed.importedUnits, indexed.status, indexed.checksum], [report.importedUnits, report.status, work.checksum]);
    }
  }
  // Split per tractate and per commentary: an amud loads only its own tractate's files, none of them large.
  assert.equal(new Set(works.map(work => work.file)).size, works.length);
  assert.ok(works.every(work => work.bytes < 450 * 1024), 'no single Talmud file is large');
  assert.equal(WORKS.filter(work => works.some(item => item.workId === work.workId)).length, works.length, 'each work once in the library');
  // The base grid is the app's catalog grid, amud for amud: the remote layers (Steinsaltz, links) align with it.
  for (const tractate of TRACTATES) {
    const work = workById(`Bavli_${tractate.title.replace(/ /g, '_')}`);
    assert.ok(work, tractate.title);
    const first = amudIndex(tractate.firstAmud);
    assert.deepEqual(work.editions[0].expected, tractate.segmentsPerAmud.slice(first, amudIndex(tractate.lastAmud) + 1), tractate.title);
  }
});

test('licences: exact editions, re-verified live at build time; nothing NC or unknown in a local pack; CC BY-SA credited', () => {
  const OPEN = ['public domain', 'pd', 'cc0', 'cc-by', 'cc-by-sa'];
  assert.equal(provenance.editions.length, works.length);
  for (const work of works) {
    const record = provenance.editions.find(item => item.workId === work.workId);
    assert.ok(record, work.workId);
    assert.equal(record.versionTitle, work.editionTitle, work.workId);
    assert.ok(OPEN.includes(record.recordedLicense.toLowerCase()), `${work.workId}: ${record.recordedLicense}`);
    assert.match(record.licenseVerifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(work.licenseVerifiedAt, record.licenseVerifiedAt);
    assert.equal(record.export, `https://www.sefaria.org/download/version/${encodeURIComponent(`${record.title} - he - ${record.versionTitle}`)}.json`);
    assert.equal(LICENSES[work.license].commercialUseAllowed, true, `${work.workId} carries no NC licence`);
    assert.ok(['public-domain', 'cc-by-sa'].includes(work.license), work.workId);
    assert.equal(work.license, work.pack.license);
    // Wikisource-sourced text ships as CC BY-SA 4.0 with its credit, whatever the provider records.
    if (record.wikisourceSourced || work.license === 'cc-by-sa') {
      assert.equal(work.license, 'cc-by-sa', work.workId);
      assert.match(work.attribution.text, /ויקיטקסט.*CC BY-SA 4\.0/);
      assert.equal(work.attribution.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0/');
    }
  }
  assert.ok(bases.every(work => work.editionTitle === 'Wikisource Talmud Bavli' && work.license === 'cc-by-sa' && work.recordedLicense === 'CC-BY-SA'));
  assert.ok(segmentLayers.every(work => work.editionTitle === 'Vilna Edition' || work.workId === 'Rashi_on_Rosh_Hashanah'));
  assert.equal(workById('Rashi_on_Rosh_Hashanah').editions[0].title, 'WikiSource Rashi');
  assert.equal(workById('Rashi_on_Sanhedrin').license, 'cc-by-sa');
  assert.ok(rif.every(work => work.editionTitle === 'Vilna Edition' && work.license === 'public-domain'));
  // The William Davidson text and Steinsaltz (CC-BY-NC) are never packaged; the refused editions stay out.
  assert.equal(EDITIONS.some(edition => edition.packId && /William Davidson|Steinsaltz/i.test(`${edition.title} ${edition.sourceIdentifier}`)), false);
  for (const item of ACQUISITION_QUEUE.filter(entry => entry.match && ['PERMISSION_REQUIRED', 'BLOCKED'].includes(entry.status))) {
    const hit = EDITIONS.filter(edition => (!item.match.title || edition.sourceIdentifier === item.match.title) && (!item.match.versionTitle || edition.title === item.match.versionTitle || edition.versionTitle === item.match.versionTitle) && (!item.match.provider || edition.sourceProvider === item.match.provider));
    assert.deepEqual(hit.map(edition => edition.editionId), [], item.title);
  }
  assert.deepEqual(TALMUD_COVERAGE.heldBack.map(item => item.status), [COVERAGE.BLOCKED, COVERAGE.PERMISSION_REQUIRED]);
  // The remote Rishonim: public domain as recorded, never Wikisource-sourced, never listed as books.
  const remote = REMOTE_LAYERS.filter(layer => layer.category === 'talmud-commentary');
  assert.equal(remote.length, TALMUD_COVERAGE.remote.reduce((total, item) => total + item.books, 0));
  for (const layer of remote) {
    assert.equal(layer.license, 'public-domain', layer.workId);
    assert.match(layer.recordedLicense, /^(Public Domain|PD)$/, layer.workId);
    assert.doesNotMatch(layer.versionSource || '', /wikisource/i, layer.workId);
    assert.ok(provenance.remoteLayers.some(item => item.workId === layer.workId && item.versionTitle === layer.versionTitle), layer.workId);
    assert.equal(workById(layer.workId).public, false);
  }
});

test('anchors: Rashi and Tosafot on Berakhot 2a open with מאימתי, and every anchor points at a real Gemara segment', async () => {
  const rashi = chunkOf(works.find(work => work.workId === 'Rashi_on_Berakhot')).nodes.find(node => node.n === 1).units[0];
  assert.deepEqual([rashi.id, rashi.v], ['Rashi_on_Berakhot.1.1', 1]);
  assert.match(rashi.dh, /^מאימתי קורין את שמע בערבין/);
  assert.match(rashi.text, /^כהנים שנטמאו וטבלו/);
  const tosafot = chunkOf(works.find(work => work.workId === 'Tosafot_on_Berakhot')).nodes.find(node => node.n === 1).units[0];
  assert.deepEqual([tosafot.id, tosafot.v], ['Tosafot_on_Berakhot.1.1', 1]);
  assert.match(tosafot.dh, /^מאימתי/);
  const base = chunkOf(works.find(work => work.workId === 'Bavli_Berakhot')).nodes[0].units[0];
  assert.match(base.text, /^מתני׳ מאימתי קורין את שמע בערבין/);
  assert.ok(segmentHtml(base).startsWith('מתני׳ <strong>מאימתי</strong> קורין'));
  const anchors = await loadAnchors(workById('Rashi_on_Berakhot'), { fetchImpl: diskFetch });
  assert.deepEqual(anchors.anchors[0], { unitId: 'Rashi_on_Berakhot.1.1', anchorRef: 'Bavli_Berakhot.1.1', canonicalRef: 'Rashi on Berakhot 2a:1:1', baseCanonicalRef: 'Berakhot 2a:1' });
  assert.deepEqual([anchors.relationType, anchors.baseWorkId, anchors.anchorScheme], ['commentary', 'Bavli_Berakhot', 'sefaria-ref']);
  for (const workId of ['Rashi_on_Berakhot', 'Tosafot_on_Shabbat', 'Rashi_on_Sanhedrin', 'Rashi_on_Rosh_Hashanah', 'Tosafot_on_Niddah', 'Rashi_on_Bava_Batra']) {
    const work = workById(workId);
    const record = await loadAnchors(work, { fetchImpl: diskFetch });
    const chunk = await loadEditionChunk(work.editions[0], { fetchImpl: diskFetch });
    const baseWork = workById(work.relation.baseWorkId);
    const unitById = new Map(chunk.nodes.flatMap(node => node.units.map(unit => [unit.id, unit])));
    const first = amudIndex(baseWork.editions[0].pagination.volumes[0].first);
    for (const anchor of record.anchors) {
      const [, node, segment] = anchor.anchorRef.match(/\.(\d+)\.(\d+)$/).map(Number);
      const unit = unitById.get(anchor.unitId);
      assert.ok(unit, anchor.unitId);
      assert.equal(unit.v, segment, anchor.unitId);
      assert.equal(Number(anchor.unitId.split('.')[1]), node);
      assert.ok(segment <= baseWork.editions[0].expected[node - 1], `${anchor.unitId} → ${anchor.anchorRef}`);
      assert.equal(anchor.baseCanonicalRef, `${baseWork.sourceTitle} ${indexAmud(first + node - 1)}:${segment}`);
      assert.ok(anchor.canonicalRef.startsWith(`${work.sourceTitle} ${indexAmud(first + node - 1)}:${segment}:`), anchor.canonicalRef);
    }
    assert.equal(record.anchors.length, work.coverageDetail.anchoredUnits, workId);
    assert.equal(work.editions[0].anchorNodes.reduce((total, [, , from, to]) => total + to - from + 1, 0) >= record.anchors.length, true);
  }
  // The Rif keeps his own pages: no anchors to the Gemara, and his first page is his own (Berakhot: 1a).
  assert.equal(workById('Rif_Berakhot').relation, null);
  assert.equal(workById('Rif_Berakhot').onTractate, 'Bavli_Berakhot');
  assert.equal(workById('Rif_Berakhot').editions[0].pagination.volumes[0].first, '1a');
});

test('relationship: from an amud, its commentators in customary order, bundled before remote; Tamid has neither', async () => {
  const at = layersForRef('Bavli_Berakhot.1');
  assert.deepEqual(at.commentaries.filter(layer => !layer.remote).map(layer => layer.work.layerTitle), ['רש״י', 'תוספות']);
  assert.equal(at.translationNotice, null);
  const units = await loadLayerUnits(at.commentaries[0], { fetchImpl: diskFetch });
  assert.equal(units[0].id, 'Rashi_on_Berakhot.1.1');
  assert.ok(units.every((unit, i) => !i || unit.v >= units[i - 1].v));
  const tamid = workById('Bavli_Tamid');
  for (let node = 1; node <= tamid.editions[0].expected.length; node += 1) assert.equal(layersAt('Bavli_Tamid', node).some(layer => ['rashi', 'tosafot'].includes(layer.work.group)), false);
  // A remote layer on the Gemara's pages resolves to the amud's own ref; one on its own structure (the Rosh) has none.
  const maharsha = workById('Chidushei_Halachot_on_Berakhot');
  const node = maharsha.editions[0].anchorNodes[0][0];
  assert.equal(remoteRef(maharsha, workById('Bavli_Berakhot'), node), `Chidushei Halachot on Berakhot ${indexAmud(1 + node)}`);
  assert.equal(remoteRef(workById('Rosh_on_Berakhot'), workById('Bavli_Berakhot'), 1), null);
  assert.deepEqual(workById('Rosh_on_Berakhot').editions[0].anchorNodes, []);
  assert.equal(workById('Rosh_on_Berakhot').relation.anchorScheme, 'sefaria-links-live');
});

test('coverage is honest per tractate and per commentator — never uniform', () => {
  for (const work of works) {
    const cover = work.coverage;
    assert.equal(cover.expectedUnits, work.expected.reduce((a, b) => a + b, 0), work.workId);
    assert.equal(cover.importedUnits, work.nodes.reduce((a, b) => a + b, 0), work.workId);
    assert.equal(cover.expectedUnits - cover.importedUnits, cover.missingUnits.length, work.workId);
    assert.equal(cover.coverageStatus, cover.missingUnits.length ? COVERAGE.PARTIAL : COVERAGE.FULL, work.workId);
    assert.equal(workById(work.workId).coverage, cover.coverageStatus);
    if (work.relation) {
      assert.equal(cover.anchoredUnits + cover.unanchoredUnits, cover.importedUnits);
      assert.equal(cover.baseAmudim, workById(work.relation.baseWorkId).editions[0].expected.filter(Boolean).length);
      assert.ok(cover.amudimReached <= cover.baseAmudim);
    }
  }
  assert.deepEqual([TALMUD_COVERAGE.base.tractates, TALMUD_COVERAGE.base.importedUnits, TALMUD_COVERAGE.base.expectedUnits, TALMUD_COVERAGE.base.coverageStatus], [37, 81793, 81793, COVERAGE.FULL]);
  const by = id => TALMUD_COVERAGE.bundled.find(item => item.id === id);
  for (const id of ['rashi', 'tosafot']) {
    assert.deepEqual([by(id).importedBooks, by(id).expectedBooks, by(id).coverageStatus], [36, 37, COVERAGE.PARTIAL], id);
    assert.ok(by(id).missingBooks.some(book => /Tamid/.test(book.title)), `${id}: Tamid named as missing`);
    assert.equal(by(id).importedUnits, segmentLayers.filter(work => work.group === id).reduce((total, work) => total + work.coverage.importedUnits, 0));
  }
  assert.deepEqual([by('rif').importedBooks, by('rif').expectedBooks], [25, 25]);
  // Rashi on Bava Batra ends at 29a (the Rashbam goes on): the amudim it reaches are shown as they are.
  const bb = workById('Rashi_on_Bava_Batra').coverageDetail;
  assert.ok(bb.amudPercent < 20, `Rashi on Bava Batra reaches ${bb.amudPercent}% of the amudim`);
  assert.equal(bb.gaps[0].from, '29b');
  assert.ok(by('rashi').thinTractates.some(item => item.workId === 'Rashi_on_Bava_Batra'));
  // Tosafot are absent from whole stretches (Sanhedrin's last chapters, most of Horayot and Keritot).
  const thinTosafot = by('tosafot').thinTractates.map(item => item.workId);
  for (const workId of ['Tosafot_on_Sanhedrin', 'Tosafot_on_Horayot', 'Tosafot_on_Keritot']) assert.ok(thinTosafot.includes(workId), workId);
  assert.ok(TALMUD_COVERAGE.remote.every(item => item.coverageStatus === COVERAGE.REMOTE_ONLY));
  for (const layer of REMOTE_LAYERS.filter(item => item.category === 'talmud-commentary')) assert.deepEqual([layer.coverage.importedUnits, layer.coverage.coverageStatus], [0, COVERAGE.REMOTE_ONLY]);
});

test('offline: an amud reads from the device with every network request failing — Gemara, Rashi, Tosafot', async () => {
  const realFetch = globalThis.fetch;
  const asked = [];
  // The network is down: every request to a server fails. The app's own bundle (the packs, served from the app itself
  // on iOS/Android) still answers — as it does on a phone in airplane mode.
  globalThis.fetch = async url => { if (/^https?:/.test(String(url))) { asked.push(String(url)); throw new TypeError('Failed to fetch'); } return diskFetch(url); };
  try {
    const tractate = findTractate('Berakhot');
    const amud = await loadAmud(tractate, '2a', undefined, { fetchImpl: diskFetch });
    assert.equal(amud.local, true);
    assert.equal(amud.segments.length, 14);
    assert.match(amud.segments[0].gemara, /^מתני׳ <strong>מאימתי<\/strong> קורין את שמע בערבין/);
    assert.ok(amud.remoteError, 'the live layers are reported as unavailable');
    assert.equal(amud.steinsaltzVersion, null);
    assert.deepEqual(amud.localCommentators, ['רש"י', 'תוספות']);
    const first = amud.segments[0].commentaries;
    assert.ok(first.some(c => c.local && c.commentator === 'רש"י' && c.ref === 'Rashi on Berakhot 2a:1:1'));
    assert.ok(first.some(c => c.local && c.commentator === 'תוספות' && c.ref === 'Tosafot on Berakhot 2a:1:1'));
    assert.equal(amud.baseVersion.license, 'CC-BY-SA');
    assert.match(amud.localCredits.base.attribution.text, /ויקיטקסט.*CC BY-SA 4\.0/);
    const rashi = await loadCommentary('Rashi on Berakhot 2a:1:1');
    assert.equal(rashi.local, true);
    assert.match(rashi.html[0], /^<b>מאימתי קורין את שמע בערבין/);
    assert.equal(rashi.license, 'נחלת הכלל');
    const tos = await loadLocalCommentary('Tosafot on Berakhot 2a:1:1');
    assert.match(tos.html[0], /^<b>מאימתי/);
    // The only network attempts were the live layers (Steinsaltz, links), and they failed; the rest came from the device.
    assert.ok(asked.length > 0 && asked.every(url => url.startsWith('https://www.sefaria.org/api/texts/Steinsaltz') || url.startsWith('https://www.sefaria.org/api/links/')), asked.join(' '));
    // Another tractate, a late amud: Sanhedrin (Rashi and Tosafot CC BY-SA there), Tamid (no Rashi or Tosafot).
    const sanhedrin = await loadLocalAmud(findTractate('Sanhedrin'), '2a', { fetchImpl: diskFetch });
    assert.ok(sanhedrin.segments.some(seg => seg.commentaries.some(c => c.commentator === 'רש"י')));
    assert.ok(sanhedrin.credits.commentaries.every(item => item.license === 'cc-by-sa' && /CC BY-SA 4\.0/.test(item.attribution.text)));
    const tamid = await loadLocalAmud(findTractate('Tamid'), '25b', { fetchImpl: diskFetch });
    assert.ok(tamid.segments.length > 0 && tamid.segments.every(seg => !seg.commentaries.length));
    assert.deepEqual(tamid.localCommentatorsOfTractate, []);
    assert.equal(await loadLocalAmud(findTractate('Berakhot'), '64b', { fetchImpl: diskFetch }), null, 'no amud past the tractate');
  } finally { globalThis.fetch = realFetch; }
});

test('remote Rishonim: read in the one registered edition; a different edition is refused', async () => {
  assert.deepEqual(registeredRemoteEdition('Rosh on Berakhot 1:1:1'), { title: 'Rosh on Berakhot', versionTitle: 'Vilna Edition', heVersion: workById('Rosh_on_Berakhot').editions[0].heTitle, license: 'public-domain', recordedLicense: 'Public Domain' });
  assert.equal(registeredRemoteEdition('Chidushei Halachot on Yevamot; Alternate Version 2a:1').title, 'Chidushei Halachot on Yevamot; Alternate Version');
  assert.equal(registeredRemoteEdition('Meiri on Berakhot 2a:1'), null);
  const realFetch = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async url => { asked.push(String(url)); return new Response(JSON.stringify({ ref: 'Ritva on Shevuot 9a:3', he: ['x'], heVersionTitle: 'Some Other Edition', heLicense: 'Public Domain' })); };
  try {
    await assert.rejects(loadCommentary('Ritva on Shevuot 9a:3'), /אינה המהדורה הרשומה/);
    assert.match(asked[0], /vhe=Chiddushei%20haRitva%2C%20Lemberg%2C%201827$/);
  } finally { globalThis.fetch = realFetch; }
});

test('findable: מפרשי הש״ס grouped by commentator; each tractate once, opening in the Talmud reader', async () => {
  assert.deepEqual(categoryById('talmud-commentary').groups.map(([, title]) => title), ['רש״י', 'תוספות', 'רי״ף']);
  const shelf = worksInCategory('talmud-commentary');
  assert.deepEqual(['rashi', 'tosafot', 'rif'].map(group => shelf.filter(work => work.group === group).length), [36, 36, 25]);
  assert.equal(shelf.find(work => work.workId === 'Rashi_on_Berakhot').title, 'רש״י על ברכות');
  assert.equal(shelf.find(work => work.workId === 'Rashi_on_Berakhot').shortTitle, 'ברכות');
  const talmud = worksInCategory('talmud').filter(work => /^Bavli_/.test(work.workId));
  assert.equal(talmud.length, 37);
  assert.ok(talmud.every(work => work.kind === 'pack' && work.reader === 'talmud' && work.coverage === COVERAGE.FULL));
  assert.equal(PUBLIC_WORKS.filter(work => work.workId === 'Bavli_Berakhot').length, 1);
});

test('sources page: the Gemara credited as CC BY-SA 4.0 (not the app), each commentator with its real reach', async () => {
  const { buildSync } = await import('esbuild');
  const { Module } = await import('node:module');
  const source = fileURLToPath(new URL('../src/pages/AboutPage.jsx', import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', loader: { '.jsx': 'jsx', '.jpg': 'empty', '.png': 'empty' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false }) }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  const credits = loaded.exports.talmudCredits();
  assert.match(credits.base.line, /^37 מסכתות · 81,793 קטעים מתוך 81,793$/);
  assert.equal(credits.base.licenseUrl, 'https://creativecommons.org/licenses/by-sa/4.0/');
  assert.match(credits.base.url, /^https:\/\/he\.wikisource\.org\//);
  assert.deepEqual(credits.bundled.map(item => item.name), ['רש״י', 'תוספות', 'רי״ף']);
  assert.match(credits.bundled[0].line, /^36 מתוך 37 מסכתות/);
  assert.ok(credits.bundled[0].thin.some(line => /^בבא בתרא \(\d+ מתוך \d+ עמודים\)$/.test(line)));
  assert.ok(credits.bundled[0].missing.some(line => /תמיד/.test(line)));
  assert.deepEqual(credits.remote.map(item => item.name), ['רא״ש', 'ר״ן', 'מהרש״א', 'חידושי הרמב״ן', 'ריטב״א']);
  assert.ok(credits.shareAlike.includes('רש״י על סנהדרין'));
  const about = readFileSync(source, 'utf8');
  assert.match(about, /הרישיון חל על טקסט זה בלבד, ולא על האפליקציה/);
  assert.equal(loaded.exports.attributionCredits().some(item => /wikisource-talmud|talmud-commentary/.test(item.key)), false, 'the Talmud credits are grouped, not 49 separate lines');
});
