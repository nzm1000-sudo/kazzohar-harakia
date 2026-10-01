// Vocalized editions (scripts/library/build-vocalized.mjs): an existing vocalized edition stands in for a bundled
// unvocalized one only when it is the same text in the same structure, under a licence the library accepts, with its
// source recorded. The unvocalized edition stays as the fallback. The app never vocalizes a text itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { CORPUS_INDEX, LICENSES, VOCALIZED_EDITIONS, workById } from '../src/data/library/registry.mjs';
import VOCALIZED from '../src/data/library/vocalizedIndex.mjs';
import { checksum } from '../src/services/prayer/checksum.mjs';
import { validateWorkChunk } from '../src/services/library/integrity.mjs';
import { loadEditionChunk, verifyChunkText } from '../src/services/library/packs.mjs';
import { loadAnchors } from '../src/services/library/relations.mjs';
import { tokenize } from '../src/services/torah/hebrew.mjs';
import { searchTorah } from '../src/services/torah/search.mjs';
import { agreement, MIN_NIKUD, nikudRatioOf, WORK_AGREEMENT } from '../scripts/library/build-vocalized.mjs';
import { installDiskAssets } from './helpers/diskAssets.mjs';

installDiskAssets();
const packText = (packId, file) => gunzipSync(readFileSync(new URL(`../public/library/packs/${packId}/${file}`, import.meta.url))).toString('utf8');
const provenance = JSON.parse(readFileSync(new URL('../sources/vocalized/provenance.json', import.meta.url), 'utf8'));
const entries = Object.values(VOCALIZED_EDITIONS);
const unitText = unit => [unit.dh, unit.text].filter(Boolean).join(' ');
const ACCEPTED = new Set(['public-domain', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa']);
const STRIP_NIKUD = /[֑-ׇ]/g;

test('vocalized editions: there are some, each in a manifest-listed, checksum-verified pack file', () => {
  assert.ok(entries.length >= 50, `${entries.length} vocalized editions`);
  for (const pack of VOCALIZED.packs) {
    const manifest = JSON.parse(readFileSync(new URL(`../public/library/packs/${pack.packId}/manifest.json`, import.meta.url), 'utf8'));
    assert.equal(manifest.files.length, pack.works, `${pack.packId}: manifest lists every work`);
    assert.equal(manifest.license, pack.license);
    assert.equal(manifest.provenance, 'sources/vocalized/provenance.json');
  }
  for (const voc of entries) {
    const raw = packText(voc.packId, voc.file);
    assert.equal(checksum(raw), voc.checksum, `${voc.workId}: checksum`);
    const manifest = JSON.parse(readFileSync(new URL(`../public/library/packs/${voc.packId}/manifest.json`, import.meta.url), 'utf8'));
    assert.ok(manifest.files.some(file => file.file === voc.file && file.checksum === voc.checksum), `${voc.workId} in manifest`);
  }
});

test('vocalized editions: the default edition, with the unvocalized edition kept as an intact fallback', () => {
  for (const voc of entries) {
    const work = workById(voc.workId);
    const [vocalized, fallback] = work.editions;
    assert.equal(work.editions.length, 2, voc.workId);
    assert.equal(vocalized.packId, voc.packId);
    assert.equal(vocalized.nikud, 'vocalized');
    assert.equal(fallback.role, 'fallback');
    assert.equal(vocalized.fallbackEditionId, fallback.editionId);
    const original = CORPUS_INDEX.flatMap(pack => pack.works.map(item => ({ ...item, packId: pack.packId }))).find(item => item.workId === voc.workId);
    assert.equal(fallback.packId, original.packId);
    assert.equal(fallback.checksum, original.checksum, `${voc.workId}: the fallback is the bundled edition, unchanged`);
    assert.equal(checksum(packText(fallback.packId, fallback.file)), fallback.checksum, `${voc.workId}: the fallback file is intact`);
    assert.deepEqual(vocalized.nodes, fallback.nodes);
    assert.deepEqual(vocalized.expected, fallback.expected);
    assert.equal(vocalized.anchorsPackId, fallback.packId, `${voc.workId}: anchors stay in the original pack`);
    assert.equal(work.license, vocalized.license);
  }
});

test('vocalized editions: same structure and ids, the same words, and really vocalized', () => {
  for (const voc of entries) {
    const work = workById(voc.workId);
    const [vocalized, fallback] = work.editions;
    const chunk = verifyChunkText(packText(vocalized.packId, vocalized.file), vocalized);
    const old = verifyChunkText(packText(fallback.packId, fallback.file), fallback);
    assert.equal(chunk.workId, voc.workId);
    const report = validateWorkChunk(chunk, vocalized.expected.map((units, i) => ({ n: i + 1, units })));
    assert.deepEqual([report.status, report.missingUnits, report.duplicateIds.length, report.emptyUnits.length, report.invalidRefs.length, report.unexpectedUnits.length, report.orderErrors.length], [fallback.coverage, work.missingUnits, 0, 0, 0, 0, 0], `${voc.workId}: validates like the bundled edition`);
    for (const node of chunk.nodes) for (const unit of node.units) assert.doesNotMatch(unitText(unit), /[<>]|&[a-z]+;|[\u200e\u200f]/, `${unit.id}: no markup`);
    assert.deepEqual(chunk.nodes.map(node => [node.id, node.n, node.units.map(unit => [unit.id, unit.n, unit.v ?? null])]), old.nodes.map(node => [node.id, node.n, node.units.map(unit => [unit.id, unit.n, unit.v ?? null])]), `${voc.workId}: unit ids and anchors identical`);
    const newUnits = chunk.nodes.flatMap(node => node.units);
    const oldUnits = old.nodes.flatMap(node => node.units);
    let words = 0;
    let common = 0;
    newUnits.forEach((unit, i) => {
      assert.ok(tokenize(unitText(unit)).length, `${unit.id}: has text`);
      const score = agreement(unitText(oldUnits[i]), unitText(unit));
      words += score.oldWords;
      common += score.common;
    });
    assert.ok(common / words >= WORK_AGREEMENT, `${voc.workId}: words agree ${(common / words * 100).toFixed(1)}%`);
    const allText = newUnits.map(unitText).join(' ');
    assert.ok(nikudRatioOf(allText) >= MIN_NIKUD, `${voc.workId}: ${nikudRatioOf(allText).toFixed(2)} vowel points per letter`);
    assert.ok(nikudRatioOf(oldUnits.map(unitText).join(' ')) < 0.08, `${voc.workId}: the replaced edition was unvocalized`);
  }
});

test('vocalized editions: licence, attribution and provenance recorded for each', () => {
  for (const voc of entries) {
    assert.ok(ACCEPTED.has(voc.license), `${voc.workId}: ${voc.license}`);
    assert.equal(LICENSES[voc.license].redistributionAllowed, true);
    assert.ok(voc.recordedLicense && voc.licenseVerifiedAt && voc.editionTitle && voc.editionHeTitle, voc.workId);
    assert.ok(voc.attribution?.text.includes(voc.editionHeTitle), `${voc.workId}: attribution names the edition`);
    if (voc.license !== 'public-domain') assert.ok(voc.attribution.licenseUrl, `${voc.workId}: licence link`);
    const record = provenance.editions.find(edition => edition.workId === voc.workId);
    assert.ok(record, `${voc.workId}: provenance`);
    assert.equal(record.versionTitle, voc.editionTitle);
    assert.equal(record.license, voc.license);
    assert.match(record.export, /^https:\/\/www\.sefaria\.org\/download\/version\//);
    assert.match(record.exportTextSha256, /^[0-9a-f]{64}$/);
    assert.ok(record.verification.workAgreement >= WORK_AGREEMENT);
  }
  // Every refusal says why (licence, a missing comment, words that differ).
  assert.ok(provenance.rejected.every(item => item.reason && item.versionTitle));
  assert.ok(provenance.rejected.some(item => /licence/.test(item.reason)), 'an edition refused for its licence is recorded');
});

test('vocalized editions: read through the library loader, anchored from the original pack', async () => {
  const work = workById('Bartenura_on_Mishnah_Berakhot');
  assert.ok(VOCALIZED_EDITIONS[work.workId], 'Bartenura on Berakhot is vocalized');
  const chunk = await loadEditionChunk(work.editions[0], { node: 1 });
  const first = chunk.nodes[0].units[0];
  assert.equal(first.id, 'Bartenura_on_Mishnah_Berakhot.1.1');
  assert.match(unitText(first), /מֵאֵימָתַי/);
  const anchors = await loadAnchors(work);
  assert.ok(anchors.anchors.length > 100);
  const ids = new Set(chunk.nodes.flatMap(node => node.units.map(unit => unit.id)));
  assert.ok(anchors.anchors.filter(row => row.unitId.startsWith('Bartenura_on_Mishnah_Berakhot.1.')).every(row => ids.has(row.unitId)));
});

test('vocalized editions: search ignores nikud — an unpointed query finds the vocalized comment', async () => {
  const work = workById('Bartenura_on_Mishnah_Berakhot');
  const chunk = await loadEditionChunk(work.editions[0], { node: 1 });
  const unit = chunk.nodes[0].units[0];
  const pointed = unitText(unit);
  assert.deepEqual(tokenize(pointed), tokenize(pointed.replace(STRIP_NIKUD, '')), 'normalisation strips nikud');
  const result = await searchTorah('שנטמאו וטבלו אין יכולים לאכול בתרומה', { limit: 30 });
  assert.ok(result.results.some(hit => hit.workId === 'Bartenura_on_Mishnah_Berakhot' && hit.place.node === 1 && hit.place.unit === 1), 'the vocalized comment is found');
});
