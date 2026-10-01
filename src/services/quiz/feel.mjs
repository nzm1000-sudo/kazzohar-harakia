// שעשועון טריוויה יהודי — the optional senses of the game. Sounds are off by default (the quiz's own switch) and are
// generated on the device with Web Audio — no files: a soft tick while the answer is weighed, a gentle chime for a right
// answer, a low quiet tone for a miss. A light haptic follows the app's own setting (נגישות › משוב מישושי).
import { hapticsAllowed } from '../accessibility/preferences.mjs';

let ctx = null;
function audio() {
  try {
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

// One soft partial: a quick rise and a long exponential fall (no clicks).
function partial(ac, freq, { at = 0, dur = 0.5, gain = 0.03, type = 'sine' } = {}) {
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const SOUNDS = {
  tick: ac => partial(ac, 1480, { dur: 0.07, gain: 0.014 }),
  chime: ac => { [784, 1175, 1568].forEach((f, i) => partial(ac, f, { at: i * 0.085, dur: 1.5 - i * 0.2, gain: 0.03 - i * 0.006 })); partial(ac, 2352, { at: 0.17, dur: 0.9, gain: 0.006 }); },
  low: ac => { partial(ac, 294, { dur: 0.9, gain: 0.022 }); partial(ac, 220, { at: 0.12, dur: 1.1, gain: 0.016 }); },
  rise: ac => { [523, 659, 784, 1047].forEach((f, i) => partial(ac, f, { at: i * 0.13, dur: 1.6, gain: 0.022 })); },
};

export function playSound(name, enabled) {
  if (!enabled) return false;
  const ac = audio();
  if (!ac || !SOUNDS[name]) return false;
  try { SOUNDS[name](ac); return true; } catch { return false; }
}

// A light tap on iOS / Android (the native bridge the app already uses); nothing on the web. Silent when haptics are off.
export function lightHaptic() {
  try {
    if (!hapticsAllowed()) return;
    if (globalThis.window?.KZHeading?.haptic) globalThis.window.KZHeading.haptic();
    else globalThis.window?.webkit?.messageHandlers?.kzHeading?.postMessage({ action: 'haptic' });
  } catch { /* no haptics here */ }
}

// Reduced motion — the system's preference or the app's own (html[data-a11y-motion]): no animation, no suspense delay.
export function motionReduced() {
  try {
    if (globalThis.document?.documentElement?.hasAttribute('data-a11y-motion')) return true;
    return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch { return false; }
}
