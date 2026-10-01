import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import legacyCssFallbacks, { fallbackDeclarations } from '../scripts/legacyCssFallbacks.mjs';
import { computeColorMix, mixColors, needsColorMixShim, parseColor, resolveVars, rewriteStylesheet } from '../src/services/legacyColorMix.mjs';
import { androidWebViewMajor, shouldShowWebViewHint, WEBVIEW_HINT_TEXT, WEBVIEW_PLAY_URL } from '../src/services/webViewHint.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const run = css => postcss([legacyCssFallbacks()]).process(css, { from: undefined }).css;

test('CSS fallbacks are written BEFORE the modern declaration, so a current engine keeps the original', () => {
  assert.equal(run('.a{max-height:min(58dvh,440px)}'), '.a{max-height:min(58vh,440px);max-height:min(58dvh,440px)}');
  assert.equal(run('.a{height:calc(100svh - 12px)}'), '.a{height:calc(100vh - 12px);height:calc(100svh - 12px)}');
  assert.equal(run('.a{inset:0}'), '.a{top:0;right:0;bottom:0;left:0;inset:0}');
  assert.equal(run('.a{inset:15% 0 auto}'), '.a{top:15%;right:0;bottom:auto;left:0;inset:15% 0 auto}');
  assert.equal(run('.a{inset-inline:0}'), '.a{left:0;right:0;inset-inline:0}');
  assert.equal(run('.a{inset-inline:0 12px}'), '.a{inset-inline:0 12px}', 'unequal sides depend on direction: left alone');
  assert.equal(run('.a{margin-inline:-4px .35em}'), '.a{margin-inline-start:-4px;margin-inline-end:.35em;margin-inline:-4px .35em}');
  assert.equal(run('.a{padding-block:4px}'), '.a{padding-block-start:4px;padding-block-end:4px;padding-block:4px}');
  assert.equal(run('.a{--x:10dvh;color:red}'), '.a{--x:10dvh;color:red}', 'custom properties untouched');
  assert.deepEqual(fallbackDeclarations('max-height', '88dvh !important'), [['max-height', '88vh !important']]);
});

test('vite runs the fallbacks on every stylesheet', () => {
  assert.match(read('../vite.config.js'), /css: \{ postcss: \{ plugins: \[legacyCssFallbacks\(\)\] \} \}/);
});

test('color-mix computed like CSS Color 5 (sRGB, premultiplied alpha, percentages normalised)', () => {
  assert.deepEqual(parseColor('#9a4a1f'), [154, 74, 31, 1]);
  assert.deepEqual(parseColor('rgb(1 2 3 / 50%)'), [1, 2, 3, 0.5]);
  assert.deepEqual(parseColor('transparent'), [0, 0, 0, 0]);
  assert.equal(parseColor('currentColor'), null);
  assert.deepEqual(mixColors([255, 0, 0, 1], 50, [0, 0, 255, 1], null), [127.5, 0, 127.5, 1]);
  const vars = { '--accent': '#9a4a1f', '--surface': '#ffffff', '--hover': 'color-mix(in srgb, var(--accent) 10%, transparent)' };
  const getVar = name => vars[name] ?? '';
  assert.equal(computeColorMix('color-mix(in srgb,var(--accent) 50%,transparent)', getVar), 'rgba(154,74,31,0.5)');
  assert.equal(computeColorMix('color-mix(in srgb,var(--accent) 11%,var(--surface))', getVar), 'rgb(244,235,230)');
  assert.equal(computeColorMix('0 0 7px color-mix(in srgb,var(--hover) 50%,transparent)', getVar), '0 0 7px rgba(154,74,31,0.05)', 'nested through a variable');
  assert.equal(computeColorMix('color-mix(in srgb,currentColor 50%,transparent)', getVar), null, 'unresolvable: left as it was');
  assert.equal(resolveVars('var(--missing, #fff)', getVar), '#fff');
});

test('a stylesheet keeps its order; only color-mix values change', () => {
  const getVar = name => ({ '--accent': '#000000', '--bg': '#ffffff' })[name] || '';
  const css = '.a{color:red;background:color-mix(in srgb,var(--accent) 50%,var(--bg))}.b{--t:color-mix(in srgb,var(--accent) 20%,transparent) !important}.c{border:1px solid color-mix(in srgb,currentColor 50%,transparent)}';
  assert.equal(rewriteStylesheet(css, getVar), '.a{color:red;background:rgb(128,128,128)}.b{--t:rgba(0,0,0,0.2) !important}.c{border:1px solid color-mix(in srgb,currentColor 50%,transparent)}');
  assert.equal(needsColorMixShim({ supports: () => true }), false, 'a modern engine: nothing runs');
  assert.equal(needsColorMixShim({ supports: () => false }), true);
  assert.equal(needsColorMixShim(undefined), false);
});

test('the WebView hint: Android app only, WebView older than 111, once', () => {
  const old = 'Mozilla/5.0 (Linux; Android 9; SM-J600F Build/PPR1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36';
  const modern = old.replace('Chrome/95.0.4638.74', 'Chrome/128.0.6613.40');
  assert.equal(androidWebViewMajor(old), 95);
  assert.equal(androidWebViewMajor('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120.0'), null);
  assert.equal(shouldShowWebViewHint({ platform: 'android', userAgent: old, alreadyShown: false }), true);
  assert.equal(shouldShowWebViewHint({ platform: 'android', userAgent: old, alreadyShown: true }), false);
  assert.equal(shouldShowWebViewHint({ platform: 'android', userAgent: modern, alreadyShown: false }), false);
  assert.equal(shouldShowWebViewHint({ platform: 'ios', userAgent: old, alreadyShown: false }), false);
  assert.equal(shouldShowWebViewHint({ platform: 'web', userAgent: old, alreadyShown: false }), false, 'a browser is not the WebView');
  assert.equal(WEBVIEW_HINT_TEXT, 'לחוויה מיטבית עדכנו את Android System WebView בחנות Google Play');
  assert.equal(WEBVIEW_PLAY_URL, 'https://play.google.com/store/apps/details?id=com.google.android.webview');
});

test('start-up order: polyfills first, the hint beside the app, the color-mix shim installed', () => {
  const main = read('../src/main.jsx');
  assert.ok(main.indexOf("import './legacyPolyfills.mjs'") < main.indexOf("import React from 'react'"));
  assert.match(main, /<App \/>\n\s*<WebViewUpdateHint \/>/);
  assert.match(main, /installLegacyColorMix\(\)\.catch/);
});

test('polyfills fill only what is missing (Array/String .at, replaceAll, Object.hasOwn, structuredClone)', async () => {
  const saved = { at: Array.prototype.at, sat: String.prototype.at, clone: globalThis.structuredClone };
  delete Array.prototype.at; delete String.prototype.at; delete globalThis.structuredClone;
  try {
    await import(`../src/legacyPolyfills.mjs?${Date.now()}`);
    assert.equal([1, 2, 3].at(-1), 3);
    assert.equal('אבג'.at(0), 'א');
    const copy = structuredClone({ d: new Date(5), list: [1, { x: 2 }] });
    assert.equal(copy.d.getTime(), 5); assert.equal(copy.list[1].x, 2);
  } finally {
    Array.prototype.at = saved.at; String.prototype.at = saved.sat; globalThis.structuredClone = saved.clone;
  }
});

test('overflow guards for narrow older phones', () => {
  const css = read('../src/styles/base.css');
  assert.match(css, /\nhtml\{overflow-x:hidden\}\n/);
  assert.match(css, /\.halacha-flow\{display:grid;grid-template-columns:minmax\(0,1fr\);/);
  assert.match(css, /\.halacha-feature-card\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /@media \(max-width:359px\)\{\.weather-strip\{padding-inline:10px;column-gap:6px\}/);
  assert.doesNotMatch(css.slice(css.indexOf('.webview-hint{')), /color-mix/, 'the hint uses plain colours');
});
