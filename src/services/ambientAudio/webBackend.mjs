// The Web Audio backend (the browser, and the fallback in the app when the native plugin is missing): a generated loop
// (noise.mjs) or a bundled recording (recordings.mjs, fetched and decoded once) is played by an AudioBufferSourceNode
// with loop=true — sample-accurate, so the loop never has a gap — through one gain node that fades in and out gently.
// Cannot play with the screen locked on iOS — the engine pauses it on hide (backgroundCapable: false).

import { DEEP_TONE, LEVEL_TRIM, NOISE_IDS, pitchHz, renderDeepToneLoop, renderNoiseLoop, renderToneLoop } from './noise.mjs';
import { isRecording, loopWindow, recordingUrl } from './recordings.mjs';

export const FADE_IN_S = 2.5;
export const FADE_OUT_S = 1.2;

// A decoded recording, cut to its loop window (the decoder's priming and padding fall outside it).
export function loopBufferFromDecoded(ctx, decoded) {
  const { start, length } = loopWindow(decoded.length, decoded.sampleRate);
  const buffer = ctx.createBuffer(1, length, decoded.sampleRate);
  const out = buffer.getChannelData(0);
  const channels = decoded.numberOfChannels || 1;
  for (let c = 0; c < channels; c += 1) {
    const data = decoded.getChannelData(c).subarray(start, start + length);
    if (channels === 1) out.set(data);
    else for (let i = 0; i < length; i += 1) out[i] += data[i] / channels;
  }
  return buffer;
}

export function createWebAudioBackend({ AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext, fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  let ctx = null;
  let source = null;
  let gain = null;
  let volume = 0.4;
  let stopTimer = 0;
  let generation = 0;              // a newer start() supersedes one still loading its recording
  const cache = new Map();         // generated loops (small)
  const recordings = new Map();    // decoded recordings — the last two only (each is a few tens of MB as PCM)

  const ensure = () => {
    if (!AudioContextClass) return null;
    if (!ctx || ctx.state === 'closed') ctx = new AudioContextClass();
    return ctx;
  };
  const generatedLoop = ({ sound, pitch }) => {
    const key = `${sound}:${sound === 'tone' ? pitch : ''}:${ctx.sampleRate}`;
    if (!cache.has(key)) {
      let buffer;
      if (sound === 'deep') {
        const { left, right } = renderDeepToneLoop({ sampleRate: ctx.sampleRate, level: DEEP_TONE.level });
        buffer = ctx.createBuffer(2, left.length, ctx.sampleRate);
        buffer.getChannelData(0).set(left);
        buffer.getChannelData(1).set(right);
      } else {
        const samples = NOISE_IDS.includes(sound) ? renderNoiseLoop(sound, { sampleRate: ctx.sampleRate }) : renderToneLoop(pitchHz(pitch), { sampleRate: ctx.sampleRate });
        const trim = LEVEL_TRIM[sound] ?? 1;
        if (trim !== 1) for (let i = 0; i < samples.length; i += 1) samples[i] *= trim;
        buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        buffer.getChannelData(0).set(samples);
      }
      cache.set(key, buffer);
    }
    return cache.get(key);
  };
  const recordingLoop = async id => {
    const key = `${id}:${ctx.sampleRate}`;
    if (recordings.has(key)) return recordings.get(key);
    if (!fetchImpl) return null;
    const response = await fetchImpl(recordingUrl(id));
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    const decoded = await new Promise((resolve, reject) => {
      const promise = ctx.decodeAudioData(bytes, resolve, reject);   // the callback form also works on older Safari
      if (promise?.then) promise.then(resolve, reject);
    });
    const buffer = loopBufferFromDecoded(ctx, decoded);
    recordings.set(key, buffer);
    while (recordings.size > 2) recordings.delete(recordings.keys().next().value);
    return buffer;
  };
  const loopFor = async options => (isRecording(options.sound) ? recordingLoop(options.sound) : generatedLoop(options));
  const ramp = (to, seconds) => {
    if (!gain || !ctx) return;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + seconds);
  };
  const scheduleStop = stopAt => {
    clearTimeout(stopTimer);
    if (!stopAt) return;
    const delay = Number(stopAt) - Date.now() - FADE_OUT_S * 1000;
    stopTimer = setTimeout(() => { ramp(0, FADE_OUT_S); }, Math.max(0, delay));
  };
  const teardown = () => {
    clearTimeout(stopTimer);
    try { source?.stop(); } catch {}
    try { source?.disconnect(); gain?.disconnect(); } catch {}
    source = null; gain = null;
  };

  return {
    backgroundCapable: false,
    kind: 'web',
    // Called synchronously inside the tap that starts a session: browsers (Safari above all) only let sound start from
    // a user gesture, and the session's own start runs after a few awaits.
    prime() {
      const context = ensure();
      if (context && context.state === 'suspended') context.resume().catch(() => {});
    },
    async start(options) {
      const context = ensure();
      if (!context) return false;
      if (context.state === 'suspended') await context.resume().catch(() => {});
      const mine = ++generation;
      let buffer = null;
      try { buffer = await loopFor(options); } catch { buffer = null; }
      if (mine !== generation) return false;
      if (!buffer) return false;
      teardown();
      volume = options.volume;
      gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);
      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;           // loops the whole buffer, sample to sample — no gap at the seam
      source.connect(gain);
      source.start();
      ramp(volume, FADE_IN_S);
      scheduleStop(options.stopAt);
      return true;
    },
    async pause() {
      if (!ctx) return;
      ramp(0, 0.6);
      clearTimeout(stopTimer);
      await new Promise(resolve => setTimeout(resolve, 650));
      await ctx.suspend().catch(() => {});
    },
    async resume({ stopAt } = {}) {
      if (!ctx) return;
      await ctx.resume().catch(() => {});
      ramp(volume, 1.2);
      scheduleStop(stopAt);
    },
    async stop({ immediate = false } = {}) {
      generation += 1;
      if (!ctx) return;
      if (!immediate && gain) { ramp(0, FADE_OUT_S); await new Promise(resolve => setTimeout(resolve, FADE_OUT_S * 1000 + 50)); }
      teardown();
    },
    async setVolume(value) { volume = value; ramp(value, 0.3); },
    // A soft two-partial bell, once (the end of the time) — quiet and short.
    async chime() {
      const context = ensure();
      if (!context) return;
      if (context.state === 'suspended') await context.resume().catch(() => {});
      const now = context.currentTime;
      const out = context.createGain();
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(0.16, now + 0.02);
      out.gain.exponentialRampToValueAtTime(0.0001, now + 4);
      out.connect(context.destination);
      for (const [hz, level] of [[523.25, 1], [1046.5, 0.25]]) {
        const osc = context.createOscillator();
        const partial = context.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        partial.gain.value = level;
        osc.connect(partial).connect(out);
        osc.start(now);
        osc.stop(now + 4.1);
      }
    },
  };
}
