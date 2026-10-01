#!/usr/bin/env node
// Builds the bundled nature loops of התבודדות (public/audio/ambient/<id>.m4a) from the owner's Pixabay downloads.
//
//   node scripts/audio/build-ambient-loops.mjs [sourceDir=~/Downloads]
//
// Needs ffmpeg (decode, loudness measurement) and macOS afconvert (Apple's AAC encoder, which records the encoder
// priming in the file). For each recording:
//   1. decode to mono 44.1 kHz float ((L+R)/2 — the sources' channels are only loosely correlated room tone, and mono
//      halves the size);
//   2. choose the most even LOOP_SECONDS + CROSSFADE_SECONDS stretch of the file: 100 ms frames are scored for level
//      spread, one-off events (a frame well above the stretch's median, a sharp peak) and, above all, how alike the two
//      seam zones are (the loop's head and the stretch just after its end — they are mixed together);
//   3. set the loudness (EBU R128 integrated, ffmpeg ebur128) to TARGET_LUFS; a look-ahead peak limiter (here, in JS,
//      before the loop is folded, so its gain never jumps at the seam) holds samples under the ceiling;
//   4. fold the stretch's tail into its head with an equal-power cross-fade (sin/cos, CROSSFADE_SECONDS), so the last
//      sample of the loop runs straight into the first;
//   5. add the margins (recordings.mjs explains why) and encode AAC-LC mono in .m4a with afconvert.
// The loop check (scripts/audio/check-ambient-loops.mjs) then decodes the files and measures the seam.
// Writes sources/audio/provenance.json (merging the hand-written provenance fields with the measured results).

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOOP_FRAMES, LOOP_SAMPLE_RATE, MARGIN_FRAMES } from '../../src/services/ambientAudio/recordings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_DIR = process.argv[2] || path.join(os.homedir(), 'Downloads');
const OUT_DIR = path.join(ROOT, 'public/audio/ambient');
const PROVENANCE = path.join(ROOT, 'sources/audio/provenance.json');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kz-ambient-'));

export const TARGET_LUFS = -18;          // the procedural pink / brown / tone sit at about −16.5 … −18.7 LUFS (measured)
export const CEILING_DBFS = -2;          // sample peak ceiling (true peak stays under −1 dBTP)
export const CROSSFADE_SECONDS = 6;
export const BITRATE = 60000;
export const MAX_LIMIT_DB = 14;         // the limiter may take at most this much off a peak; a sparser sound sits lower instead
export const TRUE_PEAK_MAX = -1;         // dBTP
const RATE = LOOP_SAMPLE_RATE;

export const SOURCES = {
  aquarium: 'joelfazhari-aquarium-ambience-sounds-10-min-193236.mp3',
  brook: 'restfuldreamingtunes-sounds-of-nature-the-gentle-murmur-of-the-brook-276298.mp3',
  flow: 'universfield-tranquil-flow-387676.mp3',
  rain: 'whitenoisesleepers-rainy-day-in-town-with-birds-singing-194011.mp3',
};

const db = x => 20 * Math.log10(Math.max(1e-9, x));

function decodeMono(file) {
  const out = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-af', 'pan=mono|c0=0.5*c0+0.5*c1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(out.buffer, out.byteOffset, out.byteLength / 4).slice();
}

function parseLoudness(stderr) {
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  const integrated = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]);
  const lra = Number(/LRA:\s+(-?[\d.]+) LU/.exec(summary)?.[1]);
  const truePeak = Number(/Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary)?.[1]);
  return { integrated, lra, truePeak };
}
// ffmpeg prints the summary to stderr.
function loudness(samples) {
  const input = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', '-', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { input, maxBuffer: 1 << 30 });
  return parseLoudness(String(result.stderr));
}

// 100 ms frames: RMS (dB), peak (dB) and brightness (first-difference energy against energy, dB).
function frames(samples, size = RATE / 10) {
  const count = Math.floor(samples.length / size);
  const rms = new Float64Array(count), peak = new Float64Array(count), bright = new Float64Array(count);
  for (let f = 0; f < count; f += 1) {
    let e = 0, d = 0, p = 0;
    for (let i = f * size; i < (f + 1) * size; i += 1) {
      const x = samples[i];
      e += x * x; p = Math.max(p, Math.abs(x));
      if (i > 0) { const dx = x - samples[i - 1]; d += dx * dx; }
    }
    rms[f] = db(Math.sqrt(e / size)); peak[f] = db(p); bright[f] = 10 * Math.log10(Math.max(1e-12, d) / Math.max(1e-12, e));
  }
  return { rms, peak, bright, size };
}
const mean = (a, from, to) => { let s = 0; for (let i = from; i < to; i += 1) s += a[i]; return s / Math.max(1, to - from); };
function median(a, from, to) { const s = Array.from(a.slice(from, to)).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }

// The start (in samples) of the most even stretch, and its score parts.
function chooseStretch(samples) {
  const fr = frames(samples);
  const perSecond = RATE / fr.size;
  const loopF = Math.round((LOOP_FRAMES / RATE) * perSecond);
  const fadeF = Math.round(CROSSFADE_SECONDS * perSecond);
  const span = loopF + fadeF;
  const edge = Math.round(15 * perSecond);                     // keep clear of the file's own fade in / out
  let best = null;
  for (let s = edge; s + span < fr.rms.length - edge; s += Math.round(perSecond / 2)) {
    const med = median(fr.rms, s, s + span);
    let spread = 0, events = 0;
    for (let f = s; f < s + span; f += 1) {
      spread += (fr.rms[f] - med) ** 2;
      if (fr.rms[f] > med + 6 || fr.peak[f] > med + 22) events += 1;
    }
    spread = Math.sqrt(spread / span);
    // The two seam zones: the loop's head [s, s+fade) and the stretch after its end [s+loop, s+loop+fade).
    const headLevel = mean(fr.rms, s, s + fadeF), tailLevel = mean(fr.rms, s + loopF, s + span);
    const headBright = mean(fr.bright, s, s + fadeF), tailBright = mean(fr.bright, s + loopF, s + span);
    let seamEvents = 0, seamSpread = 0;
    for (const z of [s, s + loopF]) for (let f = z; f < z + fadeF; f += 1) {
      if (fr.rms[f] > med + 4 || fr.peak[f] > med + 18) seamEvents += 1;
      seamSpread = Math.max(seamSpread, Math.abs(fr.rms[f] - med));
    }
    // Just around the seam (the last seconds of the loop and the first after the fade) should also be calm.
    let nearEvents = 0;
    for (let f = Math.max(s, s + loopF - fadeF); f < s + loopF; f += 1) if (fr.rms[f] > med + 6) nearEvents += 1;
    for (let f = s + fadeF; f < s + 2 * fadeF; f += 1) if (fr.rms[f] > med + 6) nearEvents += 1;
    const peakAbove = Math.max(...fr.peak.slice(s, s + span)) - med;
    const score = 6 * Math.abs(headLevel - tailLevel) + 6 * Math.abs(headBright - tailBright) + 3 * seamEvents + 0.6 * seamSpread
      + 1.5 * nearEvents + 0.08 * events + 0.8 * spread + 0.05 * Math.max(0, peakAbove - 18);
    if (!best || score < best.score) best = { start: s * fr.size, score, spread, events, seamEvents, seamLevelDiff: headLevel - tailLevel, seamBrightDiff: headBright - tailBright, peakAbove };
  }
  return { ...best, ...settleSeam(samples, best.start) };
}

// The seam itself (stretch sample N → N+1, which the fold keeps exactly as recorded) is moved, within ±1 s, to the
// calmest instant around it: where the level just before and just after differ least (10 ms and 50 ms windows), so a
// drop or a chirp never begins exactly at the boundary.
function settleSeam(samples, start) {
  const level = (from, to) => { let e = 0; for (let i = from; i < to; i += 1) e += samples[i] * samples[i]; return db(Math.sqrt(e / (to - from))); };
  const w10 = Math.round(RATE * 0.01), w50 = Math.round(RATE * 0.05);
  let best = { start, cost: Infinity };
  for (let shift = -RATE; shift <= RATE; shift += Math.round(RATE * 0.005)) {
    const b = start + shift + LOOP_FRAMES;
    if (start + shift < RATE || b + RATE > samples.length) continue;
    const s10 = Math.abs(level(b, b + w10) - level(b - w10, b));
    const s50 = Math.abs(level(b, b + w50) - level(b - w50, b));
    const s200 = Math.abs(level(b, b + 4 * w50) - level(b - 4 * w50, b));
    const cost = s50 + 0.5 * s10 + 0.5 * s200 + Math.abs(shift) / RATE * 0.2;
    if (cost < best.cost) best = { start: start + shift, cost, seamStep10Db: s10, seamStep50Db: s50 };
  }
  return { start: best.start, seamShiftMs: Math.round(((best.start - start) / RATE) * 1000), seamStep10Db: +best.seamStep10Db.toFixed(2), seamStep50Db: +best.seamStep50Db.toFixed(2) };
}

// A look-ahead peak limiter: the gain each sample needs, its minimum over ±window, smoothed by a moving average of the
// same window (so it is never above what any nearby sample needs), with a slow release.
export function limit(samples, ceiling, { lookahead = Math.round(RATE * 0.005), release = Math.round(RATE * 0.12) } = {}) {
  const n = samples.length;
  const need = new Float32Array(n);
  let limited = 0;
  for (let i = 0; i < n; i += 1) { const a = Math.abs(samples[i]); need[i] = a > ceiling ? ceiling / a : 1; if (a > ceiling) limited += 1; }
  if (!limited) return { samples, limited: 0, maxReductionDb: 0 };
  const w = lookahead;
  const minimum = new Float32Array(n);
  const deque = [];
  for (let i = 0; i < n + w; i += 1) {                       // sliding min of need over [i-2w, i]; stored at i-w (centred)
    if (i < n) { while (deque.length && need[deque[deque.length - 1]] >= need[i]) deque.pop(); deque.push(i); }
    while (deque.length && deque[0] < i - 2 * w) deque.shift();
    if (i - w >= 0 && i - w < n) minimum[i - w] = need[deque[0]];
  }
  const smooth = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n + w; i += 1) {                        // centred moving average over w+1 samples
    if (i < n) acc += minimum[i];
    if (i - w - 1 >= 0) acc -= minimum[i - w - 1];
    const c = i - Math.floor(w / 2);
    if (c >= 0 && c < n) smooth[c] = acc / Math.min(w + 1, i + 1);
  }
  const out = new Float32Array(n);
  const step = 1 / release;
  let g = 1, maxReduction = 1;
  for (let i = 0; i < n; i += 1) {
    g = Math.min(smooth[i], g + (1 - g) * step * 4);
    g = Math.min(g, need[i]);
    maxReduction = Math.min(maxReduction, g);
    out[i] = samples[i] * g;
  }
  return { samples: out, limited, maxReductionDb: db(maxReduction) };
}

// Equal-power fold: loop[i] = head·sin + after-end·cos over the fade, so loop[N−1] → loop[0] is continuous.
export function foldLoop(stretch, loopFrames, fadeFrames) {
  const loop = stretch.slice(0, loopFrames);
  for (let i = 0; i < fadeFrames; i += 1) {
    const t = (i + 0.5) / fadeFrames;
    loop[i] = stretch[i] * Math.sin(t * Math.PI / 2) + stretch[loopFrames + i] * Math.cos(t * Math.PI / 2);
  }
  return loop;
}

function writeWav(file, samples, rate = RATE) {
  const b = Buffer.alloc(44 + samples.length * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 4, 28);
  b.writeUInt16LE(4, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 4, 40);
  Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength).copy(b, 44);
  fs.writeFileSync(file, b);
}
const clock = seconds => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;

function build(id) {
  const name = SOURCES[id];
  const source = path.join(SOURCE_DIR, name);
  const all = decodeMono(source);
  const choice = chooseStretch(all);
  const fade = Math.round(CROSSFADE_SECONDS * RATE);
  const preroll = Math.round(RATE * 0.5);
  const raw = all.slice(choice.start - preroll, choice.start + LOOP_FRAMES + fade + preroll);
  const before = loudness(raw.slice(preroll, preroll + LOOP_FRAMES + fade));
  let gain = 10 ** ((TARGET_LUFS - before.integrated) / 20);
  const ceiling = 10 ** (CEILING_DBFS / 20);
  // A sound whose peaks stand far above its body (the brook's drops) is not squeezed: it is raised only as far as the
  // limiter can follow gently, and sits a little lower than the target.
  let rawPeak = 0; for (let i = preroll; i < raw.length - preroll; i += 1) rawPeak = Math.max(rawPeak, Math.abs(raw[i]));
  const maxGain = (ceiling * 10 ** (MAX_LIMIT_DB / 20)) / rawPeak;
  const cappedBy = gain > maxGain ? 'limiter cap' : null;
  gain = Math.min(gain, maxGain);
  const gained = raw.map(x => x * gain);
  const limited = limit(gained, ceiling);
  const stretch = limited.samples.slice(preroll, preroll + LOOP_FRAMES + fade);
  let loop = foldLoop(stretch, LOOP_FRAMES, fade);
  // A last static trim to the target (the limiter and the fold move the level a little), never above the ceiling.
  let measured = loudness(loop);
  let trim = 10 ** ((TARGET_LUFS - measured.integrated) / 20);
  let peak = 0; for (const x of loop) peak = Math.max(peak, Math.abs(x));
  trim = Math.min(trim, ceiling / peak, cappedBy ? 1 : Infinity);
  if (Math.abs(db(trim)) > 0.01) { loop = loop.map(x => x * trim); measured = loudness(loop); gain *= trim; }
  if (measured.truePeak > TRUE_PEAK_MAX) {
    const down = 10 ** ((TRUE_PEAK_MAX - 0.1 - measured.truePeak) / 20);
    loop = loop.map(x => x * down); measured = loudness(loop); gain *= down;
  }
  peak = 0; for (const x of loop) peak = Math.max(peak, Math.abs(x));
  const file = new Float32Array(LOOP_FRAMES + 2 * MARGIN_FRAMES);
  file.set(loop.subarray(LOOP_FRAMES - MARGIN_FRAMES), 0);
  file.set(loop, MARGIN_FRAMES);
  file.set(loop.subarray(0, MARGIN_FRAMES), MARGIN_FRAMES + LOOP_FRAMES);
  const wav = path.join(TMP, `${id}.wav`);
  writeWav(wav, file);
  fs.writeFileSync(path.join(TMP, `${id}.loop.f32`), Buffer.from(loop.buffer));   // for the check's "before encoding" pass
  const out = path.join(OUT_DIR, `${id}.m4a`);
  execFileSync('afconvert', [wav, '-o', out, '-f', 'm4af', '-d', 'aac', '-b', String(BITRATE), '-s', '1', '-q', '127']);
  const bytes = fs.statSync(out).size;
  const sha256 = createHash('sha256').update(fs.readFileSync(out)).digest('hex');
  const startSeconds = choice.start / RATE;
  return {
    id,
    segment: { from: clock(startSeconds), to: clock(startSeconds + LOOP_FRAMES / RATE + CROSSFADE_SECONDS), loopSeconds: LOOP_FRAMES / RATE, crossfadeSeconds: CROSSFADE_SECONDS, startSample: choice.start },
    selection: { score: +choice.score.toFixed(3), levelSpreadDb: +choice.spread.toFixed(2), events: choice.events, seamEvents: choice.seamEvents, seamLevelDiffDb: +choice.seamLevelDiff.toFixed(2), seamBrightnessDiffDb: +choice.seamBrightDiff.toFixed(2), seamShiftMs: choice.seamShiftMs, recordedStepAtSeam10msDb: choice.seamStep10Db, recordedStepAtSeam50msDb: choice.seamStep50Db },
    loudness: { targetLufs: TARGET_LUFS, belowTargetBecause: cappedBy ? `peaks ${(db(rawPeak) - before.integrated).toFixed(1)} dB above the loudness; limiter capped at ${MAX_LIMIT_DB} dB` : null, sourceStretchLufs: before.integrated, gainDb: +db(gain).toFixed(2), limiterSamples: limited.limited, limiterMaxReductionDb: +limited.maxReductionDb.toFixed(2), resultLufs: measured.integrated, resultLra: measured.lra, resultTruePeakDbfs: measured.truePeak, samplePeakDbfs: +db(peak).toFixed(2) },
    encoding: { codec: 'AAC-LC (Apple afconvert)', container: 'MPEG-4 audio (.m4a)', channels: 1, sampleRate: RATE, bitrate: BITRATE, marginSeconds: MARGIN_FRAMES / RATE, fileSeconds: file.length / RATE },
    output: `public/audio/ambient/${id}.m4a`,
    bytes,
    sha256,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const provenance = JSON.parse(fs.readFileSync(PROVENANCE, 'utf8'));
  for (const id of Object.keys(SOURCES)) {
    const result = build(id);
    const entry = provenance.recordings.find(item => item.id === id);
    entry.processing = { ...entry.processing, ...result };
    console.log(id, JSON.stringify({ segment: result.segment, loudness: result.loudness, bytes: result.bytes }));
  }
  provenance.processedWith = { ffmpeg: execFileSync('ffmpeg', ['-version']).toString().split('\n')[0], afconvert: 'macOS afconvert', script: 'scripts/audio/build-ambient-loops.mjs', targetLufs: TARGET_LUFS, ceilingDbfs: CEILING_DBFS };
  fs.writeFileSync(PROVENANCE, `${JSON.stringify(provenance, null, 2)}\n`);
  console.log('tmp', TMP);
}
