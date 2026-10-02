// CLAY (design/premium-claymorphism): the premium, tactile 3D material as an app-wide design mode.
//   • on only in a build made with VITE_CLAY=true (the side-by-side "כזוהר Clay" app); every other build is unchanged —
//     the attribute is never set there, and every rule of styles/clay/* is scoped under it;
//   • on every screen and in all eight colour themes (each has its own clay translation: styles/clay/tokens.css);
//   • reading surfaces (the prayer, Torah, Tehillim, Talmud, halacha answers, the library's readers) stay a flat, quiet
//     page — the material is only on the chrome around them (docs/design-system.md › CLAY).
// When on: <html data-clay="app" data-clay-page="today|reader|<route root>">.
export const CLAY_THEMES = Object.freeze(['light', 'dark', 'sage', 'blue', 'plum', 'coral', 'teal', 'amber']);
export const CLAY_ATTRIBUTE = 'clay';
export const CLAY_PAGE_ATTRIBUTE = 'clayPage';
export const CLAY_SCOPE = 'app';

export const clayBuildEnabled = () => {
  try { return import.meta.env.VITE_CLAY === 'true'; } catch { return false; }
};

export function clayScopeFor({ enabled = false } = {}) {
  return enabled ? CLAY_SCOPE : null;
}

// The page the material is drawn on: Today, an open reader, or the route's root ("siddur", "halacha" …), so an area's
// own stylesheet (styles/clay/<area>.css) can scope itself to its screens.
export function clayPageFor({ isTodayPage = false, reader = false, mode = '' } = {}) {
  if (reader) return 'reader';
  if (isTodayPage) return 'today';
  return String(mode || 'today').split('/')[0] || 'today';
}

export function applyClayScope(scope, page = null, root = typeof document === 'undefined' ? null : document.documentElement) {
  if (!root) return;
  if (scope) {
    root.dataset[CLAY_ATTRIBUTE] = scope;
    if (page) root.dataset[CLAY_PAGE_ATTRIBUTE] = page; else delete root.dataset[CLAY_PAGE_ATTRIBUTE];
  } else {
    delete root.dataset[CLAY_ATTRIBUTE];
    delete root.dataset[CLAY_PAGE_ATTRIBUTE];
  }
}
