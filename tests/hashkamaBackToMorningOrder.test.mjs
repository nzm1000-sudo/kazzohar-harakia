// Back from Shacharit opened by "הבא · שחרית" at the end of סדר השכמת הבוקר (owner, 2026-10-03): ONE Back — the app's
// back control or the system's / browser's — returns straight to the morning order, at its end where "הבא" was tapped.
// Shacharit opened any other way keeps its own Back (to the Siddur).
//
// The route: the page's "הבא" opens the Siddur (to find today's Shacharit by the Siddur's own route), and the Siddur
// opens Shacharit with `replaceEntry` — the reading takes the Siddur's entry, so History holds [… morning order,
// Shacharit]. Checked here on a model of History driven by the same decision NewApp uses (sourceEntryWrite), on the
// scroll restoration of the morning order's entry, and on the wiring in NewApp and the Siddur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sourceEntryWrite } from '../src/services/readerHistory.mjs';
import { rememberScroll, restoreScroll, _resetEntries } from '../src/services/scrollRestoration.mjs';
import { AFTER_HASHKAMA, HASHKAMA_TITLE } from '../src/services/hashkama.mjs';

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

// A model of the browser's History as NewApp writes it: nav() pushes a screen, openSource() writes by sourceEntryWrite.
function makeHistory() {
  const stack = [{ hash: 'siddur', source: null, key: 'home' }];
  let at = 0;
  let n = 0;
  const current = () => stack[at];
  return {
    current,
    get length() { return at + 1; },
    nav(hash) { stack.splice(at + 1); stack.push({ hash, source: null, key: `k${n += 1}` }); at += 1; },
    openSource(reference, extra = {}) {
      const write = sourceEntryWrite({ replace: extra.replace, replaceEntry: extra.replaceEntry, hasSource: Boolean(current().source) });
      const entry = { reference, anchor: extra.anchor || null, backLabel: extra.backLabel || null };
      if (write === 'replace') stack[at] = { ...current(), source: entry };
      else if (write === 'replace-entry') stack[at] = { ...current(), source: entry, key: `k${n += 1}` };
      else { stack.splice(at + 1); stack.push({ hash: current().hash, source: entry, key: `k${n += 1}` }); at += 1; }
      return write;
    },
    back() { if (at > 0) at -= 1; return current(); },
  };
}
const HASHKAMA = 'Siddur Edot HaMizrach, Upon Arising, Modeh Ani; …';
const SHACHARIT = 'day-service:shacharit';

test('the write decision: within a prayer replaces, a way through is replaced, everything else is pushed', () => {
  assert.equal(sourceEntryWrite({ replace: true, hasSource: true }), 'replace');
  assert.equal(sourceEntryWrite({ replace: true, hasSource: false }), 'push', 'nothing to replace on a screen without a reading');
  assert.equal(sourceEntryWrite({ replaceEntry: true, hasSource: false }), 'replace-entry');
  assert.equal(sourceEntryWrite({ replaceEntry: true, hasSource: true }), 'push', 'never replaces a reading the user opened');
  assert.equal(sourceEntryWrite({}), 'push');
  assert.equal(sourceEntryWrite(), 'push');
});

test('end of the morning order → "הבא · שחרית" → one Back lands on the morning order', () => {
  const h = makeHistory();
  h.openSource(HASHKAMA); // the morning order, opened from the Siddur
  const morning = h.current();
  // "הבא · שחרית": NewApp's continueAfterHashkama — the Siddur, to find today's Shacharit …
  h.nav('siddur');
  // … which opens it right after ברכות השחר, in place of its own entry (BooksPage's after-hashkama effect)
  assert.equal(h.openSource(SHACHARIT, { anchor: AFTER_HASHKAMA, replaceEntry: true, backLabel: `חזרה ל${HASHKAMA_TITLE}` }), 'replace-entry');
  assert.equal(h.current().source.reference, SHACHARIT);
  assert.equal(h.current().source.anchor, AFTER_HASHKAMA);
  assert.equal(h.current().source.backLabel, 'חזרה לסדר השכמת הבוקר', 'the back control says where it goes');
  assert.notEqual(h.current().key, morning.key, 'Shacharit has an entry (scroll, opened-at) of its own');
  // one Back — history.back(), which is what the app's back control (navigation.onBack), the reader's close, the
  // Android back button (closeOverlayOrBack) and the browser all do
  const landed = h.back();
  assert.equal(landed.source?.reference, HASHKAMA, 'straight to the morning order — not the Siddur');
  assert.equal(landed.key, morning.key, 'the very entry it left: its scroll is restored');
  // and one more Back: the Siddur it was opened from
  assert.equal(h.back().source, null);
});

test('Shacharit opened any other way keeps its normal Back (to the Siddur)', () => {
  const h = makeHistory();
  assert.equal(h.openSource(SHACHARIT), 'push');
  assert.equal(h.back().hash, 'siddur');
  assert.equal(h.current().source, null);
  // from the Siddur's own list, even after the morning order was read and left
  const g = makeHistory();
  g.openSource(HASHKAMA);
  g.back();
  g.openSource(SHACHARIT, { showCompass: true });
  assert.equal(g.back().source, null, 'Back from Shacharit → the Siddur');
});

test('the morning order comes back scrolled to its end, where "הבא" was tapped', () => {
  _resetEntries();
  // pushRoute remembers the leaving entry's scroll (the end of the page) before the Siddur's entry is pushed
  rememberScroll('morning', 18400);
  const calls = [];
  const win = {
    document: { scrollingElement: { scrollHeight: 19300 } }, innerHeight: 844,
    scrollTo: (x, y) => calls.push(y), addEventListener() {}, removeEventListener() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  };
  restoreScroll('morning', { win });
  assert.equal(calls.at(-1), 18400);
  _resetEntries();
});

test('wiring: the Siddur opens Shacharit after the morning order in place of its own entry; NewApp honours it', () => {
  const books = read('../src/pages/BooksPage.jsx');
  const effect = books.slice(books.indexOf('if (autoOpenPrayer !== `shacharit@${AFTER_HASHKAMA}`) return;'));
  assert.match(effect.slice(0, 900), /openShacharitAfterHashkama\(\{ replaceEntry: true, backLabel: `חזרה ל\$\{HASHKAMA_TITLE\}` \}\)/);
  // the Siddur's own "הבא" (a live flow, opened from the Siddur's list) pushes — the Siddur is a real screen there
  assert.match(books, /buildSiddurFlows\(roots, openSource, \{ onContinue: \(\) => openShacharitAfterHashkama\(\) \}\)/);
  // every other way to Shacharit carries no replaceEntry
  assert.equal((books.match(/replaceEntry: true/g) || []).length, 1);
  const app = read('../src/NewApp.jsx');
  assert.match(app, /const continueAfterHashkama=\(\)=>\{setAutoPrayer\(`shacharit@\$\{AFTER_HASHKAMA\}`\);nav\('siddur'\);\};/);
  assert.match(app, /sourceEntryWrite\(\{replace:extra\.replace,replaceEntry:extra\.replaceEntry,hasSource:Boolean\(history\.state\?\.source\)\}\)/);
  assert.match(app, /else if\(write==='replace-entry'\)\{const \{kzResults:_results,\.\.\.previous\}=history\.state\|\|\{\};history\.replaceState\(\{\.\.\.previous,source:entry,kzKey:newEntryKey\(\)\}/);
  assert.match(app, /extra\.backLabel&&moved\.navigation\?\{\.\.\.moved\.navigation,backLabel:extra\.backLabel\}/);
  // the system back (Android) and the reader's close are History's Back
  assert.match(app, /if \(action === 'history'\) \{\s*window\.history\.back\(\);/);
  assert.match(books, /const dayNavigation = prayer => \(\{[^]*?onBack: \(\) => history\.back\(\) \}\);/);
});
