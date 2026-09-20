import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const React = require('react');

function loadPage(relative) {
  const source = fileURLToPath(new URL(`../src/pages/${relative}`, import.meta.url));
  const compiled = buildSync({
    entryPoints: [source],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    loader: { '.jsx': 'jsx' },
    jsx: 'automatic',
    define: { 'import.meta.env.BASE_URL': '"/"' },
    external: ['react', 'react/jsx-runtime', 'react-dom/server'],
  }).outputFiles[0].text;
  const pageModule = new Module(source);
  pageModule.filename = source;
  pageModule.paths = Module._nodeModulePaths(root);
  pageModule._compile(compiled, source);
  return pageModule.exports.default;
}

function withMemoryStorage(run) {
  const map = new Map();
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: key => map.delete(key),
    },
  });
  try { return run(map); }
  finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original }); }
}

const settings = { location: { name: 'ירושלים', tzid: 'Asia/Jerusalem', latitude: 31.78, longitude: 35.22 } };
const now = new Date('2026-09-24T09:00:00Z');
const items = [
  { category: 'candles', date: '2026-09-25T18:12:00+03:00' },
  { category: 'havdalah', date: '2026-09-26T19:10:00+03:00' },
];
const context = {
  parasha: { hebrew: 'בראשית' },
  additions: [{ text: 'יעלה ויבוא' }],
  prayerContext: { omissions: [{ text: 'אין אומרים תחנון' }] },
  torahReading: { sourceRef: 'Genesis 1:1-6:8', maftir: 'Genesis 6:5-6:8', haftara: 'Isaiah 42:5-43:10' },
};

test('preparation hub renders offline with no stored data', () => {
  withMemoryStorage(() => {
    const PreparationHub = loadPage('PreparationHub.jsx');
    const html = renderToStaticMarkup(React.createElement(PreparationHub, { route: 'preparation', now, settings, items, onNav: () => {} }));
    assert.match(html, /הכנה ל/);
    assert.match(html, /רשימת קניות/);
    assert.match(html, /אורחים/);
    assert.match(html, /תפריט/);
    assert.match(html, /תזכורות/);
  });
});

test('preparation sub-pages render and reflect stored data', () => {
  withMemoryStorage(() => {
    const PreparationHub = loadPage('PreparationHub.jsx');
    const render = route => renderToStaticMarkup(React.createElement(PreparationHub, { route, now, settings, items, onNav: () => {} }));
    assert.match(render('preparation/tasks'), /נרות שבת/);
    assert.match(render('preparation/shopping'), /רשימת קניות/);
    assert.match(render('preparation/guests'), /אינה ניגשת לאנשי הקשר/);
    assert.match(render('preparation/menu'), /ליל שבת/);
    const reminders = render('preparation/reminders');
    assert.match(reminders, /הפעלת תזכורות/, 'reminders start opt-in');
    assert.match(reminders, /רק בהפעלה יזומה/);
  });
});

test('preparation hub survives missing calendar and location data', () => {
  withMemoryStorage(() => {
    const PreparationHub = loadPage('PreparationHub.jsx');
    const html = renderToStaticMarkup(React.createElement(PreparationHub, { route: 'preparation', now, settings: undefined, items: undefined, onNav: () => {} }));
    assert.match(html, /הכנה/);
  });
});

test('forgotten addition tool renders the topic list without a network call', () => {
  const ForgottenAddition = loadPage('ForgottenAddition.jsx');
  const html = renderToStaticMarkup(React.createElement(ForgottenAddition));
  assert.match(html, /שכחתי תוספת/);
  assert.match(html, /שכחתי יעלה ויבוא/);
  assert.match(html, /שכחתי עננו/);
});

test('Shabbat table renders verified content and degrades when unavailable', () => {
  const ShabbatTable = loadPage('ShabbatTable.jsx');
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, { context }));
  assert.match(html, /בראשית/);
  assert.match(html, /שאלה לשולחן/);
  assert.match(html, /חידון/);

  const missing = renderToStaticMarkup(React.createElement(ShabbatTable, { context: { parasha: { hebrew: 'לא קיימת' } } }));
  assert.match(missing, /אין כרגע תוכן מאומת/);
  assert.doesNotMatch(missing, /חידון/);
});

test('Daf Shabbat renders the consolidated view with wall and print controls', () => {
  withMemoryStorage(() => {
    const ShabbatPage = loadPage('ShabbatPage.jsx');
    const html = renderToStaticMarkup(React.createElement(ShabbatPage, { now, settings, items, context }));
    assert.match(html, /דף שבת/);
    assert.match(html, /הדלקת נרות/);
    assert.match(html, /הפטרה/);
    assert.match(html, /יעלה ויבוא/);
    assert.match(html, /תצוגת קיר/);
    assert.match(html, /הדפסה/);
    assert.match(html, /no-print/, 'controls are hidden when printing');
  });
});

test('Daf Shabbat renders when calendar and context data are missing', () => {
  withMemoryStorage(() => {
    const ShabbatPage = loadPage('ShabbatPage.jsx');
    const html = renderToStaticMarkup(React.createElement(ShabbatPage, { now, settings: undefined, items: undefined, context: undefined }));
    assert.match(html, /דף שבת/);
    assert.match(html, /לא זמין/);
  });
});
