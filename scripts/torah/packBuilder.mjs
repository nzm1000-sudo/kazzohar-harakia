// The downloadable full-text packs of the shelves outside the built-in index (midrash, chassidut, responsa,
// machshava / mussar / kabbalah): one lexical index per pack, over the texts the app already carries, in the built-in
// index's exact binary layout and with its stop words. Output: public/torah-packs/<packId>/{manifest.json, docs.bin.gz,
// sNNN.bin.gz}, public/torah-packs/catalog.json (what the app reads online to learn of a new version — no app rebuild)
// and src/data/torah/packCatalog.mjs (the same catalog inside the app, for offline). The rights gate decides everything:
// a work enters a pack only through capabilitiesOf(work).fullTextPack; UNKNOWN / PENDING never.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { WORKS, workById } from '../../src/data/library/registry.mjs';
import { NORMALIZER_VERSION } from '../../src/services/torah/hebrew.mjs';
import { FORMAT_VERSION, bytesChecksum } from '../../src/services/torah/indexFormat.mjs';
import { RIGHTS, SEARCHABLE_RIGHTS, SHELF_PACKS, familyOf, packWorks, rightsOf } from '../../src/services/torah/inventory.mjs';
import { packUnitText } from '../../src/services/torah/documents.mjs';
import { PACK_SCHEMA_VERSION, stopTermsHash } from '../../src/services/torah/packFormat.mjs';
import { createIndexBuilder } from './indexBuilder.mjs';

export const PACK_BUILDER_VERSION = 1;
export const PACKS_OUT = 'public/torah-packs';
const MINIMUM_APP_VERSION = '1.0.0';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const NC = new Set(['cc-by-nc', 'cc-by-nc-sa']);

export function buildShelfPacks({ packNodes, coreStopTerms }) {
  const stop = coreStopTerms.map(([term]) => term);
  const outputs = []; // [path, bytes]
  const catalog = [];
  const stopHash = stopTermsHash(stop);
  for (const shelf of SHELF_PACKS) {
    const works = packWorks(shelf.packId, WORKS);
    if (!works.length) continue;
    const builder = createIndexBuilder();
    let textBytes = 0;
    for (const work of works) {
      const rights = rightsOf(work);
      if (!SEARCHABLE_RIGHTS.has(rights)) throw new Error(`rights gate: ${work.workId} is ${rights}`);
      const edition = work.editions[0];
      textBytes += edition.parts?.length ? edition.parts.reduce((sum, part) => sum + (part.bytes || 0), 0) : edition.bytes || 0;
      const add = builder.beginWork({ id: work.workId, family: shelf.family, rights, sig: edition.checksum, store: 'pack' });
      for (const node of packNodes(work).sort((a, b) => a.n - b.n)) {
        for (const unit of [...node.units].sort((a, b) => a.n - b.n)) { builder.addDocument(packUnitText(unit)); add(node.n, unit.n); }
      }
    }
    const built = builder.finish({ stopTerms: stop, outDir: `${PACKS_OUT}/${shelf.packId}` });
    const files = [
      { path: 'docs.bin.gz', role: 'lexical-docs', bytes: built.docsGz.length, sha256: sha256(built.docsGz), checksum: bytesChecksum(built.docsRaw), data: built.docsGz },
      ...built.files.map(file => ({ path: file.file, role: 'lexical-shard', bytes: file.bytes, sha256: sha256(file.gz), checksum: file.checksum, terms: file.terms, data: file.gz })),
    ];
    const lexicalIndexSize = files.reduce((sum, file) => sum + file.bytes, 0);
    const index = {
      normalizerVersion: NORMALIZER_VERSION,
      formatVersion: FORMAT_VERSION,
      builderVersion: PACK_BUILDER_VERSION,
      stopTermsHash: stopHash,
      family: shelf.family,
      docs: { file: 'docs.bin.gz', bytes: built.docsGz.length, checksum: bytesChecksum(built.docsRaw), count: built.docCount },
      totals: { documents: built.docCount, terms: built.termCount, postings: built.postings, tokens: built.tokenTotal, bytes: lexicalIndexSize },
      stopTerms: built.stopTerms,
      works: built.works.map(work => [work.id, work.family, work.rights, work.docs, work.sig, work.store]),
      shards: built.files.map(file => [file.file, file.bytes, file.checksum, file.terms]),
    };
    const contentHash = sha256(JSON.stringify({ schema: PACK_SCHEMA_VERSION, index, files: files.map(file => [file.path, file.sha256]) }));
    const nc = works.filter(work => NC.has(work.editions[0].license));
    const attributions = [...new Set(works.map(work => work.editions[0].attribution?.text || `${work.editions[0].heTitle || work.editions[0].title} · ${work.editions[0].sourceProvider}`))];
    const path = `${PACKS_OUT}/${shelf.packId}/manifest.json`;
    const previous = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
    const manifest = {
      schemaVersion: PACK_SCHEMA_VERSION,
      packId: shelf.packId,
      displayName: `חיפוש מלא · ${shelf.title}`,
      version: contentHash.slice(0, 12),
      contentVersion: [...new Set(works.map(work => work.editions[0].contentVersion).filter(Boolean))].sort().slice(0, 3).join(' · ') || null,
      contentHash,
      rightsState: nc.length ? RIGHTS.NONCOMMERCIAL_ONLY : RIGHTS.OPEN,
      source: [...new Set(works.map(work => work.editions[0].sourceProvider))].sort(),
      provider: 'כזוהר הרקיע · אינדקס חיפוש מקומי',
      attribution: attributions,
      commercialRestrictions: nc.length ? { noncommercial: true, works: nc.map(work => work.workId) } : null,
      includedWorks: works.map(work => work.workId),
      includedCommentaries: works.filter(work => work.relation).map(work => work.workId),
      textIncluded: false,
      textSize: 0,
      textOnDevice: textBytes,
      lexicalIndexSize,
      semanticIndexSize: 0,
      totalDownloadSize: lexicalIndexSize,
      minimumAppVersion: MINIMUM_APP_VERSION,
      // The texts the index was built from are the app's own editions (checked per work: index.works[i][4]).
      dependencies: [{ id: 'core-index', normalizerVersion: NORMALIZER_VERSION, formatVersion: FORMAT_VERSION, stopTermsHash: stopHash }, { id: 'app-texts', editions: works.length }],
      createdAt: previous?.contentHash === contentHash ? previous.createdAt : new Date().toISOString(),
      index,
      files: files.map(({ data, ...file }) => file),
    };
    const manifestText = `${JSON.stringify(manifest, null, 1)}\n`;
    outputs.push([path, Buffer.from(manifestText)]);
    for (const file of files) outputs.push([`${PACKS_OUT}/${shelf.packId}/${file.path}`, file.data]);
    catalog.push({ packId: shelf.packId, displayName: manifest.displayName, family: shelf.family, title: shelf.title, version: manifest.version, contentHash, schemaVersion: PACK_SCHEMA_VERSION, rightsState: manifest.rightsState, works: works.length, documents: built.docCount, totalDownloadSize: lexicalIndexSize, manifestSha256: sha256(manifestText), createdAt: manifest.createdAt });
  }
  const catalogData = { schemaVersion: PACK_SCHEMA_VERSION, stopTermsHash: stopHash, normalizerVersion: NORMALIZER_VERSION, formatVersion: FORMAT_VERSION, packs: catalog };
  outputs.push([`${PACKS_OUT}/catalog.json`, Buffer.from(`${JSON.stringify(catalogData, null, 1)}\n`)]);
  const module = ['src/data/torah/packCatalog.mjs', `// Generated by scripts/torah/build-search-index.mjs — do not edit by hand.\n// The downloadable full-text packs this version of the app knows (sizes, versions, hashes). The app also reads the\n// same catalog online (torah-packs/catalog.json) to learn of a newer pack without an app update.\nexport default ${JSON.stringify(catalogData)};\n`];
  return { outputs, modules: [module], catalog: catalogData };
}
export { workById, familyOf };
