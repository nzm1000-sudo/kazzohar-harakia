// The owner's review: זמנים no longer spills sideways; the parashot's verse ranges recede; ספרי זמננו joins מחשבה ואמונה
// (an even number of category tiles); the calendar's chosen day is named by its weekday; the weekday letters are larger.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TAXONOMY, categoryById, worksInCategory, workById } from '../src/data/library/registry.mjs';

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const css = read('styles/base.css');

test('זמנים: the location form is one column exactly the page\'s width, so nothing spills past the edge', () => {
  // Measured in the Simulator: the form's auto grid track took its widest content (423px on a 405px page).
  assert.match(css, /\.loc-form\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /\.loc-form>\*,\.profile-form label,\.loc-form details,\.loc-form form,\.loc-form label\{min-width:0\}/);
  assert.match(css, /\.profile-form select,\.loc-form form input\{width:100%;min-width:0;max-width:100%;box-sizing:border-box\}/);
  assert.doesNotMatch(css, /(^|\})\s*(html|body)\{[^}]*overflow-x:hidden/, 'no page-wide clipping to hide it');
});

test('Tanakh by parashot: the verse range stays at the 15px floor and recedes by weight and tone', () => {
  assert.match(css, /\.parasha-grid button small\{color:var\(--ink-2\);font-size:var\(--font-ui-caption\)/);
  assert.match(css, /\.parasha-grid button small\{color:color-mix\(in srgb,var\(--ink-2\) 78%,var\(--surface\)\);font-weight:400\}/);
});

test('ספרי זמננו is a group of מחשבה ואמונה, not a category of its own; the tiles are even and no book is lost', () => {
  assert.equal(categoryById('modern'), null);
  const tiles = TAXONOMY.filter(category => worksInCategory(category.id).length);
  assert.equal(tiles.length % 2, 0, `${tiles.length} tiles`);
  const machshava = categoryById('machshava');
  assert.deepEqual(machshava.groups.at(-1), ['modern', 'ספרי זמננו']);
  for (const id of ['legacy.or-hatzafon', 'legacy.sichot-avodat-levi']) {
    const work = workById(id);
    assert.ok(work, id);
    assert.equal(work.primaryCategory, 'mussar', 'still in מוסר, under אחרונים');
    assert.equal(work.group, 'acharonim');
    assert.deepEqual(work.secondaryCategories, ['machshava']);
    assert.deepEqual(work.categoryGroups, { machshava: 'modern' });
    assert.ok(worksInCategory('machshava').includes(work));
  }
  const library = read('pages/LibraryPage.jsx');
  assert.match(library, /const groupIn = \(work, id\) => \(work\.primaryCategory === id \? work\.group : work\.categoryGroups\?\.\[id\] \|\| null\);/);
  assert.match(library, /works: works\.filter\(work => groupIn\(work, category\.id\) === id\)/);
});

test('the calendar names the chosen day by its weekday — "שבת" for Saturday', async () => {
  const page = read('pages/CalendarPage.jsx');
  assert.doesNotMatch(page, /היום שנבחר/);
  assert.match(page, /<p className="eyebrow">\{weekdayName\(date\)\} · <LtrDate value=\{date\} \/><\/p>/);
  const source = page.match(/const WEEKDAY_NAMES = [^\n]+\nexport const weekdayName = [^\n]+/)[0].replace('export ', '');
  const weekdayName = new Function(`${source}; return weekdayName;`)();
  assert.deepEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map(weekdayName), ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']);
  const { WEEKDAY_NAMES } = await import('../src/services/jewishAlarm/format.mjs');
  assert.equal(WEEKDAY_NAMES[6], 'שבת', 'as השעון היהודי names it');
});

test('the calendar\'s weekday letters are larger, at the one title weight (500), in the same seven equal columns', () => {
  const rules = [...css.matchAll(/\.weekday\{([^}]+)\}/g)].map(m => m[1]);
  assert.ok(rules.at(-2).includes('font-size:19px') && rules.at(-2).includes('font-weight:500'), rules.at(-2));
  assert.match(css, /@media \(max-width:860px\)\{\.weekday\{min-height:40px;font-size:18px\}\}/, 'a phone: 13px → 18px');
  assert.match(css, /\.calendar-grid\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
});
