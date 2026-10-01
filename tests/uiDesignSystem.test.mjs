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

// ---- the one Selector: no native <select> in the app ----

test('no visible native <select>: every choice from a list is the Selector (allow-list: each with its reason)', () => {
  // Allow-list — file: reason. Keep it short; a native <select> is old-fashioned here and reads differently on every device.
  const ALLOWED = {
    // Owned by the parallel התבודדות pass at the time of the Selector pass; its "פרק התחלה" is to move to the Selector next.
    'pages/HitbodedutPage.jsx': 'parallel work in progress (התבודדות): the start-chapter picker moves to the Selector',
  };
  assert.deepEqual(offenders(/<select[\s>]/, Object.keys(ALLOWED)), []);
  for (const [file, reason] of Object.entries(ALLOWED)) assert.ok(reason.length > 10, `${file} needs a reason`);
  // The places that had one now use the Selector.
  for (const file of ['pages/TorahContentPage.jsx', 'pages/ZmanimPage.jsx', 'pages/NerZikaron.jsx', 'pages/LibraryPage.jsx', 'pages/AccessibilityPage.jsx',
    'pages/PreparationHub.jsx', 'pages/TalmudPage.jsx', 'pages/PersonalTools.jsx', 'pages/TraditionPage.jsx', 'components/leatzmi/Chidushim.jsx',
    'components/reminders/ReminderEventEditor.jsx']) assert.match(read(`../src/${file}`), /<Selector /, file);
  // דברי תורה: the four filters are chips that light up in gold when they are not the default.
  const torah = read('../src/pages/TorahContentPage.jsx');
  for (const label of ['סוג', 'נושא', 'אורך', 'סדר']) assert.match(torah, new RegExp(`<Selector variant="chip" className="tc-filter" label="${label}"[^>]*defaultValue=`), label);
});

test('Selector: a button that opens a listbox in a modal sheet — named, keyboard-complete, focus kept and restored', () => {
  const source = read('../src/components/ui/Selector.jsx');
  assert.match(source, /aria-haspopup="listbox" aria-expanded=\{open\}/);
  assert.match(source, /aria-label=\{`\$\{label\}, \$\{shown\}`\}/, 'the trigger says what it chooses and what is chosen');
  assert.match(source, /role="dialog" aria-modal="true" aria-labelledby=/);
  assert.match(source, /role="listbox" aria-labelledby=\{`\$\{uid\}-title`\} tabIndex=\{0\}\s*aria-activedescendant=/);
  assert.match(source, /role="option" aria-selected=\{selected\}/);
  assert.match(source, /useModalFocus\(panel, true, close/, 'Tab stays inside, Escape closes, focus returns to the trigger');
  assert.match(source, /kz-native-close-overlay/, 'the Android back button closes it');
  assert.match(source, /<CheckGlyph \/>/, 'the chosen option carries a drawn check');
  assert.match(read('../src/components/ui/index.js'), /export \{ default as Selector \} from '\.\/Selector\.jsx';/);
  assert.match(read('../src/NewApp.jsx'), /\.ui-picker-layer/, 'NewApp treats an open Selector as an overlay (back closes it)');
  const css = read('../src/styles/ui.css');
  assert.match(css, /\.ui-picker-option\{[^}]*min-height:52px/, 'large rows');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.ui-picker-layer,\.ui-picker,\.ui-select-trigger,\.ui-select-chevron\{animation:none!important;transition:none!important\}\}/);
});

test('Selector logic: options in any shape, search ignores nikud and geresh, keys move within bounds (RTL grid)', async () => {
  const { normalizeOptions, filterOptions, nextIndex, wantsSearch, sameValue } = await import('../src/components/ui/selectorLogic.mjs');
  assert.deepEqual(normalizeOptions([['a', 'א'], 'ב', { value: 3, label: 'ג', hint: 'x' }]).map(o => [o.value, o.label]), [['a', 'א'], ['ב', 'ב'], [3, 'ג']]);
  const items = normalizeOptions([['1', 'שַׁבָּת'], ['2', 'חנוכה'], ['3', 'ט״ו בשבט']]);
  assert.deepEqual(filterOptions(items, 'שבת').map(o => o.value), ['1'], 'nikud does not hide שַׁבָּת');
  assert.deepEqual(filterOptions(items, 'טו').map(o => o.value), ['3']);
  assert.equal(filterOptions(items, '').length, 3);
  assert.equal(nextIndex(0, 'ArrowDown', 5), 1);
  assert.equal(nextIndex(4, 'ArrowDown', 5), 4);
  assert.equal(nextIndex(0, 'ArrowUp', 5), 0);
  assert.equal(nextIndex(2, 'End', 5), 4);
  assert.equal(nextIndex(2, 'Home', 5), 0);
  assert.equal(nextIndex(2, 'ArrowLeft', 5), null, 'a list ignores left / right');
  assert.equal(nextIndex(2, 'ArrowLeft', 30, 6), 3, 'in a grid, left goes on (right to left)');
  assert.equal(nextIndex(2, 'ArrowDown', 30, 6), 8, 'down moves a row');
  assert.equal(nextIndex(0, 'x', 5), null);
  assert.equal(wantsSearch(40), true);
  assert.equal(wantsSearch(8), false);
  assert.equal(wantsSearch(30, 6), false, 'a grid of days never searches');
  assert.ok(sameValue(3, '3') && !sameValue('', 0));
});

test('one segmented look: every skin shares the inset track (docs/design-system.md › SegmentedControl)', () => {
  const css = read('../src/styles/ui.css');
  assert.match(css, /:is\(\.seg,\.ja-seg,\.personal-switch\[role="group"\]\)\{gap:3px;padding:3px;border:1px solid var\(--line-strong\);border-radius:999px;background:transparent/);
  assert.match(css, /:is\(\.seg,\.ja-seg,\.personal-switch\[role="group"\],\.lz-segments\)>button:is\(\.on,\.is-on,\.selected,\[aria-checked="true"\],\[aria-pressed="true"\],\[aria-selected="true"\]\)/, 'the chosen segment: the shared Rule A outline');
  assert.match(read('../src/pages/PersonalTools.jsx'), /<div className="personal-switch" role="group" aria-label="סוג החישוב">/);
});

test('halacha answers follow the shared reading size: the question page and הלכה חכמה have the one control', () => {
  const page = read('../src/pages/HalachaLibrary.jsx');
  assert.match(page, /<div className="reader-tools halacha-tools"><TextSizeControl \/><\/div>/);
  assert.match(page, /<article className="halacha-question" style=\{\{ '--reading-scale': readingScale \}\}>/);
  const chat = read('../src/components/halacha/HalachaChat.jsx');
  assert.match(chat, /<div className="reader-tools halacha-chat-tools"><TextSizeControl \/><\/div>/);
  const css = read('../src/styles/ui.css');
  assert.match(css, /\.halacha-question \.practical-answer p\{font-size:calc\(clamp\(18px,3vw,23px\) \* var\(--reading-scale,1\)\)\}/);
  assert.match(css, /\.halacha-chat \.chat-text,\.halacha-chat \.chat-entry-answer\{font-size:calc\(17px \* var\(--reading-scale,1\)\)\}/);
});

test('one bar under a title: every heading bar is the shared TitleOrnament (the אותיות 26 ornament), decorated and alive', () => {
  // No page draws its own bar: the old quiet divider and the page-local ornament are gone from code and styles.
  // No allow-list any more: the memorial's marks between paragraphs and לעצמי's ornament are the shared one too.
  assert.deepEqual(offenders(/gold-divider|otiyot-ornament|lz-ornament|className="[^"]*-divider"/), [], 'heading bars use <TitleOrnament />');
  const styles = ['base.css', 'ui.css', 'torah-content.css', 'accessibility.css', 'leatzmi.css', 'hitbodedut.css'].map(name => read(`../src/styles/${name}`)).join('\n');
  assert.doesNotMatch(styles, /\.gold-divider|\.otiyot-ornament|\.memorial-divider|\.lz-ornament/);
  // The component: decorative (hidden from readers) — a dot, the turning diamond, a dot.
  const ornament = read('../src/components/ui/TitleOrnament.jsx');
  assert.match(ornament, /<span className=\{`title-ornament\$\{className \? ` \$\{className\}` : ''\}`\} aria-hidden="true"><b \/><i \/><b \/><\/span>/);
  assert.match(read('../src/components/ui/index.js'), /export \{ default as TitleOrnament \} from '\.\/TitleOrnament\.jsx';/);
  // Its look lives once, in ui.css: drifting gold rules, a diamond turning in the logo's gold, still under reduced motion.
  const css = read('../src/styles/ui.css');
  assert.match(css, /\.title-ornament::before,\.title-ornament::after\{[^}]*animation:title-gold-drift 9s ease-in-out infinite alternate\}/);
  assert.match(css, /\.title-ornament i\{[^}]*conic-gradient\(from var\(--brand-angle\)[^}]*animation:brand-turn 16s linear infinite\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.title-ornament::before,\.title-ornament::after,\.title-ornament i\{animation:none\}\}/);
  // Every screen that draws it imports the one component; the centred heads carry it.
  const users = sources.filter(({ text }) => /<TitleOrnament\b/.test(text));
  for (const { file, text } of users) assert.match(text, /import TitleOrnament from '[./]*(components\/)?ui\/TitleOrnament\.jsx';/, `${file} imports the shared ornament`);
  for (const page of ['pages/OtiyotPage.jsx', 'pages/ShalomRavPage.jsx', 'pages/ToratShaiPage.jsx', 'pages/MitzvotJournal.jsx', 'pages/OlamPage.jsx', 'pages/ZemirotPage.jsx', 'pages/TorahContentPage.jsx', 'components/MemorialTribute.jsx', 'components/leatzmi/common.jsx', 'pages/CalendarPage.jsx', 'pages/PreparationHub.jsx', 'pages/PersonalTools.jsx', 'components/GematriaCalculator.jsx']) {
    assert.ok(users.some(({ file }) => file === page), `${page} has the ornament under its title`);
  }
});

test('no plain rule under or beside a heading: headers carry no hairline border, side-lined labels are the ornament label', () => {
  // Every stylesheet, comments stripped: a heading-like selector (head, header, title, heading, caption, eyebrow, label)
  // may not draw a plain 1px rule — neither a border under/over it nor a ::before/::after hairline. The ornament labels
  // ("עוד בשבילך", "דברי חכמים", the reminder groups, a commentary's layer) take their decorated rules from ui.css.
  // Allowed, and why: the app bar's own edge (.shell-head-safe), a one-sided list heading (.tc-section-title), the
  // quiz's electric eyebrow (its own night palette), and panel/menu chrome that is not a heading bar (.iyun-panel-head,
  // .prayer-nav-title) and the Siddur's in-text section titles (.day-service-section-title, reading typography).
  const ALLOWED = /shell-head|tc-section-title|quiz-eyebrow|iyun-panel-head|prayer-nav-title|day-service-section-title|title-ornament/;
  const dir = fileURLToPath(new URL('../src/styles/', import.meta.url));
  const found = [];
  for (const name of readdirSync(dir).filter(file => file.endsWith('.css'))) {
    const css = readFileSync(join(dir, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = selector.trim();
      if (!/(head|header|title|heading|caption|eyebrow|label)/.test(sel) || ALLOWED.test(sel) || sel.startsWith('@')) continue;
      const pseudoRule = /::?(before|after)/.test(sel) && /height:1(\.5)?px/.test(body) && !/radial-gradient\(circle,#c9a24a/.test(body);
      const borderRule = /border-(bottom|top|block)\s*:\s*1px/.test(body) && !/::?(before|after)/.test(sel);
      if (pseudoRule || borderRule) found.push(`${name}: ${sel.slice(-90)}`);
    }
  }
  assert.deepEqual(found, [], 'a plain heading rule came back — use <TitleOrnament /> or the ornament label');
  const ui = read('../src/styles/ui.css');
  const LABELS = ':is(.lz-caption,.lz-sage-kind,.mz-group-title,.dt-section-title,.library-layer-title,.library-stream-head)';
  assert.ok(ui.includes(`${LABELS}::before,${LABELS}::after{content:"";flex:1 1 0;`), 'two equal flexible rules: symmetric');
  assert.match(ui, /animation:label-gold-drift-start 9s ease-in-out infinite alternate\}/, 'the gold drifts like the TitleOrnament');
  assert.match(ui, /@media \(prefers-reduced-motion:reduce\)\{:is\(\.lz-caption[^{]*::after\{animation:none\}\}/);
  // The memorial: the ornament under the name and between the paragraphs; the shared close on the still frame.
  const tribute = read('../src/components/MemorialTribute.jsx');
  assert.match(tribute, /<h2 id="memorial-title">[^\n]*<\/h2>\s*<TitleOrnament className="memorial-ornament" \/>/);
  assert.equal((tribute.match(/<TitleOrnament className="memorial-mark" \/>/g) || []).length, 2, 'between the paragraphs and before the closing prayer');
  assert.match(tribute, /import \{ CloseButton \} from '\.\/ui\/IconButton\.jsx';/);
  assert.doesNotMatch(tribute, /<button[^>]*memorial-close/, 'no hand-made close');
  // לעצמי: the shared ornament under its titles; its privacy line lives in אודות › פרטיות ואחסון.
  const head = read('../src/components/leatzmi/LeatzmiHome.jsx');
  assert.match(head, /<h1 className="lz-title">לעצמי<\/h1>\s*<Ornament \/>/);
  assert.doesNotMatch(head, /רק במכשיר שלך/);
  assert.match(read('../src/pages/AboutPage.jsx'), /<AboutSection title="פרטיות ואחסון">[^\n]*<strong>לעצמי<\/strong>[^\n]*הכול נשמר רק במכשיר שלך/);
});

test('centred where it should be: the Jewish clock card, the dedication card, the gematria and my-verse fields', () => {
  const css = read('../src/styles/base.css');
  assert.match(css, /\.ja-today\{display:grid;grid-template-columns:40px minmax\(0,1fr\) 40px;[^}]*text-align:center/, 'equal side columns');
  assert.match(css, /\.ja-today-text\{display:grid;justify-items:center;/);
  assert.match(css, /\.memorial-entry\{position:relative;display:grid;justify-items:center;[^}]*text-align:center/);
  assert.match(css, /\.memorial-entry::after\{content:"";position:absolute;inset:5px;border:1px solid/, 'an inner gold frame');
  assert.match(css, /\.gematria-input>span:first-child,\.verse-tool \.personal-field>span:first-child\{justify-self:center;text-align:center\}/);
  assert.match(css, /\.calendar-range-heading\{display:grid;justify-items:center;/);
});

test('המעגל הרוחני › "נקודות של אור": a centred title with the ornament that opens and folds the fan of points', () => {
  const journal = read('../src/pages/MitzvotJournal.jsx');
  assert.doesNotMatch(journal, /השלמת \$\{aggregation\.totalActions\}|>\{dayData\.totalActions\} פעולות</, 'no "פעולות" in what the reader sees');
  assert.match(journal, /<span id="light-points-title" className="light-points-title">נקודות של אור<\/span>\s*<TitleOrnament className="light-points-ornament" \/>/);
  assert.match(journal, /<button type="button" ref=\{toggleRef\} className="light-points-toggle" aria-expanded=\{open\} aria-controls="light-points-fan" onClick=\{toggle\}>/);
  assert.match(journal, /<div id="light-points-fan" className="light-points-fan"[^>]*hidden=\{state === 'closed'\}/);
  assert.match(journal, /event\.key === 'Escape' && open/, 'Escape folds the fan');
  assert.match(journal, /singleDay=\{range === 'today'\}/, 'one day: no day row repeating the head');
  assert.match(journal, /\{!singleDay && <h3 className="light-points-day fan-blade"/);
  assert.doesNotMatch(journal, /mitzvot-day-header/, 'no left/right spread day header');
  assert.match(journal, /const still = reduceMotionNow\(\);/, 'reduced motion: no in-between states');
  const css = read('../src/styles/base.css');
  assert.match(css, /\.light-points\{display:grid;justify-items:center;[^}]*text-align:center\}/);
  assert.match(css, /\.light-points:is\(\.is-opening,\.is-closing\) \.fan-blade\{opacity:0;transform:/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.fan-blade,\.light-points-fan,\.light-points-cue\{transition:none\}\}/);
});

// ---- Rule A / Rule B (docs/design-system.md › The selected state): a thin copper outline, never a fill; no motion ----
const STYLE_DIR = fileURLToPath(new URL('../src/styles/', import.meta.url));
const cssRules = () => readdirSync(STYLE_DIR).filter(file => file.endsWith('.css')).flatMap(name => {
  const css = readFileSync(join(STYLE_DIR, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ name, sel: selector.trim().replace(/\s+/g, ' '), body }));
});
// A chosen / current / pressed / on state, by its class or its ARIA state.
const SELECTED = /\.(on|is-on|selected|is-selected|active|is-active|current|is-current|chosen|is-chosen|checked|is-checked|pressed|is-pressed)(?![\w-])|\[aria-(checked|pressed|selected|current)|:checked/;
// The ground a chosen control may keep: none, or its own unchosen card colour.
const QUIET_GROUND = /^(transparent|none|inherit|initial|var\(--(surface|bg)\))(\s*!important)?$/;

test('Rule A: no selected / active / current state fills its control (allow-list: each with its reason)', () => {
  const ALLOWED = [
    [/^quiz\.css$/, /./, 'the quiz keeps its own night arena palette (orbs, rungs, answer feedback)'],
    [/^hitbodedut\.css$/, /\.hb-speed-dots i\.is-on/, 'tiny speed dots, not a control'],
    [/^ui\.css$/, /^\.ja-switch\.is-on \.ja-switch-thumb$/, 'a switch knob: the one small solid mark that slides to "on"'],
    [/^ui\.css$/, /^\.ui-picker-option\.is-active$/, 'the keyboard cursor row of the Selector (a hover tint), not the chosen one'],
    [/^base\.css$/, /\.more-menu \.sheet button\[aria-current="page"\]::after/, 'a 6px dot marking the page you are on'],
  ];
  const found = [];
  for (const { name, sel, body } of cssRules()) {
    if (!SELECTED.test(sel) || sel.startsWith('@')) continue;
    if (ALLOWED.some(([file, pattern]) => file.test(name) && pattern.test(sel))) continue;
    for (const [, value] of body.matchAll(/background(?:-color)?\s*:\s*([^;]+)/g)) {
      if (!QUIET_GROUND.test(value.trim())) found.push(`${name}: ${sel.slice(0, 110)} → ${value.trim().slice(0, 50)}`);
    }
  }
  assert.deepEqual(found, [], 'a chosen state is filled — use the shared outline (ui.css › The selected state)');
});

test('Rule A: no filled primary button — the accent and the dark "selected" colour fill only marks (allow-list)', () => {
  // Only small marks may be solid: dots, progress bars, a needle, a badge. Buttons are the copper pill outline.
  const MARKS = /diaspora-dot|mz-state i\b|calendar-cell small:first-of-type|source-map-node\.is-practical::before|progress-value|meat-dairy-progress::after|offline-pack-bar span|offline-invite-rule::after|talmud-local-badge::before|prayer-needle|prayer-target-marker|chat-user p|ja-switch-thumb|lz-progress li\.is-done|more-menu \.sheet button\[aria-current="page"\]::after/;
  // (.chat-user p is the reader's own message bubble in הלכה חכמה — a speech bubble, not a control.)
  const found = cssRules().filter(({ name, sel, body }) => name !== 'quiz.css' && !MARKS.test(sel)
    && /background(?:-color)?\s*:\s*var\(--(accent|selected)\)/.test(body)).map(({ name, sel }) => `${name}: ${sel.slice(0, 110)}`);
  assert.deepEqual(found, [], 'a solid accent / selected fill on a control — use the primary pill outline');
});

test('Rule A: one shared definition — the "פרק בהפתעה" outline as tokens, segments, framed choices, tabs and the primary pill', () => {
  const ui = read('../src/styles/ui.css');
  assert.match(ui, /:root\{--sel-ink:var\(--accent\);--sel-line:color-mix\(in srgb,var\(--accent\) 75%,transparent\);--sel-ring:inset 0 0 0 1px var\(--sel-line\);--sel-under:1px solid var\(--accent\);--primary-line:color-mix\(in srgb,var\(--accent\) 70%,var\(--line-strong\)\)\}/);
  // The segmented track is a hairline and transparent; a chosen segment is the ring, never a fill.
  assert.match(ui, /:is\(\.seg,\.ja-seg,\.personal-switch\[role="group"\]\)\{gap:3px;padding:3px;border:1px solid var\(--line-strong\);border-radius:999px;background:transparent/);
  assert.match(ui, /:is\(\.seg,\.ja-seg,\.personal-switch\[role="group"\],\.lz-segments\)>button:is\(\.on,\.is-on,\.selected,\[aria-checked="true"\],\[aria-pressed="true"\],\[aria-selected="true"\]\),[^{]*\)\{color:var\(--sel-ink\);box-shadow:var\(--sel-ring\)\}/);
  assert.match(ui, /\.lz-chip\.is-on,[^{]*\)\{border-color:var\(--sel-line\);color:var\(--sel-ink\);box-shadow:none\}/);
  assert.match(ui, /\.lz-scope button\.is-on\{border-bottom:var\(--sel-under\);color:var\(--sel-ink\)\}/);
  assert.match(ui, /:is\(\.lz-outline,\.personal-primary,[^{]*\)\{border:1px solid var\(--primary-line\);border-radius:999px;background:transparent;color:var\(--sel-ink\);box-shadow:none\}/);
  // The model's own page draws nothing of its own: its look is the shared one.
  const lz = read('../src/styles/leatzmi.css');
  assert.doesNotMatch(lz, /\.lz-segments button\.is-on|\.lz-scope button\.is-on|\.lz-chip\.is-on|\.lz-outline\{[^}]*border:/);
  // The places the owner named: each uses a shared skin.
  assert.match(read('../src/pages/ShalomRavPage.jsx'), /<div className="seg sr-view" role="radiogroup"/);
  assert.match(read('../src/components/DiasporaIndicator.jsx'), /aria-pressed=\{status\.rule === YOM_TOV_RULES\.MARAN\}/);
  assert.match(read('../src/pages/PersonalTools.jsx'), /className=\{primary \? 'personal-primary' : 'ghost'\}/);
});

test('Rule B: an ordinary selected state never moves; the gold motion is kept for the truly central', () => {
  // Allowed, and why: the quiz's arena (its own palette and answer feedback) and the current station of the
  // spiritual path (.olam-step.is-current — "you are here", like the current prayer).
  const ALLOWED = /olam-step\.is-current/;
  const found = cssRules().filter(({ name, sel, body }) => name !== 'quiz.css' && SELECTED.test(sel) && !ALLOWED.test(sel)
    && /animation(-name)?\s*:\s*(?!none)/.test(body)).map(({ name, sel }) => `${name}: ${sel.slice(0, 110)}`);
  assert.deepEqual(found, [], 'a selected state animates — Rule B');
  // Nor does it glow: no outer shadow, halo or filter — only the inset hairline ring (allowed: the same "you are here"
  // station, and the התבודדות speed dots, tiny marks in its own night screen).
  const GLOW_ALLOWED = /olam-step\.is-current|hb-speed-dots/;
  const glowing = cssRules().filter(({ name, sel, body }) => name !== 'quiz.css' && SELECTED.test(sel) && !GLOW_ALLOWED.test(sel)
    && [...body.matchAll(/(?:box-shadow|filter|text-shadow)\s*:\s*([^;]+)/g)].some(([, value]) => value.split(/,(?![^(]*\))/).some(part => !/inset|^\s*none|var\(--sel-ring\)/.test(part))))
    .map(({ name, sel }) => `${name}: ${sel.slice(0, 110)}`);
  assert.deepEqual(glowing, [], 'a selected state glows — Rule B');
  // The central glow stays where it belongs: the current prayer and the headings' ornament.
  const base = read('../src/styles/base.css');
  assert.match(base, /\.day-service-buttons button\.is-now\{[^}]*conic-gradient\(from var\(--brand-angle\)/);
  assert.match(read('../src/styles/ui.css'), /\.title-ornament i\{[^}]*animation:brand-turn 16s linear infinite\}/);
});

test('Rule C: the Talmud home is symmetric — the head and "פתיחת דף" centred, each tractate centred in its tile', () => {
  const css = read('../src/styles/base.css');
  assert.match(css, /\.talmud-home>:is\(\.eyebrow,h1,\.intro\)\{text-align:center\}/);
  assert.match(css, /\.talmud-home \.halacha-search\{max-width:560px;margin-inline:auto\}/);
  assert.match(css, /\.talmud-home \.halacha-search label\{text-align:center\}/);
  assert.match(css, /\.talmud-home \.tractate-grid\{display:flex;flex-wrap:wrap;justify-content:center\}/);
  assert.match(css, /\.talmud-home \.tractate-card\{flex:0 1 calc\(\(100% - 8px\) \/ 2\);min-width:0;justify-items:center;align-content:center;padding-inline:12px;text-align:center\}/);
  assert.match(read('../src/pages/TalmudPage.jsx'), /<label htmlFor="daf-input">פתיחת דף<\/label>/);
});

test('Rule D: בשבילי היום › דברי חכמים is a horizontal block across the column, never a word a line', () => {
  const css = read('../src/styles/leatzmi.css');
  assert.match(css, /\.lz-sage>\*\{justify-self:stretch;min-width:0\}/);
  assert.match(css, /\.lz-sage blockquote\{box-sizing:border-box;width:100%;max-width:34ch;margin:6px auto 2px;[^}]*text-align:center;overflow-wrap:normal;word-break:normal;white-space:normal;writing-mode:horizontal-tb\}/);
});
