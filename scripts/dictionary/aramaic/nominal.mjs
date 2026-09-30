// Reviewed Aramaic nominal morphology (build time): the forms a noun or adjective lemma takes — states, number and
// possessive suffixes — each with a tag. Like verbs.mjs, a generated form is only a candidate analysis, kept when the
// form occurs in the app's texts and nothing stronger claims it. Keys are lookup keys (finals regularised).
//
// Tags: n.abs (absolute singular), n.emph (emphatic singular), n.pl (plural, any state), n.sg+P / n.pl+P (with a
// possessive suffix P ∈ 1s 2ms 3ms 3fs 1pl 2mp 3mp).
import { normalizeLookupToken } from '../../../src/services/wordLookup/normalize.mjs';

const add = (map, form, tag) => { const f = normalizeLookupToken(form); if (f.length < 2) return; if (!map.has(f)) map.set(f, new Set()); map.get(f).add(tag); };
// Possessive suffixes on a singular noun, and on a plural one (Targumic/Zoharic ־והי, Babylonian ־ייהו …).
const SG_POSS = [['י', '1s'], ['כ', '2ms'], ['יכ', '2ms'], ['יה', '3ms'], ['ה', '3fs'], ['הא', '3fs'], ['נ', '1pl'], ['נא', '1pl'], ['כונ', '2mp'], ['כו', '2mp'], ['הונ', '3mp'], ['הו', '3mp'], ['יהו', '3mp'], ['ייהו', '3mp'], ['הינ', '3mp']];
const PL_POSS = [['י', '1s'], ['יי', '1s'], ['יכ', '2ms'], ['כ', '2ms'], ['והי', '3ms'], ['וה', '3ms'], ['יה', '3ms'], ['הא', '3fs'], ['יהא', '3fs'], ['נא', '1pl'], ['ינ', '1pl'], ['ננ', '1pl'], ['יכונ', '2mp'], ['יכו', '2mp'], ['יהונ', '3mp'], ['יהו', '3mp'], ['ייהו', '3mp']];

// The stem of a noun lemma: the headword without its emphatic ending.
export function nounStem(key) {
  if (/ותא$/.test(key)) return { stem: key.slice(0, -3), fem: 'ut' };
  if (/יתא$/.test(key)) return { stem: key.slice(0, -3), fem: 'it' };
  if (/תא$/.test(key) && key.length >= 4) return { stem: key.slice(0, -2), fem: 't' };
  if (/א$/.test(key) && key.length >= 3) return { stem: key.slice(0, -1), fem: '' };
  return { stem: key, fem: '' };
}

export function nounForms(key) {
  const map = new Map();
  const { stem, fem } = nounStem(key);
  if (stem.length < 2) return map;
  add(map, key, 'n.lemma');
  if (fem === 'ut') {
    for (const f of [`${stem}ו`, `${stem}ותא`, `${stem}ות`, `${stem}ותה`]) add(map, f, 'n.sg');
    for (const f of [`${stem}ון`, `${stem}ואנ`, `${stem}ותיא`, `${stem}וותא`]) add(map, f, 'n.pl');
    for (const [s, p] of SG_POSS) add(map, `${stem}ות${s}`, `n.sg+${p}`);
    return map;
  }
  if (fem === 't' || fem === 'it') {
    const t = fem === 'it' ? `${stem}י` : stem;
    for (const f of [`${t}א`, `${t}ה`, `${t}תא`, `${t}ת`, `${t}תה`]) add(map, f, 'n.sg');
    for (const f of [`${t}נ`, `${t}אנ`, `${t}אתא`, `${t}ת`, `${t}תי`, `${stem}י`, `${stem}ייא`]) add(map, f, 'n.pl');
    for (const [s, p] of SG_POSS) add(map, `${t}ת${s}`, `n.sg+${p}`);
    for (const [s, p] of PL_POSS) add(map, `${t}את${s}`, `n.pl+${p}`);
    return map;
  }
  for (const f of [stem, `${stem}א`, `${stem}ה`]) add(map, f, 'n.sg');
  for (const f of [`${stem}י`, `${stem}ינ`, `${stem}נ`, `${stem}יא`, `${stem}ייא`, `${stem}אי`, `${stem}איא`]) add(map, f, 'n.pl');
  for (const [s, p] of SG_POSS) add(map, stem + s, `n.sg+${p}`);
  for (const [s, p] of PL_POSS) add(map, stem + s, `n.pl+${p}`);
  return map;
}
