// התבודדות — crash-safe recovery on app start (called once by NewApp). Light on purpose: the session services are
// loaded only when something was actually left behind.
//   · the immersive attribute on <html> (header / tab bar / status bar hidden) is removed whatever happened;
//   · a session or a saved brightness kept from before (a crash, a kill, a reload) is closed — the person's brightness
//     and keep-awake put back, the Live Activity ended, and recorded in the journal as any other end — unless the
//     app opened on התבודדות itself, where the page picks the session up again.
import { exitImmersive, isHitbodedutRoute } from './exitGuard.mjs';

// Mirrors SESSION_KEY (session.mjs) and BRIGHTNESS_KEY (brightness.mjs); tests/hitbodedutExit.test.mjs keeps them equal.
export const LEFTOVER_KEYS = Object.freeze(['kz-hitbodedut-session-v1', 'kz-hitbodedut-brightness-v1']);

export function hasLeftovers(storage) {
  try { return LEFTOVER_KEYS.some(key => storage?.getItem(key) != null); } catch { return false; }
}

// `load` returns the services module ({ hitbodedut, leaveSession }); injected for tests.
export async function recoverHitbodedutAtLaunch({
  doc = globalThis.document,
  hash = globalThis.location?.hash || '',
  storage = (() => { try { return globalThis.localStorage || null; } catch { return null; } })(),
  statusBar = null,
  load = () => import('./index.mjs'),
} = {}) {
  // (Never under a session screen that is already showing — the app may have opened straight onto it.)
  if (!doc?.querySelector?.('.hb-session')) exitImmersive({ doc, statusBar });
  if (isHitbodedutRoute(hash) || !hasLeftovers(storage)) return false;
  try {
    const services = await load();
    const controller = services.hitbodedut({ resume: false });
    await controller.ready;
    if (controller.active) await services.leaveSession(controller, { doc, statusBar });
    // Closed on another screen: never a closing screen waiting for the next visit (what it read is already in the
    // journal — exitRecording.mjs, through the controller's onEnd).
    if (controller.summary) controller.dismissSummary();
    return true;
  } catch { return false; }
}
