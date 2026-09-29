// Loads a page or component (JSX) for a test, compiled by esbuild the same way tests/commentaryCorpus.test.mjs does.
import { fileURLToPath } from 'node:url';
import { Module } from 'node:module';
import { buildSync } from 'esbuild';

const root = fileURLToPath(new URL('../../', import.meta.url));
export function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false }) }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}
