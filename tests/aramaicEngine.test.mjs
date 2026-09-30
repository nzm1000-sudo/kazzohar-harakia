// The Aramaic language engine of the word lookup: form resolution, morphology, dialect profiles, phrases, the reverse
// index, the corpus registry and the regression snapshot (docs/dictionary/regression-forms.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as data from '../src/data/dictionary/wordDictionary.mjs';
import { DICTIONARY_SOURCES } from '../src/data/dictionary/sources.mjs';
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
  assert.equal(gloss('אורייתא'), 'תורה');
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
  assert.match(krupnik.rightsRisk, /OWNER DECISION REQUIRED/);
  assert.equal(DICTIONARY_SOURCES.find(s => s.sourceId === 'sefaria-word-form').imported, false);
  assert.equal(DICTIONARY_SOURCES.find(s => s.sourceId === 'morphhb').attributionRequired, true);
  assert.match(readFileSync(new URL('../src/pages/AboutPage.jsx', import.meta.url), 'utf8'), /Open Scriptures Hebrew Bible/);
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
