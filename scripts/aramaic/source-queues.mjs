// Review queues of the open-sources pass (analysis tooling, never shipped), from the trace of an analysis build:
//   docs/dictionary/review/onkelos-meturgeman-lookup.tsv — the 500 most frequent unresolved Onkelos forms, for a lookup
//     in Sefer Meturgeman (Isny 1541; scans only: HebrewBooks 6244, Google Books 9zVGAAAAYAAJ). Each row is a
//     SCAN_LOOKUP_PENDING slot: surface, count, class, the engine's candidate, and blank edition/page/entry/extract
//     columns for the human reader. Nothing of it enters the dictionary until a reviewer fills and approves it.
//   docs/dictionary/review/biblical-aramaic-oshb.tsv — every unresolved Daniel/Ezra form with the lemma OSHB's
//     annotators give it (morphhb + the oshb-lexicon index) and BDB's English (EVIDENCE_ONLY: never shown, never
//     translated automatically), beside the engine's own candidate.
// Run: node scripts/aramaic/source-queues.mjs --trace <dir>/trace.jsonl
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { ROOT } from './corpora.mjs';
import { normalizeLookupToken } from '../../src/services/wordLookup/normalize.mjs';

const args = process.argv.slice(2);
const TRACE = args.includes('--trace') ? args[args.indexOf('--trace') + 1] : '';
if (!TRACE) { console.error('usage: source-queues.mjs --trace <trace.jsonl>'); process.exit(1); }
const rows = readFileSync(TRACE, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
const unresolved = P => rows.filter(r => r.P === P && r.status === 'unresolved' && (r.cls?.ARAMAIC_LEXICAL || 0) > 0).sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1));
const reasonClass = r => (/^(REVIEW_GATE|RARE_UNREVIEWED)/.test(r.reason) ? 'GATED_CANDIDATE' : /^(AMBIGUOUS|HOMOGRAPH|D_UNKNOWN)/.test(r.reason) ? 'AMBIGUOUS' : /^NO_HEBREW_SENSE/.test(r.reason) ? 'LEXICAL_GAP (lemma known, no Hebrew)' : (r.cands || []).some(c => c.heb) ? 'MORPHOLOGY_GAP' : 'LEXICAL_GAP');

// Onkelos → Meturgeman lookup slots.
const onkelos = unresolved('T').slice(0, 500);
writeFileSync(join(ROOT, 'docs/dictionary/review/onkelos-meturgeman-lookup.tsv'), ['rank\tsurface\ttokens\tclass\tengine candidate (lemma / gloss / source)\tmeturgeman entry\textract\tedition\tpage\tscan id\tverification status',
  ...onkelos.map((r, i) => [i + 1, r.key, r.n, reasonClass(r), [r.lemma, r.candidate, r.sourceId].filter(Boolean).join(' / '), '', '', 'Isny 1541', '', 'HebrewBooks 6244', 'SCAN_LOOKUP_PENDING'].join('\t'))].join('\n') + '\n');

// Daniel/Ezra with OSHB's lemma and BDB's English (evidence).
const headOf = new Map(gunzipSync(readFileSync(join(ROOT, 'sources/oshb-lexicon/raw/aramaic-index.tsv.gz'))).toString('utf8').split('\n').filter(Boolean).map(line => { const [aug, id, head, pos, def] = line.split('\t'); return [aug, { id, head, pos, def }]; }));
const oshb = new Map();
for (const line of gunzipSync(readFileSync(join(ROOT, 'sources/morphhb/raw/words.tsv.gz'))).toString('utf8').split('\n')) {
  const [ref, surface, lemma, morph] = line.split('\t');
  if (!morph || morph[0] !== 'A') continue;
  const segs = (lemma || '').split('/').map(x => x.replace(/[+\s]/g, ''));
  const at = segs.findIndex(x => /\d/.test(x));
  const e = headOf.get(segs[at]);
  const key = normalizeLookupToken(surface.replace(/\//g, ''));
  if (!e || !key) continue;
  if (!oshb.has(key)) oshb.set(key, new Map());
  const k = `${e.head}\t${e.pos}\t${e.def}\t${morph}`;
  oshb.get(key).set(k, [...(oshb.get(key).get(k) || []), ref]);
}
const biblical = unresolved('B');
writeFileSync(join(ROOT, 'docs/dictionary/review/biblical-aramaic-oshb.tsv'), ['form\ttokens\tclass\tengine candidate (lemma / gloss / source)\tOSHB lemma\tpos\tBDB English (evidence only)\tmorph\trefs',
  ...biblical.flatMap(r => [...(oshb.get(r.key) || new Map([['\t\t\t', []]]))].map(([k, refs]) => [r.key, r.n, reasonClass(r), [r.lemma, r.candidate, r.sourceId].filter(Boolean).join(' / '), k, refs.slice(0, 3).join(' ')].join('\t')))].join('\n') + '\n');
console.log(`onkelos slots: ${onkelos.length}; biblical-aramaic forms: ${biblical.length} (${biblical.filter(r => oshb.has(r.key)).length} with an OSHB lemma)`);
