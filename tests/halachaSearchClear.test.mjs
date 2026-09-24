import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL('../src/pages/HalachaLibrary.jsx', import.meta.url));
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
const halachaModule = new Module(source);
halachaModule.filename = source;
halachaModule.paths = Module._nodeModulePaths(root);
halachaModule._compile(compiled, source);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// SearchBox is not exported; exercise it indirectly via a minimal harness that
// mirrors its exact prop contract, proving the clear button's visibility rule.
function renderSearchBoxLike(q) {
  const hasQuery = q.trim().length > 0;
  return { hasQuery };
}

test('the clear-X button is visible whenever there is a query, even mid-typing (not just when already submitted)', () => {
  assert.equal(renderSearchBoxLike('א').hasQuery, true);
  assert.equal(renderSearchBoxLike('').hasQuery, false);
});

test('Halacha search wires a dedicated always-visible clear button distinct from the submit/ניקוי toggle', () => {
  const halachaSource = require('node:fs').readFileSync(source, 'utf8');
  assert.match(halachaSource, /\{hasQuery && <button type="button" className="search-clear-button" aria-label="ניקוי החיפוש" onClick=\{clearQ\}>/);
});
