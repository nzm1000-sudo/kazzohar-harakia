// Background sound, made on the device — zero downloads, works offline. Noise colours are shaped from white noise:
//   white — equal energy per frequency (a flat, airy hiss)
//   pink  — energy falls 3 dB per octave (Paul Kellet's refined filter bank): softer, like steady rain
//   brown — energy falls 6 dB per octave (leaky integration of white noise): deep, like a distant waterfall
//   tone  — one plain sine at a pitch the person chooses
// These are background sounds for focus and quiet only; nothing here claims any effect on body or mind.
//
// A loop is rendered once (a few seconds) and played round and round; its end is cross-faded into its start
// (equal power), so the seam cannot be heard. The same recipes are implemented natively (KZHitbodedutPlugin.swift,
// android …/hitbodedut/KZAmbientSynth.java) so the sound continues with the screen locked.

export const SOUNDS = Object.freeze({
  silence: { id: 'silence', title: 'שקט', line: 'בלי צליל' },
  white: { id: 'white', title: 'רעש לבן', line: 'אחיד ואוורירי' },
  pink: { id: 'pink', title: 'רעש ורוד', line: 'רך, כמו גשם' },
  brown: { id: 'brown', title: 'רעש חום', line: 'עמוק ושקט' },
  tone: { id: 'tone', title: 'צליל עדין', line: 'צליל אחד רך' },
});
export const SOUND_IDS = Object.freeze(Object.keys(SOUNDS));
export const NOISE_IDS = Object.freeze(['white', 'pink', 'brown']);

// Plain musical pitches — just notes that are pleasant to hear for a long time, with no claim attached.
export const TONE_PITCHES = Object.freeze([
  { id: 'low', title: 'נמוך', hz: 196.0 },     // G3
  { id: 'mid', title: 'בינוני', hz: 261.63 },  // C4
  { id: 'high', title: 'גבוה', hz: 329.63 },   // E4
]);
export const pitchHz = id => (TONE_PITCHES.find(pitch => pitch.id === id) || TONE_PITCHES[0]).hz;

export const isSound = id => Object.prototype.hasOwnProperty.call(SOUNDS, id);
export const isAudible = id => isSound(id) && id !== 'silence';

// A small deterministic generator (mulberry32), so a loop sounds the same every time and tests are repeatable.
export function seededRandom(seed = 0x6b7a) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// A stateful sample source for one noise colour: next() → one sample around [-1, 1].
export function noiseSource(kind, seed = 0x6b7a) {
  const random = seededRandom(seed);
  const white = () => random() * 2 - 1;
  if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    return () => {
      const w = white();
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
      return out * 0.11;
    };
  }
  if (kind === 'brown') {
    let last = 0;
    let dcIn = 0, dcOut = 0;
    return () => {
      last = (last + 0.02 * white()) / 1.02;
      // A gentle DC blocker keeps the slow wander centred (no thump, no offset), well below hearing.
      const x = last * 3.5;
      dcOut = x - dcIn + 0.9995 * dcOut;
      dcIn = x;
      return dcOut;
    };
  }
  return white;
}

// Scales the samples to one common loudness (RMS) with a safe peak, so switching colours never jumps in volume.
export const TARGET_RMS = 0.16;
export function normalize(samples, targetRms = TARGET_RMS, peak = 0.95) {
  let sum = 0;
  let max = 0;
  for (let i = 0; i < samples.length; i += 1) { sum += samples[i] * samples[i]; max = Math.max(max, Math.abs(samples[i])); }
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  if (!rms || !max) return samples;
  const gain = Math.min(targetRms / rms, peak / max);
  for (let i = 0; i < samples.length; i += 1) samples[i] *= gain;
  return samples;
}

// One seamless loop of noise: `seconds` long, the last `crossfadeSeconds` folded into the start with an equal-power
// cross-fade, so sample N−1 runs straight into sample 0.
export function renderNoiseLoop(kind, { sampleRate = 44100, seconds = 8, crossfadeSeconds = 0.5, seed = 0x6b7a } = {}) {
  const length = Math.max(1, Math.round(sampleRate * seconds));
  const fade = Math.min(Math.floor(length / 2), Math.max(1, Math.round(sampleRate * crossfadeSeconds)));
  const next = noiseSource(kind, seed);
  // Let the filters settle before the loop starts (no fade-in from a cold filter state).
  for (let i = 0; i < sampleRate / 2; i += 1) next();
  const raw = new Float32Array(length + fade);
  for (let i = 0; i < raw.length; i += 1) raw[i] = next();
  const loop = raw.slice(0, length);
  for (let i = 0; i < fade; i += 1) {
    const t = i / fade;
    loop[i] = raw[i] * Math.sin(t * Math.PI / 2) + raw[length + i] * Math.cos(t * Math.PI / 2);
  }
  return normalize(loop);
}

// One loop of the plain tone holding a whole number of cycles (so its seam is exact), at a calm level.
export const TONE_LEVEL = 0.18;
export function renderToneLoop(hz, { sampleRate = 44100, seconds = 2 } = {}) {
  const cycles = Math.max(1, Math.round(hz * seconds));
  const length = Math.round((cycles / hz) * sampleRate);
  const loop = new Float32Array(length);
  for (let i = 0; i < length; i += 1) loop[i] = Math.sin((2 * Math.PI * cycles * i) / length) * TONE_LEVEL;
  return loop;
}

// The gain of a gentle fade (an ease-in-out curve) at time t of a fade lasting `duration`.
export function fadeGain(t, duration) {
  if (duration <= 0 || t >= duration) return 1;
  if (t <= 0) return 0;
  const x = t / duration;
  return x * x * (3 - 2 * x);
}

// A rough "brightness" measure of a signal: the energy of its first difference against its own energy. White noise
// is ~2, pink well below, brown close to 0 — used by the tests to check the spectral shaping.
export function differenceEnergyRatio(samples) {
  let energy = 0;
  let diff = 0;
  for (let i = 1; i < samples.length; i += 1) { energy += samples[i] * samples[i]; const d = samples[i] - samples[i - 1]; diff += d * d; }
  return energy ? diff / energy : 0;
}
