// עונג שבת (הרב ישראל שריקי, מהדורה ראשונה תשע״ג; באישור המחבר): the book in the library and its halachot in the
// Halacha Engine. Text fidelity, structure, footnote anchoring, pages, the three answer layers, the publication gates,
// search, exact links, rights and size.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire, Module } from 'node:module';
import { buildSync } from 'esbuild';
import ONG_SHABBAT_CORPUS from '../src/data/library/corpus/ongShabbat.mjs';
import { AUTHOR_PERMISSION_WORKS, CORPUS_INDEX, EDITIONS, LICENSES, PUBLIC_WORKS, WORKS, workById, worksInCategory } from '../src/data/library/registry.mjs';
import { validateWorkChunk } from '../src/services/library/integrity.mjs';
import { checksum } from '../src/services/prayer/checksum.mjs';
import { layerTabNames, layersAt } from '../src/services/library/relations.mjs';
import { searchWorks } from '../src/services/library/search.mjs';
import { ONG_SHABBAT_QA, ONG_SHABBAT_SKIPPED } from '../src/data/ongShabbatQa.mjs';
import { ONG_SHABBAT_NOTE_LINKS } from '../src/data/ongShabbatLinks.mjs';
import { PRACTICAL_HALACHA_QA, PRACTICAL_HALACHA_QA_INDEX, publishedPracticalQuestions } from '../src/data/practicalHalachaQa.mjs';
import { CURRENTNESS, HIGH_STAKES_ANSWER, MODERN_DEVICE, PUBLICATION, TECH_NOTE, gate, strengthIssues, conditionIssues } from '../src/services/ongShabbatGate.mjs';
import { searchHalacha, questionKeyTerms, entryRelevance, normalizeQuery } from '../src/services/halachaSearch.mjs';
import { groundedAnswer, ANSWER_STATUS, validateModelAnswer, retrieve } from '../src/services/halachaAgent.mjs';
import { buildHalachaGraph, danglingEdges } from '../src/services/halachaGraph.mjs';
import talmudCatalog from '../src/data/talmudCatalog.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const pack = ONG_SHABBAT_CORPUS.packs[0];
const packFile = file => fileURLToPath(new URL(`../public/library/packs/${pack.packId}/${file}`, import.meta.url));
const readPack = file => { const text = gunzipSync(readFileSync(packFile(file))).toString('utf8'); return { text, data: JSON.parse(text) }; };
const baseWork = pack.works.find(work => work.workId === 'Oneg_Shabbat');
const notesWork = pack.works.find(work => work.workId === 'Oneg_Shabbat_Notes');
const base = readPack(baseWork.file);
const notes = readPack(notesWork.file);
const provenance = JSON.parse(readFileSync(new URL('../sources/ong-shabbat/provenance.json', import.meta.url), 'utf8'));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const unitOf = (chapter, n) => base.data.nodes.find(node => node.n === chapter).units.find(unit => unit.n === n);
const HEB = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90, ק: 100, ר: 200, ש: 300, ת: 400 };
const value = label => [...String(label).replace(/["'׳״]/g, '')].reduce((sum, letter) => sum + HEB[letter], 0);

test('pack integrity: both files verify against the index (checksum, edition, ids, order) and are complete', () => {
  assert.equal(checksum(base.text), baseWork.checksum);
  assert.equal(checksum(notes.text), notesWork.checksum);
  const expected = work => work.expected.map((units, i) => ({ n: i + 1, units }));
  assert.equal(validateWorkChunk(base.data, expected(baseWork)).status, 'FULL');
  assert.equal(validateWorkChunk(notes.data, expected(notesWork)).status, 'FULL');
  assert.equal(base.data.editionId, `${pack.packId}:Oneg_Shabbat`);
  // 26 chapters (א׳–כ״ה halachot, כ״ו the blessing table) and the author's introduction.
  assert.equal(baseWork.nodeTitles.length, 27);
  assert.equal(baseWork.nodeTitles[3], 'פרק ד׳ · דיני בורר');
  assert.equal(baseWork.nodeTitles[25], 'פרק כ״ו · לוח ברכות');
  assert.equal(baseWork.nodeTitles[26], 'פתח דבר');
  const halachot = base.data.nodes.filter(node => node.n <= 25).reduce((total, node) => total + node.units.length, 0);
  assert.equal(halachot, 752);
  assert.equal(base.data.nodes.find(node => node.n === 26).units.length, 284, 'the table\'s opening note and its 283 foods');
  assert.equal(notes.data.nodes.reduce((total, node) => total + node.units.length, 0), 958);
});

test('source text unchanged: every unit and note hashes to the extraction (the one redaction is recorded)', () => {
  for (const node of base.data.nodes) for (const unit of node.units) assert.equal(sha256(unit.text), provenance.unitHashes[unit.id], unit.id);
  for (const node of notes.data.nodes) for (const unit of node.units) assert.equal(sha256(unit.text), provenance.noteHashes[unit.id], unit.id);
  assert.equal(Object.keys(provenance.unitHashes).length, 1079);
  assert.equal(Object.keys(provenance.noteHashes).length, 958);
  assert.deepEqual(provenance.redactions.map(item => item.note), [440]);
  const note440 = notes.data.nodes.flatMap(node => node.units).find(unit => unit.fn === 440);
  assert.match(note440.text, /\[מספר הטלפון שבספר לא הובא כאן\]/);
  assert.doesNotMatch(notes.text + base.text, /05\d-?\d{7}/, 'no private phone number in the packs');
  // Text is the book's: no markup, no footnote markers left inside the words, no control characters.
  assert.doesNotMatch(base.text + notes.text, /[<>⟦⟧\u0000-\u0008\u000b-\u001f]/);
});

test('headings are attached to their own halacha, numbered as printed, and every halacha has text', () => {
  const fly = unitOf(4, 18);
  assert.equal(fly.label, 'י"ח');
  assert.equal(fly.title, 'נפל זבוב לכוס');
  assert.match(fly.text, /^כוס משקה שנפל בתוכו צרעה או זבוב, מותר להסירו בשבת בידו או על ידי כפית, כי אין ברירה בלח/);
  assert.deepEqual(fly.p, [70]);
  const wipes = unitOf(5, 6);
  assert.equal(wipes.title, 'מגבונים לחים');
  assert.match(wipes.text, /^מותר לקנח בנחת בכל סוגי המגבונים/);
  // A sub-heading printed inside a halacha stays inside it (ג'חנון in הטמנה ה׳), with its own paragraph.
  const chamin = unitOf(2, 5);
  assert.ok(chamin.text.split('\n').includes("ג'חנון"));
  assert.ok(chamin.sh.includes(chamin.text.split('\n').indexOf("ג'חנון")));
  // Halachot numbered inline in print (נר חנוכה, pp. 63) and a heading printed without its period (p. 238) are units.
  assert.equal(unitOf(3, 33).label, 'כ"ד');
  assert.equal(unitOf(20, 22).title, 'תחבושת על דם');
  // Numbering runs on within a section and restarts only where a new section begins.
  for (const node of base.data.nodes.filter(item => item.n <= 25)) {
    let previous = 0;
    for (const unit of node.units) {
      assert.ok(unit.text.trim(), unit.id);
      const n = value(unit.label);
      assert.ok(n === previous + 1 || (n === 1 && unit.head), `${unit.id}: ${unit.label} after ${previous}`);
      previous = n;
    }
  }
});

test('footnotes: 1–958, each on the halacha whose text carries its number, in the book\'s order', () => {
  const all = notes.data.nodes.flatMap(node => node.units.map(unit => ({ ...unit, chapter: node.n })));
  assert.deepEqual(all.map(note => note.fn), Array.from({ length: 958 }, (_, i) => i + 1));
  for (const note of all) {
    const unit = unitOf(note.chapter, note.v);
    assert.ok(unit.fn.some(([n]) => n === note.fn), `note ${note.fn} → ${unit.id}`);
    if (unit.label) assert.equal(note.vl, unit.label);
  }
  // Every marker in the text is where the book prints it (after the words it sources).
  const at = (unit, n) => unit.fn.find(([k]) => k === n)[1];
  assert.ok(unitOf(1, 1).text.slice(0, at(unitOf(1, 1), 1)).endsWith('לכבוד שבת קודש".'));
  assert.equal(notes.data.nodes[0].units[0].text.slice(0, 18), 'ילקוט יוסף שבת כרך');
  // The anchor file agrees: one anchor per note, to its halacha.
  const anchors = JSON.parse(gunzipSync(readFileSync(packFile(notesWork.anchorsFile))).toString('utf8'));
  assert.equal(anchors.anchors.length, 958);
  assert.equal(anchors.anchors.find(anchor => anchor.canonicalRef === 'Oneg Shabbat, note 708').anchorRef, 'Oneg_Shabbat.17.8');
});

test('printed pages: every halacha keeps its page, pages run in the book\'s order within its chapter\'s pages', () => {
  let last = 0;
  for (const node of base.data.nodes.filter(item => item.n <= 26)) {
    const range = provenance.chapters.find(chapter => chapter.n === node.n).pages;
    for (const unit of node.units) {
      assert.ok(unit.p.length >= 1, unit.id);
      for (const page of unit.p) assert.ok(page >= range[0] && page <= range[1], `${unit.id} p.${page}`);
      assert.ok(unit.p[0] >= last, `${unit.id} goes back to p.${unit.p[0]}`);
      last = unit.p[0];
    }
  }
  assert.equal(provenance.pdf.sha256, '52aa13afd39c69d0728738bdf27426092b4a918290ed3605301d758c1c6e2df5');
  assert.equal(provenance.pdf.storedInRepository, false);
});

test('the library: הלכה › פסיקה ספרדית, "לשון הספר | מקורות וטעמים", the credit line, notes not listed as a book', () => {
  const work = workById('Oneg_Shabbat');
  assert.equal(work.primaryCategory, 'halacha');
  assert.equal(work.group, 'sephardic-psak');
  assert.ok(worksInCategory('halacha').some(item => item.workId === 'Oneg_Shabbat'));
  assert.ok(!PUBLIC_WORKS.some(item => item.workId === 'Oneg_Shabbat_Notes'), 'the notes are a layer, not a book');
  assert.deepEqual(layerTabNames(work), { source: 'לשון הספר', translation: 'תרגום', commentary: 'מקורות וטעמים', parallel: 'מקבילות' });
  assert.equal(layersAt('Oneg_Shabbat', 4)[0].work.workId, 'Oneg_Shabbat_Notes');
  assert.equal(work.editions[0].attribution.text, 'עונג שבת · הרב ישראל שריקי · באישור המחבר, כל הזכויות שמורות');
  assert.equal(searchWorks('עונג שבת', PUBLIC_WORKS)[0].work.workId, 'Oneg_Shabbat');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: LibraryPage, parseLibraryRoute, libraryRoute, unitParagraphs } = loadJsx('pages/LibraryPage.jsx');
  const page = renderToStaticMarkup(React.createElement(LibraryPage, { route: parseLibraryRoute(libraryRoute.read('Oneg_Shabbat', 4)), go: () => {}, openSource: () => {} }));
  assert.match(page, /role="tab"[^>]*>לשון הספר<\/button>/);
  assert.match(page, /role="tab"[^>]*>מקורות וטעמים<\/button>/);
  assert.match(page, /<p class="source-credit library-credit">עונג שבת · הרב ישראל שריקי · באישור המחבר, כל הזכויות שמורות<\/p>/);
  assert.doesNotMatch(page, /תנאי הרישיון/, 'no licence link: this is not a public licence');
  // A halacha's paragraphs keep their footnote numbers where the book prints them.
  const paras = unitParagraphs(unitOf(4, 18));
  assert.deepEqual(paras.flatMap(para => para.parts.filter(part => part.note).map(part => part.note)), unitOf(4, 18).fn.map(([n]) => n));
});

test('rights: author-permission, only for this work; never public domain or Creative Commons; the PDF is not in the repo', () => {
  const licence = LICENSES['author-permission'];
  assert.equal(licence.redistributionAllowed, true);
  assert.equal(licence.offlineAllowed, true);
  assert.equal(licence.statement, 'באישור המחבר; כל הזכויות שמורות למחבר');
  assert.deepEqual(Object.keys(AUTHOR_PERMISSION_WORKS).sort(), ['Oneg_Shabbat', 'Oneg_Shabbat_Notes']);
  for (const [id, rights] of Object.entries(AUTHOR_PERMISSION_WORKS)) {
    assert.equal(rights.rightsBasis, 'author-permission');
    assert.equal(rights.author, 'הרב ישראל שריקי');
    assert.equal(rights.edition, 'מהדורה ראשונה תשע״ג');
    assert.equal(rights.permissionStatedBy, 'בעל האפליקציה');
    assert.match(rights.permissionEvidence, /not stored in the repo/);
    assert.equal(workById(id).license, 'author-permission');
  }
  // The exception is named: no other work, edition or pack carries this licence.
  assert.deepEqual(WORKS.filter(work => work.license === 'author-permission').map(work => work.workId).sort(), ['Oneg_Shabbat', 'Oneg_Shabbat_Notes']);
  assert.ok(EDITIONS.filter(edition => edition.license === 'author-permission').every(edition => ['Oneg_Shabbat', 'Oneg_Shabbat_Notes'].includes(edition.workId)));
  assert.deepEqual(CORPUS_INDEX.filter(item => item.license === 'author-permission').map(item => item.packId), ['author-permission-ong-shabbat']);
  const OPEN = /public[- ]domain|נחלת הכלל|creative ?commons|\bCC[- ]?(?:BY|0)/i;
  for (const value of [pack.license, provenance.license, provenance.rightsBasis, ...pack.works.flatMap(work => [work.license, work.recordedLicense, work.attribution.text, work.sourceLine])]) assert.doesNotMatch(value, OPEN);
  assert.match(provenance.licenseNote, /Not Public Domain and not under any Creative Commons licence/);
  for (const key of ['work', 'author', 'edition', 'copyright', 'rightsBasis', 'permissionStatedBy', 'permissionEvidence']) assert.ok(provenance[key], key);
  assert.equal(provenance.rightsBasis, 'author-permission');
  const pdfs = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? (['node_modules', '.git', 'dist', 'dist-native', 'ios', 'android', 'build_output', 'kazzohar-known-good', 'archive', '.kilo'].includes(entry.name) ? [] : pdfs(`${dir}/${entry.name}`)) : entry.name.endsWith('.pdf') ? [`${dir}/${entry.name}`] : []);
  assert.deepEqual(pdfs(`${root}sources`).concat(pdfs(`${root}public`)).filter(path => /ong|עונג|שבת/i.test(path)), []);
});

test('question records: every one has its source, a verbatim excerpt of its halacha, and passes the gate', () => {
  const ids = new Set();
  for (const record of ONG_SHABBAT_QA) {
    assert.ok(!ids.has(record.id), `duplicate ${record.id}`);
    ids.add(record.id);
    const unit = unitOf(record.chapter, record.n);
    assert.ok(unit, record.id);
    assert.equal(record.unitHash, provenance.unitHashes[unit.id], `${record.id}: its halacha is the extracted one`);
    assert.ok(unit.text.includes(record.excerpt), `${record.id}: excerpt is verbatim`);
    if (record.dangerExcerpt) assert.ok(unit.text.includes(record.dangerExcerpt), `${record.id}: danger excerpt is verbatim`);
    assert.deepEqual(record.pages, unit.p);
    assert.deepEqual(record.notes, (unit.fn || []).map(([n]) => n));
    assert.equal(record.answerStatus, 'published', `${record.id}: ${(record.gateErrors || []).join(' | ')}`);
    const notesText = record.notes.map(n => notes.data.nodes.flatMap(node => node.units).find(item => item.fn === n).text).join(' ');
    const verdict = gate(record, { unitText: unit.text, notesText, chapter: record.chapter });
    assert.deepEqual(verdict.errors, [], record.id);
  }
  // Every halacha of chapters א׳–כ״ה is covered by a record or skipped with a reason.
  const covered = new Set([...ONG_SHABBAT_QA.map(record => record.unit), ...ONG_SHABBAT_SKIPPED.map(item => item.unit)]);
  for (const node of base.data.nodes.filter(item => item.n <= 25)) for (const unit of node.units) assert.ok(covered.has(`${node.n}.${unit.n}`), unit.id);
  assert.ok(ONG_SHABBAT_SKIPPED.every(item => item.reason.length > 8));
  // No question is asked twice, in the book or across the engine.
  const questions = publishedPracticalQuestions().map(entry => normalizeQuery(entry.question));
  assert.equal(new Set(questions).size, questions.length);
});

test('the three layers stay apart; a derived answer is never stronger than the book and keeps its conditions', () => {
  // The gate itself: stronger words, a hardened soft level, a dropped condition.
  assert.ok(strengthIssues({ shortAnswer: 'אסור לקנח במגבונים.', excerpt: 'מותר לקנח בנחת בכל סוגי המגבונים', unitText: 'מותר לקנח בנחת בכל סוגי המגבונים' }).length);
  assert.ok(strengthIssues({ shortAnswer: 'חייב להחמיר.', excerpt: 'וטוב להחמיר', unitText: 'וטוב להחמיר' }).length);
  assert.ok(strengthIssues({ shortAnswer: 'מצוה לעשות כך.', excerpt: 'מותר לעשות כך', unitText: 'מותר לעשות כך' }).length);
  assert.ok(strengthIssues({ shortAnswer: 'מותר לאפות.', excerpt: 'מותר לאפות, והמחמיר תבוא עליו ברכה', unitText: '' }).length, 'the soft level may not disappear');
  assert.ok(conditionIssues({ shortAnswer: 'מותר.', conditions: [], excerpt: 'מותר רק אם הוא חם' }).length);
  for (const record of ONG_SHABBAT_QA) {
    const entry = PRACTICAL_HALACHA_QA_INDEX[record.id];
    assert.equal(entry.sources[0].excerpt, record.excerpt, 'the book\'s words are the excerpt, unchanged');
    if (record.explanation) assert.notEqual(record.explanation, record.excerpt, 'the explanation is not a quote');
  }
});

test('currentness and publication: devices carry the note, high-stakes carry no derived answer', () => {
  const byClass = ONG_SHABBAT_QA.reduce((map, record) => ({ ...map, [record.currentness]: (map[record.currentness] || 0) + 1 }), {});
  for (const key of Object.values(CURRENTNESS)) assert.ok(byClass[key] > 0, key);
  for (const record of ONG_SHABBAT_QA) {
    const entry = PRACTICAL_HALACHA_QA_INDEX[record.id];
    if (MODERN_DEVICE.test(record.excerpt.normalize('NFKD').replace(/[֑-ׇ]/g, '').replace(/[״"׳']/g, ''))) assert.notEqual(record.publication, PUBLICATION.FROM_BOOK, `${record.id} names a device`);
    if ([CURRENTNESS.TECH, CURRENTNESS.REALITY].includes(record.currentness)) {
      assert.equal(record.publication, PUBLICATION.FROM_BOOK_TECH, record.id);
      assert.equal(entry.techNote, TECH_NOTE, record.id);
    }
    if (record.chapter === 20 || record.chapter === 21) assert.equal(record.currentness, CURRENTNESS.HIGH_STAKES, record.id);
    if (record.currentness === CURRENTNESS.HIGH_STAKES) {
      assert.equal(record.shortAnswer, null, record.id);
      assert.equal(record.publication, PUBLICATION.SOURCE_ONLY);
      assert.equal(entry.shortAnswer, HIGH_STAKES_ANSWER);
      assert.equal(entry.personal, true);
      assert.doesNotMatch(entry.shortAnswer, /מותר|אסור|חייב/);
    }
  }
  assert.match(TECH_NOTE, /מומלץ לברר עם רב לגבי מכשירים בני זמננו/);
  // In danger the book says to act at once: its own words go with the record (פרק כ׳, חולה שיש בו סכנה).
  assert.match(PRACTICAL_HALACHA_QA_INDEX['ong-20-35'].dangerExcerpt, /ואסור להתמהמה/);
});

test('the engine answers from the book without adjudicating: a high-stakes question returns the book\'s words and a rabbi', () => {
  const answer = groundedAnswer('אפשר לקחת אקמול בשבת?');
  assert.equal(answer.status, ANSWER_STATUS.SENSITIVE);
  assert.equal(answer.answer, null);
  assert.ok(answer.citations.some(item => /^עונג שבת, פרק כ׳, הלכה ה׳/.test(item.citation) && item.excerpt), JSON.stringify(answer.citations));
  // A model may quote the book only verbatim, and only what was retrieved.
  const retrieved = retrieve('נפל זבוב לכוס בשבת');
  const id = retrieved.entries[0].entry.sources[0].localSourceId;
  assert.equal(id, 'ong-shabbat-4-18');
  assert.ok(validateModelAnswer({ claims: [{ text: 'מותר', sourceId: id, quote: 'מותר להסירו בשבת בידו או על ידי כפית' }] }, retrieved).ok);
  assert.ok(!validateModelAnswer({ claims: [{ text: 'אסור', sourceId: id, quote: 'אסור להסירו בשבת' }] }, retrieved).ok);
  // The graph knows the book, and nothing dangles.
  const graph = buildHalachaGraph({ withRelated: false });
  assert.ok(graph.nodes.has('book:ong-shabbat'));
  assert.deepEqual(danglingEdges(graph), []);
});

// The owner's examples: each lands on the exact halacha of the book (among the answers about the question).
const EXAMPLES = [
  ['מותר מגבונים?', 'ong-5-6'],
  ['נפל זבוב לכוס', 'ong-4-18'],
  ['המקרר מדליק אור', 'ong-11-9'],
  ['הפלטה נכבתה', 'ong-9-25'],
  ['ילד רוצה לשחק בלגו', 'ong-12-10'],
  ['אפשר לקחת אקמול?', 'ong-20-5'],
  ['הדלת נפתחת עם חיישן', 'ong-22-17-a'],
  ['מותר לומר לגוי להדליק מזגן?', 'ong-23-20'],
  ['איך מחממים מרק?', 'ong-9-21-a'],
];
for (const [query, expected] of EXAMPLES) {
  test(`search "${query}" → עונג שבת ${expected}`, () => {
    const results = searchHalacha(query);
    const terms = questionKeyTerms(query);
    const about = results.unified.filter(item => item.kind === 'question' && entryRelevance(query, item.item, terms)).map(item => item.item);
    const book = about.filter(entry => entry.sourceBook === 'ong-shabbat');
    assert.equal(book[0]?.id, expected, `about: ${about.map(entry => entry.id).join(', ')}`);
    assert.ok(about.slice(0, 2).some(entry => entry.id === expected), 'the book\'s halacha is among the first answers');
  });
}

test('where the book is silent, no book answer is invented', () => {
  for (const query of ['מותר להשתמש ברובוט שואב אבק בשבת?', 'מותר לטעון רכב חשמלי בשבת?', 'מה הדין בסמארטווטש בשבת?']) {
    const terms = questionKeyTerms(query);
    const book = searchHalacha(query).unified.filter(item => item.kind === 'question' && item.item.sourceBook === 'ong-shabbat' && entryRelevance(query, item.item, terms) === 'strong');
    assert.deepEqual(book.map(item => item.item.id), [], query);
  }
});

test('Yalkut Yosef stays reachable beside the book: parallels resolve, a general question keeps its general answer', () => {
  const withParallels = ONG_SHABBAT_QA.filter(record => record.yalkutParallels?.length);
  assert.ok(withParallels.length >= 60);
  for (const record of withParallels) for (const id of record.yalkutParallels) {
    const other = PRACTICAL_HALACHA_QA_INDEX[id];
    assert.ok(other && !other.sourceBook && other.answerStatus === 'published', `${record.id} → ${id}`);
    assert.equal(other.category, record.category, `${record.id} → ${id}: same category`);
  }
  // The same matter, side by side: the Nine Days shower is not offered beside the Shabbat shower.
  assert.ok(!(PRACTICAL_HALACHA_QA_INDEX['ong-13-3-a'].yalkutParallels || []).includes('hal-moed-9d-hot-shower'));
  assert.equal(searchHalacha('כמה זמן בין בשר לחלב').questions[0].sourceBook, undefined, 'a sick person\'s case does not answer the general question');
  assert.equal(searchHalacha('מותר לפתוח את המקרר בשבת').questions[0].id, 'qa-open-fridge-shabbat');
});

test('exact links from the notes: every target exists in the bundled Shulchan Arukh, Rambam and Talmud', () => {
  const links = Object.values(ONG_SHABBAT_NOTE_LINKS).flat();
  assert.ok(links.length >= 60);
  for (const link of links) {
    if (link.kind === 'talmud') {
      const [, title, daf, amud] = link.route.match(/^talmud\/(\w+)\/(\d+)([ab])$/);
      const count = talmudCatalog.tractates.find(item => item.title === title).amudCount;
      assert.ok((daf - 2) * 2 + (amud === 'b' ? 1 : 0) < count, link.route);
      continue;
    }
    const work = workById(link.workId);
    assert.ok(link.node <= work.editions[0].expected.length && link.unit <= work.editions[0].expected[link.node - 1], JSON.stringify(link));
  }
  assert.deepEqual(ONG_SHABBAT_NOTE_LINKS[158].map(link => [link.workId, link.node, link.unit]), [['Shulchan_Arukh__Orach_Chayim', 320, 6]]);
});

test('size: the book and its notes stay small (gzip), the question layer stays under 1.8 MB raw', () => {
  assert.ok(pack.bytes < 250_000, `pack ${pack.bytes}`);
  const qa = readFileSync(new URL('../src/data/ongShabbatQa.mjs', import.meta.url));
  assert.ok(qa.length < 1_800_000, `qa ${qa.length}`);
  assert.ok(PRACTICAL_HALACHA_QA.filter(entry => entry.sourceBook === 'ong-shabbat').length === ONG_SHABBAT_QA.length);
});

test('question page: three labelled layers, the tech note, the rabbi route for high stakes, the credit line', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: OngShabbatAnswer } = loadJsx('components/halacha/OngShabbatParts.jsx');
  const render = id => renderToStaticMarkup(React.createElement(OngShabbatAnswer, { entry: PRACTICAL_HALACHA_QA_INDEX[id], go: () => {}, openSource: () => {}, nav: {} }));
  const plain = render('ong-4-18');
  assert.match(plain, /תשובה קצרה/);
  assert.match(plain, /<h2>לשון הספר<\/h2>/);
  assert.match(plain, /<h2>הסבר<\/h2>/);
  assert.match(plain, /עונג שבת, פרק ד׳, הלכה י״ח \(נפל זבוב לכוס\) · עמ׳ 70/);
  assert.match(plain, /עונג שבת · הרב ישראל שריקי · באישור המחבר, כל הזכויות שמורות/);
  const tech = ONG_SHABBAT_QA.find(record => record.publication === PUBLICATION.FROM_BOOK_TECH);
  assert.match(render(tech.id), /מומלץ לברר עם רב לגבי מכשירים בני זמננו/);
  const high = render('ong-20-35');
  assert.doesNotMatch(high, /תשובה קצרה/);
  assert.match(high, /אין כאן הכרעה למקרה אישי/);
  assert.match(high, /במצב של סכנה — כלשון הספר/);
});

function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false }) }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}
