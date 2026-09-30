// The verified lexicon of the Aramaic engine (build time): lemmas with their Hebrew senses, the forms the dictionaries
// themselves print for each lemma, spelling aliases, phrases and abbreviations — from the imported sources only.
//   Lemma  { key, pos, senses: [Sense], stems: Set, hebrewStems: { nif, pi, hif, hitpa }, sources: Set, names }
//   Sense  { gloss, sourceId, entryId, n, stem, kind, evidence: { corpus: n }, formKeys }
//     kind: 'def'       a Hebrew definition (Krupnik & Silbermann), cut to its short gloss by fixed rules
//           'same'      Jastrow "ch. same": the Aramaic word is the Hebrew word of the entry he links to
//           'eq'        Jastrow "= h. X" / "(= b. h. X)": the Hebrew equivalent he prints
//           'targum-h'  (not used since pass 2: Jastrow "(h. X)" after a Targum citation, the verse word — unreliable)
//           'wikt'      a Hebrew Wiktionary sense marked Aramaic ({{ארמית}})
// No gloss is written here: each one is a source's own Hebrew, cleaned by fixed rules.
import { unpoint, keyOf, words } from '../lexica/common.mjs';
import { pleneKey } from '../../aramaic/classify.mjs';
import { normalizeLookupToken, isAbbreviationKey } from '../../../src/services/wordLookup/normalize.mjs';

const KRUPNIK = 'krupnik-1927';
const JASTROW = 'jastrow-1903';
const WIKT = 'he-wiktionary';
const STEM_OF_KRUPNIK = { qal: 'pe', pa: 'pa', af: 'af', itp: 'itpe', hitp: 'itpa', nif: 'itpe', hif: 'af', shaf: 'shaf', ishtaf: 'ishtaf', pilpel: 'pa' };
const STEM_OF_JASTROW = { pe: 'pe', pa: 'pa', af: 'af', itpe: 'itpe', itpa: 'itpa', ittaf: 'ittaf', palp: 'pa', itpalp: 'itpa', pol: 'pa', itpol: 'itpa', ishtaf: 'ishtaf' };
const cleanHebrew = pointed => unpoint(String(pointed)).replace(/[²³⁴⁵⁶⁷⁸⁹¹⁰*]/g, '').replace(/\s+(I{1,3}|IV|V|VI|VII)$/, '').replace(/[.,;:]$/, '').trim();

// missingHebrew: reviewed Hebrew for Krupnik senses whose Hebrew definition is missing from the digitization (the
// entry prints only its English/German translation) — Map(`${entryId}#${n}` → gloss); kind 'def-en'.
export function buildLexicon({ krupnik = [], jastrow = [], wiktionary = { aramaic: [], abbreviations: [], idioms: [] }, exclude = [], missingHebrew = new Map() }) {
  const use = id => !exclude.includes(id);
  const lemmas = new Map();
  const sourceForms = new Map(); // form key → [{ lemma, tag, strength, sourceId, entryId, stem }]
  const aliases = new Map(); // key → Set(target keys)
  const phrases = [];
  const abbreviations = new Map(); // key → [{ expansion, sourceId, entryId, senses }]
  const names = new Set();
  const lemma = (key, pos = '') => {
    if (!lemmas.has(key)) lemmas.set(key, { key, pos: '', senses: [], stems: new Set(), hebrewStems: {}, sources: new Set(), entries: [] });
    const l = lemmas.get(key);
    if (pos && (!l.pos || l.pos === 'other')) l.pos = pos;
    return l;
  };
  const addForm = (form, entry) => {
    if (!form || form.length < 2 || form === entry.lemma) return;
    if (!sourceForms.has(form)) sourceForms.set(form, []);
    const list = sourceForms.get(form);
    if (!list.some(x => x.lemma === entry.lemma && x.tag === entry.tag && x.sourceId === entry.sourceId)) list.push(entry);
  };
  const addAlias = (key, target) => { if (!key || !target || key === target || key.length < 2) return; if (!aliases.has(key)) aliases.set(key, new Set()); aliases.get(key).add(target); };
  // A "see X" reference is an alias only when both are spellings of one word (the same letters but for the matres ו/י
  // and a final א/ה): a "see" to a related entry is not a spelling (פירי "see" פרי is another word).
  const skeleton = k => k.replace(/(?<=.)[וי]/g, '').replace(/[אה]$/, '');
  const addSeeAlias = (key, target) => { if (key && target && skeleton(key) === skeleton(target)) addAlias(key, target); };
  const spellings = pointed => { const keys = new Set([keyOf(pointed)]); const p = pleneKey(pointed); if (p) keys.add(p); return [...keys].filter(Boolean); };

  // ---------- Krupnik & Silbermann ----------
  if (use(KRUPNIK)) for (const record of krupnik) {
    if (record.kind === 'hebrew-sense' || record.kind === 'unparsed') continue;
    if (record.name) { for (const h of record.heads) names.add(h.key); if (record.senses.every(s => s.glossReject === 'proper-name')) continue; }
    if (record.kind === 'abbreviation') {
      if (!record.abbreviation) { if (record.see) for (const h of record.heads) addSeeAlias(h.key, keyOf(record.see)); continue; }
      for (const h of record.heads) for (const expansion of record.abbreviation.expansions) {
        if (!abbreviations.has(h.key)) abbreviations.set(h.key, []);
        abbreviations.get(h.key).push({ expansion, sourceId: KRUPNIK, entryId: record.id, senses: record.abbreviation.expansions.length });
      }
      continue;
    }
    if (record.kind === 'phrase') {
      for (const h of record.heads) {
        const ws = h.pointed.split(/\s+/).map(w => keyOf(w)).filter(Boolean);
        if (ws.length < 2 || ws.length > 4) continue;
        for (const sense of record.senses) if (sense.gloss && !sense.form) phrases.push({ words: ws, gloss: sense.gloss, sourceId: KRUPNIK, entryId: record.id, n: sense.n, evidence: sense.evidence, senses: record.senses.length });
      }
      continue;
    }
    if (record.see) { for (const h of record.heads) addSeeAlias(h.key, keyOf(record.see)); continue; }
    const heads = record.kind === 'root' ? [] : record.heads.filter(h => words(h.pointed).length === 1);
    const rootKey = record.kind === 'root' ? keyOf(record.heads[0]?.pointed.replace(/[()]/g, '') || '') : heads[0]?.key;
    if (!rootKey) continue;
    for (const sense of record.senses) {
      const repaired = !sense.gloss && missingHebrew.get(`${record.id}#${sense.n}`);
      if (repaired) { sense.gloss = repaired; sense.repaired = true; }
      if (!sense.gloss) { if (heads[0] && sense.english) { const l = lemma(heads[0].key, sense.pos || record.pos); l.english = [...(l.english || []), `K: ${sense.english}`]; } continue; }
      const verbal = (sense.pos || record.pos) === 'v';
      const stem = STEM_OF_KRUPNIK[sense.stem] || (sense.form || record.kind === 'root' || !verbal ? '' : 'pe');
      const base = { gloss: sense.gloss, sourceId: KRUPNIK, entryId: record.id, n: sense.n, stem, kind: sense.repaired ? 'def-en' : 'def', evidence: sense.evidence, formKeys: sense.formKeys || null, pos: sense.pos || record.pos, english: sense.english };
      if (sense.form) {
        // A form the dictionary prints in bold (a stem): its sense belongs to that form; the lemma learns the stem.
        const l = lemma(rootKey, 'v');
        l.sources.add(KRUPNIK); l.entries.push(record.id);
        if (stem) l.stems.add(stem);
        l.senses.push({ ...base, formOnly: true });
        for (const pointed of sense.form) for (const k of spellings(pointed)) addForm(k, { lemma: rootKey, tag: `${stem || 'x'}.perf.3ms`, strength: 'source-form', sourceId: KRUPNIK, entryId: record.id, stem, senseN: sense.n });
        continue;
      }
      if (record.kind === 'root') continue;
      for (const h of heads) {
        const l = lemma(h.key, sense.pos || record.pos);
        l.sources.add(KRUPNIK); l.entries.push(record.id);
        if ((sense.pos || record.pos) === 'v') l.stems.add('pe');
        l.senses.push(base);
        for (const k of spellings(h.pointed)) if (k !== h.key) addAlias(k, h.key);
      }
    }
    for (const alt of record.altHeads || []) if (heads[0]) addAlias(alt.key, heads[0].key);
    for (const h of heads.slice(1)) if (heads[0] && h.key !== heads[0].key) addAlias(h.key, heads[0].key);
  }

  // ---------- Jastrow ----------
  if (use(JASTROW)) for (const record of jastrow) {
    if (!record.heads.length) continue;
    if (record.name) { for (const h of record.heads) if (!h.abbreviated) names.add(h.key); continue; }
    const main = record.heads.find(h => !h.abbreviated);
    if (!main) continue;
    if (record.see) { addSeeAlias(main.key, keyOf(record.see)); continue; }
    const l = lemma(main.key, record.pos);
    l.sources.add(JASTROW); l.entries.push(`J:${record.id}`);
    // A homograph that counts: an entry of its own (not Biblical Hebrew, not a bare cross-reference, with a definition).
    if (record.lang !== 'bh' && !record.see && record.english && !/^\*/.test(record.id)) l.jastrowHomographs = (l.jastrowHomographs || 0) + 1;
    if (record.english) l.english = [...(l.english || []), `J(${record.id}${record.lang ? ` ${record.lang}` : ''}): ${record.english.slice(0, 90)}`];
    l.jastrowLang = l.jastrowLang || record.lang;
    for (const h of record.heads) if (!h.abbreviated) for (const k of spellings(h.pointed)) if (k !== main.key) addAlias(k, main.key);
    const evidence = record.evidence;
    if (record.pos === 'v') l.stems.add('pe');
    if (record.sameAsHebrew && record.lang === 'ch') {
      const gloss = cleanHebrew(record.sameAsHebrew.pointed);
      if (gloss && !/\s/.test(gloss)) l.senses.push({ gloss, sourceId: JASTROW, entryId: record.id, n: 0, stem: record.pos === 'v' ? 'pe' : '', kind: 'same', evidence, formKeys: null, pos: record.pos });
      for (const s of record.sameAsHebrew.stems || []) { const f = s.forms[0]; if (f && !l.hebrewStems[s.stem]) l.hebrewStems[s.stem] = cleanHebrew(f.pointed); }
    }
    const targum = new Map();
    for (const eq of record.hebrewEq) {
      const gloss = cleanHebrew(eq.word);
      if (!gloss || gloss.split(/\s+/).length > 2) continue;
      if (eq.kind === 'targum-h') { if (!/^Jastrow/.test(eq.targumRef)) targum.set(gloss, (targum.get(gloss) || 0) + 1); continue; }
      l.senses.push({ gloss, sourceId: JASTROW, entryId: record.id, n: 0, stem: '', kind: 'eq', evidence, formKeys: null, pos: record.pos });
    }
    // A Targum equivalent "(h. X)" — the word of the Hebrew verse a Targum citation renders — is NOT a gloss (pass 2):
    // the independent accuracy sample of 2026-09-30 found 15 of 17 such glosses wrong (the verse word is often another
    // word of the verse, or a form of it: חבר → אחבירה, סלק → והס). The equivalents are parsed and counted, never shown.
    for (const stem of record.stems) {
      const s = STEM_OF_JASTROW[stem.stem];
      if (!s) continue;
      l.stems.add(s);
      for (const f of stem.forms) for (const k of spellings(f.pointed)) addForm(k, { lemma: main.key, tag: `${s}.perf.3ms`, strength: 'source-form', sourceId: JASTROW, entryId: record.id, stem: s });
      for (const eq of stem.hebrewEq || []) { const gloss = cleanHebrew(eq.word); if (gloss && !/\s/.test(gloss) && eq.kind !== 'targum-h') l.senses.push({ gloss, sourceId: JASTROW, entryId: record.id, n: 0, stem: s, kind: 'eq', evidence: stem.evidence, formKeys: null, pos: 'v' }); }
    }
    for (const f of record.forms) {
      const tag = { pl: record.pos === 'v' ? 'pe.ptcp.mp' : 'n.pl', part: 'pe.ptcp.ms', inf: 'pe.inf', contr: '', constr: 'n.sg', fem: 'n.sg', sing: 'n.sg', du: 'n.pl', pass: 'pe.pass.ms', imper: 'pe.impv.ms', fut: 'pe.impf.3ms', quote: '', link: '' }[f.via] ?? '';
      const strength = f.via === 'quote' || f.via === 'link' ? 'quote' : 'source-form';
      for (const k of spellings(f.pointed)) addForm(k, { lemma: main.key, tag, strength, sourceId: JASTROW, entryId: record.id });
    }
  }

  // ---------- Hebrew Wiktionary ----------
  if (use(WIKT)) {
    for (const item of wiktionary.aramaic) {
      // A page that also has Hebrew senses is a homograph page (אמר: "saying" and "lamb"): its Aramaic sense is not used.
      if (item.hebrewPage || !item.aramaicPage) continue;
      const l = lemma(item.key);
      l.sources.add(WIKT);
      l.senses.push({ gloss: item.gloss, sourceId: WIKT, entryId: `${item.pageTitle}@${item.revid}`, n: 0, stem: '', kind: 'wikt', evidence: {}, formKeys: null, pos: '', hebrewPage: item.hebrewPage });
      if (item.plene && item.plene !== item.key) addAlias(item.plene, item.key);
    }
    for (const item of wiktionary.abbreviations) {
      if (!abbreviations.has(item.key)) abbreviations.set(item.key, []);
      for (const expansion of item.expansions) abbreviations.get(item.key).push({ expansion, sourceId: WIKT, entryId: `${item.pageTitle}@${item.revid}`, senses: item.expansions.length });
    }
    for (const item of wiktionary.idioms) if (item.words.length >= 2 && item.words.length <= 4) phrases.push({ words: item.words, gloss: item.gloss, sourceId: WIKT, entryId: `${item.pageTitle}@${item.revid}`, n: 1, evidence: {}, senses: 1 });
  }
  // A lemma that is only a name is not a word.
  for (const key of names) { const l = lemmas.get(key); if (l && !l.senses.length) lemmas.delete(key); }
  return { lemmas, sourceForms, aliases, phrases, abbreviations, names };
}

export const SOURCE_IDS = Object.freeze({ KRUPNIK, JASTROW, WIKT });
export { normalizeLookupToken, isAbbreviationKey };
