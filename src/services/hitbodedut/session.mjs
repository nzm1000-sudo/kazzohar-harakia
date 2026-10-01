// התבודדות — one session from start to end: the timer, the screen (dimming, keep-awake), the background sound and
// the Live Activity, kept in step, with every way out restoring what the session changed. Pure orchestration over
// injected parts (tests/hitbodedutSession.test.mjs drives it with mocks):
//   timer      ./timer.mjs (pure)
//   screen     ./brightness.mjs  createBrightnessGuard
//   audio      ../ambientAudio/engine.mjs  createAmbientAudio
//   live       ./liveActivity.mjs  createLiveActivityBridge
//   storage    localStorage-like: the running session is kept, so a reload (the system reclaiming the WebView while the
//              phone is locked) picks it up again, and a crash never leaves anything behind on the next launch.
//
// התבודדות is not "study": nothing here writes to the journal. The Tehillim display offers the app's usual explicit
// "סיימתי" at the end (HitbodedutPage), never an automatic mark.

import { endTimer, isPaused, isRunning, isTimeUp, pauseTimer, remainingMs, resumeTimer, startTimer } from './timer.mjs';
import { isAudible } from '../ambientAudio/noise.mjs';
import { END_RAMP_MS } from './brightness.mjs';
import { clampDimStep, nativeDimLevel } from './dimSteps.mjs';

export const SESSION_KEY = 'kz-hitbodedut-session-v1';
export const TEHILLIM_DIM_LEVEL = 0.3;

export const DISPLAYS = Object.freeze({
  timer: { id: 'timer', title: 'שעון שקט', line: 'רק הזמן, בעדינות' },
  tehillim: { id: 'tehillim', title: 'תהילים ברצף', line: 'פסוק אחר פסוק' },
});

// The options of a session, normalized.
export function sessionOptions(input = {}) {
  const display = input.display === 'tehillim' ? 'tehillim' : 'timer';
  const startChapter = Math.min(150, Math.max(1, Math.round(Number(input.startChapter) || 1)));
  return {
    minutes: input.minutes,
    sound: typeof input.sound === 'string' ? input.sound : 'silence',
    volume: Math.min(1, Math.max(0, Number(input.volume ?? 0.4))),
    pitch: input.pitch || 'mid',
    display,
    startChapter,
    order: input.order === 'random' ? 'random' : 'sequential',
    speed: Math.min(4, Math.max(0, Math.round(Number.isFinite(Number(input.speed)) ? Number(input.speed) : 2))),
    // The screen stays on when the person chose to watch it (always for Tehillim); dimming applies only then.
    screenOn: display === 'tehillim' ? true : input.screenOn !== false,
    dim: input.dim !== false,
    // The − / + step of the dimming (dimSteps.mjs); absent in sessions kept from before the steps.
    ...(input.dimStep != null ? { dimStep: clampDimStep(input.dimStep) } : {}),
    // Reading needs more light than watching a clock: Tehillim dims less (the words stay readable by the candle).
    // An explicit level wins; else the step's level; else the usual level of the display.
    dimLevel: input.dimLevel != null && Number.isFinite(Number(input.dimLevel)) ? Number(input.dimLevel)
      : input.dimStep != null ? (nativeDimLevel(display, input.dimStep) ?? undefined)
        : display === 'tehillim' ? TEHILLIM_DIM_LEVEL : undefined,
    chime: input.chime !== false,
  };
}

function readSession(storage) {
  try { const raw = storage?.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeSession(storage, session) { try { storage?.setItem(SESSION_KEY, JSON.stringify(session)); } catch {} }
function clearSession(storage) { try { storage?.removeItem(SESSION_KEY); } catch {} }

export function createHitbodedutController({ screen, audio, live, storage = null, clock = () => Date.now() } = {}) {
  let session = null;         // { timer, options, chapters: number[], foreground: bool }
  let summary = null;         // the last ended session (for the closing screen)
  const appliedIds = new Set();
  let screenQueue = Promise.resolve();
  const listeners = new Set();
  const emit = () => { for (const listener of listeners) { try { listener(session, summary); } catch {} } };
  const persist = () => { if (session) writeSession(storage, { timer: session.timer, options: session.options, chapters: session.chapters }); else clearSession(storage); };
  const at = value => (value == null ? clock() : Number(value));

  const applyScreen = async () => {
    if (!screen || !session) return;
    if (session.options.screenOn) {
      await screen.setKeepAwake(true);
      if (session.options.dim && session.options.dimStep !== 0) await screen.dim(session.options.dimLevel);
    }
  };
  // The end in the open app climbs back to the person's brightness over END_RAMP_MS (in step with the closing screen
  // lighting up); a session closed while hidden or on recovery restores at once.
  const releaseScreen = async ({ gentle = false } = {}) => {
    if (!screen) return;
    await screen.restore(gentle ? { rampMs: END_RAMP_MS } : undefined);
    await screen.setKeepAwake(false);
  };
  const playSound = async () => {
    if (!audio || !session || !isAudible(session.options.sound)) return;
    await audio.play({ sound: session.options.sound, volume: session.options.volume, pitch: session.options.pitch, stopAt: session.timer.endsAt, title: 'התבודדות' });
  };

  const controller = {
    get session() { return session ? { ...session, timer: { ...session.timer }, chapters: [...session.chapters] } : null; },
    get summary() { return summary; },
    get active() { return Boolean(session && !session.timer.endedAt); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    remaining(now) { return session ? remainingMs(session.timer, at(now)) : 0; },

    async start(input, now) {
      if (session) await controller.end('ended', now);
      const options = sessionOptions(input);
      summary = null;
      session = { timer: startTimer(options.minutes, at(now)), options, chapters: [], foreground: true };
      persist();
      emit();
      // The sound is asked for first, in the same turn as the tap (no screen call awaited before it), and the screen is set
      // while it loads — so the sound starts at once, never behind the brightness calls.
      const sound = playSound().catch(() => {});
      await applyScreen();
      await sound;
      if (live && session) await live.start(session.timer);
      return controller.session;
    },

    async pause(now) {
      if (!session || !isRunning(session.timer)) return controller.session;
      session = { ...session, timer: pauseTimer(session.timer, at(now)) };
      persist();
      emit();
      if (audio) await audio.pause();
      if (live) await live.pause(session.timer, remainingMs(session.timer));
      return controller.session;
    },

    async resume(now) {
      if (!session || !isPaused(session.timer)) return controller.session;
      session = { ...session, timer: resumeTimer(session.timer, at(now)) };
      persist();
      emit();
      if (audio && isAudible(session.options.sound)) {
        if (audio.state === 'idle') await playSound();
        else await audio.resume({ stopAt: session.timer.endsAt });
      }
      if (live) await live.resume(session.timer);
      return controller.session;
    },

    // Ends the session (by choice, or 'completed' when the time is up) and restores everything it changed.
    async end(reason = null, now, { quiet = false } = {}) {
      if (!session) return summary;
      const ended = endTimer(session.timer, at(now), reason);
      const ring = !quiet && session.foreground && ended.endReason === 'completed' && session.options.chime;
      const gentle = !quiet && session.foreground;
      summary = { timer: ended, options: session.options, chapters: [...session.chapters] };
      session = null;
      persist();
      emit();
      // The light comes back at once (climbing gently), while the sound fades out.
      const screenReleased = releaseScreen({ gentle });
      if (audio) {
        if (ring) await audio.chime();
        await audio.stop({ immediate: ended.endReason !== 'completed' });
      }
      await screenReleased;
      if (live) await live.end({ completed: ended.endReason === 'completed' });
      return summary;
    },

    // Called every second or so by the screen: ends the session when the time is up.
    async tick(now) {
      if (session && isTimeUp(session.timer, at(now))) return controller.end('completed', session.timer.endsAt);
      return null;
    },

    dismissSummary() { summary = null; emit(); },

    // The − / + of the dimming while the session runs: the step is kept with the session, and the native brightness
    // follows at once (step 0: the person's own brightness back; the end still restores whatever is left). The page's
    // software layer follows the same step, so the change is visible even where the native brightness is not.
    async setDimStep(step) {
      if (!session) return null;
      const dimStep = clampDimStep(step);
      const level = nativeDimLevel(session.options.display, dimStep);
      session = { ...session, options: { ...session.options, dimStep, dim: dimStep > 0, dimLevel: level ?? undefined } };
      persist();
      emit();
      if (screen && session.options.screenOn && session.foreground) {
        // Quick presses run one after another, never interleaved on the native side.
        screenQueue = screenQueue.catch(() => {}).then(() => (level == null ? screen.restore() : screen.dim(level)));
        await screenQueue.catch(() => {});
      }
      return controller.session;
    },

    // A chapter of the Tehillim display that was read through (for the explicit "סיימתי" at the end).
    noteChapter(chapter) {
      if (!session || session.chapters.includes(chapter)) return;
      session = { ...session, chapters: [...session.chapters, chapter] };
      persist();
      emit();
    },

    // The app was hidden / shown (App 'appStateChange'). Hidden: the person's brightness comes back at once; a sound
    // that can play in the background goes on. Shown: re-dim, resume, catch up on Lock Screen actions and the clock.
    async background() {
      if (!session) return;
      session = { ...session, foreground: false };
      if (screen) await screen.suspend();
      if (audio) await audio.background();
    },
    async foreground(now) {
      if (!session) return controller.tick(now);
      session = { ...session, foreground: true };
      if (live) for (const item of await live.takeActions()) await controller.apply(item);
      if (!session) return summary;
      const ended = await controller.tick(now);
      if (ended) return ended;
      if (screen && session.options.screenOn) await screen.resumeDim();
      if (audio) await audio.foreground();
      emit();
      return null;
    },

    // An action from outside the page: the Live Activity's buttons, the Lock Screen's play/pause.
    async apply({ action, at: when, id } = {}) {
      // The same Lock Screen action can arrive twice (as an event, and again from the pending list): once only.
      if (id) { if (appliedIds.has(id)) return; appliedIds.add(id); }
      if (!session) return;
      if (action === 'pause') await controller.pause(when);
      else if (action === 'resume' || action === 'play') await controller.resume(when);
      else if (action === 'end' || action === 'stop') await controller.end('ended', when);
    },

    // On opening: a session kept from before a reload continues (unless resume is false); one whose time passed (or a crash) is closed, and
    // everything it changed is put back.
    // resume: false (the app opened on another screen): a kept session is closed quietly instead of picked up.
    async recover(now, { resume = true } = {}) {
      const saved = readSession(storage);
      const time = at(now);
      if (!saved?.timer || saved.timer.endedAt) {
        clearSession(storage);
        if (screen) await screen.recover({ sessionActive: false });
        if (live) await live.end({ completed: false });
        return null;
      }
      session = { timer: saved.timer, options: sessionOptions(saved.options), chapters: Array.isArray(saved.chapters) ? saved.chapters : [], foreground: true };
      if (isTimeUp(session.timer, time)) {
        return controller.end('completed', session.timer.endsAt, { quiet: true });
      }
      if (!resume) return controller.end('ended', time, { quiet: true });
      emit();
      await applyScreen();
      if (isRunning(session.timer)) await playSound();
      return controller.session;
    },
  };
  return controller;
}
