// The background-sound state machine, over a backend (the Web Audio one in the browser, the native one in the app —
// see webBackend.mjs / nativeBackend.mjs). Pure; tested with a mock backend (tests/hitbodedutAudio.test.mjs).
//
//   idle ──play──▶ playing ──pause──▶ paused ──resume──▶ playing
//     ▲               │  ▲                                  │
//     └──── stop ─────┘  └── foreground ── interrupted ◀── background (a backend that cannot play in the background)
//
// A backend that plays in the background (the native one: AVAudioEngine with the 'audio' background mode on iOS,
// AudioTrack on Android) keeps playing when the app is hidden; the Web Audio one is paused on hide and resumed on show,
// since the system stops it anyway. Remote changes (the Lock Screen's play/pause, an interruption such as a call) come
// back through remote(), so the screen always says what is really happening.

import { isAudible, isSound } from './noise.mjs';

export const AUDIO_STATES = Object.freeze(['idle', 'playing', 'paused', 'interrupted']);

export function createAmbientAudio(backend) {
  let state = 'idle';
  let current = null;            // { sound, volume, pitch, stopAt }
  let playToken = 0;
  const listeners = new Set();
  const emit = () => { for (const listener of listeners) { try { listener(state, current); } catch {} } };
  const set = next => { if (next !== state) { state = next; emit(); } };
  const safe = async (method, ...args) => {
    if (!backend || typeof backend[method] !== 'function') return null;
    try { return await backend[method](...args); } catch { return null; }
  };

  return {
    get state() { return state; },
    get current() { return current ? { ...current } : null; },
    get backgroundCapable() { return Boolean(backend?.backgroundCapable); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },

    // Starts (or switches to) a sound; silence stops whatever plays.
    async play({ sound, volume = 0.4, pitch = 'mid', stopAt = null, title = '' } = {}) {
      if (!isSound(sound) || !isAudible(sound)) { await this.stop(); return state; }
      const vol = Math.min(1, Math.max(0, Number(volume) || 0));
      if (current && state !== 'idle' && current.sound === sound && current.pitch === pitch) {
        current = { ...current, volume: vol, stopAt };
        await safe('setVolume', vol);
        if (state !== 'playing') return this.resume();
        return state;
      }
      if (state !== 'idle') await safe('stop', { immediate: true });
      const token = ++playToken;
      current = { sound, volume: vol, pitch, stopAt, title };
      const started = await safe('start', current);
      // A recording may take a moment to load; a later play() (a quick change of tile) or stop() wins.
      if (token !== playToken) return state;
      if (started === false || started === null) { current = null; set('idle'); return state; }
      set('playing');
      return state;
    },

    async pause() {
      if (state !== 'playing' && state !== 'interrupted') return state;
      if (state === 'playing') await safe('pause');
      set('paused');
      return state;
    },

    async resume({ stopAt } = {}) {
      if (!current || (state !== 'paused' && state !== 'interrupted')) return state;
      if (stopAt !== undefined) current = { ...current, stopAt };
      await safe('resume', { stopAt: current.stopAt });
      set('playing');
      return state;
    },

    async stop({ immediate = false } = {}) {
      playToken += 1;
      if (state === 'idle' && !current) return state;
      await safe('stop', { immediate });
      current = null;
      set('idle');
      return state;
    },

    async setVolume(volume) {
      if (!current) return;
      current = { ...current, volume: Math.min(1, Math.max(0, Number(volume) || 0)) };
      await safe('setVolume', current.volume);
    },

    async chime() { await safe('chime'); },

    // Unlocks the sound inside the tap itself (Web Audio); a no-op for the native backend.
    prime() { try { backend?.prime?.(); } catch {} },

    // The app was hidden / shown.
    async background() {
      if (state !== 'playing' || backend?.backgroundCapable) return state;
      await safe('pause');
      set('interrupted');
      return state;
    },
    async foreground() {
      if (state !== 'interrupted') return state;
      await safe('resume', { stopAt: current?.stopAt ?? null });
      set('playing');
      return state;
    },

    // A change made outside the app (Lock Screen controls, an interruption, the native stop at the end time).
    remote(action) {
      if (action === 'pause' && state === 'playing') set('paused');
      else if (action === 'play' && (state === 'paused' || state === 'interrupted') && current) set('playing');
      else if (action === 'interrupted' && state === 'playing') set('interrupted');
      else if ((action === 'stop' || action === 'ended') && state !== 'idle') { current = null; set('idle'); }
      return state;
    },
  };
}
