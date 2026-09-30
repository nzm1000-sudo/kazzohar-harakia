// The one shared lookup engine of the word dictionary: local, deterministic, no network, no model of any kind.
//
//   SURFACE → NORMALIZATION → FORM RESOLUTION → MORPHOLOGY → LEMMA → CONTEXT → VERIFIED LEXICON → SHORT HEBREW GLOSS
//
//   resolveAramaicSurfaceForm({ rawToken, surroundingTokens, family, workId, corpus, dialect, canonicalRef })
//       → { surface, normalized, lemma, glossHe, dialect, confidence, sourceIds, resolutionPath } | null
//   getShortGloss(word, context)   → the one thing the bubble shows, or null (the reader's own tap goes on)
//   lookupHebrew(word)             → the Aramaic forms whose verified gloss is this Hebrew word (the reverse index)
//
// Resolution order (first that answers wins; nothing is guessed):
//   1. a phrase (2–4 words) the text around the word matches — its reviewed/dictionary meaning
//   2. an abbreviation, read by the profile (ת״ש is תא שמע in the Gemara only)
//   3. the form itself: every form of the app's texts was resolved at build time (exact headword, a spelling the
//      dictionary gives, a form it prints, a reviewed inflection of the lemma, proclitics) and stored with its lemma's
//      sense, its morphological tag and its proclitics — the gloss is rendered here from them (render.mjs)
//   4. a form the texts never had (an online text): its proclitics are taken off and the rest looked up as in 3 — in
//      the Aramaic profiles only, never for a form the build left out
// The profile (profiles.mjs) is where the word is read: Bavli, Yerushalmi, Midrash, Onkelos, Zohar, Biblical Aramaic,
// liturgy, or the commentaries and later works; it picks the sense, and a form that is Hebrew there is never glossed.
// The data (src/data/dictionary/wordDictionary.mjs) is generated from licensed sources only, by
// scripts/dictionary/build-aramaic-engine.mjs; its source registry is src/data/dictionary/sources.mjs.
import { normalizeLookupToken, lettersOf, isAbbreviationKey, tokenizeLookup } from './normalize.mjs';
import { renderGloss } from './aramaic/render.mjs';
import { PROFILES, profileOf, profileOfCorpus } from './aramaic/profiles.mjs';
import { PRONOMINAL } from './aramaic/pronominal.mjs';

export { normalizeLookupToken };
// Reader families the readers declare with data-lookup="…". Anything else is treated as 'torah' (generic).
export const LOOKUP_FAMILIES = Object.freeze(['talmud', 'talmud-commentary', 'mishnah-commentary', 'tanakh-commentary', 'targum', 'zohar', 'kabbalah', 'midrash', 'halacha', 'rambam', 'responsa', 'chassidut', 'machshava', 'mussar', 'torah', 'liturgy', 'biblical-aramaic']);
const MAX_COMBINED_WORDS = 7;
// Proclitic sequences for a form the texts never had (fallback) — the same set the build analyses with.
const SURFACE = { w: ['ו'], d: ['ד'], b: ['ב'], l: ['ל'], k: ['כ'], m: ['מ'], q: ['קא', 'ק'] };
const SEQUENCES = ['w', 'd', 'b', 'l', 'k', 'm', 'q', 'wd', 'wb', 'wl', 'wk', 'wm', 'wq', 'db', 'dl', 'dk', 'dm', 'dq', 'md', 'kd', 'wdb', 'wdl', 'wdm', 'wdq', 'wmd', 'wkd', 'mdq', 'lk', 'wlk', 'dlk'];
const FALLBACK_PROFILES = new Set(['J', 'Y', 'T', 'Z']);

let dictionary = null;
let loading = null;

// Parses the generated module (tab-separated lines) into lookup tables. FORMS lines are split lazily per lookup.
export function parseWordDictionary(data) {
  const sourceCodes = data.SOURCE_CODES || [];
  const senses = String(data.SENSES || '').split('\n').map(line => { const [gloss, pos, src] = line.split('\t'); return { gloss, pos: pos || '', sourceId: sourceCodes[Number(src)] || '' }; });
  const forms = new Map();
  for (const line of String(data.FORMS || '').split('\n')) { if (!line) continue; const tab = line.indexOf('\t'); forms.set(line.slice(0, tab), line.slice(tab + 1)); }
  const phrases = [];
  const phraseIndex = new Map(); // word key → [{ phrase, at }]
  for (const line of String(data.PHRASES || '').split('\n')) {
    if (!line) continue;
    const [words, gloss, profiles, src] = line.split('\t');
    const phrase = { words: words.split(' '), gloss, profiles, sourceId: sourceCodes[Number(src)] || '' };
    phrases.push(phrase);
    phrase.words.forEach((word, at) => { if (!phraseIndex.has(word)) phraseIndex.set(word, []); phraseIndex.get(word).push({ phrase, at }); });
  }
  const abbreviations = new Map();
  for (const line of String(data.ABBREVIATIONS || '').split('\n')) {
    if (!line) continue;
    const [key, gloss, profiles, src] = line.split('\t');
    if (!abbreviations.has(key)) abbreviations.set(key, []);
    abbreviations.get(key).push({ gloss, profiles, sourceId: sourceCodes[Number(src)] || '' });
  }
  const noFallback = new Set(String(data.NOFALLBACK || '').split('\n').filter(Boolean));
  return { senses, forms, phrases, phraseIndex, abbreviations, noFallback, version: data.DICTIONARY_VERSION };
}
export function setWordDictionary(data) { dictionary = data ? parseWordDictionary(data) : null; reverse = null; return dictionary; }
export const isDictionaryReady = () => Boolean(dictionary);
// The data is a separate chunk, loaded once when a reader first needs it (bundled in the app: no network).
export function loadWordDictionary() {
  if (dictionary) return Promise.resolve(dictionary);
  if (!loading) loading = import('../../data/dictionary/wordDictionary.mjs').then(module => setWordDictionary(module)).catch(error => { loading = null; throw error; });
  return loading;
}
export const isContextualKey = key => Boolean(dictionary?.phraseIndex.has(key));

// ---------- Context ----------
// around: the text around the word (a few words each side); aroundStart: the word's offset in it.
export function resolveWordContext({ family = '', workId = '', layer = '', around = '', aroundStart = -1 } = {}) {
  const fam = LOOKUP_FAMILIES.includes(family) ? family : 'torah';
  return Object.freeze({ family: fam, workId: String(workId || ''), layer: String(layer || ''), around: String(around || ''), aroundStart: Number.isFinite(aroundStart) ? aroundStart : -1 });
}
function surroundingFromContext(context, key) {
  if (!context.around) return { before: [], after: [] };
  const tokens = tokenizeLookup(context.around);
  let at = context.aroundStart >= 0 ? tokens.findIndex(t => t.start === context.aroundStart) : -1;
  if (at < 0) { const hits = tokens.map((t, i) => (t.key === key ? i : -1)).filter(i => i >= 0); if (hits.length !== 1) return { before: [], after: [] }; at = hits[0]; }
  return { before: tokens.slice(Math.max(0, at - 3), at).map(t => t.raw), after: tokens.slice(at + 1, at + 4).map(t => t.raw) };
}

// ---------- Resolution ----------
const inProfiles = (mask, P) => mask === '*' || mask.includes(P);
// The analyses stored for a form in profile P: [{ senseIds, tag, codes, reviewed }] or null.
function analysesFor(key, P) {
  const line = dictionary.forms.get(key);
  if (!line) return null;
  for (const entry of line.split(';')) {
    const [mask, ids, tag, codes, reviewed] = entry.split('|');
    if (inProfiles(mask, P)) return { senseIds: ids.split('+').map(Number), tag, codes, reviewed: reviewed === 'R' };
  }
  return undefined; // known form, not glossed in this profile (Hebrew there, or ambiguous)
}
function renderAnalysis(a, extraCodes = '') {
  const glosses = a.senseIds.map(id => dictionary.senses[id]).filter(Boolean);
  if (!glosses.length) return null;
  const rendered = [...new Set(glosses.map(s => (a.reviewed && !extraCodes ? s.gloss : renderGloss({ gloss: s.gloss, tag: a.tag, pos: s.pos, proclitics: extraCodes + a.codes }))))];
  if (rendered.length > 2 || rendered.join(' ').split(/\s+/).length > MAX_COMBINED_WORDS) return null;
  return { glossHe: rendered.join(' · '), sourceIds: [...new Set(glosses.map(s => s.sourceId))] };
}
const tagFits = (codes, tag, pos) => {
  const verbal = /^(pe|pa|af|itpe|itpa|ittaf)\./.test(tag) || pos === 'v';
  const tense = tag.split('.')[1] || '';
  for (const code of codes) {
    if (code === 'q' && !(verbal && (tense === 'ptcp' || tense === 'pass'))) return false;
    if ('bkml'.includes(code) && verbal && tense !== 'inf') return false;
  }
  return !/q/.test(codes) || /q$/.test(codes);
};

function phraseAt(key, surrounding, P) {
  const hits = dictionary.phraseIndex.get(key);
  if (!hits) return null;
  const before = (surrounding?.before || []).map(normalizeLookupToken);
  const after = (surrounding?.after || []).map(normalizeLookupToken);
  let best = null;
  for (const { phrase, at } of hits) {
    if (!inProfiles(phrase.profiles, P)) continue;
    const need = phrase.words;
    let ok = at <= before.length && need.length - at - 1 <= after.length;
    for (let i = 0; ok && i < at; i += 1) ok = before[before.length - at + i] === need[i];
    for (let i = at + 1; ok && i < need.length; i += 1) ok = after[i - at - 1] === need[i];
    if (ok && (!best || need.length > best.words.length)) best = phrase;
  }
  return best;
}

// Pointed text says what the letters leave open (pass 2) — deterministic grammar of the vowel signs:
//   · אָנָּא with a dagesh in the nun is the Hebrew "please" (אנא ה׳ הושיעה נא), not the Aramaic אֲנָא "I": nothing
//   · a final ־ֵהּ (tsere + mappiq) is the third person masculine suffix of the Targum and Daniel (לֵהּ "to him", בֵּהּ
//     "in him", שְׁמֵהּ "his name"), spelled ־יה in the Talmud: read as that spelling where the data has it (לַהּ "to her"
//     stays as it is). Returns the key to look up, or null.
const POINT = '[\u0591-\u05C7]*';
const HEBREW_PLEASE = new RegExp(`^א${POINT}נ[\u0591-\u05BB\u05BD-\u05C7]*\u05BC${POINT}א${POINT}$`);
const THIRD_MASCULINE = new RegExp(`([א-ת])(${POINT})ה(${POINT})$`);
//   · הֲוָא (hataf patah under the he) is the verb "was" of Daniel/Ezra, spelled הוה elsewhere — not the pronoun הוּא
//   · a final ־ַהּ / ־ָהּ (patah or qamats + mappiq) is the feminine suffix: a reading "his" (…ו) is not shown for it
function pointedKey(raw, key, P) {
  const text = String(raw);
  if (key === 'אנא' && HEBREW_PLEASE.test(text)) return null;
  if (key === 'הוא' && /^ה[\u0591-\u05AF\u05BD]*\u05B2/.test(text) && analysesFor('הוה', P)) return 'הוה';
  if (key.length >= 2 && key.endsWith('ה')) {
    const m = text.match(THIRD_MASCULINE);
    if (m && m[2].includes('\u05B5') && m[3].includes('\u05BC')) {
      const alt = `${key.slice(0, -1)}יה`;
      if (analysesFor(alt, P)) return alt;
      if (PRONOMINAL_3MS[alt]) return { gloss: PRONOMINAL_3MS[alt] };
    }
  }
  return key;
}
const pointedFeminine = raw => { const m = String(raw).match(THIRD_MASCULINE); return Boolean(m && /[\u05B7\u05B8]/.test(m[2]) && m[3].includes('\u05BC')); };
// The pronominal prepositions with the third person masculine suffix (grammar: the table the build uses).
const PRONOMINAL_3MS = Object.freeze(Object.fromEntries(Object.entries(PRONOMINAL).filter(([k]) => /יה$/.test(normalizeLookupToken(k))).map(([k, v]) => [normalizeLookupToken(k), v])));

export function resolveAramaicSurfaceForm({ rawToken, surroundingTokens = null, family = '', workId = '', corpus = '', dialect = '', canonicalRef = '' } = {}) {
  if (!dictionary) return null;
  const typedKey = normalizeLookupToken(rawToken);
  if (!typedKey || lettersOf(typedKey).length < 2) return null;
  const P = corpus ? profileOfCorpus(corpus) : profileOf(family, workId);
  const pointed = pointedKey(rawToken, typedKey, P);
  if (!pointed) return null;
  if (typeof pointed === 'object') return { surface: String(rawToken), normalized: typedKey, dialect: dialect || PROFILES[P].dialect, profile: P, ref: canonicalRef || '', lemma: null, glossHe: pointed.gloss, confidence: 'grammar', sourceIds: ['grammar'], resolutionPath: 'pointed:3ms' };
  const key = pointed;
  const result = resolveKey(key, rawToken, surroundingTokens, family, P, dialect, canonicalRef);
  // A feminine suffix by its vowels, glossed "his": nothing (missing is better than wrong).
  if (result && pointedFeminine(rawToken) && /ו$/.test(result.glossHe) && !/\s/.test(result.glossHe)) return null;
  return result;
}

function resolveKey(key, rawToken, surroundingTokens, family, P, dialect, canonicalRef) {
  const base = { surface: String(rawToken), normalized: key, dialect: dialect || PROFILES[P].dialect, profile: P, ref: canonicalRef || '' };
  // 1. A phrase.
  const phrase = phraseAt(key, surroundingTokens, P);
  // (A phrase with no gloss is a Hebrew context: the word is Hebrew there — nothing is shown.)
  if (phrase) return phrase.gloss ? { ...base, lemma: phrase.words.join(' '), glossHe: phrase.gloss, confidence: 'phrase', sourceIds: [phrase.sourceId], resolutionPath: 'phrase' } : null;
  // 2. An abbreviation.
  if (isAbbreviationKey(key)) {
    const list = (dictionary.abbreviations.get(key) || []).filter(a => a.profiles === '*' || a.profiles.split(',').includes(family || 'torah'));
    const glosses = [...new Set(list.map(a => a.gloss))];
    if (glosses.length === 1 || (glosses.length === 2 && glosses.join(' ').split(/\s+/).length <= MAX_COMBINED_WORDS)) return { ...base, lemma: key, glossHe: glosses.join(' · '), confidence: glosses.length === 1 ? 'abbreviation' : 'two-readings', sourceIds: [...new Set(list.map(a => a.sourceId))], resolutionPath: 'abbreviation' };
    return null;
  }
  // 3. The form.
  const a = analysesFor(key, P);
  if (a) { const r = renderAnalysis(a); return r ? { ...base, lemma: null, ...r, confidence: a.reviewed ? 'reviewed' : a.senseIds.length > 1 ? 'two-senses' : 'lexicon', resolutionPath: a.reviewed ? 'reviewed-form' : `form${a.tag ? `:${a.tag}` : ''}${a.codes ? `+${a.codes}` : ''}` } : null; }
  if (a === undefined || !FALLBACK_PROFILES.has(P) || dictionary.noFallback.has(key)) return null;
  // 4. A form the texts never had: proclitics off, the rest as stored (never a reviewed whole-form gloss).
  for (const seq of SEQUENCES) {
    let rest = key;
    let codes = '';
    let ok = true;
    for (const code of seq) { const s = SURFACE[code].find(x => rest.startsWith(x) && rest.length - x.length >= 2); if (!s) { ok = false; break; } rest = rest.slice(s.length); codes += code; }
    if (!ok) continue;
    const r = analysesFor(rest, P);
    if (!r || r.codes || r.reviewed) continue;
    const pos = dictionary.senses[r.senseIds[0]]?.pos || '';
    if (!tagFits(codes, r.tag, pos)) continue;
    const out = renderAnalysis(r, codes);
    if (out) return { ...base, lemma: null, ...out, confidence: 'morphology', resolutionPath: `fallback:${codes}` };
  }
  return null;
}

// Compatibility: the result object for a word in a reading context (the tests and the controller).
export function lookupWord(word, context = resolveWordContext()) {
  const key = normalizeLookupToken(word);
  const surrounding = surroundingFromContext(context, key);
  const r = resolveAramaicSurfaceForm({ rawToken: word, surroundingTokens: surrounding, family: context.family, workId: context.workId });
  return r ? { key, via: r.resolutionPath, gloss: r.glossHe, result: r } : null;
}
// What the bubble shows: one gloss, or two genuinely plausible ones "א · ב", or null.
export function getShortGloss(word, context = resolveWordContext()) {
  try { return lookupWord(word, context)?.gloss || null; } catch { return null; }
}

// ---------- Reverse index (Hebrew → Aramaic) ----------
// Built on first use from the verified glosses: every Hebrew gloss word → the Aramaic forms and profiles it glosses.
let reverse = null;
export function lookupHebrew(word) {
  if (!dictionary) return [];
  if (!reverse) {
    reverse = new Map();
    for (const [key, line] of dictionary.forms) {
      for (const entry of line.split(';')) {
        const [mask, ids, tag, codes] = entry.split('|');
        if (codes) continue; // the bare form only (no proclitics)
        for (const id of ids.split('+')) {
          const sense = dictionary.senses[Number(id)];
          if (!sense) continue;
          for (const g of sense.gloss.split(/,\s*/)) {
            const h = normalizeLookupToken(g.trim());
            if (!h || /\s/.test(g.trim())) continue;
            if (!reverse.has(h)) reverse.set(h, []);
            reverse.get(h).push({ aramaic: key, profiles: mask, tag: tag || '' });
          }
        }
      }
    }
  }
  return reverse.get(normalizeLookupToken(word)) || [];
}
