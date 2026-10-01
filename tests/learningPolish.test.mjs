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

test('About: a living gold frame on the slide and a gold spark on the rings — slow, and still for reduced motion', () => {
  assert.match(css, /\.about-brand\{position:relative;padding:3px;background:conic-gradient\(from var\(--brand-angle\)/);
  assert.match(css, /animation:brand-turn 16s linear infinite,brand-breathe 7s ease-in-out infinite/);
  const about = read('../src/pages/AboutPage.jsx');
  // One small gold spark on the outer ring with a short fading trail — no rotating dash.
  assert.match(about, /<g className="nitzotza-orbit">/);
  assert.equal((about.match(/className="nitzotza-spark-trail/g) || []).length, 3);
  assert.match(about, /<circle cx="100" cy="0" r="2\.3" fill="url\(#nitzotza-spark-core\)"/);
  assert.doesNotMatch(about, /nitzotza-glint/);
  assert.match(about, /\{!prefersReducedMotion\(\) && <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="26s" repeatCount="indefinite" \/>\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.about-brand,\.about-brand::after,\.nitzotza-spark-halo,\.nitzotza-spark-trail\{animation:none\}\}/);
});

test('the memorial: a still gold frame, the portrait and title stay in view, at full size, while the words scroll beneath', () => {
  const tribute = read('../src/components/MemorialTribute.jsx');
  // The portrait and title keep their full size while pinned: nothing shrinks as the words scroll beneath.
  // The close sits on the still frame, outside the scrolling words (never inside the sticky header: iOS hit-testing).
  assert.match(tribute, /<CloseButton buttonRef=\{closeRef\} className="memorial-close" variant="framed" label="סגירת ההקדשה" onClick=\{\(\) => setOpen\(false\)\} \/>\s*\{\/\*[^*]*\*\/\}\s*<div className="memorial-scroll">\s*<header className="memorial-header">/);
  assert.match(tribute, /createPortal\(/, 'the sheet lives on <body>');
  assert.doesNotMatch(tribute, /compact/);
  assert.doesNotMatch(css, /memorial-header\.is-compact/);
  assert.match(css, /\.memorial-header\{position:sticky;top:0;z-index:2;/);
  assert.match(css, /\.memorial-dialog::after\{content:'';position:absolute;inset:6px;/);
});

test('ע״א / ע״ב read smaller and lighter than the daf number', () => {
  assert.match(css, /\.daf-cell span\{min-width:26px;font-family:var\(--font-reading\);font-size:18px;font-weight:700;/);
  assert.match(css, /\.daf-cell button\{[^}]*font-family:var\(--font-primary\);font-size:14px;font-weight:500;/);
});

test('About: a very faint sky of light inside the logo slide, behind the emblem', () => {
  const about = read('../src/pages/AboutPage.jsx');
  assert.match(about, /<span className="about-sky" aria-hidden="true" style=\{\{ backgroundImage: `url\(\$\{BASE\}branding\/about-heaven\.jpg\)` \}\} \/>/, 'set on the element, so the address resolves from the page');
  assert.doesNotMatch(about, /--about-sky/);
  assert.match(css, /\.about-sky\{[^}]*opacity:\.14;mix-blend-mode:multiply;/);
  assert.match(css, /\.memorial-header\{position:sticky;top:0;z-index:2;[^}]*background:var\(--surface\)\}/, 'a solid header: no words showing through beside the title');
  assert.ok(readFileSync(new URL('../public/branding/about-heaven.jpg', import.meta.url)).length < 300000, 'kept light');
});

test('the memorial portrait is a white cameo in every palette, never inverted', () => {
  assert.match(css, /\.memorial-portrait,\.memorial-portrait img\{background:#fff\}/);
  assert.match(css, /\.memorial-portrait img\{opacity:1;filter:none\}/);
  assert.doesNotMatch(css, /\.memorial-portrait img\{filter:invert/);
  assert.doesNotMatch(css, /\[data-theme="[a-z]+"\] \.memorial-portrait img/);
});

test('the siddur crowns the prayer of this hour with the living gold frame; it moves on as the day turns', async () => {
  const books = read('../src/pages/BooksPage.jsx');
  assert.match(books, /const nowPrayer = choosePrayerType\(now \|\| new Date\(\), times\);/);
  assert.match(books, /className=\{isNow \? 'is-now' : undefined\} aria-current=\{isNow \? 'time' : undefined\}/);
  assert.match(css, /\.day-service-buttons button\.is-now\{[^}]*conic-gradient\(from var\(--brand-angle\)[^}]*animation:brand-turn 16s linear infinite,now-breathe 7s ease-in-out infinite\}/);
  const { choosePrayerType } = await import('../src/services/smartPrayer.mjs');
  const times = { alotHaShachar: '2026-09-28T05:20:00+03:00', chatzot: '2026-09-28T12:32:00+03:00', sunset: '2026-09-28T18:31:00+03:00' };
  assert.deepEqual(['03:00', '08:00', '14:00', '19:30'].map(h => choosePrayerType(new Date(`2026-09-28T${h}:00+03:00`), times)), ['maariv', 'shacharit', 'mincha', 'maariv']);
});

test('the compass book: "כזוהר" on the right page, "הרקיע" on the left, a faint sky across the spread', () => {
  const compass = read('../src/pages/PrayerCompass.jsx');
  assert.match(compass, /\{\['כזוהר', 'הרקיע'\]\.map\(\(word, index\) => <i key=\{word\} className=\{index \? 'page-left' : 'page-right'\}>/);
  assert.match(compass, /branding\/about-heaven\.jpg/);
  assert.match(css, /\.siddur-icon \.page-sky\{[^}]*background-size:200% 100%;[^}]*opacity:\.13;/);
  assert.match(css, /\.siddur-icon \.page-right \.page-sky\{background-position:right center\}/);
});
