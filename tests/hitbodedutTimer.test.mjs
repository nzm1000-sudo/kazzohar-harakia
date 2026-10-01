import test from 'node:test';
import assert from 'node:assert/strict';
import { clampMinutes, elapsedMs, endTimer, formatClock, isPaused, isRunning, isTimeUp, minutesInWords, pauseTimer, progress, remainingInWords, remainingMs, resumeTimer, startTimer, stepMinutes, PRESET_MINUTES } from '../src/services/hitbodedut/timer.mjs';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 1, 18, 0, 0);

test('presets are 15 / 30 / 60 minutes', () => {
  assert.deepEqual([...PRESET_MINUTES], [15, 30, 60]);
  for (const minutes of PRESET_MINUTES) assert.equal(startTimer(minutes, T0).durationMs, minutes * MIN);
});

test('start → running, remaining counts down on the wall clock', () => {
  const timer = startTimer(15, T0);
  assert.ok(isRunning(timer));
  assert.equal(remainingMs(timer, T0), 15 * MIN);
  assert.equal(remainingMs(timer, T0 + 5 * MIN), 10 * MIN);
  assert.equal(elapsedMs(timer, T0 + 5 * MIN), 5 * MIN);
  assert.equal(progress(timer, T0 + 7.5 * MIN), 0.5);
  assert.equal(isTimeUp(timer, T0 + 15 * MIN - 1), false);
  assert.equal(isTimeUp(timer, T0 + 15 * MIN), true);
  assert.equal(remainingMs(timer, T0 + 99 * MIN), 0);
});

test('pause freezes the remaining time; resume moves the end by the pause', () => {
  let timer = startTimer(30, T0);
  timer = pauseTimer(timer, T0 + 10 * MIN);
  assert.ok(isPaused(timer));
  assert.equal(remainingMs(timer, T0 + 10 * MIN), 20 * MIN);
  assert.equal(remainingMs(timer, T0 + 50 * MIN), 20 * MIN, 'frozen while paused');
  assert.equal(isTimeUp(timer, T0 + 99 * MIN), false, 'never time-up while paused');
  assert.equal(pauseTimer(timer, T0 + 11 * MIN), timer, 'a second pause changes nothing');
  timer = resumeTimer(timer, T0 + 15 * MIN);
  assert.ok(isRunning(timer));
  assert.equal(timer.endsAt, T0 + 35 * MIN);
  assert.equal(timer.pausedTotalMs, 5 * MIN);
  assert.equal(remainingMs(timer, T0 + 15 * MIN), 20 * MIN);
  assert.equal(resumeTimer(timer, T0 + 16 * MIN), timer, 'resume of a running timer changes nothing');
});

test('an action stamped before the pause (Lock Screen) never goes back in time', () => {
  let timer = pauseTimer(startTimer(15, T0), T0 + 5 * MIN);
  timer = resumeTimer(timer, T0 + 4 * MIN);
  assert.equal(timer.endsAt, T0 + 15 * MIN);
});

test('end: by choice → ended; after the time → completed at the end instant', () => {
  const chosen = endTimer(startTimer(15, T0), T0 + 3 * MIN);
  assert.equal(chosen.endReason, 'ended');
  assert.equal(remainingMs(chosen, T0 + 9 * MIN), 12 * MIN);
  const completed = endTimer(startTimer(15, T0), T0 + 20 * MIN);
  assert.equal(completed.endReason, 'completed');
  assert.equal(completed.endedAt, T0 + 15 * MIN);
  const pausedThenEnded = endTimer(pauseTimer(startTimer(15, T0), T0 + 5 * MIN), T0 + 40 * MIN);
  assert.equal(pausedThenEnded.endReason, 'ended');
  assert.equal(remainingMs(pausedThenEnded), 10 * MIN);
});

test('custom duration: clamped to 1–180 and stepped by 5', () => {
  assert.equal(clampMinutes(0), 1);
  assert.equal(clampMinutes(500), 180);
  assert.equal(clampMinutes('45'), 45);
  assert.equal(clampMinutes('abc'), 20);
  assert.equal(startTimer(45, T0).durationMs, 45 * MIN);
  assert.equal(startTimer(999, T0).durationMs, 180 * MIN);
  assert.equal(stepMinutes(1, 1), 5);
  assert.equal(stepMinutes(5, 1), 10);
  assert.equal(stepMinutes(12, 1), 15);
  assert.equal(stepMinutes(12, -1), 10);
  assert.equal(stepMinutes(5, -1), 1);
  assert.equal(stepMinutes(1, -1), 1);
  assert.equal(stepMinutes(180, 1), 180);
});

test('clock and words', () => {
  assert.equal(formatClock(18 * MIN + 42_000), '18:42');
  assert.equal(formatClock(62 * MIN + 5000), '1:02:05');
  assert.equal(formatClock(400), '0:01', 'rounded up — never 0:00 before the end');
  assert.equal(formatClock(0), '0:00');
  assert.equal(minutesInWords(15), 'רבע שעה');
  assert.equal(minutesInWords(30), 'חצי שעה');
  assert.equal(minutesInWords(60), 'שעה');
  assert.equal(minutesInWords(45), '45 דקות');
  assert.equal(remainingInWords(18 * MIN + 1), 'נותרו 19 דקות');
  assert.equal(remainingInWords(MIN), 'נותרה דקה אחת');
  assert.equal(remainingInWords(30_000), 'נותרה פחות מדקה');
  assert.equal(remainingInWords(0), 'הזמן הסתיים');
});
