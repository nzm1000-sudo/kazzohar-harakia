// מקרא → מפרשים → a commentator → a book → a portion → a chapter, and from one commentator to another at the same
// place: the portions of a commentary follow its base book; the commentators on a chapter are one tap away; a switch
// keeps the book, the chapter (the portion) and the verse; every step has its way back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workById } from '../src/data/library/registry.mjs';
import { chapterCommentators, commentaryBase, parashotFor, parashotOfChapter, switchTarget } from '../src/services/library/commentators.mjs';
import { loadJsx } from './helpers/jsx.mjs';

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

test('a commentary on the Torah is divided by its base book\'s weekly portions (כלי יקר → בראשית → פרשת נח)', () => {
  const kli = workById('Kli_Yakar_on_Genesis');
  assert.equal(commentaryBase(kli).workId, 'Genesis');
  const portions = parashotFor(kli);
  assert.equal(portions.length, 12);
  assert.deepEqual(portions[1], { id: 'noach', title: 'פרשת נח', he: 'נח', from: [6, 9], to: [11, 32] });
  assert.deepEqual(parashotOfChapter(kli, 6).map(item => item.id), ['bereshit', 'noach'], 'a chapter that opens in one portion and closes in the next');
  assert.deepEqual(parashotOfChapter(kli, 12).map(item => item.id), ['lech-lecha']);
  assert.equal(parashotFor(workById('Rashi_on_Isaiah')).length, 0, 'the Prophets have no weekly portions');
  assert.equal(commentaryBase(workById('Genesis')), null, 'the Tanakh itself is not a commentary');
});

test('the commentators on a chapter: once each, in their customary order, the one being read marked', () => {
  const kli = workById('Kli_Yakar_on_Genesis');
  const list = chapterCommentators(kli, 12);
  const names = list.map(item => item.name);
  assert.equal(new Set(names).size, names.length, 'no commentator twice');
  assert.deepEqual(names.slice(0, 6), ['רש״י', 'רמב״ן', 'אבן עזרא', 'ספורנו', 'אור החיים', 'כלי יקר']);
  assert.deepEqual(list.filter(item => item.current).map(item => item.name), ['כלי יקר']);
  assert.ok(list.some(item => item.remote), 'those read live are offered too');
  const bundled = list.filter(item => !item.remote);
  assert.ok(bundled.every(item => workById(item.workId)?.kind === 'pack'));
  // A second work of the same commentator on the book (אבן עזרא הקצר) stays the one being read.
  const short = chapterCommentators(workById('Ibn_Ezra_HaKatzar_on_Exodus'), 3).find(item => item.current);
  assert.equal(short.workId, 'Ibn_Ezra_HaKatzar_on_Exodus');
});

test('switching keeps the place: a bundled commentator opens at the same chapter and verse; a live one in the מפרשים tab', () => {
  const kli = workById('Kli_Yakar_on_Genesis');
  const list = chapterCommentators(kli, 12);
  assert.deepEqual(switchTarget(list.find(item => item.name === 'רש״י'), kli, 12, 5), { kind: 'read', workId: 'Rashi_on_Genesis', node: 12, verse: 5 });
  const live = list.find(item => item.remote);
  const target = switchTarget(live, kli, 12, 5);
  assert.equal(target.kind, 'commentary');
  assert.equal(target.baseWorkId, 'Genesis');
  assert.equal(target.node, 12);
  assert.equal(target.verse, 5);
  assert.deepEqual(target.choice, { key: 'tanakh', name: live.layerName });
});

test('routes: a commentary opened at a verse; the old routes are unchanged', () => {
  const { parseLibraryRoute, libraryRoute } = loadJsx('pages/LibraryPage.jsx');
  assert.equal(libraryRoute.readVerse('Rashi_on_Genesis', 12, 5), 'books/r/Rashi_on_Genesis/12/v5');
  assert.deepEqual(parseLibraryRoute('books/r/Rashi_on_Genesis/12/v5'), { view: 'read', id: 'Rashi_on_Genesis', node: 12, unit: null, verse: 5 });
  assert.deepEqual(parseLibraryRoute('books/r/Genesis/12/5'), { view: 'read', id: 'Genesis', node: 12, unit: 5 });
  assert.deepEqual(parseLibraryRoute('books/r/Genesis/12/5/m'), { view: 'read', id: 'Genesis', node: 12, unit: 5, tab: 'commentary', focus: null });
  assert.deepEqual(parseLibraryRoute('books/p/Kli_Yakar_on_Genesis/noach'), { view: 'parasha', id: 'Kli_Yakar_on_Genesis', parasha: 'noach' });
  assert.equal(libraryRoute.parasha('Kli_Yakar_on_Genesis', 'noach'), 'books/p/Kli_Yakar_on_Genesis/noach');
});

test('the reader wires it: the commentator row, the portion and Tanakh links, breadcrumbs through the commentator', () => {
  const source = readFileSync(new URL('../src/pages/LibraryPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /<CommentatorSwitch items=\{switchers\}/);
  assert.match(source, /aria-current=\{item\.current \? 'true' : undefined\}/, 'the commentator being read is marked for assistive technology');
  assert.match(source, /<CommentaryContext work=\{work\} base=\{tanakhBase\}/);
  assert.match(source, /`\$\{base\.title\} \$\{hebrewNumeral\(node\)\} במקרא`/, 'one tap back to the verses themselves');
  assert.match(source, /<CommentaryPortion work=\{work\}/, 'a commentary is read by portion');
  assert.match(source, /parashotFor\(work\)/, 'the book page offers its portions');
  assert.match(source, /commentator && <Breadcrumbs items=\{\[\{ label: 'ספרים'/, 'the book page names its commentator in the breadcrumbs');
  const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
  assert.match(css, /\.commentator-switch\{flex-wrap:nowrap/, 'one compact row');
});
