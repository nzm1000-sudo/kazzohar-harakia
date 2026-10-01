// התבודדות — the chosen sound starts the moment "התחלה" is tapped, on the web and in the app, and goes on to the end.
// Root causes covered here:
//   · a tile tap plays an 8-second listen; "התחלה" within it was taken as "already playing" and the listen's own end
//     (a timer in Web Audio, a scheduled stop natively) silenced the session a few seconds in;
//   · a play() during a fade-out was swallowed (the engine still said "playing") and the fade's end then tore it down;
//   · Web Audio on iOS follows the silent switch unless the page asks for a playback audio session;
//   · the screen's brightness calls were awaited before the sound was even asked for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAmbientAudio } from '../src/services/ambientAudio/engine.mjs';
import { createWebAudioBackend, preferPlaybackSession, FADE_OUT_S } from '../src/services/ambientAudio/webBackend.mjs';
import { createNativeAudioBackend } from '../src/services/ambientAudio/nativeBackend.mjs';
import { createHitbodedutController } from '../src/services/hitbodedut/session.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function mockBackend({ retime = true } = {}) {
  const log = [];
  const backend = { backgroundCapable: true, log };
  for (const method of ['start', 'pause', 'resume', 'stop', 'setVolume', 'chime']) backend[method] = async arg => { log.push([method, arg]); return method === 'start' ? true : undefined; };
  if (retime) backend.retime = async arg => { log.push(['retime', arg]); return true; };
  return backend;
}

// A minimal Web Audio double: records what was started, resumed and stopped.
function fakeAudioContext() {
  const events = [];
  class Param {
    constructor() { this.value = 1; }
    cancelScheduledValues() {} setValueAtTime(v) { this.value = v; } linearRampToValueAtTime(v) { this.value = v; events.push(['ramp', v]); }
  }
  class Ctx {
    constructor() { this.state = 'suspended'; this.sampleRate = 48000; this.currentTime = 0; this.destination = {}; events.push(['new']); }
    resume() { events.push(['resume']); this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    createBuffer(channels, length, rate) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { length, sampleRate: rate, numberOfChannels: channels, getChannelData: c => data[c] }; }
    createGain() { return { gain: new Param(), connect() {}, disconnect() {} }; }
    createBufferSource() {
      const node = { buffer: null, loop: false, connect() { return node; }, disconnect() {}, start() { events.push(['start', node.buffer?.length]); node.playing = true; }, stop() { events.push(['stop']); node.playing = false; } };
      return node;
    }
  }
  return { Ctx, events };
}

test('the short listen becomes the session sound: same sound, new end time → retimed, never stopped', async () => {
  const backend = mockBackend();
  const audio = createAmbientAudio(backend);
  await audio.play({ sound: 'rain', volume: 0.4, stopAt: 8000, title: 'התבודדות' });       // the tile's listen
  await audio.play({ sound: 'rain', volume: 0.4, stopAt: 15 * 60000, title: 'התבודדות' }); // "התחלה"
  assert.equal(audio.state, 'playing');
  assert.deepEqual(backend.log.map(([m]) => m), ['start', 'retime']);
  assert.deepEqual(backend.log[1][1], { stopAt: 15 * 60000, volume: 0.4 });
  assert.equal(audio.current.stopAt, 15 * 60000);
});

test('a backend that cannot retime (or is fading out) starts the sound afresh with the session end', async () => {
  const backend = mockBackend({ retime: false });
  const audio = createAmbientAudio(backend);
  await audio.play({ sound: 'brown', stopAt: 8000 });
  await audio.play({ sound: 'brown', stopAt: 900000 });
  assert.deepEqual(backend.log.map(([m]) => m), ['start', 'stop', 'start']);
  assert.equal(backend.log.at(-1)[1].stopAt, 900000);
  // A native app without audioRetime: the call rejects → afresh as well.
  const plugin = { calls: [], async audioStart(a) { this.calls.push(['audioStart', a.stopAt]); return { started: true }; }, async audioStop() { this.calls.push(['audioStop']); }, async audioRetime() { throw new Error('not implemented'); } };
  const native = createAmbientAudio(createNativeAudioBackend(plugin));
  await native.play({ sound: 'white', stopAt: 8000 });
  await native.play({ sound: 'white', stopAt: 900000 });
  assert.deepEqual(plugin.calls, [['audioStart', 8000], ['audioStop'], ['audioStart', 900000]]);
  // With audioRetime: one call, the sound goes on.
  const modern = { calls: [], async audioStart(a) { this.calls.push(['audioStart', a.stopAt]); return { started: true }; }, async audioRetime(a) { this.calls.push(['audioRetime', a.stopAt]); return { retimed: true }; } };
  const kept = createAmbientAudio(createNativeAudioBackend(modern));
  await kept.play({ sound: 'white', stopAt: 8000 });
  await kept.play({ sound: 'white', stopAt: 900000 });
  assert.deepEqual(modern.calls, [['audioStart', 8000], ['audioRetime', 900000]]);
});

test('"התחלה" during the listen\'s fade-out: the session sound starts afresh and the fade never silences it', async () => {
  let release;
  const backend = mockBackend();
  backend.stop = arg => { backend.log.push(['stop', arg]); return new Promise(resolve => { release = resolve; }); };
  const audio = createAmbientAudio(backend);
  await audio.play({ sound: 'pink', stopAt: 8000 });
  const stopping = audio.stop();                       // the listen's end, fading out
  assert.equal(audio.state, 'idle', 'idle at once');
  await audio.play({ sound: 'pink', stopAt: 900000 }); // the session
  release();
  await stopping;
  assert.equal(audio.state, 'playing');
  assert.equal(audio.current.stopAt, 900000);
  assert.deepEqual(backend.log.map(([m]) => m), ['start', 'stop', 'start']);
});

test('Web Audio: primed inside the tap — playback audio session, resume and a silent sample, synchronously', () => {
  const { Ctx, events } = fakeAudioContext();
  const nav = { audioSession: { type: 'auto' } };
  const backend = createWebAudioBackend({ AudioContextClass: Ctx, fetchImpl: null, navigatorRef: nav });
  backend.prime();                                     // nothing awaited: all of it happens in the gesture
  assert.equal(nav.audioSession.type, 'playback', 'plays with the silent switch on (iOS)');
  assert.deepEqual(events.slice(0, 3), [['new'], ['resume'], ['start', 1]]);
  assert.equal(preferPlaybackSession({}), false, 'no Audio Session API: a quiet no-op');
  assert.equal(preferPlaybackSession(undefined), false);
});

test('Web Audio: start plays at once; retime moves the end; a stop\'s fade never tears down a newer start', async () => {
  const { Ctx, events } = fakeAudioContext();
  const backend = createWebAudioBackend({ AudioContextClass: Ctx, fetchImpl: null, navigatorRef: {} });
  backend.prime();
  assert.equal(await backend.start({ sound: 'brown', volume: 0.5, pitch: 'mid', stopAt: Date.now() + 8000 }), true);
  assert.ok(events.some(([e, n]) => e === 'start' && n > 1), 'the loop started');
  assert.equal(await backend.retime({ stopAt: Date.now() + 900000, volume: 0.5 }), true);
  // A stop (fading) and a start right after it: the new sound survives the fade's end.
  const stopping = backend.stop();
  assert.equal(await backend.retime({ stopAt: 1 }), false, 'a fading sound is not retimed (the engine starts afresh)');
  const before = events.filter(([e]) => e === 'stop').length;
  await backend.start({ sound: 'white', volume: 0.4, pitch: 'mid', stopAt: 0 });
  const afterStart = events.filter(([e]) => e === 'stop').length;
  assert.equal(afterStart, before + 1, 'the start replaced the fading source');
  await stopping;
  assert.equal(events.filter(([e]) => e === 'stop').length, afterStart, 'the fade\'s end left the new sound alone');
  assert.ok(FADE_OUT_S > 0);
  await backend.stop({ immediate: true });
});

test('the session asks for the sound before the screen calls, and plays to the session end', async () => {
  const order = [];
  const audio = { state: 'idle', async play(args) { order.push(['play', args.stopAt]); }, async stop() {}, async chime() {} };
  const screen = {
    async setKeepAwake() { order.push('awake'); await tick(); },
    async dim() { order.push('dim'); await tick(); },
    async restore() {}, async suspend() {}, async resumeDim() {}, async recover() {},
  };
  const controller = createHitbodedutController({ screen, audio, clock: () => 1000 });
  await controller.start({ minutes: 15, sound: 'rain', volume: 0.5, display: 'tehillim' }, 1000);
  assert.deepEqual(order[0], ['play', 1000 + 15 * 60000]);
  assert.deepEqual(order.slice(1), ['awake', 'dim']);
});

test('the page primes in the tap, and the native players are .playback (silent switch) and bundled', () => {
  const page = read('src/pages/HitbodedutPage.jsx');
  const start = page.slice(page.indexOf('const start = () => {'), page.indexOf('const tehillim = prefs.display'));
  assert.ok(start.indexOf('ambientAudio().prime()') > -1 && start.indexOf('ambientAudio().prime()') < start.indexOf('controller.start('), 'prime before the session starts, in the same tap');
  const swift = read('ios/App/App/KZHitbodedutPlugin.swift');
  assert.match(swift, /setCategory\(\.playback, mode: \.default, options: \[\]\)/);
  assert.match(swift, /CAPPluginMethod\(name: "audioRetime"/);
  assert.match(swift, /func retime\(stopAt: Double, volume next: Float\?\) -> Bool/);
  assert.match(read('ios/App/App/Info.plist'), /<string>audio<\/string>/, 'background audio mode (plays with the screen locked)');
  assert.match(read('android/app/src/main/java/com/kzohaar/app/hitbodedut/KZHitbodedutPlugin.java'), /public void audioRetime\(PluginCall call\)/);
});
