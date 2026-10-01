// The Aramaic language engine of the word lookup: form resolution, morphology, dialect profiles, phrases, the reverse
// index, the corpus registry and the regression snapshot (docs/dictionary/regression-forms.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as data from '../src/data/dictionary/wordDictionary.mjs';
import { DICTIONARY_SOURCES, auditDictionarySources, releaseBlockers, versionClearanceProblems } from '../src/data/dictionary/sources.mjs';
import { gunzipSync } from 'node:zlib';
import { parseKrupnik } from '../scripts/dictionary/lexica/krupnik.mjs';
import { setWordDictionary, getShortGloss, resolveWordContext, resolveAramaicSurfaceForm, lookupHebrew } from '../src/services/wordLookup/engine.mjs';
import { renderGloss, conjugate } from '../src/services/wordLookup/aramaic/render.mjs';
import { strongQal } from '../src/services/wordLookup/aramaic/hebrewVerbs.mjs';
import { profileOf } from '../src/services/wordLookup/aramaic/profiles.mjs';
import { verbForms, rootOf } from '../scripts/dictionary/aramaic/verbs.mjs';
import { nounForms } from '../scripts/dictionary/aramaic/nominal.mjs';
import { procliticSplits, procliticFits } from '../scripts/dictionary/aramaic/analyze.mjs';
import { listPackWorks, ruleFor, CORPORA } from '../scripts/aramaic/corpora.mjs';

setWordDictionary(data);
const gloss = (word, family = 'talmud', workId = '') => getShortGloss(word, resolveWordContext({ family, workId }));
const inContext = (word, around, family) => getShortGloss(word, resolveWordContext({ family, around, aroundStart: around.indexOf(word) }));

test('inflected forms resolve to the meaning of their lemma, fitted to the form (verified data + reviewed grammar)', () => {
  assert.equal(gloss('איתמר'), 'נאמר');
  assert.equal(gloss('אִיתְּמַר'), 'נאמר');
  assert.equal(gloss('קאמר'), 'אומר');
  assert.equal(gloss('אמרינן'), 'אנו אומרים');
  assert.equal(gloss('דאמרינן'), 'שאנו אומרים');
  assert.equal(gloss('דקאמר'), 'שאומר');
  assert.equal(gloss('למימר'), 'לומר');
  assert.equal(gloss('לימא'), 'יאמר');
  assert.equal(gloss('כתיב'), 'כתוב');
  assert.equal(gloss('דכתיב'), 'שכתוב');
  assert.equal(gloss('הוה'), 'היה');
  assert.equal(gloss('ליהוי'), 'יהיה');
  assert.equal(gloss('מייתי'), 'מביא');
  assert.equal(gloss('ליה'), 'לו');
  assert.equal(gloss('הכא'), 'כאן');
  assert.equal(gloss('התם'), 'שם');
  assert.equal(gloss('אורייתא', 'zohar'), 'תורה'); // (in the Bavli, 14 uses: below the review gate)
});
test('phrases: the words around decide (tapping any word of the phrase), and a longer phrase wins', () => {
  assert.equal(inContext('חזי', 'רבי שמעון תא חזי כמה', 'zohar'), 'בוא וראה');
  assert.equal(inContext('תא', 'תא חזי כמה', 'zohar'), 'בוא וראה');
  assert.equal(inContext('טעמא', 'מאי טעמא לא', 'talmud'), 'מהו הטעם, למה');
  assert.equal(inContext('מילי', 'מנא הני מילי אמר', 'talmud'), 'מנין הדברים האלה');
  assert.equal(gloss('חזי', 'zohar'), 'ראה'); // alone: the word
});
test('dialect profiles: the corpus picks the sense and decides what is Hebrew there', () => {
  assert.equal(profileOf('talmud', 'Bavli_Berakhot'), 'J');
  assert.equal(profileOf('talmud', 'Jerusalem_Talmud_Berakhot'), 'Y');
  assert.equal(profileOf('kabbalah', 'Tikkunei_Zohar'), 'Z');
  assert.equal(profileOf('targum'), 'T');
  assert.equal(gloss('ארי', 'targum'), 'כי');
  assert.equal(gloss('קדם', 'targum'), 'לפני');
  assert.equal(gloss('אית', 'talmud', 'Jerusalem_Talmud_Berakhot'), 'יש');
  assert.equal(gloss('אנה', 'biblical-aramaic', 'Daniel'), 'אני');
  assert.equal(gloss('שמיה', 'liturgy'), 'שמו');
  // A word that is Hebrew where it is read is never glossed (so the reader's own tap goes on).
  assert.equal(gloss('אמר', 'talmud-commentary'), null);
  assert.equal(gloss('שלום', 'liturgy'), null);
  assert.equal(gloss('אמר', 'talmud'), 'אמר');
});
test('the result object carries the resolution path, the dialect and the sources', () => {
  const r = resolveAramaicSurfaceForm({ rawToken: 'קאמר', family: 'talmud' });
  assert.equal(r.normalized, 'קאמר');
  assert.equal(r.glossHe, 'אומר');
  assert.equal(r.dialect, 'JBA');
  assert.match(r.resolutionPath, /form:pe\.ptcp\.ms\+q/);
  assert.ok(r.sourceIds.length);
  assert.equal(resolveAramaicSurfaceForm({ rawToken: 'xyz', family: 'talmud' }), null);
});
test('the reverse index: Hebrew → the Aramaic forms whose verified gloss it is (many-to-many)', () => {
  assert.ok(lookupHebrew('כאן').some(x => x.aramaic === 'הכא'));
  assert.ok(lookupHebrew('תורה').some(x => x.aramaic === 'אורייתא'));
  assert.ok(lookupHebrew('יש').length >= 2);
  assert.deepEqual(lookupHebrew('ללא-כזה'), []);
});

// ---------- Reviewed grammar ----------
test('Hebrew rendering: proclitics, possessives, and the conjugation of the gloss verb', () => {
  assert.equal(renderGloss({ gloss: 'אמר', tag: 'pe.ptcp.ms', pos: 'v', proclitics: 'q' }), 'אומר');
  assert.equal(renderGloss({ gloss: 'אמר', tag: 'pe.ptcp.1pl', pos: 'v', proclitics: 'd' }), 'שאנו אומרים');
  assert.equal(renderGloss({ gloss: 'אמר', tag: 'itpe.perf.3ms', pos: 'v' }), 'נאמר');
  assert.equal(renderGloss({ gloss: 'כאן', pos: 'adv', proclitics: 'w' }), 'וכאן');
  assert.equal(renderGloss({ gloss: 'מלך', tag: 'n.sg', pos: 'n', proclitics: 'd' }), 'של מלך');
  assert.equal(renderGloss({ gloss: 'בן', tag: 'n.sg+3ms', pos: 'n' }), 'בן שלו');
  assert.equal(renderGloss({ gloss: 'אמר', tag: 'pe.ptcp.ms', pos: 'v', proclitics: 'kd' }), 'כמו שאומר');
  assert.equal(conjugate('כתב', 'pe.pass.ms'), 'כתוב');
  assert.equal(strongQal('כתב').f3ms, 'יכתוב');
  assert.equal(strongQal('שמע').f3ms, 'ישמע'); // a guttural takes the a-vowel
  assert.equal(strongQal('הלך'), null); // weak: never generated
});
test('Aramaic morphology: verb paradigms by root class, noun states, proclitic splits and their constraints', () => {
  assert.deepEqual(rootOf('אמר').cls, 'I-aleph');
  assert.deepEqual(rootOf('בעי').cls, 'III-weak');
  assert.deepEqual(rootOf('קומ').cls, 'hollow');
  const amar = verbForms('אמר', []);
  assert.ok(amar.get('איתמר').has('itpe.perf.3ms'));
  assert.ok(amar.get('אמריננ').has('pe.ptcp.1pl'));
  const ktv = verbForms('כתב', ['itpe']);
  assert.ok(ktv.get('כתיב').has('pe.pass.ms'));
  assert.ok(ktv.get('איכתיב') || ktv.get('איתכתיב'));
  assert.ok(nounForms('מלכא').get('מלכיה').has('n.sg+3ms'));
  assert.ok(procliticSplits('דקאמר').some(s => s.codes === 'dq' && s.rest === 'אמר'));
  assert.equal(procliticFits('q', 'n.sg', 'n'), false); // the progressive only before a participle
  assert.equal(procliticFits('b', 'pe.perf.3ms', 'v'), false);
  assert.equal(procliticFits('l', 'pe.inf', 'v'), true);
});

// ---------- Corpus registry and regression ----------
test('every text of the app belongs to an evaluated corpus; a new pack is flagged "NEW ARAMAIC CORPUS NOT EVALUATED"', () => {
  const unclaimed = listPackWorks().filter(w => !w.rule).map(w => `${w.pack}/${w.work}`);
  assert.deepEqual(unclaimed, [], `NEW ARAMAIC CORPUS NOT EVALUATED: ${unclaimed.join(', ')}`);
  assert.equal(ruleFor('some-new-pack-cc-by', 'Some_Work'), null);
  assert.ok(CORPORA.some(c => c.id === 'bavli') && CORPORA.some(c => c.id === 'zohar') && CORPORA.some(c => c.id === 'onkelos'));
});
test('regression: the most frequent Aramaic forms of every corpus keep their gloss (nothing covered is lost)', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../docs/dictionary/regression-forms.json', import.meta.url), 'utf8'));
  const lost = [];
  for (const [group, rows] of Object.entries(snapshot)) {
    for (const [form, count, where, was] of rows) {
      if (!was) continue;
      const [family, workId] = where.split('|');
      const now = getShortGloss(form, resolveWordContext({ family, workId }));
      if (now !== was) lost.push(`${group}: ${form} (${count}×) was "${was}", now "${now}"`);
    }
  }
  assert.deepEqual(lost.slice(0, 20), [], `${lost.length} frequent forms changed or lost their gloss (rebuild the audit if intended)`);
});

// ---------- Rights and size ----------
test('rights: no unknown or pending source is imported; the owner-decision notes are recorded', () => {
  for (const s of DICTIONARY_SOURCES.filter(x => x.imported)) {
    assert.ok(['public-domain', 'cc0', 'cc-by-4.0', 'cc-by-sa-4.0'].includes(s.licenceId), s.sourceId);
    assert.match(s.contentHash, /^sha256:[0-9a-f]{64}$/);
  }
  const krupnik = DICTIONARY_SOURCES.find(s => s.sourceId === 'krupnik-1927');
  assert.equal(krupnik.authorDeathYears['Baruch Krupnik (Karu)'], 1972);
  // Sefaria's written confirmation (Team Sefaria / Rachel Lieberman Buckman, 2026-10-01): Public Domain, this version only.
  assert.equal(krupnik.rightsStatus, 'CLEARED');
  assert.equal(krupnik.licenceId, 'public-domain');
  assert.equal(krupnik.releaseConfirmation.kind, 'sefaria-written-confirmation');
  assert.match(krupnik.releaseConfirmation.from, /Rachel Lieberman Buckman/);
  assert.match(krupnik.releaseConfirmation.inReplyTo, /1 October 2026/);
  assert.deepEqual(krupnik.rightsStatusHistory.map(h => h.status), ['DEVELOPMENT_ALLOWED_PENDING_RELEASE_RIGHTS_CONFIRMATION', 'CLEARED']);
  assert.deepEqual({ ...krupnik.clearedVersion }, { index: 'A Dictionary of the Talmud', versionTitle: 'A dictionary of the Talmud, London, 1927', language: 'he', authors: 'Baruch Krupnik / A. M. Silbermann', published: 'London, 1927', versionSource: 'https://www.nli.org.il/he/books/NNL_ALEPH990026160720205171/NLI', sourceInstitution: 'National Library of Israel (nli.org.il)', digitizer: 'Sefaria', digitizedBySefaria: true, license: 'Public Domain' });
  assert.deepEqual(auditDictionarySources(), []);
  assert.deepEqual(releaseBlockers(), []);
  // The release gate passes with the fetch record of the cleared version — and only with it.
  const meta = JSON.parse(readFileSync(new URL(`../${krupnik.fetchMetaFile}`, import.meta.url), 'utf8'));
  assert.deepEqual(auditDictionarySources(undefined, { release: true, fetchMetas: { 'krupnik-1927': meta } }), []);
  assert.match(auditDictionarySources(undefined, { release: true }).join('\n'), /krupnik-1927: cleared for one version only/);
  for (const [field, value] of [['versionTitle', 'A dictionary of the Talmud, Jerusalem, 1970'], ['versionSource', 'https://example.org/other-scan'], ['digitizedBySefaria', false], ['license', 'CC-BY'], ['index', 'Jastrow']]) {
    assert.match(versionClearanceProblems(krupnik, { ...meta, [field]: value }).join('\n'), new RegExp(`fetched version ${field}`), field);
  }
  assert.match(versionClearanceProblems(krupnik, { ...meta, sha256: '0'.repeat(64) }).join('\n'), /hash/);
  // Never extended: no other source inherits the clearance, and a Sefaria confirmation without a named version is refused.
  for (const s of DICTIONARY_SOURCES.filter(x => x.sourceId !== 'krupnik-1927')) assert.equal(s.clearedVersion, undefined, s.sourceId);
  const jastrow = DICTIONARY_SOURCES.find(s => s.sourceId === 'jastrow-1903');
  assert.match(auditDictionarySources([{ ...jastrow, releaseConfirmation: krupnik.releaseConfirmation }]).join('\n'), /version-specific/);
  // The pending path of the gate still works for any other source.
  const pending = DICTIONARY_SOURCES.map(s => (s.sourceId === 'jastrow-1903' ? { ...s, rightsStatus: 'DEVELOPMENT_ALLOWED_PENDING_RELEASE_RIGHTS_CONFIRMATION' } : s));
  assert.match(releaseBlockers(pending).join('\n'), /jastrow-1903: DEVELOPMENT_ALLOWED_PENDING_RELEASE_RIGHTS_CONFIRMATION/);
  assert.deepEqual(releaseBlockers(pending, { excluded: ['jastrow-1903'] }), []);
  assert.equal(DICTIONARY_SOURCES.find(s => s.sourceId === 'sefaria-word-form').imported, false);
  assert.equal(DICTIONARY_SOURCES.find(s => s.sourceId === 'morphhb').attributionRequired, true);
  const about = readFileSync(new URL('../src/pages/AboutPage.jsx', import.meta.url), 'utf8');
  assert.match(about, /Open Scriptures Hebrew Bible/);
  // The credit on the sources page, word for word.
  assert.ok(about.includes(krupnik.attribution.replace('&', '&amp;')), 'Krupnik credit on the About page');
});
test('provenance: every Krupnik-derived row is traceable to an original entry (adapted by rule, never rewritten)', () => {
  const krupnik = DICTIONARY_SOURCES.find(s => s.sourceId === 'krupnik-1927');
  assert.deepEqual(Object.keys(krupnik.dataLayers), ['original', 'normalised', 'adapted', 'appGenerated']);
  const records = parseKrupnik(gunzipSync(readFileSync(new URL(`../${krupnik.rawFile}.gz`, import.meta.url))).toString('utf8'));
  const derived = new Set();
  for (const r of records) { for (const s of r.senses) if (s.gloss) derived.add(s.gloss); for (const e of r.abbreviation?.expansions || []) derived.add(e); }
  const code = String(data.SOURCE_CODES.indexOf('krupnik-1927'));
  const traced = text => derived.has(text) || [...'בדולמכ'].some(p => text.startsWith(p) && derived.has(text.slice(1)));
  const rows = [
    ...data.SENSES.split('\n').map(l => l.split('\t')).filter(r => r[2] === code).map(r => r[0]),
    ...data.PHRASES.split('\n').map(l => l.split('\t')).filter(r => r[3] === code).map(r => r[1]),
    ...data.ABBREVIATIONS.split('\n').map(l => l.split('\t')).filter(r => r[3] === code).map(r => r[1]),
  ];
  assert.ok(rows.length > 1000, `${rows.length} Krupnik rows`);
  assert.deepEqual(rows.filter(text => !traced(text)), []);
});
test('offline and small: the data is one local module under 1 MB; a lookup takes well under a millisecond', () => {
  const size = readFileSync(new URL('../src/data/dictionary/wordDictionary.mjs', import.meta.url)).length;
  assert.ok(size < 1_000_000, `${size} bytes`);
  const words = ['קאמר', 'דאמרינן', 'הכא', 'עלמא', 'ליה', 'שלום', 'xyz', 'איתמר', 'מייתי', 'בעי'];
  const context = resolveWordContext({ family: 'talmud' });
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 20000; i += 1) getShortGloss(words[i % words.length], context);
  const perLookupMs = Number(process.hrtime.bigint() - t0) / 1e6 / 20000;
  assert.ok(perLookupMs < 0.5, `${perLookupMs} ms per lookup`);
});

// ---------- Pass 2: precision ----------
test('the vowel signs decide what the letters leave open (Targum, Daniel, the siddur)', () => {
  assert.equal(gloss('לֵהּ', 'targum'), 'לו'); // tsere + mappiq: "to him"
  assert.equal(gloss('לַהּ', 'targum'), 'לה'); // patah + mappiq: "to her"
  assert.equal(gloss('בֵּהּ', 'biblical-aramaic', 'Daniel'), 'בו');
  assert.equal(gloss('עִמַּהּ', 'targum'), null); // feminine by its vowels: never "his"
  assert.equal(gloss('עִמֵּהּ', 'targum'), 'עמו');
  assert.equal(gloss('אָנָּא', 'liturgy'), null); // the Hebrew "please" (אנא ה׳ הושיעה נא)
  assert.equal(gloss('אֲנָא', 'liturgy'), 'אני');
  assert.equal(gloss('הֲוָא', 'biblical-aramaic', 'Daniel'), 'היה'); // "was", not the pronoun
});
test('Hebrew contexts and the exclusions of the independent samples give nothing', () => {
  assert.equal(inContext('אי', 'בזמן שאי אתה משמט קרקע אי אתה משמט', 'talmud'), null); // the Hebrew negative
  assert.equal(gloss('אי'), 'אם');
  for (const w of ['זיל', 'טובא', 'דלעילא', 'אתכליל']) assert.equal(gloss(w, w === 'דלעילא' || w === 'אתכליל' ? 'zohar' : 'talmud'), null, w);
  assert.equal(gloss('לעמא', 'targum'), 'לעם'); // the article drops after ל
});
test('morphology fixes: the assimilated reflexive has no imperfect of its own; נ־ is also "we"', () => {
  assert.deepEqual([...verbForms('עבד', ['itpe']).get('ליעבד')], ['pe.impf.3ms']);
  assert.deepEqual([...verbForms('כתב', []).get('נכתב')].sort(), ['pe.impf.1pl', 'pe.impf.3ms']);
  assert.equal(gloss('קתני'), 'שונה'); // קא licenses the participle
});
test('the review gate: an unreviewed analysis of a rare form is a candidate, not a gloss', async () => {
  const { REVIEW_GATE_MIN, REVIEW_GATE_PARADIGM } = { REVIEW_GATE_MIN: 200, REVIEW_GATE_PARADIGM: 20 };
  const src = readFileSync(new URL('../scripts/dictionary/build-aramaic-engine.mjs', import.meta.url), 'utf8');
  assert.match(src, new RegExp(`REVIEW_GATE_MIN = ${REVIEW_GATE_MIN};`));
  assert.match(src, new RegExp(`REVIEW_GATE_PARADIGM = ${REVIEW_GATE_PARADIGM};`));
  assert.equal(gloss('אורייתא'), null); // 14 uses in the Bavli: below the gate there
  assert.equal(gloss('אורייתא', 'zohar'), 'תורה');
  // Jastrow's Targum-verse equivalents are never glosses.
  assert.ok(!data.SENSES.split('\n').some(line => /^(יהב|אחבירה|והס)\t/.test(line)));
});
