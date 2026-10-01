// "שיתוף כתמונה": the card spec, the right-to-left line breaking, the layout, and the drawing (on a recording 2D
// context) — the text keeps its nikud, and the source line, the licence's attribution, a required rights notice and
// the app's name are always drawn. The real canvas rendering is checked in a headless browser (screenshots).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHARE_BRAND, drawShareCard, layoutShareCard, shareCardSpec, stripCantillation, wrapText } from '../src/services/shareImage.mjs';
import { ONG_SHARE_NOTICE, TANAKH_CREDIT, blessingShareSpec, halachaShareSpec, tehillimShareSpec, verseShareSpec } from '../src/services/shareSpecs.mjs';

// A deterministic measure: 0.55 of the font size per character (marks count nothing, as in a real font).
const measure = (font, text) => { const size = Number(/(\d+)px/.exec(font)[1]); return [...String(text).replace(/[֑-ׇ]/g, '')].length * size * 0.55; };

function recordingContext() {
  const calls = [];
  const gradient = () => ({ addColorStop() {} });
  return {
    calls,
    set font(value) { this._font = value; }, get font() { return this._font; },
    fillText(text, x, y) { calls.push({ text, x, y, font: this._font, direction: this.direction, align: this.textAlign }); },
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, stroke() {}, fill() {}, drawImage(image) { calls.push({ image }); },
    createLinearGradient: gradient, createRadialGradient: gradient,
  };
}

const VERSE = 'שִׁ֥יר לַֽמַּֽעֲל֑וֹת אֶשָּׂ֣א עֵ֭ינַי אֶל־הֶהָרִ֑ים מֵ֝אַ֗יִן יָבֹ֥א עֶזְרִֽי׃';

test('cantillation is left out, nikud and letters kept exactly', () => {
  const plain = stripCantillation(VERSE);
  assert.doesNotMatch(plain, /[֑-֯]/);
  assert.match(plain, /שִׁיר/);
  assert.equal(plain.replace(/[ְ-ׇ]/g, ''), VERSE.replace(/[֑-ׇ]/g, ''), 'same letters, maqaf and punctuation');
});

test('a card without a source line is refused; the card carries the brand', () => {
  assert.throws(() => shareCardSpec({ body: 'טקסט' }), /מקור/);
  assert.throws(() => shareCardSpec({ body: '', source: 'x' }), /טקסט/);
  assert.equal(shareCardSpec({ body: 'טקסט', source: 'מקור' }).brand, SHARE_BRAND);
});

test('lines break between whole words and never exceed the width', () => {
  const lines = wrapText(stripCantillation(VERSE), 300, text => measure('20px x', text));
  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(measure('20px x', line) <= 300 || !line.includes(' '));
  assert.equal(lines.join(' '), stripCantillation(VERSE));
});

test('the drawn image: body with nikud, right-to-left and centred; source, credit, notice and the app name all drawn', () => {
  const spec = shareCardSpec({ kind: 'halacha', title: 'שאלה', body: 'לשון הספר כמות שהיא', source: 'עונג שבת, פרק ח הלכה י', credit: 'עונג שבת · הרב ישראל שריקי', notice: ONG_SHARE_NOTICE });
  const layout = layoutShareCard(spec, measure);
  assert.ok(layout.height >= 1080 && layout.height <= 1920);
  const ctx = recordingContext();
  drawShareCard(ctx, layout, spec, { emblem: { emblem: true } });
  const texts = ctx.calls.filter(call => call.text).map(call => call.text);
  for (const needed of ['לשון הספר כמות שהיא', 'עונג שבת, פרק ח הלכה י', 'עונג שבת · הרב ישראל שריקי', ONG_SHARE_NOTICE, SHARE_BRAND]) assert.ok(texts.includes(needed), needed);
  assert.ok(ctx.calls.some(call => call.image), 'the emblem is drawn');
  for (const call of ctx.calls.filter(item => item.text)) { assert.equal(call.direction, 'rtl'); assert.equal(call.align, 'center'); assert.equal(call.x, 540); }
  const fonts = ctx.calls.filter(call => call.text === 'לשון הספר כמות שהיא').map(call => call.font);
  assert.match(fonts[0], /Noto Serif Hebrew/);
});

test('a long text steps its size down to fit the tallest card; nothing is cut', () => {
  const long = Array.from({ length: 40 }, () => stripCantillation(VERSE)).join(' ');
  const layout = layoutShareCard(shareCardSpec({ body: long, source: 'תהילים קכא' }), measure);
  assert.ok(layout.bodySize < 54);
  const drawn = layout.blocks.filter(block => /Noto Serif/.test(block.font) && block.size === layout.bodySize).map(block => block.text).join(' ');
  assert.equal(drawn, long);
});

test('each kind carries its attribution; sensitive, high-stakes, too long or conditional content is not offered', () => {
  const verse = verseShareSpec({ text: VERSE, reference: 'תהילים קכא, א' });
  assert.equal(verse.credit, TANAKH_CREDIT);
  const psalm = tehillimShareSpec(23, Array.from({ length: 6 }, (_, i) => `פסוק ${i + 1} `.repeat(20)), { maxChars: 480 });
  assert.match(psalm.source, /^תהילים פרק כ״ג, פסוקים א׳–/);
  assert.equal(tehillimShareSpec(117, ['א', 'ב']).source, 'תהילים פרק קי״ז');
  const ong = { sourceBook: 'ong-shabbat', question: 'ש', sources: [{ excerpt: 'לשון', citation: 'פרק ח, י' }] };
  assert.equal(halachaShareSpec(ong).notice, ONG_SHARE_NOTICE);
  assert.equal(halachaShareSpec({ ...ong, highStakes: true }), null);
  assert.equal(halachaShareSpec({ ...ong, sources: [{ excerpt: 'א'.repeat(800), citation: 'x' }] }), null, 'the book\'s words are never cut');
  const yalkut = { quality: 'verified', question: 'ש', shortAnswer: 'ת', sources: [{ work: 'ילקוט יוסף', citation: 'שבת א' }] };
  assert.match(halachaShareSpec(yalkut).source, /ילקוט יוסף, שבת א/);
  assert.equal(halachaShareSpec({ ...yalkut, sensitivity: 'sensitive' }), null);
  assert.equal(halachaShareSpec({ ...yalkut, personal: true }), null);
  const blessing = { name: 'תפוח', before: { label: 'בורא פרי העץ' }, after: { label: 'בורא נפשות' }, sources: ['עונג שבת כו'] };
  assert.deepEqual(blessingShareSpec(blessing).lines, ['לפני: בורא פרי העץ', 'אחרי: בורא נפשות']);
  assert.equal(blessingShareSpec({ ...blessing, after: { pending: true } }), null);
  assert.equal(blessingShareSpec({ ...blessing, sources: [] }), null);
});

test('the four places offer "שיתוף כתמונה"', () => {
  const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  assert.match(read('pages/PersonalTools.jsx'), /<ShareImageButton spec=\{verseShareSpec\(verse\)\} \/>/);
  assert.match(read('Tehillim.jsx'), /tehillimShareSpec\(safeChapter, visibleVerses/);
  assert.match(read('pages/HalachaLibrary.jsx'), /halachaShareSpec\(question\)/);
  assert.match(read('pages/BlessingsEngine.jsx'), /blessingShareSpec\(view\)/);
});
