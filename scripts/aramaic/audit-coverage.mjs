// The corpus coverage audit of the word lookup (Phases 1, 8, 9, 10). Tokenizes every text of the app, classifies every
// token (scripts/aramaic/classify.mjs — independent of the dictionary), resolves every token the way the app does on a
// tap, and reports, per corpus: tokens, classes, Aramaic tokens and unique forms, resolved tokens and forms, token-
// weighted and unique-form coverage, frequency bands, glosses shown on non-Aramaic words, and the most frequent
// unresolved forms with their reason (the work queue).
//
// Run:  node scripts/aramaic/audit-coverage.mjs --engine current            → docs/dictionary/coverage-current.{json,md}
//       node scripts/aramaic/audit-coverage.mjs --engine baseline --rev 31b5e01 → docs/dictionary/coverage-baseline.{json,md}
//       add --sample to also write the accuracy samples (docs/dictionary/accuracy-samples.json)
// The baseline engine is materialised from git (the engine, normalizer, families and data of that revision) into a
// temporary directory — the measured system is exactly what that commit shipped. Output is deterministic (no clock).
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { ROOT, CORPORA, corpusParagraphs, corpusById } from './corpora.mjs';
import { createClassifier, corpusFrequency, countNonHebrew, isHebrewReferenceParagraph, CLASSIFIER_VERSION, CLASSES } from './classify.mjs';
import { loadHeadwords, explainUnresolved } from './headwords.mjs';
import { tokenizeLookup } from '../../src/services/wordLookup/normalize.mjs';
import { lookupFamilyForWork, lookupFamilyForLayer } from '../../src/services/wordLookup/families.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const ENGINE = opt('engine', 'current');
const REV = opt('rev', '31b5e01');
const ONLY = opt('only', '');
const WRITE_SAMPLES = args.includes('--sample');
const BANDS = [100, 500, 1000, 5000, 10000];
export const REPORT_GROUPS = Object.freeze(['Bavli', 'Yerushalmi', 'Minor tractates', 'Zohar', 'Tikkunei Zohar', 'Onkelos/Targum', 'Biblical Aramaic', 'Midrash', 'Liturgical', 'Mixed commentaries', 'Other']);

// The reader family the app declares for a paragraph (what the tap sees), or null where the app offers no lookup.
function appFamily(para, corpus) {
  if (corpus.id === 'onkelos') return 'targum';
  if (corpus.id === 'liturgy') return ENGINE === 'baseline' ? null : 'liturgy';
  if (corpus.id === 'biblical-aramaic') return ENGINE === 'baseline' ? null : 'biblical-aramaic';
  if (!para.pack) return ENGINE === 'baseline' ? null : 'torah';
  const work = { workId: para.work, primaryCategory: para.category };
  return /commentary/.test(para.category || '') || /_on_/.test(para.work || '') ? lookupFamilyForLayer({ work }) : lookupFamilyForWork(work);
}

async function loadEngine() {
  if (ENGINE === 'baseline') {
    const dir = mkdtempSync(join(tmpdir(), 'wl-baseline-'));
    for (const file of ['src/services/wordLookup/engine.mjs', 'src/services/wordLookup/normalize.mjs', 'src/data/dictionary/wordDictionary.mjs']) {
      const text = execFileSync('git', ['show', `${REV}:${file}`], { cwd: ROOT, maxBuffer: 64 << 20 }).toString('utf8');
      mkdirSync(join(dir, file, '..'), { recursive: true });
      writeFileSync(join(dir, file), text);
    }
    const engine = await import(pathToFileURL(join(dir, 'src/services/wordLookup/engine.mjs')).href);
    engine.setWordDictionary(await import(pathToFileURL(join(dir, 'src/data/dictionary/wordDictionary.mjs')).href));
    rmSync(dir, { recursive: true, force: true });
    return {
      name: `baseline@${REV}`,
      contextual: () => false,
      resolve: (tokens, i, family) => { const gloss = engine.getShortGloss(tokens[i].raw, engine.resolveWordContext({ family })); return gloss ? { gloss, path: 'baseline' } : null; },
    };
  }
  const engine = await import(pathToFileURL(join(ROOT, 'src/services/wordLookup/engine.mjs')).href);
  await engine.loadWordDictionary();
  return {
    name: 'current',
    contextual: key => engine.isContextualKey(key),
    resolve: (tokens, i, family, corpus) => {
      const result = engine.resolveAramaicSurfaceForm({ rawToken: tokens[i].raw, surroundingTokens: { before: tokens.slice(Math.max(0, i - 3), i).map(t => t.raw), after: tokens.slice(i + 1, i + 4).map(t => t.raw) }, family, corpus: corpus.id, dialect: corpus.dialect });
      return result && result.glossHe ? { gloss: result.glossHe, lemma: result.lemma, path: result.resolutionPath, sources: result.sourceIds, confidence: result.confidence } : null;
    },
  };
}

function bands(forms) {
  const sorted = [...forms.values()].sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1));
  const out = {};
  for (const n of [...BANDS, 'all']) {
    const slice = n === 'all' ? sorted : sorted.slice(0, n);
    const tokens = slice.reduce((s, f) => s + f.count, 0);
    const resolvedTokens = slice.reduce((s, f) => s + f.resolved, 0);
    const resolvedForms = slice.filter(f => f.resolved * 2 >= f.count && f.resolved > 0).length;
    out[n] = { forms: slice.length, resolvedForms, formCoverage: slice.length ? +(resolvedForms / slice.length).toFixed(4) : null, tokens, resolvedTokens, tokenCoverage: tokens ? +(resolvedTokens / tokens).toFixed(4) : null };
  }
  return out;
}

function summarize(stats, headwords, dialect) {
  const aram = stats.forms;
  const aramTokens = [...aram.values()].reduce((s, f) => s + f.count, 0);
  const resolvedTokens = [...aram.values()].reduce((s, f) => s + f.resolved, 0);
  const resolvedForms = [...aram.values()].filter(f => f.resolved > 0).length;
  const uncertain = stats.classes.UNCERTAIN || 0;
  const unresolved = [...aram.values()].filter(f => f.resolved < f.count).sort((a, b) => (b.count - b.resolved) - (a.count - a.resolved) || (a.key < b.key ? -1 : 1)).slice(0, 500)
    .map(f => ({ form: f.key, count: f.count - f.resolved, refs: f.refs, ...(() => { const e = explainUnresolved(f.key, headwords); return { suspectedLemma: e.lemma, reason: e.reason }; })(), dialect }));
  return {
    totalTokens: stats.tokens + stats.foreign + stats.numbers,
    hebrewLetterTokens: stats.tokens,
    classes: { ...Object.fromEntries(CLASSES.map(c => [c, 0])), ...stats.classes, FOREIGN: stats.foreign, NUMBER: (stats.classes.NUMBER || 0) + stats.numbers, PUNCTUATION: stats.punctuation },
    aramaicTokens: aramTokens,
    resolvedTokens,
    tokenCoverage: aramTokens ? +(resolvedTokens / aramTokens).toFixed(4) : null,
    strictTokenCoverage: aramTokens + uncertain ? +(resolvedTokens / (aramTokens + uncertain)).toFixed(4) : null,
    uniqueForms: aram.size,
    resolvedUniqueForms: resolvedForms,
    uniqueCoverage: aram.size ? +(resolvedForms / aram.size).toFixed(4) : null,
    bands: bands(aram),
    abbreviations: { tokens: stats.abbr.tokens, resolved: stats.abbr.resolved, coverage: stats.abbr.tokens ? +(stats.abbr.resolved / stats.abbr.tokens).toFixed(4) : null },
    glossedNonAramaic: stats.glossedNonAramaic,
    offeredLookup: stats.offered,
    topUnresolved: unresolved,
  };
}

const newStats = () => ({ formFamily: new Map(), formGloss: new Map(), tokens: 0, foreign: 0, numbers: 0, punctuation: 0, classes: {}, forms: new Map(), abbr: { tokens: 0, resolved: 0 }, glossedNonAramaic: { HEBREW: 0, PROPER_NAME: 0, UNCERTAIN: 0, NUMBER: 0 }, offered: 0 });
function mergeInto(target, source) {
  for (const k of ['tokens', 'foreign', 'numbers', 'punctuation', 'offered']) target[k] += source[k];
  for (const [k, v] of Object.entries(source.classes)) target.classes[k] = (target.classes[k] || 0) + v;
  for (const [k, v] of Object.entries(source.glossedNonAramaic)) target.glossedNonAramaic[k] += v;
  target.abbr.tokens += source.abbr.tokens; target.abbr.resolved += source.abbr.resolved;
  for (const [k, v] of source.formFamily) if (!target.formFamily.has(k)) target.formFamily.set(k, v);
  for (const [k, v] of source.formGloss) if (!target.formGloss.has(k)) target.formGloss.set(k, v);
  for (const [key, f] of source.forms) { const t = target.forms.get(key); if (!t) target.forms.set(key, { ...f, refs: [...f.refs] }); else { t.count += f.count; t.resolved += f.resolved; for (const r of f.refs) if (t.refs.length < 3) t.refs.push(r); } }
}

// Deterministic sampler (a fixed-seed LCG over the resolved occurrences, reservoir style).
function makeReservoir(size, seed) {
  let state = seed >>> 0;
  const rand = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const items = [];
  let seen = 0;
  return { add(item) { seen += 1; if (items.length < size) items.push(item); else { const j = Math.floor(rand() * seen); if (j < size) items[j] = item; } }, items };
}

let regression = {};
export async function runAudit() {
  const classifier = await createClassifier();
  const headwords = loadHeadwords();
  const engine = await loadEngine();
  const perCorpus = {};
  const samples = {};
  const SAMPLE_SIZES = { bavli: 300, zohar: 200, onkelos: 150, yerushalmi: 100, 'talmud-commentary': 40, midrash: 30, liturgy: 30, 'biblical-aramaic': 20, 'tikkunei-zohar': 20 };
  for (const corpus of CORPORA.filter(c => c.role !== 'hebrew-reference' && (!ONLY || ONLY.split(',').includes(c.id)))) {
    const C = await corpusFrequency(corpus.id);
    const stats = newStats();
    const cache = new Map();
    const reservoir = makeReservoir(SAMPLE_SIZES[corpus.id] || 0, 20260930);
    for await (const para of corpusParagraphs(corpus.id)) {
      if (isHebrewReferenceParagraph(para)) continue;
      const raw = countNonHebrew(para.text);
      stats.foreign += raw.foreign; stats.numbers += raw.numbers; stats.punctuation += raw.punctuation;
      const tokens = tokenizeLookup(para.text);
      const family = appFamily(para, corpus);
      for (let i = 0; i < tokens.length; i += 1) {
        const key = tokens[i].key;
        const cls = classifier.classifyToken(key, tokens[i - 1]?.key, tokens[i + 1]?.key, C);
        stats.tokens += 1;
        stats.classes[cls] = (stats.classes[cls] || 0) + 1;
        let result = null;
        if (family) {
          stats.offered += 1;
          const cacheKey = `${family}\t${key}`;
          if (!engine.contextual(key) && cache.has(cacheKey)) result = cache.get(cacheKey);
          else { result = engine.resolve(tokens, i, family, corpus); if (!engine.contextual(key)) cache.set(cacheKey, result); }
        }
        if (cls === 'ARAMAIC_LEXICAL') {
          let f = stats.forms.get(key);
          if (!f) { f = { key, count: 0, resolved: 0, refs: [] }; stats.forms.set(key, f); }
          f.count += 1;
          // The first occurrence represents the form in the regression snapshot (its reading family and its gloss).
          if (!stats.formFamily.has(key) && family) { stats.formFamily.set(key, `${family}|${para.work || ''}`); stats.formGloss.set(key, result && !engine.contextual(key) ? result.gloss : ''); }
          if (result) { f.resolved += 1; if (reservoir.items !== undefined && (SAMPLE_SIZES[corpus.id] || 0)) reservoir.add({ ref: para.ref, form: tokens[i].raw, key, gloss: result.gloss, lemma: result.lemma || '', path: result.path || '', sources: result.sources || [], context: tokens.slice(Math.max(0, i - 6), i + 7).map(t => t.raw).join(' ') }); }
          else if (f.refs.length < 3) f.refs.push(para.ref);
        } else if (cls === 'ABBREVIATION') { stats.abbr.tokens += 1; if (result) stats.abbr.resolved += 1; }
        else if (result && stats.glossedNonAramaic[cls] !== undefined) stats.glossedNonAramaic[cls] += 1;
      }
    }
    perCorpus[corpus.id] = stats;
    samples[corpus.id] = reservoir.items;
    console.error(`${corpus.id}: ${stats.tokens} tokens, ${stats.classes.ARAMAIC_LEXICAL || 0} Aramaic`);
  }
  const groups = {};
  for (const [id, stats] of Object.entries(perCorpus)) { const g = corpusById(id).group; if (!groups[g]) groups[g] = newStats(); mergeInto(groups[g], stats); }
  const total = newStats();
  for (const stats of Object.values(groups)) mergeInto(total, stats);
  const dialectOf = id => corpusById(id)?.dialect || 'MIXED';
  const report = {
    engine: engine.name,
    classifierVersion: CLASSIFIER_VERSION,
    corpora: Object.fromEntries(Object.entries(perCorpus).map(([id, stats]) => { const s = summarize(stats, headwords, dialectOf(id)); delete s.topUnresolved; return [id, s]; })),
    groups: Object.fromEntries(REPORT_GROUPS.filter(g => groups[g]).map(g => [g, summarize(groups[g], headwords, CORPORA.find(c => c.group === g)?.dialect || 'MIXED')])),
    total: summarize(total, headwords, 'ALL'),
  };
  for (const g of Object.values(report.groups)) g.topUnresolved = g.topUnresolved.slice(0, 500);
  // The regression snapshot: the top 500 forms per group with a representative family and the gloss shown now.
  regression = {};
  for (const [g, stats] of Object.entries(groups)) {
    const top = [...stats.forms.values()].sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1)).slice(0, 500);
    regression[g] = top.map(f => [f.key, f.count, stats.formFamily.get(f.key) || '', stats.formGloss.get(f.key) || '']);
  }
  report.total.topUnresolved = report.total.topUnresolved.slice(0, 100);
  return { report, samples };
}

const pct = v => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);
export function renderMarkdown(report, title) {
  const lines = [`# ${title}`, '', `Engine: \`${report.engine}\` · classifier v${report.classifierVersion} (scripts/aramaic/classify.mjs) · generated by scripts/aramaic/audit-coverage.mjs`, '',
    'Token coverage = resolved Aramaic tokens / Aramaic tokens (ARAMAIC_LEXICAL). Strict = resolved / (Aramaic + UNCERTAIN). Unique = resolved forms / Aramaic forms. Bands: share of the N most frequent Aramaic forms resolved (a form counts when at least half its tokens are).', '',
    '| CORPUS | TOKENS | ARAMAIC TOKENS | RESOLVED | TOKEN COVERAGE | STRICT | UNIQUE FORMS | RESOLVED FORMS | UNIQUE COVERAGE | UNCERTAIN | TOP-100 | TOP-500 | TOP-1000 | TOP-5000 | TOP-10000 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  const row = (name, s) => `| ${name} | ${s.totalTokens} | ${s.aramaicTokens} | ${s.resolvedTokens} | ${pct(s.tokenCoverage)} | ${pct(s.strictTokenCoverage)} | ${s.uniqueForms} | ${s.resolvedUniqueForms} | ${pct(s.uniqueCoverage)} | ${s.classes.UNCERTAIN} | ${pct(s.bands[100].formCoverage)} | ${pct(s.bands[500].formCoverage)} | ${pct(s.bands[1000].formCoverage)} | ${pct(s.bands[5000].formCoverage)} | ${pct(s.bands[10000].formCoverage)} |`;
  for (const [g, s] of Object.entries(report.groups)) lines.push(row(g, s));
  lines.push(row('**Total**', report.total), '', '## Token classes', '', `| CORPUS | ${CLASSES.join(' | ')} | ABBREVIATIONS RESOLVED | GLOSSES ON HEBREW WORDS |`, `|---|${CLASSES.map(() => '---:').join('|')}|---:|---:|`);
  for (const [g, s] of Object.entries(report.groups)) lines.push(`| ${g} | ${CLASSES.map(c => s.classes[c] || 0).join(' | ')} | ${s.abbreviations.resolved}/${s.abbreviations.tokens} | ${s.glossedNonAramaic.HEBREW} |`);
  lines.push('', '## Per corpus', '', '| CORPUS | TOKENS | ARAMAIC TOKENS | TOKEN COVERAGE | UNIQUE COVERAGE | TOP-100 | TOP-500 | TOP-1000 |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const [id, s] of Object.entries(report.corpora)) lines.push(`| ${id} | ${s.totalTokens} | ${s.aramaicTokens} | ${pct(s.tokenCoverage)} | ${pct(s.uniqueCoverage)} | ${pct(s.bands[100].formCoverage)} | ${pct(s.bands[500].formCoverage)} | ${pct(s.bands[1000].formCoverage)} |`);
  lines.push('', '## Top unresolved (work queue)', '', 'The full lists (500 per corpus group, with sample references, suspected lemma, dialect and reason) are in the JSON file beside this one. The 40 most frequent per group:', '');
  for (const [g, s] of Object.entries(report.groups)) {
    lines.push(`### ${g}`, '', '| FORM | COUNT | SUSPECTED LEMMA | REASON | SAMPLE REF |', '|---|---:|---|---|---|');
    for (const u of s.topUnresolved.slice(0, 40)) lines.push(`| ${u.form} | ${u.count} | ${u.suspectedLemma || '—'} | ${u.reason} | ${u.refs[0] || ''} |`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { report, samples } = await runAudit();
  const base = ENGINE === 'baseline' ? 'coverage-baseline' : 'coverage-current';
  mkdirSync(join(ROOT, 'docs/dictionary'), { recursive: true });
  if (!ONLY) {
    writeFileSync(join(ROOT, `docs/dictionary/${base}.json`), JSON.stringify(report, null, 1) + '\n');
    writeFileSync(join(ROOT, `docs/dictionary/${base}.md`), renderMarkdown(report, ENGINE === 'baseline' ? `Word lookup — coverage BEFORE (baseline ${REV})` : 'Word lookup — coverage AFTER (current build)'));
    if (WRITE_SAMPLES) writeFileSync(join(ROOT, 'docs/dictionary/accuracy-samples.json'), JSON.stringify(samples, null, 1) + '\n');
    // The regression snapshot (Phase 10): per corpus group, its 500 most frequent Aramaic forms, their counts and the
    // gloss the engine gives each — the CI test re-runs the engine on them: a form that loses its gloss, or a group
    // whose covered share drops, fails the build.
    if (ENGINE === 'current') writeFileSync(join(ROOT, 'docs/dictionary/regression-forms.json'), JSON.stringify(regression, null, 0).replace(/\],\[/g, '],\n[') + '\n');
  }
  for (const [g, s] of Object.entries(report.groups)) console.log(`${g.padEnd(20)} tokens ${String(s.totalTokens).padStart(9)} aramaic ${String(s.aramaicTokens).padStart(8)} resolved ${String(s.resolvedTokens).padStart(8)} cov ${pct(s.tokenCoverage).padStart(6)} strict ${pct(s.strictTokenCoverage).padStart(6)} uniq ${pct(s.uniqueCoverage).padStart(6)} top100 ${pct(s.bands[100].formCoverage)} top500 ${pct(s.bands[500].formCoverage)} top1000 ${pct(s.bands[1000].formCoverage)} uncertain ${s.classes.UNCERTAIN} hebGlossed ${s.glossedNonAramaic.HEBREW}`);
  const t = report.total;
  console.log(`TOTAL aramaic ${t.aramaicTokens} resolved ${t.resolvedTokens} cov ${pct(t.tokenCoverage)} uniq ${pct(t.uniqueCoverage)}`);
}
