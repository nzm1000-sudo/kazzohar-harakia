// The one arrow (components/ui/ArrowMark.jsx, styles/clay/arrows.css). The owner (2026-10-02): "כל החצים באפליקציה:
// עטופים במעגל עדין בצבע זהב (של הפלטה), כמו במסך שכחתי תוספת". This scan keeps it so: no screen types an arrow glyph
// or draws its own chevron outside the primitive (a small allow-list, each entry with its reason); the disc's tap
// target is at least 44×44px; its colours are the palette's own gold token, never a typed colour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const STYLES = join(SRC, 'styles');
const walk = (dir, pick) => readdirSync(dir).flatMap(name => {
  if (name.startsWith('.') || name === 'data' || name === 'node_modules') return [];
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path, pick) : pick(name) ? [path] : [];
});
// Comments may name arrows ("הגדרות › נגישות", "ask → confirm"); only the code is scanned.
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
// An ArrowMark's legacy={…} / legacy="…" is the glyph the NON-Clay build keeps for that screen: not an orphan.
function withoutLegacy(text) {
  let out = text.replace(/\blegacy="[^"]*"/g, 'legacy=""');
  for (let i = out.indexOf('legacy={'); i !== -1; i = out.indexOf('legacy={', i + 1)) {
    let depth = 0, j = i + 7;
    for (; j < out.length; j++) { if (out[j] === '{') depth++; else if (out[j] === '}' && --depth === 0) break; }
    out = `${out.slice(0, i)}legacy={0}${out.slice(j + 1)}`;
  }
  return out;
}
const jsx = walk(SRC, name => name.endsWith('.jsx')).map(path => ({ file: relative(SRC, path), raw: readFileSync(path, 'utf8') }))
  .map(entry => ({ ...entry, text: withoutLegacy(code(entry.raw)) }));
const css = walk(STYLES, name => name.endsWith('.css')).map(path => ({ file: relative(STYLES, path), text: readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));
const ARROWS_CSS = readFileSync(join(STYLES, 'clay/arrows.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const GLYPH = /[←→‹›«»⟵⟶↩↪⌄˅˄▾▸◂▴▲▼◀▶↑↓⇠⇢⬅➡❮❯]/;
// The allow-list: [file, the exact code that may keep its glyph, why].
const ALLOWED_GLYPHS = [
  ['App.jsx', /▲|▼/, 'the legacy App.jsx is not mounted (main.jsx mounts NewApp.jsx); it is never shown'],
  ['components/ui/ArrowMark.jsx', /LEGACY_GLYPH = \{[^}]*\}/, 'the primitive itself: the non-Clay build\'s glyph per direction'],
  ['components/LocalNavigation.jsx', /<b aria-hidden="true">›<\/b>/, 'a breadcrumb separator: a quiet mark between place names, not a control — a gold disc between every crumb would read as buttons and crowd the line'],
  ['pages/TravelMode.jsx', /<\/bdi> ← <bdi>/, 'the trip\'s route in its title ("מוצא ← יעד"): words, not a control'],
  ['pages/HitbodedutPage.jsx', /הגדרות ← צלילים ← „נא לא להפריע”/, 'instructions text naming a path in the phone\'s settings: words, not a control'],
  ['pages/HalachaLibrary.jsx', /ספר ← חלק ← סימן ← סעיף/, 'an explanatory sentence (the book\'s structure): words, not a control'],
  ['pages/AboutPage.jsx', /משנה ← גמרא ומשנה תורה; מקרא ← מקורות/, 'a credits sentence naming kinds of links: words, not a control'],
];

test('no orphan arrow glyph: every arrow in the app\'s screens is the ArrowMark (allow-list: each with its reason)', () => {
  const orphans = [];
  for (const { file, text } of jsx) {
    let rest = text;
    for (const [allowedFile, pattern] of ALLOWED_GLYPHS) if (allowedFile === file) rest = rest.replace(new RegExp(pattern.source, 'g'), '');
    rest.split('\n').forEach((line, index) => { if (GLYPH.test(line)) orphans.push(`${file}:${index + 1} ${line.trim().slice(0, 100)}`); });
  }
  assert.deepEqual(orphans, [], 'a typed arrow outside <ArrowMark> — draw it with the primitive (or add it to the allow-list with its reason)');
  for (const [file, pattern, reason] of ALLOWED_GLYPHS) {
    const entry = jsx.find(item => item.file === file);
    assert.ok(entry && pattern.test(entry.text), `the allow-list entry for ${file} no longer matches (${reason}) — remove it`);
    assert.ok(reason.length > 20, 'every allow-list entry says why');
  }
});

test('no hand-drawn chevron: arrow and chevron SVGs live only in the primitive (and as a non-Clay legacy glyph)', () => {
  // An <svg> named for an arrow or chevron, or the old ChevronGlyph used directly, outside ArrowMark.
  const drawn = jsx.filter(({ file }) => file !== 'components/ui/ArrowMark.jsx')
    .flatMap(({ file, text }) => [...text.matchAll(/<svg[^>]*className="[^"]*(?:chevron|arrow)[^"]*"|<ChevronGlyph\b/g)].map(m => `${file}: ${m[0].slice(0, 80)}`));
  assert.deepEqual(drawn, []);
  // ChevronGlyph stays as the non-Clay legacy of the Selector and the "נקודות של אור" cue only.
  const legacyUsers = jsx.filter(({ raw }) => /legacy=\{<ChevronGlyph/.test(raw)).map(({ file }) => file).sort();
  assert.deepEqual(legacyUsers, ['components/ui/Selector.jsx', 'pages/MitzvotJournal.jsx']);
  // Icons that merely contain chevron-like strokes are pictures, not arrows: the auto-scroll glyph (a page gliding
  // down) and the offline invite's download tray. They keep their drawing.
  assert.match(readFileSync(join(SRC, 'components/AutoScrollControl.jsx'), 'utf8'), /className="autoscroll-glyph"/);
});

test('every screen that draws <ArrowMark> imports it', () => {
  const missing = jsx.filter(({ file, raw }) => file !== 'components/ui/ArrowMark.jsx' && /<ArrowMark\b/.test(raw) && !/import ArrowMark from '[^']+ArrowMark\.jsx'|import \{[^}]*\bArrowMark\b[^}]*\} from/.test(raw)).map(({ file }) => file);
  assert.deepEqual(missing, []);
  const users = jsx.filter(({ raw }) => /<ArrowMark\b/.test(raw)).length;
  assert.ok(users >= 50, `ArrowMark is the app's arrow (${users} files)`);
});

test('no typed arrow in CSS content, and no masked chevron: the Clay build draws the ArrowMark there instead', () => {
  const typed = css.flatMap(({ file, text }) => [...text.matchAll(/([^{}]+)\{[^}]*content:\s*(["'])([^"']*)\2[^}]*\}/g)]
    .filter(m => GLYPH.test(m[3])).map(m => `${file}: ${m[1].trim().slice(-70)} → ${m[3]}`));
  // The non-Clay build keeps two typed CSS arrows (its look is unchanged); in Clay each stands down for an ArrowMark.
  const NON_CLAY_KEPT = [/^base\.css: \.daf-more summary::after → /, /^base\.css: \.daf-more\[open\] summary::after → /, /^base\.css: \.rite-section-folded>summary::after → /];
  assert.deepEqual(typed.filter(entry => !NON_CLAY_KEPT.some(rx => rx.test(entry))), []);
  assert.match(ARROWS_CSS, /:root\[data-clay\] :is\(\.daf-more summary,\.rite-section-folded>summary\)::after\{content:none\}/);
  assert.ok(!css.some(({ text }) => /--clay-i-chevron/.test(text)), 'the masked chevron of Today\'s tiles is gone');
  assert.ok(!css.filter(({ file }) => file.startsWith('clay/')).some(({ text }) => /content:\s*["'][‹›⌄˅]/.test(text)));
});

test('ArrowMark: one drawing, four directions, two sizes; decorative; the non-Clay build keeps its glyph', () => {
  const source = readFileSync(join(SRC, 'components/ui/ArrowMark.jsx'), 'utf8');
  assert.match(source, /ARROW_DIRECTIONS = Object\.freeze\(\['forward', 'back', 'up', 'down'\]\)/);
  assert.match(source, /ARROW_SIZES = Object\.freeze\(\['row', 'inline'\]\)/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /if \(!CLAY && clayOnly\) return null;/);
  assert.match(source, /if \(!CLAY\) return <Tag className=\{className \|\| undefined\} aria-hidden="true">\{legacy \?\? LEGACY_GLYPH\[direction\]\}<\/Tag>;/);
  assert.equal((source.match(/<path /g) || []).length, 1, 'one drawing for every arrow');
  // RTL: drawn pointing left (forward); back turns it half a turn; up and down a quarter; an open fold turns down → up.
  assert.match(ARROWS_CSS, /\.arrow-mark\[data-dir="back"\]>svg\{transform:rotate\((180)deg\)\}/);
  assert.match(ARROWS_CSS, /\.arrow-mark\[data-dir="up"\]>svg\{transform:rotate\((90)deg\)\}/);
  assert.match(ARROWS_CSS, /\.arrow-mark\[data-dir="down"\]>svg\{transform:rotate\((-90)deg\)\}/);
  assert.match(ARROWS_CSS, /:is\(details\[open\]>summary,\[aria-expanded="true"\]\) \.arrow-mark\[data-dir="down"\]>svg\{transform:rotate\((90)deg\)\}/);
  // the same stroke in every size: a non-scaling 1.4px stroke
  assert.match(ARROWS_CSS, /--arrow-stroke:1\.4px/);
  assert.match(ARROWS_CSS, /vector-effect:non-scaling-stroke/);
});

test('44px: every arrow\'s tap target is at least 44×44px; the disc stays small and the layout does not move', () => {
  const px = name => Number(ARROWS_CSS.match(new RegExp(`--${name}:(\\d+(?:\\.\\d+)?)px`))?.[1]);
  const hit = px('arrow-hit');
  assert.ok(hit >= 44, 'the target');
  for (const size of ['arrow-row-d', 'arrow-inline-d']) { const d = px(size); assert.ok(d >= 20 && d <= 32 && d < hit, `${size}: a small disc (${d}px)`); }
  // the target: a transparent ::after centred on the disc, (d − hit) / 2 on every side → exactly hit × hit
  assert.match(ARROWS_CSS, /\.arrow-mark\[data-dir\]\[data-size\]::after\{content:"";position:absolute;inset:calc\(\(var\(--arrow-d\) - var\(--arrow-hit\)\) \/ 2\);[^}]*pointer-events:auto\}/);
  assert.match(ARROWS_CSS, /\.arrow-mark\[data-dir\]\[data-size\]\{[^}]*position:relative;/);
  // an arrow-only button is itself a 44px target
  assert.match(ARROWS_CSS, /:is\(button,a\)\.arrow-button\{[^}]*min-width:var\(--arrow-hit\);min-height:var\(--arrow-hit\)/);
  const arrowOnly = jsx.flatMap(({ file, text }) => [...text.matchAll(/<button[^>]*>\s*<ArrowMark[^>]*\/>\s*<\/button>/g)].filter(m => !/arrow-button|scroll-top-button/.test(m[0])).map(m => `${file}: ${m[0].slice(0, 90)}`));
  assert.deepEqual(arrowOnly, [], 'a button holding only an arrow is an .arrow-button');
});

test('colour: the palette\'s own gold token — never a typed colour; high contrast and forced colours have their own', () => {
  assert.doesNotMatch(ARROWS_CSS, /#[0-9a-f]{3,8}\b|rgba?\(/i, 'no typed colour in arrows.css');
  for (const token of ['--arrow-ring', '--arrow-fill', '--arrow-ink']) assert.match(ARROWS_CSS, new RegExp(`${token}:color-mix\\(in srgb,var\\(--gold\\)`), `${token} is mixed from the palette's gold`);
  assert.match(ARROWS_CSS, /border:1px solid var\(--arrow-ring\)/);
  assert.match(ARROWS_CSS, /background:var\(--arrow-fill\)/);
  assert.match(ARROWS_CSS, /color:var\(--arrow-ink\)/);
  // every one of the eight palettes has its own --gold (light is the :root default)
  const base = readFileSync(join(STYLES, 'base.css'), 'utf8');
  assert.match(base, /:root\{--gold:/);
  for (const theme of ['dark', 'amber', 'blue', 'sage', 'plum', 'teal', 'coral']) assert.match(base, new RegExp(`\\[data-theme="${theme}"\\][^{]*\\{--gold:`), theme);
  // high contrast: full ink ring and arrow; forced colours: the system's
  assert.match(ARROWS_CSS, /:root\[data-clay\]\[data-a11y-contrast\]\{--arrow-ring:var\(--ink\);--arrow-ink:var\(--ink\);/);
  assert.match(ARROWS_CSS, /@media \(forced-colors:active\)\{:root\[data-clay\] \.arrow-mark/);
  assert.match(ARROWS_CSS, /@media \(prefers-contrast:more\)/);
  // a press sinks the disc, never fills it with the accent; it is in the Clay index, before a11y (which wins)
  assert.doesNotMatch(ARROWS_CSS, /background:var\(--(accent|selected)\)/);
  const index = readFileSync(join(STYLES, 'clay/index.css'), 'utf8');
  assert.ok(index.indexOf("@import './arrows.css';") > 0 && index.indexOf("@import './arrows.css';") < index.indexOf("@import './a11y.css';"));
  // the whole look is Clay-only: every arrows.css rule is scoped under :root[data-clay]
  const selectors = [...ARROWS_CSS.replace(/@media[^{]+\{/g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)].map(m => m[1].trim()).filter(Boolean);
  const topLevel = sel => { const parts = []; let depth = 0, from = 0; [...sel].forEach((ch, i) => { if (ch === '(') depth++; else if (ch === ')') depth--; else if (ch === ',' && !depth) { parts.push(sel.slice(from, i)); from = i + 1; } }); return [...parts, sel.slice(from)]; };
  assert.deepEqual(selectors.filter(sel => !topLevel(sel).every(part => part.trim().startsWith(':root[data-clay]'))), []);
});
