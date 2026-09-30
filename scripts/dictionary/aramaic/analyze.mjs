// Form analysis of the Aramaic engine (build time): every candidate analysis of a surface form — proclitics, then an
// exact headword, a spelling the dictionaries give, a form they print, or a generated inflection — scored, and the
// best one kept per profile, or none when two different meanings tie (missing is better than wrong).
//
// Order of strength (the plan's resolution order): an exact headword (100) → a spelling alias the dictionary gives (94)
// → a form the dictionary prints under its lemma (92; Jastrow's quotation words 60) → a reviewed irregular paradigm
// (86) → a generated inflection (70 verbs / 72 nouns). Every proclitic costs 4 points; a proclitic must suit the form
// (the progressive קא only before a participle; ב כ מ ל only before a noun, a particle or an infinitive).
// The strongest class that knows the form decides: when an exact headword (or a spelling the dictionary gives) exists
// but its meaning here is ambiguous or unknown, no weaker analysis of another word is taken instead.
import { PROCLITICS } from '../../../src/services/wordLookup/aramaic/render.mjs';

export const STRENGTH = Object.freeze({ reviewed: 110, pronominal: 105, exact: 100, irregular: 98, alias: 94, 'source-form': 92, 'generated-noun': 72, generated: 70, quote: 60 });

// Proclitic splits of a key: [{ codes, rest }], the bare form first. Surface spellings of each code.
const SURFACE = { w: ['ו'], d: ['ד'], b: ['ב'], l: ['ל'], k: ['כ'], m: ['מ'], q: ['קא', 'ק'] };
const SEQUENCES = ['', 'w', 'd', 'b', 'l', 'k', 'm', 'q', 'wd', 'wb', 'wl', 'wk', 'wm', 'wq', 'db', 'dl', 'dk', 'dm', 'dq', 'md', 'kd', 'wdb', 'wdl', 'wdm', 'wdq', 'wmd', 'wkd', 'mdq', 'lk', 'wlk', 'dlk'];
export function procliticSplits(key) {
  const out = [];
  for (const seq of SEQUENCES) {
    let variants = [{ rest: key, codes: '' }];
    for (const code of seq) {
      const next = [];
      for (const v of variants) for (const s of SURFACE[code]) if (v.rest.startsWith(s) && v.rest.length - s.length >= 2) next.push({ rest: v.rest.slice(s.length), codes: v.codes + code });
      variants = next;
    }
    for (const v of variants) if (!out.some(o => o.rest === v.rest && o.codes === v.codes)) out.push(v);
  }
  return out;
}

// Does a proclitic sequence suit an analysis?
export function procliticFits(codes, tag, pos) {
  if (!codes) return true;
  const verbal = /^(pe|pa|af|itpe|itpa|ittaf|shaf|ishtaf|x)\./.test(tag) || (pos === 'v' && !/^n\./.test(tag));
  const tense = tag.split('.')[1] || '';
  for (const code of codes) {
    if (code === 'q' && !(verbal && (tense === 'ptcp' || tense === 'pass'))) return false;
    if ((code === 'b' || code === 'k' || code === 'm' || code === 'l') && verbal && tense !== 'inf') return false;
    if (code === 'a' && (verbal || pos === 'particle')) return false;
  }
  if (/q/.test(codes) && !/q$/.test(codes)) return false; // קא is always last, right before the participle
  return true;
}
export { PROCLITICS };
