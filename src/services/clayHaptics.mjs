// CLAY · a light tap when a clay button is pressed — through the app's own haptic (the native bridge the prayer compass
// and the switches already use: UIImpactFeedbackGenerator .light on iOS; nothing on the web). Non-essential: silent when
// נגישות › משוב מישושי is off. Only the main pressable bodies tick (the dock, the "עוד" tiles, segments, primary actions,
// "סיימתי"), at most once per 80ms; a switch already ticks itself and is skipped. (No Capacitor Haptics plugin is
// installed in this app — the bridge is the one channel.)
import { hapticsAllowed } from './accessibility/preferences.mjs';

export const CLAY_PRESS_SELECTOR = [
  '.tabbar>button', '.more-menu>button', '.more-menu .sheet button',
  '.seg>button', '.ja-seg>button', '.personal-switch>button',
  '.personal-primary', '.prayer-complete-btn', '.daily-learning-complete', '.lz-outline',
  '.learning-resume-item', '.reader-step', '.local-back', '.ui-select-trigger', '.ui-picker-option',
].join(',');

export function nativeTick(win = globalThis) {
  try {
    if (!hapticsAllowed()) return false;
    if (win.KZHeading?.haptic) { win.KZHeading.haptic(); return true; }
    const bridge = win.webkit?.messageHandlers?.kzHeading;
    if (bridge) { bridge.postMessage({ action: 'haptic' }); return true; }
  } catch { /* no haptics here */ }
  return false;
}

export function shouldTick(target) {
  const control = target?.closest?.(CLAY_PRESS_SELECTOR);
  if (!control) return null;
  if (control.disabled || control.getAttribute?.('aria-disabled') === 'true' || control.closest?.('[role="switch"]')) return null;
  return control;
}

export function installClayHaptics({ doc = globalThis.document, tick = nativeTick, now = () => Date.now(), gap = 80 } = {}) {
  if (!doc?.addEventListener) return () => {};
  let last = -Infinity;
  const onPress = event => {
    if (!shouldTick(event.target)) return;
    const at = now();
    if (at - last < gap) return;
    last = at;
    tick();
  };
  doc.addEventListener('click', onPress, true);
  return () => doc.removeEventListener('click', onPress, true);
}
