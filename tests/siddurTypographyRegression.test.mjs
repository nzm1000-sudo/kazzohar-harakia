import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { normalizeSiddurBlocks } from '../src/services/siddurBlocks.mjs';
import { buildSiddurConditionSummary, shouldDisplaySiddurSection } from '../src/services/siddurConditionEngine.mjs';
import siddurOffline from '../src/data/siddurOffline.mjs';
import { normalizeText } from '../src/services/sefaria.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { normalizeForSearch } from '../src/hebrewText.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const css = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');

function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({
    entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false,
    loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env.BASE_URL': '"/"' },
    external: ['react', 'react/jsx-runtime', 'react-dom/server'],
  }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function bundledSiddurBlocks(reference, context) {
  const text = normalizeText(siddurOffline.texts[reference]);
  const paragraphs = text.hebrew.map((value, index) => ({ text: value, source: text.indexes?.[index] ?? index }));
  return normalizeSiddurBlocks(paragraphs, {
    title: reference.endsWith('Petichat Eliyahu') ? 'פתח אליהו' : 'עמידה',
    markup: paragraphs.map(part => text.siddurMarkup?.[part.source] || part.text),
    context,
  });
}

test('production Siddur renderer preserves the established prayer class and exact source text', () => {
  const blocks = normalizeSiddurBlocks([
    { text: 'עמידה', source: 0 },
    { text: 'בעשרת ימי תשובה אומרים:', source: 1 },
    { text: 'שְׁמַע יִשְׂרָאֵל ה׳ אֱלֹהֵינוּ ה׳ אֶחָד׃', source: 2 },
  ], { title: 'עמידה', context: { isAseretYemeiTeshuvah: true } });
  const { SiddurBlockRenderer } = loadJsx('components/SourceReader.jsx');
  const html = renderToStaticMarkup(React.createElement(SiddurBlockRenderer, { blocks, font: 25, policy: 'siddur' }));
  assert.match(html, /siddur-block-heading/);
  assert.match(html, /reading-instruction siddur-block-instruction/);
  assert.match(html, /reading-prayer siddur-block-recited/);
  assert.match(html, /שְׁמַע יִשְׂרָאֵל ה׳ אֱלֹהֵינוּ ה׳ אֶחָד׃/);
  assert.doesNotMatch(html, /עוגן מאומת|אין עוגן|NOT_VERIFIED|fallback|parser|resolver|inline insertion|source node|anchor/);
});

test('actual prayer retains the prior reading size, font policy, and line-height; semantic recited class changes color only', () => {
  const bodyRule = css.match(/\.reading-text\{[^}]*\}/)?.[0] || '';
  const readingPolicy = css.match(/\.reading-text\[data-policy="tanakh"\],\.reading-text\[data-policy="siddur"\][^{]*\{[^}]*\}/)?.[0] || '';
  const recitedRule = css.match(/\.reading-text\.siddur-semantic \.siddur-block-recited,[^{]*\{[^}]*\}/)?.[0] || '';
  assert.match(bodyRule, /font-size:clamp\(20px,2\.5vw,26px\)/);
  assert.match(readingPolicy, /font-family:var\(--font-reading\);line-height:1\.95/);
  assert.match(recitedRule, /color:var\(--ink\)/);
  assert.doesNotMatch(recitedRule, /font-size|font-family|line-height/);
});

test('instructions are smaller, muted and never editorial red; section titles are slightly larger and editorial', () => {
  assert.match(css, /\.reading-text\.siddur-semantic \.siddur-block-heading\{[^}]*font-size:1\.18em[^}]*color:var\(--siddur-editorial\)/);
  assert.match(css, /\.reading-text\.siddur-semantic \.siddur-block-instruction\{[^}]*font-size:max\(16px,\.68em\)[^}]*color:var\(--ink-2\)/);
  assert.match(css, /--siddur-editorial:color-mix\(in srgb,var\(--danger\) 82%,var\(--accent-soft\) 18%\)/);
  assert.doesNotMatch(css, /\.reading-text\.siddur-semantic \.siddur-block-recited[^}]*color:var\(--siddur-editorial\)/);
});

test('non-applicable Tachanun is omitted with no advisory/debug panel', () => {
  const summary = buildSiddurConditionSummary({ prayerContext: { omitTachanun: true } });
  assert.equal(shouldDisplaySiddurSection('Tachanun', summary), false);
  const { SiddurBlockRenderer } = loadJsx('components/SourceReader.jsx');
  const html = renderToStaticMarkup(React.createElement(SiddurBlockRenderer, { blocks: [], font: 25, policy: 'siddur' }));
  assert.doesNotMatch(html, /לא אומרים היום|עוגן מאומת|אין עוגן|NOT_VERIFIED|condition-panel/);
});

test('real Petichat Eliyahu, Shacharit, Mincha and Arvit retain source wording and semantic headings', () => {
  for (const reference of [
    'Siddur Edot HaMizrach, Weekday Shacharit, Petichat Eliyahu',
    'Siddur Edot HaMizrach, Weekday Shacharit, Amida',
    'Siddur Edot HaMizrach, Weekday Mincha, Amida',
    'Siddur Edot HaMizrach, Weekday Arvit, Amidah',
  ]) {
    const blocks = bundledSiddurBlocks(reference, { seasonal: { mashivHaruch: false, vetenTalUmatar: false } });
    assert.ok(blocks.some(block => block.type === 'heading'), reference);
    assert.ok(blocks.some(block => block.type === 'recitedText'), reference);
    assert.ok(blocks.every(block => !/עוגן מאומת|אין עוגן|NOT_VERIFIED/.test(block.text)), reference);
  }
});

test('the shipped Amida source shows only the applicable seasonal phrase and gates Aseret/holiday additions', () => {
  const reference = 'Siddur Edot HaMizrach, Weekday Mincha, Amida';
  const makeText = context => bundledSiddurBlocks(reference, context).map(block => block.text).join(' ');
  const summer = makeText({ seasonal: { mashivHaruch: false, vetenTalUmatar: false } });
  const winter = makeText({ seasonal: { mashivHaruch: true, vetenTalUmatar: true } });
  const roshChodesh = makeText({ isRoshChodesh: true, seasonal: { mashivHaruch: false, vetenTalUmatar: false } });
  const aseret = makeText({ isAseretYemeiTeshuvah: true, seasonal: { mashivHaruch: false, vetenTalUmatar: false } });
  const chanukah = makeText({ chanukah: true, seasonal: { mashivHaruch: false, vetenTalUmatar: false } });
  const purim = makeText({ purim: true, seasonal: { mashivHaruch: false, vetenTalUmatar: false } });
  const fast = makeText({ fast: true, seasonal: { mashivHaruch: false, vetenTalUmatar: false } });
  const cholHamoed = makeText({ isCholHaMoed: true, seasonal: { mashivHaruch: false, vetenTalUmatar: false } });
  const ordinary = makeText({ seasonal: { mashivHaruch: false, vetenTalUmatar: false }, fast: false });
  assert.match(summer, /מוֹרִיד הַטָּל/);
  assert.doesNotMatch(summer, /מַשִּׁיב הָרֽוּחַ/);
  assert.match(winter, /מַשִּׁיב הָרֽוּחַ/);
  assert.doesNotMatch(winter, /מוֹרִיד הַטָּל/);
  assert.match(roshChodesh, /יַעֲלֶה וְיָבֹא/);
  assert.doesNotMatch(ordinary, /יַעֲלֶה וְיָבֹא/);
  assert.match(aseret, /הַמֶּלֶךְ הַקָּדוֹשׁ/);
  assert.doesNotMatch(ordinary, /הַמֶּלֶךְ הַקָּדוֹשׁ/);
  assert.match(chanukah, /עַל הַנִּסִּים/);
  assert.doesNotMatch(ordinary, /עַל הַנִּסִּים/);
  assert.match(purim, /עַל הַנִּסִּים/);
  assert.match(normalizeForSearch(fast), /עננו אבינו/);
  assert.doesNotMatch(normalizeForSearch(ordinary), /עננו אבינו/);
  assert.match(cholHamoed, /יַעֲלֶה וְיָבֹא/);
});

test('24.9.2026 Mincha uses the date-aware bundled prayer on both sides of Jerusalem sunset', () => {
  const settings = { il: true, location: { tzid: 'Asia/Jerusalem' } };
  const sunset = new Date('2026-09-24T15:20:00Z');
  const beforeContext = JewishContextEngine({ now: new Date('2026-09-24T15:19:00Z'), settings, times: { sunset }, items: [], prayerType: 'mincha' });
  const afterContext = JewishContextEngine({ now: new Date('2026-09-24T15:21:00Z'), settings, times: { sunset }, items: [], prayerType: 'mincha' });
  const makeText = context => bundledSiddurBlocks('Siddur Edot HaMizrach, Weekday Mincha, Amida', context).map(block => block.text).join(' ');
  const before = makeText(beforeContext);
  const after = makeText(afterContext);
  assert.equal(beforeContext.afterSunset, false);
  assert.equal(afterContext.afterSunset, true);
  assert.notEqual(beforeContext.key, afterContext.key);
  assert.match(before, /מוֹרִיד הַטָּל/);
  assert.match(after, /מוֹרִיד הַטָּל/);
  assert.doesNotMatch(before, /מַשִּׁיב הָרֽוּחַ/);
  assert.doesNotMatch(after, /מַשִּׁיב הָרֽוּחַ/);
});

test('Today resume heading renders the polished Hebrew phrase and not the old wording', () => {
  const TodayPage = loadJsx('pages/TodayPage.jsx').default;
  const html = renderToStaticMarkup(React.createElement(TodayPage, {
    now: new Date('2026-09-24T09:00:00Z'), tz: 'Asia/Jerusalem', hebrew: 'י״ג בתשרי תשפ״ז', events: [],
    solar: null, locationName: 'ירושלים', afterSunset: false, onNav: () => {}, context: {}, resume: [],
    onResume: () => {}, onOpenPrayer: () => {}, settings: { location: { name: 'ירושלים', tzid: 'Asia/Jerusalem' } }, setSettings: () => {}, dailyItems: [],
    dailyProgress: {}, onCompleteDaily: () => {}, preparation: null, travel: null,
  }));
  assert.match(html, /להמשיך מהיכן שהפסקת/);
  assert.doesNotMatch(html, /להמשיך מאיפה שהפסקת/);
});
