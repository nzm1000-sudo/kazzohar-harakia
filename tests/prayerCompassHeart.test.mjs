// The prayer compass: on the prayer direction the heart grows to 2.5× and beats once a second (transform only);
// with reduced motion it stays enlarged, without beating; off the direction it is back to its size.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('src/styles/base.css');
const page = read('src/pages/PrayerCompass.jsx');

test('aligned: the heart at 2.5×, one heartbeat a second, transform only', () => {
  assert.match(page, /className=\{`prayer-compass-page compass-zone-\$\{zone\}`\}/, 'the zone class drives it');
  assert.match(page, /const zone = alignment === 'aligned' \? 'aligned' : alignmentZone\(error\)/);
  const svg = css.match(/\.compass-zone-aligned \.prayer-target-marker svg\{[^}]*\}/)[0];
  assert.match(svg, /transform:scale\(2\.5\)/, 'a steady 2.5× underneath (what reduced motion keeps)');
  assert.match(svg, /heart-beat 1s ease-in-out infinite/, 'one beat a second');
  const beat = css.match(/@keyframes heart-beat\{.*?\}\}/)[0];
  assert.doesNotMatch(beat, /(width|height|top|left|margin|filter|opacity)\s*:/, 'transform only');
  const scales = [...beat.matchAll(/scale\(([\d.]+)\)/g)].map(m => Number(m[1]));
  assert.equal(Math.max(...scales), 2.5, 'the beat peaks at 2.5×');
  assert.ok(Math.min(...scales) >= 2, 'and relaxes only a little — it stays enlarged');
  // Off the direction: the base heart has no scale, and the change is a smooth transition.
  const base = css.match(/\.prayer-target-marker svg\{[^}]*\}/)[0];
  assert.doesNotMatch(base, /transform:scale/);
  assert.match(base, /transition:[^;]*transform/);
});

test('reduced motion: steady at 2.5×, no beat', () => {
  const media = css.match(/@media \(prefers-reduced-motion:reduce\)\{\.compass-zone-aligned \.prayer-target-marker svg,[^}]*\}/)[0];
  assert.match(media, /animation:none/);
  assert.match(css, /html\[data-a11y-motion="reduce"\] \.compass-zone-aligned \.prayer-target-marker svg,/);
  // The 2.5× itself is outside the media query, so it holds with reduced motion too.
  assert.doesNotMatch(media, /scale/);
});

test('the haptic on reaching the direction stays as it was', () => {
  assert.match(page, /if \(canAlign\) nativeBridge\(\)\?\.send\(\{ action: 'haptic' \}\)/);
});
