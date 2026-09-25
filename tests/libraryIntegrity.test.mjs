import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import PACK_INDEX from '../src/data/library/packIndex.mjs';
import IMPORT_REPORTS from '../src/data/library/importReports.mjs';
import { ACQUISITION_QUEUE, COVERAGE, EDITIONS, LICENSES, PUBLIC_WORKS, SOURCES, TAXONOMY, WORKS, categoryById, licenseIdFor, registryAudit, workById, worksInCategory } from '../src/data/library/registry.mjs';
import { validateWorkChunk } from '../src/services/library/integrity.mjs';
import { resolveLibraryReference, searchChunk, searchWorks } from '../src/services/library/search.mjs';
import { downloadEdition, downloadState, loadEditionChunk, readDownloads, removeEdition, verifyChunkText } from '../src/services/library/packs.mjs';
import { isBookmarked, readPersonal, rememberPosition, toggleBookmark, toggleFavorite } from '../src/services/library/personal.mjs';
import { normalizeForSearch } from '../src/hebrewText.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const packFile = (packId, file) => readFileSync(fileURLToPath(new URL(`../public/library/packs/${packId}/${file}`, import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');
const memoryStore = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) }; };
const chunkOf = workId => { const edition = workById(workId).editions[0]; return verifyChunkText(packFile(edition.packId, edition.file), edition); };

test('full-library validator: every published pack re-validates from disk against its independent expected structure', () => {
  const reports = [];
  for (const pack of PACK_INDEX) {
    const manifest = JSON.parse(packFile(pack.packId, 'manifest.json'));
    assert.equal(manifest.files.length, pack.works.length, `${pack.packId}: manifest lists every work`);
    for (const work of pack.works) {
      const edition = workById(work.workId).editions[0];
      const chunk = verifyChunkText(packFile(pack.packId, work.file), edition);
      const report = validateWorkChunk(chunk, work.expected.map((units, index) => ({ n: index + 1, units })));
      assert.equal(report.status, work.status, work.workId);
      assert.deepEqual([report.duplicateIds, report.emptyUnits, report.invalidRefs, report.unexpectedUnits, report.orderErrors], [[], [], [], [], []], work.workId);
      reports.push(report);
    }
  }
  const full = reports.filter(report => report.status === COVERAGE.FULL);
  const partial = reports.filter(report => report.status === COVERAGE.PARTIAL);
  assert.equal(reports.length, 185);
  assert.equal(full.length, 168);
  assert.equal(partial.length, 17, 'real gaps in the named editions stay PARTIAL');
  assert.deepEqual(partial.find(report => report.workId === 'Mishnah_Bikkurim').missingUnits, ['Mishnah_Bikkurim.4.1', 'Mishnah_Bikkurim.4.2', 'Mishnah_Bikkurim.4.3', 'Mishnah_Bikkurim.4.4', 'Mishnah_Bikkurim.4.5']);
  const tanakh = reports.filter(report => workById(report.workId).primaryCategory === 'tanakh');
  assert.equal(tanakh.length, 39);
  assert.equal(tanakh.reduce((total, report) => total + report.importedUnits, 0), 23213, 'UXLC verse total');
  const mishnah = reports.filter(report => workById(report.workId).primaryCategory === 'mishnah');
  assert.equal(mishnah.length, 63);
  assert.equal(mishnah.reduce((total, report) => total + report.expectedUnits, 0), 4192, 'Sefaria Mishnah shape total');
  assert.equal(mishnah.reduce((total, report) => total + report.importedUnits, 0), 4187);
  const family = id => reports.filter(report => workById(report.workId).primaryCategory === id);
  assert.equal(family('rambam').length, 79);
  assert.equal(reports.filter(report => report.workId.startsWith('Shulchan_Arukh__')).length, 4);
  assert.equal(reports.filter(report => report.workId.startsWith('Shulchan_Arukh__')).reduce((total, report) => total + report.expectedUnits, 0), 13409, 'Sefaria shape: OC 4183 + YD 3702 + EH 1830 + CM 3694');
  assert.deepEqual(IMPORT_REPORTS.summary, { works: 185, full: 168, partial: 17, expectedUnits: 55489, importedUnits: 55415, missingUnits: 74, duplicateIds: 0, emptyUnits: 0, invalidRefs: 0, unexpectedUnits: 0, orderErrors: 0 });
});

test('canonical unit IDs are unique across the whole library and follow Work.node.unit', () => {
  const seen = new Set();
  for (const pack of PACK_INDEX) for (const work of pack.works) {
    for (const node of chunkOf(work.workId).nodes) for (const unit of node.units) {
      assert.match(unit.id, /^[A-Z][A-Za-z_]*\.\d+\.\d+$/);
      assert.equal(seen.has(unit.id), false, unit.id);
      seen.add(unit.id);
    }
  }
  assert.equal(seen.size, 55415);
  assert.ok(seen.has('Genesis.1.1') && seen.has('Mishnah_Berakhot.1.1') && seen.has('Pirkei_Avot.1.1'));
});

test('the integrity validator refuses FULL for missing, duplicate, empty, markup and out-of-order units', () => {
  const chunk = { workId: 'Genesis', nodes: [{ id: 'Genesis.1', n: 1, units: [{ id: 'Genesis.1.1', n: 1, text: 'א' }, { id: 'Genesis.1.2', n: 2, text: 'ב' }] }] };
  const expected = [{ n: 1, units: 2 }];
  assert.equal(validateWorkChunk(chunk, expected).status, COVERAGE.FULL);
  assert.deepEqual(validateWorkChunk(chunk, [{ n: 1, units: 3 }]).missingUnits, ['Genesis.1.3']);
  const bad = (units) => validateWorkChunk({ workId: 'Genesis', nodes: [{ id: 'Genesis.1', n: 1, units }] }, expected);
  assert.equal(bad([{ id: 'Genesis.1.1', n: 1, text: 'א' }, { id: 'Genesis.1.1', n: 1, text: 'א' }]).status, COVERAGE.PARTIAL);
  assert.deepEqual(bad([{ id: 'Genesis.1.1', n: 1, text: ' ' }, { id: 'Genesis.1.2', n: 2, text: 'ב' }]).emptyUnits, ['Genesis.1.1']);
  assert.deepEqual(bad([{ id: 'Genesis.1.1', n: 1, text: '<x>t</x>' }, { id: 'Genesis.1.2', n: 2, text: 'ב' }]).invalidRefs, ['Genesis.1.1:markup']);
  assert.deepEqual(bad([{ id: 'Genesis.1.2', n: 2, text: 'ב' }, { id: 'Genesis.1.1', n: 1, text: 'א' }]).orderErrors.length > 0, true);
  assert.equal(validateWorkChunk({ workId: 'Genesis', nodes: [] }, expected).status, COVERAGE.UNAVAILABLE);
});

test('UXLC import keeps ketiv/qere and section markers that the older corpus silently dropped', () => {
  const genesis = chunkOf('Genesis');
  assert.match(genesis.nodes[7].units[16].text, /\(הוצא\) \[הַיְצֵ֣א\]/, 'Genesis 8:17 ketiv and qere');
  assert.match(chunkOf('Ruth').nodes[2].units[4].text, /\[אֵלַ֖י\]/, 'Ruth 3:5 qere without ketiv');
  assert.equal((chunkOf('Deuteronomy').nodes[4].units[20].text.match(/\{ס\}/g) || []).length, 2, 'Deuteronomy 5:21 keeps both setumot');
  assert.equal(normalizeForSearch(genesis.nodes[0].units[0].text).split(' ').slice(0, 2).join(' '), 'בראשית ברא');
  const markup = PACK_INDEX.flatMap(pack => pack.works).filter(work => /[<>]/.test(packFile(workById(work.workId).editions[0].packId, work.file).replace(/"[^"]*":/g, '')));
  assert.deepEqual(markup, [], 'no source markup reaches published text');
  assert.equal(IMPORT_REPORTS.discrepancies.length, 3, 'numbering differences are documented, not corrected');
  assert.deepEqual(IMPORT_REPORTS.discrepancies.map(item => item.node).sort(), ['Deuteronomy.5', 'Exodus.20', 'Numbers.25']);
});

test('multi-source validation: the Mishnah pack matches the previously bundled copy unit-by-unit and exposes its mixed edition', () => {
  const cross = IMPORT_REPORTS.crossChecks.mishnah;
  assert.equal(cross.identical, 4187);
  assert.equal(cross.differing, 0);
  assert.deepEqual(cross.onlyInBundled, ['Mishnah_Bikkurim.4.1', 'Mishnah_Bikkurim.4.2', 'Mishnah_Bikkurim.4.3', 'Mishnah_Bikkurim.4.4', 'Mishnah_Bikkurim.4.5']);
});

test('source and license registry: every edition has a provider, a known license entry and explicit rights', () => {
  for (const edition of EDITIONS) {
    assert.ok(edition.sourceProvider, edition.editionId);
    assert.ok(LICENSES[edition.license], `${edition.editionId}: ${edition.license}`);
    for (const key of ['redistributionAllowed', 'offlineAllowed', 'commercialUseAllowed', 'modificationAllowed']) assert.ok([true, false, 'UNKNOWN'].includes(LICENSES[edition.license][key]), key);
  }
  for (const pack of PACK_INDEX) {
    assert.ok(SOURCES[pack.source], pack.packId);
    assert.equal(LICENSES[pack.license].offlineAllowed, true, `${pack.packId} is distributable offline`);
    assert.ok(pack.edition.title && pack.retrievedAt && pack.contentVersion);
  }
  assert.equal(licenseIdFor('Public Domain'), 'public-domain');
  assert.equal(licenseIdFor('CC-BY-NC'), 'cc-by-nc');
  assert.equal(licenseIdFor('CC BY-NC-SA 2.5'), 'cc-by-nc-sa');
  assert.equal(licenseIdFor('unknown'), 'unknown');
  assert.equal(licenseIdFor(null), 'unknown');
  const unknownPublic = PUBLIC_WORKS.filter(work => work.kind === 'legacy' && work.license === 'unknown');
  assert.deepEqual(unknownPublic, [], 'LICENSE_UNKNOWN books stay out of the public library');
  assert.ok(ACQUISITION_QUEUE.every(item => ['AVAILABLE_OPEN', 'PERMISSION_REQUIRED', 'METADATA_ONLY', 'NOT_FOUND'].includes(item.status) && item.evidence));
});

test('FULL is only granted to validated packs; legacy flat books are never presented as FULL', () => {
  for (const work of WORKS) {
    if (work.coverage === COVERAGE.FULL) {
      assert.equal(work.kind, 'pack', work.workId);
      assert.equal(IMPORT_REPORTS.reports.find(report => report.workId === work.workId).status, COVERAGE.FULL);
    }
    if (work.kind === 'legacy') assert.equal(work.coverage, COVERAGE.PARTIAL);
    if (work.kind === 'remote') assert.ok([COVERAGE.REMOTE_ONLY, COVERAGE.PARTIAL].includes(work.coverage));
  }
  const audit = registryAudit();
  assert.deepEqual(audit.duplicateWorkIds, []);
  assert.deepEqual(audit.uncategorized, []);
  assert.deepEqual(audit.missingSources, []);
  assert.equal(audit.byCoverage.FULL, 168);
});

test('taxonomy is hierarchical and ordered traditionally, with multi-category placement', () => {
  const ids = TAXONOMY.map(category => category.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(categoryById('tanakh').groups.map(([id]) => id), ['torah', 'neviim-rishonim', 'neviim-acharonim', 'ketuvim']);
  assert.deepEqual(categoryById('mishnah').groups.map(([id]) => id), ['zeraim', 'moed', 'nashim', 'nezikin', 'kodashim', 'tahorot']);
  const tanakh = worksInCategory('tanakh');
  assert.equal(tanakh[0].workId, 'Genesis');
  assert.deepEqual(tanakh.filter(work => work.group === 'torah').map(work => work.workId), ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']);
  assert.deepEqual(tanakh.filter(work => work.group === 'neviim-rishonim').map(work => work.workId), ['Joshua', 'Judges', 'I_Samuel', 'II_Samuel', 'I_Kings', 'II_Kings']);
  assert.equal(worksInCategory('mishnah').find(work => work.group === 'zeraim').workId, 'Mishnah_Berakhot');
  assert.ok(worksInCategory('rishonim').some(work => work.workId === 'legacy.chovot-halevavot'), 'secondary category placement');
  assert.ok(worksInCategory('halacha').some(work => work.tags.includes('sephardic')));
});

test('reference resolution reaches the exact unit and never guesses', () => {
  const resolve = query => resolveLibraryReference(query, PUBLIC_WORKS);
  assert.deepEqual(resolve('בראשית א א'), { kind: 'pack', workId: 'Genesis', node: 1, unit: 1, label: 'בראשית' });
  assert.deepEqual(resolve('בְּרֵאשִׁית א׳, ב׳'), { kind: 'pack', workId: 'Genesis', node: 1, unit: 2, label: 'בראשית' });
  assert.equal(resolve('בראשית 1 2').unit, 2);
  assert.deepEqual([resolve('שמואל א ג ד').workId, resolve('שמואל א ג ד').node], ['I_Samuel', 3]);
  assert.equal(resolve('תהילים קיט').node, 119);
  assert.equal(resolve('בראשית נא'), null, 'Genesis has 50 chapters');
  assert.equal(resolve('בראשית א לב'), null, 'Genesis 1 has 31 verses');
  assert.equal(resolve('ברכות ב א').route, 'talmud/Berakhot/2a');
  assert.deepEqual([resolve('משנה ברכות א ב').workId, resolve('משנה ברכות א ב').unit], ['Mishnah_Berakhot', 2]);
  assert.equal(resolve('כלים ב ג').workId, 'Mishnah_Kelim');
  assert.equal(resolve('בכל דרכיך דעהו'), null);
  assert.equal(resolve('בראשית משהו'), null);
});

test('book search matches titles, authors and categories across nikud and geresh variants', () => {
  const titles = query => searchWorks(query, PUBLIC_WORKS).map(result => result.work.workId);
  assert.equal(titles('מסילת ישרים')[0], 'legacy.mesillat-yesharim');
  assert.ok(titles('נחמן').includes('legacy.likutei-moharan'), 'author');
  assert.ok(titles('ליקוטי מוהר"ן').includes('legacy.likutei-moharan'), 'gershayim');
  assert.ok(titles('שֻׁלְחָן עָרוּךְ').includes('Shulchan_Arukh__Orach_Chayim'), 'nikud-insensitive');
  assert.deepEqual(titles('ברכות').slice(0, 2), ['Mishnah_Berakhot', 'Bavli_Berakhot']);
  assert.deepEqual(titles('א'), []);
});

test('in-book search finds the exact unit without altering canonical text', () => {
  const chunk = chunkOf('Proverbs');
  const before = JSON.stringify(chunk);
  const hits = searchChunk(chunk, 'בכל דרכיך דעהו');
  assert.deepEqual(hits.map(hit => hit.id), ['Proverbs.3.6']);
  assert.equal(JSON.stringify(chunk), before);
  assert.deepEqual(searchChunk(chunk, 'x'), []);
});

function fakeCaches() {
  const buckets = new Map();
  return {
    buckets,
    open: async name => {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const bucket = buckets.get(name);
      return { match: async url => (bucket.has(url) ? new Response(bucket.get(url)) : undefined), put: async (url, response) => bucket.set(url, await response.text()), delete: async url => bucket.delete(url) };
    },
  };
}

test('offline packs: download is verified and atomic, a failed update keeps the old copy, removal keeps personal data', async () => {
  const edition = workById('Ruth').editions[0];
  const good = packFile(edition.packId, edition.file);
  const tampered = good.replace('"text":"', '"text":"א');
  const store = memoryStore();
  globalThis.caches = fakeCaches();
  try {
    assert.throws(() => verifyChunkText(tampered, edition), /חתימה/);
    await downloadEdition(edition, { store, fetchImpl: async () => new Response(good) });
    assert.equal(downloadState(edition, store), 'current');
    const offline = await loadEditionChunk(edition, { fetchImpl: async () => { throw new Error('airplane mode'); } });
    assert.equal(offline.nodes.length, 4);
    const before = readDownloads(store)[edition.editionId];
    await assert.rejects(downloadEdition(edition, { store, fetchImpl: async () => new Response(tampered) }));
    assert.deepEqual(readDownloads(store)[edition.editionId], before, 'previous verified copy is retained');
    const outdated = { ...edition, checksum: '00000000' };
    assert.equal(downloadState(outdated, store), 'outdated', 'a new content version is detected as an update');
    toggleFavorite('Ruth', store);
    rememberPosition('Ruth', 3, 5, store);
    toggleBookmark('Ruth', 3, 5, store);
    await removeEdition(edition, { store });
    assert.equal(downloadState(edition, store), 'none');
    const personal = readPersonal(store);
    assert.deepEqual([personal.favorites, personal.positions.Ruth.node, isBookmarked(personal, 'Ruth', 3, 5)], [['Ruth'], 3, true]);
  } finally {
    delete globalThis.caches;
  }
});

test('personal library: favorites toggle, last position and deduplicated history, bookmarks', () => {
  const store = memoryStore();
  assert.deepEqual(toggleFavorite('Genesis', store).favorites, ['Genesis']);
  assert.deepEqual(toggleFavorite('Genesis', store).favorites, []);
  rememberPosition('Genesis', 1, null, store, new Date('2026-09-25T10:00:00Z'));
  rememberPosition('Exodus', 3, null, store, new Date('2026-09-25T10:05:00Z'));
  const state = rememberPosition('Genesis', 2, 4, store, new Date('2026-09-25T10:10:00Z'));
  assert.deepEqual(state.history.map(item => item.workId), ['Genesis', 'Exodus']);
  assert.deepEqual(state.positions.Genesis, { node: 2, unit: 4, at: '2026-09-25T10:10:00.000Z' });
  assert.equal(isBookmarked(toggleBookmark('Genesis', 2, 4, store), 'Genesis', 2, 4), true);
  assert.equal(isBookmarked(toggleBookmark('Genesis', 2, 4, store), 'Genesis', 2, 4), false);
});

function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env.BASE_URL': '"/"' }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}

test('library routes, TOC, next/previous boundaries and RTL rendering', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: LibraryPage, parseLibraryRoute, libraryRoute, readerNeighbors } = loadJsx('pages/LibraryPage.jsx');
  assert.deepEqual(parseLibraryRoute(libraryRoute.read('Genesis', 3, 4)), { view: 'read', id: 'Genesis', node: 3, unit: 4 });
  assert.deepEqual(parseLibraryRoute(libraryRoute.category('tanakh')), { view: 'category', id: 'tanakh' });
  assert.equal(loadJsx('components/Shell.jsx').navRootFor(libraryRoute.read('Genesis', 1)), 'books', 'nested library routes keep the ספרים tab active');
  const genesis = workById('Genesis');
  assert.deepEqual(readerNeighbors(genesis, 1), { previous: null, next: { title: 'פרק ב׳', node: 2 } });
  assert.deepEqual(readerNeighbors(genesis, 50).next, null);
  assert.equal(readerNeighbors(genesis, 50).previous.node, 49);
  const render = mode => renderToStaticMarkup(React.createElement(LibraryPage, { route: parseLibraryRoute(mode), go: () => {}, openSource: () => {} }));
  const book = render(libraryRoute.work('Genesis'));
  assert.equal((book.match(/>פרק [א-ת׳״]+</g) || []).length, 50, 'Genesis TOC lists 50 chapters');
  assert.match(book, /<summary>פרטי מקור<\/summary><p>שלמות: נבדקה מול מבנה המקור · 1533 פסוקים<\/p>/);
  const bikkurim = render(libraryRoute.work('Mishnah_Bikkurim'));
  const [main, details] = bikkurim.split('<details class="source-credit">');
  assert.doesNotMatch(main, /חלקי|טרם|בדיקת שלמות|class="notice"|library-status/, 'no completeness banner on the main screen');
  assert.match(details, /שלמות: חסרות במהדורה 5 יחידות/, 'the truth is kept in source details');
  assert.match(bikkurim, /פרק ד׳ · אינו במהדורה זו/);
  const yalkut = render(libraryRoute.work('halacha.yalkut-yosef-tashz')).split('<details class="source-credit">')[0];
  assert.doesNotMatch(yalkut, /טרם עברה בדיקת שלמות|חלקי/);
  const rows = render(libraryRoute.category('mussar'));
  assert.doesNotMatch(rows, /<span>חלקי<\/span>|מלא · נבדק/, 'list rows carry no validator status');
  assert.equal(workById('Mishnah_Bikkurim').coverage, COVERAGE.PARTIAL, 'PARTIAL is kept internally, never promoted');
  const home = render(libraryRoute.home());
  assert.match(home, /class="library-category"/);
  assert.doesNotMatch(home, /LICENSE_UNKNOWN/);
  assert.match(render(libraryRoute.category('tanakh')), /נביאים ראשונים/);
  assert.match(render(libraryRoute.lab()), /מעבדת אימות הספרייה/);
  assert.match(render(libraryRoute.work('legacy.tzafnat-paneach')), /הספר אינו זמין בספרייה/, 'unknown-license book is not published');
});

test('reader typography supports long reading: RTL serif text, adjustable size, 16px+ controls', () => {
  assert.match(css, /\.library-text\{font-family:var\(--font-reading\);font-size:var\(--library-size,24px\);line-height:1\.95/);
  assert.match(css, /\.library-unit-n\{[^}]*font-size:max\(14px,\.58em\)/);
  assert.match(css, /\.library-filters select\{min-height:44px;font-size:16px\}/);
  const reader = readFileSync(fileURLToPath(new URL('../src/pages/LibraryPage.jsx', import.meta.url)), 'utf8');
  assert.match(reader, /Math\.min\(40, size \+ 2\)/);
  assert.match(reader, /className="library-text" dir="rtl"/);
});

test('library rows share one title | metadata | arrow grid; numbers never detach from their word', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: LibraryPage, parseLibraryRoute, libraryRoute } = loadJsx('pages/LibraryPage.jsx');
  const html = renderToStaticMarkup(React.createElement(LibraryPage, { route: parseLibraryRoute(libraryRoute.category('talmud')), go: () => {}, openSource: () => {} }));
  assert.match(html, /<span class="library-row-title">ברכות<\/span><span class="library-row-meta"><span>125\u00a0עמודים<\/span><span>מקוון<\/span><\/span><span class="library-row-arrow"/);
  assert.doesNotMatch(html, /book-row-main|class="index-row/, 'no hand-built rows remain in the library');
  const row = css.match(/\.library-row\{[^}]*\}/)[0];
  assert.match(row, /grid-template-columns:minmax\(0,1fr\) auto 20px/);
  assert.match(row, /column-gap:16px/);
  assert.match(css, /\.library-row-title\{min-width:0;/);
  assert.match(css, /\.library-row-meta\{[^}]*max-width:min\(46vw,240px\);min-width:0/);
});

test('one tap opens content: last position, else the first canonical unit; details stay a secondary action', () => {
  const { openTargetFor, default: LibraryPage, parseLibraryRoute, libraryRoute } = loadJsx('pages/LibraryPage.jsx');
  const empty = { favorites: [], positions: {}, bookmarks: [], history: [] };
  assert.equal(openTargetFor(workById('Genesis'), empty).route, 'books/r/Genesis/1');
  assert.equal(openTargetFor(workById('Genesis'), { ...empty, positions: { Genesis: { node: 12, unit: 3 } } }).route, 'books/r/Genesis/12/3');
  assert.equal(openTargetFor(workById('Mishnah_Berakhot'), empty).route, 'books/r/Mishnah_Berakhot/1');
  assert.equal(openTargetFor(workById('Bavli_Berakhot'), empty, {}).route, 'talmud/Berakhot/2a');
  assert.equal(openTargetFor(workById('Bavli_Berakhot'), empty, { Berakhot: '17b' }).route, 'talmud/Berakhot/17b');
  assert.deepEqual(openTargetFor(workById('legacy.mesillat-yesharim'), empty), { legacyIndex: 0 });
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const html = renderToStaticMarkup(React.createElement(LibraryPage, { route: parseLibraryRoute(libraryRoute.category('tanakh')), go: () => {}, openSource: () => {} }));
  assert.match(html, /aria-label="פרטי ספר: בראשית"/, 'details remain reachable as a small secondary action');
  const page = readFileSync(fileURLToPath(new URL('../src/pages/LibraryPage.jsx', import.meta.url)), 'utf8');
  assert.doesNotMatch(page, /פתיחה בקורא/);
  assert.match(page, /onClick=\{\(\) => openWork\(work\)\}/);
  const talmud = readFileSync(fileURLToPath(new URL('../src/pages/TalmudPage.jsx', import.meta.url)), 'utf8');
  assert.match(talmud, /className="tractate-card" onClick=\{\(\) => go\(talmudRoute\.amud\(t, progress\[t\.title\] \|\| t\.firstAmud\)\)\}/);
});

test('expanded library: Shulchan Arukh by siman/seif and Mishneh Torah by perek/halacha, each from one documented edition', () => {
  const resolve = query => resolveLibraryReference(query, PUBLIC_WORKS);
  assert.deepEqual([resolve('או"ח קכח').workId, resolve('או"ח קכח').node], ['Shulchan_Arukh__Orach_Chayim', 128]);
  assert.deepEqual([resolve('שו"ע או"ח קכח ב').node, resolve('שו"ע או"ח קכח ב').unit], [128, 2]);
  assert.deepEqual([resolve('רמב"ם תשובה ג ד').workId, resolve('רמב"ם תשובה ג ד').node, resolve('רמב"ם תשובה ג ד').unit], ['Mishneh_Torah__Repentance', 3, 4]);
  assert.equal(resolve('או"ח תתק'), null, 'Orach Chayim has 697 simanim');
  const oc = chunkOf('Shulchan_Arukh__Orach_Chayim');
  assert.equal(normalizeForSearch(oc.nodes[0].units[0].text).split(' ').slice(0, 3).join(' '), 'יתגבר כארי לעמד');
  const cm = workById('Shulchan_Arukh__Choshen_Mishpat').editions[0];
  assert.equal(cm.title, 'Shulhan Arukh, Hoshen ha-Mishpat, Lemberg, 1898', 'CM uses the edition with a clear license');
  assert.equal(workById('Shulchan_Arukh__Orach_Chayim').editions[0].title, 'Torat Emet 363');
  assert.equal(workById('halacha.shulchan-arukh-oc').public, false, 'the remote entry is superseded, not duplicated');
  assert.ok(IMPORT_REPORTS.skipped.every(item => /license|no edition|structure/.test(item.reason)), 'works without a clear license or edition are skipped with a reason');
  assert.equal(IMPORT_REPORTS.skipped.length, 5);
  assert.deepEqual(searchWorks('רמב"ם תשובה', PUBLIC_WORKS)[0].work.workId, 'Mishneh_Torah__Repentance');
  assert.equal(worksInCategory('rambam').length, 79);
});
