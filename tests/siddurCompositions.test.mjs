// The composed Siddur of every rite (data/nusach/compositions): content and sequence, not only files. Each service
// must resolve against its own edition, keep the schema's spine order, show today's prayer only in prayer mode, and
// keep every alternative (labelled) in the full edition. Levels come from services/prayer/siddurQa.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HDate } from '@hebcal/core';
import { COMPOSITIONS } from '../src/data/nusach/compositions/index.mjs';
import { SERVICES, SERVICE_INDEX, CONCEPTS, COMPLETENESS } from '../src/data/nusach/prayerSchema.mjs';
import { NUSACH_INDEX } from '../src/data/nusach/registry.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { composeRiteService, resolveService, whenHolds, compositionConditions, riteServiceReference, parseRiteServiceReference } from '../src/services/prayer/riteServiceComposer.mjs';
import { checkRite, checkService } from '../src/services/prayer/siddurQa.mjs';
import { normalizeSiddurBlocks } from '../src/services/siddurBlocks.mjs';
import { normalizeHebrewText, removeNikud } from '../src/hebrewText.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import siddurOffline from '../src/data/siddurOffline.mjs';

const JERUSALEM = { location: { latitude: 31.778, longitude: 35.235, tzid: 'Asia/Jerusalem', name: 'ירושלים' }, halachicResidenceStatus: 'israel', il: true };
const civil = hdate => { const d = hdate.greg(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const at = (key, prayerType = 'mincha') => JewishContextEngine({ now: new Date(`${key}T11:00:00Z`), settings: JERUSALEM, times: {}, prayerType });
const ORDINARY = civil(new HDate(22, 'Cheshvan', 5787)); // a Tuesday with Tachanun
const ROSH_CHODESH = civil(new HDate(1, 'Kislev', 5787));
const FAST = civil(new HDate(10, 'Tevet', 5787));
const CHANUKAH = civil(new HDate(27, 'Kislev', 5787));
const plainOf = doc => removeNikud(doc.sections.flatMap(section => section.blocks.map(block => block.text)).join(' '));
const ids = doc => doc.sections.map(section => section.id);

const packs = {};
for (const id of Object.keys(COMPOSITIONS)) packs[id] = await loadSiddur(id);

test('the schema: every service has a title, a spine inside its required concepts, and only known concepts', () => {
  for (const service of SERVICES) {
    assert.ok(service.title && /[א-ת]/.test(service.title), service.id);
    for (const concept of service.required) assert.ok(CONCEPTS[concept], `${service.id}: ${concept}`);
    for (const concept of service.spine) assert.ok(service.required.includes(concept));
  }
});

test('every composed section of every rite resolves in its own edition — no anchor missing, no other rite\'s text', () => {
  for (const [nusach, composition] of Object.entries(COMPOSITIONS)) {
    const index = NUSACH_INDEX[nusach].index;
    for (const [serviceId, service] of Object.entries(composition.services)) {
      assert.ok(SERVICE_INDEX[serviceId], `${nusach}: unknown service ${serviceId}`);
      for (const section of resolveService(service, packs[nusach].texts)) {
        assert.equal(section.error, undefined, `${nusach}/${serviceId}/${section.id}: ${section.error}`);
        assert.ok(section.ref.startsWith(`${index}, `) || (composition.extraIndexes || []).some(extra => section.ref.startsWith(`${extra}, `)), `${nusach}/${serviceId}/${section.id} reads ${section.ref}`);
        if (!section.omit) assert.ok(section.title !== undefined && (section.title === '' ? section.continues : /[א-ת]/.test(section.title)), `${nusach}/${serviceId}/${section.id}: a reviewed Hebrew title`);
        if (section.omit) assert.ok(section.why, `${nusach}/${serviceId}/${section.id}: an omission states its reason`);
      }
    }
  }
});

test('a service marked reviewed passes every QA check; nothing unreviewed is ever VERIFIED COMPLETE', () => {
  for (const [nusach, composition] of Object.entries(COMPOSITIONS)) {
    for (const result of checkRite(composition, packs[nusach].texts)) {
      const service = composition.services[result.serviceId];
      if (!service) { assert.notEqual(result.level, COMPLETENESS.VERIFIED); continue; }
      if (service.reviewed) assert.deepEqual(result.problems, [], `${nusach}/${result.serviceId}`);
      else assert.notEqual(result.level, COMPLETENESS.VERIFIED, `${nusach}/${result.serviceId} is not reviewed`);
      for (const concept of result.absent) assert.ok((service.missing || []).some(item => item.concept === concept) || result.level !== COMPLETENESS.VERIFIED, `${nusach}/${result.serviceId}: ${concept} absent`);
    }
  }
});

test('the QA refuses a false COMPLETE: a missing required concept, a wrong order, an unread paragraph', () => {
  const texts = packs.ashkenaz.texts;
  const mincha = COMPOSITIONS.ashkenaz.services['weekday-mincha'];
  const withoutAleinu = { ...mincha, reviewed: true, sections: mincha.sections.filter(section => section.concept !== 'aleinu') };
  const a = checkService('weekday-mincha', withoutAleinu, texts);
  assert.ok(a.absent.includes('aleinu'));
  assert.notEqual(a.level, COMPLETENESS.VERIFIED);
  assert.ok(a.problems.some(problem => /not covered/.test(problem)) || a.absent.length, 'Aleinu\'s leaf is unread or absent');
  const aleinu = mincha.sections.find(section => section.concept === 'aleinu');
  const reordered = { ...mincha, reviewed: true, sections: [aleinu, ...mincha.sections.filter(section => section !== aleinu)] };
  assert.ok(checkService('weekday-mincha', reordered, texts).problems.some(problem => /out of order/.test(problem)));
});

test('conditions: Tachanun, fast, Rosh Chodesh, Chanukah read from the day', () => {
  const ordinary = compositionConditions(at(ORDINARY));
  assert.equal(ordinary.tachanun, true); assert.equal(ordinary.fast, false); assert.equal(ordinary.roshChodesh, false);
  assert.equal(compositionConditions(at(FAST)).fast, true);
  assert.equal(compositionConditions(at(ROSH_CHODESH)).roshChodesh, true);
  assert.equal(compositionConditions(at(CHANUKAH)).chanukah, true);
  assert.equal(whenHolds('roshChodesh|cholHamoed', { roshChodesh: true }), true);
  assert.equal(whenHolds('!tachanun', { tachanun: true }), false);
  assert.equal(whenHolds('mondayThursday&tachanun', { mondayThursday: true, tachanun: false }), false);
  assert.deepEqual(parseRiteServiceReference(riteServiceReference('ashkenaz', 'weekday-mincha')), { nusach: 'ashkenaz', serviceId: 'weekday-mincha' });
});

test('Ashkenaz Mincha, prayer mode: only today\'s prayer, in order, with named blessings', () => {
  const compose = key => composeRiteService({ composition: COMPOSITIONS.ashkenaz, serviceId: 'weekday-mincha', texts: packs.ashkenaz.texts, context: at(key), mode: 'prayer' });
  const ordinary = compose(ORDINARY);
  assert.ok(ordinary.decided);
  const order = ids(ordinary);
  for (const [before, after] of [['ashrei', 'half-kaddish'], ['half-kaddish', 'avot'], ['avot', 'gevurot'], ['elokai-netzor', 'nefilat-apayim'], ['nefilat-apayim', 'kaddish-titkabal'], ['kaddish-titkabal', 'aleinu']]) assert.ok(order.indexOf(before) < order.indexOf(after), `${before} before ${after}`);
  for (const absent of ['avinu-malkeinu', 'aneinu', 'yaale-veyavo', 'al-hanisim', 'birkat-kohanim', 'sim-shalom', 'nachem']) assert.ok(!order.includes(absent), `${absent} is not said today`);
  assert.ok(order.includes('shalom-rav'));
  assert.equal(ordinary.sections.find(section => section.id === 'kedusha').collapsed, true, 'the repetition\'s Kedusha is folded');
  assert.equal(ordinary.sections.find(section => section.id === 'modim-derabanan').roleLabel, 'בחזרת שליח הציבור');
  const text = plainOf(ordinary);
  assert.doesNotMatch(text, /יעלה ויבא|עננו יהוה עננו|על הנסים ועל הפרקן|אבינו מלכנו חטאנו/);
  // 22 Cheshvan in Eretz Yisrael: after 7 Cheshvan — the winter words, read on in their sentence.
  assert.match(text, /ותן טל ומטר לברכה על פני האדמה/, 'the season\'s words read on in their sentence');
  assert.doesNotMatch(text, /\(\s*\)/, 'no empty brackets left by a resolved condition');

  const fast = ids(compose(FAST));
  for (const present of ['aneinu', 'avinu-malkeinu', 'birkat-kohanim', 'sim-shalom']) assert.ok(fast.includes(present), `fast day: ${present}`);
  assert.ok(!fast.includes('shalom-rav'));
  const roshChodesh = compose(ROSH_CHODESH);
  assert.ok(ids(roshChodesh).includes('yaale-veyavo'));
  assert.ok(!ids(roshChodesh).includes('nefilat-apayim'), 'no Tachanun on Rosh Chodesh');
  assert.ok(ids(compose(CHANUKAH)).includes('al-hanisim'));
});

test('the full edition keeps every alternative, each labelled with when it is said', () => {
  const doc = composeRiteService({ composition: COMPOSITIONS.ashkenaz, serviceId: 'weekday-mincha', texts: packs.ashkenaz.texts, context: at(ORDINARY), mode: 'edition' });
  assert.equal(doc.decided, false);
  for (const id of ['avinu-malkeinu', 'aneinu', 'yaale-veyavo', 'al-hanisim', 'sim-shalom', 'shalom-rav', 'nefilat-apayim']) assert.ok(ids(doc).includes(id), id);
  assert.equal(doc.sections.find(section => section.id === 'yaale-veyavo').whenLabel, 'בראש חודש ובחול המועד');
  assert.equal(doc.sections.find(section => section.id === 'kedusha').collapsed, false, 'nothing folded in the full edition');
});

test('text layer: a line break never glues words; the paseq leaves the Siddur; a long halachic note is a note, not prayer', () => {
  const chida = siddurOffline.texts['Siddur Edot HaMizrach, Weekday Mincha, Amida'].he;
  const index = chida.findIndex(value => /בסידורו/.test(value));
  const blocks = normalizeSiddurBlocks([{ text: normalizeHebrewText(chida[index]), source: index }], { markup: [chida[index]] });
  const plain = removeNikud(blocks.map(block => block.text).join(' | '));
  assert.doesNotMatch(plain, /בסידורו\S/, 'no "בסידורויהי"');
  const instruction = blocks.find(block => /בסידורו/.test(removeNikud(block.text)));
  assert.notEqual(instruction.display, 'prayer', 'the Chida\'s note is not prayer');
  assert.ok(blocks.some(block => /^יהי רצון/.test(removeNikud(block.text)) && block.display === 'prayer'), 'the optional prayer after it stays prayer, on its own line');
  assert.doesNotMatch(blocks.map(block => block.text).join(' '), /׀/, 'no paseq');

  for (const [pack, ref] of [[packs.ashkenaz, 'Siddur Ashkenaz, Weekday, Minchah, Amida, Prosperity']]) {
    const he = pack.texts[ref].he;
    const noteBlocks = normalizeSiddurBlocks(he.map((text, source) => ({ text: normalizeHebrewText(text), source })), { markup: he });
    const note = noteBlocks.find(block => /אם שכח לומר/.test(removeNikud(block.text)));
    assert.equal(note.display, 'commentary', 'the note keeps its quoted pointed words inside it');
    assert.ok(!noteBlocks.some(block => block.display === 'prayer' && /^תקע יאמרנה/.test(removeNikud(block.text))), 'no fragment of the note becomes prayer');
  }
});

test('the reader: prayer mode by default, the full edition one tap away, notes out of the prayer, the repetition folded', () => {
  const reader = readFileSync(new URL('../src/components/RiteServiceReader.jsx', import.meta.url), 'utf8');
  assert.match(reader, /useLocal\('siddur-reading-mode', 'prayer'\)/);
  assert.match(reader, /תפילת היום/); assert.match(reader, /המהדורה המלאה/);
  assert.match(reader, /block\.display !== 'commentary'/);
  assert.match(reader, /section\.collapsed/);
  assert.match(reader, /RITE_SERVICE_COMPLETION/);
  const source = readFileSync(new URL('../src/components/SourceReader.jsx', import.meta.url), 'utf8');
  assert.match(source, /isRiteServiceReference\(props\.reference\)/);
  assert.match(source, /ReaderErrorBoundary fallback=\{printed\}><RiteServiceReader/);
});
