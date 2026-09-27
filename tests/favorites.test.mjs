// One heart everywhere: saving is a favourite and a bookmark at once, on the device only; the old separate hearts
// are carried over; every reader shows the small heart by its title; "מועדפים וסימניות" lists and reopens everything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isFavorite, psalmFavorite, readFavorites, removeFavorite, routeFavorite, sourceFavorite, toggleFavorite } from '../src/services/favorites.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const memory = (seed = {}) => { const map = new Map(Object.entries(seed)); return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)) }; };

test('a heart toggles an item in and out, newest first', () => {
  const store = memory();
  toggleFavorite(psalmFavorite(23), store, new Date('2026-09-27T20:00:00Z'));
  toggleFavorite(routeFavorite('talmud', 'talmud/Berakhot/2a', 'ברכות ב.'), store, new Date('2026-09-27T21:00:00Z'));
  assert.deepEqual(readFavorites(store).map(item => item.key), ['route:talmud/Berakhot/2a', 'psalm:23']);
  assert.equal(isFavorite('psalm:23', store), true);
  toggleFavorite(psalmFavorite(23), store);
  assert.equal(isFavorite('psalm:23', store), false);
  removeFavorite('route:talmud/Berakhot/2a', store);
  assert.equal(readFavorites(store).length, 0);
});

test('the earlier Tehillim hearts and "saved to the library" texts are carried over once', () => {
  const store = memory({ 'tehillim-favorites-v1': '[121,20]', 'source-favorites': '["Esther 1","Siddur Edot HaMizrach, Rosh Hodesh, Hallel"]' });
  const items = readFavorites(store);
  assert.deepEqual(items.map(item => item.key), ['psalm:121', 'psalm:20', 'source:Esther 1', 'source:Siddur Edot HaMizrach, Rosh Hodesh, Hallel']);
  assert.equal(items[0].title, 'תהילים פרק קכ״א');
  assert.equal(items[3].kind, 'prayer');
  removeFavorite('psalm:20', store);
  assert.equal(readFavorites(store).some(item => item.key === 'psalm:20'), false, 'a removed legacy item does not come back');
});

test('every reader carries the heart by its title; the old big hearts and buttons are gone', () => {
  assert.match(read('../src/components/SourceReader.jsx'), /<div className="reader-title-row"><h2[^>]*>.*?<\/h2><HeartToggle item=\{sourceFavorite\(reference, displayTitle, mode\)\} \/><\/div>/);
  assert.doesNotMatch(read('../src/components/SourceReader.jsx'), /שמירה בספרייה/);
  assert.match(read('../src/Tehillim.jsx'), /<HeartToggle item=\{psalmFavorite\(safeChapter\)\} \/>/);
  assert.doesNotMatch(read('../src/Tehillim.jsx'), /'♥' : '♡'/);
  assert.match(read('../src/pages/TalmudPage.jsx'), /<HeartToggle item=\{routeFavorite\('talmud', talmudRoute\.amud\(tractate, amud\), title\)\} \/>/);
  assert.match(read('../src/pages/LibraryPage.jsx'), /<HeartToggle item=\{routeFavorite\('library', libraryRoute\.read\(work\.workId, node\)/);
  assert.match(read('../src/styles/base.css'), /\.heart-icon\{width:18px;height:18px;/);
});

test('"מועדפים וסימניות" is a personal tool that lists and reopens everything saved', () => {
  const tools = read('../src/pages/PersonalTools.jsx');
  assert.match(tools, /\['#personal-tools\/favorites', 'מועדפים וסימניות', 'כל מה ששמרתם בלב'/);
  assert.match(tools, /if \(section === 'favorites'\) return <FavoritesPage openSource=\{openSource\} openPsalm=\{openPsalm\} \/>;/);
  const page = read('../src/pages/FavoritesPage.jsx');
  assert.match(page, /if \(target\.type === 'source'\) return openSource\?\.\(target\.reference, target\.title, target\.mode\);/);
  assert.match(page, /if \(target\.type === 'psalm'\) return openPsalm\?\.\(target\.chapter\);/);
  assert.match(page, /<h2>ספרים מועדפים<\/h2>/);
  assert.match(page, /<h2>סימניות בספרייה<\/h2>/);
  assert.match(read('../src/NewApp.jsx'), /<PersonalTools route=\{mode\} settings=\{settings\} openSource=\{openSource\} openPsalm=\{openPsalm\}\/>/);
  assert.deepEqual(sourceFavorite('Haggadah Edot Hamizrah, Kadesh', 'הגדה · קדש').kind, 'prayer');
});

test('no reader opens an external site; the header gives the siddur flows their bar', () => {
  assert.doesNotMatch(read('../src/components/SourceReader.jsx'), /פתיחת המקור החיצוני/);
  assert.doesNotMatch(read('../src/pages/LearningSearch.jsx'), /המשך חיפוש באתר ספריא/);
  assert.doesNotMatch(read('../src/pages/TalmudPage.jsx'), /target="_blank"/);
  assert.doesNotMatch(read('../src/components/DayServiceReader.jsx'), /target="_blank"/);
  assert.match(read('../src/NewApp.jsx'), /\|\| \(source\?\.navigation\?\.returnRoute === 'siddur' && \(source\.navigation\.flow\?\.length \|\| 0\) > 1\) \|\| \(!source && \/\^talmud\\\/\[\^\/\]\+\\\/\\d\+\[ab\]\$\/\.test\(mode\)\)\)\}/);
});

test('items saved before titles were kept are named in Hebrew', async () => {
  const { favoriteTitle } = await import('../src/pages/FavoritesPage.jsx').catch(() => ({}));
  const page = read('../src/pages/FavoritesPage.jsx');
  assert.match(page, /return MOADIM_TITLES\.get\(reference\) \|\| siddurHebrew\(reference\) \|\| formatVisibleSourceTitle\(item\.title, reference\);/);
  if (favoriteTitle) assert.equal(favoriteTitle(sourceFavorite('Siddur Edot HaMizrach, Prayers for Three Festivals, Mussaf 159-217', 'Siddur Edot HaMizrach, Prayers for Three Festivals, Mussaf 159-217')), 'סדר שבעה אושפיזין');
});
