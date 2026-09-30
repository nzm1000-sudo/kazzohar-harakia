// Torah Engine · user-facing integration. Without a DOM in the test runner, each flow is followed through the real code
// the phone runs: the engine's real results are rendered by the real results view; the result's own target is parsed by
// the app's own route parsers and rendered by the destination reader; the destination text is read through the reader's
// own loader. (Taps themselves were exercised in the iOS Simulator — see the report.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { configureIndexLoader } from '../src/services/torah/searchIndex.mjs';
import { searchTorah } from '../src/services/torah/search.mjs';
import { commentatorsOnVerse } from '../src/services/torah/commentaries.mjs';
import { getSegment } from '../src/services/torah/engine.mjs';
import { layersAt, loadLayerUnits } from '../src/services/library/relations.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../src/data/practicalHalachaQa.mjs';
import { yalkutText } from '../src/services/yalkutYosef.mjs';
import { diskFetch } from './helpers/diskAssets.mjs';
import { loadJsx } from './helpers/jsx.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
globalThis.fetch = diskFetch;
configureIndexLoader({ load: async file => new Uint8Array(readFileSync(new URL(`../public/torah-index/${file}`, import.meta.url))) });
const library = loadJsx('pages/LibraryPage.jsx');
const talmud = loadJsx('pages/TalmudPage.jsx');
const results = loadJsx('components/TorahSearchResults.jsx');
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const renderLibrary = route => renderToStaticMarkup(React.createElement(library.default, { route: library.parseLibraryRoute(route), go: () => {}, openSource: () => {} }));
const selectedTab = page => /role="tab" aria-selected="true"[^>]*>([^<]+)</.exec(page)?.[1];

test('ספרייה → חיפוש "חלב ודגים" → result → the exact source (every one of the first results)', { timeout: 120000 }, async () => {
  const data = await searchTorah('חלב ודגים', { limit: 8 });
  const opened = [];
  const page = renderToStaticMarkup(React.createElement(results.TorahResultsView, { status: 'done', data, onOpen: hit => opened.push(hit), setFamily: () => {} }));
  assert.match(page, /בתוך המקורות/);
  // 165 before the Beit Yosef joined the device (2026-09-30); its four parts add 29 places.
  assert.match(page, /194 מקומות/);
  assert.match(page, /role="radio" aria-checked="true"[^>]*>הכל</);
  assert.ok((page.match(/<mark>/g) || []).length >= 16, 'the matched words are marked in every snippet');
  for (const hit of data.results) {
    assert.ok(page.includes(`aria-label="${hit.displayRef.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')}`), hit.displayRef);
    if (hit.target.source) {
      const text = yalkutText(hit.target.source.reference);
      assert.ok(text?.hebrew?.join(' ').includes('דגים'), hit.target.source.reference);
    } else if (hit.target.route.startsWith('halacha/q/')) {
      assert.ok(PRACTICAL_HALACHA_QA_INDEX[decodeURIComponent(hit.target.route.split('/')[2])], hit.target.route);
    } else if (hit.target.route.startsWith('talmud/')) {
      const route = talmud.parseTalmudRoute(hit.target.route);
      assert.ok(route.tractate && route.amud && route.segment, hit.target.route);
    } else {
      const route = library.parseLibraryRoute(hit.target.route);
      assert.equal(route.view, 'read');
      const destination = renderLibrary(hit.target.route);
      assert.ok(!destination.includes('הספר אינו זמין בספרייה'), hit.target.route);
      if (route.tab) assert.equal(selectedTab(destination), 'מפרשים', `${hit.target.route}: the מפרשים tab opens`);
    }
    const unit = hit.target.source || hit.target.route.startsWith('halacha/') ? null : await getSegment({ workId: hit.workId, section: hit.place.node, segment: hit.place.unit });
    if (unit) assert.ok(/דג|דגים/.test(unit.text.replace(/[֑-ׇ]/g, '')), `${hit.workId}: the destination text is the source found`);
    opened.push(hit);
  }
  assert.equal(opened.length, data.results.length);
});

test('תורה → בראשית א:א → מפרשים → רש"י → the text renders', { timeout: 120000 }, async () => {
  const chapter = renderLibrary('books/r/Genesis/1/1');
  assert.deepEqual([...chapter.matchAll(/role="tab"[^>]*>([^<]+)</g)].map(m => m[1]), ['מקרא', 'מפרשים'], 'the tab bar is visible on the verse');
  // The line under the picked verse names only the commentators with a comment on it.
  const line = renderToStaticMarkup(React.createElement(library.VerseLayersLine, { layers: commentatorsOnVerse('Genesis', 1, 1), label: 'מפרשים', unitLabel: 'פסוק', verse: 1, onOpen: () => {} }));
  assert.match(line, /aria-label="מפרשים על פסוק א׳: רש״י, רמב״ן, /);
  // Each commentator is its own chip, one tap from that commentator alone.
  assert.match(line, /<button type="button" aria-label="רמב״ן על פסוק א׳">רמב״ן<\/button>/);
  // Its tap opens the מפרשים tab on that verse: the same view as the deep link.
  const commentary = renderLibrary('books/r/Genesis/1/1/m');
  assert.equal(selectedTab(commentary), 'מפרשים');
  assert.match(commentary, /מפרשים על פסוק א׳/);
  assert.match(commentary, /<h2 class="library-layer-title">רש״י<\/h2>/);
  const rashi = layersAt('Genesis', 1).find(layer => layer.work.workId === 'Rashi_on_Genesis');
  const units = (await loadLayerUnits(rashi, { fetchImpl: diskFetch })).filter(unit => unit.v === 1);
  assert.match(units[0].text, /אמר רבי יצחק/);
  // Another verse, another context: Genesis 12:1.
  assert.equal(selectedTab(renderLibrary('books/r/Genesis/12/1/m')), 'מפרשים');
  assert.ok(commentatorsOnVerse('Genesis', 12, 1).length > 0);
});

test('every path to a Torah verse exposes מפרשים', () => {
  const page = read('pages/LibraryPage.jsx');
  // 1. the chapter reader: a tap on a verse, and the line under it
  assert.match(page, /onClick=\{verseLayered \? \(\) => within\(node, item\.n === unit \? null : item\.n\) : undefined\}/);
  assert.match(page, /\{verseLayered && item\.n === unit && <VerseLayersLine layers=\{commentatorsOnVerse\(work\.workId, node, item\.n\)\}/);
  // 2. the weekly portion in the library (books/p/…): its own מפרשים tab, and the chips under a picked verse
  assert.match(page, /\{portion && portionLayered && <div className="seg library-layer-tabs library-portion-tabs" role="tablist"/);
  assert.match(page, /portionTab === 'commentary' && <PassageCommentaries baseWorkId=\{work\.workId\} passage=\{\{ from: parasha\.from, to: parasha\.to \}\}/);
  assert.match(page, /on && <VerseLayersLine layers=\{layers\}[^>]*onOpen=\{name => openPortionCommentary\(chapter\.n, item\.n, name\)\}/);
  // 3. a reading opened from פרשת השבוע, a holiday or a haftarah (the source reader)
  const source = read('components/SourceReader.jsx');
  assert.match(source, /commentatorsOnVerse\(tanakhBook, verse\.c, verse\.v\)/);
  assert.match(source, /<div className="seg library-layer-tabs source-reader-tabs" role="tablist"/);
  assert.match(source, /readerTab === 'commentary' && <PassageCommentaries baseWorkId=\{tanakhBook\}/);
  assert.match(source, /<VerseLayersLine layers=\{layers\}[^>]*onOpen=\{name => openVerseCommentary\(verse, name\)\}/);
  // 4. שניים מקרא ואחד תרגום
  const shnayim = read('pages/ShnayimMikra.jsx');
  assert.match(shnayim, /<VerseCommentaries book=\{parasha\.range\.book\} verse=\{verse\} onOpen=\{openCommentary\} \/>/);
  assert.match(shnayim, /<div className="seg library-layer-tabs shnayim-tabs" role="tablist"/);
  assert.match(shnayim, /tab === 'commentary' && <PassageCommentaries baseWorkId=\{parasha\.range\.book\}/);
  // 5. the Talmud reader opens a segment's Rashi / Tosafot from a deep link
  assert.match(read('pages/TalmudPage.jsx'), /if \(refs\.length\) setOpen\(\{ segment: seg\.ref, kind: layer, refs \}\);/);
});

test('reference search: the typed reference is offered first and opens the reader there', async () => {
  for (const [query, route] of [['בראשית א:א', 'books/r/Genesis/1/1'], ['ברכות א:א', 'books/r/Mishnah_Berakhot/1/1'], ['ברכות ב ע"א', 'talmud/Berakhot/2a'], ['שו"ע או"ח שיח א', 'books/r/Shulchan_Arukh__Orach_Chayim/318/1']]) {
    const data = await searchTorah(query, { limit: 3 });
    assert.equal(data.reference.target.route, route, query);
  }
  const page = read('pages/LibraryPage.jsx');
  assert.match(page, /\{reference && <section><h2 className="library-subhead">מראה מקום<\/h2>/);
  assert.ok(page.indexOf('מראה מקום</h2>') < page.indexOf('<TorahSearchResults query={trimmed}'), 'the reference comes before the text results');
});

test('the no-result state is plain and deterministic', () => {
  const page = renderToStaticMarkup(React.createElement(results.TorahResultsView, { status: 'done', data: { query: 'x', results: [], total: 0, shown: 0, partial: false, suggestions: [{ label: 'דגים', query: 'דגים' }], onlyStopWords: false }, onOpen: () => {}, onSuggest: () => {} }));
  assert.match(page, /לא נמצאו מקורות שבהם מופיעות המילים האלה/);
  assert.match(page, /חיפוש מילה אחת: <button type="button" class="link">דגים<\/button>/);
});
