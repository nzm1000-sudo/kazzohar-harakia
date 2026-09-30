// Automated accessibility checks on server-rendered screens and shared components (tests/helpers/a11yCheck.mjs):
// accessible names, required states, valid ARIA, labelled fields, unique ids, nothing focusable hidden from assistive
// technology. What needs a real screen reader on a device is listed in docs/accessibility/manual-checklist.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadJsx } from './helpers/jsx.mjs';
import { checkMarkup, formatProblems, parseHtml } from './helpers/a11yCheck.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const store = new Map();
globalThis.localStorage = { getItem: key => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
globalThis.window ??= globalThis;
globalThis.history ??= { state: null, back() {}, replaceState() {}, pushState() {} };
const render = element => renderToStaticMarkup(element);
const clean = (html, label) => { const problems = checkMarkup(html); assert.equal(problems.length, 0, `${label}:\n${formatProblems(problems)}`); };

test('the checker itself finds what it should (unnamed button, invalid aria, tab without state, placeholder-only field)', () => {
  const problems = checkMarkup('<div><button type="button"><svg aria-hidden="true"></svg></button><span aria-foo="x">a</span><button role="tab">x</button><input placeholder="חיפוש"/><div aria-hidden="true"><button>y</button></div><button aria-label="כפתור סגירה">z</button></div>');
  const rules = problems.map(problem => problem.rule).sort();
  assert.deepEqual(rules, ['focusable-hidden', 'invalid-aria-attribute', 'missing-name', 'missing-name', 'missing-state', 'placeholder-only-label', 'redundant-role-word'].sort());
  assert.ok(parseHtml('<p>a<br>b</p>').children[0].children.length === 3);
});

test('נגישות settings and הצהרת נגישות: every control named, switches with state, one heading per screen', () => {
  const { default: AccessibilityPage } = loadJsx('pages/AccessibilityPage.jsx');
  const settings = render(React.createElement(AccessibilityPage, { route: 'accessibility', go: () => {} }));
  clean(settings, 'settings');
  for (const title of ['התאמה אוטומטית למכשיר', 'תצוגה וקריאה', 'גודל טקסט', 'מרווח שורות', 'טקסט מודגש', 'ניגודיות גבוהה', 'הפחתת שקיפות', 'הפחתת תנועה', 'משוב מישושי', 'קריאה ממוקדת', 'איפוס להגדרות המכשיר', 'הצהרת נגישות', 'דיווח על בעיית נגישות']) assert.ok(settings.includes(title), title);
  assert.ok(settings.includes('כּזוהר הרקיע מתאימה את עצמה להגדרות הנגישות של המכשיר שלך.'));
  assert.equal((settings.match(/role="switch"/g) || []).length, 7, 'seven switches');
  assert.match(settings, /role="switch" aria-checked="true" aria-label="התאמה אוטומטית למכשיר"/, 'automatic adjustment is on by default');
  assert.equal((settings.match(/<h1/g) || []).length, 1);
  const statement = render(React.createElement(AccessibilityPage, { route: 'accessibility/statement', go: () => {} }));
  clean(statement, 'statement');
  assert.match(statement, /עודכנה לאחרונה/);
  assert.match(statement, /אינה מצהירה על עמידה מלאה/, 'no claim of full conformance');
  assert.doesNotMatch(statement + settings, /@|mailto:/, 'no e-mail address is built in');
});

test('shared parts: the search field, the commentator chips, the verse line, the library rows', () => {
  const { default: ClearableInput } = loadJsx('components/ClearableInput.jsx');
  const empty = render(React.createElement(ClearableInput, { value: '', onChange() {}, 'aria-label': 'חיפוש בספרייה', clearLabel: 'נקה חיפוש', type: 'search' }));
  clean(empty, 'empty search field');
  assert.match(empty, /type="search"/);
  const typed = render(React.createElement(ClearableInput, { value: 'שבת', onChange() {}, 'aria-label': 'חיפוש בספרייה', clearLabel: 'נקה חיפוש', deferred: true }));
  clean(typed, 'typed search field');
  assert.match(typed, /aria-label="נקה חיפוש"/, 'the clear button is named');
  assert.match(typed, /value="שבת"/, 'a deferred field shows its value from the first render');

  const panel = loadJsx('components/CommentaryPanel.jsx');
  const layer = (name, remote = false) => ({ title: name, remote, work: { workId: name, layerTitle: name, editions: [{}] } });
  const chips = render(React.createElement(panel.CommentatorPicker, { layers: [layer('רש״י'), layer('רמב״ן'), layer('רלב״ג', true)], selected: 'רמב״ן', onSelect() {} }));
  clean(chips, 'commentator chips');
  assert.match(chips, /role="tablist"/);
  assert.equal((chips.match(/aria-selected="true"/g) || []).length, 1);
  const verseLine = render(React.createElement(panel.VerseLayersLine, { layers: [{ workId: 'a', title: 'רש״י' }], label: 'מפרשים', unitLabel: 'פסוק', verse: 3, onOpen() {} }));
  clean(verseLine, 'verse line');

  const library = loadJsx('pages/LibraryPage.jsx');
  clean(render(React.createElement(library.LibraryRow, { title: 'בראשית', meta: ['50 פרקים'], onClick() {} })), 'library row');
});

test('global search results view: headings, named rows, the provider group labelled', () => {
  const { GlobalSearchView } = loadJsx('pages/LearningSearch.jsx');
  const html = render(React.createElement(GlobalSearchView, { query: 'שבת', context: { events: [] }, local: { reference: null, books: [{ id: 'b', title: 'ספר', route: 'books', local: true }], psalms: [], topics: [], prayers: [] }, remote: { status: 'offline', hits: [] }, onNav() {}, openTarget() {}, openSource() {}, openPsalm() {} }));
  clean(html, 'global search');
});

test('Android: the app never asks to be an accessibility service', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = new URL('../android/app/src', import.meta.url).pathname;
  const walk = dir => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [path]; });
  const files = walk(root).filter(path => /\.(xml|java|kt)$/.test(path));
  assert.ok(files.length > 0);
  for (const file of files) assert.doesNotMatch(readFileSync(file, 'utf8'), /BIND_ACCESSIBILITY_SERVICE|AccessibilityService/, file);
});
