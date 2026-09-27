// Polish round: the commentators sheet follows the finger; "עוד" is a compact card; About's slide and the ניצוצא
// rings live gently; the memorial keeps its portrait and title in view inside a gold frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/styles/base.css');

test('the commentators sheet: drag down lowers or closes it, drag up fills the screen, the handle toggles', () => {
  const page = read('../src/pages/TalmudPage.jsx');
  assert.match(page, /if \(state\.delta > 90\) \{ if \(full\) setFull\(false\); else onClose\(\); \} else if \(state\.delta < -50\) setFull\(true\);/);
  assert.match(page, /<button type="button" className="iyun-sheet-handle" onClick=\{\(\) => setFull\(value => !value\)\}/);
  assert.match(css, /\.iyun-grip\{display:block;touch-action:none;/);
  assert.match(css, /\.iyun-panel\.is-full\{max-height:calc\(100dvh - env\(safe-area-inset-top,0px\) - 12px\);/);
});

test('"עוד" opens a compact card above its tab, sized to its items', () => {
  assert.match(css, /\.more-menu \.sheet\{inset-inline-start:auto;[^}]*width:max-content;min-width:220px;/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.more-menu \.sheet,\.more-menu \.sheet button\{animation:none\}\}/);
});

test('About: a living gold frame on the slide and glints on the rings — slow, and still for reduced motion', () => {
  assert.match(css, /\.about-brand\{position:relative;padding:3px;background:conic-gradient\(from var\(--brand-angle\)/);
  assert.match(css, /animation:brand-turn 16s linear infinite,brand-breathe 7s ease-in-out infinite/);
  assert.match(read('../src/pages/AboutPage.jsx'), /<circle r="100" pathLength="100" className="nitzotza-glint" \/>/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.about-brand,\.about-brand::after,\.nitzotza-glint\{animation:none\}\}/);
});

test('the memorial: a still gold frame, the portrait and title stay in view while the words scroll beneath', () => {
  const tribute = read('../src/components/MemorialTribute.jsx');
  assert.match(tribute, /<div className="memorial-scroll" onScroll=\{event => setCompact\(event\.currentTarget\.scrollTop > 24\)\}>/);
  assert.match(tribute, /<header className=\{`memorial-header\$\{compact \? ' is-compact' : ''\}`\}>\s*<button ref=\{closeRef\} className="memorial-close"/);
  assert.match(css, /\.memorial-header\{position:sticky;top:0;z-index:2;/);
  assert.match(css, /\.memorial-dialog::after\{content:'';position:absolute;inset:6px;/);
});
