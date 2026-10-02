// The Clay experiment (Phase 1, design/premium-claymorphism): a premium, tactile material for the Today screen only.
// It is a scoped design mode, never a global restyle:
//   • on only in a build made with VITE_CLAY=true (the side-by-side "כזוהר Clay" app); every other build is unchanged;
//   • on only while Today itself is shown (not a reader, not search results, not any other page);
//   • on only in the light and dark themes (the other six keep their look until they are translated).
// When on, <html data-clay="today">; every rule of styles/clay.css is scoped under that attribute.
export const CLAY_THEMES = Object.freeze(['light', 'dark']);
export const CLAY_ATTRIBUTE = 'clay';
export const CLAY_SCOPE = 'today';

export const clayBuildEnabled = () => {
  try { return import.meta.env.VITE_CLAY === 'true'; } catch { return false; }
};

export function clayScopeFor({ enabled = false, isTodayPage = false, theme = 'light' } = {}) {
  return enabled && isTodayPage && CLAY_THEMES.includes(theme) ? CLAY_SCOPE : null;
}

export function applyClayScope(scope, root = typeof document === 'undefined' ? null : document.documentElement) {
  if (!root) return;
  if (scope) root.dataset[CLAY_ATTRIBUTE] = scope;
  else delete root.dataset[CLAY_ATTRIBUTE];
}
