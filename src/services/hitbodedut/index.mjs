// התבודדות — the services of the personal quiet time in "לעצמי" (src/pages/HitbodedutPage.jsx).
import { App } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { createBrightnessGuard } from './brightness.mjs';
import { createLiveActivityBridge } from './liveActivity.mjs';
import { createHitbodedutController } from './session.mjs';
import { isHitbodedutRoute, leaveSession, watchSessionRoute } from './exitGuard.mjs';
import { recordSessionEnd } from './exitRecording.mjs';
import { KZHitbodedut, nativeHitbodedut, nativePlatform } from './nativePlugin.mjs';
import { ambientAudio } from '../ambientAudio/index.mjs';

export * from './timer.mjs';
export * from './prefs.mjs';
export * from './focusGuide.mjs';
export * from './gatekeeper.mjs';
export * from './tehillimFlow.mjs';
export * from './taps.mjs';
export * from './dimSteps.mjs';
export * from './controlsReveal.mjs';
export * from './breath.mjs';
export { DISPLAYS, sessionOptions, createHitbodedutController, SESSION_KEY } from './session.mjs';
export { createBrightnessGuard, BRIGHTNESS_KEY, DEFAULT_DIM_LEVEL, END_RAMP_MS } from './brightness.mjs';
export { createLiveActivityBridge } from './liveActivity.mjs';
export * from './exitGuard.mjs';
export * from './exitRecording.mjs';

let shared = null;
// The one controller of the app, wired to the native plugin when present, to the app's lifecycle and to the
// Lock Screen's actions. Created on first use (opening the page, or the launch recovery), recovered from a previous
// launch at once — picked up again only when the app is on התבודדות (resume), else closed quietly.
export function hitbodedut({ resume = true } = {}) {
  if (shared) return shared;
  const plugin = nativeHitbodedut();
  const storage = (() => { try { return globalThis.localStorage || null; } catch { return null; } })();
  const controller = createHitbodedutController({
    screen: createBrightnessGuard({ plugin, storage }),
    audio: ambientAudio(),
    live: createLiveActivityBridge(plugin, { platform: nativePlatform() }),
    storage,
    // Every end — natural or a way out — goes to the journal silently (exitRecording.mjs: a third of the time; the
    // Tehillim chapters read through). Idempotent per session.
    onEnd: ended => { recordSessionEnd(ended, storage || undefined); },
  });
  shared = controller;
  // Shown again: on another screen (the session somehow outlived its page) it ends, else it resumes (re-dim, catch up).
  const shown = () => (controller.active && typeof location !== 'undefined' && !isHitbodedutRoute(location.hash)
    ? leaveSession(controller, { doc: document, statusBar: StatusBar })
    : controller.foreground());
  if (nativePlatform() !== 'web') try {
    App.addListener('appStateChange', ({ isActive }) => { (isActive ? shown() : controller.background()).catch?.(() => {}); });
  } catch {}
  if (plugin) {
    try {
      KZHitbodedut.addListener('liveAction', event => { controller.apply(event || {}).catch(() => {}); });
      KZHitbodedut.addListener('remote', event => {
        const action = event?.action;
        controller.apply({ action: action === 'play' ? 'resume' : action === 'pause' ? 'pause' : null, at: event?.at }).catch(() => {});
        ambientAudio().remote(action);
      });
    } catch {}
  }
  // Web: a hidden tab is the background.
  if (typeof document !== 'undefined' && nativePlatform() === 'web') {
    document.addEventListener('visibilitychange', () => { (document.hidden ? controller.background() : shown()).catch?.(() => {}); });
  }
  // Whatever the router does, a session never outlives the התבודדות route (exitGuard.mjs).
  if (typeof window !== 'undefined') watchSessionRoute({ win: window, doc: document, controller, statusBar: StatusBar });
  controller.ready = controller.recover(undefined, { resume }).catch(() => null);
  return controller;
}
