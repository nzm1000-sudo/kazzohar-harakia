// לעצמי · דברי חכמים — every saying from the packs is an exact substring of its unit in the bundled pack (nothing written
// or edited), carries its licence and attribution as the library records the edition, opens the source in the library;
// Pirkei Avot is there whole. Every saying gathered from the web (scripts/leatzmi/divrei-chachamim-web.mjs) carries its
// book, place, link, public-domain basis and date, is unvocalized and unique, and — when its book is bundled — is found
// letter for letter in that pack, at the unit the card opens. The daily rotation never repeats within the collection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { workById } from '../src/data/library/registry.mjs';
import * as DATA from '../src/data/divreiChachamim.mjs';
import { dayNumber, sayingAt, sayingForDay, sayingIndexForDay } from '../src/services/leatzmi/divreiChachamim.mjs';
import { parseLibraryRouteForTest } from './helpers/libraryRoute.mjs';
import { WEB_BOOKS, WEB_SAYINGS } from '../scripts/leatzmi/divrei-chachamim-web.mjs';

const { WORKS, SAYINGS } = DATA;
const fromWeb = row => WORKS[row[1]].origin === 'web';
const PACK_SAYINGS = SAYINGS.filter(row => !fromWeb(row));
const WEB_ROWS = SAYINGS.filter(fromWeb);
const letters = text => String(text).replace(/[\u0591-\u05C7]/g, '').replace(/[^א-ת]/g, '');
const chunks = new Map();
const chunkOf = work => {
  const key = `${work.packId}/${work.file}`;
  if (!chunks.has(key)) chunks.set(key, JSON.parse(gunzipSync(readFileSync(new URL(`../public/library/packs/${key}`, import.meta.url))).toString('utf8')));
  return chunks.get(key);
};
const plain = text => text.replace(/[֑-ׇ]/g, '');
const GROUPS = ['משנה', 'גמרא', 'מסכתות קטנות', 'מוסר', 'חסידות', 'מחשבה', 'מדרש', 'הלכה'];

test('about a thousand sayings; each from the packs exact: a substring of its own unit, at the offset its id names', () => {
  assert.ok(SAYINGS.length >= 950, `${SAYINGS.length} sayings`);
  assert.ok(PACK_SAYINGS.length >= 500, `${PACK_SAYINGS.length} from the packs`);
  assert.equal(new Set(SAYINGS.map(row => row[0])).size, SAYINGS.length, 'every id once');
  const ids = new Set();
  for (const [id, workIndex, node, unit, place, text] of PACK_SAYINGS) {
    assert.ok(!ids.has(id), `${id} once`);
    ids.add(id);
    const work = WORKS[workIndex];
    const [workId, idNode, idUnit, offset] = id.split(':');
    assert.equal(workId, work.workId);
    assert.equal(Number(idNode), node);
    assert.equal(Number(idUnit), unit);
    const source = chunkOf(work).nodes.find(item => item.n === node)?.units.find(item => item.n === unit)?.text;
    assert.ok(source, `${id}: the unit exists`);
    assert.equal(source.slice(Number(offset), Number(offset) + text.length), text, `${id}: exact text at its offset`);
    assert.equal(text, text.trim(), `${id}: no stray spaces`);
    assert.ok(place && typeof place === 'string');
    assert.ok(!/<[^>]+>/.test(text), `${id}: no markup`);
  }
});

test('cut only at whole sentences: a saying starts at the unit\'s start, after a sentence end, or after the speaker\'s "ואמר"', () => {
  for (const [id, workIndex, node, unit, , text] of PACK_SAYINGS) {
    const work = WORKS[workIndex];
    const source = chunkOf(work).nodes.find(item => item.n === node).units.find(item => item.n === unit).text;
    const offset = Number(id.split(':')[3]);
    const before = plain(source.slice(0, offset)).trim();
    const okStart = !before || /[.:!?]$/.test(before) || /^ו?אמר(?: החכם| המחבר)?[.:,]?$/.test(before) || /^[א-ת]{1,3}[.)]$/.test(before);
    assert.ok(okStart, `${id}: starts at a sentence boundary (${before.slice(-20)})`);
    const after = plain(source.slice(offset + text.length)).trim();
    assert.ok(!after || /[.:!?]$/.test(plain(text)), `${id}: ends at a sentence end`);
  }
});

test('short and quiet: within the length limits, no apparatus, no question, Pirkei Avot is there whole', () => {
  for (const [id, workIndex, , , , text] of PACK_SAYINGS) {
    const avot = WORKS[workIndex].workId === 'Pirkei_Avot';
    const length = plain(text).length;
    if (!avot) {
      assert.ok(length >= 40 && length <= 280, `${id}: ${length} characters`);
      assert.ok(!/[()[\]{}<>?]/.test(text), `${id}: no apparatus or question`);
      assert.ok(!/וכו['׳]|הנ["״]ל|לעיל/.test(plain(text)), `${id}: no back-references`);
    }
  }
  // Every mishnah of Avot: each unit is covered from its first letter to its last.
  const avotIndex = WORKS.findIndex(work => work.workId === 'Pirkei_Avot');
  const avot = workById('Pirkei_Avot');
  const chunk = chunkOf(WORKS[avotIndex]);
  let units = 0;
  for (const node of chunk.nodes) {
    for (const unit of node.units) {
      units += 1;
      const parts = PACK_SAYINGS.filter(row => row[1] === avotIndex && row[2] === node.n && row[3] === unit.n).map(row => row[5]);
      assert.ok(parts.length >= 1, `Avot ${node.n}:${unit.n}`);
      assert.equal(plain(parts.join(' ')).replace(/\s+/g, ' '), plain(unit.text).trim().replace(/\s+/g, ' '), `Avot ${node.n}:${unit.n} whole`);
    }
  }
  assert.equal(units, avot.editions[0].nodes.reduce((a, b) => a + b, 0));
});

test('licence and attribution: as the library records each edition; every work and licence accounted for', () => {
  const licences = new Set(['public-domain', 'cc-by', 'cc-by-sa', 'cc-by-nc']);
  for (const work of WORKS.filter(item => item.origin !== 'web')) {
    const edition = workById(work.workId).editions[0];
    assert.equal(work.license, edition.license, work.workId);
    assert.ok(licences.has(work.license), `${work.workId}: ${work.license}`);
    assert.equal(work.packId, edition.packId);
    assert.equal(work.editionId, edition.editionId);
    assert.equal(work.checksum, edition.checksum, `${work.workId}: generated from the current pack`);
    assert.ok(work.attribution.includes(work.title) || work.attribution.includes(work.title.split(' · ').pop()), `${work.workId}: attribution names the work`);
    assert.ok(work.licenseTitle && work.attribution.length > 10);
    if (work.license !== 'public-domain') assert.ok(work.attribution.includes(work.licenseTitle) || /CC BY/.test(work.attribution), `${work.workId}: the licence is named`);
    assert.equal(work.nonCommercial, work.license.includes('-nc'));
    assert.ok(GROUPS.includes(work.group));
  }
  const used = new Set(SAYINGS.map(row => row[1]));
  assert.equal(used.size, WORKS.length, 'no work without sayings');
});

test('a saying opens its source in the library reader, at its unit (one whose book the library lacks has no route)', () => {
  for (let index = 0; index < SAYINGS.length; index += 7) {
    const saying = sayingAt(DATA, index);
    assert.ok(saying.attribution && saying.license && saying.via);
    if (saying.node == null) {
      assert.equal(saying.route, null, `${saying.id}: no library route`);
      assert.equal(saying.origin, 'web');
      assert.match(saying.provenanceUrl, /^https:\/\//);
      assert.ok(saying.source.startsWith(saying.title));
      continue;
    }
    const parsed = parseLibraryRouteForTest(saying.route);
    assert.equal(parsed.view, 'read');
    assert.equal(parsed.id, saying.workId);
    assert.equal(parsed.node, saying.node);
    assert.equal(parsed.unit, saying.unit);
    assert.ok(saying.source.startsWith(saying.title));
    assert.ok(saying.attribution && saying.license);
  }
});

test('the daily rotation: stable for a day, a different saying each day, none again within the collection\'s length', () => {
  const n = SAYINGS.length;
  assert.equal(sayingForDay(DATA, '2026-10-01').id, sayingForDay(DATA, '2026-10-01').id);
  assert.equal(dayNumber('2026-10-02') - dayNumber('2026-10-01'), 1);
  const start = Date.parse('2026-10-01T12:00:00Z');
  const seen = new Set();
  for (let k = 0; k < n; k += 1) {
    const day = new Date(start + k * 86_400_000).toISOString().slice(0, 10);
    const index = sayingIndexForDay(day, n);
    assert.ok(index >= 0 && index < n);
    assert.ok(!seen.has(index), `day ${day} repeats`);
    seen.add(index);
  }
  assert.equal(seen.size, n, 'every saying within n days');
  // Neighbouring days come from different books more often than not.
  let sameWork = 0;
  for (let k = 0; k < 60; k += 1) {
    const a = sayingAt(DATA, sayingIndexForDay(new Date(start + k * 86_400_000).toISOString().slice(0, 10), n));
    const b = sayingAt(DATA, sayingIndexForDay(new Date(start + (k + 1) * 86_400_000).toISOString().slice(0, 10), n));
    if (a.workId === b.workId) sameWork += 1;
  }
  assert.ok(sameWork < 30, `${sameWork} of 60 neighbouring days from the same work`);
  assert.equal(sayingIndexForDay('2026-10-01', 0), -1);
  assert.equal(sayingAt(DATA, 99999), null);
});

// ---------- the sayings gathered from the web ----------
const WEB_BY_ID = new Map(WEB_SAYINGS.map(item => [item.id, item]));
const bundledText = new Map();
const bundledLettersOf = workId => {
  if (!bundledText.has(workId)) {
    const edition = workById(workId).editions[0];
    const chunk = chunkOf(edition);
    const starts = [];
    let all = '';
    for (const node of chunk.nodes) for (const unit of node.units || []) { starts.push({ at: all.length, node: node.n, unit: unit.n }); all += letters(String(unit.text || '').replace(/\([^()]*\)/g, ' ')); }
    bundledText.set(workId, { all, starts });
  }
  return bundledText.get(workId);
};

test('web sayings: each with its book, place, link, public-domain basis and date — unvocalized, whole, within bounds, no repeats', () => {
  assert.ok(WEB_SAYINGS.length >= 300, `${WEB_SAYINGS.length} from the web`);
  const ids = new Set();
  for (const item of WEB_SAYINGS) {
    const book = WEB_BOOKS[item.book];
    assert.ok(book, `${item.id}: its book`);
    assert.ok(!ids.has(item.id), `${item.id} once`);
    ids.add(item.id);
    assert.ok(book.title && book.basis && book.digital?.site && book.digital?.version && book.punctuation, `${item.book}: title, public-domain basis, digital source`);
    assert.ok(GROUPS.includes(book.group), `${item.book}: ${book.group}`);
    assert.ok(['sefaria', 'bundled'].includes(book.source));
    assert.equal(item.licence, 'public-domain', item.id);
    assert.match(item.retrieved, /^\d{4}-\d{2}-\d{2}$/, item.id);
    assert.ok(item.ref && item.ref.length >= 2, `${item.id}: a place`);
    assert.match(item.provenanceUrl, /^https:\/\/(www\.sefaria\.org|he\.wikisource\.org)\//, `${item.id}: a link`);
    const text = item.text;
    assert.equal(text, text.trim(), `${item.id}: no stray spaces`);
    assert.ok(!/[֑-ׇ]/.test(text), `${item.id}: unvocalized`);
    assert.ok(!/[()[\]{}<>?"“”„]/.test(text.replace(/[א-ת]["״][א-ת]/g, '')), `${item.id}: no brackets, quotation marks or questions`);
    assert.match(text, /\.$/, `${item.id}: ends a sentence`);
    const length = text.length;
    assert.ok(length >= 15 && length <= 300, `${item.id}: ${length} characters`);
    // A transcription that is not itself public domain lends its words only: none of its punctuation is kept.
    if (book.digital.licence !== 'Public Domain' && book.digital.licence !== 'public-domain') assert.ok(!/[,.:;!]/.test(text.slice(0, -1)), `${item.id}: the transcription's punctuation left out`);
    if (book.source === 'sefaria') {
      assert.ok(item.sefariaRef, `${item.id}: its Sefaria reference`);
      assert.ok(item.provenanceUrl.startsWith('https://www.sefaria.org/'), item.id);
    }
  }
  // Letter for letter, no saying twice in the whole collection.
  const seen = new Map();
  for (const row of SAYINGS) {
    const key = letters(row[5]);
    assert.ok(!seen.has(key), `${row[0]} repeats ${seen.get(key)}`);
    seen.set(key, row[0]);
  }
});

test('web sayings in the collection: every one, in its book, as the source file has it; the works carry their public-domain basis', () => {
  assert.equal(WEB_ROWS.length, WEB_SAYINGS.length, 'every web saying is in the collection');
  for (const [id, workIndex, , , place, text, url] of WEB_ROWS) {
    const item = WEB_BY_ID.get(id);
    assert.ok(item, `${id}: from the source file`);
    assert.equal(text, item.text);
    assert.equal(place, item.ref);
    assert.equal(url, item.provenanceUrl);
    const work = WORKS[workIndex];
    const book = WEB_BOOKS[item.book];
    assert.equal(work.title, book.source === 'bundled' ? workById(book.bundled).title : book.title);
    assert.equal(work.license, 'public-domain');
    assert.equal(work.licenseTitle, 'נחלת הכלל');
    assert.ok(work.attribution.includes(work.title) && work.attribution.includes(book.basis), `${work.workId}: attribution names the work and its basis`);
    assert.ok(work.via && work.edition === book.basis);
  }
  for (const work of WORKS.filter(item => item.origin === 'web')) {
    assert.ok(work.workId.startsWith('web:') || workById(work.workId), work.workId);
    if (!work.workId.startsWith('web:')) assert.equal(work.checksum, workById(work.workId).editions[0].checksum, `${work.workId}: placed in the current pack`);
  }
});

test('every web saying whose book the app bundles is found letter for letter in that pack, at the unit the card opens', () => {
  let checked = 0;
  for (const [id, , node, unit, , text] of WEB_ROWS) {
    const item = WEB_BY_ID.get(id);
    const book = WEB_BOOKS[item.book];
    if (book.source !== 'bundled') {
      assert.equal(node, null, `${id}: not in the library`);
      continue;
    }
    const { all, starts } = bundledLettersOf(book.bundled);
    const at = all.indexOf(letters(text));
    assert.ok(at >= 0, `${id}: in the bundled ${book.bundled}`);
    const start = starts.filter(entry => entry.at <= at).at(-1);
    assert.deepEqual([node, unit], [start.node, start.unit], `${id}: placed at its unit`);
    checked += 1;
  }
  assert.ok(checked >= 100, `${checked} checked against the packs`);
});
