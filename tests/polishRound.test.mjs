// The review round of 2026-09-28: gematria, the weekly spiritual circle, Torah by parashot, te'amim colouring, the
// Siddur's day card and header, the halacha search field that never blocks typing, the compass heart, zemirot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gematriaAll, standardValue, reduceDigits, substitute, LETTER_NAMES } from '../src/services/gematriaCalc.mjs';
import { computeCircle, lightsOf, weekStartOf, WEEK_GOAL, levelFor, mergeAchievements } from '../src/services/spiritualCircle.mjs';
import { parashotOf } from '../src/services/parashot.mjs';
import zemirot from '../src/data/liturgy/zemirot.mjs';
import { HALACHA_TRACKS } from '../src/data/halachaTracks.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../src/data/practicalHalachaQa.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('gematria: every method, checked by hand', () => {
  const r = gematriaAll('שָׁלוֹם');
  assert.equal(r.standard, 376);
  assert.equal(r.gadol, 936, 'ם = 600 in the large count');
  assert.equal(r.katan, 3 + 3 + 6 + 4);
  assert.equal(r.ordinal, 21 + 12 + 6 + 13);
  assert.equal(r.reduced, 7);
  assert.equal(r.kolel, 377);
  assert.equal(r.withLetters, 380);
  assert.deepEqual(r.milui.names, ['שין', 'למד', 'וו', 'מם']);
  assert.equal(r.milui.value, standardValue('שין') + standardValue('למד') + standardValue('וו') + standardValue('מם'));
  assert.equal(r.neelam, r.milui.value - 376);
  assert.equal(r.atbash.word, 'בכפי');
  assert.equal(r.albam.word, 'יאפב');
  assert.equal(standardValue('אמת'), 441);
  assert.equal(standardValue('יהוה'), 26);
  assert.equal(gematriaAll('ברוך השם').kolelWords, standardValue('ברוך השם') + 2);
  assert.equal(reduceDigits(376), 7);
  assert.equal(substitute('אב', { א: 'ת', ב: 'ש' }), 'תש');
  assert.equal(Object.keys(LETTER_NAMES).length, 22);
  assert.equal(gematriaAll('abc'), null);
  assert.match(read('../src/pages/PersonalTools.jsx'), /personal-tools\/gematria', 'מחשבון גימטריה'/);
});

test('the spiritual circle: 75 lights a week, starting again on Motzaei Shabbat; what was built is never lowered', () => {
  const day = (key, category, quantity = 1) => ({ jewishDate: key, category, quantity });
  assert.equal(WEEK_GOAL, 75);
  assert.equal(lightsOf({ category: 'prayer' }), 1);
  assert.equal(lightsOf({ category: 'tehillim', quantity: 5 }), 3);
  assert.equal(lightsOf({ category: 'torah_study', quantity: 35 }), 3);
  assert.equal(weekStartOf('2026-11-07'), '2026-11-01', 'Shabbat belongs to the week that began on Sunday');
  assert.equal(weekStartOf('2026-11-08'), '2026-11-08', 'Motzaei Shabbat (the Jewish day is Sunday) opens a new week');
  // Three actions a day no longer fill anything: a week of three prayers a day is 18 lights.
  const three = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].flatMap(key => [day(key, 'prayer'), day(key, 'prayer'), day(key, 'prayer')]);
  assert.equal(computeCircle(three, '2026-11-06').week, 18);
  assert.ok(computeCircle(three, '2026-11-06').progress < 0.25);
  // A full week: three prayers, Birkat HaMazon, ten chapters and an hour of study a day (with the daily ceilings).
  const full = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].flatMap(key => [day(key, 'prayer'), day(key, 'prayer'), day(key, 'prayer'), day(key, 'birkat_hamazon'), day(key, 'tehillim', 10), day(key, 'torah_study', 60)]);
  const week = computeCircle(full, '2026-11-06');
  assert.equal(week.week, 6 * (4 + 5 + 6));
  assert.equal(week.progress, 1);
  const nextWeek = computeCircle(full, '2026-11-08');
  assert.equal(nextWeek.week, 0, 'a new week starts empty');
  assert.equal(nextWeek.fullWeeks, 1, 'the full week is kept');
  assert.equal(nextWeek.bestWeek, 90);
  assert.equal(nextWeek.level.name, levelFor(90).name);
  const kept = mergeAchievements({ total: 500, bestWeek: 120, fullWeeks: 5, earned: { 'first-light': '2026-01-01' } }, nextWeek, '2026-11-08');
  assert.equal(kept.total, 500, 'never lowered'); assert.equal(kept.bestWeek, 120); assert.equal(kept.fullWeeks, 5);
  assert.equal(kept.earned['first-light'], '2026-01-01', 'a milestone keeps the day it was first earned');
  assert.match(read('../src/hooks.jsx'), /weekProgress: circle \? circle\.progress : 0/);
  assert.match(read('../src/components/Shell.jsx'), /todayProgress=\{ring\.weekProgress \?\? ring\.todayProgress\}/);
  const journal = read('../src/pages/MitzvotJournal.jsx');
  assert.match(journal, /className="mitzvot-title">המעגל הרוחני</);
  assert.match(journal, /\{ today: 'היום', week: 'השבוע', month: 'החודש', year: 'השנה' \}/);
});

test('Torah by chapters or by parashot; te\'amim with or without, and in their own colour', () => {
  const genesis = parashotOf('Genesis');
  assert.equal(genesis.length, 12);
  assert.deepEqual([genesis[0].title, genesis[0].from, genesis[0].to], ['פרשת בראשית', [1, 1], [6, 8]]);
  assert.equal(parashotOf('Deuteronomy').at(-1).title, 'פרשת וזאת הברכה');
  assert.equal(parashotOf('Psalms').length, 0);
  const library = read('../src/pages/LibraryPage.jsx');
  assert.match(library, />לפי פרקים</); assert.match(library, />לפי פרשות</);
  assert.match(library, /aria-checked=\{trope\}[^>]*onClick=\{\(\) => setTrope\(true\)\}>עם טעמים</);
  assert.match(library, /onClick=\{\(\) => setTrope\(false\)\}>ללא טעמים</);
  assert.match(library, /גוון נוסף/);
  assert.match(read('../src/styles/base.css'), /\.trope-duo-marks\{color:var\(--trope-color,var\(--accent\)\)\}/);
});

test('the Siddur: "עת תפילה" centred without a period; nusach · the hour · the compass as three equal boxes; four prayers', () => {
  const books = read('../src/pages/BooksPage.jsx');
  assert.match(books, /<h1 className="siddur-title">עת תפילה<\/h1>/);
  assert.doesNotMatch(books, /עת תפילה\./);
  assert.match(books, /<SiddurClock location=\{settings\?\.location\} \/>/);
  assert.match(read('../src/styles/base.css'), /\.siddur-tools\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(books, /\['shacharit', 'mincha', 'maariv'\]\.map\(prayer =>/);
  assert.match(books, /fourthKind === 'omer'/);
  assert.match(books, /'הדלקת נרות חנוכה'/);
  assert.match(books, /'ברכת המזון'/);
  assert.match(books, /פיוטים וזמירות/);
});

test('the halacha search field keeps its own text: typing never re-renders the page or runs the search per key', () => {
  const library = read('../src/pages/HalachaLibrary.jsx');
  assert.match(library, /function SearchBox\(\{ q, setQ, submitQ, clearQ, submittedQ \}\) \{\n  const \[text, setText\] = useState\(q\);/);
  assert.match(library, /timer\.current = setTimeout\(\(\) => setQ\(value\), 320\)/);
  assert.match(library, /startTransition\(\(\) => setSearchQ\(value\)\)/);
  assert.match(read('../src/components/halacha/HalachaChat.jsx'), /function ChatInput\(/);
});

test('ממתק הלכתי under the dedication; "מה חשוב לדעת עכשיו" as equal tiles, one question each', () => {
  const today = read('../src/pages/TodayPage.jsx');
  assert.ok(today.indexOf('<MemorialTribute />') < today.indexOf('ממתק הלכתי'));
  assert.doesNotMatch(today, /הלכה לשעה זו/);
  const hub = read('../src/components/halacha/HalachaHubParts.jsx');
  assert.match(hub, /const \[first, \.\.\.rest\] = step\.entries;/);
  assert.match(hub, /`עוד \$\{rest\.length\}`/);
});

test('the compass: Jerusalem is a heart; aligned, it glows red in a white halo', () => {
  assert.match(read('../src/pages/PrayerCompass.jsx'), /className="prayer-target-marker"[^>]*><svg viewBox="0 0 24 24"/);
  const css = read('../src/styles/base.css');
  assert.match(css, /\.compass-zone-aligned \.prayer-target-marker\{color:#e2314f\}/);
  assert.match(css, /@keyframes heart-glow/);
});

test('zemirot: every meal, every zemer pointed, from Wikisource with its revision', () => {
  assert.deepEqual(zemirot.groups.map(group => group.key), ['friday-night', 'shabbat-day', 'seudah-shlishit', 'motzaei-shabbat']);
  const items = zemirot.groups.flatMap(group => group.items);
  assert.ok(items.length >= 45);
  for (const item of items) {
    assert.ok(item.paragraphs.length >= 2, item.id);
    assert.match(item.paragraphs.join(' '), /[ְ-ּ]/, `${item.id} pointed`);
    assert.match(item.url, /^https:\/\/he\.wikisource\.org\//);
    assert.ok(Number.isInteger(item.revid));
  }
  assert.equal(zemirot.source.license, 'CC BY-SA 4.0');
});

test('learning tracks: each grew by at least twenty distinct published items', () => {
  const before = { 'erev-shabbat': 15, 'prayer-mistakes': 12, 'daily-brachot': 11, 'kosher-kitchen': 12, 'rosh-chodesh': 9, omer: 9, 'shabbat-hotel': 7, travel: 10 };
  for (const track of HALACHA_TRACKS) {
    assert.ok(track.entryIds.length >= before[track.id] + 20, `${track.id}: ${track.entryIds.length}`);
    assert.equal(new Set(track.entryIds).size, track.entryIds.length);
    for (const id of track.entryIds) assert.equal(PRACTICAL_HALACHA_QA_INDEX[id]?.answerStatus, 'published', id);
  }
});
