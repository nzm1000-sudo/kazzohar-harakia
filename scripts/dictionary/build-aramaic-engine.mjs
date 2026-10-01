// Builds the Aramaic language engine of the word lookup (מילון בלחיצה) — offline, deterministic, no model.
// Run: node scripts/dictionary/build-aramaic-engine.mjs [--check] [--release] [--exclude krupnik-1927] [--review]
//
//   SURFACE → NORMALIZATION → FORM RESOLUTION → MORPHOLOGY → LEMMA → CONTEXT (profile) → VERIFIED LEXICON → SHORT HEBREW
//
// Reads (after the rights gate, src/data/dictionary/sources.mjs):
//   sources/talmud-dictionary/raw/entries.jsonl.gz   Krupnik & Silbermann (Hebrew definitions)
//   sources/jastrow/raw/entries.jsonl.gz             Jastrow (lemmas, forms, stems, Hebrew equivalents, names)
//   sources/hebrew-wiktionary/raw/pages.jsonl.gz     Hebrew Wiktionary (Aramaic senses, abbreviations, idioms)
//   sources/morphhb/raw/words.tsv.gz                 OSHB (proper nouns for the classifier)
//   the app's own texts (scripts/aramaic/corpora.mjs) — to know which forms occur, and where they are Hebrew
//   src/data/dictionary/reviewed.mjs                 reviewed choices, exclusions and form glosses
// Writes:
//   src/data/dictionary/wordDictionary.mjs           the compact tables the app loads (the only shipped output)
//   sources/word-dictionary/build-report.json        counts, sizes, rejections by reason, the rights record
//   sources/word-dictionary/lemmas.tsv               the reviewable gloss table: lemma | dialect | glossHe | source | reviewStatus
//   docs/dictionary/review/*.tsv (with --review)     the top forms per corpus with their analysis, for review
// --check: build in memory and fail if the committed outputs differ. --exclude: build without a source (to measure).
// --release: the store-release gate (no source pending release rights; version-cleared sources must match their version).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICTIONARY_SOURCES, auditDictionarySources, importedSources } from '../../src/data/dictionary/sources.mjs';
import * as REVIEWED_BASE from '../../src/data/dictionary/reviewed.mjs';
import * as REVIEWED_ARAMAIC from '../../src/data/dictionary/reviewedAramaic.mjs';
import { parseKrupnik } from './lexica/krupnik.mjs';
import { parseJastrow, HEBREW_STEM_OF } from './lexica/jastrow.mjs';
import { parseWiktionary } from './lexica/wiktionary.mjs';
import { buildLexicon } from './aramaic/lexicon.mjs';
import { extractJastrowAbbreviations, parseBenYehudaAbbreviations, initialsFit } from './lexica/abbreviations.mjs';
import { abbreviationEvidence, fuseAbbreviations, prefixedDecisions, prefixedPhrases, abbreviationRowsOf, phraseKey } from './aramaic/abbreviations.mjs';
import { verbForms, IRREGULAR } from './aramaic/verbs.mjs';
import { nounForms } from './aramaic/nominal.mjs';
import { procliticSplits, procliticFits, STRENGTH } from './aramaic/analyze.mjs';
import { attestation } from './aramaic/attestation.mjs';
import { PROFILES, PROFILE_IDS } from '../../src/services/wordLookup/aramaic/profiles.mjs';
import { renderGloss } from '../../src/services/wordLookup/aramaic/render.mjs';
import { HEBREW_VERBS } from '../../src/services/wordLookup/aramaic/hebrewVerbs.mjs';
import { PRONOMINAL } from '../../src/services/wordLookup/aramaic/pronominal.mjs';
import { normalizeLookupToken, isAbbreviationKey, tokenizeLookup, LOOKUP_NORMALIZER_VERSION } from '../../src/services/wordLookup/normalize.mjs';
import { corpusParagraphs } from '../aramaic/corpora.mjs';
import { buildInputs } from '../aramaic/manifest.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// The reviewed data: the first review (reviewed.mjs) and the Aramaic engine's (reviewedAramaic.mjs), merged.
export const krupnikOnlyBasis = basis => /Krupnik/.test(basis) && !/Jastrow|Wiktionary|grammar|table|Hebrew/.test(basis);
const REVIEWED = {
  ...REVIEWED_BASE,
  SENSE_CHOICES: [...(REVIEWED_BASE.SENSE_CHOICES || []), ...REVIEWED_ARAMAIC.SENSE_CHOICES.map(([key, gloss, profiles, why]) => ({ key, gloss, profiles, why }))],
  IDENTITY_GLOSSES: [...(REVIEWED_BASE.IDENTITY_GLOSSES || []), ...REVIEWED_ARAMAIC.IDENTITY_GLOSSES],
  KRUPNIK_MISSING_HEBREW: [...(REVIEWED_BASE.KRUPNIK_MISSING_HEBREW || []), ...REVIEWED_ARAMAIC.KRUPNIK_MISSING_HEBREW],
  // A reviewed form whose recorded basis is Krupnik & Silbermann alone leaves with that source (--exclude krupnik-1927):
  // every Krupnik-derived gloss can be removed cleanly (docs/dictionary/krupnik-impact.md).
  FORM_GLOSSES: REVIEWED_ARAMAIC.FORM_GLOSSES.filter(([, , , basis]) => !(process.argv.includes('krupnik-1927') && krupnikOnlyBasis(basis))),
  LEMMA_GLOSSES: REVIEWED_ARAMAIC.LEMMA_GLOSSES,
  LEMMA_POS: REVIEWED_ARAMAIC.LEMMA_POS,
  STEM_GLOSSES: REVIEWED_ARAMAIC.STEM_GLOSSES || [],
  EXCLUDED_FORMS: REVIEWED_ARAMAIC.EXCLUDED_FORMS.map(([key, why]) => ({ key, why })),
};
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const REVIEW = args.includes('--review');
const EXCLUDE = args.includes('--exclude') ? args[args.indexOf('--exclude') + 1].split(',') : [];
// Analysis builds (never shipped): --out <dir> writes the data module there instead; --trace <file> writes every form's
// decision per profile (lemma, source, kind, path, or the reason it stays unresolved) as JSON lines.
const OUT_DIR = args.includes('--out') ? args[args.indexOf('--out') + 1] : '';
const TRACE = args.includes('--trace') ? args[args.indexOf('--trace') + 1] : '';
const traceRows = [];
export const ENGINE_RULES_VERSION = 2;
const sha256 = text => createHash('sha256').update(text).digest('hex');
const fail = message => { console.error(`build-aramaic-engine: ${message}`); process.exit(1); };
// Reviewed data that no longer matches the sources is an error — collected, reported at the end, and the build fails.
const reviewErrors = [];
const reviewError = message => reviewErrors.push(message);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const log = (...m) => { if (!CHECK) console.error(...m); };

// ---------- Rights gate ----------
// --release: the store-release gate (a source whose release rights are pending must be confirmed or excluded).
// Krupnik & Silbermann is cleared (Sefaria's written confirmation, 2026-10-01) for one version only: every build checks
// the version it was fetched from (its fetch record) against the registry's clearedVersion, and stops on any difference.
const RELEASE = args.includes('--release');
const fetchMetas = Object.fromEntries(DICTIONARY_SOURCES.filter(s => s.imported && s.fetchMetaFile && existsSync(join(ROOT, s.fetchMetaFile)))
  .map(s => [s.sourceId, JSON.parse(readFileSync(join(ROOT, s.fetchMetaFile), 'utf8'))]));
const problems = auditDictionarySources(undefined, { release: RELEASE, excluded: EXCLUDE, fetchMetas });
const raw = {};
for (const source of importedSources()) {
  const buffer = readFileSync(join(ROOT, `${source.rawFile}.gz`));
  const text = gunzipSync(buffer).toString('utf8');
  const hash = `sha256:${sha256(text)}`;
  if (hash !== source.contentHash) problems.push(`${source.sourceId}: raw file hash ${hash} ≠ registry ${source.contentHash}`);
  raw[source.sourceId] = text;
}
if (problems.length) fail(`rights gate:\n  ${problems.join('\n  ')}`);
const usable = id => raw[id] !== undefined && !EXCLUDE.includes(id);

// ---------- Lexicon ----------
const rejections = {};
const reject = (reason, sample) => { const r = (rejections[reason] ||= { count: 0, samples: [] }); r.count += 1; if (r.samples.length < 12 && sample) r.samples.push(sample); };
const krupnik = usable('krupnik-1927') ? parseKrupnik(raw['krupnik-1927']) : [];
const jastrow = usable('jastrow-1903') ? parseJastrow(raw['jastrow-1903']) : [];
const wiktionary = usable('he-wiktionary') ? parseWiktionary(raw['he-wiktionary']) : { aramaic: [], abbreviations: [], idioms: [] };
for (const r of krupnik) for (const s of r.senses) if (!s.gloss) reject(`krupnik:${s.glossReject}`, `${r.id}: ${s.def}`);
const missingHebrew = new Map();
for (const r of REVIEWED.KRUPNIK_MISSING_HEBREW) {
  const key = normalizeLookupToken(r.key);
  const hits = krupnik.filter(e => e.heads.some(h => h.key === key) && e.senses.some(s => s.n === r.n && !s.gloss && s.glossReject === 'no-hebrew-definition'));
  if (!hits.length) reviewError(`KRUPNIK_MISSING_HEBREW ${r.key}#${r.n} matched no sense with a missing Hebrew definition`);
  for (const e of hits) missingHebrew.set(`${e.id}#${r.n}`, r.gloss);
}
const lex = buildLexicon({ krupnik, jastrow, wiktionary, missingHebrew });
// Reviewed lemma glosses and parts of speech.
for (const [key0, gloss, pos, basis] of REVIEWED.LEMMA_GLOSSES) {
  const key = normalizeLookupToken(key0);
  if (!lex.lemmas.has(key)) lex.lemmas.set(key, { key, pos: '', senses: [], stems: new Set(), hebrewStems: {}, sources: new Set(), entries: [] });
  const l = lex.lemmas.get(key);
  if (pos) l.pos = pos;
  if (pos === 'v') l.stems.add('pe');
  l.senses.push({ gloss, sourceId: 'reviewed', entryId: basis, n: 0, stem: pos === 'v' ? 'pe' : '', kind: 'reviewed', evidence: {}, formKeys: null, pos });
}
for (const [key0, stem, gloss, basis] of REVIEWED.STEM_GLOSSES) {
  const l = lex.lemmas.get(normalizeLookupToken(key0));
  if (!l) { reviewError(`STEM_GLOSSES: no lemma ${key0}`); continue; }
  l.stems.add(stem);
  l.senses.push({ gloss, sourceId: 'reviewed', entryId: basis, n: 0, stem, kind: 'reviewed', evidence: {}, formKeys: null, pos: 'v', formOnly: true });
}
for (const [key0, pos] of REVIEWED.LEMMA_POS) { const l = lex.lemmas.get(normalizeLookupToken(key0)); if (!l) { reviewError(`LEMMA_POS: no lemma ${key0}`); continue; } l.pos = pos; }
log(`lexicon: ${lex.lemmas.size} lemmas, ${lex.sourceForms.size} printed forms, ${lex.aliases.size} aliases, ${lex.phrases.length} phrases, ${lex.abbreviations.size} abbreviations`);
const excludedLemma = new Set((REVIEWED.EXCLUDED || []).map(rule => normalizeLookupToken(rule.key)));

// ---------- Generated inflections ----------
const generated = new Map(); // form → [{ lemma, tag, strength }]
const addGen = (form, entry) => { if (form.length < 3 && entry.strength !== 'irregular') return; if (!generated.has(form)) generated.set(form, []); generated.get(form).push(entry); };
const IRREGULAR_ALIAS = { הוא: 'הוה', הוי: 'הוה', אתי: 'אתא', קום: 'קומ' };
for (const [key, lemma] of lex.lemmas) {
  if (excludedLemma.has(key)) continue;
  const verbal = lemma.pos === 'v' || lemma.stems.size > 0;
  if (verbal) {
    // The reviewed paradigms of the irregular verbs belong to their canonical lemma only (הוא is also the pronoun).
    if (IRREGULAR_ALIAS[key] && lex.lemmas.has(IRREGULAR_ALIAS[key])) continue;
    const irregularKey = IRREGULAR_ALIAS[key] || key;
    const forms = verbForms(IRREGULAR[irregularKey] ? irregularKey : key, [...lemma.stems]);
    for (const [form, tags] of forms) for (const tag of tags) addGen(form, { lemma: key, tag, strength: IRREGULAR[irregularKey] ? 'irregular' : 'generated' });
  }
  if (!verbal && (lemma.pos === 'n' || lemma.pos === 'adj' || /[אה]$/.test(key))) {
    for (const [form, tags] of nounForms(key)) for (const tag of tags) if (form !== key) addGen(form, { lemma: key, tag, strength: 'generated-noun' });
  }
}
log(`generated: ${generated.size} candidate forms`);

// ---------- Sense choice (per lemma, stem and profile) ----------
const SOURCE_RANK = { reviewed: 0, 'krupnik-1927': 0, 'jastrow-1903': 1, 'he-wiktionary': 2 };
const KIND_RANK = { reviewed: 0, def: 0, 'def-en': 0, same: 1, eq: 1, 'targum-h': 2, wikt: 3 };
const senseChoices = new Map(); // `${key}\t${P}` → gloss or [gloss, gloss] (reviewed)
const bare = gloss => (Array.isArray(gloss) ? gloss.map(bare) : String(gloss).replace(/[?.,;:]+$/, '').trim());
for (const [key0, gloss] of REVIEWED.LEMMA_GLOSSES) for (const P of PROFILE_IDS) senseChoices.set(`${normalizeLookupToken(key0)}\t${P}`, gloss);
for (const rule of REVIEWED.SENSE_CHOICES || []) for (const P of rule.profiles || PROFILE_IDS) senseChoices.set(`${normalizeLookupToken(rule.key)}\t${P}`, bare(rule.gloss));
const MAX_TWO_WORDS = 6;
// Returns { glosses: [gloss…], sourceId, kind, via }, { ambiguous: true, glosses } or null (no Hebrew sense at all).
// stem: '' (headword/noun), 'pe', or a derived stem.
// "ch. same" glosses identical to the Aramaic word itself (נפק → נפק, חזי → חזי) say nothing to a Hebrew reader and
// often mislead (סלק): they count only for the reviewed words whose Hebrew is the same word with the same meaning.
const identityAllowed = new Set((REVIEWED.IDENTITY_GLOSSES || []).map(normalizeLookupToken));
const usableSense = (lemma, s) => s.gloss && !(s.kind === 'same' && normalizeLookupToken(s.gloss) === lemma.key && !identityAllowed.has(lemma.key));
function chooseSense(lemma, stem, P) {
  const all = lemma.senses.filter(s => usableSense(lemma, s));
  let cands;
  if (stem && stem !== 'pe') {
    cands = all.filter(s => s.stem === stem);
    if (!cands.length && (stem === 'itpe' || stem === 'itpa')) {
      // (The Hebrew entry's own derived stem is not taken: השתכח, הגלה are false friends of אשתכח, מגלי.)
      const pe = chooseSense(lemma, 'pe', P);
      if (pe && !pe.ambiguous && pe.glosses.length === 1 && HEBREW_VERBS[pe.glosses[0]]?.nif) return { ...pe, via: `${pe.via}; reflexive by the Hebrew nif'al` };
      return null;
    }
    if (!cands.length) return null;
  } else cands = all.filter(s => !s.formOnly && (s.stem === 'pe' || s.stem === ''));
  if (!cands.length) return null;
  const reviewed = senseChoices.get(`${lemma.key}\t${P}`);
  if (reviewed) {
    const wanted = Array.isArray(reviewed) ? reviewed : [reviewed];
    const hits = wanted.map(g => lemma.senses.find(s => bare(s.gloss) === g));
    if (hits.every(Boolean)) return { glosses: hits.map(h => h.gloss), sourceId: hits[0].sourceId, kind: hits[0].kind, via: 'reviewed choice' };
    reviewError(`reviewed sense choice ${lemma.key} → ${wanted.join(' | ')} is not a sense the sources give (${lemma.senses.map(s => s.gloss).join(' | ')})`);
    return null;
  }
  const rank = s => SOURCE_RANK[s.sourceId] * 10 + KIND_RANK[s.kind];
  const pick = list => { const best = Math.min(...list.map(rank)); return [...new Set(list.filter(s => rank(s) === best).map(s => s.gloss))]; };
  // Evidence first: the senses the dictionaries cite from this profile's corpora, in the profile's order of relevance.
  for (const corpus of PROFILES[P].evidence) {
    const cited = cands.filter(s => (s.evidence?.[corpus] || 0) > 0);
    if (!cited.length) continue;
    const glosses = [...new Set(cited.map(s => s.gloss))].length === 1 ? [cited[0].gloss] : pick(cited);
    if (glosses.length === 1) { const s = cited.find(x => x.gloss === glosses[0]); return { glosses, sourceId: s.sourceId, kind: s.kind, via: `the sense cited from ${corpus}` }; }
    return { ambiguous: true, glosses, via: `several senses cited from ${corpus}` };
  }
  // Jastrow has more (non-Biblical) homographs of these letters than we have Hebrew senses (סבא: "old man" and "to
  // drink"): the missing meaning may be the one on the page — ambiguous, unless a sense is cited from this corpus.
  const allGlosses = new Set(cands.map(s => s.gloss));
  if ((lemma.jastrowHomographs || 0) >= 2 && allGlosses.size < lemma.jastrowHomographs) return { ambiguous: true, glosses: [...allGlosses], via: `${lemma.jastrowHomographs} Jastrow homographs, ${allGlosses.size} Hebrew sense(s)` };
  const distinct = pick(cands);
  const s0 = cands.find(x => x.gloss === distinct[0]);
  if (distinct.length === 1) return { glosses: distinct, sourceId: s0.sourceId, kind: s0.kind, via: 'single sense' };
  if (distinct.length === 2 && distinct.join(' ').split(/\s+/).length <= MAX_TWO_WORDS) return { glosses: distinct, sourceId: s0.sourceId, kind: s0.kind, via: 'two senses' };
  return { ambiguous: true, glosses: distinct, via: 'several senses' };
}

// Every Hebrew verb form of the conjugation table (to tell a reviewed gloss that is a verb from one that is a noun).
const HEBREW_VERB_FORMS = new Set(Object.values(HEBREW_VERBS).flatMap(v => [...Object.values(v).filter(x => typeof x === 'string'), ...Object.values(v.nif || {}).filter(x => typeof x === 'string')]));

// ---------- Candidate analyses of a form ----------
const pronominal = new Map(Object.entries(PRONOMINAL).map(([k, v]) => [normalizeLookupToken(k), v]));
function baseCandidates(rest, codes = '', P = null) {
  const out = [];
  const lemmaOf = key => lex.lemmas.get(key);
  if (lemmaOf(rest)?.senses.some(s => s.gloss)) out.push({ lemma: rest, tag: '', strength: 'exact' });
  for (const target of lex.aliases.get(rest) || []) if (lemmaOf(target)?.senses.some(s => s.gloss)) out.push({ lemma: target, tag: '', strength: 'alias' });
  // A word of a dictionary's quotation (weak evidence) is never an analysis; a printed form is (Pl., Part., a stem).
  for (const f of lex.sourceForms.get(rest) || []) if (f.strength !== 'quote' && !String(f.tag).startsWith('x.')) out.push({ lemma: f.lemma, tag: f.tag || '', strength: f.strength, stem: f.stem });
  // A generated inflection only on a form that bears an Aramaic mark (a Hebrew-looking form — שנינו, מצווה — may be
  // the Hebrew word itself): the reviewed irregular paradigms are exempt.
  // (Pass 2: the progressive קא is itself such a mark before a participle — קתני, קסבר — and so is ל before an
  // infinitive in ־א/־אה — לאחזאה, למיקמא.)
  const marked = tag => ARAMAIC_FORM_MARK.test(rest) || (/q$/.test(codes) && /\.(ptcp|pass)\./.test(tag)) || (/l$/.test(codes) && /\.inf$/.test(tag) && /אה?$/.test(rest));
  for (const g of generated.get(rest) || []) if (g.strength === 'irregular' || marked(g.tag)) out.push({ lemma: g.lemma, tag: g.tag, strength: g.strength });
  if (pronominal.has(rest)) out.push({ fixed: pronominal.get(rest), tag: 'fixed', strength: 'irregular', lemma: `pron:${rest}` });
  // Pass 2: a proclitic on a reviewed form (בההוא, דפליגי, מדכתיב) — the reviewed gloss with the proclitic's Hebrew
  // (render.mjs, grammar only). The form's own analysis gives the part of speech and tag the proclitic must suit; with
  // none, only ו is taken.
  if (codes && P) {
    const rule = (reviewedForms.get(rest) || []).find(r => !r.profiles || r.profiles.includes(P));
    // (Not on a reviewed form that itself begins with ו — ותא is ו + תא, and מותא is "death" — nor where the gloss
    // already begins with the proclitic's Hebrew letter: בדוקא is not "בבדיוק".)
    const inner = { w: 'ו', b: 'ב', l: 'ל', k: 'כ', m: 'מ' }[codes.slice(-1)];
    if (rule && rest.length >= 3 && !/^ו/.test(rest) && !(inner && rule.gloss.startsWith(inner))) {
      // What the proclitic needs to know, checked three ways: ו needs nothing; ד is "ש" before a verb — only where the
      // form's own analysis is a verb form, the reviewed gloss is a Hebrew verb form, and the form has no noun ending
      // (הלכתא is the noun "halacha", not "she went"); ב ל כ מ go before a noun, pronoun or particle only.
      const ordinary = out.find(c => !c.fixed && lex.lemmas.get(c.lemma));
      const verbalTag = ordinary && stemOfTag(ordinary.tag);
      const glossIsVerb = HEBREW_VERB_FORMS.has(rule.gloss.split(' ')[0]) || /^אנו /.test(rule.gloss);
      const nominal = ordinary && !verbalTag && !glossIsVerb && (/^n\./.test(ordinary.tag) || /^(n|pron|particle|adv)$/.test(lex.lemmas.get(ordinary.lemma).pos || ''));
      let pos = '';
      if (codes === 'w') pos = verbalTag && glossIsVerb ? 'v' : 'particle';
      else if (/^w?d$/.test(codes) && verbalTag && glossIsVerb && !/(תא|ותא|יתא)$/.test(rest)) pos = 'v';
      else if (/^w?[blkm]$/.test(codes) && nominal) pos = 'n';
      if (pos) out.push({ fixed: rule.gloss, fixedPos: pos, revBase: true, tag: ordinary?.tag || '', strength: 'reviewed-base', lemma: `rev:${rest}` });
    }
  }
  return out.filter(c => !excludedLemma.has(c.lemma));
}
const BABYLONIAN_IMPF_N = ['J', 'X'];
const BABYLONIAN_IMPF_L = ['J', 'X', 'Z'];
const ARAMAIC_FORM_MARK = /(א|יה|ייהו|יהו|נא|יננ|כונ|הונ|תונ|והי|ינהו)$|^(ל|נ)י.{2}|^מי[^י].|^(את|אית|אשת|אצט|אזד|אסת)../;
const stemOfTag = tag => { const s = tag.split('.')[0]; return /^(pe|pa|af|itpe|itpa|ittaf|shaf|ishtaf)$/.test(s) ? s : ''; };
const FREQUENT_BASE = 200;
const RARE = 10;
// Onkelos, Biblical Aramaic and the liturgy are small corpora: a form met three times there is not rare.
const SMALL_CORPUS = ['T', 'B', 'L'];
// Every candidate analysis of a form in profile P, scored; then the decision:
//   · the strongest candidate decides; if its meaning is ambiguous or unknown here, the form stays unresolved (no
//     weaker analysis of another word is taken instead);
//   · an exact headword that could as well be a proclitic on a frequent word here (דלא: "lifted" or ד + לא) with a
//     different meaning is ambiguous — left for review;
//   · two different meanings within two points: ambiguous.
function resolveForm(key, P, freqIn, S = P) {
  const cands = [];
  for (const { rest, codes } of procliticSplits(key)) {
    for (const c of baseCandidates(rest, codes, P)) {
      if (c.revBase && !codes) continue;
      const lemma = lex.lemmas.get(c.lemma);
      if (!c.fixed && !lemma) continue;
      const pos = c.fixed ? c.fixedPos || 'particle' : lemma.pos || '';
      if (!procliticFits(codes, c.tag, pos)) continue;
      // The third-person imperfect with נ־ is Babylonian (JBA, and the later works that write it); ל־ also the Zohar's.
      // Elsewhere נ־ is the first person plural only (ניעול in the Zohar is "let us enter").
      if (/\.impf\.3m[sp]$/.test(c.tag) && ((/^נ/.test(rest) && !BABYLONIAN_IMPF_N.includes(P)) || (/^ל/.test(rest) && !BABYLONIAN_IMPF_L.includes(P)))) continue;
      const strength = c.revBase ? 'reviewed-base' : c.fixed ? 'pronominal' : c.tag.startsWith('x.') ? 'quote' : c.strength;
      // Precision (the accuracy review of 2026-09-30): a proclitic is taken off only a base that is itself an Aramaic
      // word of this corpus (attested five times or more, mostly as Aramaic) — ד + a Hebrew word (דכתובה, דבעל) is left
      // alone; a possessive suffix is read only on a noun the corpus uses (twenty times or more).
      // (ב ל כ מ never go before a possessive "של…" of the pronominal table: לדידהו is not "לשלהם".)
      if (c.fixed && /[blkm]/.test(codes) && /^של/.test(c.fixed)) continue;
      if (codes && (!c.fixed || c.revBase)) { const e = attested.get(rest)?.[S]; if (!e || e.n < 5 || !glossableIn(e)) continue; }
      if (/^n\.(sg|pl)\+/.test(c.tag) && !c.revBase) { const e = attested.get(c.lemma)?.[S]; if (!e || e.n < 20) continue; }
      let sense;
      if (c.revBase) sense = { glosses: [c.fixed], sourceId: 'reviewed', kind: 'reviewed-base', via: `a proclitic on the reviewed form ${rest}` };
      else if (c.fixed) sense = { glosses: [c.fixed], sourceId: 'grammar', kind: 'pronominal', via: 'pronominal preposition table' };
      else {
        const stem = stemOfTag(c.tag);
        sense = chooseSense(lemma, c.tag.startsWith('n.') ? '' : stem || (lemma.pos === 'v' ? 'pe' : ''), P);
      }
      // Among the tags of one lemma, the commoner reading first: participle, passive participle, perfect, infinitive,
      // imperfect, imperative.
      const TAG_PRIOR = { ptcp: 0.6, pass: 0.5, perf: 0.4, inf: 0.3, impf: 0.2, impv: 0.1 };
      let score = STRENGTH[strength] - 4 * codes.length + (TAG_PRIOR[c.tag.split('.')[1]] || 0);
      if (lemma && PROFILES[P].evidence.some(corpus => lemma.senses.some(s => (s.evidence?.[corpus] || 0) > 0))) score += 3;
      score += Math.min(3, Math.log10(1 + (freqIn(rest) || 0)) / 2);
      cands.push({ ...c, strength, codes, rest, pos, sense, score });
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score || cmp(a.lemma, b.lemma) || cmp(a.tag, b.tag) || cmp(a.codes, b.codes));
  const render = c => c.sense.glosses.map(g => renderGloss({ gloss: g, tag: c.tag === 'fixed' || c.revBase ? '' : c.tag, pos: c.pos, proclitics: c.codes })).join(' · ');
  let top = cands[0];
  if (!top.sense || top.sense.ambiguous) {
    const same = cands.find(c => c.lemma === top.lemma && c.sense && !c.sense.ambiguous);
    if (!same) return { unresolved: true, top, reason: top.sense?.ambiguous ? `AMBIGUOUS_SENSE ${top.lemma}: ${top.sense.glosses.join(' | ')}` : `NO_HEBREW_SENSE ${top.lemma}` };
    top = same;
  }
  const text = render(top);
  if (!top.codes) {
    const split = cands.find(c => c.codes && c.sense && !c.sense.ambiguous && c.lemma !== top.lemma && (freqIn(c.rest) || 0) >= FREQUENT_BASE && render(c) !== text);
    if (split && top.strength !== 'reviewed') return { unresolved: true, top, reason: `HOMOGRAPH ${top.lemma} "${text}" ~ ${split.codes}+${split.rest} "${render(split)}"` };
  }
  const rival = cands.find(c => c !== top && c.score >= top.score - 2 && c.lemma !== top.lemma && c.sense && !c.sense.ambiguous && render(c) !== text);
  if (rival) return { unresolved: true, top, reason: `AMBIGUOUS ${top.lemma}/${top.tag} "${text}" ~ ${rival.lemma}/${rival.tag} "${render(rival)}"` };
  // Pass 2: two readings of the same lemma that nothing tells apart (אתאי: "I came" or "she came"; the same tense in
  // two persons or two stems) — the order of the tags is not evidence: ambiguous.
  const twin = cands.find(c => c !== top && c.lemma === top.lemma && c.tag !== top.tag && Math.abs(c.score - top.score) < 0.05 && c.sense && !c.sense.ambiguous && render(c) !== text);
  if (twin && top.strength !== 'reviewed') return { unresolved: true, top, reason: `AMBIGUOUS_TAG ${top.lemma} ${top.tag} "${text}" ~ ${twin.tag} "${render(twin)}"` };
  // Pass 2: ד before a word whose part of speech the dictionaries do not give is "ש…" before a verb and "של" before a
  // noun — unknown here (דדהב is "of gold", not "that gold"): left for review. (A headword in the emphatic state, ־א, of
// four letters or more is a noun: דימינא "of the right".)
  if (/d/.test(top.codes) && !top.pos && !top.fixed && !(/א$/.test(top.lemma) && top.lemma.length >= 4)) return { unresolved: true, top, reason: `D_UNKNOWN_POS ${top.lemma} "${text}"` };
  return { ...top, text };
}

// For the audits only (the trace of an unresolved form): every lemma the form could belong to, without the precision
// rules — the bare lemma, a spelling, a printed form or a generated inflection, after proclitics — and whether that
// lemma has a Hebrew sense at all.
function looseCandidates(key) {
  const out = [];
  const push = (lemma, codes, via) => { if (out.length < 6 && !out.some(o => o.lemma === lemma && o.codes === codes)) { const l = lex.lemmas.get(lemma); out.push({ lemma, codes, via, heb: Boolean(l?.senses.some(s => s.gloss)), en: Boolean(l?.english?.length) }); } };
  for (const { rest, codes } of procliticSplits(key)) {
    if (lex.lemmas.has(rest)) push(rest, codes, 'exact');
    for (const t of lex.aliases.get(rest) || []) push(t, codes, 'alias');
    for (const f of lex.sourceForms.get(rest) || []) push(f.lemma, codes, `source:${f.tag || ''}`);
    for (const g of generated.get(rest) || []) push(g.lemma, codes, `generated:${g.tag}`);
    if (pronominal.has(rest)) push(`pron:${rest}`, codes, 'pronominal');
  }
  return out;
}

// ---------- Attestation ----------
const phraseFirst = new Set([...lex.phrases.map(p => p.words[0]), ...[...REVIEWED_ARAMAIC.PHRASES, ...REVIEWED_ARAMAIC.HEBREW_CONTEXTS].map(([w]) => normalizeLookupToken(w.split(' ')[0]))]);
const { forms: attested, sequences } = await attestation({ phraseFirst });
log(`attested: ${attested.size} forms`);
// The Beit Yosef keeps its own statistics group (scripts/aramaic/corpora.mjs). The mixed profile is decided twice: with
// it (its Talmud quotations attest בתר, אזיל, דהכי …) and, where that leaves a form unresolved, without it (its Hebrew
// קני "reeds" and quoted מתני׳ must not outvote the Aramaic of Rashi and Tosafot). "Xc" is the mixed profile without it.
const mergeEntry = (a, b) => { if (!a || !b) return a || b ? { n: (a || b).n, cls: { ...(a || b).cls } } : undefined; const cls = { ...a.cls }; for (const [k, v] of Object.entries(b.cls)) cls[k] = (cls[k] || 0) + v; return { n: a.n + b.n, cls }; };
for (const f of attested.values()) { const by = f['@beit-yosef']; if (f.X) f.Xc = f.X; if (by) { f.X = mergeEntry(f.X, by); delete f['@beit-yosef']; } }
const freqInProfile = P => key => attested.get(key)?.[P]?.n || 0;

// A form is glossed in a profile unless it is Hebrew (or a name) there: the majority class of its tokens.
function glossableIn(entry) {
  if (!entry) return true;
  const cls = entry.cls;
  const aramaic = (cls.ARAMAIC_LEXICAL || 0) + (cls.UNCERTAIN || 0);
  const other = (cls.HEBREW || 0) + (cls.PROPER_NAME || 0) + (cls.NUMBER || 0);
  return aramaic > other;
}

// ---------- The review gate (pass 2) ----------
// The independent accuracy sample of 2026-09-30 (docs/dictionary/current-accuracy.md) measured the unreviewed analyses
// by the form's frequency in its corpus: 1.2% wrong at 200 uses or more, 12–45% below. Below REVIEW_GATE_MIN uses an
// unreviewed analysis is not published: it goes to the human review queue as a candidate (docs/dictionary/review/).
// The reviewed paradigms (the irregular verbs, the pronominal table) need REVIEW_GATE_PARADIGM uses.
export const REVIEW_GATE_MIN = 200;
export const REVIEW_GATE_PARADIGM = 20;
// The two small corpora, where a count says little: a form of Daniel/Ezra is published when Onkelos (the closest
// dialect) publishes the very same analysis; a form of the liturgy when the Targum, the Bavli or the Zohar does (the
// liturgy's Aramaic is theirs: the Kaddish, Yekum Purkan, the Arizal's zemirot). Measured on the first sample of pass 2:
// 29 of 30 such forms right. (The profiles are resolved in the order J Y M T Z B L X.)
const CROSS_CONFIRMATION = { B: ['T'], L: ['T', 'J', 'Z'] };
// Onkelos translates the Torah verse by verse: a candidate gloss is confirmed (published below the gate) when the Hebrew
// verse has the gloss word (or its root letters) in at least half of the form's verses, and in two verses at least —
// a deterministic check against the text the Targum renders, never a guess.
const onkelosOccurrences = new Map();
const torahVerse = new Map();
for await (const para of corpusParagraphs('hebrew-reference')) if (/^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\./.test(para.ref)) torahVerse.set(para.ref, tokenizeLookup(para.text).map(t => t.key));
for await (const para of corpusParagraphs('onkelos')) for (const t of tokenizeLookup(para.text)) { if (!onkelosOccurrences.has(t.key)) onkelosOccurrences.set(t.key, []); onkelosOccurrences.get(t.key).push(para.ref); }
const skeleton = w => w.replace(/[וי]/g, '');
const hebrewStem = t => t.replace(/^(ו)?(ה|ב|ל|כ|מ|ש)?/, '');
export function onkelosConfirmation(key, glosses) {
  const words = [...new Set(glosses.flatMap(g => String(g).split(/\s*[·,]\s*|\s+/)).map(w => normalizeLookupToken(w)).filter(w => w && w.length >= 2 && w !== 'של'))];
  const refs = onkelosOccurrences.get(key) || [];
  let ok = 0;
  for (const ref of refs) {
    const verse = torahVerse.get(ref) || [];
    if (verse.some(t => words.some(w => { if (t === w || hebrewStem(t) === w) return true; const k = skeleton(w); return k.length >= 3 ? skeleton(hebrewStem(t)).includes(k) || skeleton(t).includes(k) : k.length === 2 && skeleton(hebrewStem(t)) === k; }))) ok += 1;
  }
  return { n: refs.length, ok, confirmed: ok >= 2 && ok * 2 >= refs.length };
}

const reviewedForms = new Map();
for (const [form, gloss, profiles, basis] of REVIEWED.FORM_GLOSSES) { const k = normalizeLookupToken(form); if (!reviewedForms.has(k)) reviewedForms.set(k, []); reviewedForms.get(k).push({ gloss, profiles, basis }); }
const excludedForms = new Set((REVIEWED.EXCLUDED_FORMS || []).map(rule => normalizeLookupToken(rule.key)));
const excludedInProfile = new Map(REVIEWED_ARAMAIC.EXCLUDED_IN_PROFILES.map(([key, profiles]) => [normalizeLookupToken(key), profiles]));
const resolved = new Map(); // form → { P: { text, senseKey, tag, codes, via, lemma, sourceId } }
const unresolvedReasons = {};
const senseTable = new Map(); // `${gloss}\t${pos}\t${sourceId}` → id
const senseList = [];
const senseId = (gloss, pos, sourceId) => { const k = `${gloss}\t${pos}\t${sourceId}`; if (!senseTable.has(k)) { senseTable.set(k, senseList.length); senseList.push({ gloss, pos, sourceId }); } return senseTable.get(k); };
let ambiguousCount = 0;
const reviewRows = {};
for (const [key, f] of [...attested].sort((a, b) => cmp(a[0], b[0]))) {
  if (isAbbreviationKey(key) || key.length < 2 || excludedForms.has(key)) { if (TRACE && excludedForms.has(key)) for (const P of PROFILE_IDS) if (f[P]) traceRows.push({ key, P, n: f[P].n, cls: f[P].cls, status: 'excluded' }); continue; }
  const perP = {};
  for (const P of PROFILE_IDS) {
    let entry = f[P];
    if (!entry) continue;
    if (excludedInProfile.get(key)?.includes(P)) { if (TRACE) traceRows.push({ key, P, n: entry.n, cls: entry.cls, status: 'excluded' }); continue; }
    const reviewed = (reviewedForms.get(key) || []).find(rule => !rule.profiles || rule.profiles.includes(P));
    const decide = S => {
    let r;
    if (reviewed) r = { text: reviewed.gloss, tag: '', codes: '', lemma: key, sense: { glosses: [reviewed.gloss], sourceId: 'reviewed', via: `reviewed form: ${reviewed.basis}` }, pos: '', strength: 'reviewed' };
    else {
      r = resolveForm(key, P, freqInProfile(S), S);
      // Precision for the rare forms (fewer than RARE uses in this corpus, where no review reaches): only a reviewed
      // paradigm (irregular verb, pronominal table), or a bare headword whose sense the dictionary cites from this very
      // corpus or a reviewer chose. Anything else stays unresolved (missing is better than wrong).
      if (r && !r.unresolved && entry.n < (SMALL_CORPUS.includes(P) ? 3 : RARE) && !(r.strength === 'irregular' || r.strength === 'pronominal' || (r.strength === 'exact' && !r.codes && (/reviewed choice/.test(r.sense.via) || r.sense.via === `the sense cited from ${PROFILES[P].evidence[0]}`)))) r = { unresolved: true, top: r, reason: `RARE_UNREVIEWED ${r.lemma}/${r.tag}/${r.codes} "${r.text}"` };
      if (r && !r.unresolved && entry.n < (r.strength === 'irregular' || r.strength === 'pronominal' || r.strength === 'reviewed-base' ? REVIEW_GATE_PARADIGM : REVIEW_GATE_MIN)) {
        const confirmation = P === 'T' ? onkelosConfirmation(key, r.sense.glosses) : null;
        const confirmedBy = (CROSS_CONFIRMATION[P] || []).find(Q => perP[Q] && perP[Q].text === r.text);
        if (confirmation?.confirmed) r = { ...r, sense: { ...r.sense, via: `${r.sense.via}; confirmed by the Hebrew verse ${confirmation.ok}/${confirmation.n}` } };
        else if (confirmedBy) r = { ...r, sense: { ...r.sense, via: `${r.sense.via}; the same analysis published in ${PROFILES[confirmedBy].name}` } };
        else r = { unresolved: true, top: r, reason: `REVIEW_GATE ${r.lemma}/${r.tag || '-'}/${r.codes || '-'} "${r.text}" n=${entry.n}${confirmation ? ` verse ${confirmation.ok}/${confirmation.n}` : ''}` };
      }
    }
    return r;
    };
    let r = glossableIn(entry) ? decide(P) : 'not-glossable';
    if (P === 'X' && (r === 'not-glossable' || !r || r.unresolved) && f.Xc && f.Xc !== entry && glossableIn(f.Xc)) {
      // Published only when the Bavli profile reads the form the same way (its analysis, gated or not): the fallback
      // restores the Talmud's own words in Rashi and Tosafot, never a new reading of a Hebrew word (בהלכה, דלות).
      const core = (entry = f.Xc, decide('Xc'));
      const bavli = f.J && glossableIn(f.J) ? (perP.J || resolveForm(key, 'J', freqInProfile('J'))) : null;
      const bavliText = bavli && (bavli.unresolved ? bavli.top?.text : bavli.text);
      if (core && !core.unresolved && bavliText && bavliText === core.text) r = { ...core, sense: { ...core.sense, via: `${core.sense.via}; without the Beit Yosef's statistics` } };
      else entry = f.X;
    }
    if (r === 'not-glossable') { if (TRACE) traceRows.push({ key, P, n: entry.n, cls: entry.cls, status: 'not-glossable' }); continue; }
    if (TRACE) traceRows.push({ key, P, n: entry.n, cls: entry.cls, ...(r && !r.unresolved ? {} : { cands: looseCandidates(key) }), ...(r && !r.unresolved ? { status: 'resolved', text: r.text, lemma: r.lemma, tag: r.tag, codes: r.codes, strength: r.strength, sourceId: r.sense.sourceId, kind: r.sense.kind || '', via: r.sense.via } : { status: 'unresolved', reason: r?.unresolved ? r.reason : 'NO_ANALYSIS', lemma: r?.top?.lemma || '', sourceId: r?.top?.sense?.sourceId || '', kind: r?.top?.sense?.kind || '', candidate: r?.top?.text || (r?.top?.sense && !r.top.sense.ambiguous ? r.top.sense.glosses?.join(' · ') : ''), candidateStrength: r?.top?.strength || '', candidateVia: r?.top?.sense?.via || '' }) });
    if (!r || r.unresolved) { if (r?.unresolved) ambiguousCount += 1; (reviewRows[P] ||= []).push({ key, n: entry.n, text: '', via: r?.unresolved ? r.reason : 'NO ANALYSIS', lemma: r?.top?.lemma }); continue; }
    perP[P] = r;
    (reviewRows[P] ||= []).push({ key, n: entry.n, text: r.text, via: `${r.lemma}/${r.tag || '-'}/${r.codes || '-'}/${r.strength}/${r.sense.via}`, lemma: r.lemma });
  }
  if (Object.keys(perP).length) resolved.set(key, perP);
}
log(`resolved: ${resolved.size} forms; ambiguous (left out) ${ambiguousCount}`);

// ---------- Phrases ----------
const phraseRows = [];
const reviewedPhrases = REVIEWED_ARAMAIC.PHRASES.map(([words, gloss, why]) => ({ words: words.split(' '), gloss, why }));
const excludedPhrases = new Set(REVIEWED_ARAMAIC.EXCLUDED_PHRASES.map(w => w.split(' ').map(normalizeLookupToken).join(' ')));
const phraseMap = new Map();
for (const p of [...lex.phrases, ...reviewedPhrases.map(r => ({ words: r.words.map(normalizeLookupToken), gloss: r.gloss, sourceId: r.sourceId || 'reviewed', entryId: r.why, evidence: {}, senses: 1 }))]) {
  const k = p.words.join(' ');
  if (!phraseMap.has(k)) phraseMap.set(k, []);
  phraseMap.get(k).push(p);
}
for (const [k, list] of [...phraseMap].sort((a, b) => cmp(a[0], b[0]))) {
  const s = sequences.get(k);
  if (!s) { reject('phrase-not-in-app-texts', k); continue; }
  const glosses = [...new Set(list.filter(p => p.sourceId === (list.some(x => x.sourceId === 'reviewed') ? 'reviewed' : list.some(x => x.sourceId === 'krupnik-1927') ? 'krupnik-1927' : list[0].sourceId)).map(p => p.gloss))];
  if (glosses.length !== 1) { reject('phrase-several-senses', `${k}: ${glosses.join(' | ')}`); continue; }
  const src = list.find(p => p.gloss === glosses[0]);
  if (excludedPhrases.has(k)) { reject('phrase-excluded-in-review', k); continue; }
  // A phrase is an Aramaic phrase where at least one of its words is Aramaic there (the majority class of its tokens):
  // an all-Hebrew expression (בית המדרש) is not glossed as a phrase — tapping its words would block the reader.
  const words = k.split(' ');
  const profiles = Object.keys(s).filter(P => src.sourceId === 'reviewed' || words.some(w => { const e = attested.get(w)?.[P]; return e && (e.cls.ARAMAIC_LEXICAL || 0) > (e.n - (e.cls.ARAMAIC_LEXICAL || 0)); })).sort();
  if (!profiles.length) { reject('phrase-all-hebrew', k); continue; }
  phraseRows.push({ words, gloss: glosses[0], sourceId: src.sourceId, entryId: src.entryId, profiles: profiles.join('') });
}

// Hebrew contexts (pass 2): a sequence in which the word is Hebrew — an empty gloss, the runtime shows nothing.
for (const [words0] of REVIEWED_ARAMAIC.HEBREW_CONTEXTS) {
  const words = words0.split(' ').map(normalizeLookupToken);
  const s = sequences.get(words.join(' '));
  if (!s) { reject('hebrew-context-not-in-app-texts', words0); continue; }
  phraseRows.push({ words, gloss: '', sourceId: 'reviewed', entryId: 'Hebrew context', profiles: PROFILE_IDS.join('') });
}
phraseRows.sort((a, b) => cmp(a.words.join(' '), b.words.join(' ')));

// ---------- Abbreviations ----------
const abbreviationRows = [];
const abbrChoices = new Map();
for (const rule of [...(REVIEWED.CONTEXT_CHOICES || []), ...(REVIEWED.ABBREVIATION_CHOICES || [])]) { const k = normalizeLookupToken(rule.key); if (!abbrChoices.has(k)) abbrChoices.set(k, []); abbrChoices.get(k).push(rule); }

for (const [key, list] of [...lex.abbreviations].sort((a, b) => cmp(a[0], b[0]))) {
  const primary = list.some(x => x.sourceId === 'krupnik-1927') ? list.filter(x => x.sourceId === 'krupnik-1927') : list;
  const expansions = [...new Set(primary.map(x => x.expansion))].filter(e => e.split(/\s+/).length <= 6);
  const choices = abbrChoices.get(key);
  const f = attested.get(key);
  if (!f) continue;
  if (choices) {
    for (const rule of choices) {
      if (!list.some(x => x.expansion === rule.gloss)) { if (EXCLUDE.length) continue; fail(`reviewed abbreviation choice ${rule.key} → ${rule.gloss} is not a sense the sources give`); }
      // Abbreviations are read by the reader family itself (ת״ש is תא שמע in the Gemara and its commentaries only).
      abbreviationRows.push({ key, gloss: rule.gloss, profiles: rule.families === null ? '*' : [...rule.families].sort().join(','), sourceId: list.find(x => x.expansion === rule.gloss).sourceId });
    }
    continue;
  }
  // One expansion, or two short ones shown together "א · ב"; more are ambiguous (nothing is shown).
  const limit = (REVIEWED.FAMILY_LIMITS || []).find(rule => normalizeLookupToken(rule.key) === key);
  if (limit && expansions.length >= 1) { const e = list.find(x => expansions.includes(x.expansion)); if (expansions.length === 1) { abbreviationRows.push({ key, gloss: expansions[0], profiles: [...limit.families].sort().join(','), sourceId: e.sourceId }); continue; } }
  if (expansions.length === 1 || (expansions.length === 2 && expansions.join(' ').split(/\s+/).length <= 7)) for (const e of expansions) abbreviationRows.push({ key, gloss: e, profiles: '*', sourceId: primary.find(x => x.expansion === e).sourceId });
  else reject('abbreviation-ambiguous', `${key}: ${expansions.join(' | ')}`);
}

// ---------- Abbreviations: the open-sources layer (source fusion + context by reader group) ----------
// Every source's readings of every abbreviation of the app's texts (Krupnik, Wiktionary, Jastrow's "(abbr. …)", the
// Ben-Yehuda ספר ראשי תיבות), each checked against its letters; a key the rules above already decided keeps that
// decision. scripts/dictionary/aramaic/abbreviations.mjs has the rules.
const jastrowAbbr = usable('jastrow-1903') ? extractJastrowAbbreviations(raw['jastrow-1903']) : [];
const benYehudaAbbr = usable('ben-yehuda-rt') ? parseBenYehudaAbbreviations(raw['ben-yehuda-rt']) : [];
const openCandidates = new Map();
const addCandidate = (key, c) => { if (!openCandidates.has(key)) openCandidates.set(key, []); openCandidates.get(key).push(c); };
for (const [key, list] of lex.abbreviations) for (const x of list) addCandidate(key, { expansion: x.expansion, sourceId: x.sourceId, fit: initialsFit(key, x.expansion), substituted: false, entry: x.entryId });
for (const r of jastrowAbbr) addCandidate(r.key, { expansion: r.expansion, sourceId: 'jastrow-1903', fit: r.fit, substituted: r.substituted, entry: r.sourceEntry, rawPattern: r.rawPattern });
for (const r of benYehudaAbbr) addCandidate(r.key, { expansion: r.expansion, sourceId: 'ben-yehuda-rt', fit: r.fit, substituted: false, entry: `37578:${r.key}`, rawPattern: r.rawPattern, readings: r.readings });
const legacyKeys = new Set(abbreviationRows.map(r => r.key));
const attestedAbbr = [...attested.keys()].filter(k => isAbbreviationKey(k));
const evidencePhrases = new Set();
for (const k of attestedAbbr) for (const c of openCandidates.get(k) || []) { const pk = phraseKey(c.expansion); if (pk) evidencePhrases.add(pk); }
for (const pk of prefixedPhrases(attestedAbbr, openCandidates)) evidencePhrases.add(pk);
const abbrEvidence = await abbreviationEvidence(evidencePhrases, { tracked: new Set(attestedAbbr.filter(k => openCandidates.has(k) || [...'ודלבכמ'].some(p => k.startsWith(p) && openCandidates.has(k.slice(1))))) });
// The share of a word among the app's words that begin with the same letters (for a word cut off with a geresh).
const prefixTotals = new Map();
const formTotal = new Map();
for (const [key, f] of attested) {
  if (isAbbreviationKey(key)) continue;
  const n = Object.values(f).reduce((a, e) => a + e.n, 0);
  formTotal.set(key, n);
  for (let len = 2; len <= Math.min(5, key.length - 1); len += 1) prefixTotals.set(key.slice(0, len), (prefixTotals.get(key.slice(0, len)) || 0) + n);
}
const abbrWithheld = new Map((REVIEWED_ARAMAIC.ABBREVIATIONS_WITHHELD || []).map(([key, groups]) => [normalizeLookupToken(key), groups]));
const truncationShare = (stem, word) => { const total = prefixTotals.get(stem) || 0; return total ? (formTotal.get(word) || 0) / total : 0; };
const fused = fuseAbbreviations(new Map(attestedAbbr.filter(k => openCandidates.has(k)).map(k => [k, openCandidates.get(k)])), abbrEvidence, { skip: legacyKeys, truncationShare, wordCount: w => formTotal.get(w) || 0, withheld: abbrWithheld });
// The bases a proclitic may stand on: every key the fusion rules decide in a group — the keys the first rules decided
// included (a base decided there globally, מ״ש "מאי שנא", is taken only where the fusion agrees in that group).
const fusedAll = fuseAbbreviations(new Map(attestedAbbr.filter(k => openCandidates.has(k)).map(k => [k, openCandidates.get(k)])), abbrEvidence, { truncationShare, wordCount: w => formTotal.get(w) || 0, withheld: abbrWithheld });
const legacyReading = new Map(abbreviationRows.map(r => [r.key, r.gloss]));
const decidedBases = new Map();
for (const [key, byGroup] of fusedAll.decided) {
  const keep = Object.fromEntries(Object.entries(byGroup).filter(([, d]) => !legacyKeys.has(key) || legacyReading.get(key) === d.expansion));
  if (Object.keys(keep).length) decidedBases.set(key, keep);
}
const prefixed = prefixedDecisions(attestedAbbr, abbrEvidence, decidedBases, new Set([...openCandidates.keys(), ...legacyKeys]));
// Where the fusion reads a key of the first rules otherwise in a group, the difference goes to the review queue.
const legacyConflicts = fusedAll.decisions.filter(d => legacyKeys.has(d.key) && !abbreviationRows.some(r => r.key === d.key && r.gloss === d.expansion));
// The row's source: a cleared public-domain source first (Jastrow, Ben-Yehuda), then Wiktionary, then Krupnik.
const ABBR_SOURCE_ORDER = ['jastrow-1903', 'ben-yehuda-rt', 'he-wiktionary', 'krupnik-1927'];
const openRows = abbreviationRowsOf([...fused.decisions, ...prefixed]);
for (const r of openRows) abbreviationRows.push({ key: r.key, gloss: r.gloss, profiles: r.profiles, sourceId: ABBR_SOURCE_ORDER.find(s => r.sourceIds.includes(s)) || r.sourceIds[0] });
abbreviationRows.sort((a, b) => cmp(a.key, b.key) || cmp(a.gloss, b.gloss));
log(`abbreviations: ${legacyKeys.size} keys by the first rules; open-sources layer +${new Set(openRows.map(r => r.key)).size} keys (${fused.decisions.length} group decisions, ${prefixed.length} proclitic); ${fused.review.length} withheld for review`);
// The generated Jastrow table (sources/jastrow/generated/abbreviations.tsv) and the review queue of the withheld ones.
const openByKey = new Map(openRows.map(r => [`${r.key}\t${r.gloss}`, r]));
const jastrowTsv = ['abbreviation\texpansion\tprofile\tsourceEntry\trawPattern\tconfidence\tstatus', ...jastrowAbbr.map(r => {
  const row = openByKey.get(`${r.key}\t${r.expansion}`);
  const legacy = abbreviationRows.find(a => a.key === r.key && a.gloss === r.expansion && !openByKey.has(`${a.key}\t${a.gloss}`));
  const confidence = !r.fit ? 'LOW' : r.substituted ? 'MEDIUM' : 'HIGH';
  const status = !r.fit ? 'REJECTED_INITIALS' : row ? `PRODUCTION (${row.agreement})` : legacy ? 'DUPLICATE_OF_EXISTING' : legacyKeys.has(r.key) ? 'CONFLICT_WITH_EXISTING' : attested.has(r.key) ? 'CANDIDATE' : 'NOT_IN_CORPUS';
  return [r.key, r.expansion, row ? row.profiles : '', r.sourceEntry, r.rawPattern.replace(/\t/g, ' '), confidence, status].join('\t');
})].join('\n') + '\n';
const abbrReviewTsv = ['abbreviation\tgroup\ttokens\tagreement\treadings [sources; written-out count]', ...legacyConflicts.sort((a, b) => b.n - a.n || cmp(a.key, b.key)).map(d => [d.key, d.group, d.n, 'CONFLICT_WITH_EXISTING', `existing: ${abbreviationRows.filter(r => r.key === d.key).map(r => r.gloss).join(' / ')} | open sources: ${d.expansion} [${d.sourceIds.join('+')}; ${d.rule}]`].join('\t')), ...fused.review.sort((a, b) => b.n - a.n || cmp(a.key, b.key)).slice(0, 1000).map(r => [r.key, r.group, r.n, r.agreement, r.readings.slice(0, 8).join(' | ')].join('\t'))].join('\n') + '\n';
const abbreviationLayer = { jastrowExtracted: jastrowAbbr.length, jastrowKeys: new Set(jastrowAbbr.map(r => r.key)).size, benYehudaReadings: benYehudaAbbr.length, benYehudaKeys: new Set(benYehudaAbbr.map(r => r.key)).size, legacyKeys: legacyKeys.size, openKeys: new Set(openRows.map(r => r.key)).size, openRows: openRows.length, groupDecisions: fused.decisions.length, proclitic: prefixed.length, withheld: fused.review.length, conflictsWithExisting: legacyConflicts.length, byAgreement: openRows.reduce((acc, r) => ({ ...acc, [r.agreement]: (acc[r.agreement] || 0) + 1 }), {}), rowsBySource: {} };

// ---------- Output ----------
const SOURCE_CODES = ['krupnik-1927', 'jastrow-1903', 'he-wiktionary', 'grammar', 'reviewed', 'ben-yehuda-rt'];
const formLines = [];
for (const [key, perP] of [...resolved].sort((a, b) => cmp(a[0], b[0]))) {
  // Group profiles with the same analysis.
  const groups = new Map();
  for (const P of PROFILE_IDS) {
    const r = perP[P];
    if (!r) continue;
    const ids = r.sense.glosses.map(g => senseId(g, r.pos || '', SOURCE_CODES.includes(r.sense.sourceId) ? r.sense.sourceId : 'reviewed')).join('+');
    const code = `${ids}|${r.tag === 'fixed' || r.strength === 'reviewed-base' ? '' : r.tag}|${r.codes || ''}|${r.strength === 'reviewed' ? 'R' : ''}`;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(P);
  }
  formLines.push(`${key}\t${[...groups].map(([code, ps]) => `${ps.length === PROFILE_IDS.length ? '*' : ps.join('')}|${code}`).join(';')}`);
}
const SENSES = senseList.map(s => [s.gloss, s.pos, SOURCE_CODES.indexOf(s.sourceId)].join('\t')).join('\n');
const FORMS = formLines.join('\n');
const PHRASES = phraseRows.map(p => [p.words.join(' '), p.gloss, p.profiles, SOURCE_CODES.indexOf(p.sourceId)].join('\t')).join('\n');
const ABBREVIATIONS = abbreviationRows.map(a => [a.key, a.gloss, a.profiles, SOURCE_CODES.indexOf(a.sourceId)].join('\t')).join('\n');
// NOFALLBACK: the forms of the app's texts that the build left unresolved but that the runtime fallback (proclitics off
// a known form) would gloss — the runtime must not undo a decision of the build (a rare form, ד + a Hebrew word).
const engineModule = await import('../../src/services/wordLookup/engine.mjs');
engineModule.setWordDictionary({ SOURCE_CODES, SENSES, FORMS, PHRASES: '', ABBREVIATIONS: '', NOFALLBACK: '' });
const noFallback = [];
for (const [key, f] of [...attested].sort((a, b) => cmp(a[0], b[0]))) {
  if (resolved.has(key) || isAbbreviationKey(key)) continue;
  if (['J', 'Y', 'T', 'Z'].some(P => f[P] && engineModule.resolveAramaicSurfaceForm({ rawToken: key, corpus: PROFILES[P].corpora[0] }))) noFallback.push(key);
}
const NOFALLBACK = noFallback.join('\n');
const version = `${ENGINE_RULES_VERSION}.${LOOKUP_NORMALIZER_VERSION}.${sha256(SENSES + FORMS + PHRASES + ABBREVIATIONS + NOFALLBACK).slice(0, 12)}`;
const header = `// GENERATED by scripts/dictionary/build-aramaic-engine.mjs — do not edit. The Aramaic engine of the word lookup.
// Sources (src/data/dictionary/sources.mjs): ${importedSources().filter(s => !EXCLUDE.includes(s.sourceId)).map(s => `${s.sourceId} (${s.licenceId})`).join('; ')}.
// Glosses whose source code is ${SOURCE_CODES.indexOf('he-wiktionary')} (he-wiktionary) are adapted from Hebrew Wiktionary and shared under CC BY-SA 4.0
// (https://creativecommons.org/licenses/by-sa/4.0/); code ${SOURCE_CODES.indexOf('grammar')} is the engine's own grammar table; the rest is public domain.
// SENSES: gloss \\t part of speech \\t source code (${SOURCE_CODES.map((s, i) => `${i} ${s}`).join(', ')})
// FORMS: key \\t analyses — "profiles|sense ids (a+b: two senses)|tag|proclitics|R (reviewed)" joined by ";" — profiles:
//        ${PROFILE_IDS.map(P => `${P} ${PROFILES[P].name}`).join(', ')}; "*" all
// PHRASES: keys \\t gloss \\t profiles \\t source code.  ABBREVIATIONS: key \\t expansion \\t reader families or groups (@talmud @kabbalah @rabbinic; "*" all) \\t source code.
// NOFALLBACK: forms of the app's texts the runtime must not take apart (the build left them unresolved).
`;
const moduleText = `${header}export const DICTIONARY_VERSION = ${JSON.stringify(version)};
export const SOURCE_CODES = ${JSON.stringify(SOURCE_CODES)};
export const SENSES = ${JSON.stringify(SENSES)};
export const FORMS = ${JSON.stringify(FORMS)};
export const PHRASES = ${JSON.stringify(PHRASES)};
export const ABBREVIATIONS = ${JSON.stringify(ABBREVIATIONS)};
export const NOFALLBACK = ${JSON.stringify(NOFALLBACK)};
`;

// The reviewable gloss table (Phase 4): lemma | dialect | glossHe | source | reviewStatus.
const lemmaRows = ['lemma\tdialects\tglossHe\tsource\tkind\treviewStatus'];
for (const [key, lemma] of [...lex.lemmas].sort((a, b) => cmp(a[0], b[0]))) {
  const byGloss = new Map();
  for (const P of PROFILE_IDS) {
    const s = chooseSense(lemma, lemma.pos === 'v' ? 'pe' : '', P);
    if (!s || s.ambiguous) continue;
    const row = [s.glosses.join(' · '), s.sourceId, s.kind, senseChoices.has(`${key}\t${P}`) ? 'reviewed' : s.via === 'single sense' ? 'source-single-sense' : `rule: ${s.via}`].join('\t');
    if (!byGloss.has(row)) byGloss.set(row, []);
    byGloss.get(row).push(PROFILES[P].dialect);
  }
  for (const [row, dialects] of byGloss) { const [g, ...rest] = row.split('\t'); lemmaRows.push([key, [...new Set(dialects)].join(','), g, ...rest].join('\t')); }
}
const lemmasTsv = lemmaRows.join('\n') + '\n';
const counts = {
  lemmas: lex.lemmas.size, lemmasWithHebrewGloss: [...lex.lemmas.values()].filter(l => l.senses.some(s => s.gloss)).length,
  printedForms: lex.sourceForms.size, aliases: lex.aliases.size, generatedCandidates: generated.size, attestedForms: attested.size,
  resolvedForms: resolved.size, ambiguousLeftOut: ambiguousCount, senses: senseList.length, phrases: phraseRows.length, abbreviations: abbreviationRows.length,
  sensesBySource: senseList.reduce((acc, s) => ({ ...acc, [s.sourceId]: (acc[s.sourceId] || 0) + 1 }), {}),
  moduleBytes: Buffer.byteLength(moduleText),
  abbreviationLayer: { ...abbreviationLayer, rowsBySource: abbreviationRows.reduce((acc, r) => ({ ...acc, [r.sourceId]: (acc[r.sourceId] || 0) + 1 }), {}) },
};
const report = { rulesVersion: ENGINE_RULES_VERSION, normalizerVersion: LOOKUP_NORMALIZER_VERSION, excludedSources: EXCLUDE, sources: DICTIONARY_SOURCES.map(s => ({ sourceId: s.sourceId, imported: s.imported, contentHash: s.contentHash || null })), counts, rejections: Object.fromEntries(Object.entries(rejections).sort((a, b) => cmp(a[0], b[0]))) };
if (TRACE) {
  // Lemma facts for the audits: senses by source, Jastrow's English (for the review queues), homographs.
  const lemmaFacts = {};
  for (const [key, l] of lex.lemmas) lemmaFacts[key] = { pos: l.pos || '', senses: l.senses.map(s => [s.gloss || '', s.sourceId, s.kind || '', s.stem || '']), en: (l.english || []).join(' || ').slice(0, 400), hom: l.jastrowHomographs || 0 };
  writeFileSync(TRACE, traceRows.map(r => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(TRACE.replace(/\.jsonl$/, '') + '.lemmas.json', JSON.stringify(lemmaFacts));
  writeFileSync(TRACE.replace(/\.jsonl$/, '') + '.phrases.json', JSON.stringify(phraseRows));
  writeFileSync(TRACE.replace(/\.jsonl$/, '') + '.abbreviations.json', JSON.stringify({ decisions: [...fused.decisions, ...prefixed], review: fused.review, conflicts: legacyConflicts, reviewAll: fusedAll.review }));
}
if (OUT_DIR) { mkdirSync(OUT_DIR, { recursive: true }); writeFileSync(join(OUT_DIR, 'wordDictionary.mjs'), moduleText); }
const outputs = EXCLUDE.length || OUT_DIR ? [] : [
  ['src/data/dictionary/wordDictionary.mjs', moduleText],
  ['sources/word-dictionary/build-report.json', JSON.stringify(report, null, 1) + '\n'],
  ['sources/word-dictionary/lemmas.tsv', lemmasTsv],
  ['sources/word-dictionary/build-manifest.json', JSON.stringify({ inputs: buildInputs(), output: sha256(moduleText) }, null, 1) + '\n'],
  ['sources/jastrow/generated/abbreviations.tsv', jastrowTsv],
  ['docs/dictionary/review/abbreviations-withheld.tsv', abbrReviewTsv],
];
if (REVIEW) {
  mkdirSync(join(ROOT, 'docs/dictionary/review'), { recursive: true });
  for (const P of PROFILE_IDS) {
    const rows = (reviewRows[P] || []).sort((a, b) => b.n - a.n || cmp(a.key, b.key)).slice(0, 1000);
    const info = key => { const l = lex.lemmas.get(key) || lex.lemmas.get(r => r); if (!l) return ''; return `${l.pos || '?'} ${l.senses.map(s => `${s.gloss}[${s.sourceId[0]}:${s.kind}${s.stem ? `:${s.stem}` : ''}${Object.keys(s.evidence || {}).length ? `:${Object.keys(s.evidence).join('+')}` : ''}]`).join(' ; ')} || ${(l.english || []).join(' || ').slice(0, 300)}`; };
    const lexInfo = r => [r.key, r.lemma].filter((x, i, a) => x && a.indexOf(x) === i).map(k => (lex.lemmas.has(k) ? `{${k}} ${info(k)}` : '')).filter(Boolean).join('  ##  ');
    writeFileSync(join(ROOT, `docs/dictionary/review/top-forms-${PROFILES[P].name}.tsv`), ['rank\tform\tcount\tgloss\tanalysis\tlexicon', ...rows.map((r, i) => `${i + 1}\t${r.key}\t${r.n}\t${r.text}\t${r.via}\t${lexInfo(r)}`)].join('\n') + '\n');
  }
}
// (A build without a source — an analysis build — lets the reviewed decisions that rest on that source fall away.)
if (reviewErrors.length && EXCLUDE.length) console.error(`${new Set(reviewErrors).size} reviewed decisions rest on the excluded source(s) and are left out`);
else if (reviewErrors.length) { console.error([...new Set(reviewErrors)].join('\n')); fail(`${new Set(reviewErrors).size} reviewed decisions do not match the sources`); }
if (CHECK) {
  const stale = outputs.filter(([path, text]) => { try { return readFileSync(join(ROOT, path), 'utf8') !== text; } catch { return true; } }).map(([path]) => path);
  if (stale.length) fail(`outputs are stale (run the build): ${stale.join(', ')}`);
  console.log('aramaic engine: up to date');
} else {
  mkdirSync(join(ROOT, 'sources/word-dictionary'), { recursive: true });
  mkdirSync(join(ROOT, 'sources/jastrow/generated'), { recursive: true });
  for (const [path, text] of outputs) writeFileSync(join(ROOT, path), text);
  console.log(JSON.stringify(counts, null, 1));
}
