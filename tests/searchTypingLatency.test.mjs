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

// ---- The keyboard never waits for the search (architecture, not milliseconds) ----
// The owner's report: the key clicked at once, the letter appeared half a second to a second later, on the Halacha
// field ("שאל שאלה בהלכה"). Cause: the field searched on every pause (320 ms), and one search took ~50 ms on a laptop
// (a scan of all 14,305 Yalkut Yosef sections, and each query word compared with every word of ~2,400 records) plus the
// results' render — 300–700 ms on a phone, during which the next key waited. Fixed by making the search incremental
// (words already looked up are remembered; a longer word is looked for only where the shorter one was found) and by
// looking up each query word's near forms once in the corpus vocabulary instead of against every record.
import { halachaSearchStats, warmHalachaSearch } from '../src/services/halachaSearch.mjs';
import { yalkutSearchStats } from '../src/services/yalkutYosef.mjs';

test('typing a question letter by letter never re-prepares a record or a section', () => {
  searchHalacha('שבת');
  const before = { ...halachaSearchStats(), ...yalkutSearchStats() };
  for (const phrase of ["צ'יפס שטוגן בשמן שבו טוגנו שניצלים", 'שכחתי יעלה ויבוא בברכת המזון']) {
    for (let end = 1; end <= phrase.length; end++) searchHalacha(phrase.slice(0, end));
  }
  const after = { ...halachaSearchStats(), ...yalkutSearchStats() };
  assert.equal(after.recordsPrepared, before.recordsPrepared);
  assert.equal(after.sectionsPrepared, before.sectionsPrepared);
  assert.ok(after.wordsRemembered <= 96, 'the remembered words are bounded');
});

test('the incremental Yalkut Yosef search returns exactly what a full scan returns', () => {
  // Typing order (short word, then longer) and a fresh query must agree.
  for (const phrase of ['שכחתי יעלה ויבוא', 'בשר בחלב', 'נר חנוכה']) {
    let last;
    for (let end = 1; end <= phrase.length; end++) last = searchYalkut(phrase.slice(0, end), 12);
    assert.deepEqual(last.map(item => `${item.id}:${item.score}`), searchYalkut(phrase, 12).map(item => `${item.id}:${item.score}`));
  }
});

test('the Halacha field shows each letter at once and hands the page only a paused query', () => {
  const page = src('pages/HalachaLibrary.jsx');
  const box = page.slice(page.indexOf('function SearchBox('), page.indexOf('function SearchResults('));
  // The visible text is the field's own state, set on every key; nothing heavy runs in the field.
  assert.match(box, /const \[text, setText\] = useState\(q\)/);
  assert.match(box, /setText\(value\);/);
  assert.match(box, /timer\.current = setTimeout\(\(\) => setQ\(value\), 320\)/);
  assert.doesNotMatch(box, /searchHalacha|routeHalachaQuery|localStorage|sessionStorage|setStoredQ/);
  // The page searches in a transition, and writes storage only once the reader pauses.
  assert.match(page, /const setQ = value => startTransition\(\(\) => setSearchQ\(value\)\)/);
  assert.match(page, /const STORE_AFTER_MS = 1500;/);
  assert.match(page, /setTimeout\(\(\) => setStoredQ\(/);
  assert.match(page, /setTimeout\(\(\) => recordSearchOutcome\(route\), STORE_AFTER_MS\)/);
  // No key tied to the query: the field is never remounted while typing.
  assert.doesNotMatch(page, /<SearchBox[^>]*\skey=/);
  assert.doesNotMatch(box, /<ClearableInput[^>]*\skey=/);
});

test('the "הלכה חכמה" message field owns its text: a key renders the field, not the conversation', () => {
  const chat = src('components/halacha/HalachaChat.jsx');
  const input = chat.slice(chat.indexOf('function ChatInput('), chat.indexOf('function EntryCard('));
  assert.match(input, /const \[draft, setDraft\] = useState\(''\)/);
  assert.match(input, /onChange=\{event => setDraft\(event\.target\.value\)\}/);
  assert.doesNotMatch(input, /respond\(|searchHalacha|sessionStorage|localStorage/);
});

test('the warm-up prepares the index in small slices and can be stopped', () => {
  const steps = [];
  const stop = warmHalachaSearch({ slice: 400, schedule: callback => steps.push(callback) });
  let ran = 0;
  while (steps.length && ran < 3) { steps.shift()(); ran++; }
  stop();
  assert.ok(ran > 0);
});
