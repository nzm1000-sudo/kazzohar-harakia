import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL('../src/pages/DebugJewishContextPage.jsx', import.meta.url));
const compiled = buildSync({
  entryPoints: [source],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  loader: { '.jsx': 'jsx' },
  define: {
    'import.meta.env.BASE_URL': '"/"',
    'import.meta.env.VITE_BUILD_ID': '"test"',
    'import.meta.env.VITE_BUILD_TIMESTAMP': '"test"',
    'import.meta.env.VITE_APP_VERSION': '"test"',
  },
  external: ['react', 'react-dom/server'],
}).outputFiles[0].text;
const debugModule = new Module(source);
debugModule.filename = source;
debugModule.paths = Module._nodeModulePaths(root);
debugModule._compile(compiled, source);
const DebugJewishContextPage = debugModule.exports.default;
const React = require('react');

function render(props = {}) {
  return renderToStaticMarkup(React.createElement(DebugJewishContextPage, {
    now: new Date('2026-09-20T08:00:00.000Z'),
    settings: { location: { name: 'Test', latitude: 1, longitude: 2, tzid: 'UTC' }, nusach: 'edot-hamizrach', halachicResidenceStatus: 'israel' },
    solar: { data: { sunset: '2026-09-20T16:00:00.000Z' }, loading: false, error: null },
    calendarResource: { data: [], loading: false, error: null },
    context: { events: [], additions: [], omissions: [], profile: { nusach: 'edot-hamizrach', halachicResidenceStatus: 'israel' }, prayerContext: { type: 'shacharit', omissions: [] }, seasonal: {}, isIsrael: true },
    hebrew: 'תאריך בדיקה',
    todayStr: '2026-09-20',
    ...props,
  }));
}

test('diagnostics renders loading resources', () => {
  const html = render({ solar: { data: null, loading: true }, calendarResource: { data: null, loading: true } });
  assert.match(html, /טוען/);
  assert.doesNotMatch(html, /app-fallback/);
});

test('diagnostics renders resource errors', () => {
  const html = render({ solar: { data: null, loading: false, error: 'zmanim failed' }, calendarResource: { data: null, loading: false, error: 'calendar failed' } });
  assert.match(html, /zmanim failed/);
  assert.match(html, /calendar failed/);
  assert.doesNotMatch(html, /app-fallback/);
});

test('diagnostics renders incomplete context and missing sunset', () => {
  const html = render({ solar: { data: undefined, loading: false }, calendarResource: undefined, context: undefined, settings: undefined });
  assert.match(html, /לא זמין/);
  assert.doesNotMatch(html, /app-fallback/);
});

test('diagnostics renders empty events and missing parasha/source metadata', () => {
  const html = render({ context: { events: undefined, parasha: undefined, additions: undefined, omissions: undefined, prayerContext: undefined, seasonal: undefined, profile: undefined } });
  assert.match(html, /currentEvents/);
  assert.doesNotMatch(html, /app-fallback/);
});

test('diagnostics renders invalid dates and remains serializable', () => {
  const html = render({ now: 'not-a-date', solar: { data: { sunset: 'invalid' }, loading: false } });
  assert.match(html, /לא זמין/);
  assert.doesNotMatch(html, /app-fallback/);
});

test('diagnostics renders when clipboard is unavailable', () => {
  const previousNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: undefined });
  try {
    const html = render();
    assert.match(html, /העתק אבחון/);
    assert.doesNotMatch(html, /app-fallback/);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previousNavigator });
  }
});
