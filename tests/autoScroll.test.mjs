// The shared Auto-Scroll engine — pure logic driven by a fake clock and a fake frame scheduler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SPEED, SPEED_KEY, SPEED_MAX, SPEED_MIN, SPEED_PRESETS, STATE, createAutoScroller, prefersReducedMotion, presetOf, readStoredSpeed, resolveSpeed, storeSpeed } from '../src/services/autoScroll.mjs';
import { memoryStorage } from './helpers/memoryStorage.mjs';

function rig({ height = 10_000, start = 0, speed = 'medium' } = {}) {
  let top = start;
  let clock = 0;
  const frames = new Map();
  let nextHandle = 1;
  const writes = [];
  const events = [];
  const target = { get: () => top, set: value => { top = value; writes.push(value); }, max: () => height };
  const scroller = createAutoScroller({
    target, speed,
    now: () => clock,
    requestFrame: callback => { const handle = nextHandle++; frames.set(handle, callback); return handle; },
    cancelFrame: handle => frames.delete(handle),
    onChange: event => events.push(event),
  });
  // Run the pending frame at `ms` later.
  const tick = (ms = 16) => { clock += ms; const pending = [...frames.entries()]; frames.clear(); for (const [, callback] of pending) callback(clock); };
  return { scroller, tick, frames, writes, events, get top() { return top; }, set top(value) { top = value; }, advance: ms => { clock += ms; } };
}

test('speeds: names, numbers, limits, and the remembered speed', () => {
  assert.equal(resolveSpeed('slow'), SPEED_PRESETS.slow);
  assert.equal(resolveSpeed(30), 30);
  assert.equal(resolveSpeed(1), SPEED_MIN);
  assert.equal(resolveSpeed(10_000), SPEED_MAX);
  assert.equal(resolveSpeed('nonsense'), DEFAULT_SPEED);
  assert.equal(presetOf(SPEED_PRESETS.fast), 'fast');
  assert.equal(presetOf(31), null);
  const storage = memoryStorage();
  assert.equal(readStoredSpeed(storage), null);
  storeSpeed(37, storage);
  assert.equal(readStoredSpeed(storage), 37);
  assert.equal(readStoredSpeed(memoryStorage({ [SPEED_KEY]: '{oops' })), null);
});

test('start moves the page smoothly with sub-pixel accumulation (no jumps)', () => {
  const r = rig({ speed: 12 }); // 12 px/s → 0.192 px per 16 ms frame
  assert.equal(r.scroller.start(), true);
  assert.equal(r.scroller.state, STATE.RUNNING);
  for (let i = 0; i < 125; i += 1) r.tick(16); // two seconds
  assert.ok(Math.abs(r.top - 24) <= 1, `about 24px after 2s at 12px/s, got ${r.top}`);
  for (let i = 1; i < r.writes.length; i += 1) assert.ok(r.writes[i] - r.writes[i - 1] <= 1, 'one pixel at a time at a slow speed');
  assert.ok(r.writes.length < 125, 'frames with less than a pixel of movement write nothing');
});

test('pause stops all frames; resume continues from where the page is', () => {
  const r = rig({ speed: 60 });
  r.scroller.start();
  for (let i = 0; i < 60; i += 1) r.tick(16);
  r.scroller.pause();
  assert.equal(r.scroller.state, STATE.PAUSED);
  assert.equal(r.frames.size, 0, 'no frame is pending while paused');
  const at = r.top;
  r.advance(5000);
  assert.equal(r.top, at, 'nothing moves while paused');
  r.top = at + 400; // the reader dragged the page meanwhile
  assert.equal(r.scroller.resume(), true);
  r.tick(16);
  assert.ok(r.top >= at + 400 && r.top <= at + 402, `continues from the new place (${r.top})`);
  assert.deepEqual(r.events.map(event => event.reason).filter(Boolean).slice(0, 3), ['start', 'pause', 'resume']);
});

test('a long gap (background) is clamped to one short step; a jump by someone else re-anchors', () => {
  const r = rig({ speed: 50 });
  r.scroller.start();
  r.tick(10_000);
  assert.ok(r.top <= 6, `a 10s gap moves at most one clamped frame (${r.top})`);
  r.top = 3000;
  r.tick(16);
  assert.ok(r.top >= 3000 && r.top <= 3002);
});

test('setSpeed changes the pace while running', () => {
  const r = rig({ speed: 'slow' });
  r.scroller.start();
  for (let i = 0; i < 50; i += 1) r.tick(20); // 1s
  const slow = r.top;
  r.scroller.setSpeed('fast');
  assert.equal(r.scroller.speed, SPEED_PRESETS.fast);
  for (let i = 0; i < 50; i += 1) r.tick(20);
  assert.ok(r.top - slow > slow * 2, 'faster after the change');
});

test('reaching the end stops by itself; starting at the end does nothing', () => {
  const r = rig({ height: 30, speed: 90 });
  r.scroller.start();
  for (let i = 0; i < 100 && r.scroller.state === STATE.RUNNING; i += 1) r.tick(16);
  assert.equal(r.scroller.state, STATE.IDLE);
  assert.equal(r.top, 30);
  assert.equal(r.events.at(-1).reason, 'end');
  assert.equal(r.frames.size, 0);
  assert.equal(r.scroller.start(), false);
});

test('stop and destroy release every frame (cleanup on unmount)', () => {
  const r = rig();
  r.scroller.start();
  r.tick(16);
  r.scroller.stop();
  assert.equal(r.frames.size, 0);
  assert.equal(r.scroller.state, STATE.IDLE);
  r.scroller.start();
  r.scroller.destroy();
  assert.equal(r.frames.size, 0);
  assert.equal(r.scroller.start(), false, 'a destroyed engine never starts again');
  assert.equal(r.scroller.resume(), false);
});

test('reduced motion (the device or the app) holds back auto-start', () => {
  const html = attrs => ({ document: { documentElement: { hasAttribute: name => attrs.includes(name) } }, matchMedia: () => ({ matches: false }) });
  assert.equal(prefersReducedMotion(html([])), false);
  assert.equal(prefersReducedMotion(html(['data-a11y-motion'])), true);
  assert.equal(prefersReducedMotion({ document: { documentElement: { hasAttribute: () => false } }, matchMedia: query => ({ matches: query.includes('reduce') }) }), true);
  assert.equal(prefersReducedMotion(undefined), false);
});

test('the hook and control: off by default, no focus stealing, no live announcements, everything removed on unmount', () => {
  const hook = readFileSync(new URL('../src/hooks/useAutoScroll.js', import.meta.url), 'utf8');
  assert.match(hook, /if \(autoStart && !prefersReducedMotion\(window\)\) scroller\.start\(\)/);
  assert.match(hook, /scroller\.destroy\(\)/);
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) assert.ok(hook.includes(`'${type}'`), type);
  assert.ok(!/\.focus\(/.test(hook), 'the hook never moves focus');
  const control = readFileSync(new URL('../src/components/AutoScrollControl.jsx', import.meta.url), 'utf8');
  assert.ok(!/aria-live="(polite|assertive)"/.test(control), 'nothing is announced while scrolling');
  for (const reader of ['components/SourceReader.jsx', 'components/ComposedPrayerReader.jsx', 'components/DayServiceReader.jsx', 'components/RiteServiceReader.jsx', 'pages/LibraryPage.jsx', 'Tehillim.jsx', 'pages/ShnayimMikra.jsx']) {
    const source = readFileSync(new URL(`../src/${reader}`, import.meta.url), 'utf8');
    assert.match(source, /<AutoScrollControl\b/, `${reader} offers the same control`);
  }
});

test('auto-scroll is never counted as the reader\'s engagement: the study timer skips scroll events while it runs', async () => {
  const { createAutoScroller, isAutoScrolling, runningAutoScrollers } = await import('../src/services/autoScroll.mjs');
  let top = 0; const frames = [];
  const scroller = createAutoScroller({ target: { get: () => top, set: v => { top = v; }, max: () => 5000 }, now: () => 0, requestFrame: cb => { frames.push(cb); return frames.length; }, cancelFrame: () => {} });
  const base = runningAutoScrollers();
  scroller.start(); assert.equal(runningAutoScrollers(), base + 1); assert.equal(isAutoScrolling(), true);
  scroller.pause(); assert.equal(runningAutoScrollers(), base);
  scroller.resume(); assert.equal(runningAutoScrollers(), base + 1);
  scroller.destroy(); assert.equal(runningAutoScrollers(), base);
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../src/hooks.jsx', import.meta.url), 'utf8'), /event\?\.type === 'scroll' && isAutoScrolling\(\)\) return;/);
});
