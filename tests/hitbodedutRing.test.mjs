// התבודדות — the session's controls behind one golden ring, and the closing screen shown at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createControlsReveal, CONTROLS_HIDE_MS } from '../src/services/hitbodedut/controlsReveal.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/HitbodedutPage.jsx');
const css = read('src/styles/hitbodedut.css');

function fakeTimers() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  return {
    setTimer: (fn, ms) => { const id = ++seq; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimer: id => { timers.delete(id); },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) if (timer.at <= now && timers.has(id)) { timers.delete(id); timer.fn(); }
    },
    get pending() { return timers.size; },
  };
}

test('the ring: hidden at first; a tap reveals, a few quiet seconds hide, a touch keeps them, the ring again hides', () => {
  const t = fakeTimers();
  const seen = [];
  const reveal = createControlsReveal({ onChange: open => seen.push(open), setTimer: t.setTimer, clearTimer: t.clearTimer });
  assert.equal(reveal.open, false, 'after the setup, no controls — only the ring');
  reveal.touch();
  assert.equal(reveal.open, false, 'a touch never reveals by itself');
  reveal.toggle();
  assert.equal(reveal.open, true);
  t.advance(CONTROLS_HIDE_MS - 100);
  reveal.touch();                                    // a press on − / + or pause
  t.advance(CONTROLS_HIDE_MS - 100);
  assert.equal(reveal.open, true, 'every touch starts the count again');
  t.advance(200);
  assert.equal(reveal.open, false, 'hidden after a few quiet seconds');
  reveal.toggle();
  reveal.toggle();
  assert.equal(reveal.open, false, 'the ring again hides at once');
  assert.equal(t.pending, 0, 'and no timer is left behind');
  assert.deepEqual(seen, [true, false, true, false]);
  assert.ok(CONTROLS_HIDE_MS >= 4000 && CONTROLS_HIDE_MS <= 8000);
});

test('the ring: held open under the end confirmation; disposed without a timer left', () => {
  const t = fakeTimers();
  const reveal = createControlsReveal({ setTimer: t.setTimer, clearTimer: t.clearTimer });
  reveal.reveal();
  reveal.hold(true);
  t.advance(CONTROLS_HIDE_MS * 3);
  assert.equal(reveal.open, true);
  reveal.hold(false);
  t.advance(CONTROLS_HIDE_MS + 1);
  assert.equal(reveal.open, false);
  reveal.reveal();
  reveal.dispose();
  assert.equal(t.pending, 0);
});

test('the page: one golden ring button "הצגת פקדים" with its expanded state; every control lives in the dock', () => {
  assert.match(page, /className="hb-reveal" onClick=\{\(\) => reveal\.toggle\(\)\} aria-label="הצגת פקדים" aria-expanded=\{revealed\} aria-controls="hb-dock"/);
  assert.match(page, /id="hb-dock" className=\{`hb-dock\$\{revealed \? ' is-open' : ''\}`\} inert=\{revealed \? undefined : ''\} aria-hidden=\{revealed \? undefined : 'true'\}/);
  // Pace, dimming, pause and end are inside the dock (between its opening and the ring bar).
  const dock = page.slice(page.indexOf('id="hb-dock"'), page.indexOf('className="hb-ring-bar"'));
  for (const piece of ['<Stepper label="קצב"', '<Stepper label="עמעום"', "aria-label={paused ? 'המשך' : 'השהיה'}", 'aria-label="סיום ההתבודדות"']) assert.ok(dock.includes(piece), piece);
  assert.doesNotMatch(page, /הקשה כפולה מאירה את הכפתורים/, 'no hint line under the ring');
  assert.match(page, /reveal\.hold\(confirm\)/, 'never hidden under the end confirmation');
  assert.match(page, /setConfirm\(true\)/, 'the end still asks first');
});

test('the ring\'s look: hollow, gold, the size of the − / + buttons, breathing; still with reduced motion', () => {
  const ring = css.match(/\.hb-reveal-ring\{[^}]*\}/)[0];
  const mini = css.match(/\.hb-strip \.hb-mini\{[^}]*\}/)[0];
  assert.equal(ring.match(/width:(\d+)px/)[1], mini.match(/width:(\d+)px/)[1], 'same size as − / +');
  assert.match(ring, /background:transparent/, 'hollow');
  assert.match(ring, /border:1\.5px solid rgba\(228,192,122/, 'gold');
  assert.match(ring, /animation:hb-ring-breathe/);
  assert.match(css, /@keyframes hb-ring-breathe\{[^}]*opacity[^}]*transform/);
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion:reduce)'));
  assert.match(reduced, /\.hb-reveal-ring,\.hb-reveal-ring::after\{animation:none;opacity:1/);
  assert.match(css, /html\[data-a11y-motion="reduce"\] \.hb-reveal-ring,/);
  // Centred at the bottom; hidden controls take no touch.
  assert.match(css, /\.hb-ring-bar\{[^}]*place-items:center/);
  assert.match(css, /\.hb-dock\{[^}]*visibility:hidden;pointer-events:none/);
  assert.match(css, /\.hb-dock\.is-open\{[^}]*visibility:visible;pointer-events:auto/);
});

test('the closing screen is there at once: no fade-in on its words; the light alone rises', () => {
  const summary = css.match(/\.hb-summary\{[^}]*\}/)[0];
  assert.doesNotMatch(summary, /animation/);
  assert.match(css, /\.hb-session\.is-summary\{[^}]*animation:hb-dawn/, 'the background lightens (no opacity)');
  assert.doesNotMatch(css.match(/@keyframes hb-dawn\{.*?\}\}/)[0], /opacity/);
  // It stays until "חזרה": no timer closes it, and nothing navigates by itself.
  const summaryFn = page.slice(page.indexOf('function Summary('), page.indexOf('// ── The explainers'));
  assert.doesNotMatch(summaryFn, /setTimeout|go\(/);
  assert.match(summaryFn, /onClick=\{onClose\}>חזרה</);
});

test('no delayed pop-up after leaving: the page\'s deferred leave check is one timer, cleared on re-mount', () => {
  assert.match(page, /clearTimeout\(HitbodedutPage\.leaving\);\n    return \(\) => \{/);
  assert.match(page, /HitbodedutPage\.leaving = setTimeout\(/);
  // The session's own timers end with it.
  assert.match(page, /useEffect\(\(\) => \(\) => reveal\.dispose\(\), \[reveal\]\)/);
  assert.match(page, /useEffect\(\(\) => \(\) => taps\.cancel\(\), \[taps\]\)/);
  assert.doesNotMatch(page, /REVEAL_MS/);
});
