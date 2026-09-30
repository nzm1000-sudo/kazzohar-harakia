// Previous / next are docked in one fixed place at the top of every reading — in the app header, where the search
// makes room for them — never floating over the text. The owner found Birkat HaMazon's bar floating (it had been left
// out of a hand-kept list of references that received the header slot); the slot is now always there, and every
// reader with previous / next claims it through services/dockedNav.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { registerDockedNav, dockedNavOwner, hasDockedNav } from '../src/services/dockedNav.mjs';
import { COMPOSITIONS } from '../src/data/nusach/compositions/index.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { composeRiteService, riteServiceReference } from '../src/services/prayer/riteServiceComposer.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/styles/base.css');

// One bundle, so the header, the bars and the store share one dockedNav instance (as in the app).
function loadBundle() {
  const contents = [
    "export { default as Shell } from './components/Shell.jsx';",
    "export { default as ReaderNavigation, ReaderDock } from './components/ReaderNavigation.jsx';",
    "export { default as PrayerSectionNav } from './components/PrayerSectionNav.jsx';",
    "export { default as RiteServiceReader } from './components/RiteServiceReader.jsx';",
    "export * from './services/dockedNav.mjs';",
  ].join('\n');
  const compiled = buildSync({ stdin: { contents, resolveDir: srcDir, loader: 'jsx', sourcefile: 'docked-entry.jsx' }, bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx', '.json': 'json' }, jsx: 'automatic', define: { 'import.meta.env.BASE_URL': '"/"' }, external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/server', '@capacitor/*'], logLevel: 'silent' }).outputFiles[0].text;
  const filename = join(srcDir, 'docked-entry.cjs');
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, filename);
  return loaded.exports;
}
const bundle = loadBundle();
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const html = (component, props) => renderToStaticMarkup(React.createElement(component, props));

test('the store: a bar with a contents list outranks a bare previous / next; release gives the header back', () => {
  assert.equal(hasDockedNav(), false);
  const pair = registerDockedNav(0);
  assert.equal(dockedNavOwner(), pair.id);
  const sections = registerDockedNav(1);
  const endLinks = registerDockedNav(0);
  assert.equal(dockedNavOwner(), sections.id, 'a prayer flow keeps the header over its own end-of-reading links');
  sections.release();
  assert.equal(dockedNavOwner(), endLinks.id);
  endLinks.release(); pair.release();
  assert.equal(hasDockedNav(), false);
  assert.equal(dockedNavOwner(), 0);
});

test('the header always offers the docked slot; the search makes room only while a reading is docked', () => {
  const { Shell, registerDockedNav: register } = bundle;
  const props = { page: 'siddur', onNav: () => {}, query: '', setQuery: () => {}, theme: 'light', setTheme: () => {} };
  const idle = html(Shell, props);
  assert.match(idle, /חיפוש בספרייה/);
  assert.match(idle, /<div class="head-prayer-slot" id="kz-head-prayer-slot" hidden="">/);
  const reading = register(0);
  const docked = html(Shell, props);
  reading.release();
  assert.doesNotMatch(docked, /חיפוש בספרייה/);
  assert.match(docked, /<div class="head-prayer-slot" id="kz-head-prayer-slot"><\/div>/);
  assert.match(docked, /shell-head-safe[^"]* is-docked/);
  assert.match(css, /\.head-prayer-slot\[hidden\]\{display:none\}/);
  const app = read('../src/NewApp.jsx');
  assert.doesNotMatch(app, /prayerMode/, 'no hand-kept list of references decides who is docked (Birkat HaMazon was missing from it)');
  assert.doesNotMatch(read('../src/components/Shell.jsx'), /prayerMode/);
});

test('one shared bar: previous and next of equal width, centred as a unit, portaled into the header', () => {
  const nav = read('../src/components/PrayerSectionNav.jsx');
  assert.equal((nav.match(/createPortal\((?:nav|pair), slot\)/g) || []).length, 2, 'both forms of the bar go to the header slot');
  assert.match(nav, /registerDockedNav\(/);
  assert.match(css, /\.prayer-nav-bar\{display:inline-grid;grid-template-columns:1fr auto 1fr;/);
  assert.match(css, /\.prayer-nav-bar\.is-pair\{grid-template-columns:1fr 1fr\}/);
  assert.match(css, /\.prayer-nav-bar button\{display:inline-flex;align-items:center;justify-content:center;/);
  assert.match(css, /\.head-prayer-slot\{position:relative;min-width:0;flex:1;display:flex;justify-content:center\}/);
  assert.match(css, /\.prayer-nav-bar button::after\{inset:-6px 0\}/, 'the 32px buttons keep a 44px touch target');
});

test('ReaderDock: "הקודם: <title>" / "הבא: <title>", a labelled nav landmark, the missing side disabled', () => {
  const { ReaderDock } = bundle;
  const markup = html(ReaderDock, { previous: { title: 'תהילים פרק א׳' }, next: { title: 'תהילים פרק ג׳' }, onSelect: () => {}, label: 'ניווט בין פרקי התהילים' });
  assert.match(markup, /<nav class="prayer-nav-bar is-pair" aria-label="ניווט בין פרקי התהילים">/);
  assert.match(markup, /aria-label="הקודם: תהילים פרק א׳"/);
  assert.match(markup, /aria-label="הבא: תהילים פרק ג׳"/);
  const first = html(ReaderDock, { previous: null, next: { title: 'ב' }, onSelect: () => {} });
  assert.match(first, /<button type="button" disabled="">.*הקודם<\/button>/);
  assert.equal(html(ReaderDock, { previous: null, next: null, onSelect: () => {} }), '', 'nothing to dock at a single reading');
});

// Every reader that has previous / next (the end-of-reading cards) also docks them at the top.
const READERS = {
  'Tehillim.jsx': /<ReaderDock previous=/,
  'components/SourceReader.jsx': /<ReaderDock previous=\{navigation\.previous\}/,
  'pages/LibraryPage.jsx': /<ReaderDock previous=\{neighbors\.previous\}/,
  'pages/ShalomRavPage.jsx': /<ReaderDock previous=\{previous\}/,
  'pages/ZemirotPage.jsx': /<ReaderDock previous=/,
  'pages/HalachaLibrary.jsx': /<ReaderDock previous=\{neighbours\.previous\}/,
  'pages/OtiyotPage.jsx': /<ReaderDock previous=\{dockItem\(previous\)\}/,
  'pages/TalmudPage.jsx': /<PrayerSectionNav title=\{`מסכת /,
};
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? (entry.name.startsWith('.') ? [] : walk(join(dir, entry.name))) : [join(dir, entry.name)]));

test('every reader with previous / next uses the shared docked bar — none is left floating', () => {
  const users = walk(srcDir).filter(file => /\.jsx$/.test(file)).map(file => file.slice(srcDir.length + 1))
    .filter(file => /<ReaderNavigation |<PrayerSectionNav /.test(readFileSync(join(srcDir, file), 'utf8')) && !/^components\/(ReaderNavigation|PrayerSectionNav)\.jsx$/.test(file));
  for (const file of users) {
    const source = readFileSync(join(srcDir, file), 'utf8');
    if (/<ReaderNavigation /.test(source)) assert.ok(READERS[file], `${file} has end-of-reading links: it must dock them too`);
    if (READERS[file]) assert.match(source, READERS[file], file);
  }
  for (const file of ['components/ComposedPrayerReader.jsx', 'components/DayServiceReader.jsx', 'components/RiteServiceReader.jsx', 'components/SourceReader.jsx', 'pages/TalmudPage.jsx']) assert.ok(users.includes(file), `${file} uses the shared bar`);
  assert.match(read('../src/pages/OtiyotPage.jsx'), /<ReaderDock /);
  assert.match(css, /\.otiyot-pager button\{min-height:44px;min-width:5\.75em;/, 'Otiyot\'s end pager: previous and next of one width');
  assert.doesNotMatch(read('../src/Tehillim.jsx'), /changeChapter\(safeChapter - 1\)\} style=/, 'Tehillim\'s inline previous / next gave way to the docked bar');
});

test('Birkat HaMazon: every rite composes several sections and docks its bar from the first paint', async () => {
  const now = new Date('2026-10-13T12:00:00+03:00');
  const settings = { location: { latitude: 31.778, longitude: 35.235, tzid: 'Asia/Jerusalem', name: 'ירושלים' }, halachicResidenceStatus: 'israel', il: true };
  const context = JewishContextEngine({ now, settings, times: {}, prayerType: 'shacharit' });
  const rites = Object.keys(COMPOSITIONS).filter(nusach => COMPOSITIONS[nusach].services?.['birkat-hamazon']);
  assert.ok(rites.length >= 3, rites.join());
  for (const nusach of rites) {
    const pack = await loadSiddur(nusach);
    const doc = composeRiteService({ composition: COMPOSITIONS[nusach], serviceId: 'birkat-hamazon', texts: pack.texts, context, mode: 'prayer' });
    assert.ok(doc.sections.filter(section => section.title).length > 1, `${nusach}: Birkat HaMazon has sections, so it has הקודם | תוכן | הבא`);
  }
  const reader = read('../src/components/RiteServiceReader.jsx');
  assert.match(reader, /\{\(titled\.length > 1 \|\| !document\) && <PrayerSectionNav pending=\{!document\}/);
  const { RiteServiceReader } = bundle;
  const markup = html(RiteServiceReader, { reference: riteServiceReference('ashkenaz', 'birkat-hamazon'), settings, now });
  assert.match(markup, /<nav class="prayer-nav-bar" aria-label="ניווט בתוך התפילה" aria-busy="true">/, 'the bar holds its place while the prayer is composed');
  assert.ok(markup.indexOf('prayer-nav-bar') < markup.indexOf('siddur-heading'), 'at the top, never mid-content');
});
