// התבודדות — every way out of a session puts the app back as it was. The session screen hides the header, the tab bar
// and the status bar (an attribute on <html>), dims the screen (natively, and a soft layer), keeps it awake and may play
// a sound. Leaving it by any path other than "סיום" — the iOS edge swipe, the browser's Back, a hash link, the page
// unmounting, the app coming back on another screen, or a crash and a fresh launch — must never leave a dark app behind:
//
//   · Back while the session is on screen (the guard entry popped, same address): ask (the end confirmation).
//   · Any navigation that leaves the התבודדות route (popstate / hashchange to another screen): end the session at once
//     and quietly (the person's brightness back immediately, keep-awake off, the sound stopped), and clear the chrome.
//   · The app shown again (visibilitychange / pageshow) on another screen while a session is still on: the same.
//   · On launch: a leftover attribute is removed, and a session kept from before is closed unless the app opened on it.
//
// Pure over injected window / document / statusBar / controller, so tests/hitbodedutExit.test.mjs drives every path.

export const IMMERSIVE_ATTR = 'data-kz-immersive';
export const HITBODEDUT_ROUTE = 'leatzmi/hitbodedut';
export const GUARD_FLAG = 'kzHitGuard';

export function isHitbodedutRoute(hash) {
  const id = String(hash ?? '').replace(/^#/, '').split('?')[0];
  return id === HITBODEDUT_ROUTE || id.startsWith(`${HITBODEDUT_ROUTE}/`);
}

const rootOf = doc => doc?.documentElement || null;
const quietly = promise => { try { promise?.catch?.(() => {}); } catch {} };

// The session's full-screen look: no header, no tab bar, no status bar.
export function enterImmersive({ doc = globalThis.document, statusBar = null } = {}) {
  rootOf(doc)?.setAttribute(IMMERSIVE_ATTR, 'hitbodedut');
  quietly(statusBar?.hide?.());
}

// Everything back: idempotent, safe to call from any path (and more than once).
export function exitImmersive({ doc = globalThis.document, statusBar = null } = {}) {
  const root = rootOf(doc);
  const had = Boolean(root?.hasAttribute?.(IMMERSIVE_ATTR));
  root?.removeAttribute?.(IMMERSIVE_ATTR);
  if (had) quietly(statusBar?.show?.());
  return had;
}

// Ends a running session because the person went elsewhere: quietly (no chime, the brightness back at once rather than
// climbing), the chrome restored. The closing screen is kept only when it has something to offer (Tehillim chapters
// read, for the explicit "סיימתי"); otherwise it is dismissed, so coming back to התבודדות later shows the choice, not a
// dark closing screen.
export async function leaveSession(controller, { doc = globalThis.document, statusBar = null } = {}) {
  exitImmersive({ doc, statusBar });
  if (!controller?.active) return false;
  try { await controller.end('ended', undefined, { quiet: true }); } catch {}
  if (!controller.summary?.chapters?.length) { try { controller.dismissSummary(); } catch {} }
  exitImmersive({ doc, statusBar });
  return true;
}

// The app-wide watcher (installed once with the controller, independent of any React component): whatever the router
// does, a session never outlives the התבודדות route.
export function watchSessionRoute({ win = globalThis.window, doc = globalThis.document, controller, statusBar = null } = {}) {
  if (!win?.addEventListener || !controller) return () => {};
  const hash = () => win.location?.hash || '';
  const check = () => { if (controller.active && !isHitbodedutRoute(hash())) quietly(leaveSession(controller, { doc, statusBar })); };
  const onVisible = () => { if (!doc?.hidden) check(); };
  win.addEventListener('hashchange', check);
  win.addEventListener('popstate', check);
  win.addEventListener('pageshow', check);
  doc?.addEventListener?.('visibilitychange', onVisible);
  return () => {
    win.removeEventListener('hashchange', check);
    win.removeEventListener('popstate', check);
    win.removeEventListener('pageshow', check);
    doc?.removeEventListener?.('visibilitychange', onVisible);
  };
}

// The session screen's Back guard: an entry with the same address is pushed while the session runs; when it is popped
// (the edge swipe, Back) the guard returns and the person is asked. If Back took the app to another screen after all
// (WebKit may skip an entry pushed without a gesture), the session ends instead of re-pushing a guard there.
export function guardBack({ win = globalThis.window, controller, onAsk = () => {}, onReturn = () => {}, doc = globalThis.document, statusBar = null } = {}) {
  if (!win?.history || !controller) return () => {};
  const push = () => { try { win.history.pushState({ ...(win.history.state || {}), [GUARD_FLAG]: true }, '', win.location.href); } catch {} };
  if (controller.active && !win.history.state?.[GUARD_FLAG] && isHitbodedutRoute(win.location.hash)) push();
  const onPop = () => {
    if (!controller.active) return;
    if (!isHitbodedutRoute(win.location.hash)) { quietly(leaveSession(controller, { doc, statusBar })); return; }
    push();
    onAsk();
  };
  const onVisible = () => { if (!doc?.hidden && controller.active) onReturn(); };
  win.addEventListener('popstate', onPop);
  doc?.addEventListener?.('visibilitychange', onVisible);
  return () => {
    win.removeEventListener('popstate', onPop);
    doc?.removeEventListener?.('visibilitychange', onVisible);
  };
}

// Drops the guard entry once the session is over (only when it is the entry being shown).
export function dropGuard(win = globalThis.window) {
  try { if (win?.history?.state?.[GUARD_FLAG] && isHitbodedutRoute(win.location.hash)) win.history.back(); } catch {}
}
