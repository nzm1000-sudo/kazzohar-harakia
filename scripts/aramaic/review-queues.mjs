// The human-review queues of the Aramaic engine (pass 2): the unresolved Aramaic forms of each dialect, frequency-
// prioritized (never alphabetical), in tiers — top 100 / 500 / 1,000 / long tail — with the evidence a reviewer needs.
// Build time only; nothing here reaches the app.
//
// Run: node scripts/aramaic/review-queues.mjs <trace.jsonl> [--out docs/dictionary/review]
//   (the trace of the shipped build: build-aramaic-engine.mjs --trace <file>; its .lemmas.json beside it)
// Writes <out>/{bavli,zohar,tikkunei-zohar,onkelos,yerushalmi,biblical-aramaic,siddur-aramaic,midrash-mixed}-top-unresolved.tsv,
// <out>/coverage-gain-by-batch.md, and the Zohar's own files zohar-frequency.tsv, zohar-unresolved.tsv, zohar-phrases.tsv.
//
// Every row is a CANDIDATE, never a published gloss: the "suggested gloss" column is filled only where the engine has a
// complete deterministic analysis (a dictionary sense of the lemma, fitted to the form by the grammar tables) that the
// review gate held back — status REVIEW — and it is empty everywhere else. Nothing here is written by a model: the
// evidence columns quote the sources (Krupnik's Hebrew senses, Jastrow's English, printed as he prints it).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, corpusParagraphs } from './corpora.mjs';
import { analyse, BUCKETS } from './ceiling-analysis.mjs';
import { tokenizeLookup, normalizeLookupToken } from '../../src/services/wordLookup/normalize.mjs';
import * as REVIEWED from '../../src/data/dictionary/reviewedAramaic.mjs';

export const QUEUES = Object.freeze([
  { file: 'bavli', title: 'Bavli', profile: 'J', corpora: ['bavli'] },
  { file: 'zohar', title: 'Zohar (and Zohar Chadash)', profile: 'Z', corpora: ['zohar', 'zohar-chadash'] },
  { file: 'tikkunei-zohar', title: 'Tikkunei Zohar', profile: 'Z', corpora: ['tikkunei-zohar'] },
  { file: 'onkelos', title: 'Onkelos', profile: 'T', corpora: ['onkelos'] },
  { file: 'yerushalmi', title: 'Yerushalmi', profile: 'Y', corpora: ['yerushalmi'] },
  { file: 'biblical-aramaic', title: 'Biblical Aramaic (Daniel, Ezra)', profile: 'B', corpora: ['biblical-aramaic'] },
  { file: 'siddur-aramaic', title: 'Siddur and liturgy', profile: 'L', corpora: ['liturgy'] },
  { file: 'midrash-mixed', title: 'Midrash and the commentaries / later works', profile: ['M', 'X'], corpora: ['midrash', 'talmud-commentary', 'other-commentary', 'minor-tractates'] },
]);
// The buckets a reviewer can act on (not Hebrew, not a name).
const QUEUED = new Set(['REVIEW_CANDIDATE', 'MORPHOLOGY', 'MISSING_HEBREW_GLOSS', 'SENSE_CHOICE', 'EXCLUDED_REVIEW', 'FOREIGN_LOAN', 'TOKENIZER', 'TRUE_LEXICAL_GAP']);
// The measured error rate of an unreviewed analysis by its class (the first independent sample of pass 2,
// docs/dictionary/current-accuracy.md) — the confidence of a REVIEW candidate.
const CONFIDENCE = { exact: 'medium (~80% right in the sample)', alias: 'low (~67%)', 'source-form': 'low (~74%)', generated: 'low (~58%)', 'generated-noun': 'low (~60%)', irregular: 'medium (~85%)', pronominal: 'high (~94%)', 'reviewed-base': 'medium (not yet sampled)' };
const REASON_TEXT = {
  REVIEW_CANDIDATE: 'complete analysis below the review gate (fewer than 200 uses here)',
  MORPHOLOGY: 'a known lemma with a Hebrew sense is reachable, but a precision rule blocks the analysis',
  MISSING_HEBREW_GLOSS: 'the dictionaries have the word, but no Hebrew sense (English only / Krupnik without Hebrew)',
  SENSE_CHOICE: 'several Hebrew senses (or two lemmas) — a reviewer must choose',
  EXCLUDED_REVIEW: 'excluded by review: the source gloss is wrong here',
  FOREIGN_LOAN: 'a Greek/Latin/Persian loanword with no Hebrew sense',
  TOKENIZER: 'probably two words run together or a stray letter sequence',
  TRUE_LEXICAL_GAP: 'no lexicon entry the form could belong to',
};
const clean = text => String(text || '').replace(/[\t\n]/g, ' ').trim();
const tierOf = rank => (rank <= 100 ? 'top-100' : rank <= 500 ? 'top-500' : rank <= 1000 ? 'top-1000' : 'long-tail');

export async function buildQueues(trace, lemmas) {
  const result = analyse(trace);
  // Candidate forms per queue (the unresolved Aramaic forms of its profile), their occurrences per corpus and first refs.
  const wanted = new Set();
  for (const q of QUEUES) for (const P of [].concat(q.profile)) for (const u of result[P].unresolved) if (QUEUED.has(u.bucket)) wanted.add(u.key);
  const counts = new Map(); // corpus → Map(key → { n, refs })
  for (const corpus of new Set(QUEUES.flatMap(q => q.corpora))) {
    const m = new Map();
    for await (const para of corpusParagraphs(corpus)) for (const t of tokenizeLookup(para.text)) {
      if (!wanted.has(t.key)) continue;
      const e = m.get(t.key) || { n: 0, refs: [] };
      e.n += 1;
      if (e.refs.length < 3 && !e.refs.includes(para.ref)) e.refs.push(para.ref);
      m.set(t.key, e);
    }
    counts.set(corpus, m);
  }
  const queues = {};
  for (const q of QUEUES) {
    const profiles = [].concat(q.profile);
    const all = profiles.flatMap(P => result[P].unresolved.map(u => ({ ...u, P })));
    const profileTokens = profiles.reduce((s, P) => s + result[P].tokens, 0);
    const profileResolved = profiles.reduce((s, P) => s + result[P].buckets.RESOLVED.tokens, 0);
    // The share of a profile's corpora that belongs to this queue (Tikkunei out of the three Zohar corpora).
    const inQueue = key => q.corpora.reduce((s, c) => s + (counts.get(c)?.get(key)?.n || 0), 0);
    const inProfile = key => (q.profile === 'Z' ? ['zohar', 'zohar-chadash', 'tikkunei-zohar'] : q.corpora).reduce((s, c) => s + (counts.get(c)?.get(key)?.n || 0), 0);
    const rows = [];
    const merged = new Map();
    for (const u of all) {
      if (!QUEUED.has(u.bucket)) continue;
      const share = q.profile === 'Z' ? (inProfile(u.key) ? inQueue(u.key) / inProfile(u.key) : 0) : 1;
      const tokens = Math.round(u.tokens * share);
      if (!tokens) continue;
      const m = merged.get(u.key);
      if (m) { m.tokens += tokens; continue; }
      merged.set(u.key, { ...u, tokens });
    }
    const sorted = [...merged.values()].sort((a, b) => b.tokens - a.tokens || (a.key < b.key ? -1 : 1));
    // Denominators: the queue's Aramaic tokens (for the Zohar split, the Zohar corpora's share by raw tokens).
    let total = profileTokens;
    let resolvedNow = profileResolved;
    if (q.profile === 'Z') { // (the Aramaic tokens of zohar, zohar-chadash, tikkunei-zohar in the coverage audit)
      const share = q.file === 'tikkunei-zohar' ? 66933 / (464266 + 98674 + 66933) : (464266 + 98674) / (464266 + 98674 + 66933); total = Math.round(total * share); resolvedNow = Math.round(resolvedNow * share); }
    sorted.forEach((u, i) => {
      const lemma = u.lemma || '';
      const lemmaKeys = [...new Set([lemma, ...(u.cands || '').split(' ').map(c => c.replace(/^[a-z]+\+/, '').replace(/\(.*$/, '')).filter(Boolean)])].filter(k => k && !k.startsWith('pron:') && !k.startsWith('rev:'));
      const facts = lemmaKeys.map(k => [k, lemmas[k]]).filter(([, f]) => f);
      const hebrewSenses = facts.map(([k, f]) => `${k}: ${f.senses.filter(s => s[0]).map(s => `${s[0]} [${s[1].split('-')[0]}]`).join(' | ')}`).filter(x => !/: $/.test(x)).join(' ;; ');
      const english = facts.map(([k, f]) => (f.en ? `${k}: ${f.en}` : '')).filter(Boolean).join(' ;; ').slice(0, 400);
      const refs = q.corpora.flatMap(c => counts.get(c)?.get(u.key)?.refs || []).slice(0, 3).join(' ');
      const suggestion = u.bucket === 'REVIEW_CANDIDATE' ? (u.candidate || '') : '';
      const strength = u.candidateStrength || '';
      rows.push({
        rank: i + 1, tier: tierOf(i + 1), form: u.key, frequency: u.tokens, refs, dialect: `${q.title} (${u.P})`,
        candidates: clean(lemmaKeys.join(' ')), reasonCode: u.bucket, reason: `${REASON_TEXT[u.bucket]} — ${clean(u.reason)}`,
        evidence: clean(hebrewSenses).slice(0, 300) || '—', jastrow: clean(english).slice(0, 240) || '—', arukh: 'not available (no open digital HeArukh/Meturgeman text)',
        suggested: clean(suggestion), status: suggestion ? 'REVIEW' : '', confidence: suggestion ? CONFIDENCE[strength] || 'low' : '—', needsReview: 'yes',
      });
    });
    queues[q.file] = { q, rows, total, resolvedNow };
  }
  return { queues, result };
}

const HEADER = ['rank', 'tier', 'surface form', 'frequency (unresolved Aramaic tokens)', '3 representative refs', 'dialect/corpus', 'candidate lemma(s)', 'reason code', 'reason unresolved', 'open-source evidence (Hebrew senses: k=Krupnik j=Jastrow h=Wiktionary r=reviewed)', 'Jastrow entry (PD English, as printed)', 'HeArukh/Meturgeman evidence', 'suggested SHORT Hebrew gloss (only a complete deterministic analysis)', 'status', 'confidence', 'needs human review'];
// A queue file holds its first MAX_ROWS forms (the three tiers and the head of the long tail); the gain table counts all.
export const MAX_ROWS = 3000;
const tsv = rows => [HEADER, ...rows.slice(0, MAX_ROWS).map(r => [r.rank, r.tier, r.form, r.frequency, r.refs, r.dialect, r.candidates, r.reasonCode, r.reason, r.evidence, r.jastrow, r.arukh, r.suggested, r.status, r.confidence, r.needsReview])].map(row => row.join('\t')).join('\n') + '\n';

export function gainTable(queues) {
  const pct = (a, b) => `${((100 * a) / b).toFixed(1)}%`;
  const lines = ['# Coverage gain by review batch', '', 'Generated by `scripts/aramaic/review-queues.mjs` from the build trace of the shipped engine. Per dialect queue: the Aramaic tokens, the share glossed now, and the token coverage if the top N forms of its queue (docs/dictionary/review/*-top-unresolved.tsv, frequency order) were reviewed and every one of their tokens glossed — an upper bound (a reviewer may reject a candidate, or give a form two readings).', '',
    '| QUEUE | ARAMAIC TOKENS | NOW | +TOP 50 | +TOP 100 | +TOP 250 | +TOP 500 | +TOP 1,000 | FORMS IN QUEUE | OF THEM WITH A REVIEW CANDIDATE |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [file, { q, rows, total, resolvedNow }] of Object.entries(queues)) {
    const at = n => pct(resolvedNow + rows.slice(0, n).reduce((s, r) => s + r.frequency, 0), total);
    lines.push(`| ${q.title} (${file}) | ${total} | ${pct(resolvedNow, total)} | ${at(50)} | ${at(100)} | ${at(250)} | ${at(500)} | ${at(1000)} | ${rows.length} | ${rows.filter(r => r.status).length} |`);
  }
  lines.push('', '## The first batch per queue (top 100)', '', '| QUEUE | FORMS | TOKEN OCCURRENCES | PROJECTED GAIN | OF THEM: REVIEW CANDIDATES (confirm/reject) | TOKENS OF THE CANDIDATES |', '|---|---:|---:|---:|---:|---:|');
  for (const [file, { rows, total }] of Object.entries(queues)) {
    const top = rows.slice(0, 100);
    const tok = top.reduce((s, r) => s + r.frequency, 0);
    const cand = top.filter(r => r.status);
    lines.push(`| ${file} | ${top.length} | ${tok} | +${pct(tok, total)} | ${cand.length} | ${cand.reduce((s, r) => s + r.frequency, 0)} |`);
  }
  return lines.join('\n') + '\n';
}

let TRACE_PATH = '';
// The Zohar's frequent word sequences (its formulas: תא חזי, רזא דמלה, הדא הוא דכתיב), with the lookup's state of each word.
async function zoharPhrases(trace) {
  const state = new Map();
  for (const r of trace) if (r.P === 'Z') state.set(r.key, r.status === 'resolved' ? r.text : r.status === 'not-glossable' ? '(Hebrew or a name here — nothing to gloss)' : `— (${String(r.reason || r.status).split(' ')[0]})`);
  const phrasesPath = TRACE_PATH.replace(/\.jsonl$/, '') + '.phrases.json';
  const phrases = existsSync(phrasesPath) ? JSON.parse(readFileSync(phrasesPath, 'utf8')).filter(p => p.gloss && p.profiles.includes('Z')) : [];
  const phraseGloss = k => phrases.filter(p => k.includes(p.words.join(' '))).map(p => `${p.words.join(' ')} = ${p.gloss}`).join(' ; ');
  const grams = new Map();
  for (const corpus of ['zohar', 'zohar-chadash', 'tikkunei-zohar']) for await (const para of corpusParagraphs(corpus)) {
    const keys = tokenizeLookup(para.text).map(t => t.key);
    for (let i = 0; i < keys.length; i += 1) for (const len of [2, 3]) {
      if (i + len > keys.length) break;
      const g = keys.slice(i, i + len);
      if (g.some(k => k.length < 2 || /[״׳]/.test(k))) continue;
      const k = g.join(' ');
      grams.set(k, (grams.get(k) || 0) + 1);
    }
  }
  const top = [...grams].filter(([, n]) => n >= 150).sort((a, b) => b[1] - a[1]).slice(0, 400);
  const rows = [['rank', 'formula', 'occurrences', 'each word as the lookup glosses it now', 'the phrase layer (in context)', 'every word glossed or Hebrew', 'plain Hebrew needed (review)']];
  top.forEach(([k, n], i) => {
    const words = k.split(' ');
    const glosses = words.map(w => `${w}=${state.get(w) ?? '— (Hebrew/name here)'}`);
    const ok = words.every(w => state.get(w) && !String(state.get(w)).startsWith('—'));
    rows.push([i + 1, k, n, glosses.join(' | '), phraseGloss(k) || '—', ok ? 'yes' : 'no', ok || phraseGloss(k) ? '' : 'yes: ' + words.filter(w => String(state.get(w) ?? '—').startsWith('—')).join(' ')]);
  });
  return rows.map(r => r.join('\t')).join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const tracePath = args[0];
  TRACE_PATH = tracePath;
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : join(ROOT, 'docs/dictionary/review');
  const trace = readFileSync(tracePath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const lemmasPath = tracePath.replace(/\.jsonl$/, '') + '.lemmas.json';
  const lemmas = existsSync(lemmasPath) ? JSON.parse(readFileSync(lemmasPath, 'utf8')) : {};
  const { queues } = await buildQueues(trace, lemmas);
  mkdirSync(out, { recursive: true });
  for (const [file, { rows }] of Object.entries(queues)) writeFileSync(join(out, `${file}-top-unresolved.tsv`), tsv(rows));
  writeFileSync(join(out, 'coverage-gain-by-batch.md'), gainTable(queues));
  // The Zohar's own files.
  const zRows = trace.filter(r => r.P === 'Z' && (r.cls?.ARAMAIC_LEXICAL || 0) > 0).sort((a, b) => (b.cls.ARAMAIC_LEXICAL - a.cls.ARAMAIC_LEXICAL) || (a.key < b.key ? -1 : 1)).slice(0, 3000);
  writeFileSync(join(out, 'zohar-frequency.tsv'), [['rank', 'form', 'Aramaic tokens (Zohar, Zohar Chadash, Tikkunei)', 'status', 'gloss now', 'analysis or reason'].join('\t'), ...zRows.map((r, i) => [i + 1, r.key, r.cls.ARAMAIC_LEXICAL, r.status, r.status === 'resolved' ? r.text : '', clean(r.status === 'resolved' ? `${r.lemma}/${r.tag || '-'}/${r.codes || '-'}/${r.strength}/${r.via}` : r.reason || r.status)].join('\t'))].join('\n') + '\n');
  const zq = [...queues.zohar.rows, ...queues['tikkunei-zohar'].rows];
  const byForm = new Map();
  for (const r of zq) { const m = byForm.get(r.form); if (m) m.frequency += r.frequency; else byForm.set(r.form, { ...r }); }
  writeFileSync(join(out, 'zohar-unresolved.tsv'), tsv([...byForm.values()].sort((a, b) => b.frequency - a.frequency).map((r, i) => ({ ...r, rank: i + 1, tier: tierOf(i + 1) }))));
  writeFileSync(join(out, 'zohar-phrases.tsv'), await zoharPhrases(trace));
  // The pass-1 review was the agent's (each entry cites its source basis), not a human's: every reviewed Hebrew gloss
  // in production, most used first, for a human reviewer to confirm, correct or remove.
  const uses = new Map();
  for (const r of trace) uses.set(r.key, (uses.get(r.key) || 0) + (r.cls?.ARAMAIC_LEXICAL || 0));
  const agent = [
    ...REVIEWED.FORM_GLOSSES.map(([f, g, p, b]) => ['FORM_GLOSS', f, g, (p || ['all']).join(' '), b]),
    ...REVIEWED.LEMMA_GLOSSES.map(([f, g, pos, b]) => ['LEMMA_GLOSS', f, g, 'all', `${pos || ''} ${b}`]),
    ...REVIEWED.STEM_GLOSSES.map(([f, stem, g, b]) => ['STEM_GLOSS', `${f} (${stem})`, g, 'all', b]),
    ...REVIEWED.SENSE_CHOICES.map(([f, g, p, b]) => ['SENSE_CHOICE (a source sense chosen)', f, [].concat(g).join(' · '), (p || ['all']).join(' '), b]),
  ].map(row => [uses.get(normalizeLookupToken(String(row[1]).split(' ')[0])) || 0, ...row]).sort((a, b) => b[0] - a[0]);
  writeFileSync(join(out, 'agent-reviewed-glosses.tsv'), [['Aramaic tokens (all corpora)', 'kind', 'form / lemma', 'gloss in production', 'profiles', 'basis recorded', 'human decision (confirm / correct / remove)'].join('\t'), ...agent.map(r => [...r.map(clean), ''].join('\t'))].join('\n') + '\n');
  for (const [file, { rows, total, resolvedNow }] of Object.entries(queues)) console.log(file, rows.length, 'forms', total, 'tokens', (100 * resolvedNow / total).toFixed(1) + '%');
}
