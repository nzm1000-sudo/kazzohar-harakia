// Nature recordings for התבודדות — four short loops cut from free-to-use Pixabay recordings (provenance:
// sources/audio/provenance.json; processing: scripts/audio/build-ambient-loops.mjs; docs/leatzmi/hitbodedut.md).
// Bundled in the app (public/audio/ambient/<id>.m4a), so they play offline. Background sound only — no claims.
//
// Every file is one seamless loop of LOOP_SECONDS (its end was cross-faded into its start, equal power), with a short
// margin on each side that simply continues the loop: [last MARGIN of the loop][the loop][first MARGIN of the loop].
// An AAC decoder may or may not remove its "priming" silence at the start and its padding at the end, so a decoded
// file can be a few thousand samples longer than expected. Because the content is periodic, ANY window of exactly one
// loop length inside it is a perfect loop — so the players take the window in the middle (loopWindow below), which is
// clear of the priming and padding whichever decoder is used (Web Audio, AVAudioFile, Android MediaCodec, ffmpeg).

export const LOOP_SAMPLE_RATE = 44100;
export const LOOP_SECONDS = 180;
export const MARGIN_SECONDS = 0.5;
export const LOOP_FRAMES = LOOP_SAMPLE_RATE * LOOP_SECONDS;            // 7,938,000 frames at 44.1 kHz
export const MARGIN_FRAMES = Math.round(LOOP_SAMPLE_RATE * MARGIN_SECONDS);

export const RECORDINGS = Object.freeze({
  aquarium: { id: 'aquarium', title: 'אקווריום', short: 'אקווריום', line: 'מים ובועות שקטות', file: 'audio/ambient/aquarium.m4a' },
  brook: { id: 'brook', title: 'פלג נחל', short: 'פלג נחל', line: 'מים זורמים בין אבנים', file: 'audio/ambient/brook.m4a' },
  flow: { id: 'flow', title: 'זרימה שקטה', short: 'זרימה', line: 'זרם רך ואחיד', file: 'audio/ambient/flow.m4a' },
  rain: { id: 'rain', title: 'יום גשום וציפורים', short: 'גשם', line: 'גשם בעיר, וציפורים', file: 'audio/ambient/rain.m4a' },
});
export const RECORDING_IDS = Object.freeze(Object.keys(RECORDINGS));
export const isRecording = id => Object.prototype.hasOwnProperty.call(RECORDINGS, id);

// The loop inside a decoded file: { start, length } in frames of the decoded audio. `decodedFrames` is the decoded
// length and `rate` the decoded sample rate (Web Audio decodes to the context's rate, e.g. 48 kHz).
export function loopWindow(decodedFrames, rate = LOOP_SAMPLE_RATE) {
  const total = Math.max(0, Math.floor(Number(decodedFrames) || 0));
  const length = Math.round(LOOP_FRAMES * (Number(rate) || LOOP_SAMPLE_RATE) / LOOP_SAMPLE_RATE);
  if (total <= length) return { start: 0, length: total };
  return { start: Math.floor((total - length) / 2), length };
}

// The URL of a recording, relative to the page (the app's base in the browser, the bundle in the native shell).
export function recordingUrl(id, base = (typeof document !== 'undefined' ? document.baseURI : '')) {
  const recording = RECORDINGS[id];
  if (!recording) return null;
  try { return base ? new URL(recording.file, base).href : recording.file; } catch { return recording.file; }
}
