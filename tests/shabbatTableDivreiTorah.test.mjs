import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL('../src/pages/ShabbatTable.jsx', import.meta.url));
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
const shabbatModule = new Module(source);
shabbatModule.filename = source;
shabbatModule.paths = Module._nodeModulePaths(root);
shabbatModule._compile(compiled, source);
const ShabbatTable = shabbatModule.exports.default;
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('the Shabbat table shows the week\'s three divrei torah openly, each with its source', () => {
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, { context: { parasha: { hebrew: 'בראשית' } }, now: new Date('2026-10-05T09:00:00Z') }));
  assert.match(html, /שלושה דברי תורה/);
  assert.equal((html.match(/class="table-divrei-item"/g) || []).length, 3);
  assert.equal((html.match(/<cite>/g) || []).length >= 3, true);
});

test('during a festival week the festival\'s divrei torah replace the parasha', () => {
  const items = [{ category: 'holiday', date: '2026-09-27', title: 'Sukkot II (CH’’M)', hebrew: 'סוכות ב׳ (חוה״מ)' }];
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, { context: { parasha: { hebrew: 'בראשית' } }, items, now: new Date('2026-09-27T09:00:00Z') }));
  assert.match(html, /<h1>סוכות<\/h1>/);
  assert.equal((html.match(/class="table-divrei-item"/g) || []).length, 3);
});

test('a holiday-override Shabbat honestly explains the regular parasha is deferred, instead of silently showing unrelated content', () => {
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, {
    context: { parasha: { hebrew: 'בראשית' }, shabbatReading: { category: 'holiday', hebrew: 'סוכות א׳' } },
  }));
  assert.match(html, /בשבת זו קוראים את קריאת החג/);
  assert.match(html, /סוכות א׳/);
});

test('no content renders an honest "not available" notice rather than fabricated Torah content', () => {
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, { context: { parasha: { hebrew: 'לא קיים' } } }));
  assert.match(html, /אין כרגע תוכן מאומת/);
});

// The focus is the festival ON the Shabbat itself (as the day context says), not the festival of the week before it.
import { torahWeekFocus } from '../src/services/torahSelection.mjs';
import { weeklyDivreiTorah } from '../src/services/weeklyDivreiTorah.mjs';
const holiday = (date, title, hebrew) => ({ category: 'holiday', subcat: 'major', date, title, hebrew });
const sukkot5787Israel = [
  holiday('2026-10-01', 'Sukkot VI (CH’’M)', 'סוכות ו׳ (חוה״מ)'),
  holiday('2026-10-02', 'Sukkot VII (Hoshana Raba)', 'סוכות ז׳ (הושענא רבה)'),
  holiday('2026-10-03', 'Shmini Atzeret', 'שמיני עצרת'),
];

test('Shabbat that is שמיני עצרת (Israel, 2026-10-03): the table, the Shabbat page focus and the library\'s week say שמיני עצרת, not סוכות', () => {
  for (const todayKey of ['2026-09-27', '2026-10-01', '2026-10-02', '2026-10-03']) {
    const focus = torahWeekFocus({ items: sukkot5787Israel, todayKey, parashaName: 'וזאת הברכה' });
    assert.equal(focus.kind, 'holiday', todayKey);
    assert.equal(focus.id, 'shmini-atzeret', todayKey);
    assert.equal(focus.name, 'שמיני עצרת', todayKey);
    assert.equal(weeklyDivreiTorah({ items: sukkot5787Israel, todayKey, parashaName: 'וזאת הברכה' }).id, 'shmini-atzeret', `legacy ${todayKey}`);
  }
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, { context: { parasha: { hebrew: 'וזאת הברכה' } }, items: sukkot5787Israel, now: new Date('2026-10-01T09:00:00Z') }));
  assert.match(html, /<h1>שמיני עצרת<\/h1>/);
  assert.doesNotMatch(html, /<h1>סוכות<\/h1>/);
});

test('diaspora: Shabbat שמיני עצרת (2026-10-03) and שמחת תורה on Sunday — the Shabbat is שמיני עצרת', () => {
  const items = [...sukkot5787Israel, holiday('2026-10-04', 'Simchat Torah', 'שמחת תורה')];
  assert.equal(torahWeekFocus({ items, todayKey: '2026-10-01', parashaName: 'וזאת הברכה' }).id, 'shmini-atzeret');
});

test('Shabbat Chol HaMoed Sukkot (2025-10-11): the focus is סוכות', () => {
  const items = [
    holiday('2025-10-07', 'Sukkot I', 'סוכות א׳'), holiday('2025-10-08', 'Sukkot II (CH’’M)', 'סוכות ב׳ (חוה״מ)'),
    holiday('2025-10-11', 'Sukkot V (CH’’M)', 'סוכות ה׳ (חוה״מ)'), { category: 'holiday', subcat: 'shabbat', date: '2025-10-11', title: 'Shabbat Chol ha-Moed', hebrew: 'שבת חול המועד' },
  ];
  const focus = torahWeekFocus({ items, todayKey: '2025-10-08', parashaName: null });
  assert.equal(focus.id, 'sukkot');
  assert.equal(focus.name, 'סוכות');
  const html = renderToStaticMarkup(React.createElement(ShabbatTable, { context: {}, items, now: new Date('2025-10-08T09:00:00Z') }));
  assert.match(html, /<h1>סוכות<\/h1>/);
});

test('a festival before a plain Shabbat still leads the week; a regular week is the parasha', () => {
  const items = [holiday('2026-10-04', 'Simchat Torah', 'שמחת תורה'), { category: 'parashat', date: '2026-10-10', title: 'Parashat Bereshit', hebrew: 'פרשת בראשית' }];
  assert.equal(torahWeekFocus({ items, todayKey: '2026-10-04', parashaName: 'בראשית' }).kind, 'holiday');
  const regular = torahWeekFocus({ items, todayKey: '2026-10-05', parashaName: 'בראשית' });
  assert.equal(regular.kind, 'parasha');
  assert.equal(regular.name, 'פרשת בראשית');
  assert.equal(regular.shabbatKey, '2026-10-10');
});
