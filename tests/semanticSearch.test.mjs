// Stage 0.5 · the deterministic semantic layer and hybrid ranking: the lexicon as reviewed data, query intent,
// conservative morphology, typo tolerance, fusion with explanations, exact-reference priority, no lexical regression,
// natural questions with verified app answers, and the semantic benchmark (BEFORE = Stage 0's lexical engine).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDiskAssets } from './helpers/diskAssets.mjs';
import { searchTorah, searchVariants } from '../src/services/torah/search.mjs';
import { analyzeQuery, firstPersonStem } from '../src/services/torah/queryIntent.mjs';
import { editsOf } from '../src/services/torah/typo.mjs';
import { blessingAnswer } from '../src/services/torah/verifiedAnswers.mjs';
import { recentSearches, rememberSearch, suggestSearches } from '../src/services/torah/searchHistory.mjs';
import { CONCEPTS, QUESTION_SCAFFOLDING, RELATION_WEIGHT } from '../src/data/torah/semanticLexicon.mjs';
import { tokenize } from '../src/services/torah/hebrew.mjs';
import { BENCHMARK, HELD_OUT, hitId, scoreQuery, summarize } from './fixtures/semanticBenchmark.mjs';
import { getSegment } from '../src/services/torah/engine.mjs';
import { YALKUT_YOSEF } from '../src/data/yalkutYosef.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../src/data/practicalHalachaQa.mjs';

installDiskAssets();

test('lexicon: reviewed data — known relations, weights below the typed word, no empty or self expansion', () => {
  const ids = new Set();
  for (const concept of CONCEPTS) {
    assert.ok(concept.id && !ids.has(concept.id), `unique id ${concept.id}`);
    ids.add(concept.id);
    assert.ok(concept.forms.length && concept.expansions.length && concept.note, concept.id);
    for (const item of concept.expansions) {
      assert.ok(item.rel in RELATION_WEIGHT, `${concept.id}: relation ${item.rel}`);
      assert.ok(RELATION_WEIGHT[item.rel] < 1, 'every expansion weighs less than the words as typed');
      assert.ok(tokenize(item.text).length, `${concept.id}: ${item.text}`);
    }
  }
  assert.equal(RELATION_WEIGHT.related, 0.5, 'related is never a synonym: half weight');
  assert.ok(RELATION_WEIGHT.related < RELATION_WEIGHT.modern && RELATION_WEIGHT.modern < RELATION_WEIGHT.synonym && RELATION_WEIGHT.synonym < RELATION_WEIGHT.variant);
  assert.ok(QUESTION_SCAFFOLDING.includes('מה') && QUESTION_SCAFFOLDING.includes('איפה'));
});

test('intent: reference, quote, question, topic — deterministic', () => {
  assert.equal(analyzeQuery('בראשית א א', { reference: { workId: 'Genesis' } }).intent, 'reference');
  assert.equal(analyzeQuery('"ויאמר משה"').intent, 'quote');
  assert.equal(analyzeQuery('מה מברכים על אורז').intent, 'question');
  assert.equal(analyzeQuery('שכחתי לומר יעלה ויבוא').intent, 'question', 'a first-person verb is a question');
  assert.equal(analyzeQuery('אפשר לחמם אוכל נוזלי בשבת?').intent, 'question');
  assert.equal(analyzeQuery('חלב ודגים').intent, 'topic');
  assert.deepEqual(analyzeQuery('חלב ודגים').rewrites, [], 'plain source words are never rewritten');
  const question = analyzeQuery('מה עושים כשלא בטוחים אם בירכתי');
  assert.deepEqual([...question.optional].sort(), ['אמ', 'מה', 'עושימ'], 'scaffolding is optional, never dropped silently');
  assert.deepEqual(question.concepts.map(concept => concept.id), ['safek', 'berach']);
  assert.match(question.rewrites[0].via, /ספק/);
  assert.ok(question.rewrites.every(rewrite => rewrite.weight < 1));
});

test('morphology is conservative: first person → third person as an extra form only; prefixes are expansions', () => {
  assert.equal(firstPersonStem('שכחתי'), 'שכח');
  assert.equal(firstPersonStem('מצאתי'), 'מצא');
  assert.equal(firstPersonStem('בית'), null, 'short words untouched');
  assert.equal(firstPersonStem('אבינו'), null, '־ינו is not a verb ending');
  const variants = searchVariants('שכחתי לומר יעלה ויבוא', analyzeQuery('שכחתי לומר יעלה ויבוא'));
  assert.equal(variants[0].kind, 'typed');
  assert.deepEqual(variants[0].tokens, tokenize('שכחתי לומר יעלה ויבוא'), 'the words as typed are always the first variant');
});

test('typo tolerance: a penalized, labelled fallback used only when nothing was found', async () => {
  assert.ok(editsOf('הבדלהה').includes('הבדלה'));
  const fixed = await searchTorah('הבדלהה', { limit: 5 });
  assert.equal(fixed.corrected, 'הבדלהה → הבדלה');
  assert.ok(fixed.results.length);
  assert.ok(fixed.results.every(hit => hit.explain.via.some(item => item.kind === 'typo')));
  const found = await searchTorah('מוקצה', { limit: 5 });
  assert.equal(found.corrected, null, 'a word the corpus has is never "corrected"');
});

test('exact references are never displaced; lexical and hybrid agree on them', async () => {
  for (const entry of BENCHMARK.filter(item => item.type === 'exact-ref')) {
    const hybrid = await searchTorah(entry.query, { limit: 10 });
    const lexical = await searchTorah(entry.query, { limit: 10, mode: 'lexical' });
    assert.equal(hybrid.reference?.target?.route, entry.route, entry.query);
    assert.equal(lexical.reference?.target?.route, entry.route, entry.query);
  }
});

test('no lexical regression: a query the lexicon does not rewrite ranks exactly as Stage 0', { timeout: 120000 }, async () => {
  for (const query of ['חלב ודגים', 'דגים וחלב', 'דגים בחלב', 'חלב עם דגים', 'נר חנוכה', 'בורא נפשות', 'ספירת העומר', 'כבוד אב ואם', 'השבת אבדה', 'בהמ״ז יעלה ויבא']) {
    const hybrid = await searchTorah(query, { limit: 10 });
    const lexical = await searchTorah(query, { limit: 10, mode: 'lexical' });
    assert.deepEqual(hybrid.results.map(hitId), lexical.results.map(hitId), query);
  }
});

test('"חלב ודגים" in every word order still finds its real sources first', { timeout: 120000 }, async () => {
  for (const query of ['חלב ודגים', 'דגים וחלב', 'דגים בחלב', 'חלב עם דגים']) {
    const data = await searchTorah(query, { limit: 5 });
    const ids = data.results.map(hitId);
    assert.ok(ids.includes('answer:hal-bayit-fish-with-dairy'), `${query}: ${ids.join(', ')}`);
    assert.ok(ids.some(id => id.startsWith('halacha.yalkut-yosef-tashz.1.8') || id === 'Ben_Ish_Hai.1866.1'), query);
  }
});

test('hybrid ranking is transparent: every result says which variants found it and why it ranks', async () => {
  const data = await searchTorah('אסור לדבר רע על אדם אפילו שזה אמת', { limit: 10 });
  assert.equal(data.intent, 'question');
  for (const hit of data.results) {
    assert.ok(hit.explain && Number.isFinite(hit.explain.score) && hit.explain.via.length, hitId(hit));
    for (const via of hit.explain.via) assert.ok(['typed', 'abbreviation', 'rewrite', 'typo'].includes(via.kind));
  }
  const top = data.results.slice(0, 3).map(hitId);
  assert.ok(top.includes('Mishneh_Torah__Human_Dispositions.7.2') || top.includes('Kitzur_Shulchan_Arukh.30.2'), `lashon hara even when true: ${top}`);
  assert.ok(data.results[0].explain.via.some(item => item.kind === 'rewrite'), 'found through the sources\' words (לשון הרע)');
});

test('natural questions return real sources; verified app answers are marked beside them (never generated)', async () => {
  const rice = await searchTorah('מה מברכים על מאכל שעשוי מאורז', { limit: 10 });
  assert.equal(rice.blessing?.name, 'אורז');
  assert.equal(rice.blessing.route, 'books/r/Oneg_Shabbat/26/12', 'the blessing table row of עונג שבת, cited');
  assert.match(rice.blessing.cite, /עונג שבת/);
  assert.ok(rice.answers.every(hit => hit.answer));
  for (const hit of rice.results) assert.ok(hit.target?.route || hit.target?.source, 'every result is a real place');
  assert.equal(await blessingAnswer('מה מברכים על מחשב'), null, 'no food, no answer — nothing is invented');
  assert.equal(await blessingAnswer('נר חנוכה'), null);
  const topic = await searchTorah('חלב ודגים', { limit: 5 });
  assert.deepEqual(topic.answers, [], 'answers are offered for questions only');
  assert.equal(topic.blessing, null);
});

test('local suggestions: previous searches stay on the device and complete what is typed', () => {
  const map = new Map();
  const store = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  rememberSearch('נר חנוכה', store);
  rememberSearch('נרות שבת', store);
  rememberSearch('נר חנוכה', store);
  assert.deepEqual(recentSearches(store), ['נר חנוכה', 'נרות שבת']);
  assert.deepEqual(suggestSearches('נר', store), ['נר חנוכה', 'נרות שבת']);
  assert.deepEqual(suggestSearches('נר חנוכה', store), []);
});

test('benchmark: every judged source exists in the corpus', async () => {
  const ids = new Set();
  for (const entry of [...BENCHMARK, ...HELD_OUT]) for (const id of Object.keys(entry.relevant || {})) ids.add(id);
  for (const id of ids) {
    if (id.startsWith('answer:')) { assert.ok(PRACTICAL_HALACHA_QA_INDEX[id.slice(7)], id); continue; }
    if (id.startsWith('halacha.yalkut-yosef-tashz.')) { assert.ok(YALKUT_YOSEF.sections[Number(id.split('.').at(-1)) - 1], id); continue; }
    const parts = id.split('.');
    const unit = Number(parts.pop());
    const node = Number(parts.pop());
    assert.ok(await getSegment({ workId: parts.join('.'), section: node, segment: unit }), id);
  }
});

test('semantic benchmark: hybrid ≥ lexical everywhere, clearly better on questions and modern Hebrew', { timeout: 600000 }, async () => {
  const run = async mode => {
    const rows = [];
    for (const entry of BENCHMARK) rows.push({ type: entry.type, ...scoreQuery(entry, await searchTorah(entry.query, { limit: 10, mode })) });
    return summarize(rows);
  };
  const before = await run('lexical');
  const after = await run('hybrid');
  for (const type of Object.keys(before.byType)) {
    assert.ok(after.byType[type].mrr10 >= before.byType[type].mrr10, `${type}: ${before.byType[type].mrr10} → ${after.byType[type].mrr10}`);
  }
  for (const type of ['exact-ref', 'keyword', 'word-order', 'abbreviation', 'spelling']) assert.equal(after.byType[type].top1, 1, `${type} stays perfect`);
  assert.ok(after.byType.question.mrr10 - before.byType.question.mrr10 >= 0.3, `questions: ${before.byType.question.mrr10} → ${after.byType.question.mrr10}`);
  assert.ok(after.byType['modern-classical'].mrr10 > before.byType['modern-classical'].mrr10);
  assert.ok(after.all.top5 >= 0.95 && after.all.mrr10 >= 0.9, JSON.stringify(after.all));
});

test('the results view marks verified answers and the "by meaning" refinement', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { loadJsx } = await import('./helpers/jsx.mjs');
  const view = loadJsx('components/TorahSearchResults.jsx');
  const data = await searchTorah('מה מברכים על מאכל שעשוי מאורז', { limit: 10 });
  const html = renderToStaticMarkup(React.createElement(view.TorahResultsView, { status: 'done', data, onOpen: () => {}, missingPacks: [] }));
  assert.match(html, /תשובה מאומתת מתוך האפליקציה · המקורות המלאים למטה/);
  assert.match(html, /מנוע הברכות החכם · אורז/);
  assert.match(html, /עונג שבת, פרק כ״ו/);
  const refining = renderToStaticMarkup(React.createElement(view.TorahResultsView, { status: 'refining', data, onOpen: () => {}, missingPacks: [] }));
  assert.match(refining, /מחפשים גם לפי המשמעות…/);
  const plain = await searchTorah('חלב ודגים', { limit: 5 });
  assert.ok(!renderToStaticMarkup(React.createElement(view.TorahResultsView, { status: 'done', data: plain, onOpen: () => {}, missingPacks: [] })).includes('תשובה מאומתת'));
});

test('regression (Simulator): two concurrent searches for one query never show a result twice', async () => {
  const [a, b] = await Promise.all([searchTorah('צדיק יסוד עולם', { limit: 20 }), searchTorah('צדיק יסוד עולם', { limit: 20 })]);
  for (const data of [a, b]) assert.equal(new Set(data.results.map(hitId)).size, data.results.length);
  assert.deepEqual(a.results.map(hitId), b.results.map(hitId));
});
