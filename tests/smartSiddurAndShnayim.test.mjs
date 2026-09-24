import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeSiddurBlocks } from '../src/services/siddurBlocks.mjs';
import { resolvePrayerConditions } from '../src/services/prayerConditions.mjs';
import { buildShnayimSequence, shnayimProgressKey, verseReferences, weeklyParashaForShnayimMikra } from '../src/services/shnayimMikra.mjs';

const css = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');
const reader = readFileSync(fileURLToPath(new URL('../src/components/SourceReader.jsx', import.meta.url)), 'utf8');

test('Siddur blocks keep heading, instruction, and recited text in separate semantic classes', () => {
  const blocks = normalizeSiddurBlocks(['פתח אליהו', 'יש אומרים נוסח אחר', 'ברוך אתה ה׳'], { title: 'פתח אליהו' });
  assert.deepEqual(blocks.map(block => block.type), ['heading', 'instruction', 'recitedText']);
  assert.match(blocks[0].className, /heading/);
  assert.match(blocks[1].className, /instruction/);
  assert.doesNotMatch(blocks[2].className, /editorial|instruction|heading/);
});

test('verified seasonal phrases are inserted after their real bracha anchor, not in a global panel', () => {
  const conditions = resolvePrayerConditions({ seasonal: { mashivHaruch: true, vetenTalUmatar: true }, additions: [], prayerContext: { omissions: [] } }, 'mincha');
  const blocks = normalizeSiddurBlocks(['אַתָּה גִּבּוֹר לְעוֹלָם', 'בָּרֵךְ עָלֵינוּ אֶת הַשָּׁנָה הַזֹּאת'], { additions: conditions.inline });
  const rain = blocks.findIndex(block => block.text.includes('מַשִּׁיב הָרוּחַ'));
  const years = blocks.findIndex(block => block.text.includes('בָּרֵךְ עָלֵינוּ'));
  assert.equal(blocks[rain - 1].type, 'instruction');
  assert.ok(rain > blocks.findIndex(block => block.anchor === 'gevurot'));
  assert.ok(blocks.findIndex(block => block.text.includes('וְתֵן טַל וּמָטָר')) > years);
});

test('typography tokens make instructions smaller than recited text and headings larger', () => {
  assert.match(css, /\.siddur-block-heading\{[^}]*font-size:1\.18em/);
  assert.match(css, /\.siddur-block-instruction[^{]*\{[^}]*font-size:\.72em/);
  assert.match(css, /\.siddur-block-recited\{[^}]*font-size:1em/);
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

test('verse expansion stops at verified chapter lengths instead of inventing verses', () => {
  const refs = verseReferences({ book: 'Genesis', startChapter: 1, startVerse: 30, endChapter: 2, endVerse: 2 }, { 1: 31, 2: 25 });
  assert.deepEqual(refs, ['Genesis 1:30', 'Genesis 1:31', 'Genesis 2:1', 'Genesis 2:2']);
});
