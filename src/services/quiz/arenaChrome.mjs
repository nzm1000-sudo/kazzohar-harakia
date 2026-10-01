// שעשועון טריוויה יהודי — while the game is open, the app's own frame joins the arena: a class on <html> lets the
// stylesheet (styles/quiz.css, "The arena, full-bleed") paint the night from edge to edge and tint the header and the
// tab bar to match; the browser's theme colour follows, and on iOS/Android the status bar shows light content. Every
// way out — the page unmounting (another tab, Back, a link) or the route leaving the quiz — puts all of it back as it
// was: the class removed, the theme colour restored, the status bar back to the app theme's style (as NewApp sets it).
// Pure over an injected document / window / status bar, so tests/quizChrome.test.mjs drives every path.

export const ARENA_CLASS = 'qz-arena-on';
export const QUIZ_ROUTE = 'leatzmi/quiz';
// Capacitor's Style values ('DARK' = light glyphs for a dark background).
export const STATUS_STYLE = { dark: 'DARK', light: 'LIGHT' };

export function isQuizRoute(hash) {
  const id = String(hash ?? '').replace(/^#/, '').split('?')[0];
  return id === QUIZ_ROUTE || id.startsWith(`${QUIZ_ROUTE}/`);
}

const quietly = run => { try { const r = run(); r?.catch?.(() => {}); } catch { /* the plugin may be missing */ } };
// The style NewApp gives the status bar for the app theme (dark glyphs, except in the dark theme).
export const appStatusStyle = doc => (doc?.documentElement?.dataset?.theme === 'dark' ? STATUS_STYLE.dark : STATUS_STYLE.light);

// Enters the arena's frame; returns leave() — idempotent, safe from any path and more than once.
export function enterArenaChrome({ doc = globalThis.document, win = globalThis.window, statusBar = null } = {}) {
  const root = doc?.documentElement;
  if (!root) return () => false;
  root.classList.add(ARENA_CLASS);
  const meta = doc.querySelector?.('meta[name="theme-color"]') || null;
  const metaBefore = meta?.getAttribute?.('content') ?? null;
  // The browser's bar takes the night as drawn (the body's computed background).
  try {
    const night = win?.getComputedStyle?.(doc.body)?.backgroundColor;
    if (meta && night && !/^(?:transparent|rgba\(0, 0, 0, 0\))$/.test(night)) meta.setAttribute('content', night);
  } catch { /* no layout (tests) */ }
  quietly(() => statusBar?.setStyle?.({ style: STATUS_STYLE.dark }));
  // A theme picked while the game is open: NewApp sets the status bar for the theme; the arena keeps it light.
  let observer = null;
  try {
    if (typeof win?.MutationObserver === 'function') {
      observer = new win.MutationObserver(() => { if (root.classList.contains(ARENA_CLASS)) quietly(() => statusBar?.setStyle?.({ style: STATUS_STYLE.dark })); });
      observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
  } catch { observer = null; }
  // The route leaving the quiz (a hash link, Back to another screen) — even before React unmounts the page.
  const onRoute = () => { if (!isQuizRoute(win?.location?.hash)) leave(); };
  win?.addEventListener?.('hashchange', onRoute);
  win?.addEventListener?.('popstate', onRoute);
  let left = false;
  function leave() {
    if (left) return false;
    left = true;
    observer?.disconnect?.();
    win?.removeEventListener?.('hashchange', onRoute);
    win?.removeEventListener?.('popstate', onRoute);
    root.classList.remove(ARENA_CLASS);
    if (meta && metaBefore !== null) meta.setAttribute('content', metaBefore);
    quietly(() => statusBar?.setStyle?.({ style: appStatusStyle(doc) }));
    return true;
  }
  return leave;
}
