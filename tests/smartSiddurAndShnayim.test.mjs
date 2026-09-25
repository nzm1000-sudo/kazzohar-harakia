import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeSiddurBlocks } from '../src/services/siddurBlocks.mjs';
import tanakh from '../src/data/tanakh.json' with { type: 'json' };
import { buildShnayimSequence, hasMatchingVerseIdentity, parseTorahRange, shnayimProgressKey, validateShnayimParashaCatalog, validateShnayimSequence, verseReferences, weeklyParashaForShnayimMikra } from '../src/services/shnayimMikra.mjs';
import siddurOffline from '../src/data/siddurOffline.mjs';
import { normalizeText } from '../src/services/sefaria.mjs';

const css = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');
const reader = readFileSync(fileURLToPath(new URL('../src/components/SourceReader.jsx', import.meta.url)), 'utf8');

test('Siddur blocks keep heading, instruction, and recited text in separate semantic classes', () => {
  const blocks = normalizeSiddurBlocks(['פתח אליהו', 'יש אומרים נוסח אחר', 'ברוך אתה ה׳'], { title: 'פתח אליהו' });
  assert.deepEqual(blocks.map(block => block.type), ['heading', 'instruction', 'recitedText']);
  assert.deepEqual(blocks.map(block => block.role), ['prayer-heading', 'prayer-instruction', 'prayer-recited']);
  assert.match(blocks[0].className, /heading/);
  assert.match(blocks[1].className, /instruction/);
  assert.doesNotMatch(blocks[2].className, /editorial|instruction|heading/);
  assert.match(reader, /data-prayer-role=\{block.role\}/);
  assert.match(css, /\[data-prayer-role="prayer-instruction"\][^{]*\{[^}]*font-family:var\(--font-primary\)/);
  assert.match(css, /\[data-prayer-role="prayer-recited"\][^{]*\{[^}]*font-family:var\(--font-reading\)/);
});

test('the bundled Amida shows its own date-filtered seasonal source phrases exactly once', () => {
  const reference = 'Siddur Edot HaMizrach, Weekday Mincha, Amida';
  const text = normalizeText(siddurOffline.texts[reference]);
  const paragraphs = text.hebrew.map((value, index) => ({ text: value, source: text.indexes?.[index] ?? index }));
  const render = seasonal => normalizeSiddurBlocks(paragraphs, {
    title: 'עמידה',
    markup: paragraphs.map(part => text.siddurMarkup[part.source]),
    context: { seasonal: { mashivHaruch: seasonal === 'winter', vetenTalUmatar: seasonal === 'winter' } },
  }).map(block => block.text).join(' ');
  const summer = render('summer');
  const winter = render('winter');
  assert.match(summer, /מוֹרִיד הַטָּל/);
  assert.doesNotMatch(summer, /מַשִּׁיב הָרֽוּחַ/);
  assert.match(winter, /מַשִּׁיב הָרֽוּחַ/);
  assert.doesNotMatch(winter, /מוֹרִיד הַטָּל/);
  assert.equal((winter.match(/מַשִּׁיב הָרֽוּחַ/g) || []).length, 1);
});

test('typography tokens make instructions smaller than recited text and headings larger', () => {
  assert.match(css, /\.siddur-block-heading\{[^}]*font-size:1\.18em/);
  assert.match(css, /\.reading-text\.siddur-semantic \.siddur-block-instruction\{font-size:max\(16px,\.68em\)/);
  assert.match(css, /\.reading-text\{font-size:clamp\(20px,2\.5vw,26px\)/);
  assert.doesNotMatch(css.match(/\.reading-text\.siddur-semantic \.siddur-block-recited\{[^}]*\}/)?.[0] || '', /font-size|line-height|font-family/);
  assert.match(css, /--siddur-editorial:color-mix/);
  assert.match(reader, /normalizeSiddurBlocks/);
});

test('Shnayim Mikra uses the weekly parasha even when Shabbat reading is a festival', () => {
  const selected = weeklyParashaForShnayimMikra({
    parasha: { hebrew: 'פרשת בראשית', leyning: { torah: 'Genesis 1:1-6:8' } },
    shabbatReading: { category: 'holiday', hebrew: 'סוכות' },
  });
  assert.equal(selected.reference, 'Genesis 1:1-6:8');
  assert.equal(selected.festivalOverride, true);
});

test('each verse is Mikra, Mikra, Onkelos, and progress keys roll over by parasha date', () => {
  const sequence = buildShnayimSequence([
    { reference: 'Genesis 1:1', mikra: 'בְּרֵאשִׁית', onkelos: 'בְּקַדְמִין' },
    { reference: 'Genesis 1:2', mikra: 'וְהָאָרֶץ', onkelos: 'וְאַרְעָא' },
  ]);
  assert.deepEqual(sequence[0].blocks.map(block => block.type), ['mikra', 'mikra', 'targum']);
  assert.equal(sequence[0].blocks[0].text, sequence[0].blocks[1].text);
  assert.notEqual(sequence[0].blocks[2].text, sequence[0].blocks[0].text);
  assert.equal(sequence[1].reference, 'Genesis 1:2');
  assert.notEqual(shnayimProgressKey({ date: '2026-10-17', hebrew: 'בראשית' }), shnayimProgressKey({ date: '2026-10-24', hebrew: 'נח' }));
});

test('Shnayim Mikra pairs sources by canonical book, chapter, and verse rather than array position', () => {
  const first = { reference: 'Genesis 1:1', mikraReference: 'Genesis 1:1', onkelosReference: 'Onkelos Genesis 1:1', mikra: 'בְּרֵאשִׁית', onkelos: 'בְּקַדְמִין' };
  const next = { reference: 'Genesis 1:2', mikraReference: 'Genesis 1:2', onkelosReference: 'Onkelos Genesis 1:2', mikra: 'וְהָאָרֶץ', onkelos: 'וְאַרְעָא' };
  assert.equal(hasMatchingVerseIdentity(first), true);
  assert.equal(hasMatchingVerseIdentity(next), true);
  assert.equal(buildShnayimSequence([first, next])[1].identity.key, 'Genesis:1:2');
  assert.equal(hasMatchingVerseIdentity({ ...next, onkelosReference: 'Onkelos Genesis 2:1' }), false);
  assert.equal(buildShnayimSequence([{ ...next, onkelosReference: 'Onkelos Genesis 2:1' }]).length, 0);
});

test('verse expansion crosses chapter boundaries only with verified lengths', () => {
  const refs = verseReferences({ book: 'Genesis', startChapter: 1, startVerse: 30, endChapter: 2, endVerse: 2 }, { 1: 31, 2: 25 });
  assert.deepEqual(refs, ['Genesis 1:30', 'Genesis 1:31', 'Genesis 2:1', 'Genesis 2:2']);
  assert.deepEqual(verseReferences({ book: 'Genesis', startChapter: 1, startVerse: 30, endChapter: 2, endVerse: 2 }, { 1: 31 }), []);
});

test('all canonical parasha flows are continuous by verse identity, not chapter pages', () => {
  const chapterLengths = Object.fromEntries(tanakh.books.filter(book => book.division === 'Torah').map(book => [book.id, book.verses.reduce((lengths, [chapter, verse]) => ({ ...lengths, [chapter]: Math.max(lengths[chapter] || 0, verse) }), {})]));
  const validation = validateShnayimParashaCatalog(chapterLengths);
  assert.equal(validation.parashaCount, 54);
  assert.equal(validation.combinedCount, 7);
  assert.equal(validation.mismatches.length, 0);
  assert.ok(validation.verseCount > 5000);
  const range = parseTorahRange('Genesis 1:1-6:8');
  const refs = verseReferences(range, chapterLengths.Genesis);
  assert.equal(refs[0], 'Genesis 1:1');
  assert.equal(refs.at(-1), 'Genesis 6:8');
  assert.equal(refs.indexOf('Genesis 2:1'), 31);
  const verses = refs.slice(29, 33).map(reference => ({ reference, mikraReference: reference, onkelosReference: `Onkelos ${reference}`, mikra: 'מקרא', onkelos: 'אונקלוס' }));
  assert.equal(validateShnayimSequence(verses, refs.slice(29, 33)).ok, true);
  assert.equal(validateShnayimSequence([verses[0], verses[2], verses[1], verses[3]], refs.slice(29, 33)).ok, false);
  assert.match(css, /\.shnayim-targum\{[^}]*font-size:calc\(var\(--shnayim-size\) \* \.86\)/);
});

const shnayimChunks = () => Object.fromEntries(['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'].map(book => [book, JSON.parse(readFileSync(fileURLToPath(new URL(`../public/library/packs/shnayim-mikra-sefaria-pd/${book}.json`, import.meta.url)), 'utf8'))]));

test('Shnayim Mikra validator: every parasha and combined parasha is continuous and Onkelos-aligned on the local pack', async () => {
  const { validateShnayimCatalog } = await import('../src/services/shnayimMikra.mjs');
  const result = validateShnayimCatalog(shnayimChunks());
  assert.deepEqual({ parashot: result.parashot, combined: result.combined, verses: result.verses, mismatches: result.mismatches }, { parashot: 54, combined: 7, verses: 7001, mismatches: [] });
});

test('Shnayim Mikra flows by parasha: 1:1 → 1:2, crosses chapters without reset, and follows Jewish verse numbering', async () => {
  const { shnayimParashaById, shnayimVerses, parseTorahRange, shnayimParashaForContext } = await import('../src/services/shnayimMikra.mjs');
  const chunks = shnayimChunks();
  const bereshit = shnayimVerses(shnayimParashaById('bereshit'), chunks.Genesis);
  assert.deepEqual(bereshit.slice(0, 2).map(verse => verse.id), ['Genesis.1.1', 'Genesis.1.2']);
  assert.match(bereshit[1].mikra, /^וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙ וָבֹ֔הוּ/);
  assert.match(bereshit[1].targum, /^וְאַרְעָא הֲוַת צָדְיָא/);
  const cross = bereshit.findIndex(verse => verse.id === 'Genesis.2.1');
  assert.equal(bereshit[cross - 1].id, 'Genesis.1.31', 'chapter boundary continues to the next verse');
  assert.equal(bereshit.at(-1).id, 'Genesis.6.8');
  assert.equal(bereshit.length, 146);
  const yitro = shnayimParashaById('yitro');
  assert.equal(yitro.verseIds.at(-1), 'Exodus.20.23', 'Jewish numbering, matching Onkelos and Hebcal');
  assert.equal(shnayimVerses(yitro, chunks.Exodus).length, 75);
  for (const verse of bereshit) assert.ok(verse.mikra && verse.targum, verse.id);
  const broken = structuredClone(chunks.Genesis);
  broken.nodes[0].units[1].targum = '';
  assert.equal(shnayimVerses(shnayimParashaById('bereshit'), broken), null, 'a verse without its own Onkelos is never shown with another');
  assert.equal(parseTorahRange('Exodus 21:1-24:18, 30:11-16').endVerse, 18, 'special-reading suffix no longer empties the screen');
  assert.equal(shnayimParashaForContext({ parasha: { leyning: { torah: 'Exodus 21:1-24:18, 30:11-16' } } }).id, 'mishpatim');
  assert.equal(shnayimParashaForContext({ parasha: { leyning: { torah: 'Leviticus 12:1-15:33' } } }).id, 'tazria-metzora');
});

test('Shnayim Mikra screens: a parasha list in Torah order, and each verse as Mikra, Mikra, Onkelos', () => {
  const page = readFileSync(fileURLToPath(new URL('../src/pages/ShnayimMikra.jsx', import.meta.url)), 'utf8');
  assert.match(page, /<p className="shnayim-mikra-text">\{verse\.mikra\}<\/p>\s*<p className="shnayim-mikra-text">\{verse\.mikra\}<\/p>\s*<p className="shnayim-targum"><span>תרגום אונקלוס<\/span>\{verse\.targum\}<\/p>/);
  assert.match(page, /onClick=\{\(\) => go\(shnayimRoute\.parasha\(item\.id\)\)\}/, 'one tap opens the parasha');
  assert.doesNotMatch(page, /getText|sefaria\.mjs/, 'no per-verse network requests');
  assert.match(css, /\.shnayim-verse\{--shnayim-size:clamp\(24px,6\.4vw,30px\)\}/);
  assert.match(css, /\.shnayim-targum\{[^}]*font-size:calc\(var\(--shnayim-size\) \* \.86\);line-height:1\.9\}/);
});
