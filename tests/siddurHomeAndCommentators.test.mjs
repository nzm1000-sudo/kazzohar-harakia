// Owner review: the Siddur home's one order of categories (every rite), the blessings engine as its own category, and
// the מפרשים tab's commentator picker (only commentators with something in the passage; a choice shows that one alone)
// on every Torah path — chapter, weekly portion, פרשת השבוע readings and שניים מקרא.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { SIDDUR_HOME_ORDER, SIDDUR_LAYOUTS, orderSiddurHome } from '../src/data/nusach/siddurLayouts.mjs';
import { commentatorsOnVerse } from '../src/services/torah/commentaries.mjs';
import { parashotOf } from '../src/services/parashot.mjs';
import { loadJsx } from './helpers/jsx.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const panel = loadJsx('components/CommentaryPanel.jsx');
const render = props => renderToStaticMarkup(React.createElement(panel.PassageCommentaries, { choice: null, onChoose: () => {}, ...props }));
const chips = html => [...html.matchAll(/role="tab" aria-selected="(true|false)"[^>]*>([^<]+)</g)].map(([, on, name]) => (on === 'true' ? `[${name}]` : name));
const sections = html => [...html.matchAll(/<h2 class="library-layer-title">([^<]+)<\/h2>/g)].map(m => m[1]);

test('the Siddur home: one order of categories for every rite, the engine last under ברכות', () => {
  assert.deepEqual(SIDDUR_HOME_ORDER.map(entry => entry.title), ['תפילות החול', 'ראש חודש ותעניות', 'שבת', 'פיוטים וזמירות', 'מועדים', 'ברכות', 'מנוע הברכות החכם']);
  assert.equal(SIDDUR_HOME_ORDER.at(-1).note, 'מה מברכים על קשיו?');
  const titleOf = new Map(SIDDUR_HOME_ORDER.map(entry => [entry.key, entry.title]));
  for (const [id, layout] of Object.entries(SIDDUR_LAYOUTS)) {
    const keys = layout.groups.map(group => group.key);
    assert.deepEqual(orderSiddurHome(keys, key => key), keys, `${id}: the layout lists its groups in the home order`);
    for (const group of layout.groups) assert.equal(group.title, titleOf.get(group.key), `${id}: ${group.key} carries the category's name`);
    // Nothing of a rite is lost: every family keeps its roots (Chabad's Shabbat keeps its "missing" note).
    for (const key of ['weekday', 'seasons', 'shabbat', 'blessings']) assert.ok(layout.groups.some(group => group.key === key), `${id}: ${key}`);
  }
  assert.equal(SIDDUR_LAYOUTS['edot-hamizrach'].groups.some(group => group.key === 'moadim'), false, 'Edot HaMizrach: מועדים is the festival shelf');
  assert.match(SIDDUR_LAYOUTS.chabad.groups.find(group => group.key === 'shabbat').missing, /אינן במקור המורשה/);
  // The page's pieces (layout groups, the festival shelf, zemirot, the engine, "עוד בסידור") fall into that order.
  const page = ['weekday', 'seasons', 'blessings', 'shabbat', 'more', 'moadim', 'zemirot', 'brachot'].map(key => ({ key }));
  assert.deepEqual(orderSiddurHome(page).map(item => item.key), ['weekday', 'seasons', 'shabbat', 'zemirot', 'moadim', 'blessings', 'brachot', 'more']);
  const books = read('pages/BooksPage.jsx');
  assert.match(books, /const homeCategories=orderSiddurHome\(\[\.\.\.groups\.map\(group=>\(\{key:group\.key,element:groupElement\(group\)\}\)\),\.\.\.\(moadimGroup\?\[\{key:'moadim',element:moadimGroup\}\]:\[\]\),\{key:'zemirot',element:zemirotGroup\},\{key:'brachot',element:brachotCategory\}\]\)/);
  assert.match(books, /<div className="siddur-groups">\{homeCategories\}<\/div>/);
});

test('the commentator picker shows only commentators with something in the passage; the first is chosen by default', () => {
  const html = render({ baseWorkId: 'Genesis', passage: { from: [1, 0], to: [1, Infinity] } });
  const names = chips(html);
  assert.equal(names[0], '[רש״י]', 'the first available commentator is selected');
  assert.ok(names.includes('רמב״ן') && names.includes('אבן עזרא') && names.includes('ספורנו'));
  assert.equal(names.at(-1), 'הכל');
  assert.match(html, /<div class="commentator-picker" role="tablist" aria-label="בחירת מפרש">/);
  assert.deepEqual(sections(html), ['רש״י'], 'only the chosen commentator is shown');
  // A verse: only the commentators with a comment on it.
  const verse = render({ baseWorkId: 'Genesis', passage: { from: [1, 0], to: [1, Infinity] }, focusVerse: { c: 1, v: 1 } });
  const bundled = chips(verse).map(name => name.replace(/[[\]]/g, '')).filter(name => name !== 'הכל');
  const onVerse = commentatorsOnVerse('Genesis', 1, 1).map(layer => layer.title);
  assert.deepEqual(bundled.slice(0, onVerse.length), onVerse);
  const quiet = commentatorsOnVerse('Genesis', 1, 2).map(layer => layer.title);
  const onTwo = chips(render({ baseWorkId: 'Genesis', passage: { from: [1, 0], to: [1, Infinity] }, focusVerse: { c: 1, v: 2 } })).map(name => name.replace(/[[\]]/g, ''));
  for (const name of ['רש״י', 'רמב״ן', 'אבן עזרא', 'ספורנו', 'אור החיים', 'כלי יקר']) assert.equal(onTwo.includes(name), quiet.includes(name), `${name} on Genesis 1:2`);
});

test('a chosen commentator is shown alone; "הכל" shows every one; an unavailable choice falls back to the first', () => {
  const passage = { from: [1, 0], to: [1, Infinity] };
  const ramban = render({ baseWorkId: 'Genesis', passage, choice: 'רמב״ן' });
  assert.ok(chips(ramban).includes('[רמב״ן]'));
  assert.deepEqual(sections(ramban), ['רמב״ן']);
  const all = render({ baseWorkId: 'Genesis', passage, choice: 'all' });
  assert.ok(chips(all).includes('[הכל]'));
  assert.ok(sections(all).length >= 6);
  assert.deepEqual(sections(render({ baseWorkId: 'Genesis', passage, choice: 'ברטנורא' })), ['רש״י']);
  // A deep link to one comment shows its commentator, whatever was chosen before.
  assert.deepEqual(sections(render({ baseWorkId: 'Genesis', passage, choice: 'רש״י', focus: 'Sforno_on_Genesis.1.1' })), ['ספורנו']);
  // The same component serves the Mishnah.
  const mishnah = render({ baseWorkId: 'Mishnah_Berakhot', passage: { from: [1, 0], to: [1, Infinity] }, unitLabel: 'משנה' });
  assert.deepEqual(chips(mishnah), ['[ברטנורא]', 'תוספות יום טוב', 'הכל']);
  // The choice is remembered per reader family, in localStorage, guarded.
  const source = read('components/CommentaryPanel.jsx');
  assert.match(source, /try \{ localStorage\.setItem\(CHOICE_STORE/);
  assert.match(source, /try \{ const saved = JSON\.parse\(localStorage\.getItem\(CHOICE_STORE\)/);
});

test('a weekly portion: the מפרשים tab covers the whole portion, chapter by chapter', () => {
  const bereshit = parashotOf('Genesis')[0];
  const html = render({ baseWorkId: 'Genesis', passage: { from: bereshit.from, to: bereshit.to } });
  assert.equal(chips(html)[0], '[רש״י]');
  const marks = [...html.matchAll(/<p class="library-chapter-mark"><span>([^<]+)<\/span><\/p>/g)].map(m => m[1]);
  assert.equal(marks.length, bereshit.to[0] - bereshit.from[0] + 1);
  assert.equal(marks[0], 'פרק א׳');
  assert.deepEqual(sections(html), [], 'one commentator chosen: its name is on the chip, not repeated per chapter');
  // One verse of the portion, from the chips under it.
  const verse = render({ baseWorkId: 'Genesis', passage: { from: bereshit.from, to: bereshit.to }, focusVerse: { c: 2, v: 4 }, onClearFocus: () => {}, clearLabel: 'כל הפרשה', choice: 'רמב״ן' });
  assert.match(verse, /מפרשים על פסוק ד׳ בפרק ב׳ · <button type="button">כל הפרשה<\/button>/);
  assert.deepEqual(sections(verse), ['רמב״ן']);
});

test('the chips under a verse open that commentator directly', () => {
  const opened = [];
  const line = panel.VerseLayersLine({ layers: commentatorsOnVerse('Genesis', 1, 1), label: 'מפרשים', unitLabel: 'פסוק', verse: 1, onOpen: name => opened.push(name) });
  const buttons = React.Children.toArray(line.props.children).filter(child => child.type === 'button');
  assert.equal(buttons.length, commentatorsOnVerse('Genesis', 1, 1).length);
  buttons[1].props.onClick();
  assert.deepEqual(opened, [commentatorsOnVerse('Genesis', 1, 1)[1].title]);
  const library = read('pages/LibraryPage.jsx');
  assert.match(library, /onOpen=\{name => \{ chooseCommentator\(name\); setLayerTab\('commentary'\); \}\}/, 'chapter view');
  assert.match(library, /onOpen=\{name => openPortionCommentary\(chapter\.n, item\.n, name\)\}/, 'weekly portion');
  assert.match(library, /seifLayers\?\.get\(item\.n\) && <VerseLayersLine/, 'Shulchan Arukh seif line');
});
