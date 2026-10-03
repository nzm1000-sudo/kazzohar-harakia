import { useEffect } from 'react';
import { currentEntryKey, isRestoring, readRouteState, writeRouteState } from '../services/scrollRestoration.mjs';

// Brings a place of the reading to the top of the screen, just under the docked header ("הקודם | תוכן | הבא").
export function scrollToPlace(node) {
  if (!node) return;
  const header = globalThis.document?.querySelector('.shell-head-safe');
  const below = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  globalThis.scrollTo?.({ top: Math.max(0, node.getBoundingClientRect().top + globalThis.scrollY - below - 12), behavior: 'auto' });
}

// Opens a reading at a place inside it (the History entry's `anchor`: Shacharit right after ברכות השחר, a leaf of סדר
// השכמת הבוקר). Once per History entry: Back / Forward to the entry restores where the reader was, never the anchor
// again. `find()` returns the element to bring to the top, or null while the text is still being laid out.
export function useOpenAt(anchor, find, ready) {
  useEffect(() => {
    if (!anchor || !ready) return undefined;
    const key = currentEntryKey();
    if (readRouteState(key, 'opened-at')?.value === anchor) return undefined;
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      if (isRestoring()) return;
      const node = find();
      if (node) {
        scrollToPlace(node);
        writeRouteState(key, 'opened-at', anchor);
        return;
      }
      tries += 1;
      if (tries < 30) timer = setTimeout(attempt, 50);
    };
    // After the route's own move to the top (NewApp scrolls a new entry to 0 on the next frame).
    timer = setTimeout(attempt, 80);
    return () => clearTimeout(timer);
  }, [anchor, ready]);
}
