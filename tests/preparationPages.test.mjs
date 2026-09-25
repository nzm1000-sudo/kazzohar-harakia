import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
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
  { category: 'parashat', date: '2026-09-26', title: 'Parashat Ha’azinu', hebrew: 'פרשת האזינו', leyning: { torah: 'Deuteronomy 32:1-52', haftarah_sephardic: 'II Samuel 22:1-51' } },
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
    assert.match(html, /הכנות לשבת/);
    assert.match(html, /שבת פרשת האזינו/);
    assert.match(html, /ההכנות הבאות/);
    assert.match(html, /הושלמו 0 מתוך 19 הכנות/);
    assert.equal((html.match(/class="prep-task"/g) || []).length, 5, 'the home screen stays focused');
    assert.doesNotMatch(html, /רשימת קניות|אורחים|תפריט/);
    assert.match(html, /זמני השבת/);
    assert.match(html, /הרשימה שלי/);
    assert.match(html, /השבת שלי/);
    assert.match(html, /תזכורות/);
  });
});

test('product wording and shabbat tasks match the remaining requirements', () => {
  const sourceReader = readFileSync(fileURLToPath(new URL('../src/components/SourceReader.jsx', import.meta.url)), 'utf8');
  const talmudPage = readFileSync(fileURLToPath(new URL('../src/pages/TalmudPage.jsx', import.meta.url)), 'utf8');
  const planning = readFileSync(fileURLToPath(new URL('../src/services/preparationPlan.mjs', import.meta.url)), 'utf8');
  assert.doesNotMatch(sourceReader, /סיימתי את המקור|פרטי מקור/);
  assert.doesNotMatch(talmudPage, /סיימתי את הדף|פרטי מקור/);
  for (const task of ['מקרר ומכשירים', 'קודן', 'מנעול חשמלי', 'תאורה אוטומטית', 'כיסים ומכשירים אישיים']) assert.match(planning, new RegExp(task));
});

test('preparation sub-pages render the focused information architecture', () => {
  withMemoryStorage(() => {
    const PreparationHub = loadPage('PreparationHub.jsx');
    const render = route => renderToStaticMarkup(React.createElement(PreparationHub, { route, now, settings, items, onNav: () => {} }));
    const tasks = render('preparation/tasks');
    for (const group of ['לפני שבת', 'בית וסעודות', 'אישי ומשפחה', 'הכנה רוחנית']) assert.match(tasks, new RegExp(group));
    assert.match(tasks, /משימה אישית/);
    assert.match(render('preparation/times'), /הדלקת נרות/);
    assert.match(render('preparation/shabbat'), /שמואל ב כ״ב, א׳–נ״א/);
    assert.match(render('preparation/spiritual'), /שניים מקרא ואחד תרגום/);
    const reminders = render('preparation/reminders');
    assert.match(reminders, /תזכורות לשבת/);
    assert.match(reminders, /בחר מתי להזכיר לך ומה חשוב שלא יישכח לפני שבת/);
    assert.match(reminders, /הפעל תזכורות/, 'reminders start opt-in');
    for (const time of ['יום שישי בבוקר', 'שעתיים לפני הדלקת נרות', 'שעה לפני הדלקת נרות', 'זמן נוסף']) assert.match(reminders, new RegExp(time));
    for (const topic of ['נרות שבת', 'פלטה ומיחם', 'שעוני שבת וחשמל', 'בית וסעודות', 'הכנות אישיות ומשפחה', 'הכנה רוחנית']) assert.match(reminders, new RegExp(topic));
    assert.match(reminders, /אין תזכורות פעילות/);
    assert.doesNotMatch(reminders, /מצב שקט|מתוזמן כעת|שליחת תזכורת בדיקה|אישור מפורש/);
  });
});

test('legacy shopping guest and menu routes have no user-facing entry point', () => {
  withMemoryStorage(() => {
    const PreparationHub = loadPage('PreparationHub.jsx');
    for (const route of ['preparation/shopping', 'preparation/guests', 'preparation/menu']) {
      const html = renderToStaticMarkup(React.createElement(PreparationHub, { route, now, settings, items, onNav: () => {} }));
      assert.match(html, /הכנות לשבת/);
      assert.doesNotMatch(html, /רשימת קניות|אורחים|תפריט/);
    }
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
  assert.match(html, /דברי תורה לפרשה/);
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
    assert.doesNotMatch(html, /אורחים|תפריט/);
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

test('the Shabbat page shows the restored preparation checklist, grouped and interactive, with its reminders', () => {
  withMemoryStorage(map => {
    const ShabbatPage = loadPage('ShabbatPage.jsx');
    const html = renderToStaticMarkup(React.createElement(ShabbatPage, { now, settings, items, context }));
    assert.match(html, /<section class="shabbat-checklist" aria-label="הכנות לשבת">/);
    const titles = ['נרות שבת', 'פלטה ומיחם', 'מקרר ומכשירים', 'קודן', 'מנעול חשמלי', 'תאורה אוטומטית', 'כיסים ומכשירים אישיים', 'הכנת האוכל', 'חלות', 'יין או מיץ ענבים', 'שולחן שבת', 'רחצה והכנה אישית', 'בגדי שבת ונעליים', 'הכנת הילדים', 'צרכים אישיים לפני שבת', 'שניים מקרא ואחד תרגום', 'פרשת השבוע', 'הכנת דבר תורה', 'זמני תפילות והכנה לקבלת שבת'];
    for (const title of titles) assert.match(html, new RegExp(`<span class="prep-task-title">${title}</span>`), title);
    assert.equal((html.match(/type="checkbox"/g) || []).length, 19, 'every current item has a checkbox');
    assert.deepEqual([...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(match => match[1]), ['לפני שבת', 'בית וסעודות', 'אישי ומשפחה', 'הכנה רוחנית']);
    assert.match(html, /href="#preparation\/reminders"/);
    assert.match(html, /href="#preparation\/tasks"/);
    assert.equal(map.size, 0, 'rendering does not reset or write stored state');
  });
  const app = readFileSync(fileURLToPath(new URL('../src/NewApp.jsx', import.meta.url)), 'utf8');
  assert.match(app, /mode==='preparation' \|\| mode\.startsWith\('preparation\/'\) \? <PreparationHub route=\{mode\}/, 'the preparation hub, its reminders and scheduling are routed again');
});
