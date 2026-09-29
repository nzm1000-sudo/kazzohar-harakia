// Torah Engine · the content inventory, the rights gate and index registration. A published, local, rights-cleared
// work cannot sit in the library without being in the full-text index (and the index cannot hold anything else).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { WORKS, workById } from '../src/data/library/registry.mjs';
import MANIFEST from '../src/data/torah/searchIndex.mjs';
import { RIGHTS, SEARCHABLE_RIGHTS, capabilitiesOf, indexedWorks, inventorySummary, rightsOf, torahInventory } from '../src/services/torah/inventory.mjs';
import { NORMALIZER_VERSION } from '../src/services/torah/hebrew.mjs';
import { FORMAT_VERSION, bytesChecksum, decodeDocs, decodeShard } from '../src/services/torah/indexFormat.mjs';
import { torahAudit } from '../src/services/torah/audit.mjs';

const root = new URL('../', import.meta.url);
const indexed = new Map(MANIFEST.works.map(row => [row[0], row]));

test('inventory: one record per work, no duplicates, every field present', () => {
  const { records } = torahInventory();
  assert.equal(records.length, WORKS.length);
  assert.equal(new Set(records.map(record => record.id)).size, records.length);
  for (const record of records) {
    for (const field of ['heTitle', 'category', 'refFormat', 'licence', 'rights', 'capabilities', 'reader', 'dataLocation', 'parser']) assert.ok(record[field] !== undefined && record[field] !== null, `${record.id}: ${field}`);
    assert.ok(Object.values(RIGHTS).includes(record.rights), record.id);
  }
  const summary = inventorySummary();
  assert.equal(summary.total, WORKS.length);
  assert.ok(summary.searchable > 600);
});

test('rights gate: עונג שבת is permission-granted, NC works stay allowed, unknown licences are never searchable', () => {
  assert.equal(rightsOf(workById('Oneg_Shabbat')), RIGHTS.PERMISSION_GRANTED);
  assert.equal(rightsOf(workById('Oneg_Shabbat_Notes')), RIGHTS.PERMISSION_GRANTED);
  assert.equal(rightsOf(workById('halacha.yalkut-yosef-tashz')), RIGHTS.NONCOMMERCIAL_ONLY);
  const unknown = WORKS.filter(work => rightsOf(work) === RIGHTS.UNKNOWN).map(work => work.workId).sort();
  assert.deepEqual(unknown, ['legacy.chiddushei-harim', 'legacy.likutei-etzot', 'legacy.otzar-laazei-rashi', 'legacy.seder-hadorot', 'legacy.tzafnat-paneach', 'legacy.yesod-hateshuvah'], 'the six hidden legacy works');
  for (const id of unknown) {
    assert.equal(capabilitiesOf(workById(id)).globalSearch, 'none', id);
    assert.ok(!indexed.has(id), `${id} must not be in the index`);
  }
  for (const [id, , rights] of MANIFEST.works) assert.ok(SEARCHABLE_RIGHTS.has(rights), `${id}: ${rights}`);
  for (const pending of torahInventory().pending) assert.equal(pending.searchable, false);
});

test('registration: every published local rights-cleared work is indexed, with the edition it was built from', () => {
  const should = indexedWorks();
  assert.deepEqual(should.filter(work => !indexed.has(work.workId)).map(work => work.workId), []);
  for (const work of should) if (work.kind === 'pack') assert.equal(indexed.get(work.workId)[4], work.editions[0].checksum, `${work.workId}: the index is stale — rebuild with node scripts/torah/build-search-index.mjs`);
  for (const [id] of MANIFEST.works) if (id !== 'halacha.answers') assert.equal(capabilitiesOf(workById(id)).globalSearch, 'full-text', `${id} is indexed but not registered as searchable`);
  // Every library work declares its capabilities; a work outside full text says why.
  for (const work of WORKS) {
    const capabilities = capabilitiesOf(work);
    for (const key of ['browsing', 'globalSearch', 'bookSearch', 'offline', 'commentaryEngine', 'referenceResolution']) assert.ok(key in capabilities, `${work.workId}: ${key}`);
    if (capabilities.browsing && capabilities.globalSearch !== 'full-text') assert.ok(capabilities.fullTextReason, `${work.workId}: no reason for being outside the index`);
  }
});

test('the Torah corpora of the plan are all in the index', () => {
  for (const id of ['Genesis', 'Psalms', 'Rashi_on_Genesis', 'Ramban_on_Genesis', 'Mishnah_Berakhot', 'Bartenura_on_Mishnah_Berakhot', 'Tosafot_Yom_Tov_on_Mishnah_Berakhot', 'Bavli_Berakhot', 'Rashi_on_Berakhot', 'Tosafot_on_Berakhot', 'Rif_Berakhot', 'Shulchan_Arukh__Orach_Chayim', 'Shulchan_Arukh__Yoreh_Deah', 'Mishnah_Berurah', 'Biur_Halacha', 'Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim', 'Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim', 'Zohar', 'Yahel_Ohr_on_Zohar', 'Oneg_Shabbat', 'Oneg_Shabbat_Notes', 'halacha.yalkut-yosef-tashz', 'halacha.answers']) assert.ok(indexed.has(id), id);
});

test('index files: present, checksum-verified, decodable, versioned and sized as recorded', () => {
  assert.equal(MANIFEST.normalizerVersion, NORMALIZER_VERSION, 'the normalizer changed: rebuild the index');
  assert.equal(MANIFEST.formatVersion, FORMAT_VERSION);
  let bytes = 0;
  for (const [file, size, sum, terms] of MANIFEST.shards) {
    const path = new URL(`public/torah-index/${file}`, root);
    assert.ok(existsSync(path), file);
    assert.equal(statSync(path).size, size, file);
    bytes += size;
    if (terms && Number(file.slice(1, 4)) % 32 === 0) {
      const raw = new Uint8Array(gunzipSync(readFileSync(path)));
      assert.equal(bytesChecksum(raw), sum, file);
      assert.equal(decodeShard(raw).terms.length, terms, file);
    }
  }
  const docsRaw = new Uint8Array(gunzipSync(readFileSync(new URL(`public/torah-index/${MANIFEST.docs.file}`, root))));
  assert.equal(bytesChecksum(docsRaw), MANIFEST.docs.checksum);
  const docs = decodeDocs(docsRaw);
  assert.equal(docs.count, MANIFEST.totals.documents);
  assert.equal(docs.count, MANIFEST.works.reduce((sum, row) => sum + row[3], 0));
  assert.equal(bytes + statSync(new URL(`public/torah-index/${MANIFEST.docs.file}`, root)).size, MANIFEST.totals.bytes);
  assert.ok(MANIFEST.totals.bytes < 24 * 1024 * 1024, 'size budget: the index stays under 24 MB');
});

test('the index is deterministic and current: rebuilding it from the corpus changes nothing', { timeout: 300000 }, () => {
  const output = execFileSync(process.execPath, ['--max-old-space-size=8192', 'scripts/torah/build-search-index.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /index current/);
});

test('data-quality audit: 0 duplicate ids, orphans, unreachable commentaries, missing targets, stale or unregistered works', () => {
  const audit = torahAudit();
  for (const [key, list] of Object.entries(audit.problems)) assert.deepEqual(list, [], key);
  assert.equal(audit.index.units, MANIFEST.totals.documents);
});
