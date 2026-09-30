import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { BOOK_ROWS, BOOK_HALACHA_RECORDS, BLESSING_SOURCES, BOOK_TABLE_INFO, ENGINE_COUNTS } from '../src/data/blessings/bookTable.mjs';
import { RULES, SOURCE_SPECS, NUSACH_RULINGS, YALKUT_BESIDE, BLESSING, AFTER } from '../src/data/blessings/rules.mjs';
import { indexRecord, normalizeFood, openDataRecord, presentRecord, searchFoods, stem } from '../src/services/blessingsEngine.mjs';
import { YALKUT_YOSEF } from '../src/data/yalkutYosef.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(new URL(`../${path}`, import.meta.url));
const pack = path => JSON.parse(gunzipSync(read(path)).toString('utf8'));
const squash = text => text.replace(/\s+/g, ' ').trim();
const TABLE = JSON.parse(read('sources/ong-shabbat/blessing-table.json'));
const ONG = pack('public/library/packs/author-permission-ong-shabbat/Oneg_Shabbat.json.gz');
const FOODS = pack('public/blessings/foods.json.gz');
const OPEN = FOODS.records.map(row => openDataRecord(row, BOOK_ROWS));
const ALL = [...BOOK_ROWS, ...BOOK_HALACHA_RECORDS, ...OPEN];
const INDEX = ALL.map(indexRecord);
const top = query => searchFoods(INDEX, query, 10).results;

// ---------------------------------------------------------------------------------- the book, word for word
test('the table of עונג שבת: 294 rows, pp. 277–295, each exactly as extracted from the PDF', () => {
  assert.equal(TABLE.pdfSha256, '52aa13afd39c69d0728738bdf27426092b4a918290ed3605301d758c1c6e2df5');
  assert.equal(BOOK_TABLE_INFO.pdfSha256, TABLE.pdfSha256);
  assert.equal(TABLE.rows.length, 294);
  assert.equal(BOOK_ROWS.length, TABLE.rows.length);
  BOOK_ROWS.forEach((row, index) => {
    assert.equal(row.text, squash(TABLE.rows[index].text), `row ${row.n}`);
    assert.ok(row.pages.every(page => page >= 277 && page <= 295), `row ${row.n} pages`);
    assert.ok(row.text.startsWith(row.name), `row ${row.n} name`);
    // The name the build cut at the first dash is the name printed in bold.
    const letters = text => text.replace(/[^א-ת]/g, '');
    const bold = letters(TABLE.rows[index].bold);
    assert.ok(bold === letters(row.name) || bold === letters(row.name.replace(/\[[^\]]*\]/g, '')), `row ${row.n} bold name`);
  });
});

test('the rows together are the library\'s chapter כ״ו, letter for letter (the library joined some rows; the words are the same)', () => {
  const units = ONG.nodes.find(node => node.n === 26).units;
  const packText = units.slice(1).map(unit => unit.text).join(' ').replace(/\s+/g, '');
  const rowsText = BOOK_ROWS.map(row => row.text).join(' ').replace(/\s+/g, '');
  assert.equal(rowsText, packText);
  assert.equal(squash(units[0].text), squash(BOOK_TABLE_INFO.intro));
  for (const row of BOOK_ROWS) {
    const unit = units.find(item => item.n === row.unit);
    assert.ok(squash(unit.text).includes(row.text), `row ${row.n} is inside library unit ${row.unit}`);
    assert.equal(row.route, `books/r/Oneg_Shabbat/26/${row.unit}`);
  }
});

test('a row\'s first and last blessing are read from its own words only', () => {
  const byName = name => BOOK_ROWS.find(row => row.name === name);
  assert.equal(byName('תפוח').beforeKey, 'haetz');
  assert.equal(byName('תפוח').afterKey, 'nefashot');
  assert.equal(byName('תמרים').afterKey, 'etz');
  assert.equal(byName('לחם').beforeKey, 'hamotzi');
  assert.equal(byName('ביסלי').afterKey, 'michya');
  // Cornflakes: the book gives conditions (corn kernels / corn flour) — no single first blessing is invented.
  const cornflakes = byName('קורנפלקס');
  assert.equal(cornflakes.beforeKey, null);
  assert.match(cornflakes.text, /אם הקורנפלקס עשוי מגרגירי תירס: ברכתו האדמה/);
  assert.match(cornflakes.text, /עשוי מקמח תירס .*ברכתו שהכל \/ נפשות/);
  assert.equal(cornflakes.pages[0], 292);
  // A last blessing named only inside a condition of an uncertain first blessing is not taken.
  assert.equal(byName('גלידה עם ביסקוויט [קסטה]').afterKey, null);
  for (const row of BOOK_ROWS) {
    if (row.beforeKey) assert.ok(BLESSING[row.beforeKey], `row ${row.n}`);
    if (row.afterKey) assert.ok(AFTER[row.afterKey], `row ${row.n}`);
    if (row.before) assert.ok(row.text.includes(row.before));
    if (row.after) assert.ok(row.text.includes(row.after));
  }
});

// ---------------------------------------------------------------------------------- every ruling has a source
const stripNiqqud = text => text.replace(/[֑-ׇ]/g, '');
const SA = pack('public/library/packs/sefaria-shulchan-arukh-pd/Shulchan_Arukh__Orach_Chayim.json.gz');
const MB = pack('public/library/packs/wikisource-shulchan-arukh-commentary-cc-by-sa/Mishnah_Berurah.137-262.json.gz');
const unitOf = (work, node, n) => work.nodes.find(item => item.n === node)?.units.find(unit => unit.n === n);
const textOf = spec => (spec.kind === 'sa' ? stripNiqqud(unitOf(SA, spec.siman, spec.seif).text)
  : spec.kind === 'mb' ? unitOf(MB, spec.siman, spec.n).text
    : spec.kind === 'yy' ? YALKUT_YOSEF.sections.find(section => section.id === spec.id).text
      : unitOf(ONG, spec.chapter, spec.n).text);

test('every quotation is word for word in the text the app carries', () => {
  assert.deepEqual(Object.keys(BLESSING_SOURCES).sort(), Object.keys(SOURCE_SPECS).sort());
  for (const [id, source] of Object.entries(BLESSING_SOURCES)) {
    assert.ok(source.excerpt.length > 10, id);
    assert.ok(textOf(SOURCE_SPECS[id]).includes(source.excerpt), `${id} is verbatim`);
    assert.ok(source.citation && (source.route || source.open), `${id} can be opened`);
  }
});

test('no record without a source: book rows cite the book, open-data foods point to one sourced rule or one book row', () => {
  for (const row of [...BOOK_ROWS, ...BOOK_HALACHA_RECORDS]) {
    assert.match(row.cite, /^עונג שבת, פרק כ״[הו]/);
    assert.ok(row.route.startsWith('books/r/Oneg_Shabbat/'));
    for (const item of row.yalkut) assert.ok(BLESSING_SOURCES[item.source], `${row.name}: ${item.source}`);
    if (row.shiur) assert.ok(BLESSING_SOURCES[row.shiur.source]);
  }
  for (const [id, rule] of Object.entries(RULES)) {
    assert.ok(rule.sources.length > 0, id);
    for (const source of rule.sources) assert.ok(BLESSING_SOURCES[source], `${id}: ${source}`);
    for (const name of rule.bookRows || []) assert.ok(BOOK_ROWS.some(row => row.name === name), `${id}: ${name}`);
    assert.ok(['rule', 'conditional'].includes(rule.status));
  }
  for (const ruling of Object.values(NUSACH_RULINGS)) for (const rite of Object.values(ruling)) for (const source of rite.sources) assert.ok(BLESSING_SOURCES[source]);
  for (const record of OPEN) {
    assert.ok(record.ruleId ? RULES[record.ruleId] : record.bookRow, record.name);
    assert.ok(['off', 'wikidata'].includes(record.origin));
  }
  assert.ok(Object.keys(YALKUT_BESIDE).every(name => BOOK_ROWS.some(row => row.name === name)));
});

test('rule-based records carry the rule flag and say so; conditional ones send to a rabbi', () => {
  const sources = BLESSING_SOURCES;
  for (const record of OPEN.slice(0, 400)) {
    const view = presentRecord(record, { nusach: 'edot-hamizrach', sources });
    assert.notEqual(view.kind, 'book');
    if (view.kind === 'rule') { assert.equal(view.kindLabel, 'לפי הכלל'); assert.match(view.note, /נקבע לפי כלל — מומלץ לברר במקרה של ספק/); }
    else { assert.equal(view.kindLabel, 'יש בזה דעות'); assert.match(view.note, /לשאול רב/); }
    assert.ok(view.ruleTitle, record.name);
    assert.ok(view.sources.some(line => /Open Food Facts|ויקינתונים/.test(line)));
  }
  const book = presentRecord(BOOK_ROWS.find(row => row.name === 'אבטיח'), { nusach: 'edot-hamizrach', sources });
  assert.equal(book.kindLabel, 'מן הספר');
  assert.equal(book.before.label, 'בורא פרי האדמה');
  assert.equal(book.after.label, 'בורא נפשות');
  assert.match(book.sources[0], /עונג שבת, פרק כ״ו \(לוח ברכות\), עמ׳ 277/);
});

test('counts are honest: book rows, rule-based foods and conditional foods add up', () => {
  assert.equal(ENGINE_COUNTS.bookRows, 294);
  assert.equal(ENGINE_COUNTS.rule + ENGINE_COUNTS.conditional, FOODS.records.length);
  assert.equal(ENGINE_COUNTS.wikidata + ENGINE_COUNTS.openFoodFacts, FOODS.records.length);
  assert.ok(FOODS.records.length > 3000, 'thousands of foods');
  assert.equal(OPEN.filter(record => record.kind === 'conditional').length, ENGINE_COUNTS.conditional);
  assert.match(FOODS.attribution.off, /Open Database License/);
  assert.match(FOODS.attribution.wikidata, /CC0/);
});

// ---------------------------------------------------------------------------------- the reader's rite
test('the rite changes the ruling only where a source in the app says so', () => {
  const sources = BLESSING_SOURCES;
  const matzah = BOOK_ROWS.find(row => row.name === 'מצה [לא בפסח]');
  const sephardi = presentRecord(matzah, { nusach: 'edot-hamizrach', sources });
  const ashkenazi = presentRecord(matzah, { nusach: 'ashkenaz', sources });
  assert.equal(sephardi.before.label, 'בורא מיני מזונות');
  assert.equal(sephardi.after.label, 'מעין שלוש · על המחיה');
  assert.match(sephardi.otherRite.text, /לבני אשכנז/);
  assert.equal(ashkenazi.before.label, 'המוציא לחם מן הארץ');
  assert.equal(ashkenazi.after.label, 'ברכת המזון');
  assert.ok(ashkenazi.nusachNote.sources.some(source => source.id === 'yy-168-4-ashkenaz'));
  assert.equal(presentRecord(matzah, { nusach: 'chabad', sources }).before.label, 'המוציא לחם מן הארץ');
  assert.equal(presentRecord(matzah, { nusach: 'sefard', sources }).before.label, 'המוציא לחם מן הארץ');
  assert.equal(presentRecord(matzah, { nusach: 'unknown', sources }).before.label, 'בורא מיני מזונות');

  const sweet = BOOK_HALACHA_RECORDS.find(item => item.id === 'ong-25-4-item');
  assert.equal(presentRecord(sweet, { nusach: 'edot-hamizrach', sources }).before.label, 'בורא מיני מזונות');
  assert.equal(presentRecord(sweet, { nusach: 'ashkenaz', sources }).before.label, 'המוציא לחם מן הארץ');
  const pizza = BOOK_ROWS.find(row => row.name.startsWith('פיצה שנילושה בחלב'));
  assert.equal(presentRecord(pizza, { nusach: 'ashkenaz', sources }).before.label, 'המוציא לחם מן הארץ');
  assert.equal(presentRecord(pizza, { nusach: 'edot-hamizrach', sources }).before.label, null);
  // A plain row does not change with the rite.
  const apple = BOOK_ROWS.find(row => row.name === 'תפוח');
  assert.deepEqual(presentRecord(apple, { nusach: 'ashkenaz', sources }).before, presentRecord(apple, { nusach: 'edot-hamizrach', sources }).before);
});

test('Yalkut Yosef beside the book: where they differ both are shown (במבה, קרמבו)', () => {
  const sources = BLESSING_SOURCES;
  const bamba = presentRecord(BOOK_ROWS.find(row => row.name === 'במבה'), { nusach: 'edot-hamizrach', sources });
  assert.equal(bamba.before.label, 'שהכל נהיה בדברו');
  assert.equal(bamba.yalkut[0].relation, 'differs');
  assert.match(bamba.yalkut[0].source.excerpt, /במבה'' מברכים בורא פרי האדמה/);
  assert.ok(bamba.yalkut[0].source.questions.some(question => question.id === 'hal-brachot-bamba'));
  const krembo = presentRecord(BOOK_ROWS.find(row => row.name === 'קרמבו'), { nusach: 'edot-hamizrach', sources });
  assert.equal(krembo.yalkut[0].relation, 'differs');
});

// ---------------------------------------------------------------------------------- search
test('search normalizes spelling: niqqud, final letters, geresh, doubled letters, plurals, English', () => {
  assert.equal(normalizeFood('לֶבֶן'), 'לבנ');
  assert.equal(normalizeFood('ביסקוויט'), normalizeFood('ביסקויט'));
  assert.equal(normalizeFood("צ'יפס"), normalizeFood('צ׳יפס'));
  assert.equal(stem('תפוחים'), stem('תפוח'));
  assert.equal(stem('עוגיות'), stem('עוגיה'));
  assert.equal(top('תפוחים')[0].name, 'תפוח');
  assert.equal(top('ביסקויט')[0].name, 'ביסקוויט');
  assert.equal(top('watermelon')[0].name, 'אבטיח');
});

test('common foods are found with the right source', () => {
  const first = query => top(query)[0];
  const book = (query, name) => { const record = first(query); assert.equal(record.kind, 'book', query); assert.equal(record.name, name, query); };
  book('תפוח', 'תפוח');
  book('במבה', 'במבה');
  book('ביסלי', 'ביסלי');
  book('קורנפלקס', 'קורנפלקס');
  book('אורז', 'אורז');
  book('תירס', 'תירס');
  book('שוקולד', 'שוקולד');
  book('קפה', 'קפה [עם מים]');
  assert.ok(top('פיצה').slice(0, 2).every(record => record.kind === 'book' && record.name.startsWith('פיצה')));
  // "מרק" alone: the soup rule (its conditions and the book's soup rows), then the book's soups.
  const soup = top('מרק');
  assert.ok(soup[0].ruleId === 'soup' || (soup[0].kind === 'book' && soup[0].name.startsWith('מרק')));
  assert.ok(soup.slice(0, 4).filter(record => record.kind === 'book' && record.name.startsWith('מרק')).length >= 3);
  const challah = top('חלה');
  assert.ok(challah.some(record => record.ruleId === 'bread' && record.name === 'חלה'), 'חלה by the bread rule');
  assert.ok(challah.some(record => record.id === 'ong-25-4-item'), 'חלה מתוקה from the book');
  // Open-data products are found too, by their own names.
  assert.ok(top('פיתה').some(record => record.origin === 'off' && record.ruleId === 'bread'));
});

// ---------------------------------------------------------------------------------- the page
const source = fileURLToPath(new URL('../src/pages/BlessingsEngine.jsx', import.meta.url));
const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env.BASE_URL': '"/"' }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
const pageModule = new Module(source);
pageModule.filename = source;
pageModule.paths = Module._nodeModulePaths(root);
pageModule._compile(compiled, source);
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('the page renders its search field, and a card shows לפני / אחרי, the book\'s words and the source line, with spoken labels', () => {
  const Page = pageModule.exports.default;
  const page = renderToStaticMarkup(React.createElement(Page, { settings: { nusach: 'edot-hamizrach' }, go: () => {}, openSource: () => {}, onBack: () => {} }));
  assert.match(page, /מנוע הברכות החכם/);
  assert.match(page, /aria-label="חיפוש מאכל או משקה"/);
  assert.match(page, /role="status"/);
  const Card = pageModule.exports.FoodCard;
  const cornflakes = BOOK_ROWS.find(row => row.name === 'קורנפלקס');
  const card = renderToStaticMarkup(React.createElement(Card, { record: cornflakes, nusach: 'edot-hamizrach', sources: BLESSING_SOURCES }));
  assert.match(card, /class="brachot-pair"/);
  assert.match(card, /<span class="visually-hidden">לפני: לפי התנאים שבהמשך<\/span>/); // spoken line as hidden text (aria-label on a generic div is ignored)
  assert.match(card, /<span class="visually-hidden">אחרי: בורא נפשות<\/span>/);
  assert.match(card, /לשון הספר/);
  assert.match(card, /עונג שבת, פרק כ״ו \(לוח ברכות\), עמ׳ 292/);
  const product = OPEN.find(record => record.origin === 'off' && record.ruleId === 'bread');
  const productCard = renderToStaticMarkup(React.createElement(Card, { record: product, nusach: 'edot-hamizrach', sources: BLESSING_SOURCES }));
  assert.match(productCard, /לפי הכלל: לחם מחמשת מיני דגן/);
  assert.match(productCard, /Open Food Facts/);
  assert.match(productCard, /<span class="visually-hidden">לפני: המוציא לחם מן הארץ<\/span>/);
  // The "סיימתי" placeholder renders only what the owner of that feature passes.
  const slotted = renderToStaticMarkup(React.createElement(Card, { record: cornflakes, nusach: 'edot-hamizrach', sources: BLESSING_SOURCES, completionSlot: () => React.createElement('span', { className: 'slot-probe' }, 'probe') }));
  assert.match(slotted, /slot-probe/);
  assert.doesNotMatch(page, /[\u{1F300}-\u{1FAFF}]/u, 'no emoji');
});

test('the page fits a phone: nothing in it can force a horizontal scroll', () => {
  const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('/* ---------- מנוע הברכות החכם'));
  assert.ok(block.length > 1000);
  assert.match(block, /\.brachot-engine\{[^}]*min-width:0/);
  assert.match(block, /\.brachot-pair\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(block, /\.brachot-card\{[^}]*min-width:0[^}]*overflow-wrap:anywhere/);
  assert.match(block, /\.brachot-search \.brachot-search-input\{[^}]*width:100%[^}]*min-width:0/);
  assert.match(block, /@media \(max-width:420px\)/);
  assert.doesNotMatch(block, /(^|[;{])(min-)?width:\s*\d{3,}px/m, 'no fixed or minimum width wider than a phone');
});

test('the engine is its own Siddur category, last (under ברכות), on its own route', () => {
  const books = readFileSync(new URL('../src/pages/BooksPage.jsx', import.meta.url), 'utf8');
  assert.match(books, /const brachotCategory=<button key="brachot" type="button" className="siddur-group siddur-brachot-category" onClick=\{\(\)=>go\?\.\(brachotHome\.route\)\}>/);
  assert.doesNotMatch(books, /group\.key==='blessings'&&<button/, 'no longer a row inside ברכות');
  const layouts = readFileSync(new URL('../src/data/nusach/siddurLayouts.mjs', import.meta.url), 'utf8');
  assert.match(layouts, /\{ key: 'brachot', title: 'מנוע הברכות החכם', note: 'מה מברכים על זה\?', route: 'siddur-brachot' \}/);
  const app = readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /mode==='siddur-brachot' \? <BlessingsEngine /);
});

test('the engine page is the search and its answers: no explanatory essay; each card keeps its source line', () => {
  const page = readFileSync(new URL('../src/pages/BlessingsEngine.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /כך נקבעת כל תשובה|brachot-about|brachot-credit/);
  assert.match(page, /<footer className="brachot-source-line">/);
  assert.match(page, /completionSlot\(record\)/, 'the "סיימתי" slot stays on every card');
  const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.brachot-about|\.brachot-credit/);
  // The data licences are still credited: on every card, and on the Siddur's sources page.
  const sources = readFileSync(new URL('../src/pages/SiddurNusachPages.jsx', import.meta.url), 'utf8');
  assert.match(sources, /Open Food Facts · Open Database License \(ODbL\)/);
});
