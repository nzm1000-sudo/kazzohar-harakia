// לעצמי · דברי חכמים — every saying is an exact substring of its unit in the bundled pack (nothing written or edited),
// carries its licence and attribution as the library records the edition, opens the source in the library; Pirkei Avot
// is there whole; the daily rotation never repeats within the collection's length.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { workById } from '../src/data/library/registry.mjs';
import * as DATA from '../src/data/divreiChachamim.mjs';
import { dayNumber, sayingAt, sayingForDay, sayingIndexForDay } from '../src/services/leatzmi/divreiChachamim.mjs';
import { parseLibraryRouteForTest } from './helpers/libraryRoute.mjs';

const { WORKS, SAYINGS } = DATA;
const chunks = new Map();
const chunkOf = work => {
  const key = `${work.packId}/${work.file}`;
  if (!chunks.has(key)) chunks.set(key, JSON.parse(gunzipSync(readFileSync(new URL(`../public/library/packs/${key}`, import.meta.url))).toString('utf8')));
  return chunks.get(key);
};
const plain = text => text.replace(/[֑-ׇ]/g, '');

test('several hundred sayings, each exact: a substring of its own unit, at the offset its id names', () => {
  assert.ok(SAYINGS.length >= 500, `${SAYINGS.length} sayings`);
  const ids = new Set();
  for (const [id, workIndex, node, unit, place, text] of SAYINGS) {
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
  for (const [id, workIndex, node, unit, , text] of SAYINGS) {
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
  for (const [id, workIndex, , , , text] of SAYINGS) {
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
      const parts = SAYINGS.filter(row => row[1] === avotIndex && row[2] === node.n && row[3] === unit.n).map(row => row[5]);
      assert.ok(parts.length >= 1, `Avot ${node.n}:${unit.n}`);
      assert.equal(plain(parts.join(' ')).replace(/\s+/g, ' '), plain(unit.text).trim().replace(/\s+/g, ' '), `Avot ${node.n}:${unit.n} whole`);
    }
  }
  assert.equal(units, avot.editions[0].nodes.reduce((a, b) => a + b, 0));
});

test('licence and attribution: as the library records each edition; every work and licence accounted for', () => {
  const licences = new Set(['public-domain', 'cc-by', 'cc-by-sa', 'cc-by-nc']);
  for (const work of WORKS) {
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
    assert.ok(['משנה', 'גמרא', 'מסכתות קטנות', 'מוסר', 'חסידות', 'מחשבה'].includes(work.group));
  }
  const used = new Set(SAYINGS.map(row => row[1]));
  assert.equal(used.size, WORKS.length, 'no work without sayings');
});

test('a saying opens its source in the library reader, at its unit', () => {
  for (let index = 0; index < SAYINGS.length; index += 13) {
    const saying = sayingAt(DATA, index);
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
