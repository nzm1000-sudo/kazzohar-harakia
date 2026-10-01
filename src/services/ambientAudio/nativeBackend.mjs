// The native backend: the same sounds rendered natively (iOS AVAudioEngine + AVAudioSourceNode under an
// AVAudioSession of category .playback; Android AudioTrack), so they go on with the screen locked, with the Lock
// Screen's Now Playing controls on iOS. At `stopAt` the native side fades out and stops by itself, so a locked phone
// still ends the sound on time. See docs/leatzmi/hitbodedut.md for the platform limits.

import { pitchHz } from './noise.mjs';

export function createNativeAudioBackend(plugin) {
  const call = async (method, args) => {
    if (!plugin || typeof plugin[method] !== 'function') return null;
    return plugin[method](args);
  };
  return {
    backgroundCapable: true,
    kind: 'native',
    async start({ sound, volume, pitch, stopAt, title }) {
      const result = await call('audioStart', { sound, volume, hz: pitchHz(pitch), stopAt: stopAt || 0, title: title || 'התבודדות' });
      return result?.started !== false;
    },
    pause: () => call('audioPause'),
    resume: ({ stopAt } = {}) => call('audioResume', { stopAt: stopAt || 0 }),
    stop: ({ immediate = false } = {}) => call('audioStop', { immediate }),
    setVolume: volume => call('audioSetVolume', { volume }),
    chime: () => call('audioChime'),
  };
}
