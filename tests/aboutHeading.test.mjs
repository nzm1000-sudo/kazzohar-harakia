// אודות ומקורות, the owner's second review: the logo slide back at full size with its emblem and lettering a quarter
// larger; the name under it, centred, a fifth smaller, each letter quietly drifting among the theme's tones; and the
// thanks naming everyone the app actually draws on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const about = read('../src/pages/AboutPage.jsx');
const css = read('../src/styles/base.css');

test('the slide is back at full size, showing the enlarged logo; the original file is kept', () => {
  assert.match(about, /<img src=\{`\$\{BASE\}branding\/kazzohar-logo-large\.jpg`\} alt="כזוהר הרקיע — בנשיאות הרב שלום יוסף ברבי" \/>/);
  for (const file of ['kazzohar-logo-original.jpg', 'kazzohar-logo-large.jpg']) assert.ok(statSync(new URL(`../public/branding/${file}`, import.meta.url)).size > 50000, file);
  // The 80% card of the first review is overridden by a later rule that restores the full card.
  const earlier = css.indexOf('.about-hero .about-brand{width:80%;max-width:416px;margin-inline:auto}');
  const restore = css.indexOf('.about-hero .about-brand{width:auto;max-width:520px}');
  assert.ok(restore > earlier, 'the full-size rule comes last');
});

test('the name: a centred heading read whole by screen readers, one hidden span per letter', () => {
  assert.match(about, /<header className="about-heading">\s*<p className="eyebrow">אודות ומקורות<\/p>\s*<ShimmerTitle text=\{ABOUT_TITLE\} \/>/);
  assert.match(about, /<h1 className="about-title" aria-label=\{text\}>/);
  assert.match(about, /aria-hidden="true" className=\{`about-title-letter tone-\$\{letter\.cycle\}`\}/);
  assert.match(about, /export const ABOUT_TITLE = '״כזוהר הרקיע״';/);
});

test('the letters\' timings are fixed per letter, long (9–17 s) and desynchronised', () => {
  const source = about.match(/function seeded\(seed\) \{[\s\S]+?\n\}\nexport function shimmerLetters[\s\S]+?\n\}/)[0].replace('export ', '');
  const shimmerLetters = new Function(`${source}; return shimmerLetters;`)();
  const letters = shimmerLetters('״כזוהר הרקיע״').filter(l => l.cycle);
  assert.equal(letters.length, 12);
  assert.equal(shimmerLetters('״כזוהר הרקיע״').map(l => l.char).join(''), '״כזוהר הרקיע״', 'every letter kept, in order');
  const durations = letters.map(l => parseFloat(l.duration));
  durations.forEach(d => assert.ok(d >= 9 && d <= 17, String(d)));
  assert.equal(new Set(letters.map(l => `${l.duration}|${l.delay}`)).size, letters.length, 'each letter on its own clock');
  letters.slice(1).forEach((l, i) => assert.notEqual(l.duration, letters[i].duration, 'neighbours never in step'));
  letters.forEach(l => assert.ok(-parseFloat(l.delay) <= parseFloat(l.duration)));
  assert.deepEqual(shimmerLetters('״כזוהר הרקיע״'), shimmerLetters('״כזוהר הרקיע״'), 'the same on every visit');
});

test('the heading is a fifth smaller, its tones come from the theme, and it stands still for reduced motion', () => {
  assert.match(css, /\.about-page h1\{font-size:clamp\(32px,5vw,48px\)\}/);
  assert.match(css, /\.about-page h1\.about-title\{font-size:clamp\(25\.6px,4vw,38\.4px\);/);
  assert.match(css, /\.about-heading\{display:grid;justify-items:center;text-align:center\}/);
  const letter = css.match(/\.about-title-letter\{([^}]+)\}/)[1];
  for (const token of ['var(--accent)', 'var(--gold)', 'var(--ink)']) assert.ok(letter.includes(token), token);
  assert.doesNotMatch(letter, /#[0-9a-f]{3,6}/i, 'no fixed colours: every theme gets its own');
  for (const n of [1, 2, 3]) assert.match(css, new RegExp(`@keyframes about-tone-${n}\\{`));
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.about-title-letter\{animation:none;color:var\(--accent\);text-shadow:none\}\}/);
});

test('the thanks name the books and the open sources the app actually uses', () => {
  const thanks = about.match(/<section className="about-thanks"><h2>תודות<\/h2>([\s\S]+?)<\/section>/)[1];
  for (const name of ['הרב שלום יוסף ברבי שליט״א', '״שלום רב״', 'הרב ישראל שריקי', '״עונג שבת״', 'באישורו', 'ילקוט יוסף', 'ספריא', 'ויקיטקסט העברי', 'בירנבוים', 'Tanach.us', 'Open Siddur Project', 'תורת אמת', 'לספרייה הלאומית', 'Hebcal', 'Open-Meteo', 'OpenStreetMap', 'Open Food Facts', 'Wikidata']) {
    assert.ok(thanks.includes(name), name);
  }
});
