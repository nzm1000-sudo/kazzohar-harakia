import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';

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
const { todayDisplayPayload } = todayModule.exports;
const React = require('react');

const baseArgs = {
  now: new Date('2026-09-20T08:00:00.000Z'),
  tz: 'Asia/Jerusalem',
  hebrew: 'ט׳ בתשרי תשפ״ז',
  events: [{ category: 'holiday', hebrew: 'ערב יום כיפור' }],
  context: { parasha: { hebrew: 'פרשת האזינו' }, upcomingHoliday: { hebrew: 'סוכות' } },
};

test('todayDisplayPayload exposes every field TodayPage destructures', () => {
  const payload = todayDisplayPayload(baseArgs);
  for (const field of ['weekday', 'gregorian', 'highlights', 'parashaName', 'upcomingName']) {
    assert.ok(field in payload, `missing ${field}`);
  }
  assert.ok(Array.isArray(payload.highlights));
  assert.deepEqual(payload.highlights, ['ערב יום כיפור']);
  assert.equal(payload.parashaName, 'פרשת האזינו');
  assert.equal(payload.upcomingName, 'סוכות');
});

test('highlights is an array when events are undefined', () => {
  const payload = todayDisplayPayload({ ...baseArgs, events: undefined, context: undefined });
  assert.deepEqual(payload.highlights, []);
  assert.equal(payload.parashaName, undefined);
});

test('TodayPage renders without calendar, zmanim, events or parasha data', () => {
  const html = renderToStaticMarkup(React.createElement(TodayPage, {
    now: baseArgs.now,
    tz: 'Asia/Jerusalem',
    hebrew: null,
    events: undefined,
    solar: { data: null, loading: true, error: null },
    locationName: 'ירושלים',
    afterSunset: false,
    onNav: () => {},
    context: undefined,
    settings: { location: { name: 'ירושלים', tzid: 'Asia/Jerusalem' } },
    setSettings: () => {},
  }));
  assert.match(html, /today-hero/);
  assert.doesNotMatch(html, /app-fallback/);
});
