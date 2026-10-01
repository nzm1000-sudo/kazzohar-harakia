#!/usr/bin/env node
// The seam check of the bundled nature loops: decodes each public/audio/ambient/<id>.m4a the way the players will
// (several decoders), takes the loop window exactly as the app does (loopWindow in recordings.mjs), plays it twice in a
// row, and measures the boundary against the loop's own ordinary behaviour:
//   · the sample-level jump |x[N] − x[N−1]| — must lie within the 99.9th percentile of the loop's own sample steps;
//   · the RMS step between the 10 ms just before and just after the boundary — within the 99th percentile of the loop's
//     own adjacent 10 ms steps, and under 3 dB.
// Decoders: ffmpeg (honours the AAC priming in the file), ffmpeg ignoring the priming (as a decoder that does not trim
// it would), Apple's decoder (afconvert, as AVAudioFile on iOS), and ffmpeg resampled to 48 kHz (as Web Audio decodes
// into a 48 kHz context). Results are written to sources/audio/loop-check.json. Exit code 1 when any seam fails.
//
//   node scripts/audio/check-ambient-loops.mjs

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOOP_FRAMES, RECORDING_IDS, loopWindow } from '../../src/services/ambientAudio/recordings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kz-loopcheck-'));
const toFloat = buffer => new Float32Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 4)).slice();

const DECODERS = {
  'ffmpeg': file => ({ rate: 44100, samples: toFloat(execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 })) }),
  'ffmpeg, priming kept': file => ({ rate: 44100, samples: toFloat(execFileSync('ffmpeg', ['-v', 'error', '-ignore_editlist', '1', '-i', file, '-ac', '1', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 })) }),
  'Apple (afconvert)': file => {
    const wav = path.join(TMP, `${path.basename(file)}.wav`);
    execFileSync('afconvert', [file, '-o', wav, '-f', 'WAVE', '-d', 'LEF32']);
    const out = execFileSync('ffmpeg', ['-v', 'error', '-i', wav, '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
    return { rate: 44100, samples: toFloat(out) };
  },
  'ffmpeg → 48 kHz': file => ({ rate: 48000, samples: toFloat(execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-af', 'aresample=48000', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 })) }),
};

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const rms = (x, from, to) => { let e = 0; for (let i = from; i < to; i += 1) e += x[i] * x[i]; return Math.sqrt(e / Math.max(1, to - from)); };
const db = v => 20 * Math.log10(Math.max(1e-9, v));

// Measures the seam of `loop` played twice in a row.
export function seamMetrics(loop, rate) {
  const n = loop.length;
  const twice = new Float32Array(2 * n);
  twice.set(loop, 0); twice.set(loop, n);
  const steps = new Float32Array(n - 1);
  for (let i = 1; i < n; i += 1) steps[i - 1] = Math.abs(loop[i] - loop[i - 1]);
  const sortedSteps = Float32Array.from(steps).sort();
  const jump = Math.abs(twice[n] - twice[n - 1]);
  let below = 0; for (const s of sortedSteps) { if (s < jump) below += 1; else break; }
  // The level just before and just after the boundary, in 10 ms and 50 ms windows, against the loop's own steps
  // between adjacent windows of the same size everywhere else.
  const level = seconds => {
    const win = Math.round(rate * seconds);
    const all = [];
    for (let i = win; i + win <= n; i += win) all.push(Math.abs(db(rms(loop, i, i + win)) - db(rms(loop, i - win, i))));
    all.sort((a, b) => a - b);
    const step = Math.abs(db(rms(twice, n, n + win)) - db(rms(twice, n - win, n)));
    let lower = 0; for (const s of all) { if (s < step) lower += 1; else break; }
    return { step: +step.toFixed(2), percentile: +(100 * lower / all.length).toFixed(1), p99: +percentile(all, 0.99).toFixed(2), median: +percentile(all, 0.5).toFixed(2) };
  };
  const rms10 = level(0.01);
  const rms50 = level(0.05);
  const result = {
    frames: n,
    jump: +jump.toFixed(5),
    jumpPercentile: +(100 * below / sortedSteps.length).toFixed(2),
    stepP99_9: +percentile(sortedSteps, 0.999).toFixed(5),
    medianStep: +percentile(sortedSteps, 0.5).toFixed(5),
    rms10ms: rms10,
    rms50ms: rms50,
  };
  // Seamless = the boundary behaves like any ordinary moment of the loop: the sample jump within the loop's own 99.9th
  // percentile, and the level step within its own 99th percentile in both window sizes and under 2 dB at 50 ms.
  result.pass = jump <= result.stepP99_9 && rms10.step <= rms10.p99 && rms50.step <= rms50.p99 && rms50.step < 2;
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const report = { checked: new Date().toISOString().slice(0, 10), loopFrames44k: LOOP_FRAMES, method: 'loop window (recordings.mjs loopWindow) played twice; boundary jump vs the loop\'s own 99.9th-percentile sample step; 10 ms RMS step vs its own 99th percentile and < 3 dB', files: {} };
  let failed = 0;
  for (const id of RECORDING_IDS) {
    const file = path.join(ROOT, 'public/audio/ambient', `${id}.m4a`);
    report.files[id] = { bytes: fs.statSync(file).size, decoders: {} };
    for (const [name, decode] of Object.entries(DECODERS)) {
      const { rate, samples } = decode(file);
      const window = loopWindow(samples.length, rate);
      const loop = samples.subarray(window.start, window.start + window.length);
      const metrics = { decodedFrames: samples.length, windowStart: window.start, ...seamMetrics(loop, rate) };
      // For contrast: the same decode taken naively from its first sample (no window) — what a player that ignored
      // the priming and the margins would loop.
      if (name === 'ffmpeg, priming kept') {
        const naive = seamMetrics(samples.subarray(0, window.length), rate);
        metrics.naiveFromFirstSample = { jump: naive.jump, jumpPercentile: naive.jumpPercentile, rms50msStep: naive.rms50ms.step, pass: naive.pass };
      }
      report.files[id].decoders[name] = metrics;
      if (!metrics.pass) failed += 1;
      console.log(`${id.padEnd(9)} ${name.padEnd(22)} frames ${String(metrics.decodedFrames).padStart(8)} start ${String(window.start).padStart(6)}  jump ${metrics.jump.toFixed(5)} (p${metrics.jumpPercentile}, p99.9=${metrics.stepP99_9.toFixed(5)})  rms 10ms ${metrics.rms10ms.step} dB (p${metrics.rms10ms.percentile}) 50ms ${metrics.rms50ms.step} dB (p${metrics.rms50ms.percentile})  ${metrics.pass ? 'PASS' : 'FAIL'}${metrics.naiveFromFirstSample ? `   [naive: jump ${metrics.naiveFromFirstSample.jump} p${metrics.naiveFromFirstSample.jumpPercentile}, rms50 ${metrics.naiveFromFirstSample.rms50msStep} dB]` : ''}`);
    }
  }
  report.pass = failed === 0;
  fs.writeFileSync(path.join(ROOT, 'sources/audio/loop-check.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(failed ? `${failed} seam(s) failed` : 'all seams pass');
  process.exit(failed ? 1 : 0);
}
