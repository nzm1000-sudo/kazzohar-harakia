// Regression (owner, iPhone, airplane mode): the header search "חיפוש בספרייה…" for "נר חנוכה" showed "Load failed" and
// only שלום רב; "שבת" → "הדלקת נרות שבת" opened "אין חיבור לאינטרנט והתוכן הזה עדיין לא נשמר במכשיר". The header search
// now runs on the Torah Engine (local shards), the provider's search is an extra group that can fail quietly, and a
// result opens the book on the device. Every remote request below fails exactly as WKWebView fails in airplane mode.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { diskFetch, installDiskAssets } from './helpers/diskAssets.mjs';
import { loadJsx } from './helpers/jsx.mjs';
import { searchTorah } from '../src/services/torah/search.mjs';
import { localSections, remoteSearch, topicTarget } from '../src/services/torah/globalSearch.mjs';
import { localPackText, localPlaceForRef, localRouteForRef } from '../src/services/torah/localSources.mjs';
import { getText } from '../src/services/sefaria.mjs';
import { WORKS } from '../src/data/library/registry.mjs';
import { halachot } from '../src/content.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

installDiskAssets();
const remoteRequests = [];
// Airplane mode: the app's own files answer; anything on the network fails the way Safari reports it.
globalThis.fetch = (url, options) => {
  if (/^https?:\/\//.test(String(url))) { remoteRequests.push(String(url)); return Promise.reject(new TypeError('Load failed')); }
  return diskFetch(url, options);
};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true, writable: true });

test('"נר חנוכה" in the header search: real sources from the device, no network', { timeout: 60000 }, async () => {
  const before = remoteRequests.length;
  const data = await searchTorah('נר חנוכה', { limit: 10 });
  assert.ok(data.total >= 100, `found ${data.total}`);
  assert.ok(data.results.length >= 8);
  for (const hit of data.results) {
    assert.ok(hit.offline, hit.displayRef);
    assert.ok(hit.target?.route || hit.target?.source, `${hit.displayRef}: an exact place`);
    assert.match(hit.snippet.text.replace(/[֑-ׇ]/g, ''), /חנוכה|נר/, hit.displayRef);
  }
  assert.equal(remoteRequests.length, before, 'the local search made no network request');
});

test('the provider search is an extra that fails quietly: offline → not asked; online but failing → "unavailable"', async () => {
  let asked = 0;
  const failing = async () => { asked += 1; throw new TypeError('Load failed'); };
  assert.deepEqual(await remoteSearch('נר חנוכה', { search: failing, online: false }), { status: 'offline', hits: [] });
  assert.equal(asked, 0, 'offline: the provider is not asked at all');
  assert.deepEqual(await remoteSearch('נר חנוכה', { search: failing, online: true }), { status: 'unavailable', hits: [] });
  const found = await remoteSearch('נרות', { search: async () => [{ ref: 'Shulchan Arukh, Orach Chayim 263:1', title: 'שולחן ערוך' }, { ref: 'Tur, Orach Chayim 263', title: 'טור' }], online: true });
  assert.equal(found.hits[0].localRoute, 'books/r/Shulchan_Arukh__Orach_Chayim/263/1', 'a provider hit the device has opens locally');
  // The Tur is on the device too (its four parts, numbered straight through: אורח חיים 263 is node 264).
  assert.equal(found.hits[1].localRoute, 'books/r/Tur/264');
});

test('"שבת" → "הדלקת נרות שבת" opens the Shulchan Arukh on the device, and the text loads offline', async () => {
  const sections = localSections('שבת');
  const candles = sections.topics.find(topic => topic.id === 'candles');
  assert.ok(candles, 'the topic is listed');
  assert.deepEqual(candles.target, { route: 'books/r/Shulchan_Arukh__Orach_Chayim/263' });
  for (const record of halachot) assert.ok(topicTarget(record).route, `${record.title}: opens locally`);
  const before = remoteRequests.length;
  const text = await getText('Shulchan Arukh, Orach Chayim 263');
  assert.ok(text.bundledOffline, 'from the book on the device');
  assert.equal(text.hebrew.length, 17);
  assert.match(text.hebrew[0].replace(/[֑-ׇ]/g, ''), /יהא זהיר לעשות נר יפה/);
  const seif = await getText('Shulchan Arukh, Orach Chayim 263:2');
  assert.equal(seif.segmentNumber, 2);
  assert.equal(seif.sectionRef, 'Shulchan Arukh, Orach Chayim 263');
  assert.equal(remoteRequests.length, before, 'no network request for a local book');
});

test('provider references resolve to the same place in the local books (aligned works only)', async () => {
  assert.equal(localRouteForRef('Mishnah Berurah 263:1'), 'books/r/Mishnah_Berurah/263/1');
  assert.equal(localRouteForRef('Mishnah Berakhot 1:1'), 'books/r/Mishnah_Berakhot/1/1');
  assert.equal(localRouteForRef("Shulchan Arukh, Yoreh De'ah 87:1"), 'books/r/Shulchan_Arukh__Yoreh_Deah/87/1');
  assert.equal(localRouteForRef('Shulchan Arukh, Orach Chayim 999'), null, 'a siman the edition lacks');
  assert.equal(localRouteForRef('Genesis 1:1'), null, 'the Tanakh has its own local path');
  assert.equal(localRouteForRef('Berakhot 2a'), null);
  const mb = await localPackText('Mishnah Berurah 263:1');
  assert.match(mb.hebrew[0], /^יהא זהיר/, 'the opening words (dibbur hamatchil) stay with the comment');
  // Every aligned work: node n of the pack is section n of the provider (never more sections than the provider has);
  // a section the edition lacks (Torat Emet's Bikkurim has no chapter 4) opens nothing rather than a wrong place.
  for (const work of WORKS.filter(item => item.kind === 'pack' && localPlaceForRef(`${item.sourceTitle} 1`))) {
    const edition = work.editions[0];
    assert.ok(edition.nodes.length <= edition.expected.length, work.workId);
  }
  assert.equal(await localPackText('Mishnah Bikkurim 4:1'), null);
});

test('the header search view: local groups first, the provider group marked and quiet when it fails', () => {
  const page = loadJsx('pages/LearningSearch.jsx');
  const results = loadJsx('components/TorahSearchResults.jsx');
  const data = { query: 'שבת', results: [{ id: 1, workId: 'Shulchan_Arukh__Orach_Chayim', displayRef: 'שולחן ערוך, אורח חיים רס״ג, א׳', workTitle: 'שולחן ערוך', snippet: { text: 'נר שבת', highlights: [[0, 2]] }, target: { route: 'books/r/Shulchan_Arukh__Orach_Chayim/263/1' } }], total: 1, shown: 1, partial: false, suggestions: [] };
  const render = remote => renderToStaticMarkup(React.createElement(page.GlobalSearchView, {
    query: 'שבת', context: { events: [] }, local: localSections('שבת'), remote, onNav: () => {}, openTarget: () => {}, openSource: () => {}, openPsalm: () => {},
    torah: React.createElement(results.TorahResultsView, { status: 'done', data, onOpen: () => {}, heading: 'בתוך המקורות · במכשיר' }),
  }));
  for (const status of ['offline', 'unavailable']) {
    const html = render({ status, hits: [] });
    assert.ok(!/load failed/i.test(html), 'never the raw network error');
    assert.ok(!html.includes('אין חיבור לאינטרנט והתוכן הזה עדיין לא נשמר במכשיר'));
    assert.ok(!html.includes('role="alert"'), 'a provider failure is not an alert');
    assert.match(html, /בתוך המקורות · במכשיר/);
    assert.match(html, /הדלקת נרות שבת<small>שולחן ערוך · במכשיר/);
    assert.match(html, /עוד מספריא <small class="global-search-online">דורש חיבור לאינטרנט/);
    assert.ok(html.indexOf('בתוך המקורות') < html.indexOf('עוד מספריא'), 'the device results come before the online extra');
  }
  const source = readFileSync(new URL('../src/pages/LearningSearch.jsx', import.meta.url), 'utf8');
  assert.match(source, /remoteSearch\(text,\{search\}\)/, 'the provider search runs only through the quiet wrapper');
});
