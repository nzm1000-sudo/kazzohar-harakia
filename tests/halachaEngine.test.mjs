import test from 'node:test';
import assert from 'node:assert/strict';
import { HALACHA_ENGINE_ENTRIES } from '../src/data/halachaEngineEntries.mjs';
import { PRACTICAL_HALACHA_QA, publishedPracticalQuestions } from '../src/data/practicalHalachaQa.mjs';
import { HALACHA_TOPICS } from '../src/data/halachaLibrary.mjs';
import { YALKUT_YOSEF } from '../src/data/yalkutYosef.mjs';
import { hebrewNumeral } from '../src/services/hebrewNumerals.mjs';
import { activeContexts, halachotForNow, relatedHalachot, recordHalachaOpened, readRecentHalachot } from '../src/services/halachaEngine.mjs';
import { groundedAnswer, validateModelAnswer, retrieve, ANSWER_STATUS } from '../src/services/halachaAgent.mjs';
import { normalizeQuery } from '../src/services/halachaSearch.mjs';

const sections = new Map(YALKUT_YOSEF.sections.map(section => [section.id, section]));
const norm = s => String(s || '').replace(/[֑-ׇ]/g, '').replace(/[״“”„]/g, '"').replace(/''/g, '"').replace(/[׳‘’`]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const CONTEXTS = new Set('daily weekday-morning friday shabbat motzei-shabbat erev-rosh-chodesh rosh-chodesh kiddush-levana pesach-prep pesach chol-hamoed omer lag-baomer shavuot three-weeks nine-days tisha-bav fast-day elul rosh-hashana aseret-yemei-teshuva yom-kippur pre-sukkot sukkot hoshana-raba simchat-torah chanukah tu-bishvat adar purim yom-tov meal travel home life-cycle'.split(' '));

test('quality gate: every engine entry quotes its section verbatim and carries the computed citation', () => {
  const ids = new Set();
  for (const entry of HALACHA_ENGINE_ENTRIES) {
    assert.ok(!ids.has(entry.id), `${entry.id} duplicated`); ids.add(entry.id);
    const section = sections.get(entry.source.localSourceId);
    assert.ok(section, `${entry.id}: section ${entry.source.localSourceId} missing`);
    assert.ok(norm(section.text).includes(norm(entry.source.excerpt)), `${entry.id}: excerpt is not verbatim`);
    assert.equal(entry.source.citation, `${section.section.split(/\s*-\s*/)[0].trim()}, סעיף ${hebrewNumeral(section.halachaIndex)}`, `${entry.id}: citation not computed from the section`);
    assert.ok(entry.shortAnswer.length > 0 && entry.shortAnswer.length <= 240, `${entry.id}: answer length`);
    assert.ok(['din', 'minhag', 'chumra', 'machloket'].includes(entry.ruleType), `${entry.id}: ruleType`);
    assert.ok(entry.contexts.length && entry.contexts.every(key => CONTEXTS.has(key)), `${entry.id}: contexts`);
    assert.ok(HALACHA_TOPICS.some(topic => topic.id === entry.category && topic.children.includes(entry.topic)), `${entry.id}: not reachable by topic`);
    for (const url of entry.askedOn || []) assert.match(url, /^https:\/\//);
  }
});

test('engine entries join the published layer without duplicate canonical questions', () => {
  const published = publishedPracticalQuestions();
  assert.equal(published.length, PRACTICAL_HALACHA_QA.length);
  const canonical = published.map(item => normalizeQuery(item.question));
  assert.equal(new Set(canonical).size, canonical.length);
  for (const entry of HALACHA_ENGINE_ENTRIES) assert.ok(published.some(item => item.id === entry.id && item.engine && item.sources[0].excerpt));
});

test('active contexts are derived from the day context, not guessed', () => {
  const yomKippur = activeContexts({ hebrewDate: { day: 10, month: 7, year: 5787 }, weekday: 1, isYomTov: true });
  assert.ok(yomKippur.has('yom-kippur') && yomKippur.has('aseret-yemei-teshuva') && !yomKippur.has('weekday-morning'));
  const cholHamoed = activeContexts({ hebrewDate: { day: 18, month: 7, year: 5787 }, weekday: 3, isCholHaMoed: true });
  assert.ok(cholHamoed.has('sukkot') && cholHamoed.has('chol-hamoed') && !cholHamoed.has('pesach'));
  const erevPesach = activeContexts({ hebrewDate: { day: 14, month: 1, year: 5787 }, weekday: 4 });
  assert.ok(erevPesach.has('pesach-prep') && erevPesach.has('friday') && !erevPesach.has('omer'));
  const omer = activeContexts({ hebrewDate: { day: 18, month: 2, year: 5787 }, weekday: 2 });
  assert.ok(omer.has('omer') && omer.has('lag-baomer'));
  const motzeiShabbat = activeContexts({ hebrewDate: { day: 3, month: 8, year: 5787 }, weekday: 0, afterSunset: true });
  assert.ok(motzeiShabbat.has('motzei-shabbat') && !motzeiShabbat.has('weekday-morning'));
  // Leap year: Purim is in Adar II; Adar I carries neither 'adar' nor 'purim'.
  const adarI = activeContexts({ hebrewDate: { day: 14, month: 12, year: 5787 }, weekday: 2 });
  assert.ok(!adarI.has('purim') && !adarI.has('adar'));
  const adarII = activeContexts({ hebrewDate: { day: 14, month: 13, year: 5787 }, weekday: 2 });
  assert.ok(adarII.has('purim') && adarII.has('adar'));
  const ordinaryAdar = activeContexts({ hebrewDate: { day: 14, month: 12, year: 5786 }, weekday: 2 });
  assert.ok(ordinaryAdar.has('purim'));
});

const fake = (id, contexts, extra = {}) => ({ id, question: id, shortAnswer: id, contexts, topic: 't', tags: [], searchKeywords: [], sources: [{ localSourceId: `yalkut-yosef-1-1-${id.length}` }], ...extra });

test('relevant now prefers the most specific match and labels only a real match', () => {
  const pool = [fake('everyday', ['daily']), fake('shabbat-prep', ['friday']), fake('sukkah', ['sukkot', 'chol-hamoed']), fake('pesach', ['pesach'])];
  const sukkot = halachotForNow({ key: '2026-09-29', hebrewDate: { day: 18, month: 7, year: 5787 }, weekday: 2, isCholHaMoed: true }, { pool, now: new Date('2026-09-29T09:00:00') });
  assert.equal(sukkot.now.entry.id, 'sukkah');
  assert.ok(sukkot.now.reason);
  assert.ok(!sukkot.today.some(item => item.entry.id === 'pesach'));
  const plain = halachotForNow({ key: '2026-11-03', hebrewDate: { day: 22, month: 8, year: 5787 }, weekday: 2 }, { pool, now: new Date('2026-11-03T09:00:00') });
  assert.equal(plain.now.entry.id, 'everyday');
  assert.equal(plain.now.reason, null, 'an everyday pick must not carry a seasonal label');
});

test('a Chol HaMoed entry bound to Pesach never shows during Sukkot', () => {
  const pool = [fake('pesach-hallel', ['pesach', 'chol-hamoed']), fake('generic-chm', ['chol-hamoed']), fake('everyday', ['daily'])];
  const sukkot = halachotForNow({ key: '2026-09-28', hebrewDate: { day: 17, month: 7, year: 5787 }, weekday: 1, isCholHaMoed: true }, { pool, now: new Date('2026-09-28T09:00:00') });
  assert.ok(![sukkot.now, ...sukkot.today].some(item => item?.entry.id === 'pesach-hallel'));
  assert.equal(sukkot.now.entry.id, 'generic-chm');
});

test('relevant now is stable within a day and moves between days', () => {
  const pool = Array.from({ length: 12 }, (_, index) => fake(`f${index}`, ['friday']));
  const day = key => halachotForNow({ key, hebrewDate: { day: 5, month: 8, year: 5787 }, weekday: 5 }, { pool, now: new Date('2026-10-30T09:00:00') }).now.entry.id;
  assert.equal(day('2026-10-30'), day('2026-10-30'));
  assert.ok(new Set(['2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20'].map(day)).size > 1);
});

test('related halachot come from the same siman and topic', () => {
  const a = fake('a', ['daily'], { sources: [{ localSourceId: 'yalkut-yosef-16-1-5' }], topic: 'ברכות' });
  const b = fake('b', ['daily'], { sources: [{ localSourceId: 'yalkut-yosef-16-1-7' }], topic: 'ברכות' });
  const c = fake('c', ['daily'], { sources: [{ localSourceId: 'yalkut-yosef-23-4-1' }], topic: 'שבת' });
  assert.deepEqual(relatedHalachot(a, { pool: [a, b, c] }).map(item => item.id), ['b']);
});

test('continue reading keeps the latest first, without repeats', () => {
  const map = new Map();
  const storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  recordHalachaOpened('x', storage); recordHalachaOpened('y', storage); recordHalachaOpened('x', storage);
  assert.deepEqual(readRecentHalachot(storage), ['x', 'y']);
});

test('agent: a known question returns the verified entry with its citation; nonsense is insufficient', () => {
  const known = groundedAnswer('מה מברכים על בננה');
  assert.equal(known.status, ANSWER_STATUS.VERIFIED);
  assert.ok(known.citations.length && known.citations[0].sourceId);
  const nothing = groundedAnswer('קקקק זזזז');
  assert.equal(nothing.status, ANSWER_STATUS.INSUFFICIENT);
  assert.equal(nothing.answer, null);
});

test('agent: a model answer must cite retrieved sources with verbatim quotes', () => {
  const retrieved = retrieve('מה מברכים על בננה');
  const sourceId = retrieved.entries[0].entry.sources[0].localSourceId;
  const text = sections.get(sourceId).text;
  const quote = text.slice(2, 40);
  assert.equal(validateModelAnswer({ claims: [{ text: 'x', sourceId, quote }] }, retrieved).ok, true);
  assert.equal(validateModelAnswer({ claims: [{ text: 'x', sourceId, quote: 'משפט שלא מופיע במקור כלל' }] }, retrieved).ok, false);
  assert.equal(validateModelAnswer({ claims: [{ text: 'x' }] }, retrieved).ok, false);
  assert.equal(validateModelAnswer({ claims: [{ text: 'x', sourceId: 'yalkut-yosef-99-1-1', quote }] }, retrieved).ok, false);
  assert.equal(validateModelAnswer({ claims: [{ text: 'x', sourceId, quote }] }, { entries: [], sections: [] }).ok, false);
  assert.equal(validateModelAnswer({ status: ANSWER_STATUS.INSUFFICIENT, claims: [] }, { entries: [], sections: [] }).ok, true);
  assert.equal(validateModelAnswer({ text: 'במקרה שלך מותר', claims: [{ text: 'x', sourceId, quote }] }, retrieved).ok, false);
});
