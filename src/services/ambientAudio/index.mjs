// Background sound for התבודדות (and any future quiet screen): procedural noise / tone, a state machine, and the
// backend that fits the platform (native when the KZHitbodedut plugin is present — it plays with the screen locked —
// otherwise Web Audio).
import { createAmbientAudio } from './engine.mjs';
import { createNativeAudioBackend } from './nativeBackend.mjs';
import { createWebAudioBackend } from './webBackend.mjs';
import { nativeHitbodedut } from '../hitbodedut/nativePlugin.mjs';

export * from './noise.mjs';
export * from './presets.mjs';
export { createAmbientAudio, AUDIO_STATES } from './engine.mjs';
export { createWebAudioBackend } from './webBackend.mjs';
export { createNativeAudioBackend } from './nativeBackend.mjs';

let shared = null;
// One player for the app (a second screen never starts a second sound over the first).
export function ambientAudio() {
  if (!shared) {
    const plugin = nativeHitbodedut();
    shared = createAmbientAudio(plugin ? createNativeAudioBackend(plugin) : createWebAudioBackend());
  }
  return shared;
}
