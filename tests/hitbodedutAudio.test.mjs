import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmbientAudio } from '../src/services/ambientAudio/engine.mjs';
import { differenceEnergyRatio, fadeGain, noiseSource, renderNoiseLoop, renderToneLoop, TARGET_RMS, SOUND_IDS, TONE_PITCHES } from '../src/services/ambientAudio/noise.mjs';
import { PRESETS, presetForHour, resolveAmbientChoice, manualChoice, suggestPreset } from '../src/services/ambientAudio/presets.mjs';

function mockBackend({ backgroundCapable = false } = {}) {
  const log = [];
  const backend = { backgroundCapable, log };
  for (const method of ['start', 'pause', 'resume', 'stop', 'setVolume', 'chime']) backend[method] = async arg => { log.push([method, arg]); return method === 'start' ? true : undefined; };
  return backend;
}
const rms = samples => Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);

test('the sounds offered', () => {
  assert.deepEqual([...SOUND_IDS], ['silence', 'white', 'pink', 'brown', 'tone']);
  assert.equal(TONE_PITCHES.length, 3);
});

test('noise colours are spectrally shaped: white > pink > brown in high-frequency energy', () => {
  const take = kind => { const next = noiseSource(kind, 7); for (let i = 0; i < 20000; i += 1) next(); return Float32Array.from({ length: 44100 }, next); };
  const white = differenceEnergyRatio(take('white'));
  const pink = differenceEnergyRatio(take('pink'));
  const brown = differenceEnergyRatio(take('brown'));
  assert.ok(white > 1.8 && white < 2.2, `white ≈ 2 (${white})`);
  assert.ok(pink < white * 0.75, `pink below white (${pink})`);
  assert.ok(brown < pink * 0.2, `brown far below pink (${brown})`);
});

test('a loop is seamless: the jump from its last sample to its first is like any other step', () => {
  for (const kind of ['white', 'pink', 'brown']) {
    const loop = renderNoiseLoop(kind, { sampleRate: 8000, seconds: 2, crossfadeSeconds: 0.25 });
    let total = 0;
    for (let i = 1; i < loop.length; i += 1) total += Math.abs(loop[i] - loop[i - 1]);
    const typical = total / (loop.length - 1);
    const seam = Math.abs(loop[0] - loop[loop.length - 1]);
    assert.ok(seam < typical * 6, `${kind}: seam ${seam} vs typical ${typical}`);
    assert.ok(Math.abs(rms(loop) - TARGET_RMS) < 0.02, `${kind}: normalized loudness`);
    assert.ok(Math.max(...loop.map(Math.abs)) <= 0.951, `${kind}: safe peak`);
  }
});

test('the tone loop holds whole cycles (its seam is exact)', () => {
  const loop = renderToneLoop(196, { sampleRate: 8000, seconds: 1 });
  const step = Math.abs(loop[1] - loop[0]);
  assert.ok(Math.abs(loop[0]) < 1e-6);
  assert.ok(Math.abs(loop[loop.length - 1] - loop[0]) <= step * 1.01);
});

test('fades are gentle (ease in-out, 0 → 1)', () => {
  assert.equal(fadeGain(0, 2), 0);
  assert.equal(fadeGain(1, 2), 0.5);
  assert.equal(fadeGain(2, 2), 1);
  assert.ok(fadeGain(0.2, 2) < 0.1);
});

test('state machine: play / pause / resume / stop', async () => {
  const backend = mockBackend();
  const audio = createAmbientAudio(backend);
  const seen = [];
  audio.subscribe(state => seen.push(state));
  assert.equal(audio.state, 'idle');
  await audio.play({ sound: 'brown', volume: 0.5, stopAt: 1000 });
  assert.equal(audio.state, 'playing');
  assert.deepEqual(backend.log[0], ['start', { sound: 'brown', volume: 0.5, pitch: 'mid', stopAt: 1000, title: '' }]);
  await audio.pause();
  assert.equal(audio.state, 'paused');
  await audio.pause();
  assert.equal(backend.log.filter(([m]) => m === 'pause').length, 1, 'a second pause does nothing');
  await audio.resume({ stopAt: 2000 });
  assert.equal(audio.state, 'playing');
  assert.deepEqual(backend.log.at(-1), ['resume', { stopAt: 2000 }]);
  await audio.stop();
  assert.equal(audio.state, 'idle');
  assert.deepEqual(seen, ['playing', 'paused', 'playing', 'idle']);
});

test('silence never starts the backend; switching sound restarts it', async () => {
  const backend = mockBackend();
  const audio = createAmbientAudio(backend);
  await audio.play({ sound: 'silence' });
  assert.equal(audio.state, 'idle');
  assert.equal(backend.log.length, 0);
  await audio.play({ sound: 'white' });
  await audio.play({ sound: 'pink' });
  assert.deepEqual(backend.log.map(([m]) => m), ['start', 'stop', 'start']);
  await audio.play({ sound: 'pink', volume: 0.2 });
  assert.deepEqual(backend.log.at(-1), ['setVolume', 0.2], 'same sound → only the volume changes');
});

test('background / foreground: Web Audio is paused when hidden and resumed when shown', async () => {
  const backend = mockBackend({ backgroundCapable: false });
  const audio = createAmbientAudio(backend);
  await audio.play({ sound: 'pink' });
  await audio.background();
  assert.equal(audio.state, 'interrupted');
  await audio.foreground();
  assert.equal(audio.state, 'playing');
  assert.deepEqual(backend.log.map(([m]) => m), ['start', 'pause', 'resume']);
});

test('background / foreground: the native backend keeps playing with the screen locked', async () => {
  const backend = mockBackend({ backgroundCapable: true });
  const audio = createAmbientAudio(backend);
  await audio.play({ sound: 'brown' });
  await audio.background();
  assert.equal(audio.state, 'playing');
  await audio.foreground();
  assert.deepEqual(backend.log.map(([m]) => m), ['start']);
});

test('a paused sound stays paused across background and foreground', async () => {
  const audio = createAmbientAudio(mockBackend());
  await audio.play({ sound: 'white' });
  await audio.pause();
  await audio.background();
  await audio.foreground();
  assert.equal(audio.state, 'paused');
});

test('remote changes (Lock Screen, interruptions, native end) are reflected', async () => {
  const audio = createAmbientAudio(mockBackend({ backgroundCapable: true }));
  await audio.play({ sound: 'tone', pitch: 'low' });
  audio.remote('pause');
  assert.equal(audio.state, 'paused');
  audio.remote('play');
  assert.equal(audio.state, 'playing');
  audio.remote('interrupted');
  assert.equal(audio.state, 'interrupted');
  audio.remote('ended');
  assert.equal(audio.state, 'idle');
  assert.equal(audio.current, null);
});

test('a failing backend never throws into the screen', async () => {
  const backend = { start: async () => { throw new Error('x'); }, stop: async () => { throw new Error('x'); } };
  const audio = createAmbientAudio(backend);
  await audio.play({ sound: 'white' });
  await audio.stop();
  assert.equal(audio.state, 'idle');
});

test('AdaptiveAmbientAudio: a suggestion by the time of day', () => {
  assert.equal(presetForHour(7), PRESETS.morning);
  assert.equal(presetForHour(13), PRESETS.day);
  assert.equal(presetForHour(19), PRESETS.evening);
  assert.equal(presetForHour(23), PRESETS.night);
  assert.equal(presetForHour(3), PRESETS.night);
  assert.equal(suggestPreset(new Date('2026-10-01T05:30:00Z'), 'Asia/Jerusalem').id, 'morning');  // 08:30 in Jerusalem
});

test('AdaptiveAmbientAudio never overrides a manual choice', () => {
  const evening = new Date('2026-10-01T17:00:00Z');   // 20:00 Jerusalem → the suggestion would be brown, low
  const none = resolveAmbientChoice(null, evening, 'Asia/Jerusalem');
  assert.equal(none.suggested, true);
  assert.equal(none.sound, 'brown');
  const manual = manualChoice(none, { sound: 'white' });
  for (const hour of [0, 6, 12, 18, 23]) {
    const at = new Date(Date.UTC(2026, 9, 1, hour));
    const choice = resolveAmbientChoice(manual, at, 'UTC');
    assert.equal(choice.sound, 'white');
    assert.equal(choice.suggested, false);
  }
  const silent = manualChoice(null, { sound: 'silence' });
  assert.equal(resolveAmbientChoice(silent, evening).sound, 'silence', 'choosing silence is a choice too');
  assert.equal(resolveAmbientChoice({ sound: 'white' }, evening, 'Asia/Jerusalem').suggested, true, 'only an explicit manual flag counts');
});
