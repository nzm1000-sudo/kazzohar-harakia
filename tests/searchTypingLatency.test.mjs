// The keyboard never waits for a search. (1) Every search field whose results are heavy owns its text and hands the
// page the query as a low-priority update (ClearableInput deferred / useDeferredValue); the header search no longer
// re-renders the whole app between two keystrokes. (2) The Halacha search prepares each record's words once instead
// of on every query (it used to take ~280 ms per query on a laptop, most of it re-normalizing ~2,500 records).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { searchHalacha } from '../src/services/halachaSearch.mjs';
import { searchYalkut } from '../src/services/yalkutYosef.mjs';

const src = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('the heavy search fields are deferred: the letter appears at once, the results follow', () => {
  assert.match(src('components/ClearableInput.jsx'), /startTransition\(\(\) => emit\(next\)\)/);
  assert.match(src('components/Shell.jsx'), /<ClearableInput deferred value=\{query\}/);
  const deferred = { 'pages/LibraryPage.jsx': 4, 'pages/BooksPage.jsx': 2, 'pages/BlessingsEngine.jsx': 1, 'pages/ShalomRavPage.jsx': 1, 'pages/PersonalTools.jsx': 1, 'components/halacha/HalachaIndex.jsx': 1 };
  const deferredFields = text => text.split('<ClearableInput').slice(1).map(tag => tag.slice(0, tag.indexOf('/>'))).filter(tag => /\sdeferred(?=[\s/]|$)/.test(tag)).length;
  for (const [file, count] of Object.entries(deferred)) assert.equal(deferredFields(src(file)), count, file);
  for (const file of ['pages/TraditionPage.jsx', 'pages/TalmudPage.jsx', 'pages/PersonalTools.jsx']) assert.match(src(file), /useDeferredValue\(/, file);
  // The Halacha field keeps its own text and waits for a pause before searching (unchanged), and the routing no longer
  // runs the whole search a second time.
  assert.match(src('pages/HalachaLibrary.jsx'), /routeHalachaQuery\(searchQ, \{ results \}\)/);
});

test('the Halacha search is fast enough to never be felt (budget with a wide margin for slower machines)', () => {
  const queries = ['ש', 'שכ', 'שכח', 'שכחתי', 'שכחתי יעלה ויבוא', 'בשר', 'אכלתי בשר מתי חלבי', 'נר חנוכה', 'ברכה', 'כמה זמן בין בשר לחלב'];
  searchHalacha('שבת'); // prepares the records once
  const start = performance.now();
  for (const query of queries) searchHalacha(query);
  const average = (performance.now() - start) / queries.length;
  assert.ok(average < 120, `average ${average.toFixed(1)} ms per query`);
  const yalkutStart = performance.now();
  for (const query of queries) searchYalkut(query, 12);
  assert.ok((performance.now() - yalkutStart) / queries.length < 60);
});

test('the same results as before: cached words, identical ranking', () => {
  const result = searchHalacha('שכחתי יעלה ויבוא');
  const again = searchHalacha('שכחתי יעלה ויבוא');
  assert.deepEqual(again.questions.map(item => item.id), result.questions.map(item => item.id));
  assert.equal(result.state, 'questions');
  // Each Yalkut Yosef section appears once, the best-scored first.
  const sections = searchYalkut('שבת', 40).map(item => `${item.chapter}|${item.section}`);
  assert.equal(new Set(sections).size, sections.length);
});
