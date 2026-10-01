// The Web Audio backend (the browser, and the fallback in the app when the native plugin is missing): the loop is
// rendered on the device (noise.mjs), played with loop=true through one gain node that fades in and out gently.
// Cannot play with the screen locked on iOS — the engine pauses it on hide (backgroundCapable: false).

import { NOISE_IDS, pitchHz, renderNoiseLoop, renderToneLoop } from './noise.mjs';

export const FADE_IN_S = 2.5;
export const FADE_OUT_S = 1.2;

export function createWebAudioBackend({ AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let ctx = null;
  let source = null;
  let gain = null;
  let volume = 0.4;
  let stopTimer = 0;
  const cache = new Map();

  const ensure = () => {
    if (!AudioContextClass) return null;
    if (!ctx || ctx.state === 'closed') ctx = new AudioContextClass();
    return ctx;
  };
  const loopFor = ({ sound, pitch }) => {
    const key = `${sound}:${sound === 'tone' ? pitch : ''}:${ctx.sampleRate}`;
    if (!cache.has(key)) {
      const samples = NOISE_IDS.includes(sound) ? renderNoiseLoop(sound, { sampleRate: ctx.sampleRate }) : renderToneLoop(pitchHz(pitch), { sampleRate: ctx.sampleRate });
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.getChannelData(0).set(samples);
      cache.set(key, buffer);
    }
    return cache.get(key);
  };
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
      teardown();
      volume = options.volume;
      gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);
      source = context.createBufferSource();
      source.buffer = loopFor(options);
      source.loop = true;
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
