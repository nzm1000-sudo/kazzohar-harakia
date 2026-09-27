// The Talmud learning space: every amud under exactly one chapter; tractate cards show only the page count and the
// last opened page; the tractate opens on its ordered chapters; the reader's הקודם|תוכן|הבא sits in the header like
// the siddur's, its contents grouped by chapter; עיון opens the commentators where the learner is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRACTATES, indexToAmud, chaptersOf, chapterOfAmud, amudimOfChapter } from '../src/services/talmud.mjs';
import chapters from '../src/data/talmudChapters.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../src/pages/TalmudPage.jsx');
const css = read('../src/styles/base.css');

test('every tractate has its chapters, and every amud sits under exactly one of them', () => {
  assert.equal(Object.keys(chapters).length, TRACTATES.length);
  for (const tractate of TRACTATES) {
    const all = tractate.segmentsPerAmud.map((n, i) => (n > 0 ? indexToAmud(i) : null)).filter(Boolean);
    const listed = chaptersOf(tractate).flatMap(chapter => amudimOfChapter(tractate, chapter));
    assert.deepEqual(listed, all, `${tractate.title}: chapters cover every amud once, in order`);
    for (const chapter of chaptersOf(tractate)) assert.ok(chapter.name, `${tractate.title} ${chapter.n} has a Hebrew name`);
  }
  const berakhot = TRACTATES.find(t => t.title === 'Berakhot');
  assert.equal(chaptersOf(berakhot)[0].name, 'מאימתי');
  assert.equal(chapterOfAmud(berakhot, '13a').name, 'היה קורא', 'a shared amud belongs to the chapter that begins there');
  assert.equal(chapterOfAmud(berakhot, '12b').name, 'מאימתי');
});

test('tractate cards: the page count (letters and digits) and, smaller, the last opened page', () => {
  assert.match(page, /<small>\{hebrewNumeral\(t\.amudCount\)\} \(\{t\.amudCount\}\) עמודים<\/small>\{progress\[t\.title\] && <em>נפתח לאחרונה: \{amudLabel\(progress\[t\.title\]\)\}<\/em>\}/);
  assert.doesNotMatch(page, /amudLabel\(t\.firstAmud\)\} – \{amudLabel\(t\.lastAmud\)\}/, 'no range line on the card');
  assert.match(css, /\.tractate-card small\{color:var\(--ink-2\);font-size:17px;/);
  assert.match(css, /\.tractate-card em\{color:var\(--accent\);font-size:var\(--font-ui-caption\);/);
});

test('the tractate opens on its ordered chapters, the current one marked and open', () => {
  assert.match(page, /<ol className="chapter-list"/);
  assert.match(page, /useRouteState\(`talmud-chapters:\$\{tractate\.title\}`, currentChapter \? \[currentChapter\.n\] : \[\]\)/);
  assert.match(page, /aria-current=\{current === d \+ side \? 'page' : undefined\}/);
});

test('the reader: הקודם|תוכן|הבא in the header, contents grouped by chapter; a tidy tool row', () => {
  assert.match(page, /<PrayerSectionNav title=\{`מסכת \$\{tractate\.heTitle\}`\} items=\{pages\}/);
  assert.match(page, /group: `פרק \$\{hebrewNumeral\(item\.n\)\} · \$\{item\.name\}`/);
  assert.match(read('../src/components/PrayerSectionNav.jsx'), /item\.group && item\.group !== items\[index - 1\]\?\.group && <li key=\{`group:\$\{item\.group\}`\} className="prayer-nav-group"/);
  assert.match(read('../src/NewApp.jsx'), /\|\| \(!source && \/\^talmud\\\/\[\^\/\]\+\\\/\\d\+\[ab\]\$\/\.test\(mode\)\)/);
  assert.match(page, /<div className="font-steps" role="group" aria-label="גודל אות">/);
});

test('עיון: a tapped passage opens its commentators right there — a bottom sheet on narrow screens, a side panel on wide', () => {
  assert.match(page, /onClick=\{\(\) => \{ pick\(seg, \{ reveal: true \}\); setSheetOpen\(true\); \}\}/);
  assert.match(page, /<aside className=\{`iyun-panel\$\{open \? ' is-open' : ''\}`\}/);
  assert.match(page, /aria-label="לקטע הקודם"/);
  assert.match(page, /aria-label="לקטע הבא"/);
  assert.match(page, /aria-label="סגירת המפרשים"/);
  assert.match(page, /setCommentator\(chosen && commentator &&/, 'a commentator carries over only once chosen');
  assert.match(css, /@media \(max-width:1099px\)\{\n  \/\* The commentators rise from the bottom as a sheet; the tapped passage scrolls up above it\. \*\/\n  \.iyun-panel\{position:fixed;/);
  assert.match(css, /\.iyun-study\.sheet-open\{padding-bottom:min\(64dvh,560px\)\}/);
  assert.match(page, /\{others > 0 && onMore && <button type="button" className="commentary-more"/, 'from "עם ביאור", the other commentators open in עיון');
});
