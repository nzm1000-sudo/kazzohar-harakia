// Reviewed Aramaic verb morphology (build time): the forms a verb lemma takes, generated from its root class and the
// stems the dictionaries attest for it, each with a morphological tag. Nothing here is a meaning: a generated form is
// only a candidate analysis, kept by the lexicon build when the form occurs in the app's texts and no stronger
// analysis (an exact headword, a form the dictionaries print) claims it. Keys throughout are lookup keys: unpointed,
// final letters regularised (ן → נ), so every template is written with regular letters.
//
// Tags: `${stem}.${tense}.${person}` — stem pe|pa|af|itpe|itpa|ittaf; tense perf|ptcp|pass|impf|impv|inf;
// person 3ms 3fs 2ms 2fs 1s 3mp 3fp 2mp 1pl, or ms fs mp fp for participles ('ptcp.1pl' = participle with the enclitic
// "we": אמרינן). The dialect profiles differ in the imperfect prefix (JBA נ־/ל־, Targumic/Biblical/Zoharic י־) and a few
// endings; every profile gets the union here — the corpus decides which forms exist.
//
// Root classes: strong; I-nun (נפק); I-aleph (אזל); I-yod (יתב); hollow (קום); III-weak (בעי, חזי, תני); geminate
// (עלל); and a reviewed table of the most frequent irregular verbs (אמר, אתא, הוה, יהב, סלק, עלל, קום, יכל), whose
// forms are listed in full.

const IMPF_PREFIX = ['נ', 'ל', 'י', 'ת', 'א'];
const IMPF_PERSON = { נ: ['3ms', '1pl'], ל: ['3ms'], י: ['3ms'], ת: ['2ms', '3fs'], א: ['1s'] };
// The persons of an imperfect prefix with no suffix: נ־ is both the Babylonian third person and the first plural
// (the build keeps the third-person reading of נ־/ל־ to the Babylonian profiles only).
const impfPersons = (pre, p) => (p ? [p] : pre === 'נ' ? ['3ms', '1pl'] : [IMPF_PERSON[pre][0]]);
const IMPF_SUFFIX = [['', null], ['ונ', '3mp'], ['ו', '3mp'], ['נ', '3fp'], ['ינ', '2fs'], ['י', '2fs']];
const PERF_SUFFIX = [['', '3ms'], ['ת', '3fs'], ['א', '3fs'], ['ה', '3fs'], ['תא', '2ms'], ['תי', '2fs'], ['ית', '1s'], ['י', '1s'], ['ו', '3mp'], ['ונ', '3mp'], ['תונ', '2mp'], ['תו', '2mp'], ['נא', '1pl'], ['נ', '1pl'], ['ננ', '1pl'], ['ינן', '1pl']];
const PTCP_SUFFIX = [['', 'ms'], ['א', 'fs'], ['ה', 'fs'], ['י', 'mp'], ['ינ', 'mp'], ['נ', 'fp'], ['אנ', 'fp'], ['נא', '1s'], ['ת', '2ms'], ['ינן', '1pl'], ['ננ', '1pl'], ['יתו', '2mp'], ['יתונ', '2mp']];
const IMPV_SUFFIX = [['', 'ms'], ['י', 'fs'], ['ו', 'mp'], ['ונ', 'mp']];
import { normalizeLookupToken } from '../../../src/services/wordLookup/normalize.mjs';
const fix = form => normalizeLookupToken(form);

export function rootOf(lemmaKey) {
  const k = lemmaKey.replace(/[״׳]/g, '');
  if (k.length === 4) return { radicals: [...k], cls: 'quad' };
  if (k.length !== 3) return null;
  const [c1, c2, c3] = k;
  if (k === 'הוה' || k === 'הוא' || k === 'הוי') return { radicals: ['ה', 'ו', 'י'], cls: 'hwy' };
  if ((c2 === 'ו' || c2 === 'י') && !/[אהי]/.test(c3)) return { radicals: [c1, c2, c3], cls: 'hollow' };
  if (/[אהי]/.test(c3)) return { radicals: [c1, c2, 'י'], cls: c1 === 'א' ? 'I-aleph+III-weak' : c1 === 'נ' ? 'I-nun+III-weak' : 'III-weak' };
  if (c2 === c3) return { radicals: [c1, c2, c3], cls: 'geminate' };
  if (c1 === 'נ') return { radicals: [c1, c2, c3], cls: 'I-nun' };
  if (c1 === 'א') return { radicals: [c1, c2, c3], cls: 'I-aleph' };
  if (c1 === 'י') return { radicals: [c1, c2, c3], cls: 'I-yod' };
  return { radicals: [c1, c2, c3], cls: 'strong' };
}

// The t-prefix of the reflexive stems before a first radical: metathesis with sibilants, assimilation with dentals.
function tStems(c1, rest) {
  const out = [];
  if (c1 === 'ס' || c1 === 'ש') out.push(`א${c1}ת${rest}`, `אי${c1}ת${rest}`);
  else if (c1 === 'צ') out.push(`אצט${rest}`, `איצט${rest}`);
  else if (c1 === 'ז') out.push(`אזד${rest}`, `איזד${rest}`);
  else out.push(`את${c1}${rest}`, `אית${c1}${rest}`);
  out.push(`אי${c1}${rest}`); // JBA assimilation: איבעי, איקרי, איגלי
  return out;
}

// The JBA assimilated reflexive base: א + י + the first radical, no ת (איבעי).
const isAssimilated = (base, c1) => c1 !== 'ת' && base.startsWith(`אי${c1}`) && !base.startsWith('אית');

function add(map, form, tag) { const f = fix(form); if (f.length < 2) return; if (!map.has(f)) map.set(f, new Set()); map.get(f).add(tag); }
const withSuffixes = (map, base, suffixes, prefix) => { for (const [s, p] of suffixes) add(map, base + s, `${prefix}.${p}`); };

function strongLike(map, [c1, c2, c3], stems, cls) {
  if (stems.has('pe')) {
    const perf = cls === 'hollow' ? `${c1}${c3}` : `${c1}${c2}${c3}`;
    withSuffixes(map, perf, PERF_SUFFIX, 'pe.perf');
    if (cls === 'hollow') {
      for (const base of [`${c1}אי${c3}`, `${c1}יי${c3}`, `${c1}אימ`.replace(/מ$/, c3)]) withSuffixes(map, base, PTCP_SUFFIX, 'pe.ptcp');
      for (const pre of IMPF_PREFIX) for (const y of ['', 'י']) for (const [s, p] of IMPF_SUFFIX) for (const q of impfPersons(pre, p)) add(map, `${pre}${y}${c1}ו${c3}${s}`, `pe.impf.${q}`);
      for (const inf of [`מי${c1}${c3}`, `מ${c1}ו${c3}`, `מי${c1}ו${c3}`]) add(map, inf, 'pe.inf');
      withSuffixes(map, `${c1}ו${c3}`, IMPV_SUFFIX, 'pe.impv');
    } else {
      withSuffixes(map, `${c1}${c2}${c3}`, PTCP_SUFFIX, 'pe.ptcp');
      withSuffixes(map, `${c1}${c2}י${c3}`, PTCP_SUFFIX, 'pe.pass');
      const weakFirst = cls === 'I-nun' || cls === 'I-aleph' || cls === 'I-yod';
      if (cls === 'I-aleph') withSuffixes(map, `${c1}${c2}י${c3}`, PTCP_SUFFIX, 'pe.ptcp'); // אזיל, אכיל
      for (const pre of IMPF_PREFIX) for (const y of ['', 'י']) for (const v of ['', 'ו', 'י']) for (const [s, p] of IMPF_SUFFIX) {
        const stem = weakFirst ? `${c2}${v}${c3}` : `${c1}${c2}${v}${c3}`;
        if (weakFirst && !y && pre !== 'א') continue; // נ/ל/י/ת + י + זיל (ניזיל), never ניזל without the yod
        for (const q of impfPersons(pre, p)) add(map, `${pre}${y}${stem}${s}`, `pe.impf.${q}`);
      }
      for (const v of ['', 'ו', 'י']) for (const inf of weakFirst ? [`מי${c2}${c3}`, `מ${c2}${v}${c3}`] : [`מי${c1}${c2}${v}${c3}`, `מ${c1}${c2}${v}${c3}`]) { add(map, inf, 'pe.inf'); add(map, `${inf}א`, 'pe.inf'); }
      for (const v of weakFirst ? ['', 'ו', 'י'] : ['ו']) withSuffixes(map, weakFirst ? `${c2}${v}${c3}` : `${c1}${c2}${v}${c3}`, IMPV_SUFFIX, 'pe.impv');
    }
  }
  if (stems.has('pa')) {
    for (const base of [`${c1}${c2}${c3}`, `${c1}${c2}י${c3}`, `${c1}י${c2}${c3}`]) withSuffixes(map, base, PERF_SUFFIX, 'pa.perf');
    for (const base of [`מ${c1}${c2}${c3}`, `מ${c1}${c2}י${c3}`]) withSuffixes(map, base, PTCP_SUFFIX, 'pa.ptcp');
    for (const pre of IMPF_PREFIX) for (const base of [`${c1}${c2}${c3}`, `${c1}${c2}י${c3}`]) for (const [s, p] of IMPF_SUFFIX) for (const q of impfPersons(pre, p)) add(map, `${pre}${base}${s}`, `pa.impf.${q}`);
    for (const inf of [`${c1}${c2}ו${c3}י`, `${c1}${c2}ו${c3}ה`, `מ${c1}${c2}${c3}א`, `${c1}${c2}${c3}א`]) add(map, inf, 'pa.inf');
    for (const base of [`${c1}${c2}${c3}`, `${c1}${c2}י${c3}`]) withSuffixes(map, base, IMPV_SUFFIX, 'pa.impv');
  }
  if (stems.has('af')) {
    const hollow = cls === 'hollow';
    const I = cls === 'I-nun' ? [`${c2}י${c3}`, `${c2}${c3}`] : cls === 'I-yod' || cls === 'I-aleph' || hollow ? [`ו${hollow ? c1 : c2}י${c3}`, `ו${hollow ? c1 : c2}${c3}`] : [`${c1}${c2}י${c3}`, `${c1}${c2}${c3}`];
    for (const base of I) {
      for (const pre of ['א', 'ה']) withSuffixes(map, pre + base, PERF_SUFFIX, 'af.perf');
      withSuffixes(map, `מ${base}`, PTCP_SUFFIX, 'af.ptcp');
      for (const pre of IMPF_PREFIX) for (const [s, p] of IMPF_SUFFIX) for (const q of impfPersons(pre, p)) add(map, `${pre}${base}${s}`, `af.impf.${q}`);
      withSuffixes(map, `א${base}`, IMPV_SUFFIX, 'af.impv');
    }
    const r = cls === 'I-nun' ? `${c2}ו${c3}` : cls === 'I-yod' || cls === 'I-aleph' ? `ו${c2}ו${c3}` : hollow ? `ו${c1}${c3}` : `${c1}${c2}ו${c3}`;
    for (const inf of [`א${r}י`, `א${r.replace(/ו(?=.$)/, '')}א`, `ה${r.replace(/ו(?=.$)/, '')}א`]) add(map, inf, 'af.inf');
  }
  for (const stem of ['itpe', 'itpa']) {
    if (!stems.has(stem)) continue;
    const rest = cls === 'I-aleph' ? [`${c2}${c3}`, `${c2}י${c3}`] : cls === 'hollow' ? [`ו${c1}${c3}`, `${c1}י${c3}`] : [`${c2}${c3}`, `${c2}י${c3}`];
    const first = cls === 'I-aleph' ? '' : cls === 'hollow' ? '' : c1;
    for (const r of rest) {
      const bases = first ? tStems(first, r) : [`את${r}`, `אית${r}`, `אתא${r}`];
      if (cls === 'hollow') bases.push(...tStems(c1, r.replace(/^ו/, 'ו')));
      for (const base of bases) {
        withSuffixes(map, base, PERF_SUFFIX, `${stem}.perf`);
        const inner = base.replace(/^אי?/, '');
        for (const m of ['מ', 'מי']) withSuffixes(map, m + inner, PTCP_SUFFIX, `${stem}.ptcp`);
        // The assimilated base (איבעי, איקרי) has no ת: its imperfect and infinitive would be the simple stem's own
        // forms (ליעבד is "let him do", not "let it be done") — only its perfect and participle are generated.
        if (isAssimilated(base, first || c1)) continue;
        for (const pre of IMPF_PREFIX) for (const y of ['', 'י']) for (const [s, p] of IMPF_SUFFIX) for (const q of impfPersons(pre, p)) add(map, `${pre}${y}${inner}${s}`, `${stem}.impf.${q}`);
        add(map, `${base.replace(/(.)$/, 'ו$1')}י`, `${stem}.inf`);
        add(map, `${base}א`, `${stem}.inf`);
      }
    }
  }
}

function thirdWeak(map, [c1, c2], stems, cls) {
  const I = cls === 'I-aleph+III-weak' ? c2 : null; // אתא-type handled in the irregular table; generic I-aleph+III-weak drop א in impf
  if (stems.has('pe')) {
    for (const [s, p] of [['א', '3ms'], ['ה', '3ms'], ['ת', '3fs'], ['את', '3fs'], ['יא', '3fs'], ['אי', '1s'], ['ית', '1s'], ['יתא', '2ms'], ['ו', '3mp'], ['ונ', '3mp'], ['יתו', '2mp'], ['יתונ', '2mp'], ['ינא', '1pl'], ['ינן', '1pl'], ['אנ', '1pl']]) add(map, `${c1}${c2}${s}`, `pe.perf.${p}`);
    for (const [s, p] of [['י', 'ms'], ['יא', 'fs'], ['ו', 'mp'], ['נ', 'mp'], ['ינ', 'mp'], ['יינ', 'mp'], ['יאנ', 'fp'], ['ינא', '1s'], ['ינן', '1pl'], ['ית', '2ms'], ['יתו', '2mp'], ['יתונ', '2mp']]) add(map, `${c1}${c2}${s}`, `pe.ptcp.${p}`);
    for (const [s, p] of [['י', 'ms'], ['יא', 'fs'], ['יי', 'mp'], ['יינ', 'mp'], ['ינ', 'mp'], ['יאנ', 'fp']]) add(map, `${c1}${c2}${s}`, `pe.pass.${p}`);
    for (const pre of IMPF_PREFIX) for (const y of ['', 'י']) for (const [s, p] of [['י', null], ['א', null], ['ה', null], ['ו', '3mp'], ['ונ', '3mp'], ['ינ', '2fs'], ['יינ', '3fp']]) {
      const stem = I ? `${c2}` : `${c1}${c2}`;
      for (const q of impfPersons(pre, p)) add(map, `${pre}${y}${stem}${s}`, `pe.impf.${q}`);
    }
    for (const m of ['מ', 'מי']) for (const s of ['א', 'י', 'יא']) add(map, `${m}${I ? '' : c1}${c2}${s}`.replace(/^מי?(?=.$)/, 'מי'), 'pe.inf');
    for (const [s, p] of [['י', 'ms'], ['א', 'ms'], ['ו', 'mp'], ['ונ', 'mp'], ['אי', 'fs']]) add(map, `${I ? '' : c1}${c2}${s}`, `pe.impv.${p}`);
  }
  if (stems.has('pa')) {
    for (const [s, p] of [['י', '3ms'], ['יא', '3ms'], ['ית', '1s'], ['יאו', '3mp'], ['ו', '3mp'], ['ינן', '1pl']]) add(map, `${c1}${c2}${s}`, `pa.perf.${p}`);
    for (const [s, p] of [['י', 'ms'], ['יא', 'fs'], ['ו', 'mp'], ['ינ', 'mp'], ['יינ', 'mp'], ['ינא', '1s'], ['ינן', '1pl']]) add(map, `מ${c1}${c2}${s}`, `pa.ptcp.${p}`);
    for (const pre of IMPF_PREFIX) for (const [s, p] of [['י', null], ['ו', '3mp'], ['ונ', '3mp']]) for (const q of impfPersons(pre, p)) add(map, `${pre}${c1}${c2}${s}`, `pa.impf.${q}`);
    for (const inf of [`${c1}${c2}ויי`, `${c1}${c2}ואה`, `מ${c1}${c2}יא`, `${c1}${c2}אה`]) add(map, inf, 'pa.inf');
  }
  if (stems.has('af')) {
    for (const pre of ['א', 'ה', 'או']) for (const [s, p] of [['י', '3ms'], ['יא', '3ms'], ['ית', '1s'], ['יאו', '3mp'], ['ו', '3mp'], ['ינן', '1pl']]) add(map, `${pre}${c1}${c2}${s}`, `af.perf.${p}`);
    for (const [s, p] of [['י', 'ms'], ['יא', 'fs'], ['ו', 'mp'], ['ינ', 'mp'], ['ינא', '1s'], ['ינן', '1pl']]) add(map, `מ${c1}${c2}${s}`, `af.ptcp.${p}`);
    for (const pre of IMPF_PREFIX) for (const [s, p] of [['י', null], ['ו', '3mp'], ['ונ', '3mp']]) for (const q of impfPersons(pre, p)) add(map, `${pre}${c1}${c2}${s}`, `af.impf.${q}`);
    for (const inf of [`א${c1}${c2}ויי`, `א${c1}${c2}אה`, `ה${c1}${c2}אה`]) add(map, inf, 'af.inf');
  }
  for (const stem of ['itpe', 'itpa']) {
    if (!stems.has(stem)) continue;
    for (const base of tStems(c1, c2)) {
      for (const [s, p] of [['י', '3ms'], ['יא', '3fs'], ['יאת', '3fs'], ['ו', '3mp'], ['יאו', '3mp'], ['ית', '1s'], ['ינן', '1pl'], ['א', '3ms']]) add(map, base + s, `${stem}.perf.${p}`);
      const inner = base.replace(/^אי?/, '');
      for (const m of ['מ', 'מי']) for (const [s, p] of [['י', 'ms'], ['יא', 'fs'], ['ו', 'mp'], ['ינ', 'mp'], ['יינ', 'mp']]) add(map, m + inner + s, `${stem}.ptcp.${p}`);
      if (isAssimilated(base, c1)) continue;
      for (const pre of IMPF_PREFIX) for (const y of ['', 'י']) for (const [s, p] of [['י', null], ['ו', '3mp'], ['ונ', '3mp']]) for (const q of impfPersons(pre, p)) add(map, `${pre}${y}${inner}${s}`, `${stem}.impf.${q}`);
      for (const s of ['ויי', 'יא', 'אה']) add(map, base + s, `${stem}.inf`);
    }
  }
}

// The most frequent irregular verbs, listed in full (reviewed forms of Jewish Babylonian, Targumic and Zoharic
// Aramaic). Keys: the lemma key as the dictionaries print it.
export const IRREGULAR = Object.freeze({
  אמר: { 'pe.perf.3ms': ['אמר'], 'pe.perf.3fs': ['אמרה', 'אמרא', 'אמרת'], 'pe.perf.1s': ['אמרי', 'אמרית', 'אמרנא'], 'pe.perf.2ms': ['אמרת', 'אמרתא'], 'pe.perf.3mp': ['אמרו', 'אמרונ'], 'pe.perf.2mp': ['אמרתו', 'אמרתונ'], 'pe.perf.1pl': ['אמרנ', 'אמריננ', 'אמרנא'],
    'pe.ptcp.ms': ['אמר', 'אמאר'], 'pe.ptcp.fs': ['אמרה', 'אמרא'], 'pe.ptcp.mp': ['אמרי', 'אמרינ'], 'pe.ptcp.1s': ['אמינא', 'אמרנא'], 'pe.ptcp.2ms': ['אמרת'], 'pe.ptcp.1pl': ['אמריננ'], 'pe.ptcp.2mp': ['אמריתו', 'אמריתונ'],
    'pe.pass.ms': ['אמיר'], 'pe.pass.fs': ['אמירא', 'אמירה'], 'pe.pass.mp': ['אמירי', 'אמירינ'],
    'pe.impf.3ms': ['נימא', 'לימא', 'יימר', 'ימר', 'יימא'], 'pe.impf.2ms': ['תימא', 'תימר', 'תימרו'], 'pe.impf.1s': ['איימא', 'אימא', 'אימר'], 'pe.impf.1pl': ['נימא', 'נימר'], 'pe.impf.3mp': ['נימרו', 'לימרו', 'יימרונ', 'ימרונ', 'לימרונ'], 'pe.impf.2mp': ['תימרו', 'תימרונ'],
    'pe.inf': ['מימר', 'מימרא', 'מימרה', 'מיימר', 'מימרינהו'], 'pe.impv.ms': ['אימא', 'אמר', 'אימר'], 'pe.impv.mp': ['אימרו', 'אמרו'],
    'itpe.perf.3ms': ['איתמר', 'אתמר', 'איתאמר', 'אתאמר'], 'itpe.perf.3fs': ['איתמרא', 'אתמרא', 'איתמרה', 'אתאמרת', 'אתמרת'], 'itpe.perf.3mp': ['איתמרו', 'אתמרו', 'אתאמרו'], 'itpe.ptcp.ms': ['מיתמר', 'מתמר', 'מתאמר', 'מיתאמר'], 'itpe.ptcp.fs': ['מיתמרא', 'מתאמרא'], 'itpe.impf.3ms': ['ניתמר', 'ליתמר', 'יתאמר', 'יתמר'] },
  אתא: { 'pe.perf.3ms': ['אתא', 'אתה'], 'pe.perf.3fs': ['אתת', 'אתאי', 'אתיא', 'אתאת'], 'pe.perf.1s': ['אתאי', 'אתית', 'אתינא'], 'pe.perf.2ms': ['אתית', 'אתיתא'], 'pe.perf.3mp': ['אתו', 'אתונ', 'אתאו'], 'pe.perf.1pl': ['אתינא', 'אתאנ', 'אתיננ'], 'pe.perf.2mp': ['אתיתו', 'אתיתונ'],
    'pe.ptcp.ms': ['אתי', 'אתא'], 'pe.ptcp.fs': ['אתיא', 'אתיה'], 'pe.ptcp.mp': ['אתו', 'אתינ', 'אתנ', 'אתיינ'], 'pe.ptcp.1s': ['אתינא'], 'pe.ptcp.1pl': ['אתיננ'], 'pe.ptcp.2ms': ['אתית'],
    'pe.impf.3ms': ['ניתי', 'ליתי', 'ייתי', 'יתי', 'ניתא', 'ליתא'], 'pe.impf.2ms': ['תיתי', 'תיתא'], 'pe.impf.1s': ['איתי', 'אתי'], 'pe.impf.3mp': ['ניתו', 'ליתו', 'ייתונ', 'יתונ', 'ייתו'], 'pe.impf.2mp': ['תיתו', 'תיתונ'],
    'pe.inf': ['מיתי', 'מיתא', 'מיתיא', 'מתא', 'מיתייא'], 'pe.impv.ms': ['תא', 'איתא', 'אתא'], 'pe.impv.mp': ['תו', 'איתו', 'אתו'], 'pe.impv.fs': ['תי', 'איתי'],
    'af.perf.3ms': ['אייתי', 'איתי', 'אתי', 'היתי', 'אייתיה'], 'af.perf.3mp': ['אייתו', 'אתיאו', 'איתיאו', 'היתיו'], 'af.perf.1s': ['אייתי', 'אייתית', 'אתיתי'], 'af.ptcp.ms': ['מייתי', 'מיתי', 'מתי'], 'af.ptcp.mp': ['מייתו', 'מייתי', 'מייתינ'], 'af.ptcp.1pl': ['מייתיננ', 'מיתיננ'], 'af.ptcp.1s': ['מייתינא'],
    'af.impf.3ms': ['נייתי', 'לייתי', 'ליתי', 'ייתי', 'ניתי'], 'af.impf.2ms': ['תייתי', 'תיתי'], 'af.impf.1s': ['אייתי'], 'af.impf.3mp': ['נייתו', 'לייתו', 'ייתונ'], 'af.inf': ['אתויי', 'אייתויי', 'איתויי', 'אתאה', 'אייתאה', 'היתאה'], 'af.impv.ms': ['אייתי', 'איתי', 'אתי'], 'af.impv.mp': ['אייתו'],
    'itpe.perf.3ms': ['איתתי', 'אתיתי', 'איתיתי', 'איתאי'], 'itpe.ptcp.ms': ['מיתתי', 'מתיתי', 'מיתיתי'] },
  הוה: { 'pe.perf.3ms': ['הוה', 'הוא'], 'pe.perf.3fs': ['הות', 'הוות', 'הואי', 'הויא', 'הוואי', 'הוה'], 'pe.perf.1s': ['הואי', 'הוית', 'הויתי', 'הוינא', 'הווינא'], 'pe.perf.2ms': ['הוית', 'הויתא'], 'pe.perf.3mp': ['הוו', 'הוונ', 'הואו', 'הוונא'], 'pe.perf.2mp': ['הויתו', 'הויתונ'], 'pe.perf.1pl': ['הוינא', 'הויננ', 'הווננ', 'הוינ'],
    'pe.ptcp.ms': ['הוי', 'הווי', 'הויי'], 'pe.ptcp.fs': ['הויא', 'הוויא', 'הויה', 'הוייא'], 'pe.ptcp.mp': ['הוינ', 'הויינ', 'הוייני', 'הוי'], 'pe.ptcp.fp': ['הויאנ', 'הוייאנ', 'הוינ'], 'pe.ptcp.1s': ['הוינא', 'הווינא'], 'pe.ptcp.1pl': ['הויננ', 'הווננ'], 'pe.ptcp.2ms': ['הוית'],
    'pe.impf.3ms': ['ניהוי', 'ליהוי', 'להוי', 'נהוי', 'יהוי', 'יהי', 'יהא', 'יהווי', 'ליהווי'], 'pe.impf.3fs': ['תיהוי', 'תהוי', 'תהי', 'תהא', 'תיהווי'], 'pe.impf.2ms': ['תיהוי', 'תהוי', 'תהי'], 'pe.impf.1s': ['איהוי', 'אהוי', 'אהא'], 'pe.impf.1pl': ['ניהוי', 'נהוי', 'נהי', 'נהא'], 'pe.impf.3mp': ['ליהוו', 'ניהוו', 'להוו', 'יהונ', 'יהוונ', 'יהוו', 'ליהווי'], 'pe.impf.2mp': ['תיהוו', 'תהונ', 'תיהוונ', 'תהוונ'], 'pe.impf.3fp': ['יהוינ', 'יהויינ'],
    'pe.inf': ['מיהוי', 'מהוי', 'מיהוא', 'מהוא', 'מהויא', 'מיהויא'], 'pe.impv.ms': ['הוי', 'הווי'], 'pe.impv.mp': ['הוונ'] },
  יהב: { 'pe.perf.3ms': ['יהב'], 'pe.perf.3fs': ['יהבה', 'יהבא', 'יהבת'], 'pe.perf.1s': ['יהבי', 'יהבית', 'יהבנא'], 'pe.perf.2ms': ['יהבת', 'יהבתא'], 'pe.perf.3mp': ['יהבו', 'יהבונ'], 'pe.perf.1pl': ['יהבנ', 'יהביננ', 'יהבנא'],
    'pe.ptcp.ms': ['יהיב', 'יהב'], 'pe.ptcp.fs': ['יהבא', 'יהבה'], 'pe.ptcp.mp': ['יהבי', 'יהבינ'], 'pe.ptcp.1s': ['יהיבנא', 'יהבנא'], 'pe.ptcp.1pl': ['יהביננ'], 'pe.ptcp.2ms': ['יהבת'], 'pe.pass.ms': ['יהיב'], 'pe.pass.fs': ['יהיבא', 'יהיבה'], 'pe.pass.mp': ['יהיבי', 'יהיבינ'],
    'pe.impf.3ms': ['ניתיב', 'ליתיב', 'ניתנ', 'ליתנ', 'יתנ', 'ייתנ'], 'pe.impf.2ms': ['תיתיב', 'תיתנ', 'תתנ'], 'pe.impf.1s': ['איתיב', 'איתנ', 'אתנ'], 'pe.impf.1pl': ['ניתיב', 'ניתנ'], 'pe.impf.3mp': ['ניתבו', 'ליתבו', 'יתנונ', 'ליתנו', 'ניתנו'], 'pe.impf.2mp': ['תיתנונ', 'תתנונ'],
    'pe.inf': ['מיתב', 'מיתנ', 'מתנ', 'מיתבא', 'מיתנא'], 'pe.impv.ms': ['הב', 'הבא'], 'pe.impv.mp': ['הבו'], 'pe.impv.fs': ['הבי'],
    'itpe.perf.3ms': ['איתיהיב', 'אתיהיב', 'איתיהב', 'אתיהב'], 'itpe.perf.3fs': ['איתיהיבא', 'אתיהבת', 'איתיהבא'], 'itpe.perf.3mp': ['איתיהיבו', 'אתיהיבו', 'אתיהבו'], 'itpe.ptcp.ms': ['מיתיהיב', 'מתיהיב', 'מתיהב'], 'itpe.ptcp.fs': ['מיתיהבא', 'מתיהבא'], 'itpe.impf.3ms': ['ניתיהיב', 'ליתיהיב', 'יתיהב'] },
  סלק: { 'pe.perf.3ms': ['סליק', 'סלק'], 'pe.perf.3fs': ['סליקא', 'סלקא', 'סלקת'], 'pe.perf.3mp': ['סליקו', 'סלקו', 'סליקונ', 'סלקונ'], 'pe.perf.1s': ['סליקי', 'סליקית', 'סליקנא'], 'pe.ptcp.ms': ['סליק', 'סלק'], 'pe.ptcp.fs': ['סלקא', 'סליקא'], 'pe.ptcp.mp': ['סלקי', 'סלקינ', 'סליקינ'], 'pe.ptcp.1s': ['סליקנא'], 'pe.ptcp.1pl': ['סלקיננ'],
    'pe.impf.3ms': ['ניסק', 'ליסק', 'יסק', 'ייסק', 'ניסוק', 'ליסוק', 'יסוק'], 'pe.impf.3mp': ['ניסקו', 'ליסקו', 'יסקונ'], 'pe.impf.2ms': ['תיסק', 'תסק', 'תיסוק'], 'pe.impf.1s': ['איסק', 'אסק'], 'pe.inf': ['מיסק', 'מסק', 'מיסקא', 'מסקא'], 'pe.impv.ms': ['סק', 'סוק'], 'pe.impv.mp': ['סקו', 'סוקו'],
    'af.perf.3ms': ['אסיק', 'אסק', 'אסקיה', 'הסיק', 'אסקה'], 'af.perf.3mp': ['אסיקו', 'אסקו'], 'af.ptcp.ms': ['מסיק', 'מסק'], 'af.ptcp.mp': ['מסקי', 'מסקינ'], 'af.ptcp.1pl': ['מסקיננ'], 'af.impf.3ms': ['ניסיק', 'ליסיק', 'יסיק', 'ליסק'], 'af.inf': ['אסוקי', 'אסוקה', 'אסקא', 'הסקא'], 'af.impv.ms': ['אסיק', 'אסק'] },
  עלל: { 'pe.perf.3ms': ['על', 'עאל', 'עלל'], 'pe.perf.3fs': ['עלת', 'עלא', 'עלה', 'עאלת'], 'pe.perf.3mp': ['עלו', 'עאלו', 'עלונ', 'עללו'], 'pe.perf.1s': ['עלי', 'עלית', 'עלנא'], 'pe.ptcp.ms': ['עייל', 'עיל', 'עאל', 'עליל'], 'pe.ptcp.fs': ['עיילא', 'עיילה', 'עלא'], 'pe.ptcp.mp': ['עיילי', 'עיילינ', 'עאלינ', 'עללינ'], 'pe.ptcp.1s': ['עיילנא'], 'pe.ptcp.1pl': ['עייליננ'],
    'pe.impf.3ms': ['ניעול', 'ליעול', 'ייעול', 'יעול', 'ניעל', 'ליעל'], 'pe.impf.3mp': ['ניעלו', 'ליעלו', 'ייעלונ', 'יעלונ', 'ניעולו'], 'pe.impf.2ms': ['תיעול', 'תעול'], 'pe.impf.1s': ['איעול'], 'pe.inf': ['מיעל', 'מיעאל', 'מיעול', 'מעל', 'מעאל'], 'pe.impv.ms': ['עול', 'עיל'], 'pe.impv.mp': ['עולו', 'עולונ'],
    'af.perf.3ms': ['אעיל', 'אעל', 'עייל', 'אעליה', 'אעלה', 'הנעל'], 'af.perf.3mp': ['אעילו', 'אעלו', 'עיילו'], 'af.ptcp.ms': ['מעייל', 'מעיל', 'מעל'], 'af.ptcp.mp': ['מעיילי', 'מעלינ'], 'af.impf.3ms': ['ניעייל', 'לעייל', 'ליעייל', 'יעל'], 'af.inf': ['אעולי', 'עיולי', 'לעיולי', 'אעלא', 'העלא'] },
  קומ: { 'pe.perf.3ms': ['קמ', 'קאמ'], 'pe.perf.3fs': ['קמא', 'קמה', 'קמת'], 'pe.perf.3mp': ['קמו', 'קמונ'], 'pe.perf.1s': ['קמי', 'קמית', 'קמנא'], 'pe.ptcp.ms': ['קאימ', 'קאי', 'קיימ', 'קאמ'], 'pe.ptcp.fs': ['קיימא', 'קיימה', 'קאימא'], 'pe.ptcp.mp': ['קיימי', 'קיימינ', 'קאמי', 'קאימינ'], 'pe.ptcp.1s': ['קאימנא', 'קיימנא', 'קאינא'], 'pe.ptcp.1pl': ['קיימיננ', 'קאימיננ', 'קיימינא'], 'pe.ptcp.2ms': ['קיימת', 'קאית'],
    'pe.impf.3ms': ['ניקומ', 'ליקומ', 'יקומ', 'נקומ', 'לוקמ'], 'pe.impf.3mp': ['ניקומו', 'ליקומו', 'יקומונ', 'יקומו'], 'pe.impf.2ms': ['תיקומ', 'תקומ'], 'pe.impf.1s': ['איקומ', 'אקומ'], 'pe.inf': ['מיקמ', 'מיקומ', 'מקמ', 'מיקאמ', 'מקאמ'], 'pe.impv.ms': ['קומ', 'קום'], 'pe.impv.mp': ['קומו', 'קומונ'],
    'af.perf.3ms': ['אוקי', 'אוקימ', 'אוקמ', 'אקימ', 'אקמ', 'הקימ', 'אוקמה', 'אוקמיה'], 'af.perf.3mp': ['אוקמו', 'אוקימו', 'אקימו'], 'af.ptcp.ms': ['מוקי', 'מוקימ', 'מוקמ', 'מקימ', 'מקמ'], 'af.ptcp.mp': ['מוקמי', 'מוקמינ', 'מקימינ'], 'af.ptcp.1pl': ['מוקמיננ', 'מוקימיננ'], 'af.ptcp.1s': ['מוקימנא', 'מוקמינא'],
    'af.impf.3ms': ['נוקי', 'לוקי', 'נוקמ', 'לוקמ', 'יקימ', 'יוקימ'], 'af.impf.3mp': ['נוקמו', 'לוקמו'], 'af.inf': ['אוקמי', 'אוקומי', 'אוקמא', 'אקמא', 'הקמא'], 'af.impv.ms': ['אוקי', 'אוקימ', 'אקימ'],
    'itpe.perf.3ms': ['איתוקמ', 'אתוקמ', 'איתקמ', 'אתקמ', 'איתקיימ', 'אתקיימ'], 'itpe.ptcp.ms': ['מיתוקמ', 'מתוקמ', 'מתקיימ', 'מיתקיימ'], 'itpe.ptcp.fs': ['מיתוקמא', 'מתוקמא', 'מתקיימא'], 'itpe.impf.3ms': ['ניתוקמ', 'ליתוקמ', 'יתקיימ'] },
  יכל: { 'pe.perf.3ms': ['יכל', 'יכיל'], 'pe.perf.3mp': ['יכלו', 'יכילו'], 'pe.ptcp.ms': ['יכיל', 'יכל'], 'pe.ptcp.fs': ['יכלא', 'יכילא'], 'pe.ptcp.mp': ['יכלי', 'יכלינ', 'יכילינ'], 'pe.ptcp.1s': ['יכילנא', 'יכלנא'], 'pe.ptcp.1pl': ['יכליננ', 'יכיליננ'], 'pe.ptcp.2ms': ['יכלת', 'יכילת'], 'pe.impf.3ms': ['ייכול', 'יכול', 'ניכול', 'ליכול'], 'pe.impf.3mp': ['ייכלונ', 'יכלונ', 'ניכלו'], 'pe.impf.2ms': ['תיכול', 'תכול'], 'pe.impf.1s': ['איכול', 'אכול'] },
});

// All candidate forms of a verb lemma: Map(form → Set(tag)). `stems`: the stems the dictionaries attest.
export function verbForms(lemmaKey, stems) {
  const map = new Map();
  const irregular = IRREGULAR[lemmaKey];
  if (irregular) { for (const [tag, forms] of Object.entries(irregular)) for (const form of forms) add(map, form, tag); return map; }
  const root = rootOf(lemmaKey);
  if (!root) return map;
  const s = new Set(stems);
  s.add('pe');
  if (root.cls === 'quad') {
    const [a, b, c, d] = root.radicals;
    const q = `${a}${b}${c}${d}`;
    withSuffixes(map, q, PERF_SUFFIX, 'pa.perf');
    withSuffixes(map, `מ${q}`, PTCP_SUFFIX, 'pa.ptcp');
    withSuffixes(map, `${a}${b}${c}י${d}`, PTCP_SUFFIX, 'pa.pass');
    for (const pre of IMPF_PREFIX) for (const [x, p] of IMPF_SUFFIX) for (const person of impfPersons(pre, p)) add(map, `${pre}${q}${x}`, `pa.impf.${person}`);
    add(map, `${a}${b}${c}ו${d}י`, 'pa.inf'); add(map, `${q}א`, 'pa.inf');
    for (const base of tStems(a, `${b}${c}${d}`)) { withSuffixes(map, base, PERF_SUFFIX, 'itpa.perf'); const inner = base.replace(/^אי?/, ''); for (const m of ['מ', 'מי']) withSuffixes(map, m + inner, PTCP_SUFFIX, 'itpa.ptcp'); }
    return map;
  }
  if (/III-weak|hwy/.test(root.cls)) thirdWeak(map, root.radicals, s, root.cls);
  else strongLike(map, root.radicals, s, root.cls);
  return map;
}
