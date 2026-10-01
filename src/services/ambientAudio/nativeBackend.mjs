// The native backend: the same sounds rendered natively (iOS AVAudioEngine + AVAudioSourceNode under an
// AVAudioSession of category .playback; Android AudioTrack), the recordings decoded to PCM and looped there too, so
// they go on with the screen locked, with the Lock Screen's Now Playing controls on iOS. At `stopAt` the native side fades out and stops by itself, so a locked phone
// still ends the sound on time. See docs/leatzmi/hitbodedut.md for the platform limits.

import { pitchHz } from './noise.mjs';
import { LOOP_FRAMES, RECORDINGS } from './recordings.mjs';

// A bundled recording, as the native side finds it: the web assets are copied into the app as "public/…" (the iOS
// bundle's public folder, Android's assets/public). The native side decodes the whole file to PCM once and loops the
// middle LOOP_FRAMES of it sample by sample (recordings.mjs explains the window) — never a file player's own looping,
// which would leave the AAC priming as a tiny gap at every turn.
export function nativeRecordingArgs(sound) {
  const recording = RECORDINGS[sound];
  return recording ? { file: `public/${recording.file}`, loopFrames: LOOP_FRAMES } : {};
}

export function createNativeAudioBackend(plugin) {
  const call = async (method, args) => {
    if (!plugin || typeof plugin[method] !== 'function') return null;
    return plugin[method](args);
  };
  return {
    backgroundCapable: true,
    kind: 'native',
    async start({ sound, volume, pitch, stopAt, title }) {
      const result = await call('audioStart', { sound, volume, hz: pitchHz(pitch), stopAt: stopAt || 0, title: title || 'התבודדות', ...nativeRecordingArgs(sound) });
      return result?.started !== false;
    },
    pause: () => call('audioPause'),
    resume: ({ stopAt } = {}) => call('audioResume', { stopAt: stopAt || 0 }),
    stop: ({ immediate = false } = {}) => call('audioStop', { immediate }),
    setVolume: volume => call('audioSetVolume', { volume }),
    chime: () => call('audioChime'),
  };
}
