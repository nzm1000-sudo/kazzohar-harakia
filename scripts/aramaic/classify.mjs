// The token language classifier of the coverage audit (Phase 1) — independent of the dictionary and of the resolver,
// so the denominator of coverage can never be moved by what the dictionary happens to know.
//
// Every word token of a corpus gets one class:
//   ABBREVIATION  its key carries gershayim or a geresh (ת״ש, א״ר, מתני׳; numerals written with gershayim included)
//   NUMBER        a single letter (a numeral, a daf or chapter letter, a citation mark)
//   PROPER_NAME   a title (רב, רבי, ר׳, רבן, with a prefix) followed by a name, and the word after a title or after בר/בן/
//                 בריה… whose form follows רב/רבי/ר׳/רבן in at least NAME_SHARE of its uses in the Aramaic pool; and a
//                 known name (scripts/aramaic/names.mjs: the Tanakh's proper nouns, Jastrow's "pr. n."), with or
//                 without a one- or two-letter prefix, that is not also an ordinary word; and, in the Talmud and its
//                 literature, a sage's name (Krupnik's "שם אמורא/תנא", Jastrow's Amoraim and Tannaim) even where the
//                 letters are also a word (רבא, רבה, שמואל)
//   HEBREW        Hebrew, or a lexeme shared with Hebrew at a similar rate (לא, על, כל) — nothing to translate
//   ARAMAIC_LEXICAL  Aramaic — the denominator of coverage
//   UNCERTAIN     none of the rules decides: reported separately (never silently dropped from the report)
// (FOREIGN — Latin-script words — and PUNCTUATION are counted from the raw text: the tokenizer yields Hebrew words only.)
//
// HEBREW vs ARAMAIC is decided per form and per corpus, from frequency lists of the app's own texts:
//   H = the Hebrew reference: the Hebrew chapters of the Tanakh, the Mishnah, the Mishneh Torah (all three pointed:
//       counted under their consonantal spelling and under their plene spelling, see pleneKey) and the unpointed
//       rabbinic Hebrew of the Shulchan Arukh, the Kitzur Shulchan Arukh and Chayei Adam (these three count only for
//       forms without a strong Aramaic mark — they quote the Gemara's Aramaic: אמרינן, דאמר)
//   C = the corpus being classified;  A = the Aramaic-dominant pool (Onkelos, Biblical Aramaic, the three Zohar corpora,
//       Bavli, Yerushalmi);  M = the marking pool (Bavli, Yerushalmi, Onkelos, Biblical Aramaic — the Zohar is left out
//       of M because it uses the Hebrew terms of Kabbalah, נצח הוד תפארת, as often as its Aramaic)
//   0. In a wholly Aramaic corpus (Onkelos, Biblical Aramaic) every word that is not an abbreviation, a numeral or a
//      name is Aramaic — a word identical to Hebrew (על, לא, כל) is an Aramaic word there, spelled like Hebrew.
//      (v5) There, a name is: in Onkelos, a Tanakh name form whose name the Hebrew verse it translates has (דמצרים ↔
//      מצרים — but למיכל "to eat" is not ל + מיכל); in Daniel/Ezra, a bare Tanakh name or a prefix on a name of five
//      letters or more. The divine name יי is a name in every corpus.
//   1. attested in H at least MIN_HEBREW_COUNT times:
//        ARAMAIC ("Aramaic-marked homograph") when C uses it at least MARKED_RATIO times as often as H does (and at least
//        MIN_CORPUS_COUNT times) and so does M as a whole — תא, הא, אי, מר in the Bavli; ארי, קדם in Onkelos (a name
//        that a narrative corpus simply repeats, משה or פרעה in Onkelos, is not marked: M uses it at Hebrew's rate);
//        HEBREW otherwise (a Hebrew word, or a word both languages share at a similar rate).
//   2. not attested in H:
//        a. ARAMAIC when the form bears an Aramaic morphological mark: the relative ד־ (דאמר), כד־/מד־ on a stem of three
//           letters or more (כדמפרש), the progressive קא־/קמ־, a reflexive אשת־/אצט־/אזד־/אסת־/תת־ stem, the verbal
//           ending ־ון on a stem of three letters or more,
//           the Babylonian infinitive מי־…־א, an etpeel/etpaal אית־/את־ stem, or one of the endings ־א ־תא ־יה ־הו
//           ־ינן ־יהו ־ייהו ־כון ־הון ־תון ־והי ־נא on a stem of two letters or more;
//        b. ARAMAIC when A uses it FREQUENT_POOL times or more (התם, בגין);
//        c. ARAMAIC in a wholly Aramaic corpus (Onkelos, Biblical Aramaic);
//        d. HEBREW when it is a Hebrew prefix (ה ש and their combinations, or ו ב ל כ מ) on a base that is HEBREW by
//           rule 1 in C (ושהמטהרים is Hebrew even though H never spells it so); ARAMAIC when it is ו ב ל כ מ on a base
//           that is ARAMAIC by rule 1, 2a or 2b (ופריך); HEBREW when it is a Hebrew pronominal or plural suffix (־נו ־ך
//           ־כם ־הם ־ים ־ות ־יו ־תי …), with or without a prefix, on a base that is HEBREW by rule 1 (נהללך, מושיענו);
//        e. ARAMAIC when A uses it MIN_ARAMAIC_POOL times or more;
//        f. UNCERTAIN otherwise.
// The thresholds are fixed constants below; changing them changes every corpus's denominator and must be reported.
import { corpusParagraphs } from './corpora.mjs';
import { tokenizeLookup, normalizeLookupToken } from '../../src/services/wordLookup/normalize.mjs';
import { loadNames, isNameForm, isSageForm, isBookName } from './names.mjs';
export const TALMUDIC_CORPORA = Object.freeze(['bavli', 'yerushalmi', 'minor-tractates', 'midrash', 'talmud-commentary', 'other-commentary', 'other']);

export const CLASSIFIER_VERSION = 5;
export const MIN_HEBREW_COUNT = 2;
export const MARKED_RATIO = 4;
export const MIN_CORPUS_COUNT = 3;
export const MIN_ARAMAIC_POOL = 3;
export const FREQUENT_POOL = 10;
export const NAME_SHARE = 0.3;
export const CLASSES = Object.freeze(['ARAMAIC_LEXICAL', 'HEBREW', 'PROPER_NAME', 'ABBREVIATION', 'NUMBER', 'FOREIGN', 'PUNCTUATION', 'UNCERTAIN']);
export const ARAMAIC_POOL = Object.freeze(['onkelos', 'biblical-aramaic', 'zohar', 'tikkunei-zohar', 'zohar-chadash', 'bavli', 'yerushalmi']);
export const WHOLLY_ARAMAIC = Object.freeze(['onkelos', 'biblical-aramaic']);
const PREFIXED = titles => new Set(titles.flatMap(title => ['', 'ו', 'ד', 'וד', 'ל', 'כ', 'מ', 'דל', 'וכ'].map(prefix => prefix + title)));
export const CORE_TITLES = PREFIXED(['רב', 'רבי', 'ר׳', 'רבן']);
export const TITLES = new Set([...CORE_TITLES, ...PREFIXED(['בר', 'בן', 'בריה', 'ברבי', 'בנו', 'בת', 'ברת'])]);
const HEBREW_ONLY_PREFIXES = ['ה', 'ש', 'וה', 'וש', 'שה', 'מה', 'מש', 'כש', 'לכש', 'בה', 'לה', 'כה', 'ומה', 'ושה', 'שב', 'של', 'שמ', 'שכ', 'ושב', 'ושל', 'ושמ', 'ומש', 'וכש', 'ובה', 'ולה', 'מהש'];
const SHARED_PREFIXES = ['ו', 'ב', 'ל', 'כ', 'מ', 'וב', 'ול', 'וכ', 'ומ', 'מב', 'ומב', 'לכ'];
// Keys have final letters regularized (ן → נ).
const ARAMAIC_ENDINGS = /(?:תא|יה|הו|יננ|יהו|ייהו|כונ|הונ|תונ|והי|נא|א)$/;
const HEBREW_SUFFIXES = ['יהמ', 'יהנ', 'תנו', 'ינו', 'יכמ', 'יכ', 'יו', 'נו', 'כמ', 'כנ', 'המ', 'הנ', 'ימ', 'ות', 'תי', 'כ', 'מ', 'ה', 'ו', 'י', 'ת'];
export const MARKING_POOL = Object.freeze(['bavli', 'yerushalmi', 'onkelos', 'biblical-aramaic']);
// Marks no Hebrew word bears: the relative ד־/כד־/מד־ on a word, the progressive קא־/קמ־, the Babylonian infinitive, the
// reflexive stems, and the endings ־ינן ־ייהו ־ינהו ־כון ־הון ־תון.
export const STRONG_ARAMAIC_MARK = /^(ו?ד|ו?כד|ו?מד)..|^(ו|ד)?(קא|קמ)..|^(ו|ד|ל)?מי[^י].+א$|^(ו|ד|ל)?(אית|אשת|אצט|אזד|אסת)..|(יננ|ייהו|ינהו|כונ|הונ|תונ)$/;
const HEBREW_REFERENCE_UNPOINTED = Object.freeze([/^Shulchan_Arukh__/, /^Kitzur_Shulchan_Arukh$/, /^Chayyei_Adam$/]);

// The plene (ktiv male) spelling of a pointed word, as rabbinic texts print it: hiriq → + י, kubbutz → + ו, holam on a
// consonant → + ו, a consonantal yod with dagesh inside a word → יי (חַיָּב → חייב). Returns the key, or '' if unpointed.
export function pleneKey(raw) {
  const clusters = [];
  for (const ch of String(raw)) { if (/[א-ת]/.test(ch)) clusters.push({ letter: ch, marks: '' }); else if (clusters.length) clusters.at(-1).marks += ch; }
  if (!clusters.some(cluster => /[ְ-ׇ]/.test(cluster.marks))) return '';
  let out = '';
  clusters.forEach((cluster, i) => {
    const next = clusters[i + 1]?.letter;
    const last = i === clusters.length - 1;
    const yodDagesh = cluster.letter === 'י' && cluster.marks.includes('ּ') && i > 0 && !last && clusters[i - 1].letter !== 'י' && next !== 'י';
    out += yodDagesh ? 'יי' : cluster.letter;
    if (last) return;
    if (cluster.marks.includes('ִ') && next !== 'י' && cluster.letter !== 'י') out += 'י';
    else if (cluster.marks.includes('ֻ') && next !== 'ו') out += 'ו';
    else if (cluster.marks.includes('ֹ') && cluster.letter !== 'ו' && next !== 'ו') out += 'ו';
  });
  return normalizeLookupToken(out);
}

async function countCorpora(corpusIds, { plene = false, filter = null } = {}) {
  const counts = new Map();
  const titled = new Map();
  let total = 0;
  for (const id of corpusIds) for await (const para of corpusParagraphs(id)) {
    if (filter && !filter(para)) continue;
    let previous = '';
    for (const token of tokenizeLookup(para.text)) {
      const keys = new Set([token.key]);
      if (plene) { const p = pleneKey(token.raw); if (p) keys.add(p); }
      for (const key of keys) counts.set(key, (counts.get(key) || 0) + 1);
      if (CORE_TITLES.has(previous)) titled.set(token.key, (titled.get(token.key) || 0) + 1);
      previous = token.key;
      total += 1;
    }
  }
  return { counts, titled, total };
}

export const isUnpointedHebrewReference = para => Boolean(para.work && HEBREW_REFERENCE_UNPOINTED.some(re => re.test(para.work)));
export const isHebrewReferenceParagraph = para => para.corpus === 'hebrew-reference' || isUnpointedHebrewReference(para);

// The Hebrew reference: pointed Tanakh/Mishnah/Mishneh Torah (both spellings) + the unpointed halachic works.
export async function hebrewReference() {
  const pointed = await countCorpora(['hebrew-reference'], { plene: true });
  const unpointed = await countCorpora(['other'], { filter: isUnpointedHebrewReference });
  // The unpointed halachic works quote the Gemara's Aramaic (אמרינן, דאמר, קמ״ל): a form that bears an Aramaic mark is
  // Hebrew-attested only by the pointed reference (the Tanakh, the Mishnah, the Mishneh Torah).
  const counts = new Map(pointed.counts);
  for (const [key, n] of unpointed.counts) { if (STRONG_ARAMAIC_MARK.test(key)) continue; counts.set(key, (counts.get(key) || 0) + n); }
  return { counts, total: pointed.total + unpointed.total, pointedTotal: pointed.total, unpointedTotal: unpointed.total };
}

// The divine name as printed in the Targum and the siddur.
export const DIVINE_NAMES = new Set(['יי', 'ייי', 'ה׳', 'יהוה']);
const NAME_PREFIXES_BA = ['ו', 'ד', 'ל', 'ב', 'כ', 'מ', 'וד', 'ול', 'וב', 'ומ', 'דל'];
const HEBREW_WORD_PREFIX = /^(ו)?(ה|ב|ל|כ|מ|ש)?/;
// The Hebrew text of the Torah by verse (the Onkelos parallel): ref → Set(keys, with and without their prefixes).
async function torahVerses() {
  const verses = new Map();
  for await (const para of corpusParagraphs('hebrew-reference')) {
    if (!/^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy)\./.test(para.ref)) continue;
    const keys = new Set();
    for (const token of tokenizeLookup(para.text)) { keys.add(token.key); keys.add(token.key.replace(HEBREW_WORD_PREFIX, '')); }
    verses.set(para.ref, keys);
  }
  return verses;
}

export async function createClassifier() {
  const H = await hebrewReference();
  const names = loadNames();
  const verses = await torahVerses();
  const NAME_PREFIX_LIST = ['', 'ו', 'ד', 'ל', 'ב', 'כ', 'מ', 'וד', 'ול', 'וב', 'ומ', 'דל', 'דב', 'דמ', 'וכ', 'מד', 'כד'];
  const nameInVerse = (key, ref) => { const v = verses.get(ref); if (!v) return false; return NAME_PREFIX_LIST.some(prefix => key.startsWith(prefix) && key.length - prefix.length >= 2 && names.has(key.slice(prefix.length)) && v.has(key.slice(prefix.length))); };
  const A = await countCorpora(ARAMAIC_POOL);
  const M = {};
  for (const id of MARKING_POOL) M[id] = await countCorpora([id]);
  const markingRate = k => { let n = 0; let t = 0; for (const id of MARKING_POOL) { n += M[id].counts.get(k) || 0; t += M[id].total; } return t ? n / t : 0; };
  const rateH = key => (H.counts.get(key) || 0) / H.total;
  const nameShare = key => { const n = A.counts.get(key) || 0; return n ? (A.titled.get(key) || 0) / n : 0; };
  // Form-level language in corpus C ({ id, counts, total }): { lang, rule }.
  function formLanguage(key, C) {
    const cache = (C.cache ||= new Map());
    if (cache.has(key)) return cache.get(key);
    const markedIn = k => { const c = C.counts.get(k) || 0; return c >= MIN_CORPUS_COUNT && c / C.total >= MARKED_RATIO * rateH(k) && markingRate(k) >= MARKED_RATIO * rateH(k); };
    const hebrewIn = k => (H.counts.get(k) || 0) >= MIN_HEBREW_COUNT && !markedIn(k);
    const h = H.counts.get(key) || 0;
    const a = A.counts.get(key) || 0;
    const n = key.length;
    let out;
    if (WHOLLY_ARAMAIC.includes(C.id)) out = { lang: 'ARAMAIC', rule: 'wholly-aramaic-corpus' };
    else if (h >= MIN_HEBREW_COUNT) out = markedIn(key) ? { lang: 'ARAMAIC', rule: 'aramaic-marked-homograph' } : { lang: 'HEBREW', rule: 'attested-hebrew' };
    else if (/^ד/.test(key) && n >= 3) out = { lang: 'ARAMAIC', rule: 'relative-dalet' };
    else if (/^(ו)?(כד|מד)/.test(key) && n >= 5) out = { lang: 'ARAMAIC', rule: 'relative-kad' };
    else if (/^(קא|קמ)/.test(key) && n >= 4) out = { lang: 'ARAMAIC', rule: 'progressive-ka' };
    else if (/^(מי|ומי|למי)[^י].*א$/.test(key) && n >= 5) out = { lang: 'ARAMAIC', rule: 'babylonian-infinitive' };
    else if (/^(ו|ד|ל)?(אית|את|אשת|אצט|אזד|אסת|תת|ית)/.test(key) && n >= 5) out = { lang: 'ARAMAIC', rule: 'reflexive-stem' };
    else if (/ונ$/.test(key) && n >= 5) out = { lang: 'ARAMAIC', rule: 'verbal-ending-un' };
    else if (ARAMAIC_ENDINGS.test(key) && n >= 3) out = { lang: 'ARAMAIC', rule: 'aramaic-ending' };
    else if (a >= FREQUENT_POOL) out = { lang: 'ARAMAIC', rule: 'aramaic-pool-frequent' };
    else {
      for (const prefix of [...HEBREW_ONLY_PREFIXES, ...SHARED_PREFIXES].sort((x, y) => y.length - x.length)) {
        if (!key.startsWith(prefix) || n - prefix.length < 2) continue;
        if (hebrewIn(key.slice(prefix.length))) { out = { lang: 'HEBREW', rule: 'hebrew-prefix+attested-base' }; break; }
      }
      if (!out) for (const prefix of SHARED_PREFIXES.slice().sort((x, y) => y.length - x.length)) {
        if (!key.startsWith(prefix) || n - prefix.length < 2) continue;
        const base = formLanguage(key.slice(prefix.length), C);
        if (base.lang === 'ARAMAIC' && !/pool-attested|wholly|prefix/.test(base.rule)) { out = { lang: 'ARAMAIC', rule: 'shared-prefix+aramaic-base' }; break; }
      }
      if (!out) outer: for (const prefix of ['', ...HEBREW_ONLY_PREFIXES, ...SHARED_PREFIXES]) {
        if (!key.startsWith(prefix)) continue;
        for (const suffix of HEBREW_SUFFIXES) {
          const base = key.slice(prefix.length, n - suffix.length);
          if (!key.endsWith(suffix) || base.length < 2) continue;
          if (hebrewIn(base)) { out = { lang: 'HEBREW', rule: 'hebrew-affix+attested-base' }; break outer; }
        }
      }
      if (!out) out = a >= MIN_ARAMAIC_POOL ? { lang: 'ARAMAIC', rule: 'aramaic-pool-attested' } : { lang: 'UNCERTAIN', rule: 'undecided' };
    }
    cache.set(key, out);
    return out;
  }
  // Token class. nextKey: the following token's key (a title before a name is part of the name).
  function classifyToken(key, previousKey, nextKey, C, ref = '') {
    if (/[״׳]/.test(key)) return 'ABBREVIATION';
    if (key.length === 1) return 'NUMBER';
    // v5: the divine name as the Targum and the siddur print it is a name in every corpus.
    if (DIVINE_NAMES.has(key)) return 'PROPER_NAME';
    // v5: Onkelos translates the Torah verse by verse — a name form (a Tanakh name, with or without a prefix) is a name
    // where the Hebrew verse it translates has that very name (דמצרים ↔ מצרים); למיכל "to eat" is not ל + מיכל.
    if (C.id === 'onkelos' && ref && isNameForm(key, names) && nameInVerse(key, ref)) return 'PROPER_NAME';
    // v5: in the Aramaic chapters of Daniel and Ezra (no parallel text), a bare Tanakh name, or a prefix on a long one.
    if (C.id === 'biblical-aramaic' && (names.has(key) || NAME_PREFIXES_BA.some(prefix => key.startsWith(prefix) && key.length - prefix.length >= 5 && names.has(key.slice(prefix.length))))) return 'PROPER_NAME';
    // A book of the Tanakh named in a citation, "(תהלים קד)".
    if (isBookName(key, names) && (!previousKey || previousKey !== nextKey) && /^[א-ת]{1,3}$/.test(nextKey || '') ) return 'PROPER_NAME';
    // A known name counts as a name unless the Aramaic texts use its letters far more often than the Hebrew reference
    // does (איתמר is Ithamar in the Tanakh and "it was said" in the Gemara).
    // (A wholly Aramaic translation of the Torah repeats its names — only the pool is compared there.)
    if (isNameForm(key, names) && markingRate(key) < MARKED_RATIO * rateH(key) && (WHOLLY_ARAMAIC.includes(C.id) || (C.counts.get(key) || 0) / C.total < MARKED_RATIO * Math.max(rateH(key), 1 / H.total))) return 'PROPER_NAME';
    if (TALMUDIC_CORPORA.includes(C.id) && isSageForm(key, names)) return 'PROPER_NAME';
    if (CORE_TITLES.has(key) && nextKey && nameShare(nextKey) >= NAME_SHARE) return 'PROPER_NAME';
    if (previousKey && TITLES.has(previousKey) && nameShare(key) >= NAME_SHARE) return 'PROPER_NAME';
    const { lang } = formLanguage(key, C);
    return lang === 'ARAMAIC' ? 'ARAMAIC_LEXICAL' : lang;
  }
  return { classifyToken, formLanguage, nameShare, names, H, A, M, version: CLASSIFIER_VERSION };
}

// A corpus's own form counts (pass 1 of the audit): { id, counts, total }. Hebrew-reference paragraphs are left out.
export async function corpusFrequency(corpusId) {
  const { counts, total } = await countCorpora([corpusId], { filter: para => !isUnpointedHebrewReference(para) });
  return { id: corpusId, counts, total };
}

// Raw-text counts the tokenizer does not yield.
export function countNonHebrew(text) {
  const foreign = (text.match(/[A-Za-z]{2,}/g) || []).length;
  const numbers = (text.match(/\d+/g) || []).length;
  const punctuation = (text.match(/[.,:;!?()[\]{}״"׃־–—-]/g) || []).length;
  return { foreign, numbers, punctuation };
}
