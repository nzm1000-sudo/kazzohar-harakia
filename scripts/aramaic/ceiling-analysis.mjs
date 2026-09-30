// The coverage-ceiling analysis of the Aramaic engine (pass 2): where the unresolved Aramaic tokens of each dialect
// profile go, by reason code, from the build trace (build-aramaic-engine.mjs --trace <file>). Build time only.
//
// Run: node scripts/aramaic/ceiling-analysis.mjs <trace.jsonl> [--md docs/dictionary/ceiling-analysis.md] [--zohar docs/dictionary/review]
//
// Every Aramaic token (classifier class ARAMAIC_LEXICAL) of a profile's corpora falls in exactly one bucket:
//   RESOLVED                  glossed by the build
//   REVIEW_CANDIDATE          (pass 2) the build has a complete analysis — a lemma, its sense, the Hebrew rendering — but
//                             the form is below the review gate: a candidate for the human review queue
//   MORPHOLOGY                a known lemma with a Hebrew sense is reachable (proclitics, a printed or generated form,
//                             a spelling) but the form is not glossed: a precision rule, a rare form, or a review gate
//   MISSING_HEBREW_GLOSS      the dictionary has the entry (Jastrow's English, Krupnik without Hebrew) but no Hebrew
//   SENSE_CHOICE              the entry has several Hebrew senses (or two lemmas tie): a reviewer must choose
//   HEBREW_EMBEDDED           the form is Hebrew in this corpus (the majority of its tokens) or excluded as Hebrew
//   PROPER_NAME               the form is a name in this corpus (majority), or excluded as a name
//   EXCLUDED_REVIEW           excluded by the review (a wrong or unsafe gloss)
//   FOREIGN_LOAN              no Hebrew sense, and Jastrow marks the word as Greek, Latin or Persian
//   TOKENIZER                 a token the tokenizer made (two words run together, a stray letter sequence) — heuristic
//   TRUE_LEXICAL_GAP          no lexicon entry the form could belong to
// PHRASE_BOUND (a word of a published phrase, glossed only inside it) is reported beside the buckets.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './corpora.mjs';
import { PROFILES, PROFILE_IDS } from '../../src/services/wordLookup/aramaic/profiles.mjs';
import { normalizeLookupToken } from '../../src/services/wordLookup/normalize.mjs';
import { EXCLUDED_FORMS } from '../../src/data/dictionary/reviewedAramaic.mjs';

// The kind of a review exclusion, from its recorded reason: Hebrew, a name, or another reason (a wrong gloss).
const EXCLUSION_KINDS = new Map(EXCLUDED_FORMS.map(([key, why]) => [normalizeLookupToken(key), /^(a name|part of a name|mostly the name)/.test(why) ? 'name' : /^Hebrew/.test(why) ? 'hebrew' : 'other']));

export const BUCKETS = Object.freeze(['RESOLVED', 'REVIEW_CANDIDATE', 'MORPHOLOGY', 'MISSING_HEBREW_GLOSS', 'SENSE_CHOICE', 'HEBREW_EMBEDDED', 'PROPER_NAME', 'EXCLUDED_REVIEW', 'FOREIGN_LOAN', 'TOKENIZER', 'TRUE_LEXICAL_GAP']);
// The owner's grouping: recoverable by deterministic morphology/tokenization/normalization · needs a new lemma or
// gloss (a lexical decision) · not an Aramaic word to gloss (Hebrew, a name, noise).
export const GROUPING = Object.freeze({ REVIEW_CANDIDATE: 'candidate', MORPHOLOGY: 'deterministic', TOKENIZER: 'deterministic', MISSING_HEBREW_GLOSS: 'lexical', SENSE_CHOICE: 'lexical', FOREIGN_LOAN: 'lexical', TRUE_LEXICAL_GAP: 'lexical', HEBREW_EMBEDDED: 'not-aramaic', PROPER_NAME: 'not-aramaic', EXCLUDED_REVIEW: 'lexical' });

function loanKeys() {
  const path = join(ROOT, 'sources/jastrow/raw/entries.jsonl.gz');
  const keys = new Set();
  if (!existsSync(path)) return keys;
  for (const line of gunzipSync(readFileSync(path)).toString('utf8').split('\n')) {
    if (!line) continue;
    const e = JSON.parse(line);
    const head = e.text.join(' ').slice(0, 400);
    if (/[Ͱ-Ͽ]/.test(head) || /\b(Lat|Pers|Gr)\.\s/.test(head)) keys.add(normalizeLookupToken(e.ref.replace(/^Jastrow, /, '').replace(/[²³⁴⁵⁶⁷⁸⁹¹⁰*]|\s+(I{1,3}|IV|V)$/g, '')));
  }
  return keys;
}

// A token the tokenizer probably made: very long (two words run together) with no candidate at all, or a sequence
// no Aramaic or Hebrew word has (the same letter three times running).
const tokenizerAnomaly = (key, row) => (key.length >= 11 && !(row.cands || []).length) || /(.)\1\1/.test(key);

export function bucketOf(row, loans, exclusionKind) {
  if (row.status === 'resolved') return 'RESOLVED';
  if (row.status === 'not-glossable') {
    const c = row.cls;
    return (c.PROPER_NAME || 0) >= (c.HEBREW || 0) ? 'PROPER_NAME' : 'HEBREW_EMBEDDED';
  }
  if (row.status === 'excluded') { const kind = exclusionKind(row.key); return kind === 'hebrew' ? 'HEBREW_EMBEDDED' : kind === 'name' ? 'PROPER_NAME' : 'EXCLUDED_REVIEW'; }
  const reason = String(row.reason || '').split(' ')[0];
  const cands = row.cands || [];
  if (reason === 'REVIEW_GATE') return 'REVIEW_CANDIDATE';
  if (reason === 'RARE_UNREVIEWED' || reason === 'D_UNKNOWN_POS') return 'MORPHOLOGY';
  if (reason === 'AMBIGUOUS_SENSE' || reason === 'AMBIGUOUS' || reason === 'HOMOGRAPH') return 'SENSE_CHOICE';
  if (reason === 'NO_HEBREW_SENSE') return loans.has(row.lemma) ? 'FOREIGN_LOAN' : 'MISSING_HEBREW_GLOSS';
  if (cands.some(c => c.heb)) return 'MORPHOLOGY';
  if (tokenizerAnomaly(row.key, row)) return 'TOKENIZER';
  if (cands.some(c => loans.has(c.lemma)) || loans.has(row.key)) return 'FOREIGN_LOAN';
  if (cands.length) return 'MISSING_HEBREW_GLOSS';
  return 'TRUE_LEXICAL_GAP';
}

export function analyse(trace, { phrases = [] } = {}) {
  const loans = loanKeys();
  const exclusionKind = key => EXCLUSION_KINDS.get(key) || 'other';
  const phraseWords = new Set(phrases.flatMap(p => p.words));
  const out = {};
  for (const P of PROFILE_IDS) out[P] = { tokens: 0, buckets: Object.fromEntries(BUCKETS.map(b => [b, { tokens: 0, forms: 0 }])), phraseBound: { tokens: 0, forms: 0 }, unresolved: [] };
  for (const row of trace) {
    const a = row.cls?.ARAMAIC_LEXICAL || 0;
    if (!a) continue;
    const o = out[row.P];
    o.tokens += a;
    const b = bucketOf(row, loans, exclusionKind);
    o.buckets[b].tokens += a;
    o.buckets[b].forms += 1;
    if (b !== 'RESOLVED') {
      if (phraseWords.has(row.key)) { o.phraseBound.tokens += a; o.phraseBound.forms += 1; }
      o.unresolved.push({ key: row.key, tokens: a, n: row.n, bucket: b, reason: row.reason || row.status, lemma: row.lemma || '', candidate: row.candidate || '', candidateStrength: row.candidateStrength || '', cands: (row.cands || []).map(c => `${c.codes ? `${c.codes}+` : ''}${c.lemma}(${c.via}${c.heb ? '' : ',no-heb'})`).join(' ') });
    }
  }
  for (const P of PROFILE_IDS) out[P].unresolved.sort((a, b) => b.tokens - a.tokens || (a.key < b.key ? -1 : 1));
  return out;
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
export function renderCeilingMarkdown(result, title) {
  const lines = [`# ${title}`, '', 'Generated by `scripts/aramaic/ceiling-analysis.mjs` from the build trace. Tokens: the classifier\'s Aramaic tokens (ARAMAIC_LEXICAL) of each profile\'s corpora; a form\'s tokens go to one bucket (see the script header for the definitions).', ''];
  lines.push(`| PROFILE | ARAMAIC TOKENS | ${BUCKETS.join(' | ')} | PHRASE-BOUND |`, `|---|---:|${BUCKETS.map(() => '---:').join('|')}|---:|`);
  for (const P of PROFILE_IDS) { const o = result[P]; lines.push(`| ${P} ${PROFILES[P].name} | ${o.tokens} | ${BUCKETS.map(b => pct(o.buckets[b].tokens, o.tokens)).join(' | ')} | ${pct(o.phraseBound.tokens, o.tokens)} |`); }
  lines.push('', '## Unresolved tokens by the owner\'s grouping', '', '| PROFILE | UNRESOLVED | CANDIDATE AWAITING REVIEW (complete analysis, below the gate) | DETERMINISTIC (morphology, tokenization) | LEXICAL (new gloss, sense choice, loan, gap) | NOT ARAMAIC (Hebrew, names) |', '|---|---:|---:|---:|---:|---:|');
  for (const P of PROFILE_IDS) {
    const o = result[P];
    const un = o.tokens - o.buckets.RESOLVED.tokens;
    const sum = g => Object.entries(GROUPING).filter(([, v]) => v === g).reduce((s, [b]) => s + o.buckets[b].tokens, 0);
    lines.push(`| ${P} ${PROFILES[P].name} | ${un} (${pct(un, o.tokens)}) | ${pct(sum('candidate'), un)} | ${pct(sum('deterministic'), un)} | ${pct(sum('lexical'), un)} | ${pct(sum('not-aramaic'), un)} |`);
  }
  return lines.join('\n') + '\n';
}

export function topFormsByBucket(result, P, limit = 1000) {
  const top = result[P].unresolved.slice(0, limit);
  const by = {};
  for (const u of top) { const b = (by[u.bucket] ||= { forms: 0, tokens: 0 }); b.forms += 1; b.tokens += u.tokens; }
  return { forms: top.length, tokens: top.reduce((s, u) => s + u.tokens, 0), by };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const tracePath = args[0];
  const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : '');
  const trace = readFileSync(tracePath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const phrasesPath = tracePath.replace(/\.jsonl$/, '') + '.phrases.json';
  const phrases = existsSync(phrasesPath) ? JSON.parse(readFileSync(phrasesPath, 'utf8')) : [];
  const result = analyse(trace, { phrases });
  const summary = Object.fromEntries(PROFILE_IDS.map(P => [P, { tokens: result[P].tokens, buckets: Object.fromEntries(BUCKETS.map(b => [b, result[P].buckets[b].tokens])), phraseBound: result[P].phraseBound.tokens, top1000: topFormsByBucket(result, P) }]));
  if (opt('--md')) writeFileSync(opt('--md'), renderCeilingMarkdown(result, opt('--title') || 'Aramaic engine — coverage ceilings'));
  if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify({ summary, unresolved: Object.fromEntries(PROFILE_IDS.map(P => [P, result[P].unresolved.slice(0, 3000)])) }));
  console.log(JSON.stringify(summary, null, 1));
}
