import test from 'node:test';
import assert from 'node:assert/strict';
import { createHitbodedutController, SESSION_KEY, sessionOptions } from '../src/services/hitbodedut/session.mjs';
import { createBrightnessGuard, BRIGHTNESS_KEY } from '../src/services/hitbodedut/brightness.mjs';
import { createAmbientAudio } from '../src/services/ambientAudio/engine.mjs';
import { createLiveActivityBridge } from '../src/services/hitbodedut/liveActivity.mjs';
import { chapterSequence, chaptersLabel, nextChapter } from '../src/services/hitbodedut/tehillimFlow.mjs';
import { loadPrefs, normalizePrefs, savePrefs, sessionMinutes } from '../src/services/hitbodedut/prefs.mjs';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 1, 18, 0, 0);
function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map };
}
function rig({ platform = 'ios', backgroundCapable = true, storage = memoryStorage(), brightness = 0.7 } = {}) {
  const log = [];
  const device = { brightness, awake: false, nativeOriginal: null, liveActions: [] };
  const plugin = {
    async getBrightness() { return { brightness: device.brightness }; },
    async dim({ level }) { if (device.nativeOriginal == null) device.nativeOriginal = device.brightness; device.brightness = level; log.push('dim'); return { original: device.nativeOriginal }; },
    async restore({ original, keepRecord } = {}) { const v = original ?? device.nativeOriginal; if (v != null) device.brightness = v; if (!keepRecord) device.nativeOriginal = null; log.push('restore'); },
    async setKeepAwake({ on }) { device.awake = on; log.push(`awake:${on}`); },
    async liveSupported() { return { supported: true, enabled: true }; },
    async liveStart(args) { log.push(['liveStart', args.endsAt]); return { started: true }; },
    async liveUpdate(args) { log.push(['liveUpdate', args.paused, args.paused ? args.remainingMs : args.endsAt]); },
    async liveEnd(args) { log.push(['liveEnd', args.completed]); },
    async takeLiveActions() { const actions = device.liveActions; device.liveActions = []; return { actions }; },
  };
  const backend = { backgroundCapable, log: [] };
  for (const m of ['start', 'pause', 'resume', 'stop', 'setVolume', 'chime']) backend[m] = async arg => { backend.log.push([m, arg]); return m === 'start' ? true : undefined; };
  let now = T0;
  const controller = createHitbodedutController({
    screen: createBrightnessGuard({ plugin, storage }),
    audio: createAmbientAudio(backend),
    live: createLiveActivityBridge(plugin, { platform }),
    storage,
    clock: () => now,
  });
  return { controller, device, backend, log, storage, setNow: value => { now = value; } };
}

test('start: timer, dimmed screen kept awake, sound until the end, Live Activity', async () => {
  const { controller, device, backend, log, storage } = rig();
  await controller.start({ minutes: 15, sound: 'brown', volume: 0.4 });
  assert.ok(controller.active);
  assert.equal(device.brightness < 0.7, true);
  assert.equal(device.awake, true);
  assert.deepEqual(backend.log[0], ['start', { sound: 'brown', volume: 0.4, pitch: 'mid', stopAt: T0 + 15 * MIN, title: 'התבודדות' }]);
  assert.deepEqual(log.find(entry => entry[0] === 'liveStart'), ['liveStart', T0 + 15 * MIN]);
  assert.ok(storage.getItem(SESSION_KEY));
});

test('pause / resume keep the sound and the Live Activity in step', async () => {
  const { controller, backend, log, setNow } = rig();
  await controller.start({ minutes: 30, sound: 'pink' });
  setNow(T0 + 10 * MIN);
  await controller.pause();
  assert.equal(controller.remaining(T0 + 20 * MIN), 20 * MIN);
  assert.deepEqual(log.at(-1), ['liveUpdate', true, 20 * MIN]);
  assert.equal(backend.log.at(-1)[0], 'pause');
  setNow(T0 + 15 * MIN);
  await controller.resume();
  assert.deepEqual(log.at(-1), ['liveUpdate', false, T0 + 35 * MIN]);
  assert.deepEqual(backend.log.at(-1), ['resume', { stopAt: T0 + 35 * MIN }]);
});

test('end restores everything it changed', async () => {
  const { controller, device, backend, log, storage, setNow } = rig({ brightness: 0.65 });
  await controller.start({ minutes: 60, sound: 'white' });
  setNow(T0 + 5 * MIN);
  const summary = await controller.end();
  assert.equal(summary.timer.endReason, 'ended');
  assert.equal(device.brightness, 0.65);
  assert.equal(device.awake, false);
  assert.equal(backend.log.at(-1)[0], 'stop');
  assert.deepEqual(log.at(-1), ['liveEnd', false]);
  assert.equal(storage.getItem(SESSION_KEY), null);
  assert.equal(storage.getItem(BRIGHTNESS_KEY), null);
  assert.equal(controller.active, false);
  assert.equal(backend.log.some(([m]) => m === 'chime'), false, 'no chime when ended by choice');
});

test('time up: completed, a soft chime in the foreground, Live Activity ended as completed', async () => {
  const { controller, backend, log } = rig();
  await controller.start({ minutes: 15, sound: 'silence' }, T0);
  assert.equal(await controller.tick(T0 + 14 * MIN), null);
  const summary = await controller.tick(T0 + 15 * MIN + 300);
  assert.equal(summary.timer.endReason, 'completed');
  assert.equal(backend.log.some(([m]) => m === 'chime'), true);
  assert.deepEqual(log.at(-1), ['liveEnd', true]);
});

test('custom duration and screen-off sessions: no dimming, no keep-awake', async () => {
  const { controller, device } = rig();
  await controller.start({ minutes: 45, screenOn: false, sound: 'silence' });
  assert.equal(controller.remaining(T0), 45 * MIN);
  assert.equal(device.brightness, 0.7);
  assert.equal(device.awake, false);
});

test('Tehillim display always keeps the screen on', () => {
  assert.equal(sessionOptions({ display: 'tehillim', screenOn: false }).screenOn, true);
  assert.equal(sessionOptions({ startChapter: 400 }).startChapter, 150);
});

test('background: brightness restored at once, native sound goes on; foreground re-dims', async () => {
  const { controller, device, backend } = rig({ backgroundCapable: true, brightness: 0.5 });
  await controller.start({ minutes: 15, sound: 'brown' });
  await controller.background();
  assert.equal(device.brightness, 0.5);
  assert.equal(backend.log.filter(([m]) => m === 'pause').length, 0);
  await controller.foreground(T0 + MIN);
  assert.ok(device.brightness < 0.5);
});

test('Lock Screen actions taken while suspended are applied on return, with their own instants', async () => {
  const { controller, device } = rig();
  await controller.start({ minutes: 30, sound: 'silence' });
  await controller.background();
  device.liveActions = [{ action: 'pause', at: T0 + 5 * MIN }, { action: 'resume', at: T0 + 8 * MIN }];
  await controller.foreground(T0 + 9 * MIN);
  assert.equal(controller.session.timer.endsAt, T0 + 33 * MIN);
  device.liveActions = [{ action: 'end', at: T0 + 10 * MIN }];
  await controller.background();
  const ended = await controller.foreground(T0 + 11 * MIN);
  assert.equal(controller.active, false);
  assert.equal(ended.timer.endReason, 'ended');
});

test('returning after the time ran out (locked phone) completes the session', async () => {
  const { controller } = rig();
  await controller.start({ minutes: 15, sound: 'brown' });
  await controller.background();
  const ended = await controller.foreground(T0 + 40 * MIN);
  assert.equal(ended.timer.endReason, 'completed');
});

test('recover: a reload during a session continues it', async () => {
  const storage = memoryStorage();
  const first = rig({ storage });
  await first.controller.start({ minutes: 30, sound: 'pink' });
  const second = rig({ storage });
  second.setNow(T0 + 10 * MIN);
  const resumed = await second.controller.recover();
  assert.ok(second.controller.active);
  assert.equal(resumed.timer.endsAt, T0 + 30 * MIN);
  assert.equal(second.backend.log[0][0], 'start');
});

test('recover: a session whose time passed (crash, kill) is closed quietly and the brightness restored', async () => {
  const storage = memoryStorage();
  const first = rig({ storage, brightness: 0.9 });
  await first.controller.start({ minutes: 15, sound: 'silence' });
  const second = rig({ storage, brightness: first.device.brightness });
  second.setNow(T0 + 3 * 60 * MIN);
  const summary = await second.controller.recover();
  assert.equal(summary.timer.endReason, 'completed');
  assert.equal(second.controller.active, false);
  assert.equal(second.device.brightness, 0.9);
  assert.equal(second.backend.log.some(([m]) => m === 'chime'), false, 'no chime hours later');
  assert.equal(storage.getItem(BRIGHTNESS_KEY), null);
});

test('recover with nothing saved restores a stale brightness record and ends a stale Live Activity', async () => {
  const storage = memoryStorage({ [BRIGHTNESS_KEY]: JSON.stringify({ original: 0.75, level: 0.1, at: 1 }) });
  const { controller, device, log } = rig({ storage, brightness: 0.1 });
  assert.equal(await controller.recover(), null);
  assert.equal(device.brightness, 0.75);
  assert.deepEqual(log.at(-1), ['liveEnd', false]);
});

test('without Live Activities (Android / web) nothing is sent', async () => {
  const { controller, log } = rig({ platform: 'android' });
  await controller.start({ minutes: 15 });
  await controller.pause();
  await controller.end();
  assert.equal(log.some(entry => Array.isArray(entry) && String(entry[0]).startsWith('live')), false);
});

test('Tehillim chapters are noted once each, never written to the journal by the session', async () => {
  const { controller } = rig();
  await controller.start({ minutes: 15, display: 'tehillim', startChapter: 149 });
  controller.noteChapter(149); controller.noteChapter(150); controller.noteChapter(150); controller.noteChapter(1);
  const summary = await controller.end();
  assert.deepEqual(summary.chapters, [149, 150, 1]);
  assert.equal(chaptersLabel(summary.chapters), 'פרקים קמ״ט–א׳');
});

test('the Tehillim flow continues past 150 back to 1', () => {
  assert.deepEqual(chapterSequence(148, 5), [148, 149, 150, 1, 2]);
  assert.equal(nextChapter(150), 1);
  assert.equal(chaptersLabel([23]), 'פרק כ״ג');
  assert.equal(chaptersLabel([1, 5]), '2 פרקים');
});

test('prefs: normalized, custom minutes, manual sound only when explicit', () => {
  const storage = memoryStorage();
  assert.equal(loadPrefs(storage).minutes, 15);
  savePrefs({ minutes: 'custom', customMinutes: 999, ambient: { sound: 'pink', volume: 3 } }, storage);
  const prefs = loadPrefs(storage);
  assert.equal(sessionMinutes(prefs), 180);
  assert.equal(prefs.ambient, null, 'not marked manual → no stored choice');
  assert.deepEqual(normalizePrefs({ ambient: { sound: 'pink', volume: 3, manual: true } }).ambient, { sound: 'pink', volume: 1, pitch: 'mid', manual: true });
  assert.equal(normalizePrefs({ minutes: 17 }).minutes, 15);
});

test('an action delivered twice (event + pending list) is applied once', async () => {
  const { controller, device } = rig();
  await controller.start({ minutes: 30, sound: 'silence' });
  await controller.apply({ action: 'pause', at: T0 + 5 * MIN, id: 'a' });
  await controller.apply({ action: 'resume', at: T0 + 8 * MIN, id: 'b' });
  device.liveActions = [{ action: 'pause', at: T0 + 5 * MIN, id: 'a' }, { action: 'resume', at: T0 + 8 * MIN, id: 'b' }];
  await controller.foreground(T0 + 9 * MIN);
  assert.equal(controller.session.timer.endsAt, T0 + 33 * MIN);
});
