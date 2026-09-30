// מילון בלחיצה — the offline word lookup of the readers: tokenizer, normalization, abbreviations, morphology, context,
// ambiguity, unknown words, the dismiss-first tap machine, the bubble's placement and size, the rights gate and the
// build's determinism. The lookup is local: no network, no model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as data from '../src/data/dictionary/wordDictionary.mjs';
import { DICTIONARY_SOURCES, auditDictionarySources } from '../src/data/dictionary/sources.mjs';
import { normalizeLookupToken, tokenAt, tokenizeLookup } from '../src/services/wordLookup/normalize.mjs';
import { setWordDictionary, getShortGloss, lookupWord, resolveWordContext } from '../src/services/wordLookup/engine.mjs';
import { createGestureMachine, TAP } from '../src/services/wordLookup/gesture.mjs';
import { placeGloss, sizeGloss, GLOSS_BOX } from '../src/services/wordLookup/placement.mjs';
import { lookupFamilyForWork, lookupFamilyForLayer, lookupFamilyForCategory } from '../src/services/wordLookup/families.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
setWordDictionary(data);
const ctx = family => resolveWordContext({ family });
const gloss = (word, family = 'talmud') => getShortGloss(word, ctx(family));

// ---------- Normalization and the tokenizer ----------
test('nikud and te\'amim are ignored for matching; the key keeps letters only', () => {
  assert.equal(normalizeLookupToken('אִיתְּמַר'), 'איתמר');
  assert.equal(normalizeLookupToken('בְּרֵאשִׁ֖ית'), 'בראשית');
  assert.equal(normalizeLookupToken('הָכָא'), 'הכא');
});
test('gershayim in every spelling is one abbreviation; a closing geresh is kept', () => {
  for (const spelling of ['ת"ש', 'ת״ש', "ת''ש", 'ת׳׳ש', 'ת“ש', 'ת”ש']) assert.equal(normalizeLookupToken(spelling), 'ת״ש', spelling);
  assert.equal(normalizeLookupToken('רש"י'), normalizeLookupToken('רש״י'));
  assert.equal(normalizeLookupToken("מתני'"), 'מתני׳');
  assert.equal(normalizeLookupToken('מתני׳:'), 'מתני׳');
});
test('punctuation around a word is dropped for lookup', () => {
  for (const w of ['(איתמר)', 'איתמר,', 'איתמר.', 'איתמר:', 'איתמר;', '"איתמר"', '[איתמר]']) assert.equal(normalizeLookupToken(w), 'איתמר', w);
});
test('word boundaries: maqaf, sof pasuq, paseq, colon, semicolon, quotes, parentheses, dashes', () => {
  const text = 'אמר רב (איתמר) ת"ש: מתני\' הכא־התם; "שלום" רש"י. וַיֹּ֥אמֶר׃ אֱלֹהִ֑ים ׀ הא–הא';
  const words = tokenizeLookup(text).map(t => t.raw);
  assert.deepEqual(words, ['אמר', 'רב', 'איתמר', 'ת"ש', "מתני'", 'הכא', 'התם', 'שלום', 'רש"י', 'וַיֹּ֥אמֶר', 'אֱלֹהִ֑ים', 'הא', 'הא']);
  // Spans are the original text's own: nothing is changed for display.
  for (const token of tokenizeLookup(text)) assert.equal(text.slice(token.start, token.end), token.raw);
});
test('tokenAt finds the word under any offset of it, and nothing on a boundary', () => {
  const text = 'אמר רב (איתמר) ת"ש';
  assert.equal(tokenAt(text, 9).raw, 'איתמר');
  assert.equal(tokenAt(text, 13).raw, 'איתמר'); // a caret just after the last letter
  assert.equal(tokenAt(text, 16).raw, 'ת"ש'); // on the gershayim itself
  assert.equal(tokenAt(text, 7), null); // the opening parenthesis
});
test('the tokenizer keeps the common abbreviations as one token', () => {
  for (const abbr of ['ת״ש', 'רש״י', 'חז״ל', 'רמב״ם', 'שו״ע', 'או״ח', 'יו״ד', 'ס״ק']) {
    const tokens = tokenizeLookup(`ראה ${abbr} שם`);
    assert.equal(tokens.length, 3, abbr);
    assert.equal(tokens[1].raw, abbr);
  }
});

// ---------- Lookups, from the licensed data only ----------
test('the reviewed QA set: Aramaic words and abbreviations the licensed data glosses', () => {
  const expected = {
    'איתמר': 'נאמר', 'אִיתְּמַר': 'נאמר', 'הכא': 'כאן', 'התם': 'שם', 'קמא': 'ראשון', 'בתרא': 'אחרון', 'מאי': 'מה?', 'נמי': 'גם, כמו כן',
    'לית': 'אין', 'איכא': 'יש', 'ת״ש': 'תא שמע', 'ת"ש': 'תא שמע', 'רש״י': 'ר׳ שלמה יצחקי', 'רמב״ם': 'רבי משה בן מימון', 'שו״ע': 'שולחן ערוך',
    'או״ח': 'אורח חיים', 'ס״ק': 'סעיף קטן', 'חז״ל': 'חכמינו זכרונם לברכה', 'הקב״ה': 'הקדוש ברוך הוא', 'ת״ר': 'תנו רבנן', 'ק״ו': 'קל וחומר',
  };
  for (const [word, want] of Object.entries(expected)) assert.equal(gloss(word), want, word);
});
test('Zohar and Targum vocabulary', () => {
  assert.equal(gloss('איהי', 'zohar'), 'היא');
  assert.equal(gloss('עלמא', 'zohar'), 'עולם');
  assert.equal(gloss('סטרא', 'zohar'), 'צד');
  assert.equal(gloss('ארעא', 'targum'), 'אדמה, ארץ');
  assert.equal(gloss('יָתְהוֹן', 'targum'), 'אותם');
});
test('an ambiguous abbreviation reads by context, and says nothing where the context does not decide', () => {
  assert.equal(gloss('ר״ל', 'talmud'), 'ריש לקיש');
  assert.equal(gloss('ר״ל', 'halacha'), 'רוצה לומר');
  assert.equal(gloss('ר״ל', 'zohar'), null);
  assert.equal(gloss('ת״ש', 'talmud'), 'תא שמע');
  assert.equal(gloss('ת״ש', 'halacha'), null); // תקיעת שופר / תפילת שחרית elsewhere
  assert.equal(gloss('ע״ש', 'halacha'), 'עיין שם');
  assert.equal(gloss('ע״ש', 'talmud'), null);
  assert.equal(gloss('יו״ד', 'halacha'), 'יורה דעה');
  assert.equal(gloss('יו״ד', 'zohar'), null); // the letter yod
  assert.equal(gloss('ד״א', 'zohar'), 'דבר אחר');
});
test('two genuinely plausible readings are shown compactly; more are not', () => {
  assert.equal(gloss('א״ר'), 'אמר רב · אמר רבי');
  assert.equal(gloss('ר״ח'), null); // ר׳ חנינא · ראש חודש · רב חסדא
  assert.equal(gloss('בעי'), null);
});
test('Aramaic-only homographs of Biblical Hebrew stay out of the Tanakh commentaries', () => {
  assert.equal(gloss('איתמר', 'talmud'), 'נאמר');
  assert.equal(gloss('איתמר', 'tanakh-commentary'), null); // the name Itamar there
});
test('unknown words, Hebrew words and sages\' names give nothing', () => {
  for (const w of ['שלום', 'ישראל', 'משה', 'בית', 'ספר', 'אמר', 'לא', 'רבי', 'חסדא', 'נחמן', 'אביי', 'עולא', 'קובץ', 'xyz', '', '123']) assert.equal(gloss(w), null, w);
});
test('reviewed prefixes compose: ו־ ד־ (and never into a separate word of the corpus)', () => {
  assert.equal(gloss('והכא'), 'וכאן');
  assert.equal(gloss('והתם'), 'ושם');
  assert.equal(gloss('דהכא'), 'של כאן');
  assert.equal(gloss('ואיכא'), 'ויש');
  assert.equal(gloss('דאתא'), 'שבא');
  assert.equal(lookupWord('והכא', ctx('talmud')).via, 'prefix');
  // Blocked: prefixed forms that are words of their own in the Gemara (דמיא "is like", כספא "silver", בבלאי).
  for (const w of ['דמיא', 'כספא', 'בבלאי', 'דכיון', 'דרשו']) assert.equal(gloss(w), null, w);
});
test('a spelling alias the source gives is followed (ליכא, plene spellings)', () => {
  assert.equal(gloss('ליכא'), 'אין');
  assert.equal(lookupWord('ליכא', ctx('talmud')).via, 'alias');
});
test('every gloss is short: at most four words (six for an abbreviation), never a paragraph', () => {
  const lines = data.ENTRIES.split('\n');
  assert.ok(lines.length > 8000);
  for (const line of lines) {
    const [g, type] = line.split('\t');
    assert.ok(g && g.length <= 40 && !/\n/.test(g), g);
    assert.ok(g.split(/\s+/).length <= (type === 'B' ? 6 : 4), g);
  }
});

// ---------- Families ----------
test('reader families: the Tanakh, the Mishnah and prayer stay out; Talmud, Zohar, Targum, commentaries are in', () => {
  assert.equal(lookupFamilyForWork({ workId: 'Genesis', primaryCategory: 'tanakh' }), null);
  assert.equal(lookupFamilyForWork({ workId: 'Mishnah_Berakhot', primaryCategory: 'mishnah' }), null);
  assert.equal(lookupFamilyForWork({ workId: 'Zohar', primaryCategory: 'kabbalah' }), 'zohar');
  assert.equal(lookupFamilyForWork({ workId: 'Yahel_Ohr_on_Zohar', primaryCategory: 'kabbalah' }), 'kabbalah');
  assert.equal(lookupFamilyForWork({ workId: 'Rashi_on_Genesis', primaryCategory: 'tanakh-commentary' }), 'tanakh-commentary');
  assert.equal(lookupFamilyForLayer({ relationType: 'translation', work: { workId: 'Onkelos_Genesis', title: 'Onkelos Genesis' } }), 'targum');
  assert.equal(lookupFamilyForCategory('Tanakh'), null);
  assert.equal(lookupFamilyForCategory('Halakhah'), 'halacha');
});

// ---------- The dismiss-first tap machine ----------
test('closed: a short tap may look a word up; an assistive/keyboard click (no press) too, a keyboard Enter not', () => {
  let now = 0; const m = createGestureMachine({ now: () => now });
  m.pointerDown({ x: 10, y: 10 }); now += 80;
  assert.deepEqual(m.click({ x: 10, y: 10 }), { consume: false, lookup: true, close: false });
  assert.equal(m.click({ x: 10, y: 10, keyboard: true }).lookup, false);
  m.pointerDown({ x: 10, y: 10 }); now += 80;
  assert.equal(m.click({ x: 10, y: 10, selection: true }).lookup, false); // a tap that clears a selection
});
test('closed: a long press or a scroll is not a tap', () => {
  let now = 0; const m = createGestureMachine({ now: () => now });
  m.pointerDown({ x: 10, y: 10 }); now += TAP.longPress + 50;
  assert.equal(m.click({ x: 10, y: 10 }).lookup, false);
  m.pointerDown({ x: 10, y: 10 }); m.pointerMove({ x: 10, y: 40 }); now += 50;
  assert.equal(m.click({ x: 10, y: 40 }).lookup, false);
});
test('open: any press outside closes at once and the whole gesture is consumed — never replaced on the same tap', () => {
  let now = 0; const m = createGestureMachine({ now: () => now });
  m.opened();
  assert.deepEqual(m.pointerDown({ x: 100, y: 100 }), { close: true, consume: true });
  assert.equal(m.isOpen, false);
  assert.equal(m.companion().consume, true); // pointerup / touchend / mouse events of that gesture
  assert.equal(m.preventTouchEnd(), true); // no synthesized click, no focus
  now += 60;
  assert.deepEqual(m.click({ x: 100, y: 100 }), { consume: true, lookup: false, close: false });
  // The next tap is a new gesture and behaves normally.
  now += 300; m.pointerDown({ x: 100, y: 100 }); now += 60;
  assert.equal(m.click({ x: 100, y: 100 }).lookup, true);
});
test('open: a scroll that starts outside closes and keeps scrolling (its touchend is not prevented)', () => {
  const m = createGestureMachine();
  m.opened();
  m.pointerDown({ x: 100, y: 300 });
  m.pointerMove({ x: 100, y: 200 });
  assert.equal(m.preventTouchEnd(), false);
});
test('a late synthesized click of the dismissing press is eaten; a far or later click is not', () => {
  let now = 0; const m = createGestureMachine({ now: () => now });
  m.opened(); m.pointerDown({ x: 50, y: 50 });
  // A different gesture starts (e.g. a mouse-compat path) … then the old click arrives late, near the press.
  now += 300;
  assert.equal(m.click({ x: 52, y: 51 }).consume, true);
  m.opened(); m.pointerDown({ x: 50, y: 50 }); m.click({ x: 50, y: 50 });
  now += TAP.lateClick + 100; m.pointerDown({ x: 200, y: 200 }); now += 50;
  assert.equal(m.click({ x: 200, y: 200 }).consume, false);
});
test('open: the bubble body is inert and does not close; a click without a press outside closes and is consumed', () => {
  const m = createGestureMachine();
  m.opened();
  assert.deepEqual(m.pointerDown({ x: 1, y: 1, insideBubble: true }), { close: false, consume: false });
  assert.deepEqual(m.click({ x: 1, y: 1, insideBubble: true }), { consume: false, lookup: false, close: false });
  assert.equal(m.isOpen, true);
  assert.deepEqual(m.click({ x: 300, y: 300 }), { consume: true, lookup: false, close: true });
});

// ---------- Placement and size ----------
const viewport = { width: 390, height: 844 };
test('above the word by preference, with a small gap; below when there is no room', () => {
  const size = { width: 120, height: 42 };
  const above = placeGloss({ anchor: { left: 150, right: 190, top: 400, bottom: 430 }, size, viewport, insets: { top: 100, bottom: 80 } });
  assert.equal(above.placement, 'above');
  assert.equal(400 - (above.top + 42), 7);
  assert.equal(above.left + 60, 170); // centred on the word
  const below = placeGloss({ anchor: { left: 150, right: 190, top: 120, bottom: 150 }, size, viewport, insets: { top: 100, bottom: 80 } });
  assert.equal(below.placement, 'below');
  assert.equal(below.top, 157);
});
test('at the edges the bubble shifts inward, keeping its width and the margins', () => {
  const size = { width: 169, height: 42 };
  const right = placeGloss({ anchor: { left: 350, right: 380, top: 400, bottom: 430 }, size, viewport });
  assert.equal(right.left + 169, 390 - 10);
  const left = placeGloss({ anchor: { left: 5, right: 30, top: 400, bottom: 430 }, size, viewport });
  assert.equal(left.left, 10);
});
test('REGRESSION (physical iPhone): a short gloss never collapses toward its min-content — the width comes from the gloss', () => {
  // One-line widths of real glosses at 17px (measured in the iOS simulator): כאן 28, תא שמע 61, ר׳ שלמה יצחקי 107.
  const chrome = 2 * GLOSS_BOX.slot + 2 * GLOSS_BOX.border;
  for (const [text, textWidth] of [['כאן', 28], ['תא שמע', 61], ['ר׳ שלמה יצחקי', 107], ['אחד איסור אכילה ואחד איסור הנאה', 236]]) {
    for (const vw of [320, 375, 390, 440, 1024]) {
      const box = sizeGloss({ textWidth, viewportWidth: vw });
      assert.equal(box.wrap, false, `${text} @${vw}`);
      assert.ok(box.width >= textWidth + chrome, `${text} @${vw}: ${box.width}`);
      assert.ok(box.width >= GLOSS_BOX.minWidth);
    }
  }
  // The word's width plays no part: the size function does not even receive it.
  assert.equal(sizeGloss.length, 1);
  // Only a gloss wider than the screen wraps — to the full safe width, never narrower.
  const huge = sizeGloss({ textWidth: 900, viewportWidth: 390 });
  assert.deepEqual(huge, { width: 370, wrap: true });
});
test('REGRESSION: the bubble CSS forbids character breaking and keeps short glosses on one line', () => {
  const css = read('../src/styles/base.css');
  const block = css.slice(css.indexOf('/* ===== מילון בלחיצה'));
  const rule = sel => (block.match(new RegExp(`(^|\\n)${sel.replace(/[.[\]]/g, '\\$&')}\\{([^}]*)\\}`)) || [])[2] || '';
  const text = rule('.word-gloss-text');
  assert.match(text, /white-space:nowrap/);
  assert.match(text, /word-break:normal/);
  assert.match(text, /overflow-wrap:normal/);
  assert.doesNotMatch(block, /break-all|overflow-wrap:anywhere|word-break:break-word/);
  // The wrapped form (only for a gloss wider than the screen) breaks at spaces only.
  assert.match(rule('.word-gloss.is-wrapped .word-gloss-text'), /white-space:normal/);
  // No global rule elsewhere breaks words everywhere.
  assert.doesNotMatch(css, /\*\s*\{[^}]*word-break:\s*break-all/);
  // The controller sets the width explicitly from the gloss before positioning.
  const controller = read('../src/services/wordLookup/controller.mjs');
  assert.ok(controller.indexOf('sizeGloss(') < controller.indexOf('placeGloss('));
  assert.match(controller, /bubble\.style\.width = `\$\{box\.width\}px`/);
});
test('the X is on the physical left and balanced by an equal empty slot on the right; its hit area is 44×44', () => {
  const controller = read('../src/services/wordLookup/controller.mjs');
  assert.match(controller, /bubble\.append\(mirror, textEl, close, spoken\)/); // RTL row: mirror (right) · gloss · X (left)
  const css = read('../src/styles/base.css');
  assert.match(css, /\.word-gloss-mirror\{flex:0 0 30px/);
  assert.match(css, /\.word-gloss-close\{position:relative;flex:0 0 30px/);
  assert.match(css, /\.word-gloss-close::before\{content:"";position:absolute;top:50%;left:50%;width:44px;height:44px/);
  assert.match(controller, /'סגירת פירוש המילה'/);
});

// ---------- Offline, privacy, the layer ----------
test('offline and private: no network, storage or telemetry in the lookup code; nothing per word', () => {
  for (const file of readdirSync(new URL('../src/services/wordLookup/', import.meta.url))) {
    const source = read(`../src/services/wordLookup/${file}`);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|sefaria\.org|wiktionary\.org/i, file);
  }
  const controller = read('../src/services/wordLookup/controller.mjs');
  // The page text is never touched: the only DOM the controller writes is its own bubble.
  assert.doesNotMatch(controller, /innerHTML|insertAdjacentHTML|surroundContents|splitText|normalize\(\)/);
});
test('the readers mark their text containers only (no span per word)', () => {
  const talmud = read('../src/pages/TalmudPage.jsx');
  assert.equal((talmud.match(/data-lookup="talmud"/g) || []).length, 2);
  assert.match(talmud, /data-lookup="talmud-commentary"/);
  assert.match(read('../src/pages/LibraryPage.jsx'), /data-lookup=\{lookupFamilyForWork\(work\) \|\| undefined\}/);
  assert.match(read('../src/components/CommentaryPanel.jsx'), /data-lookup=\{lookupFamilyForLayer\(layer\) \|\| undefined\}/);
  assert.match(read('../src/pages/ShnayimMikra.jsx'), /className="shnayim-targum" data-lookup="targum"/);
  assert.match(read('../src/main.jsx'), /installWordLookup\(\)/);
});

// ---------- Rights gate and build ----------
test('rights gate: every imported source is complete, cleared and hashed; unclear sources are not imported', () => {
  assert.deepEqual(auditDictionarySources(), []);
  assert.deepEqual(DICTIONARY_SOURCES.filter(s => s.imported).map(s => s.sourceId), ['krupnik-1927', 'he-wiktionary']);
  assert.equal(DICTIONARY_SOURCES.find(s => s.sourceId === 'meturgeman').imported, false);
  assert.equal(DICTIONARY_SOURCES.find(s => s.sourceId === 'klein-1987').imported, false);
  const bad = auditDictionarySources([{ ...DICTIONARY_SOURCES[0], licenceId: 'unknown' }, { ...DICTIONARY_SOURCES[1], contentHash: 'sha256:PENDING' }]);
  assert.equal(bad.length, 2);
  assert.deepEqual(data.SOURCE_IDS, ['krupnik-1927', 'he-wiktionary']);
});
test('the dictionary builds from the committed sources, offline and deterministically (outputs up to date)', () => {
  const script = fileURLToPath(new URL('../scripts/dictionary/build-word-dictionary.mjs', import.meta.url));
  const out = execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.match(out, /up to date/);
});
