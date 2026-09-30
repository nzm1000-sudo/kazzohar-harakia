// Hebrew rendering of a resolved Aramaic form (runtime; shared by the build, the audit and the app). Deterministic
// grammar only — never a meaning. The meaning is the lemma's verified Hebrew gloss (Krupnik & Silbermann, Jastrow's
// Hebrew equivalents, Hebrew Wiktionary); this module only fits it to the form:
//   · proclitics:  ו → ו־ on the first word; ד → ש־ (before a verb, particle, adverb or pronoun) or "של" (before a noun);
//                  ב ל כ מ → the same Hebrew letter on the first word; קא (progressive) → nothing (the participle carries it)
//   · a possessive suffix on a noun → "X שלו / שלה / שלהם / שלנו / שלך / שלכם / שלי"
//   · a verb form → the Hebrew form of the same person/tense when the gloss verb is in HEBREW_VERBS (a reviewed table of
//     Hebrew conjugations — Hebrew grammar, not Aramaic meaning); otherwise the gloss as the dictionary gives it
// Every rendering keeps the gloss's own words; nothing is added but the Hebrew prefix, pronoun or conjugated form.
import { HEBREW_VERBS } from './hebrewVerbs.mjs';

export const POSSESSIVE = Object.freeze({ '1s': 'שלי', '2ms': 'שלך', '3ms': 'שלו', '3fs': 'שלה', '1pl': 'שלנו', '2mp': 'שלכם', '3mp': 'שלהם' });
const PRONOUN = Object.freeze({ '1s': 'אני', '2ms': 'אתה', '1pl': 'אנו', '2mp': 'אתם' });

// Proclitic codes (the order they are written in): w ו · d ד · b ב · l ל · k כ · m מ · q קא/ק (progressive) · a א (= על)
export const PROCLITICS = Object.freeze({ w: 'ו', d: 'ד', b: 'ב', l: 'ל', k: 'כ', m: 'מ', q: 'קא', a: 'א' });

const onFirstWord = (text, prefix) => { const [first, ...rest] = text.split(' '); return [prefix + first, ...rest].join(' '); };

// The Hebrew form of a gloss verb for a morphological tag, or null (then the gloss stands as it is).
export function conjugate(gloss, tag) {
  const verb = HEBREW_VERBS[gloss];
  if (!verb || !tag) return null;
  const [stem, tense, person] = tag.split('.');
  const reflexive = stem === 'itpe' || stem === 'itpa' || stem === 'ittaf';
  const v = reflexive ? (verb.nif ? verb.nif : null) : verb;
  if (!v) return null;
  const pick = key => (typeof v[key] === 'string' ? v[key] : null);
  switch (tense) {
    case 'perf': return pick({ '3ms': 'p3ms', '3fs': 'p3fs', '2ms': 'p2ms', '1s': 'p1s', '3mp': 'p3mp', '2mp': 'p2mp', '1pl': 'p1pl' }[person] || 'p3ms');
    case 'ptcp': case 'pass': {
      if (tense === 'pass' && !reflexive) { const p = pick(person === 'fs' ? 'passF' : person === 'mp' ? 'passPl' : 'pass'); if (p) return p; }
      const base = pick(person === 'fs' ? 'ptF' : person === 'mp' || person === 'fp' || person === '1pl' || person === '2mp' ? 'ptPl' : 'pt');
      if (!base) return null;
      return PRONOUN[person] ? `${PRONOUN[person]} ${base}` : base;
    }
    case 'impf': return pick({ '3ms': 'f3ms', '2ms': 'f2ms', '3fs': 'f2ms', '1s': 'f1s', '1pl': 'f1pl', '3mp': 'f3mp', '2mp': 'f2mp' }[person] || 'f3ms');
    case 'impv': return pick(person === 'mp' ? 'impPl' : 'imp');
    case 'inf': return pick('inf');
    default: return null;
  }
}

// gloss: the lemma's display gloss · tag: the form's morphological tag · pos: the lemma's part of speech ·
// proclitics: a string of proclitic codes (e.g. 'wd' = ו + ד).
export function renderGloss({ gloss, tag = '', pos = '', proclitics = '' }) {
  if (!gloss) return null;
  let text = gloss;
  let verbal = pos === 'v' || /^(pe|pa|af|itpe|itpa|ittaf)\./.test(tag);
  if (verbal) text = conjugate(gloss, tag) || gloss;
  const poss = tag.match(/^n\.(?:sg|pl)\+(\w+)$/);
  if (poss && POSSESSIVE[poss[1]]) text = `${text} ${POSSESSIVE[poss[1]]}`;
  // Proclitics, innermost first (ו־ד־ב… is written outside-in; the Hebrew is built inside-out).
  const infinitive = /\.inf$/.test(tag);
  // כד־ / מד־ (the relative after כ or מ): "כמו ש…" / "ממה ש…" before a verb, "כשל…" / "משל…" before a noun.
  let codes = proclitics;
  const rel = codes.match(/(kd|md)$/);
  if (rel) {
    text = verbal || /^(adv|particle|pron|other)$/.test(pos) ? `${rel[1] === 'kd' ? 'כמו ש' : 'ממה ש'}${text}` : `${rel[1] === 'kd' ? 'כשל' : 'משל'} ${text}`;
    verbal = true;
    codes = codes.slice(0, -2);
  }
  for (const code of [...codes].reverse()) {
    if (code === 'q') continue;
    if (code === 'l' && infinitive && /^ל/.test(text)) continue; // לְמֵימַר → לומר (the infinitive has its ל)
    if (code === 'd') { text = verbal || /^(adv|particle|pron|other)$/.test(pos) ? onFirstWord(text, 'ש') : `של ${text}`; verbal = true; continue; }
    if (code === 'a') { text = `על ${text}`; continue; }
    // ב ל כ before a noun with the article: the ה drops (ל + העם → לעם), as Hebrew writes it.
    if ('blk'.includes(code) && pos === 'n' && /^ה../.test(text)) text = text.slice(1);
    text = onFirstWord(text, PROCLITICS[code]);
  }
  return text;
}
