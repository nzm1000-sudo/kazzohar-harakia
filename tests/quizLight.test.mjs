// שעשועון טריוויה יהודי — the light quiz (styles/quiz.css › "The light quiz"): the same game on the app's paper. Guards
// that it keeps the app's language: quiet type (never past 500), Heebo, thin copper outlines for the chosen (never a
// fill, never a glow), gentle green / red feedback, the clock's red, no night chrome around it, and the moving gold light
// only on the central element.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/quiz.css', import.meta.url), 'utf8');
const START = '/* ==== The light quiz';
const at = css.indexOf(START);
const lightCss = css.slice(at);
const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
const rulesOf = text => [...strip(text).matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.trim().replace(/\s+/g, ' '), parts: sel.trim().replace(/\s+/g, ' ').split(/,(?![^(]*\))/).map(p => p.trim()), body }));
const lightRules = rulesOf(lightCss);
const nightRules = rulesOf(css.slice(0, at));
const PREFIX = 'html.qz-arena-light';
const weight = body => Number(body.match(/font-weight:(\d+)/)?.[1] || 0);

test('the light block is last in the file and every one of its rules is scoped to the light class', () => {
  assert.ok(at > 0, 'the light block exists');
  assert.ok(at > css.lastIndexOf('/* ==== The arena'), 'after the night, so its rules follow it');
  for (const { parts } of lightRules) for (const part of parts) assert.match(part, /^html\.qz-arena-light/, part);
});

test('quiet type: no weight past 500 in the light quiz, and every heavier rule of the night has its light twin', () => {
  for (const { sel, body } of lightRules) assert.ok(weight(body) <= 500, `${sel}: ${weight(body)}`);
  const twins = new Map();
  for (const { parts, body } of lightRules) if (weight(body)) for (const p of parts) twins.set(p, weight(body));
  const missing = [];
  for (const { parts, body } of nightRules) {
    if (weight(body) < 600) continue;
    for (const p of parts) if (!twins.has(`${PREFIX} ${p}`)) missing.push(`${p} (${weight(body)})`);
  }
  assert.deepEqual(missing, [], 'a heavy weight would show in the light quiz');
  assert.match(lightCss, /html\.qz-arena-light \.quiz-page\{[^}]*font-family:'Heebo',/, 'the quiz text in Heebo');
  assert.match(lightCss, /html\.qz-arena-light \.quiz-page \.quiz-title\{font-weight:500;/);
  assert.match(lightCss, /html\.qz-arena-light \.qz-levelup b\{[^}]*font-weight:500!important\}/, 'the night\'s !important too');
});

test('the chosen is a thin copper outline: no fill, no glow (only the marks — bars, tiles, a switch knob — are solid)', () => {
  const SELECTED = /\.(on|is-on|current|is-current|chosen|is-chosen|checked|selected)(?![\w-])|\[aria-(checked|pressed|selected|current)/;
  const MARKS = /qz-week-bar|qz-grid i|quiz-switch-knob|qz-rail/;
  const filled = []; const glowing = [];
  for (const { sel, body } of lightRules) {
    if (!SELECTED.test(sel) || MARKS.test(sel)) continue;
    for (const [, v] of body.matchAll(/background(?:-color)?\s*:\s*([^;]+)/g)) if (!/^(transparent|none)$/.test(v.trim())) filled.push(sel);
    for (const [, v] of body.matchAll(/(?:box-shadow|filter|text-shadow)\s*:\s*([^;]+)/g)) if (v.split(/,(?![^(]*\))/).some(x => !/inset|^\s*none/.test(x))) glowing.push(sel);
    for (const [, v] of body.matchAll(/(?:^|;)fill\s*:\s*([^;]+)/g)) if (!/^(transparent|none)$/.test(v.trim())) filled.push(sel);
  }
  assert.deepEqual(filled, [], 'a chosen state is filled in the light quiz');
  assert.deepEqual(glowing, [], 'a chosen state glows in the light quiz');
  // The lit faces of the lozenges are put away, the chosen answer and area take the app's own copper outline.
  assert.match(lightCss, /html\.qz-arena-light \.qz-face-a,html\.qz-arena-light \.qz-face-b\{stop-opacity:0\}/);
  assert.match(lightCss, /html\.qz-arena-light \.quiz-page \.qz-option\.is-chosen \.qz-edge\{stroke:var\(--sel-line,var\(--accent\)\);stroke-width:1\.2\}/);
  assert.match(lightCss, /html\.qz-arena-light \.qz-orb\.is-on\{border-color:var\(--sel-line,var\(--accent\)\);color:var\(--sel-ink,var\(--accent\)\);box-shadow:none\}/);
  assert.match(lightCss, /html\.qz-arena-light \.quiz-page \.quiz-pill\.is-on\{border-color:var\(--sel-line,var\(--accent\)\)/);
  assert.match(lightCss, /html\.qz-arena-light \.quiz-page \.quiz-primary\{border-width:1px;[^}]*box-shadow:none\}/, 'the copper pill, no 3D shadow');
});

test('feedback: a right answer — a thin green outline and its check; a miss — a thin red one; nothing filled', () => {
  assert.match(lightCss, /--qz-right:color-mix\(in oklch,seagreen/);
  assert.match(lightCss, /html\.qz-arena-light \.quiz-page \.is-right \.qz-option\.is-chosen \.qz-edge\{stroke:var\(--qz-right\);stroke-width:1\.4\}/);
  assert.match(lightCss, /html\.qz-arena-light \.quiz-page \.is-wrong \.qz-option\.is-chosen \.qz-edge\{stroke:var\(--q-wrong\);stroke-width:1\.4\}/);
  assert.match(lightCss, /html\.qz-arena-light \.quiz-page \.is-right \.quiz-option\.is-chosen\{border-color:var\(--qz-right\);box-shadow:inset 0 0 0 \.5px var\(--qz-right\)\}/);
  assert.match(lightCss, /html\.qz-arena-light \.quiz-page \.is-right \.qz-verdict b\{background:none;color:var\(--qz-right\)/);
  assert.match(lightCss, /html\.qz-arena-light \.quiz-page \.qz-option\.is-revealed \.qz-edge\{stroke:var\(--qz-right\)/);
});

test('the clock\'s last ten seconds stay red (and blink with motion) in the light quiz', () => {
  assert.match(lightCss, /--qz-alarm:color-mix\(in oklch,red 58%,var\(--danger\)\);--qz-alarm-lit:var\(--qz-alarm\)/, 'a full red on the paper');
  assert.match(lightCss, /html\.qz-arena-light \.qz-clock\.is-urgent \.qz-clock-left\{stroke:var\(--qz-alarm-lit\);filter:none\}/);
  assert.match(css, /html:not\(\[data-a11y-motion\]\) \.qz-clock\.is-urgent\{animation:qz-blink/, 'the blink is shared by both looks');
  assert.doesNotMatch(lightCss, /qz-clock\.is-urgent\{animation:none/);
});

test('no night around the light quiz: over a dark app theme the app\'s own tokens turn to the paper', () => {
  const rule = lightCss.match(/html\.qz-arena-light\[data-theme="dark"\],html\.qz-arena-light\[data-theme="amber"\]\{([^}]*)\}/);
  assert.ok(rule, 'the dark themes re-pointed');
  for (const token of ['--bg', '--surface', '--text', '--text-muted', '--border', '--accent', '--gold', '--danger']) assert.match(rule[1], new RegExp(`${token}:`), token);
  assert.match(rule[1], /color-scheme:light/);
  assert.match(lightCss, /html\.qz-arena-light\[data-theme="dark"\] body,html\.qz-arena-light\[data-theme="amber"\] body\{background:var\(--bg\)\}/);
  assert.match(lightCss, /html\.qz-arena-light \.quiz-page::before\{content:none\}/, 'no field of stars');
  assert.doesNotMatch(lightCss, /qz-arena-on/, 'the night\'s chrome class is never used by the light quiz');
  assert.doesNotMatch(lightCss.replace(/--md-[a-z-]+:#[0-9a-f]+/gi, ''), /#[0-9a-f]{3,8}\b/i, 'named colours and theme tokens only');
});

test('motion: the soft gold light breathes only on the central element, only in the motion block', () => {
  const motionAt = lightCss.indexOf('@media (prefers-reduced-motion:no-preference)');
  assert.ok(motionAt > 0);
  assert.doesNotMatch(strip(lightCss.slice(0, motionAt)), /animation:/);
  const animated = [...lightCss.slice(motionAt).matchAll(/\n(html[^{]*)\{animation:(?!none)/g)].map(m => m[1]);
  assert.deepEqual(animated, [
    'html.qz-arena-light:not([data-a11y-motion]) .qz-question:is(.is-ask,.is-confirm) .qz-qframe .qz-frame',
    'html.qz-arena-light:not([data-a11y-motion]) .quiz-question:not(.is-right):not(.is-wrong) .quiz-count::before',
  ]);
  assert.match(lightCss, /html\.qz-arena-light:not\(\[data-a11y-motion\]\) \.qz-orb\.is-on \.qz-orb-icon\{animation:none\}/, 'a chosen area does not move');
});
