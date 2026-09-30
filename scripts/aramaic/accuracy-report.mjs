// The accuracy report of an independent stratified sample (pass 2). Joins the sample the audit drew
// (audit-coverage.mjs --fresh <seed> <file>), the reviewer's judgments and the build trace (build-aramaic-engine.mjs
// --trace <file>: the lemma, source and path of every form per profile), and writes the per-item table and the totals.
//
// Run: node scripts/aramaic/accuracy-report.mjs <sample.json> <judgments.json> <trace.jsonl> <out.tsv> [label]
//   judgments: { corpusId: { groups: { "key|gloss": reason }, items: { index: reason } } } — every item not listed is
//   judged correct (the reviewer read every item; a group judgment covers the identical key and gloss).
// Prints the per-stratum and total accuracy as JSON (the caller writes docs/dictionary/current-accuracy.md).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { profileOfCorpus } from '../../src/services/wordLookup/aramaic/profiles.mjs';
import { normalizeLookupToken } from '../../src/services/wordLookup/normalize.mjs';

// A judgment key "form|gloss" is compared normalized (the form as the lookup keys it, the gloss without points).
const unpoint = text => String(text).replace(/[\u0591-\u05C7]/g, '');
const groupKey = (form, gloss) => `${normalizeLookupToken(form)}|${unpoint(gloss)}`;

export const STRATA = Object.freeze([
  ['Bavli', ['bavli']],
  ['Zohar + Tikkunei', ['zohar', 'zohar-chadash', 'tikkunei-zohar']],
  ['Onkelos/Targum', ['onkelos']],
  ['Yerushalmi', ['yerushalmi']],
  ['Biblical Aramaic', ['biblical-aramaic']],
  ['Siddur/Midrash/mixed', ['liturgy', 'midrash', 'talmud-commentary', 'other-commentary']],
]);

export function accuracyReport({ sample, judgments, trace }) {
  const byKey = new Map();
  for (const row of trace) if (row.status === 'resolved') byKey.set(`${row.key}\t${row.P}`, row);
  const rows = [];
  const unmatched = [];
  const perCorpus = {};
  for (const [corpus, items] of Object.entries(sample.samples)) {
    const j0 = judgments[corpus] || { groups: {}, items: {} };
    const j = { items: j0.items || {}, groups: Object.fromEntries(Object.entries(j0.groups || {}).map(([k, v]) => { const [f, ...g] = k.split('|'); return [groupKey(f, g.join('|')), v]; })) };
    const usedGroups = new Set();
    const P = profileOfCorpus(corpus);
    let wrong = 0;
    items.forEach((x, i) => {
      const g = groupKey(x.key, x.gloss);
      const reason = j.items?.[i] ?? j.groups?.[g] ?? null;
      if (j.groups?.[g]) usedGroups.add(g);
      if (reason) wrong += 1;
      const t = byKey.get(`${x.key}\t${P}`);
      const lemma = x.path === 'phrase' ? `phrase` : x.path === 'abbreviation' ? 'abbreviation' : t ? t.lemma : x.path.startsWith('fallback') ? '(runtime fallback)' : '';
      const source = x.path === 'phrase' || x.path === 'abbreviation' ? (x.sources || []).join('+') : t ? `${t.sourceId}${t.kind ? `:${t.kind}` : ''}` : (x.sources || []).join('+');
      rows.push([corpus, i, x.form, x.ref, lemma, x.gloss, x.path, source, reason ? 'incorrect' : 'correct', reason || '', x.context.replace(/\t/g, ' ')]);
    });
    for (const g of Object.keys(j.groups || {})) if (!usedGroups.has(g)) unmatched.push(`${corpus}: ${g}`);
    perCorpus[corpus] = { n: items.length, correct: items.length - wrong };
  }
  const strata = STRATA.map(([name, ids]) => { const n = ids.reduce((s, id) => s + (perCorpus[id]?.n || 0), 0); const c = ids.reduce((s, id) => s + (perCorpus[id]?.correct || 0), 0); return { name, n, correct: c, accuracy: n ? +(c / n).toFixed(4) : null }; });
  const n = strata.reduce((s, x) => s + x.n, 0);
  const correct = strata.reduce((s, x) => s + x.correct, 0);
  return { rows, unmatched, perCorpus, strata, total: { n, correct, accuracy: +(correct / n).toFixed(4) } };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [samplePath, judgmentsPath, tracePath, outPath] = process.argv.slice(2);
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));
  const judgments = JSON.parse(readFileSync(judgmentsPath, 'utf8'));
  const trace = readFileSync(tracePath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const r = accuracyReport({ sample, judgments, trace });
  const header = ['corpus', 'item', 'surface', 'reference', 'resolved lemma', 'display gloss', 'resolution path', 'source', 'judgment', 'reason if incorrect', 'context'];
  writeFileSync(outPath, [header, ...r.rows].map(row => row.join('\t')).join('\n') + '\n');
  if (r.unmatched.length) console.error(`judgments that matched no item:\n  ${r.unmatched.join('\n  ')}`);
  console.log(JSON.stringify({ seed: sample.seed, strata: r.strata, total: r.total }, null, 1));
}
