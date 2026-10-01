import test from 'node:test';
import assert from 'node:assert/strict';
import { BRIGHTNESS_KEY, createBrightnessGuard } from '../src/services/hitbodedut/brightness.mjs';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map };
}
// A screen that behaves like the device: one brightness value, and a native copy of the original (like UserDefaults).
function mockScreen(initial = 0.7) {
  const screen = { brightness: initial, keepAwake: false, nativeOriginal: null, calls: [] };
  screen.plugin = {
    async getBrightness() { screen.calls.push('get'); return { brightness: screen.brightness }; },
    async dim({ level }) { screen.calls.push(`dim:${level}`); if (screen.nativeOriginal == null) screen.nativeOriginal = screen.brightness; screen.brightness = level; return { original: screen.nativeOriginal }; },
    async restore({ original, keepRecord } = {}) { screen.calls.push('restore'); const value = original ?? screen.nativeOriginal; if (value != null) screen.brightness = value; if (!keepRecord) screen.nativeOriginal = null; return {}; },
    async setKeepAwake({ on }) { screen.calls.push(`awake:${on}`); screen.keepAwake = on; },
  };
  return screen;
}

test('dim saves the original once, restore brings it back and forgets it', async () => {
  const screen = mockScreen(0.7);
  const storage = memoryStorage();
  const guard = createBrightnessGuard({ plugin: screen.plugin, storage, now: () => 1 });
  await guard.dim(0.1);
  assert.equal(screen.brightness, 0.1);
  assert.deepEqual(JSON.parse(storage.getItem(BRIGHTNESS_KEY)), { original: 0.7, level: 0.1, at: 1 });
  await guard.dim(0.05);
  assert.equal(JSON.parse(storage.getItem(BRIGHTNESS_KEY)).original, 0.7, 'a second dim never records the dimmed value as the original');
  await guard.restore();
  assert.equal(screen.brightness, 0.7);
  assert.equal(storage.getItem(BRIGHTNESS_KEY), null);
  assert.equal(guard.state.dimmed, false);
});

test('background restores at once and keeps the record; foreground re-dims', async () => {
  const screen = mockScreen(0.6);
  const storage = memoryStorage();
  const guard = createBrightnessGuard({ plugin: screen.plugin, storage });
  await guard.dim(0.1);
  await guard.suspend();
  assert.equal(screen.brightness, 0.6, 'the person sees their own brightness outside the app');
  assert.ok(storage.getItem(BRIGHTNESS_KEY), 'record kept while the session is still on');
  await guard.resumeDim();
  assert.equal(screen.brightness, 0.1);
  await guard.restore();
  assert.equal(screen.brightness, 0.6);
});

test('crash recovery: a record without a live session is restored on the next launch', async () => {
  const screen = mockScreen(0.1);          // the app died while dimmed
  screen.keepAwake = true;
  const storage = memoryStorage({ [BRIGHTNESS_KEY]: JSON.stringify({ original: 0.8, level: 0.1, at: 5 }) });
  const guard = createBrightnessGuard({ plugin: screen.plugin, storage });
  assert.equal(await guard.recover({ sessionActive: false }), true);
  assert.equal(screen.brightness, 0.8);
  assert.equal(screen.keepAwake, false);
  assert.equal(storage.getItem(BRIGHTNESS_KEY), null);
  assert.equal(await guard.recover({ sessionActive: false }), false, 'nothing left to recover');
});

test('recovery leaves a live session alone', async () => {
  const screen = mockScreen(0.1);
  const storage = memoryStorage({ [BRIGHTNESS_KEY]: JSON.stringify({ original: 0.8, level: 0.1, at: 5 }) });
  const guard = createBrightnessGuard({ plugin: screen.plugin, storage });
  assert.equal(await guard.recover({ sessionActive: true }), false);
  assert.equal(screen.brightness, 0.1);
});

test('a corrupt record never throws and never sets a nonsense brightness', async () => {
  const screen = mockScreen(0.5);
  const storage = memoryStorage({ [BRIGHTNESS_KEY]: '{oops' });
  const guard = createBrightnessGuard({ plugin: screen.plugin, storage });
  assert.equal(await guard.recover(), false);
  assert.equal(screen.brightness, 0.5);
});

test('without a plugin (the web) everything is a quiet no-op', async () => {
  const guard = createBrightnessGuard({ plugin: null, storage: memoryStorage() });
  await guard.dim(0.1);
  await guard.suspend();
  await guard.resumeDim();
  await guard.restore();
  assert.equal(await guard.recover(), false);
});

test('a failing plugin call does not break the session', async () => {
  const plugin = { getBrightness: async () => { throw new Error('x'); }, dim: async () => { throw new Error('x'); }, restore: async () => { throw new Error('x'); }, setKeepAwake: async () => { throw new Error('x'); } };
  const guard = createBrightnessGuard({ plugin, storage: memoryStorage() });
  await guard.dim(0.1);
  await guard.setKeepAwake(true);
  await guard.restore();
  assert.equal(guard.state.dimmed, false);
});
