// הגדרות — the real settings page (owner, 2026-10-02): one tap from עוד (הגדרות last in the sheet), its sections in order
// (five, and since 2026-10-03 the sixth, האתגר העולמי), the manual place moved here from זמנים (logic and storage unchanged), and the settings search.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadJsx } from './helpers/jsx.mjs';
import { checkMarkup, formatProblems } from './helpers/a11yCheck.mjs';
import { SETTINGS_INDEX, SETTINGS_SECTIONS, searchSettings, settingsQueryWords } from '../src/services/settingsSearch.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const store = new Map();
globalThis.localStorage = { getItem: key => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
globalThis.window ??= globalThis;
globalThis.history ??= { state: null, back() {}, replaceState() {}, pushState() {} };
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const SETTINGS = { location: { name: 'ירושלים', latitude: 31.7683, longitude: 35.2137, tzid: 'Asia/Jerusalem' }, il: true, nusach: 'edot-hamizrach' };

test('עוד: הגדרות is the last tile (after זמנים and every place), one tap opens #settings, and it owns its routes', () => {
  const Shell = loadJsx('components/Shell.jsx');
  const shell = read('components/Shell.jsx');
  assert.match(shell, /const MOBILE_MORE = \[\.\.\.NAV\.slice\(4\), \.\.\.MORE, SETTINGS_ENTRY\];/);
  assert.deepEqual(Shell.SETTINGS_ENTRY, ['settings', 'הגדרות']);
  assert.equal(Shell.MORE_SHEET.at(-1)[0], 'settings', 'הגדרות last');
  assert.equal(Shell.MORE_SHEET[0][0], 'times', 'זמנים first');
  assert.equal(Shell.MORE_SHEET.filter(([id]) => id === 'settings').length, 1);
  assert.equal(Shell.MORE_SHEET.length, 12, 'a 3×4 grid');
  // the tile calls onNav('settings') directly — one tap, no intermediate page
  assert.match(shell, /\{MOBILE_MORE\.map\(\(\[id, label\]\) => <button key=\{id\} role="menuitem"[^>]*onClick=\{\(\) => \{ onNav\(id\); setMoreOpen\(false\); \}\}/);
  for (const route of ['settings', 'settings/location', 'accessibility', 'accessibility/statement']) assert.equal(Shell.navRootFor(route), 'settings', route);
  assert.equal(Shell.navRootFor('times'), 'times');
  const app = read('NewApp.jsx');
  assert.match(app, /mode==='times' \? <ZmanimPage /, '#times stays the zmanim page');
  assert.match(app, /mode==='settings' \|\| mode\.startsWith\('settings\/'\) \? <SettingsPage route=\{mode\} settings=\{settings\} setSettings=\{setSettings\} theme=\{theme\} setTheme=\{setTheme\} go=\{go\}\/>/, '#settings (an old deep link too) opens the settings page');
  assert.doesNotMatch(app, /mode==='settings' \? <ZmanimPage|mode==='times' \|\| mode==='settings'/);
});

test('the settings page: one title with the ornament, the search, six sections in the owner\'s order, every control named', () => {
  const { default: SettingsPage } = loadJsx('pages/SettingsPage.jsx');
  const html = renderToStaticMarkup(React.createElement(SettingsPage, { route: 'settings', settings: SETTINGS, setSettings() {}, theme: 'sage', setTheme() {}, go() {} }));
  const problems = checkMarkup(html);
  assert.equal(problems.length, 0, formatProblems(problems));
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.match(html, /<h1 id="settings-title">הגדרות<\/h1><span class="title-ornament"/);
  const titles = [...html.matchAll(/<h2 class="settings-section-title"[^>]*>([^<]+)<\/h2>/g)].map(m => m[1]);
  assert.deepEqual(titles, ['נגישות', 'מיקום', 'נוסח', 'ערכת צבעים', 'התראות', 'האתגר העולמי']);
  assert.deepEqual(SETTINGS_SECTIONS.map(section => section.title), titles);
  assert.match(html, /role="search" aria-label="חיפוש בהגדרות"/);
  assert.match(html, /<input[^>]*aria-label="חיפוש בהגדרות"/);
  // נגישות embedded (the full controls, one tap): seven switches of its own
  for (const title of ['התאמה אוטומטית למכשיר', 'גודל טקסט', 'מרווח שורות', 'ניגודיות גבוהה', 'הפחתת תנועה', 'קריאה ממוקדת', 'איפוס להגדרות המכשיר']) assert.ok(html.includes(title), title);
  // מיקום: the place, the residence, the manual place by coordinates (labelled fields)
  const location = html.slice(html.indexOf('id="settings-location"'), html.indexOf('id="settings-nusach"'));
  for (const label of ['שם המקום', 'קו רוחב', 'קו אורך', 'אזור זמן IANA', 'מיקום ידני · קואורדינטות ואזור זמן', 'מעמד הלכתי']) assert.ok(location.includes(label), label);
  assert.match(location, /<label>קו רוחב<input type="number" min="-90" max="90" step="any" required=""/);
  assert.match(location, /<label>קו אורך<input type="number" min="-180" max="180" step="any" required=""/);
  // ערכת צבעים: eight palettes as a radio group, the current one checked
  const themes = [...html.matchAll(/role="radio" aria-checked="(true|false)"[^>]*data-theme-id="(\w+)"/g)];
  assert.deepEqual(themes.map(m => m[2]), ['light', 'dark', 'sage', 'blue', 'plum', 'coral', 'teal', 'amber']);
  assert.deepEqual(themes.filter(m => m[1] === 'true').map(m => m[2]), ['sage']);
  // התראות: a switch for every reminder of המזכיר היהודי, and the screens with the details
  for (const title of ['סוף זמן קריאת שמע', 'מנחה לפני השקיעה', 'הדלקת נרות', 'ספירת העומר', 'לימוד יומי', 'המזכיר היהודי', 'השעון היהודי', 'נר זיכרון']) assert.ok(html.includes(title), title);
  // every search result target exists on the page
  for (const entry of SETTINGS_INDEX) assert.ok(html.includes(`data-setting="${entry.id}"`), entry.id);
});

test('the manual coordinates moved: present in הגדרות › מיקום, gone from זמנים (which keeps "שינוי מיקום")', () => {
  const zmanim = read('pages/ZmanimPage.jsx');
  assert.doesNotMatch(zmanim, /ManualForm|ManualLocationForm|קו רוחב|קו אורך|IANA/);
  assert.match(zmanim, /go\('settings\/location'\)/);
  assert.match(zmanim, />שינוי מיקום</);
  const { default: ZmanimPage } = loadJsx('pages/ZmanimPage.jsx');
  const html = renderToStaticMarkup(React.createElement(ZmanimPage, { solar: { data: null }, settings: SETTINGS, setSettings() {}, go() {} }));
  assert.doesNotMatch(html, /קו רוחב|קו אורך|מיקום ידני/);
  assert.match(html, /שינוי מיקום/);
  const page = read('pages/SettingsPage.jsx');
  assert.match(page, /<div data-setting="location-manual"><ManualLocationForm settings=\{settings\} setSettings=\{setSettings\} \/><\/div>/);
});

test('storage unchanged: the same keys and the same shapes are written', () => {
  const form = read('components/ManualLocationForm.jsx');
  assert.match(form, /new Intl\.DateTimeFormat\('he', \{ timeZone: form\.tzid \}\)\.format\(\);/, 'the time zone is checked first');
  assert.match(form, /setSettings\(s => \(\{ \.\.\.s, location: \{ \.\.\.form, latitude: Number\(form\.latitude\), longitude: Number\(form\.longitude\) \} \}\)\);/);
  assert.match(form, /setFormMessage\('אזור הזמן אינו תקין'\)/);
  const page = read('pages/SettingsPage.jsx');
  assert.match(page, /onChange=\{nusach => setSettings\(s => \(\{ \.\.\.s, nusach \}\)\)\}/);
  assert.match(page, /setSettings\(s => \(\{ \.\.\.s, halachicResidenceStatus: status, residenceChoice: undefined \}\)\)/);
  assert.match(page, /setTheme\(id\)/);
  assert.doesNotMatch(page, /localStorage/, 'the page writes no storage of its own');
  const app = read('NewApp.jsx');
  assert.match(app, /localStorage\.setItem\('kz-theme', theme\)/);
  assert.match(app, /useLocal\('companion-settings-v2',DEFAULT_SETTINGS\)/);
});

test('settings search: each section by the owner\'s words, Hebrew normalised, every word must match', () => {
  const first = query => searchSettings(query)[0]?.section;
  assert.equal(first('מיקום'), 'location');
  assert.equal(first('גופן'), 'accessibility');
  assert.equal(first('צבע'), 'theme');
  assert.equal(first('נוסח'), 'nusach');
  assert.equal(first('התראות'), 'notifications');
  assert.equal(first('ניגודיות'), 'accessibility');
  assert.equal(searchSettings('ניגודיות')[0].id, 'a11y-contrast');
  assert.equal(searchSettings('קו רוחב')[0].id, 'location-manual');
  // niqqud, final letters, gershayim, a one-letter prefix, spelling without matres lectionis
  assert.equal(searchSettings('נֻסַּח')[0]?.id, 'nusach');
  assert.equal(searchSettings('גֹּפֶן')[0]?.id, 'a11y-text');
  assert.equal(searchSettings('הנוסח')[0]?.id, 'nusach');
  assert.equal(searchSettings('בצבע')[0]?.id, 'theme');
  assert.deepEqual(settingsQueryWords('חו״ל'), settingsQueryWords('חול'));
  assert.ok(searchSettings('חו״ל').every(entry => entry.section === 'location'), 'not כחול or אתחול');
  assert.deepEqual(searchSettings(''), []);
  assert.deepEqual(searchSettings('קקקק'), []);
  assert.deepEqual(searchSettings('ניגודיות צבע'), [], 'every word must match');
  const page = read('pages/SettingsPage.jsx');
  assert.match(page, /role="status" aria-live="polite"/, 'the count is announced');
  assert.match(page, /event\.key === 'Enter' && results\[0\]/, 'Enter jumps to the first result');
  assert.match(page, /behavior: stillMotion\(\) \? 'auto' : 'smooth'/, 'no smooth scroll under reduced motion');
  const css = readFileSync(new URL('../src/styles/settings.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.is-found\{animation:none\}\}/);
  assert.match(css, /html\[data-a11y-motion\] \.is-found\{animation:none\}/);
});
