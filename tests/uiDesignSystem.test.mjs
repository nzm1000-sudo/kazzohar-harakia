// The design map (docs/design-system.md): one text-size control ("−  גודל טקסט  +", never a slider or א−/א+), one
// heart, one ✕, one way back — enforced by a scan of the app's source, plus the shared reading size's behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGACY_READER_SIZES, READING_SCALE, READING_SIZE_KEY, canGrow, canShrink, clampScale, legacyScale, percentLabel,
  readScale, scaledSize, stepScale, writeScale,
} from '../src/services/readingSize.mjs';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const memory = (seed = {}) => { const map = new Map(Object.entries(seed)); return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)) }; };

function jsxFiles(dir = SRC) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'data' || name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...jsxFiles(path));
    else if (/\.jsx?$/.test(name)) out.push(path);
  }
  return out;
}
// Comments may name what is not allowed ("never a ✕ typed"); only the code is scanned.
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const sources = jsxFiles().map(path => ({ file: relative(SRC, path), text: code(readFileSync(path, 'utf8')) }));
const offenders = (pattern, allow = []) => sources.filter(({ file, text }) => !allow.includes(file) && pattern.test(text)).map(({ file }) => file);

// ---- the shared reading size ----

test('reading size: steps of 10% between 80% and 160%, clamped and rounded', () => {
  assert.deepEqual(READING_SCALE, { min: 0.8, max: 1.6, step: 0.1, initial: 1 });
  assert.equal(stepScale(1, 1), 1.1);
  assert.equal(stepScale(1, -1), 0.9);
  assert.equal(stepScale(1.6, 1), 1.6, 'never past the largest');
  assert.equal(stepScale(0.8, -1), 0.8, 'never past the smallest');
  let scale = 1;
  for (let i = 0; i < 20; i += 1) scale = stepScale(scale, 1);
  assert.equal(scale, 1.6);
  assert.equal(canGrow(1.6), false); assert.equal(canShrink(1.6), true);
  assert.equal(canShrink(0.8), false); assert.equal(canGrow(0.8), true);
  assert.equal(clampScale('nonsense'), 1);
  assert.equal(clampScale(7), 1.6);
  assert.equal(clampScale(1.1500001), 1.2);
  assert.equal(percentLabel(1.2), '120%');
});

test('reading size: each reader keeps its designed size at 100% and scales from it', () => {
  assert.equal(scaledSize(25, 1), 25, 'siddur');
  assert.equal(scaledSize(22, 1), 22, 'Tehillim');
  assert.equal(scaledSize(21, 1), 21, 'Talmud');
  assert.equal(scaledSize(25, 1.2), 30);
  assert.equal(scaledSize(22, 0.8), 18);
});

test('reading size: persisted once for every reader; an earlier reader size carries over', () => {
  const store = memory();
  assert.equal(readScale(store), 1, 'nothing stored: 100%');
  writeScale(1.3, store);
  assert.equal(store.getItem(READING_SIZE_KEY), '1.3');
  assert.equal(readScale(store), 1.3);
  // The siddur's old 30px (base 25) becomes 120% for every reader.
  assert.equal(readScale(memory({ 'source-font': '30' })), 1.2);
  assert.equal(legacyScale(memory({ 'talmud-font-v1': '31' })), 1.5);
  assert.equal(legacyScale(memory({ 'tehillim-font-v1': '"x"' })), null, 'a damaged record is skipped');
  // The shared value wins over any old one.
  assert.equal(readScale(memory({ [READING_SIZE_KEY]: '0.9', 'source-font': '38' })), 0.9);
  assert.ok(LEGACY_READER_SIZES.every(([key, base]) => typeof key === 'string' && base > 0));
});

// ---- the one control ----

test('TextSizeControl: a named group with a named minus and plus, disabled at the ends, spoken after a change', () => {
  const control = read('../src/components/ui/TextSizeControl.jsx');
  assert.match(control, /role="group" aria-label=\{`גודל טקסט, \$\{percentLabel\(scale\)\}`\}/);
  assert.match(control, /aria-label="הקטנת הטקסט"[^>]*disabled=\{!canShrink\(scale\)\}/);
  assert.match(control, /aria-label="הגדלת הטקסט"[^>]*disabled=\{!canGrow\(scale\)\}/);
  assert.match(control, /announce\(`גודל טקסט \$\{percentLabel\(next\)\}`\)/);
  assert.match(control, /<span className="ui-text-size-label" dir="rtl" aria-hidden="true">גודל טקסט<\/span>/);
  // Every mounted reader follows a change made in any other.
  assert.match(control, /addEventListener\?\.\(READING_SIZE_EVENT, own\)/);
  const css = read('../src/styles/ui.css');
  assert.match(css, /\.ui-text-size \.ui-text-size-step\{display:grid;place-items:center;width:44px;min-width:44px;min-height:44px/);
  assert.match(read('../src/NewApp.jsx'), /import '\.\/styles\/ui\.css';/);
});

test('every reader uses the one TextSizeControl (and the new places have it: דברי תורה, שולחן שבת, שניים מקרא)', () => {
  for (const file of ['Tehillim.jsx', 'components/SourceReader.jsx', 'components/ComposedPrayerReader.jsx', 'components/DayServiceReader.jsx',
    'components/RiteServiceReader.jsx', 'pages/LibraryPage.jsx', 'pages/TalmudPage.jsx', 'pages/ShalomRavPage.jsx', 'pages/ZemirotPage.jsx',
    'pages/TorahContentPage.jsx', 'pages/ShabbatTable.jsx', 'pages/ShnayimMikra.jsx']) {
    assert.match(read(`../src/${file}`), /<TextSizeControl \/>/, file);
  }
  const torah = read('../src/pages/TorahContentPage.jsx');
  assert.match(torah, /\{ready && <div className="reader-tools tc-article-tools"><TextSizeControl \/><\/div>\}/);
  assert.match(torah, /<article className="tc-page tc-article" aria-labelledby="tc-article-title" style=\{\{ '--reading-scale': readingScale \}\}>/);
  const table = read('../src/pages/ShabbatTable.jsx');
  assert.match(table, /<div className="reader-tools shabbat-table-tools"><TextSizeControl \/><\/div>/);
  assert.match(table, /<section className="preparation shabbat-table" style=\{\{ '--reading-scale': readingScale \}\}>/);
  const css = read('../src/styles/ui.css');
  assert.match(css, /\.tc-article \.tc-article-body\{font-size:calc\(clamp\(18px,4\.6vw,20px\) \* var\(--reading-scale,1\)\)\}/);
  assert.match(css, /\.shabbat-table \.table-divrei-item p\{font-size:calc\(18px \* var\(--reading-scale,1\)\)\}/);
});

// ---- the scan: nothing outside the map ----

test('no text-size slider and no א−/א+ anywhere: the only range inputs are a speed and a volume', () => {
  // Allow-list: the auto-scroll's fine speed and the hitbodedut ambient volume (continuous values, not text size).
  assert.deepEqual(offenders(/type=["']range["']/, ['components/AutoScrollControl.jsx', 'pages/HitbodedutPage.jsx']), []);
  assert.deepEqual(offenders(/גודל אות|הגדלת גופן|הקטנת גופן|>א[−-]<|>א\+<|font-steps/), []);
  assert.deepEqual(offenders(/\bsetFont\(/), [], 'reader sizes come from useReadingFont / useReadingScale');
  assert.deepEqual(offenders(/useLocal\('(?:source-font|tehillim-font-v1|library-font-v1|talmud-font-v1|zemirot-font-v1|shalom-rav-font-v1)'/), []);
});

test('one heart: no typed heart or star characters; favourites draw HeartIcon', () => {
  assert.deepEqual(offenders(/[♥♡❤★☆]/), []);
  assert.match(read('../src/pages/PersonalTools.jsx'), /<HeartIcon filled=\{favorite\} \/>/);
  assert.match(read('../src/components/leatzmi/Chidushim.jsx'), /<HeartIcon filled=\{item\.favorite\} \/>/);
});

test('one ✕: no typed close characters; close buttons draw CloseGlyph or are CloseButton', () => {
  assert.deepEqual(offenders(/>\s*[✕×✖]\s*</), []);
  assert.deepEqual(offenders(/['"][✕×✖]['"]/), []);
  assert.match(read('../src/pages/TalmudPage.jsx'), /<CloseButton className="iyun-close" variant="row" onClick=\{onClose\} label="סגירת המפרשים" \/>/);
  assert.match(read('../src/components/MeatDairyTimer.jsx'), /<CloseButton className="md-close" variant="framed"/);
  assert.match(read('../src/components/ui/IconButton.jsx'), /aria-label=\{label\}/);
});

test('one way back: the reader tools hold no back button; לעצמי uses the shared BackNavigation', () => {
  assert.deepEqual(offenders(/<div className="reader-tools">\s*\{onClose && !navigation\?\.backLabel && <button/), []);
  assert.match(read('../src/components/leatzmi/common.jsx'), /<BackNavigation label=\{backLabel\} onClick=\{onBack\} \/>/);
});
