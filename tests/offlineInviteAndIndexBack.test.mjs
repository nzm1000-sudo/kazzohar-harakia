// "מאגר השאלות השלם" Back returns to the open group/topic; the step ring in "מה חשוב לדעת עכשיו"; the blessings
// engine subtitle; the quiet offline-download line at the end of the ספרים / תלמוד / הלכה homes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { halachaIndexRoute, initialOpenState, openedFromIndex, parseHalachaIndexRoute, routeForOpenState, toggleOpen, topicKey } from '../src/services/halachaIndexRoute.mjs';
import { routeParts } from '../src/services/safeRoute.mjs';
import { configurePackManager, packStatuses } from '../src/services/torah/packManager.mjs';
import { INVITE_TEXT, _resetInviteSession, currentRunIds, formatInviteSize, inviteModel, spokenInviteSize, startInviteDownload } from '../src/services/torah/offlineInvite.mjs';
import CATALOG from '../src/data/torah/packCatalog.mjs';
import { SIDDUR_HOME_ORDER } from '../src/data/nusach/siddurLayouts.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// ---------- 1 · Back in "מאגר השאלות השלם" ----------
test('index route: group and topic round-trip through the address (Hebrew, spaces, slashes safe)', () => {
  assert.deepEqual(parseHalachaIndexRoute('halacha/all'), { view: 'all', group: null, topic: null });
  const route = halachaIndexRoute('shabbat', 'קידוש / הבדלה');
  assert.equal(route.split('/').length, 4, 'a slash inside a topic is encoded');
  assert.deepEqual(parseHalachaIndexRoute(route), { view: 'all', group: 'shabbat', topic: 'קידוש / הבדלה' });
  assert.deepEqual(parseHalachaIndexRoute(halachaIndexRoute('shabbat')), { view: 'all', group: 'shabbat', topic: null });
  assert.equal(halachaIndexRoute(null, 'x'), 'halacha/all');
  assert.equal(parseHalachaIndexRoute('halacha/chat'), null);
  assert.deepEqual(parseHalachaIndexRoute('halacha/all/%E0%A4'), { view: 'all', group: '%E0%A4', topic: null }, 'a malformed address never throws');
  assert.deepEqual(routeParts(route), ['halacha', 'all', 'shabbat', 'קידוש / הבדלה']);
});

test('index open state: restored from the entry, else from the route; the route follows the latest opened place', () => {
  assert.deepEqual(initialOpenState({ group: 'shabbat', topic: 'קידוש' }, null), { groups: ['shabbat'], topics: [topicKey('shabbat', 'קידוש')] });
  const remembered = { groups: ['a', 'b'], topics: [topicKey('a', 'x')] };
  assert.deepEqual(initialOpenState({ group: 'b', topic: null }, remembered), remembered, 'Back to a live entry restores everything that was open');
  let state = initialOpenState({ group: null }, null);
  state = toggleOpen(state, { group: 'shabbat', open: true });
  assert.equal(routeForOpenState(state), 'halacha/all/shabbat');
  state = toggleOpen(state, { group: 'shabbat', topic: 'קידוש', open: true });
  assert.equal(routeForOpenState(state), halachaIndexRoute('shabbat', 'קידוש'));
  assert.equal(toggleOpen(state, { group: 'shabbat', open: true }), state, 'a mount-time toggle of an already open group changes nothing');
  state = toggleOpen(state, { group: 'tefila', open: true });
  assert.equal(routeForOpenState(state), halachaIndexRoute('shabbat', 'קידוש'), 'the open topic is the most specific place');
  state = toggleOpen(state, { group: 'shabbat', open: false });
  assert.equal(routeForOpenState(state), 'halacha/all/tefila', 'a topic inside a closed group is not the place');
  state = toggleOpen(state, { group: 'tefila', open: false });
  assert.equal(routeForOpenState(state), 'halacha/all');
  assert.equal(openedFromIndex('halacha/all/shabbat/קידוש'), true);
  assert.equal(openedFromIndex('halacha/all'), true);
  assert.equal(openedFromIndex('halacha'), false);
  assert.equal(openedFromIndex('halacha/allx'), false);
});

test('index wiring: route-parsed, per-entry state, controlled <details>, quiet replace, chat Back is a real Back', () => {
  const index = read('../src/components/halacha/HalachaIndex.jsx');
  const library = read('../src/pages/HalachaLibrary.jsx');
  const app = read('../src/NewApp.jsx');
  assert.match(library, /if \(parts\[1\] === 'all'\) return parseHalachaIndexRoute\(mode\);/);
  assert.match(library, /<HalachaIndex go=\{go\} route=\{route\} \/>/);
  assert.match(index, /useRouteState\('halacha-index-filter', ''\)/);
  assert.match(index, /useRouteState\('halacha-index-open'/);
  assert.match(index, /open=\{openState\.groups\.includes\(group\.id\)\} onToggle=/);
  assert.match(index, /open=\{openState\.topics\.includes\(topicKey\(group\.id, topic\)\)\} onToggle=/);
  assert.match(index, /go\(routeForOpenState\(next\), \{ replace: true, quiet: true \}\)/);
  assert.match(app, /if \(options\.replace && options\.quiet\) return;\n    setMode\(id\); setSource\(null\);/, 'a quiet replace neither re-renders nor scrolls');
  assert.match(library, /const backLabel = chatFromIndex \? 'חזרה למאגר השאלות'/);
  assert.match(library, /const backTarget = chatFromIndex \? null/, 'no target → history.back(), restoring the entry');
  assert.ok(library.indexOf('const chatFromIndex') < library.indexOf('const crumbs'), 'declared before it is read');
});

// ---------- 2 · the step ring ----------
test('guide step number: a thin accent ring, no fill, centred lining tabular figures', () => {
  const css = read('../src/styles/base.css');
  const rule = css.slice(css.lastIndexOf('.halacha-guide-num{'));
  const body = rule.slice(0, rule.indexOf('}'));
  assert.match(body, /width:26px;height:26px/);
  assert.match(body, /font-size:15px/, 'the app never sets UI text below 15px');
  assert.match(body, /border:1px solid var\(--accent\)/);
  assert.match(body, /border-radius:50%/);
  assert.match(body, /background:transparent/);
  assert.match(body, /line-height:1/);
  assert.match(body, /place-items:center/);
  assert.match(body, /font-variant-numeric:tabular-nums lining-nums/);
  assert.match(read('../src/components/halacha/HalachaHubParts.jsx'), /className="halacha-guide-num" data-digit=\{String\(index \+ 1\)\}/);
});

// ---------- 3 · the blessings engine subtitle ----------
test('the blessings engine card asks "מה מברכים על זה?"', () => {
  assert.equal(SIDDUR_HOME_ORDER.find(item => item.key === 'brachot').note, 'מה מברכים על זה?');
});

// ---------- 4 · the quiet offline line ----------
const pack = (packId, status, size, done = 0) => ({ packId, status, size, done });
test('offline line: size from the catalog, hidden once everything is on the device, progress over the run', () => {
  const total = CATALOG.packs.reduce((sum, entry) => sum + entry.totalDownloadSize, 0);
  assert.equal(formatInviteSize(total), '17.6MB');
  assert.equal(spokenInviteSize(total), '17.6 מגה־בייט');
  assert.match(INVITE_TEXT.books, /^אפשר להוריד את הספרייה לשימוש ללא אינטרנט$/);
  assert.equal(INVITE_TEXT.search, 'חיפוש מלא גם במדרש, חסידות ושו״ת — ללא אינטרנט');
  assert.doesNotMatch(INVITE_TEXT.search, /תלמוד|הלכה/, 'Talmud and halacha already work offline');
  const all = inviteModel(CATALOG.packs.map(entry => pack(entry.packId, 'available', entry.totalDownloadSize)));
  assert.equal(all.visible, true);
  assert.equal(all.missingBytes, total);
  assert.equal(inviteModel(CATALOG.packs.map(entry => pack(entry.packId, 'installed', entry.totalDownloadSize))).visible, false, 'gone for good');
  assert.equal(inviteModel([pack('a', 'installed', 10), pack('b', 'update', 10)]).visible, false, 'an update is the manager’s business, not a nag');
  const run = inviteModel([pack('a', 'installed', 100), pack('b', 'downloading', 100, 60), pack('c', 'queued', 200)], ['a', 'b', 'c']);
  assert.deepEqual([run.downloading, run.percent, run.failed], [true, 40, false]);
  const second = inviteModel([pack('a', 'installed', 100), pack('b', 'downloading', 100, 50)], ['b']);
  assert.equal(second.percent, 50, 'a second run does not start at the share already on the device');
  assert.equal(inviteModel([pack('a', 'error', 100)], ['a']).failed, true);
  assert.equal(inviteModel([pack('a', 'error', 100)], []).failed, false, 'a failure elsewhere (the manager) is not repeated here');
});

function fakeStorage() { const map = new Map(); return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; }
const offlineFetch = async () => { throw new TypeError('Load failed'); };
test('offline line: a tap offline explains; on cellular it asks once; otherwise it starts every missing pack in place', async () => {
  const setup = ({ online = true, connection = 'wifi', wifiOnly = false } = {}) => {
    const storage = fakeStorage();
    if (wifiOnly) storage.setItem('kz-torah-packs-v1', JSON.stringify({ installed: {}, prefs: { wifiOnly: true } }));
    configurePackManager({ storage: () => storage, fetch: offlineFetch, host: 'https://packs.test/torah-packs/', online: () => online, connection: async () => connection, estimate: async () => null, store: { read: async () => null, write: async () => {}, removeDir: async () => {}, usage: async () => 0 } });
    _resetInviteSession();
  };
  setup({ online: false });
  assert.deepEqual(await startInviteDownload(), { phase: 'offline' });
  assert.deepEqual(currentRunIds(), [], 'nothing started');
  setup({ connection: 'cellular', wifiOnly: true });
  assert.deepEqual(await startInviteDownload(), { phase: 'confirm' });
  const confirmed = await startInviteDownload({ confirmCellular: true });
  assert.equal(confirmed.phase, 'started');
  assert.deepEqual(currentRunIds(), CATALOG.packs.map(entry => entry.packId));
  await confirmed.done;
  assert.ok(!packStatuses().some(status => status.error === 'WIFI_ONLY'), 'the confirmation overrides Wi‑Fi‑only for this download');
  const again = await startInviteDownload();
  assert.equal(again.phase, 'started', 'asked once per session');
  await again.done;
  setup({ connection: 'wifi' });
  const started = await startInviteDownload();
  assert.equal(started.phase, 'started');
  await started.done;
  const model = inviteModel(packStatuses(), currentRunIds());
  assert.equal(model.failed, true, 'a failed download says so quietly in the line');
  assert.equal(model.visible, true);
});

test('offline line: at the very end of the three homes only, a button with the size in its label, 44px targets', () => {
  const books = read('../src/pages/LibraryPage.jsx');
  const talmud = read('../src/pages/TalmudPage.jsx');
  const halacha = read('../src/pages/HalachaLibrary.jsx');
  const home = books.slice(books.indexOf('function LibraryHome'));
  assert.match(home.slice(0, home.indexOf('\n}\n')), /<OfflineInvite variant="books" go=\{go\} \/>\n    <\/>\}\n  <\/section>;$/);
  const talmudHome = talmud.slice(talmud.indexOf('function TalmudHome'));
  assert.match(talmudHome.slice(0, talmudHome.indexOf('\n}\n')), /<OfflineInvite variant="search" go=\{go\} \/>\n  <\/section>;$/);
  const root = halacha.slice(halacha.indexOf('function Root('));
  assert.match(root.slice(0, root.indexOf('\n}\n')), /\{!searchQ\.trim\(\) && <OfflineInvite variant="search" go=\{go\} \/>\}\n  <\/>;$/);
  for (const source of [books, talmud, halacha]) assert.equal(source.match(/<OfflineInvite /g).length, 1, 'once, never at the top');
  const component = read('../src/components/OfflineInvite.jsx');
  assert.match(component, /aria-label=\{`\$\{INVITE_WORDS\.action\}: \$\{text\}, \$\{spokenInviteSize\(model\.missingBytes\)\}`\}/);
  assert.match(component, /go\('offline'\)/);
  assert.match(component, /<svg className="offline-invite-glyph"/);
  assert.doesNotMatch(component, /[\u{1F300}-\u{1FAFF}⬇⤓]/u, 'no emoji');
  const css = read('../src/styles/base.css');
  assert.match(css, /\.offline-invite-go,\.offline-invite-link\{min-height:44px;/);
  assert.match(css, /\.offline-invite-line\{[^}]*font-size:var\(--font-ui-caption\)/);
  assert.match(css, /\.offline-invite\{[^}]*color:var\(--ink-2\)/);
});
