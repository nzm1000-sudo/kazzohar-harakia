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

test('the letters\' timings are fixed per letter, long (14–22 s) and desynchronised', () => {
  const source = about.match(/function seeded\(seed\) \{[\s\S]+?\n\}\nexport function shimmerLetters[\s\S]+?\n\}/)[0].replace('export ', '');
  const shimmerLetters = new Function(`${source}; return shimmerLetters;`)();
  const letters = shimmerLetters('״כזוהר הרקיע״').filter(l => l.cycle);
  assert.equal(letters.length, 12);
  assert.equal(shimmerLetters('״כזוהר הרקיע״').map(l => l.char).join(''), '״כזוהר הרקיע״', 'every letter kept, in order');
  const durations = letters.map(l => parseFloat(l.duration));
  durations.forEach(d => assert.ok(d >= 14 && d <= 22, String(d)));
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
  const thanks = about.match(/<AboutSection title="תודות" className="about-thanks">([\s\S]+?)<\/AboutSection>/)[1];
  for (const name of ['הרב שלום יוסף ברבי שליט״א', '״שלום רב״', 'הרב ישראל שריקי', '״עונג שבת״', 'באישורו', 'ילקוט יוסף', 'ספריא', 'ויקיטקסט העברי', 'בירנבוים', 'Tanach.us', 'Open Siddur Project', 'תורת אמת', 'לספרייה הלאומית', 'Hebcal', 'Open-Meteo', 'OpenStreetMap', 'Open Food Facts', 'Wikidata']) {
    assert.ok(thanks.includes(name), name);
  }
});

test('the tones move perceptibly by colour harmony: accent, analogous hues either side, its lit tint and gold', () => {
  const letter = css.match(/\.about-title-letter\{([^}]+)\}/)[1];
  for (const token of ['--t-warm', '--t-bright', '--t-gold', '--t-ink', '--t-glow']) assert.ok(letter.includes(token), token);
  assert.match(css, /@supports \(color:oklch\(from red l c h\)\)\{\.about-title-letter\{--t-warm:oklch\(from var\(--accent\) l calc\(c \* 1\.12\) calc\(h \+ 30\)\);--t-ink:oklch\(from var\(--accent\) calc\(l - \.05\) c calc\(h - 30\)\)/, 'analogous ±30° where supported, colour-mix otherwise');
  for (const n of [1, 2, 3]) {
    const frames = css.match(new RegExp(`@keyframes about-tone-${n}\\{(.+?)\\}\\}`))[1];
    for (const tone of ['--t-accent', '--t-warm', '--t-gold', '--t-bright', '--t-ink']) assert.ok(frames.includes(`var(${tone})`), `tone-${n} passes through ${tone}`);
  }
});

test('a soft bluish halo breathes behind the name, takes no room, and rests for reduced motion', () => {
  assert.match(css, /\.about-page h1\.about-title\{position:relative;isolation:isolate\}/);
  const halo = css.match(/\.about-title::before\{([^}]+)\}/)[1];
  for (const part of ['position:absolute', 'z-index:-1', 'border-radius:50%', 'radial-gradient(closest-side', 'filter:blur(', 'pointer-events:none', 'animation:about-halo 11s ease-in-out infinite alternate', 'var(--accent)']) assert.ok(halo.includes(part), part);
  assert.match(css, /\[data-theme="dark"\] \.about-title::before,\[data-theme="amber"\] \.about-title::before\{--halo:/, 'a lighter blue on the dark themes');
  assert.match(css, /@keyframes about-halo\{0%\{opacity:calc\(var\(--halo-o\) \* \.5\);transform:translate\(-50%,-50%\) scale\(\.9,\.84\)\}100%\{opacity:calc\(var\(--halo-o\) \* \.95\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.about-title::before\{animation:none\}\}/);
});

test('every section below the header opens on a tap, closed at first; the header stays open', () => {
  const titles = [...about.matchAll(/<AboutSection title="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(titles, ['על המיזם', 'מקורות', 'תלמוד', 'דברי תורה', 'חק לישראל', 'מהדורות ורישיונות', 'שלום רב', 'נר ה׳ נשמת אדם — מקורות', 'תודות', 'פרטיות ואחסון', 'יצירת קשר']);
  const sections = about.slice(about.indexOf('<div className="about-sections">'), about.indexOf('function AboutSection'));
  assert.doesNotMatch(sections, /<section><h2>|<section className="[^"]*"><h2>/, 'no section left always open');
  assert.match(about, /const \[open, setOpen\] = useState\(false\);/, 'closed by default');
  assert.match(about, /<h2 className="about-fold-title"><button type="button" aria-expanded=\{open\} aria-controls=\{id\} onClick=\{\(\) => setOpen\(value => !value\)\}>/, 'a heading holding a disclosure button');
  assert.match(about, /<div className="about-fold-body" id=\{id\} hidden=\{!open\}>\{children\}<\/div>/);
  // The header block is outside the folds.
  const header = about.slice(about.indexOf('<div className="about-hero">'), about.indexOf('<div className="about-sections">'));
  for (const part of ['<ShimmerTitle', 'about-intro', '<NitzotzaMark />', 'גרסה {APP_VERSION}']) assert.ok(header.includes(part), part);
  assert.match(css, /\.about-fold-title>button\{display:grid;grid-template-columns:22px minmax\(0,1fr\) 22px;/, 'the title centred between equal columns');
  assert.match(css, /\.about-fold-title>button\[aria-expanded="true"\]>\.siddur-chevron\{transform:rotate\(90deg\)\}/, 'the Siddur\'s chevron');
});
