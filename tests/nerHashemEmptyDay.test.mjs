// נר ה' נשמת אדם — a day with no record shows one quiet line, "הדליקו נר לרחל אמנו", and only then; the research data
// stays whole (unique ids and names, valid dates, a source behind every record) and the generated list is current.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { Module, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HDate } from '@hebcal/core';
import { YAHRZEITS } from '../src/data/yahrzeits.mjs';
import { yahrzeitsOn, spokenSummary, EMPTY_DAY_LINE, MONTH } from '../src/services/yahrzeits.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const source = fileURLToPath(new URL('../src/components/NerHashem.jsx', import.meta.url));
const compiled = buildSync({
  entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false,
  loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env': '{}' },
  external: ['react', 'react/jsx-runtime'],
}).outputFiles[0].text;
const mod = new Module(source);
mod.filename = source;
mod.paths = Module._nodeModulePaths(root);
mod._compile(compiled, source);
const NerHashem = mod.exports.default;
const render = hebrewDate => renderToStaticMarkup(createElement(NerHashem, { hebrewDate }));

// every day of a year, with the list the strip shows
const daysOf = year => {
  const out = [];
  for (let d = new HDate(1, 7, year); d.getFullYear() === year; d = d.next()) {
    const month = d.getMonth();
    const hebrewDate = { day: d.getDate(), month, year };
    out.push({ hebrewDate, list: yahrzeitsOn(hebrewDate, YAHRZEITS, { monthLengths: { [month]: HDate.daysInMonth(month, year) } }) });
  }
  return out;
};

test('the empty-day line: the standard spelling, one quiet line, and what VoiceOver says', () => {
  assert.equal(EMPTY_DAY_LINE, 'הדליקו נר לרחל אמנו');
  assert.equal(spokenSummary([]), "נר ה' נשמת אדם. הדליקו נר לרחל אמנו.");
  assert.doesNotMatch(spokenSummary([YAHRZEITS[0]]), /רחל אמנו\./);
});

for (const year of [5786, 5787]) {
  test(`${year}: the line shows on every day with no record and on no day that has one`, () => {
    const days = daysOf(year);
    assert.ok(days.length >= 353 && days.length <= 385, `${days.length}`);
    let empty = 0;
    for (const { hebrewDate, list } of days) {
      const html = render(hebrewDate);
      const where = `${hebrewDate.day}/${hebrewDate.month}/${year}`;
      if (list.length) {
        assert.ok(!html.includes(EMPTY_DAY_LINE), `${where}: a day with a record never shows (or speaks) the line`);
        assert.ok(html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').includes(list[0].displayNameHe), `${where}: the name`);
      } else {
        empty++;
        assert.equal(html.split(`>${EMPTY_DAY_LINE}<`).length - 1, 1, `${where}: exactly one visible line`);
        assert.match(html, /class="ner-hashem is-empty-day"/, where);
        assert.match(html, /<span class="ner-person ner-empty-day"><span class="ner-empty-line">הדליקו נר לרחל אמנו<\/span><\/span>/, where);
        assert.doesNotMatch(html, /ner-name|ner-more/, `${where}: not a name`);
        assert.ok(html.includes(`aria-label="נר ה&#x27; נשמת אדם. הדליקו נר לרחל אמנו."`), `${where}: spoken`);
      }
    }
    assert.ok(empty < days.length, 'most days carry a name');
  });
}

test('the line in a known filled day and the 18th of Tishrei', () => {
  const html = render({ day: 18, month: MONTH.Tishrei, year: 5787 });
  assert.match(html, /רבי נחמן מברסלב/);
  assert.ok(!html.includes(EMPTY_DAY_LINE));
  assert.ok(!render(null).includes(EMPTY_DAY_LINE), 'no date at all: no line');
});

test('data integrity: unique ids and names, valid dates and Adar rules, a source behind every record', () => {
  assert.equal(new Set(YAHRZEITS.map(r => r.id)).size, YAHRZEITS.length, 'unique ids');
  const norm = s => s.replace(/[֑-ׇ"'״׳]/g, '').replace(/\s+/g, ' ').trim();
  assert.equal(new Set(YAHRZEITS.map(r => norm(r.displayNameHe))).size, YAHRZEITS.length, 'unique names');
  const research = new Map();
  const dir = new URL('../docs/yahrzeits/research/', import.meta.url);
  for (const file of readdirSync(dir).filter(n => n.endsWith('.json'))) {
    for (const r of JSON.parse(readFileSync(new URL(file, dir), 'utf8')).accepted || []) research.set(r.id, r);
  }
  for (const r of YAHRZEITS) {
    const { day, month, leapYearPolicy } = r.hebrewDate;
    assert.ok(Object.hasOwn(MONTH, month), `${r.id}: month ${month}`);
    const max = ['Tishrei', 'Shevat', 'AdarI', 'Nisan', 'Sivan', 'Av', 'Cheshvan', 'Kislev'].includes(month) ? 30 : 29;
    assert.ok(Number.isInteger(day) && day >= 1 && day <= max, `${r.id}: day ${day} of ${month}`);
    if (month === 'Adar') assert.match(String(leapYearPolicy), /^(adar1|adar2|both)$/, `${r.id}: an Adar death says how a leap year keeps it`);
    assert.ok(r.honorific, `${r.id}: honorific`);
    assert.doesNotMatch(`${r.displayNameHe} ${r.honorific}`, /["”]/, `${r.id}: gershayim (״), never a stray ASCII double quote`);
    const raw = research.get(r.id);
    assert.ok(raw, `${r.id}: in the research`);
    assert.ok(raw.sources?.length >= 1 && raw.sources.every(s => s.name && (s.url || s.says)), `${r.id}: sourced`);
  }
  const doc = readFileSync(new URL('../docs/yahrzeits/famous-tzadikim-research.md', import.meta.url), 'utf8');
  for (const r of YAHRZEITS) assert.ok(doc.includes(`| ${r.displayNameHe} ${r.honorific}`), `${r.id}: in the research record`);
});

test('the generator is deterministic and the committed list is what it produces', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'yahrzeits-'));
  try {
    cpSync(join(root, 'docs/yahrzeits'), join(tmp, 'docs/yahrzeits'), { recursive: true });
    mkdirSync(join(tmp, 'src/data'), { recursive: true });
    const script = join(root, 'scripts/build-yahrzeits.mjs');
    const run = () => {
      execFileSync(process.execPath, [script], { cwd: tmp, stdio: 'pipe' });
      return [readFileSync(join(tmp, 'src/data/yahrzeits.mjs'), 'utf8'), readFileSync(join(tmp, 'docs/yahrzeits/famous-tzadikim-research.md'), 'utf8')];
    };
    const first = run(); const second = run();
    assert.deepEqual(first, second, 'the same input, the same output');
    assert.equal(first[0], readFileSync(join(root, 'src/data/yahrzeits.mjs'), 'utf8'), 'src/data/yahrzeits.mjs is current');
    assert.equal(first[1], readFileSync(join(root, 'docs/yahrzeits/famous-tzadikim-research.md'), 'utf8'), 'the research record is current');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
