// שעשועון טריוויה יהודי — while the game is open, the app's own frame joins the quiz. The quiz has two looks:
// · the night arena (dark) — a class on <html> (ARENA_CLASS) lets the stylesheet (styles/quiz.css, "The arena,
//   full-bleed") paint the night from edge to edge and tint the header and the tab bar to match; the browser's theme
//   colour follows, and on iOS/Android the status bar shows light content;
// · the light quiz — LIGHT_CLASS on <html>: cream paper, ink type, copper outlines ("The light quiz" in quiz.css). The
//   app's frame stays light around it (over a dark app theme its tokens are re-pointed to the cream palette), the
//   browser's theme colour takes the paper and the status bar shows dark content.
// The look follows the app theme unless the player chose one in the quiz's settings (QUIZ_LOOK_KEY, this device only):
// 'auto' — the dark themes (dark, amber) give the night, every other theme the light quiz.
// Every way out — the page unmounting (another tab, Back, a link) or the route leaving the quiz — puts all of it back as
// it was: the classes removed, the theme colour restored, the status bar back to the app theme's style (as NewApp sets
// it). Pure over an injected document / window / status bar / storage, so tests/quizChrome.test.mjs drives every path.

export const ARENA_CLASS = 'qz-arena-on';
export const LIGHT_CLASS = 'qz-arena-light';
export const QUIZ_ROUTE = 'leatzmi/quiz';
export const QUIZ_LOOK_KEY = 'kz-quiz-look';
export const QUIZ_LOOKS = ['auto', 'light', 'dark'];
// The app themes whose own surface is dark (styles/base.css: color-scheme:dark).
export const DARK_THEMES = ['dark', 'amber'];
// Capacitor's Style values ('DARK' = light glyphs for a dark background).
export const STATUS_STYLE = { dark: 'DARK', light: 'LIGHT' };

export function isQuizRoute(hash) {
  const id = String(hash ?? '').replace(/^#/, '').split('?')[0];
  return id === QUIZ_ROUTE || id.startsWith(`${QUIZ_ROUTE}/`);
}

// The look the quiz is drawn in: the player's choice, or the app theme's.
export const normalizeLook = look => (QUIZ_LOOKS.includes(look) ? look : 'auto');
export function arenaMode(look, theme) {
  const chosen = normalizeLook(look);
  if (chosen !== 'auto') return chosen;
  return DARK_THEMES.includes(theme) ? 'dark' : 'light';
}

const storageOf = storage => { if (storage !== undefined) return storage; try { return globalThis.localStorage || null; } catch { return null; } };
export function readQuizLook(storage) {
  try { return normalizeLook(storageOf(storage)?.getItem(QUIZ_LOOK_KEY)); } catch { return 'auto'; }
}
export function writeQuizLook(look, storage) {
  const s = storageOf(storage);
  const value = normalizeLook(look);
  try { if (value === 'auto') s?.removeItem(QUIZ_LOOK_KEY); else s?.setItem(QUIZ_LOOK_KEY, value); return true; } catch { return false; }
}

const quietly = run => { try { const r = run(); r?.catch?.(() => {}); } catch { /* the plugin may be missing */ } };
// The style NewApp gives the status bar for the app theme (dark glyphs, except in the dark theme).
export const appStatusStyle = doc => (doc?.documentElement?.dataset?.theme === 'dark' ? STATUS_STYLE.dark : STATUS_STYLE.light);

// Enters the quiz's frame in the given look; returns leave() — idempotent, safe from any path and more than once.
export function enterArenaChrome({ doc = globalThis.document, win = globalThis.window, statusBar = null, look = 'auto' } = {}) {
  const root = doc?.documentElement;
  if (!root) return () => false;
  const meta = doc.querySelector?.('meta[name="theme-color"]') || null;
  const metaBefore = meta?.getAttribute?.('content') ?? null;
  let mode = null;
  let left = false;
  // Draws the look for the theme now on <html>: its class, the browser's bar (the body's computed background, the
  // night or the paper as drawn) and the status bar's glyphs.
  const apply = () => {
    mode = arenaMode(look, root.dataset?.theme);
    root.classList.remove(mode === 'dark' ? LIGHT_CLASS : ARENA_CLASS);
    root.classList.add(mode === 'dark' ? ARENA_CLASS : LIGHT_CLASS);
    try {
      const ground = win?.getComputedStyle?.(doc.body)?.backgroundColor;
      if (meta && ground && !/^(?:transparent|rgba\(0, 0, 0, 0\))$/.test(ground)) meta.setAttribute('content', ground);
    } catch { /* no layout (tests) */ }
    quietly(() => statusBar?.setStyle?.({ style: mode === 'dark' ? STATUS_STYLE.dark : STATUS_STYLE.light }));
  };
  apply();
  // A theme picked while the game is open: NewApp sets the status bar for the theme; the quiz draws its look again
  // ('auto' may turn from light to night or back; a chosen look keeps its status bar).
  let observer = null;
  try {
    if (typeof win?.MutationObserver === 'function') {
      observer = new win.MutationObserver(() => { if (!left) apply(); });
      observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
  } catch { observer = null; }
  // The route leaving the quiz (a hash link, Back to another screen) — even before React unmounts the page.
  const onRoute = () => { if (!isQuizRoute(win?.location?.hash)) leave(); };
  win?.addEventListener?.('hashchange', onRoute);
  win?.addEventListener?.('popstate', onRoute);
  function leave() {
    if (left) return false;
    left = true;
    observer?.disconnect?.();
    win?.removeEventListener?.('hashchange', onRoute);
    win?.removeEventListener?.('popstate', onRoute);
    root.classList.remove(ARENA_CLASS);
    root.classList.remove(LIGHT_CLASS);
    if (meta && metaBefore !== null) meta.setAttribute('content', metaBefore);
    quietly(() => statusBar?.setStyle?.({ style: appStatusStyle(doc) }));
    return true;
  }
  leave.mode = () => mode;
  return leave;
}
