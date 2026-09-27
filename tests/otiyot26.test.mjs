// אותיות 26 — the author's ideas, word for word, each a card of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { OTIYOT, OTIYOT_SERIES, OTIYOT_AUTHOR } from '../src/data/otiyot26.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
const source = fileURLToPath(new URL('../src/pages/OtiyotPage.jsx', import.meta.url));
const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx' }, jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
const loaded = new Module(source); loaded.filename = source; loaded.paths = Module._nodeModulePaths(root); loaded._compile(compiled, source);
const OtiyotPage = loaded.exports.default;
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('eighteen ideas in three series, each with its own words, no empty or duplicate idea', () => {
  assert.equal(OTIYOT.length, 18);
  assert.equal(new Set(OTIYOT.map(idea => idea.id)).size, 18);
  for (const idea of OTIYOT) {
    assert.ok(OTIYOT_SERIES.some(series => series.id === idea.series), idea.id);
    assert.ok(idea.lines.filter(Boolean).length >= 3, idea.id);
    assert.notEqual(idea.lines[0], '', `${idea.id} starts with words`);
  }
  assert.equal(OTIYOT_AUTHOR, 'ש״י ברבי');
});

test('the collection shows every idea as a card by series; an idea opens as a full card with symmetric paging', () => {
  const list = renderToStaticMarkup(React.createElement(OtiyotPage, { route: 'otiyot', go() {} }));
  assert.match(list, /<h1>אותיות 26<\/h1>/);
  assert.equal((list.match(/class="otiyot-card otiyot-card-preview/g) || []).length, 18);
  for (const series of OTIYOT_SERIES) assert.match(list, new RegExp(`<h2>${series.title}</h2>`));
  const reader = renderToStaticMarkup(React.createElement(OtiyotPage, { route: 'otiyot/ima', go() {} }));
  assert.match(reader, /אמא: גם וגם/);
  assert.match(reader, /אולי, בעצם, גם וגם\?/);
  assert.equal((reader.match(/<p>/g) || []).length, 5, 'five stanzas');
  assert.match(reader, /הקודם/);
  assert.match(reader, /הבא/);
  assert.match(reader, /מתוך/);
});
