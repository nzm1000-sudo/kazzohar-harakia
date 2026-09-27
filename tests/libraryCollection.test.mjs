// The expansion collection: every published book re-validates from its compressed file against Sefaria's structure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import COLLECTION_INDEX from '../src/data/library/collectionIndex.mjs';
import COLLECTION_REPORTS from '../src/data/library/collectionReports.mjs';
import { COVERAGE, LICENSES, PUBLIC_WORKS, TAXONOMY, WORKS, workById, worksInCategory } from '../src/data/library/registry.mjs';
import { validateWorkChunk } from '../src/services/library/integrity.mjs';
import { checksum } from '../src/services/prayer/checksum.mjs';
import { packBytesToText, verifyChunkText } from '../src/services/library/packs.mjs';
import { searchWorks } from '../src/services/library/search.mjs';
import { COLLECTION_PLAN } from '../scripts/library/collection-plan.mjs';
import { tocGroups } from '../src/services/library/toc.mjs';

const works = COLLECTION_INDEX.flatMap(pack => pack.works.map(work => ({ ...work, pack })));
const fileOf = work => readFileSync(fileURLToPath(new URL(`../public/library/packs/${work.pack.packId}/${work.file}`, import.meta.url)));

test('at least 150 new books, each from the plan, in a known category and group, under a free license that allows offline reading', () => {
  assert.ok(works.length >= 150, `${works.length} books`);
  const planned = new Set(COLLECTION_PLAN.map(item => item.title));
  for (const work of works) {
    assert.ok(planned.has(work.title), work.title);
    const category = TAXONOMY.find(item => item.id === work.pack.category);
    assert.ok(category, work.workId);
    if (work.group) assert.ok(category.groups.some(([id]) => id === work.group), `${work.workId}: group ${work.group}`);
    assert.ok(['public-domain', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa'].includes(work.license), work.workId);
    assert.equal(work.license, work.pack.license, work.workId);
    assert.equal(LICENSES[work.license].offlineAllowed, true);
    assert.ok(work.editionTitle, work.workId);
  }
  assert.equal(COLLECTION_REPORTS.reports.length, works.length);
});

test('every book re-validates from its compressed file: checksum, edition, structure; FULL or ≥97% with the gaps listed', () => {
  for (const work of works) {
    const text = gunzipSync(fileOf(work)).toString('utf8');
    assert.equal(checksum(text), work.checksum, work.workId);
    const chunk = verifyChunkText(text, { checksum: work.checksum, editionId: `${work.pack.packId}:${work.workId}` });
    const report = validateWorkChunk(chunk, work.expected.map((units, i) => ({ n: i + 1, units })));
    assert.equal(report.status, work.status, work.workId);
    assert.deepEqual([report.duplicateIds, report.emptyUnits, report.invalidRefs, report.unexpectedUnits, report.orderErrors].map(list => list.length), [0, 0, 0, 0, 0], work.workId);
    if (report.status === COVERAGE.PARTIAL) assert.ok(report.importedUnits / report.expectedUnits >= 0.97, `${work.workId}: ${report.importedUnits}/${report.expectedUnits}`);
    assert.doesNotMatch(chunk.nodes.map(node => node.units.map(unit => unit.text).join('')).join(''), /[<>]/, work.workId);
  }
});

test('named parts: every node has a title, sections tile the book in order, and the table of contents keeps every node once', () => {
  for (const work of works) {
    const total = work.expected.length;
    if (work.nodeTitles) assert.equal(work.nodeTitles.length, total, work.workId);
    if (work.sections) {
      assert.equal(work.sections[0].from, 1, work.workId);
      work.sections.forEach((section, i) => { if (i) assert.equal(section.from, work.sections[i - 1].to + 1, work.workId); });
      assert.equal(work.sections.at(-1).to, total, work.workId);
    }
    const edition = workById(work.workId).editions[0];
    assert.deepEqual(tocGroups(edition).flatMap(group => group.nodes), Array.from({ length: total }, (_, i) => i + 1), work.workId);
  }
  const tanya = works.find(work => work.workId === 'Kedushat_Levi');
  if (tanya) assert.ok(tanya.nodeTitles.some(title => title.includes('בראשית')));
});

test('the new books are public, searchable and placed: ids unique across the whole library', () => {
  const ids = WORKS.map(work => work.workId);
  assert.equal(new Set(ids).size, ids.length);
  for (const work of works) assert.ok(PUBLIC_WORKS.some(item => item.workId === work.workId), work.workId);
  assert.equal(searchWorks('הכוזרי', PUBLIC_WORKS)[0].work.workId, 'Kuzari');
  assert.ok(searchWorks('קיצור שלחן ערוך', PUBLIC_WORKS).some(hit => hit.work.workId === 'Kitzur_Shulchan_Arukh'));
  assert.ok(worksInCategory('midrash').some(work => work.group === 'rabbah'));
  assert.ok(worksInCategory('chassidut').length > 30);
});

test('a pack file is read the same whether stored plain or gzip-compressed', async () => {
  const json = JSON.stringify({ hello: 'שלום' });
  assert.equal(await packBytesToText(new TextEncoder().encode(json)), json);
  assert.equal(await packBytesToText(gzipSync(Buffer.from(json))), json);
});
