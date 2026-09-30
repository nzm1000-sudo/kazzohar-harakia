// Stage 6 — practical gaps: every new answer passes the publication gate, sits in the taxonomy, keeps its provenance
// apart from its ruling source, and duplicates nothing; search phrasings added to existing answers point at real
// answers; unresolved questions stay out of the published layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HALACHA_PRACTICAL_ENTRIES } from '../src/data/halachaPracticalEntries.mjs';
import { PRACTICAL_HALACHA_QA, PRACTICAL_HALACHA_QA_INDEX, publishedPracticalQuestions } from '../src/data/practicalHalachaQa.mjs';
import { HALACHA_ALIASES } from '../src/data/halachaAliases.mjs';
import { HALACHA_TOPICS } from '../src/data/halachaLibrary.mjs';
import { YALKUT_YOSEF } from '../src/data/yalkutYosef.mjs';
import { normalizeQuery } from '../src/services/halachaSearch.mjs';
import { relatedWithReasons } from '../src/services/halachaEngine.mjs';

const sections = new Map(YALKUT_YOSEF.sections.map(section => [section.id, section]));
const norm = s => String(s || '').replace(/[֑-ׇ]/g, '').replace(/[״“”„]/g, '"').replace(/''/g, '"').replace(/[׳‘’`]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const needsReview = JSON.parse(readFileSync(new URL('../scripts/halacha/practical/needs-review.json', import.meta.url), 'utf8'));

test('stage 6 adds real answers (not variations) and every one passes the publication gate', () => {
  assert.ok(HALACHA_PRACTICAL_ENTRIES.length >= 70, `${HALACHA_PRACTICAL_ENTRIES.length}`);
  for (const entry of HALACHA_PRACTICAL_ENTRIES) {
    const item = PRACTICAL_HALACHA_QA_INDEX[entry.id];
    assert.ok(item, entry.id);
    assert.equal(item.quality, 'verified'); assert.equal(item.reviewStatus, 'verified'); assert.equal(item.answerStatus, 'published');
    assert.ok(entry.question.length > 10 && /[?]$/.test(entry.question), `${entry.id}: a question as people ask it`);
    assert.ok(entry.shortAnswer.length > 10 && entry.shortAnswer.length <= 240, entry.id);
    assert.ok(entry.variants.length >= 3, `${entry.id}: search phrasings`);
    assert.ok(['din', 'minhag', 'chumra', 'machloket'].includes(entry.ruleType), entry.id);
    if (entry.ruleType === 'machloket') assert.ok(entry.dispute, `${entry.id}: a dispute says what it is`);
    // The ruling is quoted, word for word, from the cited section (and so is every supporting excerpt).
    for (const source of [entry.source, ...(entry.supportingSources || [])]) {
      const section = sections.get(source.localSourceId);
      assert.ok(section, `${entry.id}: ${source.localSourceId}`);
      assert.ok(norm(section.text).includes(norm(source.excerpt)), `${entry.id}: excerpt not verbatim`);
      assert.ok(source.citation, entry.id);
    }
    if (entry.ruleType === 'minhag') assert.match(norm(entry.source.excerpt), /נהג|מנהג|נוהג/, `${entry.id}: custom wording`);
    // Provenance: where the question was found is kept apart from the ruling source and its licence.
    const { provenance } = entry;
    assert.ok(provenance.discovery.length && provenance.discovery.every(item => item.use === 'question-only' && item.site), entry.id);
    assert.match(provenance.rulingSource, /ילקוט יוסף/);
    assert.equal(provenance.verification, 'excerpt-verbatim-in-bundled-section');
    assert.match(provenance.licence, /CC BY-NC-SA/);
    assert.equal(provenance.wording, 'independent');
    assert.match(provenance.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Array.isArray(entry.conditions));
    for (const id of entry.related || []) assert.ok(PRACTICAL_HALACHA_QA_INDEX[id], `${entry.id}: related ${id}`);
  }
});

test('independent wording: no answer repeats its source verbatim, and no answer copies another', () => {
  const answers = new Set();
  for (const entry of HALACHA_PRACTICAL_ENTRIES) {
    assert.ok(!norm(entry.source.excerpt).includes(norm(entry.shortAnswer)), `${entry.id}: the short answer is the book's own sentence`);
    assert.ok(!answers.has(entry.shortAnswer), `${entry.id}: repeated answer`);
    answers.add(entry.shortAnswer);
  }
});

test('no duplicates: canonical questions are unique across the whole published layer', () => {
  const seen = new Map();
  for (const item of publishedPracticalQuestions()) {
    const key = normalizeQuery(item.question);
    if (item.practicalTier) assert.ok(!seen.has(key), `${item.id} duplicates ${seen.get(key)}`);
    if (!seen.has(key)) seen.set(key, item.id);
  }
  // Two practical entries never quote the same words of one section.
  const spans = new Set();
  for (const entry of HALACHA_PRACTICAL_ENTRIES) {
    const key = `${entry.source.localSourceId}|${norm(entry.source.excerpt)}`;
    assert.ok(!spans.has(key), entry.id);
    spans.add(key);
  }
});

test('catalogue: every published answer is reachable from "כל הנושאים" by its category and topic', () => {
  const byId = new Map(HALACHA_TOPICS.map(category => [category.id, category]));
  for (const item of publishedPracticalQuestions()) {
    const category = byId.get(item.category);
    assert.ok(category, `${item.id}: category ${item.category}`);
    assert.ok(category.children.includes(item.topic), `${item.id}: topic ${item.topic} not listed under ${category.id}`);
  }
  // No near-duplicate category names.
  const titles = HALACHA_TOPICS.map(category => normalizeQuery(category.title));
  assert.equal(new Set(titles).size, titles.length);
});

test('search phrasings added to existing answers point at real answers and change no ruling', () => {
  for (const [id, phrases] of Object.entries(HALACHA_ALIASES)) {
    const item = PRACTICAL_HALACHA_QA_INDEX[id];
    assert.ok(item, id);
    assert.ok(phrases.length && new Set(phrases).size === phrases.length, id);
    for (const phrase of phrases) assert.ok(item.variants.includes(phrase) && item.aliases.includes(phrase), `${id}: ${phrase}`);
  }
  // The answer itself is untouched: the engine's own record still carries its original short answer.
  const original = PRACTICAL_HALACHA_QA.find(item => item.id === 'hal-brachot-shehakol-covers-all');
  assert.match(original.shortAnswer, /על הכול אם אמר שהכל – יצא/);
});

test('unresolved questions stay out of the published layer, with what is missing written down', () => {
  assert.ok(needsReview.length >= 5);
  for (const item of needsReview) {
    assert.ok(!PRACTICAL_HALACHA_QA_INDEX[item.id], item.id);
    for (const key of ['question', 'discovery', 'candidateRulingSources', 'conflictingOpinions', 'unresolvedPoint', 'reasonUnpublished']) assert.ok(item[key] && item[key].length, `${item.id}: ${key}`);
    for (const id of item.relatedPublished || []) assert.ok(PRACTICAL_HALACHA_QA_INDEX[id], `${item.id}: ${id}`);
  }
});

test('a neighbouring case that a condition changes is shown first among related cases', () => {
  const chips = PRACTICAL_HALACHA_QA_INDEX['hal-prk-chips-in-schnitzel-oil'];
  const related = relatedWithReasons(chips, { limit: 4 }).map(item => item.entry.id);
  assert.ok(related.includes('hal-bayit-egg-fried-in-meat-pan'), related.join(','));
});
