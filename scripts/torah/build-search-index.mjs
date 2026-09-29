// The Torah Engine's full-text index, built from the texts on the device — deterministic, offline, no network.
// Run: node scripts/torah/build-search-index.mjs            (writes public/torah-index/, public/torah-packs/ and
//                                                             src/data/torah/*.mjs)
//      node scripts/torah/build-search-index.mjs --check    (rebuilds in memory and fails if anything differs)
//      --core-only / --packs-only                           (only the built-in index / only the downloadable packs)
//
// - Which works are indexed is decided by the rights gate in src/services/torah/inventory.mjs (never by what files
//   exist): published, local, rights OPEN / PERMISSION_GRANTED / NONCOMMERCIAL_ONLY. Unknown or pending rights never.
// - A search unit is one unit of a pack (verse, mishnah, comment, Gemara segment, seif, seif katan, Zohar paragraph,
//   halacha of עונג שבת…), one section of Yalkut Yosef, or one published answer of the Halacha Engine.
// - Every pack file is checksum-verified before it is read; the index records each work's edition checksum, so a
//   changed corpus makes the index stale (tests/torahEngineRegistry.test.mjs).
// - Output: 256 term shards (by a word's last two letters, so prefixed forms share a shard) and a document table,
//   gzip-compressed; plus src/data/torah/searchIndex.mjs (manifest), verseLayers.mjs (which commentators speak of each
//   verse / mishnah) and citationEdges.mjs (explicit citations resolved by src/services/torah/citations.mjs).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { WORKS, workById } from '../../src/data/library/registry.mjs';
import { YALKUT_YOSEF } from '../../src/data/yalkutYosef.mjs';
import { publishedPracticalQuestions } from '../../src/data/practicalHalachaQa.mjs';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { NORMALIZER_VERSION } from '../../src/services/torah/hebrew.mjs';
import { FORMAT_VERSION, bytesChecksum } from '../../src/services/torah/indexFormat.mjs';
import { STOP_DF_RATIO, createIndexBuilder } from './indexBuilder.mjs';
import { PACKS_OUT, buildShelfPacks } from './packBuilder.mjs';
import { EXTRA_CORPORA, familyOf, indexedWorks, rightsOf } from '../../src/services/torah/inventory.mjs';
import { answerText, packUnitText, yalkutSectionText } from '../../src/services/torah/documents.mjs';
import { parseCitations } from '../../src/services/torah/citations.mjs';

const CHECK = process.argv.includes('--check');
const CORE = !process.argv.includes('--packs-only');
const PACKS = !process.argv.includes('--core-only');
const OUT = 'public/torah-index';
const PACK_DIR = 'public/library/packs';
export const BUILDER_VERSION = 1;
const started = Date.now();

// ---------- Reading the corpora ----------
function readPackFile(packId, file, expected) {
  const path = `${PACK_DIR}/${packId}/${file}`;
  let bytes = readFileSync(path);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
  const text = bytes.toString('utf8');
  if (expected && checksum(text) !== expected) throw new Error(`checksum mismatch: ${path}`);
  return JSON.parse(text);
}
function packNodes(work) {
  const edition = work.editions[0];
  const files = edition.parts?.length ? edition.parts.map(part => [part.file, part.checksum]) : [[edition.file, edition.checksum]];
  return files.flatMap(([file, sum]) => readPackFile(edition.packId, file, sum).nodes);
}

// ---------- Accumulating postings (the built-in index) ----------
const core = createIndexBuilder();
const { addDocument, beginWork } = core;

// Which commentators speak of each verse / mishnah (bundled layers on the Tanakh and the Mishnah).
const verseLayers = new Map(); // baseWorkId → { layers: [], marks: Map(chapter → Map(verse → bitmask)) }
function markVerse(work, node, unit) {
  const base = workById(work.relation.baseWorkId);
  const expected = base?.editions[0].expected;
  if (!expected || !unit.v || node > expected.length || unit.v > expected[node - 1]) return;
  if (!verseLayers.has(base.workId)) verseLayers.set(base.workId, { layers: [], marks: new Map() });
  const entry = verseLayers.get(base.workId);
  let bit = entry.layers.indexOf(work.workId);
  if (bit < 0) { entry.layers.push(work.workId); bit = entry.layers.length - 1; }
  if (!entry.marks.has(node)) entry.marks.set(node, new Map());
  const chapter = entry.marks.get(node);
  chapter.set(unit.v, (chapter.get(unit.v) || 0) | (1 << bit));
}
const VERSE_BASES = new Set(['tanakh', 'mishnah']);

const citationEdges = [];
const CITATION_SOURCES = new Set(['Oneg_Shabbat_Notes', 'Oneg_Shabbat']);

const selected = indexedWorks(WORKS);
for (const work of selected) {
  if (work.kind === 'pack') {
    const edition = work.editions[0];
    const add = beginWork({ id: work.workId, family: familyOf(work), rights: rightsOf(work), sig: edition.checksum, store: 'pack' });
    const nodes = packNodes(work).sort((a, b) => a.n - b.n);
    const layerOnVerses = work.relation?.anchorScheme === 'sefaria-ref' && VERSE_BASES.has(workById(work.relation.baseWorkId)?.primaryCategory);
    for (const node of nodes) {
      for (const unit of [...node.units].sort((a, b) => a.n - b.n)) {
        const text = packUnitText(unit);
        addDocument(text);
        add(node.n, unit.n);
        if (layerOnVerses) markVerse(work, node.n, unit);
        if (CITATION_SOURCES.has(work.workId)) for (const citation of parseCitations(unit.text)) citationEdges.push([`${work.workId}.${node.n}.${unit.n}`, citation.kind, citation.target.workId, citation.target.node || citation.target.amud, citation.target.unit || null, citation.cited]);
      }
    }
  } else if (work.workId === 'halacha.yalkut-yosef-tashz') {
    const sig = createHash('sha256').update(JSON.stringify(YALKUT_YOSEF.sections.map(section => [section.id, section.text]))).digest('hex').slice(0, 16);
    const add = beginWork({ id: work.workId, family: 'halacha', rights: rightsOf(work), sig, store: 'yalkut-yosef' });
    YALKUT_YOSEF.sections.forEach((section, i) => { addDocument(yalkutSectionText(section)); add(1, i + 1); });
  }
}
{
  const answers = publishedPracticalQuestions();
  const corpus = EXTRA_CORPORA.find(item => item.id === 'halacha.answers');
  const sig = createHash('sha256').update(JSON.stringify(answers.map(entry => [entry.id, answerText(entry)]))).digest('hex').slice(0, 16);
  const add = beginWork({ id: corpus.id, family: corpus.family, rights: corpus.rights, sig, store: 'halacha-answers', ids: answers.map(entry => entry.id) });
  answers.forEach((entry, i) => { addDocument(answerText(entry)); add(1, i + 1); });
}

// ---------- Writing ----------
const built = core.finish();
const { files, outputs, docsGz, docsRaw, indexBytes, postings, docCount, tokenTotal, works } = built;
const stopTerms = built.stopTerms.map(([term]) => term);
const terms = { size: built.termCount + stopTerms.length };
const signature = createHash('sha256').update(JSON.stringify({ NORMALIZER_VERSION, FORMAT_VERSION, BUILDER_VERSION, STOP_DF_RATIO, works: works.map(work => [work.id, work.sig, work.docs]) })).digest('hex').slice(0, 16);
const manifest = {
  version: signature,
  normalizerVersion: NORMALIZER_VERSION,
  formatVersion: FORMAT_VERSION,
  builderVersion: BUILDER_VERSION,
  docs: { file: 'docs.bin.gz', bytes: docsGz.length, checksum: bytesChecksum(docsRaw), count: docCount },
  totals: { documents: docCount, terms: terms.size - stopTerms.length, postings, tokens: tokenTotal, bytes: indexBytes },
  stopTerms: built.stopTerms,
  // [id, family, rights, docs, signature, store(, ids)] — in index order; document numbers follow this order.
  works: works.map(work => [work.id, work.family, work.rights, work.docs, work.sig, work.store, ...(work.ids ? [work.ids] : [])]),
  shards: files.map(file => [file.file, file.bytes, file.checksum, file.terms]),
};

const verseModule = Object.fromEntries([...verseLayers].sort((a, b) => a[0].localeCompare(b[0])).map(([baseWorkId, entry]) => {
  const expected = workById(baseWorkId).editions[0].expected;
  const width = entry.layers.length > 4 ? 2 : 1;
  const chapters = expected.map((verses, c) => Array.from({ length: verses }, (_, v) => (entry.marks.get(c + 1)?.get(v + 1) || 0).toString(16).padStart(width, '0')).join(''));
  return [baseWorkId, { layers: entry.layers, width, chapters }];
}));

const header = '// Generated by scripts/torah/build-search-index.mjs — do not edit by hand.\n';
const modules = [
  ['src/data/torah/searchIndex.mjs', `${header}// The Torah Engine's full-text index: what was indexed (rights-gated), its files, checksums and version.\nexport default ${JSON.stringify(manifest)};\n`],
  ['src/data/torah/verseLayers.mjs', `${header}// Which bundled commentators have a comment on each verse (Tanakh) or mishnah: per base work, the layers in bit order and\n// per chapter one hex bitmask per verse (width hex digits each). Read by src/services/torah/commentaries.mjs.\nexport default ${JSON.stringify(verseModule)};\n`],
  ['src/data/torah/citationEdges.mjs', `${header}// Explicit citations (EXPLICITLY_CITES), parsed conservatively by src/services/torah/citations.mjs and verified to exist:\n// [fromUnitId, kind, toWorkId, toNode|amud, toUnit|null, cited words].\nexport default ${JSON.stringify(citationEdges)};\n`],
];

// ---------- The downloadable shelf packs (same layout, the built-in stop words) ----------
const shelf = PACKS ? buildShelfPacks({ packNodes, coreStopTerms: manifest.stopTerms }) : { outputs: [], modules: [], catalog: null };

const coreFiles = CORE ? outputs.map(([file, gz]) => [`${OUT}/${file}`, gz]) : [];
const allModules = [...(CORE ? modules : []), ...shelf.modules];
if (CHECK) {
  const problems = [];
  for (const [path, text] of allModules) if (!existsSync(path) || readFileSync(path, 'utf8') !== text) problems.push(path);
  for (const [path, gz] of [...coreFiles, ...shelf.outputs]) {
    if (!existsSync(path)) { problems.push(path); continue; }
    const disk = readFileSync(path);
    const same = path.endsWith('.gz') ? gunzipSync(disk).equals(gunzipSync(gz)) : disk.equals(gz);
    if (!same) problems.push(path);
  }
  if (problems.length) { console.error(`index is stale: ${problems.slice(0, 10).join(', ')}${problems.length > 10 ? '…' : ''}`); process.exit(1); }
  console.log(`index current (${signature})${PACKS ? ` · packs current (${shelf.catalog.packs.map(pack => `${pack.packId} ${pack.version}`).join(', ')})` : ''}`);
} else {
  if (CORE) {
    if (existsSync(OUT)) rmSync(OUT, { recursive: true });
    mkdirSync(OUT, { recursive: true });
  }
  mkdirSync('src/data/torah', { recursive: true });
  if (PACKS && existsSync(PACKS_OUT)) rmSync(PACKS_OUT, { recursive: true });
  for (const [path, bytes] of [...coreFiles, ...shelf.outputs]) { mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true }); writeFileSync(path, bytes); }
  for (const [path, text] of allModules) writeFileSync(path, text);
  const byFamily = {};
  for (const work of works) byFamily[work.family] = (byFamily[work.family] || 0) + work.docs;
  const biggest = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 3).map(file => `${file.file} ${(file.bytes / 1024).toFixed(0)} KB`);
  const packs = shelf.catalog?.packs.map(pack => ({ id: pack.packId, works: pack.works, documents: pack.documents, MB: +(pack.totalDownloadSize / 1048576).toFixed(2) }));
  console.log(JSON.stringify({ works: works.length, documents: docCount, terms: terms.size, postings, indexMB: +(indexBytes / 1048576).toFixed(2), docsKB: +(docsGz.length / 1024).toFixed(1), biggest, byFamily, verseBases: verseLayers.size, citations: citationEdges.length, packs, seconds: Math.round((Date.now() - started) / 1000) }, null, 1));
}
