// התבודדות, round four: the Tehillim wheel moves on by itself (verse by verse, at the chosen speed, with or without
// reduced motion, held only by a tap), and the dimming − / + changes what is seen at every press (native brightness and
// the software layer together), remembered for next time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWheelAdvancer, itemDurationMs, wheelItems, WHEEL_SPEEDS, WHEEL_SPEED_NAMES, RESUME_MIN_MS } from '../src/services/hitbodedut/tehillimFlow.mjs';
import { DIM_STEP_COUNT, DIM_STEP_NAMES, DEFAULT_DIM_STEP, NATIVE_DIM_LEVELS, OVERLAY_LEVELS, clampDimStep, nativeDimLevel, overlayOpacity, startDimStep } from '../src/services/hitbodedut/dimSteps.mjs';
import { createBrightnessGuard } from '../src/services/hitbodedut/brightness.mjs';
import { createHitbodedutController, sessionOptions, TEHILLIM_DIM_LEVEL } from '../src/services/hitbodedut/session.mjs';
import { loadPrefs, normalizePrefs, savePrefs } from '../src/services/hitbodedut/prefs.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const memoryStorage = () => { const map = new Map(); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), map }; };

// Fake timers: a clock that only moves when the test says so.
function fakeTimers() {
  let time = 0;
  let nextId = 1;
  const pending = new Map();
  return {
    now: () => time,
    setTimer: (fn, ms) => { const id = nextId++; pending.set(id, { fn, at: time + Math.max(0, ms) }); return id; },
    clearTimer: id => { pending.delete(id); },
    advance(ms) {
      const end = time + ms;
      for (;;) {
        let due = null;
        for (const [id, timer] of pending) if (timer.at <= end && (!due || timer.at < due[1].at)) due = [id, timer];
        if (!due) break;
        pending.delete(due[0]);
        time = due[1].at;
        due[1].fn();
      }
      time = end;
    },
    get count() { return pending.size; },
  };
}

const VERSES = ['מִזְמוֹר לְדָוִד יְהוָה רֹעִי לֹא אֶחְסָר', 'בִּנְאוֹת דֶּשֶׁא יַרְבִּיצֵנִי עַל מֵי מְנֻחוֹת יְנַהֲלֵנִי', 'נַפְשִׁי יְשׁוֹבֵב יַנְחֵנִי בְמַעְגְּלֵי צֶדֶק לְמַעַן שְׁמוֹ', 'גַּם כִּי אֵלֵךְ בְּגֵיא צַלְמָוֶת לֹא אִירָא רָע כִּי אַתָּה עִמָּדִי'];

// The wheel as the page drives it: a position, items, a speed — read by the clock through getters.
function wheel({ speed = 2, timers = fakeTimers() } = {}) {
  const state = { pos: 1, speed, items: Array.from({ length: 30 }, (_, i) => wheelItems(23 + i, VERSES)).flat() };
  const clock = createWheelAdvancer({
    durationOf: () => itemDurationMs(state.items[state.pos], state.speed),
    onAdvance: () => { state.pos = Math.min(state.items.length - 1, state.pos + 1); },
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, now: timers.now,
  });
  return { state, clock, timers };
}

test('root cause: a timer restarted on every one-second re-render never fires; the wheel clock is not restarted by renders', () => {
  // The old wheel: useEffect(setTimeout(go, duration), [..., go]) with `go` new on every render (the page re-renders
  // every second for the clock) — the timer is cleared and set again each second, and a verse needs 4–9 s.
  const t = fakeTimers();
  const duration = itemDurationMs({ type: 'verse', text: VERSES[0] }, 2);
  assert.ok(duration > 1000);
  let moved = 0;
  let id = null;
  const render = () => { if (id != null) t.clearTimer(id); id = t.setTimer(() => { moved += 1; }, duration); };
  render();
  for (let second = 0; second < 60; second += 1) { t.advance(1000); render(); }
  assert.equal(moved, 0, 'a minute of re-renders, not one verse');
  // The wheel clock: renders do not touch it; it moves on by itself.
  const w = wheel({ timers: fakeTimers() });
  w.clock.setRunning(true);
  for (let second = 0; second < 60; second += 1) w.timers.advance(1000);
  assert.ok(w.state.pos >= 1 + 5, `a minute later the wheel stands at item ${w.state.pos}`);
});

test('auto-advance: verse by verse, each after its own time, without any touch', () => {
  const w = wheel();
  w.clock.setRunning(true);
  assert.equal(w.state.pos, 1);
  const first = itemDurationMs(w.state.items[1], 2);
  w.timers.advance(first - 1);
  assert.equal(w.state.pos, 1, 'not before its time');
  w.timers.advance(1);
  assert.equal(w.state.pos, 2, 'the next verse, by itself');
  const second = itemDurationMs(w.state.items[2], 2);
  w.timers.advance(second);
  assert.equal(w.state.pos, 3);
  // Through the end of a chapter and the next chapter's title, still by itself.
  w.timers.advance(60000);
  assert.ok(w.state.pos > VERSES.length + 1, 'into the next chapter');
  assert.equal(w.clock.scheduled, true, 'always the next move waiting');
});

test('the same with reduced motion: the pace never depends on the animation', () => {
  // The clock has no motion input at all; the page builds and runs it the same way in both modes.
  const page = read('src/pages/HitbodedutPage.jsx');
  const wheelSource = page.slice(page.indexOf('function TehillimWheel('), page.indexOf('const WheelItem'));
  const runningLine = wheelSource.match(/const running = [^;]+;/)[0];
  assert.doesNotMatch(runningLine, /reduced/, 'reduced motion does not stop the wheel');
  assert.match(wheelSource, /createWheelAdvancer\(\{/);
  assert.doesNotMatch(wheelSource.slice(wheelSource.indexOf('createWheelAdvancer'), wheelSource.indexOf('// A single tap')), /reduced/);
  assert.doesNotMatch(wheelSource, /\[running, pos, speed, items, go\]/, 'no timer restarted by every render');
  // Reduced motion on: the centre alone changes (no turning) — and it does change, by itself.
  const w = wheel({ speed: 4 });
  w.clock.setRunning(true);             // the page's `running` with prefersReducedMotion() true: unchanged
  const seen = [];
  for (let i = 0; i < 6; i += 1) { w.timers.advance(itemDurationMs(w.state.items[w.state.pos], 4)); seen.push(w.state.pos); }
  assert.deepEqual(seen, [2, 3, 4, 5, 6, 7]);
  assert.match(read('src/styles/hitbodedut.css'), /\.hb-wheel-item\.is-still\{[^}]*animation:hb-in/, 'a plain fade for each new verse');
});

test('speeds: five, named, slower and faster really change the pace (and a change applies to the verse in the centre)', () => {
  assert.equal(WHEEL_SPEEDS.length, 5);
  assert.equal(WHEEL_SPEED_NAMES.length, 5);
  assert.deepEqual(WHEEL_SPEED_NAMES, ['לאט מאוד', 'לאט', 'רגיל', 'מהר', 'מהר מאוד']);
  const count = speed => { const w = wheel({ speed }); w.clock.setRunning(true); w.timers.advance(60000); return w.state.pos; };
  const counts = [0, 1, 2, 3, 4].map(count);
  for (let i = 1; i < counts.length; i += 1) assert.ok(counts[i] > counts[i - 1], `speed ${i} moves more than ${i - 1}: ${counts}`);
  // Speeding up in the middle of a long verse: it moves on sooner than it would have.
  const w = wheel({ speed: 0 });
  w.clock.setRunning(true);
  w.timers.advance(3000);
  w.state.speed = 4;
  w.clock.retime();
  w.timers.advance(Math.max(0, itemDurationMs(w.state.items[1], 4) - 3000) + 1);
  assert.equal(w.state.pos, 2);
});

test('hold only by an explicit tap; let go and it goes on (the verse kept, at least a moment more); pause the same', () => {
  const w = wheel();
  w.clock.setRunning(true);
  const d = itemDurationMs(w.state.items[1], 2);
  w.timers.advance(d - 500);
  w.clock.setRunning(false);                       // the tap: held
  w.timers.advance(120000);
  assert.equal(w.state.pos, 1, 'held stays held');
  assert.equal(w.timers.count, 0);
  w.clock.setRunning(true);                        // "המשך"
  w.timers.advance(RESUME_MIN_MS - 1);
  assert.equal(w.state.pos, 1, 'not snatched away at once');
  w.timers.advance(1);
  assert.equal(w.state.pos, 2);
  // A swipe moves by hand and the wheel goes on from there (no hold).
  w.state.pos = 4;
  w.clock.moved();
  w.timers.advance(itemDurationMs(w.state.items[4], 2));
  assert.equal(w.state.pos, 5);
  w.clock.dispose();
  w.timers.advance(60000);
  assert.equal(w.state.pos, 5, 'nothing after the session');
  // An exception in a move never stops the wheel.
  const t = fakeTimers();
  let calls = 0;
  const clock = createWheelAdvancer({ durationOf: () => 1000, onAdvance: () => { calls += 1; if (calls === 1) throw new Error('x'); }, setTimer: t.setTimer, clearTimer: t.clearTimer, now: t.now });
  clock.setRunning(true);
  t.advance(3000);
  assert.equal(calls, 3);
});

test('the page: speed and dimming as small − / + groups, always visible; a tap holds, "המשך" lets go; swipe does not hold', () => {
  const page = read('src/pages/HitbodedutPage.jsx');
  assert.match(page, /<Stepper label="קצב"/);
  assert.match(page, /<Stepper label="עמעום"/);
  assert.match(page, /tapRef\.current = \(\) => setHeld\(value => !value\)/);
  assert.doesNotMatch(page, /go\(dy < 0 \? 1 : -1\); setHeld\(true\)/);
  assert.match(page, /tehillimSpeed: next/, 'the speed is remembered');
  const css = read('src/styles/hitbodedut.css');
  const strip = css.match(/\.hb-strip\{[^}]*\}/)[0];
  assert.match(strip, /opacity:\.7/, 'visible at rest');
  assert.doesNotMatch(strip, /pointer-events:none/);
  assert.match(strip, /z-index:4/, 'above the dimming layer');
});

// ── Dimming ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('dim steps: five named steps; every step changes both the native level and the layer, monotonically', () => {
  assert.equal(DIM_STEP_COUNT, 5);
  assert.equal(DIM_STEP_NAMES.length, 5);
  for (const display of ['timer', 'tehillim']) {
    const levels = NATIVE_DIM_LEVELS[display];
    assert.equal(levels[0], null, 'step 0: the person’s own brightness');
    for (let i = 2; i < levels.length; i += 1) assert.ok(levels[i] < levels[i - 1], `${display} ${i}`);
    for (const level of levels.slice(1)) assert.ok(level >= 0.02 && level <= 1, 'within safe bounds');
  }
  for (const kind of ['native', 'web']) {
    const layer = OVERLAY_LEVELS[kind];
    assert.equal(layer[0], 0);
    for (let i = 1; i < layer.length; i += 1) assert.ok(layer[i] - layer[i - 1] >= 0.1, `${kind}: a visible step ${i}`);
    assert.ok(layer.at(-1) <= 0.7, 'never a black screen');
  }
  // The usual levels stay the usual: step 2 is what a session always dimmed to.
  assert.equal(nativeDimLevel('tehillim', DEFAULT_DIM_STEP), TEHILLIM_DIM_LEVEL);
  assert.equal(nativeDimLevel('timer', DEFAULT_DIM_STEP), 0.12);
  assert.equal(clampDimStep(9), 4);
  assert.equal(clampDimStep(-3), 0);
  assert.equal(overlayOpacity(3, { native: true }), OVERLAY_LEVELS.native[3]);
  assert.equal(startDimStep({ dim: false, dimStep: 3 }), 0);
  assert.equal(startDimStep({ dim: true, dimStep: 3 }), 3);
  assert.equal(startDimStep({ dim: true, dimStep: 0 }), DEFAULT_DIM_STEP);
});

function nativeRig(initial = 0.8) {
  const device = { brightness: initial, saved: null, calls: [] };
  const plugin = {
    async getBrightness() { return { brightness: device.brightness }; },
    async dim({ level }) { device.calls.push(['dim', level]); if (device.saved == null) device.saved = device.brightness; device.brightness = level; return { original: device.saved }; },
    async restore({ original, keepRecord, rampMs } = {}) { device.calls.push(['restore', rampMs ?? 0]); const value = device.saved ?? original; if (value != null) device.brightness = value; if (!keepRecord) device.saved = null; return {}; },
    async setKeepAwake() {},
  };
  const storage = memoryStorage();
  const screen = createBrightnessGuard({ plugin, storage });
  const controller = createHitbodedutController({ screen, storage, clock: () => 1000 });
  return { device, controller, storage };
}

test('− / + on the device: each press calls the native plugin and changes the brightness; 0 gives the person’s own back; the end restores', async () => {
  const { device, controller } = nativeRig(0.8);
  await controller.start({ minutes: 15, display: 'tehillim', screenOn: true, dim: true, dimStep: 2, sound: 'silence' }, 1000);
  assert.equal(device.brightness, 0.3);
  const seen = [device.brightness];
  for (const step of [3, 4]) { await controller.setDimStep(step); seen.push(device.brightness); assert.equal(controller.session.options.dimStep, step); }
  await controller.setDimStep(1); seen.push(device.brightness);
  await controller.setDimStep(0); seen.push(device.brightness);
  assert.deepEqual(seen, [0.3, 0.2, 0.12, 0.5, 0.8]);
  assert.equal(device.saved, null, 'step 0: nothing left dimmed');
  await controller.setDimStep(2);
  assert.equal(device.brightness, 0.3, 'dims again from the person’s own');
  assert.equal(device.saved, 0.8);
  await controller.end('ended', 2000);
  assert.equal(device.brightness, 0.8, 'the end restores');
});

test('dimming never brightens a screen already darker than the step; the layer still changes there', async () => {
  const { device, controller } = nativeRig(0.15);
  await controller.start({ minutes: 15, display: 'tehillim', screenOn: true, dim: true, dimStep: 1, sound: 'silence' }, 1000);
  assert.ok(device.brightness <= 0.15, `kept at ${device.brightness}`);
  await controller.setDimStep(2);
  assert.ok(device.brightness <= 0.15);
  assert.ok(overlayOpacity(2, { native: true }) > overlayOpacity(1, { native: true }), 'the visible change comes from the layer');
});

test('a session started with dimming off makes no native call until + is pressed; a kept session keeps its step', async () => {
  const { device, controller, storage } = nativeRig(0.7);
  await controller.start({ minutes: 15, display: 'timer', screenOn: true, dim: false, dimStep: 0, sound: 'silence' }, 1000);
  assert.deepEqual(device.calls, []);
  await controller.setDimStep(1);
  assert.deepEqual(device.calls, [['dim', 0.3]]);
  const kept = JSON.parse(storage.getItem('kz-hitbodedut-session-v1'));
  assert.equal(kept.options.dimStep, 1);
  assert.equal(sessionOptions(kept.options).dimLevel, 0.3);
  // Sessions from before the steps behave as before.
  assert.equal(sessionOptions({ display: 'timer' }).dimLevel, undefined);
  assert.equal(sessionOptions({ display: 'timer' }).dimStep, undefined);
});

test('the step is remembered (prefs) and the page wires − / +, the moon and the layer to it', () => {
  const storage = memoryStorage();
  assert.equal(loadPrefs(storage).dimStep, DEFAULT_DIM_STEP);
  savePrefs({ ...loadPrefs(storage), dimStep: 4, dim: true }, storage);
  assert.equal(loadPrefs(storage).dimStep, 4);
  assert.equal(normalizePrefs({ dimStep: 'x' }).dimStep, DEFAULT_DIM_STEP);
  const page = read('src/pages/HitbodedutPage.jsx');
  assert.match(page, /controller\.setDimStep\(step\)/);
  assert.match(page, /dimStep: step, dim: step > 0/);
  assert.match(page, /onLess=\{\(\) => changeDim\(dimStep - 1\)\} onMore=\{\(\) => changeDim\(dimStep \+ 1\)\}/);
  assert.match(page, /className="hb-dim-layer" data-step=\{dimStep\} style=\{\{ opacity: overlayOpacity\(dimStep/);
  assert.match(page, /dimStep: startDimStep\(prefs\)/);
  // On Tehillim the layer also reaches the words (at half strength), so the steps are seen there too.
  const css = read('src/styles/hitbodedut.css');
  assert.match(css, /\.hb-session\.is-tehillim \.hb-dim-layer\{[^}]*mask-image:radial-gradient\(ellipse[^;]*rgba\(0,0,0,\.5\) 0/);
});
