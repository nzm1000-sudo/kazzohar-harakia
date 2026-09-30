// The accessibility settings, live: applied on <html> at start-up, and again whenever the reader changes a setting or
// the device does (reduce motion, contrast, transparency, Dynamic Type — which iOS reports when the app returns).
import { useSyncExternalStore } from 'react';
import { CHANGE_EVENT, applyToDocument, getPreferences, writePreferences } from './preferences.mjs';

let installed = false;
export function installAccessibility(doc = document, win = window) {
  if (installed || !doc?.body) return;
  installed = true;
  // The Dynamic Type probe (see accessibility.css): a hidden element set in -apple-system-body.
  if (!doc.getElementById('kz-dynamic-type-probe')) {
    const probe = doc.createElement('span');
    probe.id = 'kz-dynamic-type-probe';
    probe.setAttribute('aria-hidden', 'true');
    probe.textContent = 'א';
    doc.body.appendChild(probe);
  }
  const apply = () => { try { applyToDocument(doc, win); } catch { /* never break the app over a preference */ } };
  apply();
  win.addEventListener(CHANGE_EVENT, apply);
  for (const query of ['(prefers-reduced-motion: reduce)', '(prefers-contrast: more)', '(forced-colors: active)', '(prefers-reduced-transparency: reduce)']) {
    try { win.matchMedia(query).addEventListener('change', apply); } catch { /* an older web view */ }
  }
  // iOS applies a new Dynamic Type size while the app is in the background: re-read it on return.
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') apply(); });
}

const subscribe = callback => { window.addEventListener(CHANGE_EVENT, callback); return () => window.removeEventListener(CHANGE_EVENT, callback); };
// The settings screen's view of the preferences (one store; every change is saved and applied at once).
export function useAccessibilityPreferences() {
  const prefs = useSyncExternalStore(subscribe, getPreferences, getPreferences);
  const update = patch => writePreferences({ ...getPreferences(), ...patch });
  return [prefs, update];
}
