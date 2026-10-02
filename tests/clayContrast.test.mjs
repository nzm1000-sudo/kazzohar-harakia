// CLAY · contrast (owner decision 4): in every one of the eight palettes, every text colour passes WCAG AA on every
// material stop it can stand on — 4.5:1 for text (body and the 15px meta lines alike), 3:1 for the parts of controls
// (a field's frame, the selected outline, an icon, the focus ring). Read straight from styles/clay/tokens.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/clay/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const THEMES = ['light', 'dark', 'sage', 'blue', 'plum', 'coral', 'teal', 'amber'];
const block = theme => {
  const selector = theme === 'light' ? ':root[data-clay],:root[data-clay][data-theme="light"]{' : `:root[data-clay][data-theme="${theme}"]{`;
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `${theme} has its own clay palette`);
  const body = css.slice(start + selector.length, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+)/g)].map(([, name, value]) => [name, value.trim()]));
};
const rgb = hex => { const h = hex.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const channel = v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = hex => { const [r, g, b] = rgb(hex).map(channel); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Every ground a word can sit on: the page, the header and dock, a card, a control (and pressed), a field, the sunk
// (selected) ground, the reading page.
const GROUNDS = ['--clay-ground', '--clay-ground-lit', '--clay-struct-a', '--clay-struct-b', '--clay-card-a', '--clay-card-b', '--clay-control-a', '--clay-control-b', '--clay-down-a', '--clay-down-b', '--clay-well', '--clay-sunk', '--clay-reading', '--surface', '--bg', '--surface-secondary'];
const TEXT = ['--text', '--text-muted', '--accent', '--link', '--focus', '--danger'];

test('contrast: every text colour on every material of every palette ≥ 4.5:1 (WCAG AA, body and meta)', () => {
  const report = [];
  for (const theme of THEMES) {
    const t = block(theme);
    for (const ground of GROUNDS) assert.match(t[ground] || '', /^#[0-9a-f]{6}$/i, `${theme} ${ground} is a solid colour`);
    for (const ink of TEXT) {
      assert.match(t[ink] || '', /^#[0-9a-f]{6}$/i, `${theme} ${ink}`);
      const worst = Math.min(...GROUNDS.map(ground => contrast(t[ink], t[ground])));
      report.push(`${theme} ${ink} ${worst.toFixed(2)}`);
      assert.ok(worst >= 4.5, `${theme}: ${ink} ${t[ink]} reaches only ${worst.toFixed(2)}:1`);
    }
  }
  assert.equal(report.length, THEMES.length * TEXT.length);
});

test('contrast: the parts of controls ≥ 3:1 — a field\'s frame, the selected copper outline, icons, the focus ring', () => {
  for (const theme of THEMES) {
    const t = block(theme);
    for (const ground of ['--clay-ground', '--clay-card-a', '--clay-card-b', '--surface']) assert.ok(contrast(t['--control-border'], t[ground]) >= 3, `${theme} control border on ${ground}`);
    assert.ok(contrast(t['--accent'], t['--clay-sunk']) >= 3, `${theme} the selected outline on its sunk ground`);
    for (const ground of ['--clay-control-a', '--clay-control-b', '--clay-sunk']) assert.ok(contrast(t['--clay-icon-ink'], t[ground]) >= 3, `${theme} icon on ${ground}`);
    for (const ground of ['--clay-ground', '--clay-card-a', '--clay-well']) assert.ok(contrast(t['--focus'], t[ground]) >= 3, `${theme} focus ring on ${ground}`);
  }
});

test('each palette keeps its identity: its own ground and its own accent (no palette is a copy of another)', () => {
  const grounds = THEMES.map(theme => block(theme)['--clay-ground']);
  const accents = THEMES.map(theme => block(theme)['--accent']);
  assert.equal(new Set(grounds).size, THEMES.length);
  assert.equal(new Set(accents).size, THEMES.length);
});
