// The one shared lookup engine of the word dictionary: local, deterministic, no network, no model of any kind.
//   normalizeLookupToken(word)            → the key a word is looked up by (normalize.mjs)
//   resolveWordContext({ family, … })     → the reading context (reader family, work, layer, the words around)
//   lookupWord(word, context)             → { key, via, entries } | null — the candidate entries, context applied
//   getShortGloss(word, context)          → the one thing the bubble shows ('נאמר', 'סגר · נשך') or null
// Lookup order (first that answers wins; nothing is guessed):
//   1. the exact key (nikud, te'amim and punctuation ignored; gershayim spelled any way)
//   2. a known alias (a spelling variant the source itself gives, a reviewed plene spelling of a pointed headword)
//   3. a reviewed prefix rule (ו־ ד־ ב־ ל־ כ־ on a known word, each with its own conditions) — see PREFIX_RULES
// Context narrows, never invents: an entry may be limited to reader families (ת״ש only in the Gemara) or preferred in
// one (ע״ש is עיין שם in a commentary); one gloss is shown, or two as "א · ב" when both are genuinely plausible, or
// nothing. The data (src/data/dictionary/wordDictionary.mjs) is generated from licensed sources only, by
// scripts/dictionary/build-word-dictionary.mjs; its source registry is src/data/dictionary/sources.mjs.
import { normalizeLookupToken, lettersOf, isAbbreviationKey } from './normalize.mjs';

export { normalizeLookupToken };
export const ENTRY_TYPE = Object.freeze({ A: 'ARAMAIC', B: 'ABBREVIATION', H: 'HEBREW_RABBINIC', T: 'TARGUM', N: 'NAME_ABBREVIATION' });
// Reader families the readers declare with data-lookup="…". Anything else is treated as 'torah' (generic).
export const LOOKUP_FAMILIES = Object.freeze(['talmud', 'talmud-commentary', 'mishnah-commentary', 'tanakh-commentary', 'targum', 'zohar', 'kabbalah', 'midrash', 'halacha', 'rambam', 'responsa', 'chassidut', 'machshava', 'mussar', 'torah']);
const MAX_COMBINED_WORDS = 6;

let dictionary = null; // { entries: [...], index: Map(key → ids), prefixable: Set(ids) }
let loading = null;

// Parses the generated module's compact form (tab-separated lines) into lookup tables.
export function parseWordDictionary(data) {
  const entries = data.ENTRIES.split('\n').filter(Boolean).map((line, id) => {
    const [gloss, type, source, contexts, prefer, pos] = line.split('\t');
    return { id, gloss, type: ENTRY_TYPE[type] || type, source: data.SOURCE_IDS[Number(source)], contexts: contexts ? contexts.split(',') : [], prefer: prefer ? prefer.split(',') : [], pos: pos || '' };
  });
  const index = new Map();
  const alias = new Map();
  for (const line of data.INDEX.split('\n')) { if (!line) continue; const [key, ids] = line.split('\t'); index.set(key, ids.split(',').map(Number)); }
  for (const line of (data.ALIASES || '').split('\n')) { if (!line) continue; const [key, target] = line.split('\t'); alias.set(key, target); }
  const noPrefix = new Set((data.NOPREFIX || '').split('\n').filter(Boolean));
  return { entries, index, alias, noPrefix, version: data.DICTIONARY_VERSION };
}
export function setWordDictionary(data) { dictionary = data ? parseWordDictionary(data) : null; return dictionary; }
export const isDictionaryReady = () => Boolean(dictionary);
// The data is a separate chunk, loaded once when a reader first needs it (bundled in the app: no network).
export function loadWordDictionary() {
  if (dictionary) return Promise.resolve(dictionary);
  if (!loading) loading = import('../../data/dictionary/wordDictionary.mjs').then(module => setWordDictionary(module)).catch(error => { loading = null; throw error; });
  return loading;
}

// ---------- Context ----------
export function resolveWordContext({ family = '', workId = '', layer = '', around = '' } = {}) {
  const fam = LOOKUP_FAMILIES.includes(family) ? family : 'torah';
  return Object.freeze({ family: fam, workId: String(workId || ''), layer: String(layer || ''), around: String(around || '') });
}

// ---------- Reviewed prefix rules ----------
// Each rule: the prefix letter, which kinds of entry it may attach to (by the source's part of speech), and the Hebrew
// prefix that replaces it in the gloss. The remainder must be a known, non-abbreviation word of at least three letters,
// and its gloss a single word (so "ו" + "כאן" = "וכאן", never a phrase with a dangling prefix). ד־ before a verb is
// "ש", before a noun or adverb "של ". False positives are worse than misses: anything else is left unglossed.
export const PREFIX_RULES = Object.freeze([
  { prefix: 'ו', pos: null, hebrew: () => 'ו' },
  { prefix: 'ד', pos: ['v', 'n', 'adv'], hebrew: pos => (pos === 'v' ? 'ש' : 'של ') },
  { prefix: 'ב', pos: ['n'], hebrew: () => 'ב' },
  { prefix: 'ל', pos: ['n'], hebrew: () => 'ל' },
  { prefix: 'כ', pos: ['n'], hebrew: () => 'כ' },
]);

function inContext(entry, context) {
  return !entry.contexts.length || entry.contexts.includes(context.family);
}
function candidatesFor(key, context) {
  const ids = dictionary.index.get(key);
  if (!ids) return [];
  let list = ids.map(id => dictionary.entries[id]).filter(entry => inContext(entry, context));
  const preferred = list.filter(entry => entry.prefer.includes(context.family));
  if (preferred.length) list = preferred;
  return list;
}

export function lookupWord(word, context = resolveWordContext()) {
  if (!dictionary) return null;
  const key = normalizeLookupToken(word);
  if (!key || lettersOf(key).length < 2) return null;
  let entries = candidatesFor(key, context);
  if (entries.length) return { key, via: 'exact', entries };
  const aliasTarget = dictionary.alias.get(key);
  if (aliasTarget) { entries = candidatesFor(aliasTarget, context); if (entries.length) return { key, via: 'alias', target: aliasTarget, entries }; }
  // A trailing geresh that is not an abbreviation the dictionary knows: the word itself (e.g. a quotation mark).
  if (key.endsWith('׳') && !isAbbreviationKey(key.slice(0, -1))) { const plain = key.slice(0, -1); entries = candidatesFor(plain, context); if (entries.length) return { key, via: 'exact', target: plain, entries }; }
  if (dictionary.noPrefix.has(key)) return null;
  const abbreviation = isAbbreviationKey(key);
  for (const rule of PREFIX_RULES) {
    if (!key.startsWith(rule.prefix)) continue;
    // An abbreviation takes the conjunction ו־ only (וא״ל = ואמר לו); its gloss may be several words.
    if (abbreviation && rule.prefix !== 'ו') continue;
    const rest = key.slice(rule.prefix.length);
    if (lettersOf(rest).length < (abbreviation ? 2 : 3)) continue;
    const target = dictionary.index.has(rest) ? rest : dictionary.alias.get(rest);
    if (!target) continue;
    const all = candidatesFor(target, context);
    // Every sense must take the prefix, or none is shown (a partial list would drop the right sense).
    const fits = entry => (abbreviation ? entry.type === 'ABBREVIATION' : entry.type !== 'ABBREVIATION' && !/\s/.test(entry.gloss) && (!rule.pos || rule.pos.includes(entry.pos)));
    if (!all.length || !all.every(fits)) continue;
    const base = all;
    const composed = base.map(entry => ({ ...entry, gloss: `${rule.hebrew(entry.pos)}${entry.gloss}` }));
    return { key, via: 'prefix', prefix: rule.prefix, target, entries: composed };
  }
  return null;
}

// What the bubble shows: one gloss, or two genuinely plausible ones "א · ב", or null. Identical glosses merged.
export function getShortGloss(word, context = resolveWordContext()) {
  try {
    const found = lookupWord(word, context);
    if (!found) return null;
    const glosses = [...new Set(found.entries.map(entry => entry.gloss))];
    if (glosses.length === 1) return glosses[0];
    if (glosses.length === 2 && glosses.join(' ').split(/\s+/).length <= MAX_COMBINED_WORDS) return `${glosses[0]} · ${glosses[1]}`;
    return null;
  } catch { return null; }
}
