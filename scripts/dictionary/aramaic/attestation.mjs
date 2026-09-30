// Corpus attestation for the Aramaic engine build: every word form of the app's texts, per profile, with its token
// count and its language class there (scripts/aramaic/classify.mjs). The build resolves forms that occur; the class
// decides where a form is Hebrew (never glossed there). Cached on disk between runs of the same inputs (the cache is a
// convenience of the developer's machine, keyed by the classifier version and every input file's size and mtime; it is
// never committed and the build's output does not depend on it).
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { CORPORA, corpusParagraphs, listPackWorks, LITURGY_MODULES, OTHER_MODULES, ROOT } from '../../aramaic/corpora.mjs';
import { createClassifier, corpusFrequency, isHebrewReferenceParagraph, CLASSIFIER_VERSION } from '../../aramaic/classify.mjs';
import { tokenizeLookup } from '../../../src/services/wordLookup/normalize.mjs';
import { profileOfCorpus } from '../../../src/services/wordLookup/aramaic/profiles.mjs';

function inputsHash() {
  const h = createHash('sha256').update(`classifier:${CLASSIFIER_VERSION}`);
  const files = [...listPackWorks().map(w => w.file), ...LITURGY_MODULES, ...OTHER_MODULES, 'scripts/aramaic/classify.mjs', 'scripts/aramaic/names.mjs', 'scripts/aramaic/corpora.mjs', 'sources/jastrow/raw/entries.jsonl.gz', 'sources/morphhb/raw/words.tsv.gz'];
  for (const f of files) { try { const s = statSync(join(ROOT, f)); h.update(`${f}:${s.size}:${s.mtimeMs}`); } catch { h.update(`${f}:missing`); } }
  return h.digest('hex').slice(0, 16);
}

// Returns { forms: Map(key → { P: { n, cls: { CLASS: n } } }), classifier, corpusFreq: Map(corpusId → C), bigrams }
export async function attestation({ phraseFirst = new Set(), cacheDir = join(tmpdir(), 'kazzohar-aramaic-cache') } = {}) {
  const hash = createHash('sha256').update(inputsHash()).update([...phraseFirst].sort().join(',')).digest('hex').slice(0, 16);
  const cacheFile = join(cacheDir, `attestation-${hash}.json.gz`);
  const classifier = await createClassifier();
  const corpusFreq = new Map();
  if (existsSync(cacheFile)) {
    const data = JSON.parse(gunzipSync(readFileSync(cacheFile)).toString('utf8'));
    for (const [id, counts, total] of data.corpusFreq) corpusFreq.set(id, { id, counts: new Map(counts), total });
    return { forms: new Map(data.forms), classifier, corpusFreq, sequences: new Map(data.sequences) };
  }
  const forms = new Map();
  const sequences = new Map(); // "w1 w2" / "w1 w2 w3" (keys) → { P: n } — for the phrase layer
  for (const corpus of CORPORA.filter(c => c.role !== 'hebrew-reference')) {
    const C = await corpusFrequency(corpus.id);
    corpusFreq.set(corpus.id, C);
    const P = profileOfCorpus(corpus.id);
    for await (const para of corpusParagraphs(corpus.id)) {
      if (isHebrewReferenceParagraph(para)) continue;
      const tokens = tokenizeLookup(para.text);
      for (let i = 0; i < tokens.length; i += 1) {
        const key = tokens[i].key;
        const cls = classifier.classifyToken(key, tokens[i - 1]?.key, tokens[i + 1]?.key, C, para.ref);
        let f = forms.get(key);
        if (!f) { f = {}; forms.set(key, f); }
        const p = (f[P] ||= { n: 0, cls: {} });
        p.n += 1;
        p.cls[cls] = (p.cls[cls] || 0) + 1;
        if (phraseFirst.has(key) && i + 1 < tokens.length) for (const len of [2, 3, 4]) {
          if (i + len > tokens.length) break;
          const seq = tokens.slice(i, i + len).map(t => t.key).join(' ');
          const s = sequences.get(seq) || {};
          s[P] = (s[P] || 0) + 1;
          sequences.set(seq, s);
        }
      }
    }
  }
  // Only sequences that occur twice or more are kept (the phrase layer needs attested phrases only).
  for (const [seq, s] of sequences) if (Object.values(s).reduce((a, b) => a + b, 0) < 2) sequences.delete(seq);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cacheFile, gzipSync(JSON.stringify({ forms: [...forms], sequences: [...sequences], corpusFreq: [...corpusFreq].map(([id, C]) => [id, [...C.counts], C.total]) })));
  return { forms, classifier, corpusFreq, sequences };
}
