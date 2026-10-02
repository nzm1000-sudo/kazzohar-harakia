// התבודדות, round two: the bundled nature loops (provenance, sizes, the loop window), צליל עמוק (two ears), the sound
// tiles, the Tehillim wheel (order, shuffle bag, pace), the double tap, and the gentle brightness climb at the end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { DEEP_TONE, LEVEL_TRIM, SOUNDS, SOUND_IDS, isAudible, renderDeepToneLoop, zeroCrossingHz } from '../src/services/ambientAudio/noise.mjs';
import { LOOP_FRAMES, MARGIN_FRAMES, RECORDINGS, RECORDING_IDS, loopWindow } from '../src/services/ambientAudio/recordings.mjs';
import { nativeRecordingArgs } from '../src/services/ambientAudio/nativeBackend.mjs';
import { createWebAudioBackend, loopBufferFromDecoded } from '../src/services/ambientAudio/webBackend.mjs';
import { createAmbientAudio } from '../src/services/ambientAudio/engine.mjs';
import { TEHILLIM_CHAPTERS, createShuffleBag, itemDurationMs, nextWheelChapter, shuffledChapters, wheelItems, WHEEL_SPEEDS, normalizeOrder } from '../src/services/hitbodedut/tehillimFlow.mjs';
import { createTapDetector, isTap, DOUBLE_TAP_MS } from '../src/services/hitbodedut/taps.mjs';
import { createBrightnessGuard, END_RAMP_MS } from '../src/services/hitbodedut/brightness.mjs';
import { createHitbodedutController, sessionOptions } from '../src/services/hitbodedut/session.mjs';
import { normalizePrefs } from '../src/services/hitbodedut/prefs.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const memoryStorage = () => { const map = new Map(); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), map }; };
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ── The recordings ──────────────────────────────────────────────────────────────────────────────────────────────────

test('provenance: every bundled recording is recorded with its source, creator, licence, date and processing', () => {
  const provenance = JSON.parse(read('sources/audio/provenance.json'));
  assert.equal(provenance.license.name, 'Pixabay Content License');
  assert.deepEqual(provenance.recordings.map(item => item.id).sort(), [...RECORDING_IDS].sort());
  for (const item of provenance.recordings) {
    assert.match(item.originalFile, /\.mp3$/);
    assert.ok(item.originalFile.startsWith(`${item.creator}-`), `${item.id}: the creator handle comes from the file name`);
    assert.equal(item.license, 'Pixabay Content License');
    assert.equal(item.retrieved, '2026-10-01');
    assert.equal(item.processing.segment.loopSeconds, 180, `${item.id}: a loop of three minutes`);
    assert.ok(item.processing.segment.crossfadeSeconds >= 4 && item.processing.segment.crossfadeSeconds <= 8);
    assert.equal(item.processing.encoding.channels, 1);
    assert.ok(item.processing.loudness.resultTruePeakDbfs <= -1, `${item.id}: true peak under −1 dBTP`);
  }
  // The deep tone's reference file is listed, but not bundled.
  assert.equal(provenance.notBundled[0].id, 'deep');
});

test('the bundled files exist, are small, and the seam check passed for every decoder', () => {
  let total = 0;
  for (const id of RECORDING_IDS) {
    const file = new URL(`public/${RECORDINGS[id].file}`, root);
    assert.ok(existsSync(file), id);
    const bytes = statSync(file).size;
    assert.ok(bytes > 500_000 && bytes <= 1_500_000, `${id}: ${bytes} bytes`);
    total += bytes;
  }
  assert.ok(total < 6_000_000, `all four: ${total} bytes`);
  const check = JSON.parse(read('sources/audio/loop-check.json'));
  assert.equal(check.pass, true);
  for (const id of RECORDING_IDS) for (const [decoder, result] of Object.entries(check.files[id].decoders)) assert.ok(result.pass, `${id} / ${decoder}`);
});

test('the loop window: the middle loop of a decoded file, whatever the decoder did with priming and padding', () => {
  const file = LOOP_FRAMES + 2 * MARGIN_FRAMES;
  assert.deepEqual(loopWindow(file), { start: MARGIN_FRAMES, length: LOOP_FRAMES });
  // A decoder that kept 2112 frames of priming and added 600 of padding: still inside the periodic part.
  const kept = loopWindow(file + 2112 + 600);
  assert.equal(kept.length, LOOP_FRAMES);
  assert.ok(kept.start >= 2112 && kept.start + kept.length <= 2112 + file);
  // Web Audio at 48 kHz: the same window, in 48 kHz frames.
  const web = loopWindow(Math.round(file * 48000 / 44100), 48000);
  assert.equal(web.length, Math.round(LOOP_FRAMES * 48000 / 44100));
  assert.equal(loopWindow(100).length, 100, 'a short buffer is used whole');
});

test('web backend: a recording is fetched, decoded once and looped sample-accurately (loop=true, no gap)', async () => {
  const sources = [];
  const decodedLength = LOOP_FRAMES + 2 * MARGIN_FRAMES;
  class Ctx {
    constructor() { this.sampleRate = 44100; this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createGain() { return { gain: { value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createBuffer(channels, length, rate) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: c => data[c] }; }
    createBufferSource() { const source = { connect() {}, disconnect() {}, start() { source.started = true; }, stop() {} }; sources.push(source); return source; }
    decodeAudioData(bytes) { const buffer = this.createBuffer(1, decodedLength, 44100); buffer.getChannelData(0).fill(0.25); return Promise.resolve(buffer); }
    resume() { return Promise.resolve(); }
  }
  let fetches = 0;
  const backend = createWebAudioBackend({ AudioContextClass: Ctx, fetchImpl: async url => { fetches += 1; assert.match(String(url), /audio\/ambient\/brook\.m4a$/); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; } });
  assert.equal(await backend.start({ sound: 'brook', volume: 0.4, pitch: 'mid' }), true);
  assert.equal(sources[0].loop, true);
  assert.equal(sources[0].buffer.length, Math.round(LOOP_FRAMES), 'the window is one loop long');
  await backend.start({ sound: 'brook', volume: 0.4, pitch: 'mid' });
  assert.equal(fetches, 1, 'decoded once');
  // צליל עמוק is stereo.
  await backend.start({ sound: 'deep', volume: 0.4, pitch: 'mid' });
  assert.equal(sources.at(-1).buffer.numberOfChannels, 2);
});

test('loopBufferFromDecoded mixes a stereo decode to mono and cuts the window', () => {
  const make = (channels, length) => { const data = Array.from({ length: channels }, (_, c) => Float32Array.from({ length }, (_, i) => (c ? -0.5 : 0.5) + i * 0)); return { numberOfChannels: channels, length, sampleRate: 44100, getChannelData: c => data[c] }; };
  const ctx = { createBuffer: (channels, length) => { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { numberOfChannels: channels, length, sampleRate: 44100, getChannelData: c => data[c] }; } };
  const out = loopBufferFromDecoded(ctx, make(2, 1000));
  assert.equal(out.length, 1000);
  assert.equal(out.getChannelData(0)[10], 0);
});

test('a later play() wins over one still loading its recording', async () => {
  let release;
  const backend = { log: [], async start(options) { this.log.push(options.sound); if (options.sound === 'rain') await new Promise(resolve => { release = resolve; }); return true; }, async stop() {}, async setVolume() {} };
  const audio = createAmbientAudio(backend);
  const slow = audio.play({ sound: 'rain' });
  await new Promise(resolve => setImmediate(resolve));
  await audio.play({ sound: 'white' });
  release();
  await slow;
  assert.equal(audio.state, 'playing');
  assert.equal(audio.current.sound, 'white');
});

test('native backend: recordings carry their bundled path and loop length', () => {
  assert.deepEqual(nativeRecordingArgs('rain'), { file: 'public/audio/ambient/rain.m4a', loopFrames: LOOP_FRAMES });
  assert.deepEqual(nativeRecordingArgs('white'), {});
  const swift = read('ios/App/App/KZHitbodedutPlugin.swift');
  assert.match(swift, /AVAudioFile\(forReading:/);
  assert.match(swift, /case "aquarium", "brook", "flow", "rain": return 6/);
  assert.doesNotMatch(swift, /numberOfLoops/, 'never a file player\'s own looping');
  const java = read('android/app/src/main/java/com/kzohaar/app/hitbodedut/KZAmbientSynth.java');
  assert.match(java, /MediaCodec\.createDecoderByType/);
  assert.match(java, /CHANNEL_OUT_STEREO/);
});

// ── צליל עמוק ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('צליל עמוק: 500 Hz in the left ear, 501.5 Hz in the right, gentle, an exact loop', () => {
  for (const sampleRate of [44100, 48000]) {
    const { left, right } = renderDeepToneLoop({ sampleRate });
    assert.equal(left.length, right.length);
    assert.ok(Math.abs(zeroCrossingHz(left, sampleRate) - 500) < 1, `left ${zeroCrossingHz(left, sampleRate)}`);
    assert.ok(Math.abs(zeroCrossingHz(right, sampleRate) - 501.5) < 1, `right ${zeroCrossingHz(right, sampleRate)}`);
    // The seam: the sample after the last is the first (a whole number of cycles in both ears).
    const nextLeft = Math.sin(2 * Math.PI * 1000 * left.length / left.length) * DEEP_TONE.level;
    assert.ok(Math.abs(nextLeft - left[0]) < 1e-6);
    assert.ok(Math.max(...left.map(Math.abs)) <= DEEP_TONE.level + 1e-6 && DEEP_TONE.level <= 0.15, 'a gentle level');
  }
  assert.equal(SOUNDS.deep.headphones, true);
  assert.match(SOUNDS.deep.title, /לאוזניות/);
  // The same pitches natively.
  assert.match(read('ios/App/App/KZHitbodedutPlugin.swift'), /500\.0[\s\S]*501\.5/);
  assert.match(read('android/app/src/main/java/com/kzohaar/app/hitbodedut/KZAmbientSynth.java'), /500\.0[\s\S]*501\.5/);
});

test('one loudness: the noises are trimmed to the recordings\' level (same numbers natively)', () => {
  assert.deepEqual({ ...LEVEL_TRIM }, { white: 0.55, pink: 0.84, brown: 0.94, tone: 1, deep: 1 });
  assert.match(read('ios/App/App/KZHitbodedutPlugin.swift'), /0\.277 \* 0\.55/);
  assert.match(read('android/app/src/main/java/com/kzohaar/app/hitbodedut/KZAmbientSynth.java'), /0\.277f \* 0\.55f/);
});

// ── The picker ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('picker: every sound is a tile with a fine-line sign and a short Hebrew name, in one 5 × 2 grid', () => {
  assert.equal(SOUND_IDS.length, 10);
  for (const id of SOUND_IDS) assert.ok(SOUNDS[id].short && /[֐-׿]/.test(SOUNDS[id].short) && SOUNDS[id].short.length <= 10, id);
  const page = read('src/pages/HitbodedutPage.jsx');
  assert.match(page, /className="hb-tiles" role="radiogroup"/);
  assert.match(page, /SOUND_IDS\.map\(id =>/);
  for (const id of SOUND_IDS) assert.match(page, new RegExp(`\\n  ${id}: \\(\\) =>`), `a sign for ${id}`);
  assert.match(page, /onClick=\{\(\) => pickSound\(id\)\}/, 'a tap previews');
  const css = read('src/styles/hitbodedut.css');
  assert.match(css, /\.hb-tiles\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  // Chosen by the app's one outline (ui.css › The selected state, Rule A) — never a fill, never a glow (Rule B).
  assert.doesNotMatch(css, /\.hb-tile\.is-on\{/, 'no page-local chosen look');
  assert.match(read('src/styles/ui.css'), /\.hb-tile\.is-on,[^{]*\)\{border-color:var\(--sel-line\);color:var\(--sel-ink\);box-shadow:none\}/);
  for (const id of SOUND_IDS.filter(isAudible)) assert.ok(isAudible(id));
});

// ── The Tehillim wheel ──────────────────────────────────────────────────────────────────────────────────────────────

test('wheel order: in order from the chosen chapter, wrapping after 150', () => {
  assert.equal(nextWheelChapter({ order: 'sequential', start: 23 }), 23);
  assert.equal(nextWheelChapter({ order: 'sequential', previous: 23 }), 24);
  assert.equal(nextWheelChapter({ order: 'sequential', previous: 150 }), 1);
  assert.equal(normalizeOrder('random'), 'random');
  assert.equal(normalizeOrder('anything'), 'sequential');
  assert.equal(normalizePrefs({ tehillimOrder: 'random' }).tehillimOrder, 'random');
  assert.equal(sessionOptions({ display: 'tehillim', order: 'random' }).order, 'random');
});

test('random order: a shuffle bag — every chapter once before any repeats, kept across sessions', () => {
  const storage = memoryStorage();
  const bag = createShuffleBag({ storage, random: seeded(7) });
  const first = Array.from({ length: TEHILLIM_CHAPTERS }, () => nextWheelChapter({ order: 'random', bag }));
  assert.equal(new Set(first).size, TEHILLIM_CHAPTERS, 'all 150, no repeats');
  assert.notDeepEqual(first.slice(0, 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'shuffled');
  // A new session (a new bag object over the same storage) continues the same bag.
  const half = createShuffleBag({ storage, random: seeded(9) });
  const a = half.draw();
  assert.equal(half.remaining, TEHILLIM_CHAPTERS - 1);
  const again = createShuffleBag({ storage, random: seeded(11) });
  const rest = Array.from({ length: TEHILLIM_CHAPTERS - 1 }, () => again.draw());
  assert.equal(new Set([a, ...rest]).size, TEHILLIM_CHAPTERS);
  // The refill never starts with the chapter just read.
  for (let seed = 1; seed < 40; seed += 1) assert.notEqual(shuffledChapters(seeded(seed), 5)[0], 5);
  // A broken record is replaced.
  storage.setItem('kz-hitbodedut-tehillim-bag-v1', '{oops');
  assert.ok(Number.isInteger(createShuffleBag({ storage }).draw()));
});

test('wheel items and pace: a title, then the verses; longer verses stay longer; five speeds', () => {
  const items = wheelItems(23, ['מִזְמוֹר לְדָוִד', 'יְהוָה רֹעִי לֹא אֶחְסָר']);
  assert.deepEqual(items.map(item => item.type), ['title', 'verse', 'verse']);
  assert.equal(items[2].last, true);
  assert.equal(new Set(items.map(item => item.key)).size, items.length);
  const short = { type: 'verse', text: 'א ב' };
  const long = { type: 'verse', text: 'א ב ג ד ה ו ז ח ט י' };
  assert.ok(itemDurationMs(long) > itemDurationMs(short));
  assert.ok(itemDurationMs(short, 0) > itemDurationMs(short, 4), 'slower at the low speed');
  assert.equal(WHEEL_SPEEDS.length, 5);
  assert.ok(itemDurationMs({ type: 'title' }) >= 2000, 'a quiet title between chapters');
});

test('wheel markup: centre verse, candle glow behind it, reduced motion without turning', () => {
  const page = read('src/pages/HitbodedutPage.jsx');
  assert.match(page, /className="hb-candle"/);
  assert.match(page, /prefersReducedMotion\(\)/);
  const css = read('src/styles/hitbodedut.css');
  assert.match(css, /@keyframes hb-candle\{/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{[^@]*\.hb-candle::before,\.hb-candle>span\{animation:none\}/);
  assert.match(css, /\.hb-wheel-item\.is-still\{[^}]*transform:none/);
});

// ── Touch ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('double tap lights the controls; a single tap does nothing (or, on the wheel, holds it after the window)', () => {
  const timers = [];
  const setTimer = (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length - 1; };
  const clearTimer = id => { if (timers[id]) timers[id].live = false; };
  let lit = 0, held = 0;
  const taps = createTapDetector({ onDouble: () => { lit += 1; }, setTimer, clearTimer });
  // A single tap on the background: nothing, ever.
  assert.equal(taps.tap({ x: 100, y: 100, t: 0 }), 'pending');
  assert.equal(timers.length, 0, 'no single action is even scheduled');
  // A second tap close and soon: a double.
  assert.equal(taps.tap({ x: 108, y: 104, t: 200 }), 'double');
  assert.equal(lit, 1);
  // Too late or too far: two singles.
  taps.tap({ x: 0, y: 0, t: 1000 });
  assert.equal(taps.tap({ x: 0, y: 0, t: 1000 + DOUBLE_TAP_MS + 1 }), 'pending');
  assert.equal(taps.tap({ x: 200, y: 200, t: 1000 + DOUBLE_TAP_MS + 50 }), 'pending');
  assert.equal(lit, 1);
  // On the wheel: a single tap holds once the window passed with no second tap; a double does not hold.
  taps.cancel();
  taps.tap({ x: 50, y: 50, t: 5000, single: () => { held += 1; } });
  timers.filter(timer => timer.live).forEach(timer => { timer.live = false; timer.fn(); });
  assert.equal(held, 1);
  taps.tap({ x: 50, y: 50, t: 9000, single: () => { held += 1; } });
  taps.tap({ x: 52, y: 50, t: 9100, single: () => { held += 1; } });
  timers.filter(timer => timer.live).forEach(timer => timer.fn());
  assert.equal(held, 1, 'the double cancelled the pending hold');
  assert.equal(lit, 2);
  // What counts as a tap.
  assert.equal(isTap({ x: 0, y: 0, t: 0 }, { x: 4, y: 3, t: 120 }), true);
  assert.equal(isTap({ x: 0, y: 0, t: 0 }, { x: 0, y: 60, t: 120 }), false, 'a swipe');
  assert.equal(isTap({ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 900 }), false, 'a hold');
});

test('the session page listens for the double tap, not for every touch', () => {
  const page = read('src/pages/HitbodedutPage.jsx');
  assert.match(page, /createTapDetector\(\{ onDouble: \(\) => show\(\) \}\)/);
  assert.doesNotMatch(page, /onPointerDown=\{wake\}/);
  assert.match(page, /setConfirm\(true\)/, 'the explicit end confirmation stays');
});

// ── The end ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('brightness climbs back gradually at the end (rampMs to the native side); instantly when hidden', async () => {
  const calls = [];
  const plugin = {
    async getBrightness() { return { brightness: 0.8 }; },
    async dim() { return {}; },
    async restore(args) { calls.push(args); return {}; },
    async setKeepAwake() {},
  };
  const storage = memoryStorage();
  const screen = createBrightnessGuard({ plugin, storage });
  const controller = createHitbodedutController({ screen, storage, clock: () => 1000 });
  await controller.start({ minutes: 15, display: 'timer', screenOn: true, dim: true, sound: 'silence' }, 1000);
  await controller.end('ended', 2000);
  assert.deepEqual(calls.at(-1), { original: 0.8, rampMs: END_RAMP_MS });
  assert.equal(END_RAMP_MS, 3000);
  // Hidden (the Lock button) and then ended from the Lock Screen: at once, no climb.
  await controller.start({ minutes: 15, display: 'timer', screenOn: true, dim: true, sound: 'silence' }, 3000);
  await controller.background();
  await controller.end('ended', 4000);
  assert.equal(calls.at(-1).rampMs, undefined);
  // Native: both platforms implement the climb.
  assert.match(read('ios/App/App/KZHitbodedutPlugin.swift'), /call\.getDouble\("rampMs"\)/);
  assert.match(read('android/app/src/main/java/com/kzohaar/app/hitbodedut/KZHitbodedutPlugin.java'), /call\.getDouble\("rampMs", 0\.0\)/);
});

test('the closing screen is lit: a gold glow rising over the same 3 s, and a softly gold-lit "חזרה"', () => {
  const page = read('src/pages/HitbodedutPage.jsx');
  assert.match(page, /'--hb-light-ms': `\$\{END_RAMP_MS\}ms`/);
  assert.match(page, /className="hb-summary-light"/);
  const css = read('src/styles/hitbodedut.css');
  assert.match(css, /\.hb-summary-close\{[^}]*box-shadow:[^}]*rgba\(222,180,104/);
  assert.match(css, /@keyframes hb-dawn/);
});

test('the candle breathes with the session: the ring\'s rhythm, in phase, a slow smooth sine — still under reduced motion', async () => {
  const { BREATH_MS, breathDelay } = await import('../src/services/hitbodedut/breath.mjs');
  assert.equal(BREATH_MS, 4400);
  // Whenever an element starts, its delay puts it on the one clock's phase: start + delay ≡ 0 (mod the breath).
  for (const now of [0, 1, 4399, 4400, 12345.6, 987654]) {
    const d = Number(breathDelay(now).replace('ms', ''));
    assert.ok(d <= 0 && d > -BREATH_MS, `${now}: ${d}`);
    assert.ok(Math.abs(((Math.round(now) + d) % BREATH_MS + BREATH_MS) % BREATH_MS) < 1 || Math.abs(((Math.round(now) + d) % BREATH_MS + BREATH_MS) % BREATH_MS - BREATH_MS) < 1, `${now} lands on the phase`);
  }
  assert.equal(breathDelay(NaN), '0ms');
  const css = read('src/styles/hitbodedut.css');
  const page = read('src/pages/HitbodedutPage.jsx');
  // One rhythm: the session's --hb-breath equals BREATH_MS; the ring and every layer of the candle run on it.
  assert.match(css, new RegExp(`\\.hb-session\\{[^}]*--hb-breath:${BREATH_MS}ms;`));
  assert.match(css, /\.hb-reveal-ring\{[^}]*animation:hb-ring-breathe var\(--hb-breath\) var\(--hb-breath-ease\) var\(--hb-breath-at,0ms\) infinite\}/);
  for (const [sel, name] of [['.hb-candle::after', 'hb-candle-aura'], ['.hb-candle::before', 'hb-candle'], ['.hb-candle>span', 'hb-candle-core']])
    assert.match(css, new RegExp(`${sel.replace(/[.>:]/g, m => `\\${m}`)}\\{animation:${name} var\\(--hb-breath,4400ms\\) var\\(--hb-breath-ease,ease-in-out\\) var\\(--hb-breath-at,0ms\\) infinite\\}`), `${sel} breathes`);
  // In phase: the candle and the ring take their delay from the one clock.
  assert.match(page, /const \[candleBreathAt\] = useState\(\(\) => breathDelay\(\)\)/);
  assert.match(page, /className="hb-candle" aria-hidden="true" style=\{\{ '--hb-breath-at': candleBreathAt \}\}/);
  assert.match(page, /const ringBreathAt = useMemo\(\(\) => breathDelay\(\), \[revealed\]\)/);
  assert.match(page, /className="hb-reveal-ring" aria-hidden="true" style=\{\{ '--hb-breath-at': ringBreathAt \}\}/);
  // No flicker: each breath is one smooth swell — two stops (rest at 0/100%, full at 50%), the light never below 70%,
  // the size within ±6%; nothing faster than the breath itself.
  for (const name of ['hb-candle', 'hb-candle-core', 'hb-candle-aura']) {
    const body = css.match(new RegExp(`@keyframes ${name}\\{((?:[^{}]*\\{[^}]*\\})*)\\}`))[1];
    const stops = [...body.matchAll(/([\d%,]+)\{([^}]*)\}/g)];
    assert.deepEqual(stops.map(m => m[1]), ['0%,100%', '50%'], `${name}: one smooth swell`);
    for (const [, , decl] of stops) {
      assert.ok(Number(decl.match(/opacity:([\d.]+)/)[1]) >= 0.7, `${name}: never dark`);
      const k = Number(decl.match(/scale\(([\d.]+)\)/)[1]);
      assert.ok(k >= 0.94 && k <= 1.06, `${name}: gentle`);
    }
  }
  assert.doesNotMatch(css, /hb-candle[^{]*\{[^}]*animation:[^;]*\b[0-3](?:\.\d+)?s\b/, 'no fast candle animation');
  // Reduced motion (the device's or נגישות's): every layer still.
  assert.match(css, /prefers-reduced-motion:reduce\)\{[^@]*\.hb-candle::after,\.hb-candle::before,\.hb-candle>span\{animation:none\}/);
  assert.match(css, /html\[data-a11y-motion="reduce"\] :is\([^)]*\.hb-candle>span[^)]*\)\{animation:none\}/);
  assert.match(css, /html\[data-a11y-motion="reduce"\] \.hb-candle::before,html\[data-a11y-motion="reduce"\] \.hb-candle::after\{animation:none\}/);
  assert.match(css, /html\[data-a11y-motion="reduce"\] \.hb-reveal-ring,html\[data-a11y-motion="reduce"\] \.hb-reveal-ring::after\{animation:none;opacity:1;transform:none\}/);
});

test('the durations in the clay design: the number 500 and its word 400 at the chip\'s size, four equal chips on one axis', () => {
  const clay = read('src/styles/clay/leatzmi.css');
  assert.match(clay, /:root\[data-clay\] \.hb-seg:not\(\.hb-seg-small\) \.hb-seg-num\{[^}]*font-size:20px;font-weight:500;/);
  assert.match(clay, /:root\[data-clay\] \.hb-seg:not\(\.hb-seg-small\)>button small\{font-size:14px;font-weight:400;/);
  assert.match(clay, /:root\[data-clay\] \.hb-seg:not\(\.hb-seg-small\)\{[^}]*margin-inline:auto\}/, 'centred');
  assert.match(read('src/styles/hitbodedut.css'), /\.hb-seg\{display:grid;grid-template-columns:repeat\(var\(--hb-parts,4\),minmax\(0,1fr\)\)/, 'equal widths');
  assert.match(read('src/pages/HitbodedutPage.jsx'), /className="hb-seg" role="radiogroup" aria-labelledby="hb-duration" style=\{\{ '--hb-parts': 4 \}\}/);
});
