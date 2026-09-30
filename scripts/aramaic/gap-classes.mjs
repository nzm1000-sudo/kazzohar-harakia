// The unresolved Aramaic tokens of the app's texts, classified before any source lookup (the open-sources pass,
// Phase 1): MORPHOLOGY_GAP, LEXICAL_GAP, AMBIGUOUS, HEBREW (a form mostly Hebrew in that corpus), PROPER_NAME,
// TOKENIZER_ERROR — and, for each, what could close it: morphology, an open source already imported, Krupnik alone, a
// human gloss, or nothing (withheld). Analysis tooling, never shipped; reads the trace of an analysis build:
//   node scripts/dictionary/build-aramaic-engine.mjs --out <dir> --trace <dir>/trace.jsonl
//   node scripts/aramaic/gap-classes.mjs --trace <dir>/trace.jsonl [--kaikki <kaikki Aramaic jsonl>] [--panlex <tsv>]
//     [--list name=<headwords.txt>] [--out docs/dictionary/source-benchmarks/unresolved-classes]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { normalizeLookupToken } from '../../src/services/wordLookup/normalize.mjs';
import { PROFILES, PROFILE_IDS } from '../../src/services/wordLookup/aramaic/profiles.mjs';

const args = process.argv.slice(2);
const opt = name => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : '');
const TRACE = opt('trace');
const OUT = opt('out');
if (!TRACE) { console.error('usage: gap-classes.mjs --trace <trace.jsonl> [--kaikki f] [--panlex f] [--out prefix]'); process.exit(1); }

// Optional lemma lists of candidate sources (benchmarks only).
const keysOf = new Map();
if (opt('kaikki') && existsSync(opt('kaikki'))) {
  const set = new Set();
  for (const line of readFileSync(opt('kaikki'), 'utf8').split('\n')) {
    if (!line) continue;
    const e = JSON.parse(line);
    for (const w of [e.word, ...(e.forms || []).map(f => f.form)]) { const k = normalizeLookupToken(w || ''); if (k && k.length > 1) set.add(k); }
  }
  keysOf.set('kaikki', set);
}
// --list name=file: any other headword list (one word per line).
for (let i = 0; i < args.length; i += 1) if (args[i] === '--list') { const [name, file] = args[i + 1].split('='); if (existsSync(file)) keysOf.set(name, new Set(readFileSync(file, 'utf8').split('\n').map(w => normalizeLookupToken(w)).filter(k => k.length > 1))); }
if (opt('panlex') && existsSync(opt('panlex'))) keysOf.set('panlex', new Set(readFileSync(opt('panlex'), 'utf8').split('\n').slice(1).map(l => normalizeLookupToken(l.split('\t')[1] || '')).filter(Boolean)));

const OPEN = new Set(['jastrow-1903', 'he-wiktionary', 'grammar', 'reviewed']);
const CLASSES = ['MORPHOLOGY_GAP', 'LEXICAL_GAP', 'AMBIGUOUS', 'HEBREW', 'PROPER_NAME', 'TOKENIZER_ERROR'];
const BUCKETS = ['morphology (candidate from the grammar, withheld by the precision gate)', 'open sources (a Jastrow / Wiktionary / reviewed candidate, withheld by the gate)', 'Krupnik only (its candidate, withheld by the gate)', 'true lexical gap (no Hebrew gloss in any imported source)', 'ambiguous or Hebrew-majority (withheld)'];

function classify(r) {
  if (r.status === 'not-glossable') return { cls: (r.cls.PROPER_NAME || 0) > (r.cls.HEBREW || 0) ? 'PROPER_NAME' : 'HEBREW', bucket: 4 };
  if (r.status === 'excluded') return { cls: 'AMBIGUOUS', bucket: 4 };
  const reason = r.reason || '';
  if (r.key.length < 2 || /[^א-ת״׳]/.test(r.key)) return { cls: 'TOKENIZER_ERROR', bucket: 4 };
  if (/^(AMBIGUOUS|HOMOGRAPH|D_UNKNOWN_POS)/.test(reason)) return { cls: 'AMBIGUOUS', bucket: 4 };
  if (/^(REVIEW_GATE|RARE_UNREVIEWED)/.test(reason)) {
    const morph = r.candidateStrength !== 'exact' && r.candidateStrength !== 'alias' || /\/[a-z]+$/.test(reason.split(' ')[1] || '');
    const bucket = r.sourceId === 'krupnik-1927' ? 2 : OPEN.has(r.sourceId) ? (morph ? 0 : 1) : 1;
    return { cls: morph ? 'MORPHOLOGY_GAP' : 'LEXICAL_GAP', bucket };
  }
  if (/^NO_HEBREW_SENSE/.test(reason)) return { cls: 'LEXICAL_GAP', bucket: 3 };
  // NO_ANALYSIS: the loose candidates say whether a lemma with a Hebrew sense was near (a precision rule blocked it).
  const cands = r.cands || [];
  if (cands.some(c => c.heb)) return { cls: 'MORPHOLOGY_GAP', bucket: 0 };
  return { cls: 'LEXICAL_GAP', bucket: 3 };
}

const byProfile = {};
const examples = {};
for (const line of readFileSync(TRACE, 'utf8').split('\n')) {
  if (!line) continue;
  const r = JSON.parse(line);
  if (r.status === 'resolved') continue;
  const aram = (r.cls?.ARAMAIC_LEXICAL || 0);
  if (!aram) continue;
  const { cls, bucket } = classify(r);
  const p = (byProfile[r.P] ||= { tokens: 0, forms: 0, cls: {}, buckets: [0, 0, 0, 0, 0], sources: {} });
  p.tokens += aram; p.forms += 1;
  p.cls[cls] = (p.cls[cls] || 0) + aram;
  p.buckets[bucket] += aram;
  for (const [name, set] of keysOf) if (bucket === 3 && set.has(r.key)) p.sources[name] = (p.sources[name] || 0) + aram;
  const ex = ((examples[r.P] ||= {})[cls] ||= []);
  if (ex.length < 400) ex.push([r.key, aram, r.reason || r.status, r.candidate || '']);
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const lines = ['# Unresolved Aramaic tokens by class (open-sources pass, Phase 1)', '',
  `Trace: \`${TRACE.split('/').slice(-2).join('/')}\` (an analysis build of the current engine). A token counts when the classifier made it Aramaic (ARAMAIC_LEXICAL) and the engine leaves its form unresolved in that profile. Classes are decided before any source lookup (scripts/aramaic/gap-classes.mjs).`, '',
  `| PROFILE | UNRESOLVED ARAMAIC TOKENS | FORMS | ${CLASSES.join(' | ')} |`, `|---|---:|---:|${CLASSES.map(() => '---:').join('|')}|`];
const total = { tokens: 0, forms: 0, cls: {}, buckets: [0, 0, 0, 0, 0], sources: {} };
for (const P of PROFILE_IDS) {
  const p = byProfile[P];
  if (!p) continue;
  total.tokens += p.tokens; total.forms += p.forms;
  for (const c of CLASSES) total.cls[c] = (total.cls[c] || 0) + (p.cls[c] || 0);
  p.buckets.forEach((v, i) => { total.buckets[i] += v; });
  for (const [k, v] of Object.entries(p.sources)) total.sources[k] = (total.sources[k] || 0) + v;
  lines.push(`| ${PROFILES[P].name} | ${p.tokens} | ${p.forms} | ${CLASSES.map(c => `${p.cls[c] || 0} (${pct(p.cls[c] || 0, p.tokens)})`).join(' | ')} |`);
}
lines.push(`| **Total** | ${total.tokens} | ${total.forms} | ${CLASSES.map(c => `${total.cls[c] || 0} (${pct(total.cls[c] || 0, total.tokens)})`).join(' | ')} |`, '',
  '## What could close them (the key question)', '', `| PROFILE | ${BUCKETS.join(' | ')} |`, `|---|${BUCKETS.map(() => '---:').join('|')}|`);
for (const P of PROFILE_IDS) { const p = byProfile[P]; if (p) lines.push(`| ${PROFILES[P].name} | ${p.buckets.map(v => `${v} (${pct(v, p.tokens)})`).join(' | ')} |`); }
lines.push(`| **Total** | ${total.buckets.map(v => `${v} (${pct(v, total.tokens)})`).join(' | ')} |`, '');
if (keysOf.size) {
  lines.push('## Candidate lemma sources against the true lexical gaps', '', `| PROFILE | ${[...keysOf.keys()].join(' | ')} |`, `|---|${[...keysOf.keys()].map(() => '---:').join('|')}|`);
  for (const P of PROFILE_IDS) { const p = byProfile[P]; if (p) lines.push(`| ${PROFILES[P].name} | ${[...keysOf.keys()].map(k => `${p.sources[k] || 0} of ${p.buckets[3]}`).join(' | ')} |`); }
  lines.push('', '(Tokens of the true lexical gaps whose form the source lists as a word or a printed form: a lemma match, not a gloss.)', '');
}
lines.push('## The largest forms of each class', '');
for (const P of PROFILE_IDS) {
  if (!examples[P]) continue;
  lines.push(`### ${PROFILES[P].name}`, '');
  for (const c of CLASSES) { const ex = (examples[P][c] || []).sort((a, b) => b[1] - a[1]).slice(0, 15); if (ex.length) lines.push(`- **${c}**: ${ex.map(([k, n, why, cand]) => `${k} ${n}${cand ? ` («${cand}»)` : ''}`).join(', ')}`); }
  lines.push('');
}
const report = { trace: TRACE, total, byProfile };
if (OUT) { writeFileSync(`${OUT}.md`, lines.join('\n') + '\n'); writeFileSync(`${OUT}.json`, JSON.stringify(report, null, 1) + '\n'); }
else console.log(lines.join('\n'));
