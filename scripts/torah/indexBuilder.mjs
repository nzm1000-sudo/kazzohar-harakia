// One full-text index being built: documents in, term shards and a document table out. Shared by the built-in index
// (public/torah-index) and the downloadable shelf packs (public/torah-packs), so both have exactly one binary layout.
import { gzipSync } from 'node:zlib';
import { SHARD_COUNT, scanTokens, shardOf } from '../../src/services/torah/hebrew.mjs';
import { ByteWriter, bytesChecksum, encodeDocs, encodeShard, lengthBucket } from '../../src/services/torah/indexFormat.mjs';

// Function words present in more than 8% of all units (לא, על, הוא, של…) are not stored: they cannot narrow a search,
// and they cost 12% of the index. The built-in index decides the list; a pack uses the built-in list (never its own),
// so a word is a stop word everywhere or nowhere and a pack can be searched together with the built-in index.
export const STOP_DF_RATIO = 0.08;

export function createIndexBuilder() {
  const terms = new Map(); // term → { last, df, out }
  let docCount = 0;
  const lengths = new ByteWriter(1 << 20);
  const works = []; // manifest rows
  const docWorks = []; // { runs }
  let tokenTotal = 0;

  function addDocument(text) {
    const doc = docCount;
    docCount += 1;
    const tokens = scanTokens(text);
    tokenTotal += tokens.length;
    const seen = new Set();
    for (const { norm } of tokens) {
      if (norm.length < 2 || seen.has(norm)) continue;
      seen.add(norm);
      let entry = terms.get(norm);
      if (!entry) { entry = { last: 0, df: 0, out: new ByteWriter(8) }; terms.set(norm, entry); }
      entry.out.varint(doc - entry.last);
      entry.last = doc;
      entry.df += 1;
    }
    lengths.byte(lengthBucket(tokens.length));
    return doc;
  }

  function beginWork(row) {
    const runs = [];
    docWorks.push({ runs });
    works.push({ ...row, docs: 0, firstDoc: docCount });
    return (node, unit) => {
      if (node > 65535) throw new Error(`node ${node} beyond the document table in ${row.id}`);
      const last = runs.at(-1);
      if (last && last[0] === node) last[1].push(unit); else runs.push([node, [unit]]);
      works.at(-1).docs += 1;
    };
  }

  // → { stopTerms, files, outputs, docsGz, docsRaw, indexBytes, postings, docCount, tokenTotal, works, termCount }
  function finish({ stopTerms: fixedStop = null } = {}) {
    const stopTerms = fixedStop ? [...fixedStop].sort() : [...terms].filter(([, entry]) => entry.df > docCount * STOP_DF_RATIO).map(([term]) => term).sort();
    const stopSet = new Set(stopTerms);
    const shardTerms = Array.from({ length: SHARD_COUNT }, () => []);
    for (const [term, entry] of terms) if (!stopSet.has(term)) shardTerms[shardOf(term)].push([term, entry.df, entry.out.result()]);
    const files = [];
    const outputs = [];
    for (let s = 0; s < SHARD_COUNT; s += 1) {
      const list = shardTerms[s].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      const raw = encodeShard(list);
      const gz = gzipSync(raw, { level: 9 });
      const file = `s${String(s).padStart(3, '0')}.bin.gz`;
      files.push({ file, bytes: gz.length, raw: raw.length, checksum: bytesChecksum(raw), terms: list.length, gz });
      outputs.push([file, gz]);
    }
    const docsRaw = encodeDocs(docWorks, lengths.result());
    const docsGz = gzipSync(docsRaw, { level: 9 });
    outputs.push(['docs.bin.gz', docsGz]);
    const indexBytes = files.reduce((sum, file) => sum + file.bytes, 0) + docsGz.length;
    const postings = [...terms].reduce((sum, [term, entry]) => sum + (stopSet.has(term) ? 0 : entry.df), 0);
    return {
      stopTerms: stopTerms.map(term => [term, terms.get(term)?.df || 0]),
      files, outputs, docsGz, docsRaw, indexBytes, postings, docCount, tokenTotal, works, termCount: terms.size - stopTerms.filter(term => terms.has(term)).length,
    };
  }

  return { addDocument, beginWork, finish, get docCount() { return docCount; }, get works() { return works; } };
}
