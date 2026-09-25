import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL('../src/pages/TodayPage.jsx', import.meta.url));
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
const todayModule = new Module(source);
todayModule.filename = source;
todayModule.paths = Module._nodeModulePaths(root);
todayModule._compile(compiled, source);
const TodayPage = todayModule.exports.default;
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const resume = [
  { id: 'a', reference: 'Genesis 12:1-3', title: 'בראשית י״ב, א׳–ג׳', status: 'opened' },
  { id: 'b', reference: 'Exodus 3', title: 'שמות · פרק ג׳', status: 'opened' },
  { id: 'c', reference: 'Leviticus 1', title: 'ויקרא · פרק א׳', status: 'opened' },
];

function render(extra = {}) {
  return renderToStaticMarkup(React.createElement(TodayPage, {
    now: new Date('2026-09-24T08:00:00Z'),
    tz: 'Asia/Jerusalem',
    hebrew: 'ה׳ בתשרי תשפ״ז',
    events: [],
    solar: { data: { alotHaShachar: '2026-09-24T04:00:00Z', chatzot: '2026-09-24T10:30:00Z', sunset: '2026-09-24T18:00:00Z' }, loading: false, error: null },
    locationName: 'ירושלים',
    afterSunset: false,
    onNav: () => {},
    context: {},
    settings: { location: { name: 'ירושלים', tzid: 'Asia/Jerusalem' } },
    setSettings: () => {},
    resume,
    onResume: () => {},
    onOpenPrayer: () => {},
    ...extra,
  }));
}

test('Today shows at most 2 learning continuation cards plus 1 smart prayer card', () => {
  const html = render();
  const learningItemCount = (html.match(/class="learning-resume-item[^"]*"/g) || []).length;
  assert.equal(learningItemCount, 3, '2 learning cards + 1 smart prayer card = 3 total');
  assert.equal((html.match(/smart-prayer-card/g) || []).length, 1);
  assert.doesNotMatch(html, />ויקרא/, 'only the first 2 resume items are shown as learning cards');
});

test('the smart prayer card label matches the zmanim-derived prayer for the given time', () => {
  const morning = render();
  assert.match(morning, />שחרית</);
  const afternoon = render({ now: new Date('2026-09-24T13:00:00Z') });
  assert.match(afternoon, />מנחה</);
  const evening = render({ now: new Date('2026-09-24T19:00:00Z') });
  assert.match(evening, />ערבית</);
});

test('a Tanakh chapter resume card shows only the book and chapter, no verse numerals', () => {
  const html = render();
  assert.match(html, /learning-resume-compact/);
  assert.doesNotMatch(html, /י״ב, א׳–ג׳/);
});

test('without onOpenPrayer, the section still renders learning cards but no prayer card', () => {
  const html = render({ onOpenPrayer: undefined });
  assert.doesNotMatch(html, /smart-prayer-card/);
});

test('the Today prayer card carries a small compass that opens the existing prayer compass in one tap', () => {
  const today = readFileSync(fileURLToPath(new URL('../src/pages/TodayPage.jsx', import.meta.url)), 'utf8');
  assert.match(today, /<button type="button" className="smart-prayer-compass" aria-label="כיוון תפילה" onClick=\{\(\) => onNav\('siddur-compass'\)\}><span aria-hidden="true">⌖<\/span><\/button>/);
  const css = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');
  assert.match(css, /\.smart-prayer-compass span\{[^}]*width:28px;height:28px;border:1px solid var\(--line-strong\);border-radius:var\(--radius-sm\);background:var\(--surface\);color:var\(--accent\)/);
  assert.match(css, /\.smart-prayer-wrap>\.smart-prayer-card>span:first-child\{padding-inline-end:30px\}/, 'the label row leaves room for the compass without resizing the card');
});
