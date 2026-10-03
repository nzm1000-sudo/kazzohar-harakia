// The home-screen widgets wear the app's CLAY (docs/design-system.md › CLAY): the same eight palettes as tokens.css on
// iOS (the palette the user chose, carried in the snapshot), בהיר / כהה on Android; the chosen state sunk with a thin
// copper outline, never a filled colour; the current one outlined only; the saying flat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { widgetPalette, WIDGET_PALETTES } from '../src/services/nativeWidgets.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const tokens = read('../src/styles/clay/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
const THEMES = ['light', 'dark', 'sage', 'blue', 'plum', 'coral', 'teal', 'amber'];
const palette = theme => {
  const selector = theme === 'light' ? ':root[data-clay],:root[data-clay][data-theme="light"],' : `:root[data-clay][data-theme="${theme}"]{`;
  const at = tokens.indexOf(selector);
  const body = tokens.slice(at + selector.length, tokens.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+)/g)].map(([, name, value]) => [name, value.trim().toLowerCase()]));
};
const swift = read('../ios/App/KZWidgets/KZWidgets.swift');
const more = read('../ios/App/KZWidgets/KZMoreWidgets.swift');
const hex = value => `#${value.toLowerCase().padStart(6, '0')}`;

test('the app writes its palette into the snapshot: one of the eight, or nothing', () => {
  assert.deepEqual([...WIDGET_PALETTES].sort(), [...THEMES].sort());
  assert.equal(widgetPalette({ dataset: { theme: 'sage' } }, null), 'sage');
  assert.equal(widgetPalette({ dataset: {} }, { getItem: () => 'amber' }), 'amber');
  assert.equal(widgetPalette({ dataset: { theme: 'neon' } }, null), null);
  assert.equal(widgetPalette(null, { getItem: () => { throw new Error('blocked'); } }), null);
  const bridge = read('../src/services/nativeWidgets.mjs');
  assert.match(bridge, /JSON\.stringify\(\{ \.\.\.snapshot, palette: widgetPalette\(\) \}\)/);
  assert.match(bridge, /attributeFilter: \['data-theme'\]/, 'a new palette republishes');
  assert.match(read('../ios/App/Shared/KZWidgetSnapshot.swift'), /let palette: String\?/);
});

test('iOS: every palette is the app\'s own clay — card, well, sunk, control, ink, muted, copper from tokens.css', () => {
  for (const theme of THEMES) {
    const t = palette(theme);
    const night = theme === 'dark' || theme === 'amber';
    const block = new RegExp(`case "${theme}":\\s*return (day|night)\\(([^\\n]+)\\)`).exec(swift)
      || (theme === 'light' ? /default: \/\/ בהיר[^\n]*\n\s*return (day)\(([^\n]+)\)/.exec(swift) : null);
    assert.ok(block, theme);
    assert.equal(block[1], night ? 'night' : 'day', `${theme} is a ${night ? 'dark' : 'light'} palette`);
    const values = [...block[2].matchAll(/0x([0-9A-F]{6})/g)].map(m => hex(m[1]));
    const [cardA, cardB, well, sunk, controlA, controlB, ink, muted, copper] = values;
    assert.deepEqual(
      { cardA, cardB, well, sunk, controlA, controlB, ink, muted, copper },
      { cardA: t['--clay-card-a'], cardB: t['--clay-card-b'], well: t['--clay-well'], sunk: t['--clay-sunk'], controlA: t['--clay-control-a'], controlB: t['--clay-control-b'], ink: t['--text'], muted: t['--text-muted'], copper: t['--clay-copper'] },
      theme,
    );
  }
  // By day a light palette, by night כהה or זהב לילי — otherwise the system's own light / dark clay.
  assert.match(swift, /static let lightIDs: Set<String> = \["light", "sage", "blue", "plum", "coral", "teal"\]/);
  assert.match(swift, /static let darkIDs: Set<String> = \["dark", "amber"\]/);
  for (const view of ['KZWidgetView', 'KZCard']) assert.match(swift + more, new RegExp(`KZPalette\\.of\\(scheme, (entry\\.snapshot\\?\\.palette|paletteID)\\)`), view);
});

test('Android: בהיר and כהה clay colours are the app\'s tokens', () => {
  const colours = path => Object.fromEntries([...read(path).matchAll(/<color name="(kz_widget_\w+)">#([0-9A-Fa-f]{6,8})<\/color>/g)].map(([, name, value]) => [name, `#${value.slice(-6).toLowerCase()}`]));
  for (const [path, theme] of [['../android/app/src/main/res/values/kz_widget.xml', 'light'], ['../android/app/src/main/res/values-night/kz_widget.xml', 'dark']]) {
    const c = colours(path);
    const t = palette(theme);
    assert.deepEqual(
      [c.kz_widget_top, c.kz_widget_bottom, c.kz_widget_well, c.kz_widget_sunk, c.kz_widget_control_a, c.kz_widget_control_b, c.kz_widget_ink, c.kz_widget_muted, c.kz_widget_copper],
      [t['--clay-card-a'], t['--clay-card-b'], t['--clay-well'], t['--clay-sunk'], t['--clay-control-a'], t['--clay-control-b'], t['--text'], t['--text-muted'], t['--clay-copper']],
      theme,
    );
  }
  assert.match(read('../android/app/src/main/res/values-v31/kz_widget_dimens.xml'), /system_app_widget_background_radius/, 'the system widget radius');
});

test('the chosen is sunk with a thin copper outline, never filled; the current is outlined only; the saying is flat', () => {
  // iOS
  assert.match(swift, /func kzSelected[\s\S]*?\.fill\(palette\.sunk[\s\S]*?strokeBorder\(palette\.copper\.opacity\(0\.9\), lineWidth: 1\)/);
  assert.match(swift, /func kzCurrent[\s\S]*?overlay\(RoundedRectangle[^\n]*\.strokeBorder\(palette\.copper/);
  assert.doesNotMatch(swift.slice(swift.indexOf('func kzCurrent'), swift.indexOf('// MARK: - Timeline')), /\.fill\(|background\(/, 'current: no fill');
  assert.match(more, /if now \{ content\.kzSelected\(palette\) \} else \{ content\.kzRaised\(palette\) \}/);
  assert.doesNotMatch(more, /gold\.opacity\(door\.now|\.fill\(palette\.gold/, 'no gold-filled door or button');
  const saying = more.slice(more.indexOf('struct KZSayingView'), more.indexOf('struct KZSayingsWidget'));
  assert.doesNotMatch(saying, /kzWell|kzRaised|shadow/, 'the saying is read flat');
  // Android
  const res = name => read(`../android/app/src/main/res/drawable/${name}`);
  assert.match(res('kz_widget_tile_now.xml'), /<solid android:color="@color\/kz_widget_sunk" \/>[\s\S]*<solid android:color="@color\/kz_widget_clear" \/>\s*<stroke android:width="1dp" android:color="@color\/kz_widget_outline" \/>/);
  assert.match(res('kz_widget_pill.xml'), /<solid android:color="@color\/kz_widget_clear" \/>\s*<stroke android:width="1dp"/);
  for (const name of ['kz_widget_tile_now.xml', 'kz_widget_pill.xml', 'kz_widget_button.xml']) assert.doesNotMatch(res(name), /kz_widget_(gold|copper)"/, name);
});

test('quiet type: no bold in the widgets (500 / 400), every header centred', () => {
  assert.doesNotMatch(swift + more, /weight: \.(bold|semibold|heavy)/);
  for (const name of ['small', 'medium', 'meat', 'omer', 'prayer', 'quartet', 'sayings', 'zmanim']) {
    assert.doesNotMatch(read(`../android/app/src/main/res/layout/kz_widget_${name}.xml`), /textStyle="bold"/, name);
  }
  // the lock-screen accessories too: centred, no leading-aligned block
  assert.doesNotMatch(swift + more, /\.frame\(maxWidth: \.infinity, alignment: \.leading\)/);
});
