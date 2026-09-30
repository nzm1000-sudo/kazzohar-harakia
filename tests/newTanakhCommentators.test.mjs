// The five Torah commentators added to the bundled Tanakh commentary corpus (scripts/library/build-commentary.mjs):
// רשב״ם, רבינו בחיי, טור הארוך, שפתי חכמים, העמק דבר. Each is bundled offline, one pinned open edition per book whose
// licence was re-read live at build time, anchored to the verses it explains, and listed on the מפרשי המקרא shelf.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CORPUS_INDEX, LICENSES, TAXONOMY, workById } from '../src/data/library/registry.mjs';
import { COMMENTATORS } from '../src/data/library/corpusIndex.mjs';
import { loadEditionChunk } from '../src/services/library/packs.mjs';
import { loadAnchors } from '../src/services/library/relations.mjs';
import { commentatorsOf } from '../src/services/library/commentators.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const diskFetch = async url => new Response(readFileSync(`${root}public/${decodeURIComponent(new URL(url, 'http://app/').pathname.slice(1))}`));
const provenance = JSON.parse(readFileSync(new URL('../sources/sefaria-commentaries/provenance.json', import.meta.url), 'utf8'));
const editions = provenance.corpora.tanakh.editions;
const TORAH = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];
const PACK = 'sefaria-tanakh-commentary-public-domain';

// id → Hebrew name, Sefaria title per book, exact versionTitle per book, the source it was taken from.
const NEW = [
  { id: 'rashbam', he: 'רשב״ם', title: book => `Rashbam on ${book}`, version: book => ({ Genesis: 'daat', Exodus: 'Rashbam on Torah -- Daat', Leviticus: 'Rashbam on Leviticus - Daat', Numbers: 'Rashbam on Numbers -- Daat', Deuteronomy: 'Rashbam on Deuteronomy -- Daat' })[book], source: /daat\.ac\.il/ },
  { id: 'rabbeinu-bahya', he: 'רבינו בחיי', title: () => 'Rabbeinu Bahya', version: () => 'Midrash Rabbeinu Bachya [ben Asher]. Warsaw, 1878', source: /nli\.org\.il/ },
  { id: 'tur-haarokh', he: 'טור הארוך', title: () => 'Tur HaArokh', version: () => 'Perush al ha-Torah, Hanover, 1838', source: /nli\.org\.il/ },
  { id: 'siftei-chakhamim', he: 'שפתי חכמים', title: () => 'Siftei Chakhamim', version: () => 'Siftei Hakhamim', source: /toratemetfreeware\.com/ },
  { id: 'haamek-davar', he: 'העמק דבר', title: book => `Haamek Davar on ${book}`, version: () => 'Sefer Torat Elohim, Vilna 1879', source: /nli\.org\.il/ },
];
const workIdOf = (c, book) => `${c.title(book).replace(/[^A-Za-z0-9]+/g, '_')}${c.title(book).includes(' on ') ? '' : `_on_${book}`}`;
const packWorks = CORPUS_INDEX.find(pack => pack.packId === PACK).works;

test('the five new commentators exist, in customary order after the first six, each with the whole Torah', () => {
  const groups = TAXONOMY.find(item => item.id === 'tanakh-commentary').groups;
  assert.deepEqual(groups.slice(6), NEW.map(c => [c.id, c.he]));
  const bundled = COMMENTATORS.tanakh.bundled;
  for (const c of NEW) {
    const record = bundled.find(item => item.id === c.id);
    assert.ok(record, c.id);
    assert.equal(record.he, c.he);
    assert.deepEqual([record.importedBooks, record.expectedBooks], [5, 5], c.id);
    assert.ok(record.importedUnits > 2000 && record.coveragePercent >= 97, `${c.id}: ${record.importedUnits} comments, ${record.coveragePercent}%`);
    assert.ok(record.rank > 6 && record.rank < 12, c.id);
  }
  // The remote layers are ranked after every bundled commentator.
  assert.ok(COMMENTATORS.tanakh.remote.every(item => item.rank > 11));
});

test('bundled offline: every book is a file of the public-domain pack, listed in its manifest with its checksum', () => {
  const manifest = JSON.parse(readFileSync(`${root}public/library/packs/${PACK}/manifest.json`, 'utf8'));
  for (const c of NEW) for (const book of TORAH) {
    const workId = workIdOf(c, book);
    const work = workById(workId);
    assert.ok(work, workId);
    assert.equal(work.kind, 'pack', workId);
    assert.equal(work.group, c.id);
    assert.equal(work.layerTitle, c.he);
    assert.equal(work.relation.baseWorkId, book);
    const entry = packWorks.find(item => item.workId === workId);
    assert.ok(entry, `${workId} in ${PACK}`);
    assert.ok(existsSync(`${root}public/library/packs/${PACK}/${entry.file}`), entry.file);
    assert.ok(existsSync(`${root}public/library/packs/${PACK}/${entry.anchorsFile}`), entry.anchorsFile);
    assert.ok(manifest.files.some(file => file.file === entry.file && file.checksum === entry.checksum), `${workId} in manifest`);
    assert.ok(manifest.files.some(file => file.role === 'anchors' && file.file === entry.anchorsFile && file.checksum === entry.anchorsChecksum), `${workId} anchors in manifest`);
    assert.ok(entry.bytes < 450 * 1024, `${workId} is not a large file`);
  }
});

test('licences: the exact edition per book, recorded Public Domain and re-verified live, shipped as public domain', () => {
  for (const c of NEW) for (const book of TORAH) {
    const workId = workIdOf(c, book);
    const entry = packWorks.find(item => item.workId === workId);
    const record = editions.find(item => item.workId === workId);
    assert.ok(record, `${workId} provenance`);
    assert.equal(record.title, c.title(book));
    assert.equal(record.versionTitle, c.version(book), workId);
    assert.equal(entry.editionTitle, c.version(book), workId);
    assert.match(record.versionSource, c.source, workId);
    assert.doesNotMatch(record.versionSource, /wikisource/i);
    assert.equal(record.recordedLicense, 'Public Domain', workId);
    assert.equal(record.license, 'public-domain');
    assert.equal(record.wikisourceSourced, false);
    assert.match(record.licenseVerifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(entry.licenseVerifiedAt, record.licenseVerifiedAt);
    assert.equal(entry.license, 'public-domain');
    assert.equal(LICENSES[entry.license].offlineAllowed, true);
    assert.equal(LICENSES[entry.license].commercialUseAllowed, true);
    assert.equal(record.export, `https://www.sefaria.org/download/version/${encodeURIComponent(`${record.title} - he - ${record.versionTitle}`)}.json`);
  }
  // The candidates set aside are recorded with their reason.
  for (const name of ['Chizkuni', 'Daat Zkenim', 'Alshich', 'Bekhor Shor', 'Metsudah Publications']) assert.ok(provenance.notUsed.some(item => item.item.includes(name)), name);
});

test('anchors: every anchored comment exists and sits on a real verse of its Torah book', async () => {
  for (const c of NEW) for (const book of TORAH) {
    const work = workById(workIdOf(c, book));
    const record = await loadAnchors(work, { fetchImpl: diskFetch });
    const chunk = await loadEditionChunk(work.editions[0], { fetchImpl: diskFetch });
    const base = workById(book);
    const units = new Map(chunk.nodes.flatMap(node => node.units.map(unit => [unit.id, unit])));
    assert.deepEqual([record.relationType, record.baseWorkId, record.anchorScheme, record.license], ['commentary', book, 'sefaria-ref', 'public-domain']);
    assert.ok(record.anchors.length > 200, `${work.workId}: ${record.anchors.length} anchors`);
    for (const anchor of record.anchors) {
      const [, chapter, verse] = anchor.anchorRef.match(/^[A-Za-z]+\.(\d+)\.(\d+)$/).map(Number);
      const unit = units.get(anchor.unitId);
      assert.ok(unit, anchor.unitId);
      assert.equal(unit.v, verse, anchor.unitId);
      assert.ok(verse <= base.editions[0].nodes[chapter - 1], `${anchor.unitId} → ${anchor.anchorRef}`);
      assert.equal(anchor.baseCanonicalRef, `${book} ${chapter}:${verse}`);
    }
    assert.equal(work.editions[0].anchorNodes.reduce((total, [, , from, to]) => total + to - from + 1, 0), record.anchors.length, work.workId);
  }
  // Known comments on their verses (the opening words kept apart, in bold, as printed).
  const first = async (workId, chapter, verse) => (await loadEditionChunk(workById(workId).editions[0], { fetchImpl: diskFetch })).nodes.find(node => node.n === chapter).units.find(unit => unit.v === verse);
  assert.equal((await first('Tur_HaArokh_on_Genesis', 1, 1)).dh, 'בראשית.');
  assert.equal((await first('Haamek_Davar_on_Genesis', 1, 1)).dh, 'בראשית ברא אלהים.');
  assert.match((await first('Rabbeinu_Bahya_on_Genesis', 1, 1)).text, /^כי תורתנו הקדושה/);
  assert.match((await first('Siftei_Chakhamim_on_Genesis', 1, 1)).text, /^דהא התורה לא נתנה לישראל/);
  assert.match((await first('Rashbam_on_Exodus', 1, 1)).text, /^ואלה שמות - /);
});

test('the מפרשי המקרא shelf lists them as bundled commentators, their five books under תורה', () => {
  const list = commentatorsOf('tanakh-commentary');
  for (const c of NEW) {
    const item = list.find(entry => entry.id === c.id);
    assert.ok(item, c.id);
    assert.equal(item.title, c.he);
    assert.equal(item.remote, false);
    assert.deepEqual(item.books.map(book => book.base.workId), TORAH, c.id);
    assert.deepEqual(item.sections.map(section => section.id), ['torah'], c.id);
  }
  assert.deepEqual(list.filter(item => !item.remote).map(item => item.id).slice(6), NEW.map(c => c.id));
});
