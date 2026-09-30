// The abbreviation layer of the open-sources pass (build time only): source fusion with agreement scoring and a
// context engine by reader family. Never a global mapping of an abbreviation with several readings: a reading is
// published in a reader group only when the evidence of that group decides it.
//
// Reader groups (the reader families of src/services/wordLookup/engine.mjs):
//   talmud   — talmud, talmud-commentary
//   kabbalah — zohar, kabbalah, chassidut
//   rabbinic — every other family (midrash, the commentaries, halacha, responsa, liturgy …)
// Evidence, per group, from the app's own texts (a deterministic count, cached like the attestation):
//   · how often the abbreviation occurs there;
//   · how often each candidate reading occurs there written out in full.
// Sources (independent originals; a copy of one original counts once): krupnik-1927, jastrow-1903, he-wiktionary,
// ben-yehuda-rt. Agreement: 3+ sources HIGH, 2 MEDIUM-HIGH, 1 REVIEW (published only with the texts' confirmation),
// conflicting readings AMBIGUOUS (published only where the texts decide between them).
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { CORPORA, corpusParagraphs, listPackWorks, LITURGY_MODULES, OTHER_MODULES, ROOT } from '../../aramaic/corpora.mjs';
import { tokenizeLookup, normalizeLookupToken, isAbbreviationKey } from '../../../src/services/wordLookup/normalize.mjs';
import { lookupFamilyForWork, lookupFamilyForLayer } from '../../../src/services/wordLookup/families.mjs';
import { initialsFit, lettersOf } from '../lexica/abbreviations.mjs';
import { READER_GROUPS } from '../../../src/services/wordLookup/aramaic/profiles.mjs';
export { READER_GROUPS };

const GROUP_IDS = Object.keys(READER_GROUPS);
export const groupOfFamily = family => GROUP_IDS.find(g => READER_GROUPS[g].includes(family)) || 'rabbinic';

// The thresholds of the fusion rules (fixed; changing one is reported with the pass).
export const MIN_ABBR_TOKENS = 3; // the abbreviation occurs at least this often in the group
export const MIN_FULL_CONFIRM = 10; // a single-source single reading: written out this often in the same group …
export const SIM_MIN = 0.25; // the context engine: cosine of the words around the abbreviation and around the reading
export const SIM_TRUNCATION = 0.4; // a word cut off with a geresh: this context, or TRUNCATION_SHARE of the words so beginning
export const SIM_PREFIX = 0.15; // a proclitic on a decided abbreviation
export const SIM_MARGIN = 0.6; // every other written-out reading of the key: at most this fraction of the chosen one's context score (a proclitic reading: below it)
export const SIM_MARGIN_PROCLITIC = 0.9; // a proclitic reading (ו + the reading of the rest): below this fraction
export const MIN_COMPETITOR = 3; // a reading written out this often (in any group) competes
export const MIN_SHARE_OF_WRITTEN = 0.05; // the chosen reading: at least this share of all the written-out readings
export const WORD_WITH_GERSHAYIM = 50; // letters that are themselves a word this frequent (ישרא״ל, הו״א): no single-source reading
// Shortest first: ו + כמ״ש is tried before וכ + מ״ש.
export const PREFIXES = Object.freeze(['ו', 'ד', 'ל', 'ב', 'כ', 'מ', 'וד', 'ול', 'וב', 'וכ', 'ומ']);
const PROCLITIC_LETTERS = 'ודלבכמשה';
// The names of the letters, written with gershayim (וי״ו is the letter Vav, not ו + י״ו).
const LETTER_NAMES = new Set(['אל״פ', 'בי״ת', 'גימ״ל', 'דל״ת', 'וי״ו', 'וא״ו', 'זי״נ', 'חי״ת', 'טי״ת', 'למ״ד', 'נו״נ', 'סמ״כ', 'עי״נ', 'צד״י', 'קו״פ', 'רי״ש', 'שי״נ', 'תי״ו']);

// A Hebrew numeral written with gershayim or a geresh (ט״ו 15, ע״ב 72, ר״ה 205): its value, or 0 when the letters are
// not a numeral (ascending values: ג״כ, א״ל).
const LETTER_VALUE = Object.fromEntries([...'אבגדהוזחטיכלמנסעפצקרשת'].map((l, i) => [l, i < 10 ? i + 1 : i < 19 ? (i - 8) * 10 : (i - 17) * 100]));
// A canonical numeral: gershayim before its last letter (or a lone letter with a geresh), values descending, one letter
// per order (tens, units) but for repeated hundreds (תת), and ט״ו ט״ז for 15, 16. סי׳ (a word cut off) is not one.
export function numeralValue(key) {
  const letters = lettersOf(key);
  if (!letters || letters.length > 4) return 0;
  if (letters.length === 1 ? !/׳$/.test(key) : !new RegExp(`״${letters.at(-1)}$`).test(key)) return 0;
  let total = 0;
  let last = Infinity;
  const orders = new Set();
  // ט״ו ט״ז (15, 16) at the end: one units-and-tens pair.
  const fifteen = /ט[וז]$/.test(letters);
  for (const l of fifteen ? letters.slice(0, -2) : letters) {
    const v = LETTER_VALUE[l];
    if (!v || v > last) return 0;
    const order = v >= 100 ? 'h' : v >= 10 ? 't' : 'u';
    if (order !== 'h' && orders.has(order)) return 0;
    orders.add(order); total += v; last = v;
  }
  if (fifteen) { if (last < 10 || orders.has('t') || orders.has('u')) return 0; total += letters.endsWith('ו') ? 15 : 16; }
  if (/יה$|יו$/.test(letters)) return 0;
  return total;
}

// The reader family of a paragraph of the corpus registry (the audit's rule).
function familyOf(para) {
  if (para.corpus === 'onkelos') return 'targum';
  if (para.corpus === 'liturgy') return 'liturgy';
  if (para.corpus === 'biblical-aramaic') return 'biblical-aramaic';
  if (!para.pack) return 'torah';
  const work = { workId: para.work, primaryCategory: para.category };
  return (/commentary/.test(para.category || '') || /_on_/.test(para.work || '') ? lookupFamilyForLayer({ work }) : lookupFamilyForWork(work)) || 'torah';
}

function inputsHash(phrases, tracked) {
  const h = createHash('sha256').update('abbreviation-evidence:2');
  for (const f of [...listPackWorks().map(w => w.file), ...LITURGY_MODULES, ...OTHER_MODULES, 'scripts/aramaic/corpora.mjs']) { try { const s = statSync(join(ROOT, f)); h.update(`${f}:${s.size}:${s.mtimeMs}`); } catch { h.update(`${f}:missing`); } }
  h.update([...phrases].sort().join('\n'));
  h.update([...tracked].sort().join('\n'));
  return h.digest('hex').slice(0, 16);
}

// The context words that say nothing (they stand beside everything).
const STOP = new Set(['ו', 'של', 'את', 'על', 'הוא', 'היא', 'לא', 'כי', 'אמ', 'זה', 'זו', 'אל', 'מנ', 'כל', 'גמ', 'או', 'אבל', 'לו', 'לה', 'בו', 'בה', 'שמ', 'כנ', 'עמ', 'אינ', 'יש', 'היה', 'הימ', 'המ', 'אשר', 'אלא', 'מה', 'דלא', 'לא', 'הכי', 'נמי', 'ליה', 'דה', 'הא', 'אי', 'עד', 'רק', 'אחר', 'וכו׳', 'וגו׳']);
const CONTEXT_KEEP = 60;

// Counts, per reader group: every abbreviation token (key → n) and every candidate phrase written out in full
// (phrase key "w1 w2 …" → n); and the words beside them (the word before, marked "<", and after, ">") for the tracked
// abbreviations and every phrase — their 60 commonest, function words left out. Cached on disk between runs of the
// same inputs (a convenience; never committed).
export async function abbreviationEvidence(phrases, { tracked = new Set(), cacheDir = join(tmpdir(), 'kazzohar-aramaic-cache') } = {}) {
  const cacheFile = join(cacheDir, `abbr-evidence-${inputsHash(phrases, tracked)}.json.gz`);
  if (existsSync(cacheFile)) { const d = JSON.parse(gunzipSync(readFileSync(cacheFile)).toString('utf8')); return { abbr: new Map(d.abbr), full: new Map(d.full), ctx: new Map(d.ctx.map(([k, v]) => [k, new Map(v)])) }; }
  const byFirst = new Map();
  for (const p of phrases) { const ws = p.split(' '); if (!byFirst.has(ws[0])) byFirst.set(ws[0], []); byFirst.get(ws[0]).push(ws); }
  const abbr = new Map(); // key → { group: n }
  const full = new Map(); // phrase → { group: n }
  const ctx = new Map(); // key or phrase → Map(context word → n)
  const bump = (map, k, g) => { let e = map.get(k); if (!e) { e = {}; map.set(k, e); } e[g] = (e[g] || 0) + 1; };
  const note = (k, before, after) => {
    let m = ctx.get(k);
    if (!m) { m = new Map(); ctx.set(k, m); }
    if (before && !STOP.has(before)) m.set(`<${before}`, (m.get(`<${before}`) || 0) + 1);
    if (after && !STOP.has(after)) m.set(`>${after}`, (m.get(`>${after}`) || 0) + 1);
    // (A long map is cut to its commonest entries now and then, to keep memory bounded.)
    if (m.size > 4000) { const top = [...m].sort((a, b) => b[1] - a[1]).slice(0, 1000); m.clear(); for (const [w, n] of top) m.set(w, n); }
  };
  for (const corpus of CORPORA.filter(c => c.role !== 'hebrew-reference')) {
    for await (const para of corpusParagraphs(corpus.id)) {
      const g = groupOfFamily(familyOf(para));
      const keys = tokenizeLookup(para.text).map(t => t.key);
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        if (isAbbreviationKey(k)) { bump(abbr, k, g); if (tracked.has(k)) note(k, keys[i - 1], keys[i + 1]); continue; }
        const cands = byFirst.get(k);
        if (!cands) continue;
        for (const ws of cands) { let ok = true; for (let j = 1; j < ws.length; j += 1) if (keys[i + j] !== ws[j]) { ok = false; break; } if (ok) { const pk = ws.join(' '); bump(full, pk, g); note(pk, keys[i - 1], keys[i + ws.length]); } }
      }
    }
  }
  for (const [k, m] of ctx) ctx.set(k, new Map([...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, CONTEXT_KEEP)));
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cacheFile, gzipSync(JSON.stringify({ abbr: [...abbr], full: [...full], ctx: [...ctx].map(([k, m]) => [k, [...m]]) })));
  return { abbr, full, ctx };
}

// The cosine of two context profiles (0 when either is unknown).
export function contextSimilarity(evidence, a, b) {
  const x = evidence.ctx?.get(a);
  const y = evidence.ctx?.get(b);
  if (!x || !y || !x.size || !y.size) return 0;
  let dot = 0; let nx = 0; let ny = 0;
  for (const [, v] of x) nx += v * v;
  for (const [w, v] of y) { ny += v * v; const u = x.get(w); if (u) dot += u * v; }
  return dot / Math.sqrt(nx * ny);
}

export const phraseKey = expansion => String(expansion).split(/\s+/).map(w => normalizeLookupToken(w)).filter(Boolean).join(' ');

// candidates: key → [{ expansion, sourceId, fit, substituted }] (every source, every reading).
// Returns { decisions: [{ key, group, expansion, sourceIds, agreement, rule, full, share }], review: [...] }.
// truncationShare(stem, word): the share of `word` among the app's words that begin with `stem` (the build computes
// it from the attestation); a one-source reading of a word cut off with a geresh (מעל׳ "מעלתו") needs TRUNCATION_SHARE.
export const TRUNCATION_SHARE = 0.3; // stem of two letters
export const TRUNCATION_SHARE_LONG = 0.15; // stem of three letters or more
const truncationOk = (key, pk, truncationShare) => pk.includes(' ') || truncationShare(lettersOf(key), pk) >= (lettersOf(key).length >= 3 ? TRUNCATION_SHARE_LONG : TRUNCATION_SHARE);
// "N times" (ג״פ שלוש פעמים, ב״פ …) is a numeral before פעמים, whatever a source lists for its letters.
const TIMES = /^[בגדהוזחט]״פ$/;
// A place reference: פרק / סימן / סעיף / דף + a numeral (בפכ״א "in chapter 21", סכ״ב).
const PLACE = /^[ובדל]?(?:פ|ס|סי|סע|סעי|ד|דף|עמ)(?=.)/;
const placeReference = key => { const m = key.match(PLACE); return Boolean(m && numeralValue(key.slice(m[0].length))); };
export const excludedKey = key => lettersOf(key).length < 2 || TIMES.test(key) || TIMES.test(key.slice(1)) || LETTER_NAMES.has(key) || LETTER_NAMES.has(key.replace(/^[ובלה](?=..)/, '')) || placeReference(key);
// withheld: Map(key → [reader groups]) — the reviewer's withholdings (a reading the evidence cannot separate).
export function fuseAbbreviations(candidates, evidence, { skip = new Set(), truncationShare = () => 1, wordCount = () => 0, withheld = new Map() } = {}) {
  const decisions = [];
  const review = [];
  const decided = new Map(); // key → { group → decision }
  for (const [key, list0] of [...candidates].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (skip.has(key)) continue;
    const counts = evidence.abbr.get(key) || {};
    // Readings whose letters fit the abbreviation; a Jastrow reading with its headword substituted only corroborates.
    // Excluded from this layer (the first rules and the review queue keep them): a single letter with a geresh (ה׳ ר׳
    // ג׳ — numerals, the Name, a dozen words); a numeral below 100 (ט״ו, ע״ב, ל״ו — mostly numbers); a reading that
    // keeps an abbreviation or a bracket of its own.
    if (excludedKey(key)) continue;
    const numeral = numeralValue(key);
    if (numeral && numeral < 100) continue;
    // (A reading that keeps an abbreviation of its own — ר׳ שלמה יצחקי — is never shown but still counts as a reading.)
    const list = list0.filter(c => c.fit);
    const readings = new Map();
    for (const c of list) {
      const pk = phraseKey(c.expansion);
      if (!pk) continue;
      if (!readings.has(pk)) readings.set(pk, { pk, expansion: c.expansion, sources: new Set(), substitutedOnly: true });
      const r = readings.get(pk);
      r.sources.add(c.sourceId);
      if (!c.substituted) r.substitutedOnly = false;
    }
    const rs = [...readings.values()].filter(r => !(r.substitutedOnly && r.sources.size < 2));
    if (!rs.length) continue;
    const showable = r => !/[׳״'"()\[\]]/.test(r.expansion);
    for (const g of GROUP_IDS) {
      const n = counts[g] || 0;
      if (n < MIN_ABBR_TOKENS) continue;
      if (withheld.get(key)?.includes(g)) { review.push({ key, group: g, n, agreement: 'WITHHELD_BY_REVIEW', readings: [] }); continue; }
      const fullOf = r => evidence.full.get(r.pk)?.[g] || 0;
      const simOf = r => contextSimilarity(evidence, key, r.pk);
      const fullAll = r => Object.values(evidence.full.get(r.pk) || {}).reduce((a, b) => a + b, 0);
      let choice = null;
      let rule = '';
      // Competitors: the key's own readings and, for a key that begins with a proclitic letter, that letter on each
      // reading of the rest (וא״כ: "ואם כן" of its own, and ו + א״כ "ואחר כך"). A proclitic on a single letter (דר׳ =
      // ד + ר׳ "of Rabbi") makes the key unreadable from one source.
      const pool = rs.map(r => ({ ...r, own: true }));
      let shadowLetter = false;
      if (PROCLITIC_LETTERS.includes(key[0]) && candidates.has(key.slice(1))) {
        if (lettersOf(key.slice(1)).length < 2) shadowLetter = true;
        for (const c of candidates.get(key.slice(1)).filter(x => x.fit)) {
          const pk = phraseKey(`${key[0]}${c.expansion}`);
          if (pk && !pool.some(r => r.pk === pk)) pool.push({ pk, expansion: `${key[0]}${c.expansion}`, sources: new Set(), own: false });
        }
      }
      const writtenPool = pool.filter(r => fullOf(r) >= MIN_FULL_CONFIRM);
      const totalFull = pool.reduce((sum, r) => sum + fullOf(r), 0);
      // The context engine: the reading whose written-out contexts look most like the abbreviation's (the words before
      // and after it) — בחי׳ ~ בחינת 0.83, וע״ש ~ "וערב שבת" 0.03 — clearly ahead of every other written-out reading, and
      // not a negligible one (5% of the written-out readings at least).
      const best = [...writtenPool].sort((a, b) => simOf(b) - simOf(a) || fullOf(b) - fullOf(a) || (a.pk < b.pk ? -1 : 1))[0];
      const sim = best ? simOf(best) : 0;
      // (Every reading seen in this group's texts competes — a reading written out only a few times here, אבא ואמא beside
      // the Zohar's אבא ואימא, still blocks.)
      const contextOk = Boolean(best) && best.own && sim >= SIM_MIN && pool.every(r => r === best || fullAll(r) < MIN_COMPETITOR || simOf(r) <= (r.own ? SIM_MARGIN : SIM_MARGIN_PROCLITIC) * sim) && fullOf(best) >= MIN_SHARE_OF_WRITTEN * totalFull;
      // (A word with gershayim for emphasis or gematria — ישרא״ל, הו״א — is not read from one source.)
      const singleSourceOk = !numeral && !shadowLetter && !(key.includes('״') && wordCount(lettersOf(key)) >= WORD_WITH_GERSHAYIM);
      if (contextOk && showable(best)) {
        const truncation = !best.pk.includes(' ');
        if (best.sources.size >= 2) { choice = best; rule = `${best.sources.size >= 3 ? 'HIGH: 3+' : 'MEDIUM-HIGH: 2'} sources; context ${sim.toFixed(2)}; written out ${fullOf(best)}× in ${g}`; }
        else if (singleSourceOk && (!truncation || sim >= SIM_TRUNCATION || truncationOk(key, best.pk, truncationShare))) { choice = best; rule = `REVIEW→CONFIRMED: 1 source; context ${sim.toFixed(2)}; written out ${fullOf(best)}× in ${g}`; }
      } else if (!writtenPool.length && rs.length === 1 && rs[0].sources.size >= 2 && showable(rs[0]) && pool.length === 1) {
        // Never written out in this group (names, set phrases): one reading that two sources or more agree on.
        choice = rs[0]; rule = `${rs[0].sources.size >= 3 ? 'HIGH: 3+' : 'MEDIUM-HIGH: 2'} sources, one reading (not written out in ${g})`;
      }
      const agreement = choice ? (choice.sources.size >= 3 ? 'HIGH' : choice.sources.size === 2 ? 'MEDIUM-HIGH' : 'REVIEW-CONFIRMED') : rs.length > 1 ? 'AMBIGUOUS' : 'REVIEW';
      if (!choice) { review.push({ key, group: g, n, agreement, readings: pool.map(r => `${r.own ? '' : '(proclitic) '}${r.expansion} [${[...r.sources].join('+') || 'base'}; ${fullOf(r)}; ${simOf(r).toFixed(2)}]`) }); continue; }
      const d = { key, group: g, n, expansion: choice.expansion, sourceIds: [...choice.sources].sort(), agreement, rule, full: fullOf(choice), sim: +simOf(choice).toFixed(3), others: rs.filter(r => r !== choice).map(r => +simOf(r).toFixed(2)) };
      decisions.push(d);
      if (!decided.has(key)) decided.set(key, {});
      decided.get(key)[g] = d;
    }
  }
  return { decisions, review, decided };
}

// A proclitic on a decided abbreviation (ואח״כ = ו + אח״כ, דר״ש = ד + ר״ש): the key itself in no source, its base
// decided in the group. The expansion keeps the prefix letters (ו + אחר כך → ואחר כך).
export function prefixedDecisions(keys, evidence, decided, knownKeys) {
  const out = [];
  for (const key of [...keys].sort()) {
    if (knownKeys.has(key) || excludedKey(key)) continue;
    const counts = evidence.abbr.get(key) || {};
    for (const p of PREFIXES) {
      if (!key.startsWith(p)) continue;
      const base = key.slice(p.length);
      // The base: two letters or more, not itself beginning with ו (ור״מ is ו + ר״מ), not a numeral.
      if (!isAbbreviationKey(base) || lettersOf(base).length < 2 || /^[״׳ו]/.test(base) || numeralValue(base)) continue;
      const byGroup = decided.get(base);
      if (!byGroup) continue;
      for (const [g, d] of Object.entries(byGroup)) {
        if ((counts[g] || 0) < MIN_ABBR_TOKENS || /[,()׳״'"]/.test(d.expansion)) continue;
        // The prefixed reading must itself occur written out in the texts (בזוהר הקדוש, לבני ישראל) — ב + גם כן does
        // not ("ובג״כ" is not "ובגם כן"); a bare ו needs no check.
        const bare = p.replace(/^ו/, '');
        if (bare && (evidence.full.get(phraseKey(`${bare}${d.expansion}`))?.[g] || 0) < MIN_FULL_CONFIRM) continue;
        // … and the words around the key must look like the words around that reading (or the base's reading).
        const target = phraseKey(bare ? `${bare}${d.expansion}` : d.expansion);
        if (contextSimilarity(evidence, key, target) < SIM_PREFIX) continue;
        out.push({ key, group: g, n: counts[g], expansion: `${p}${d.expansion}`, sourceIds: d.sourceIds, agreement: d.agreement, rule: `PREFIX ${p} + ${base}`, full: 0 });
      }
      break;
    }
  }
  return out;
}

// The prefixed readings the proclitic rule may need (for the evidence scan): p (without a leading ו) + each reading of
// the base, for every attested key that is a proclitic on a key of the sources.
export function prefixedPhrases(keys, candidates) {
  const out = new Set();
  for (const key of keys) for (const p of PREFIXES) {
    if (!key.startsWith(p)) continue;
    const bare = p.replace(/^ו/, '');
    for (const c of candidates.get(key.slice(p.length)) || []) if (c.fit) for (const q of new Set([bare, p.length === 1 ? p : ''])) { if (!q) continue; const pk = phraseKey(`${q}${c.expansion}`); if (pk) out.add(pk); }
  }
  return out;
}

// Rows of the data module: one per (key, expansion) with the reader families of the groups that decided it ("*" when
// all three did).
export function abbreviationRowsOf(decisions) {
  const byKeyExp = new Map();
  for (const d of decisions) { const k = `${d.key}\t${d.expansion}`; if (!byKeyExp.has(k)) byKeyExp.set(k, { ...d, groups: new Set() }); byKeyExp.get(k).groups.add(d.group); }
  return [...byKeyExp.values()].map(d => ({ key: d.key, gloss: d.expansion.replace(/[\u0591-\u05C7]/g, ''), profiles: d.groups.size === GROUP_IDS.length ? '*' : [...d.groups].sort().map(g => `@${g}`).join(','), sourceIds: d.sourceIds, agreement: d.agreement, rule: d.rule }));
}
export { initialsFit };
