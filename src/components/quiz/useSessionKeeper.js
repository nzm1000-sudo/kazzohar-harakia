import { useEffect, useRef, useState } from 'react';
import { RESUME_WINDOW_MS, clearSession, makeSnapshot, saveSession } from '../../services/quiz/sessionResume.mjs';

// Keeps the game on screen (services/quiz/sessionResume.mjs): after every change, when the app is hidden (another app,
// the phone locked), on pagehide and when the screen unmounts (another screen of the app). `build()` returns the view's
// state, or null when there is nothing to keep (the intro). Coming back to a still-mounted screen after the window has
// passed calls `onExpire` (the game starts afresh). `abandon()`: the player left the game on purpose (to the quiz's
// home) — the snapshot goes and nothing is kept again from this screen.
export function useSessionKeeper({ kind, route, bank, build, onExpire }) {
  const buildRef = useRef(build);
  buildRef.current = build;
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const meta = useRef({ kind, route, bank });
  meta.current = { kind, route, bank };
  const abandoned = useRef(false);
  const save = () => {
    if (abandoned.current || !meta.current.bank) return;
    const state = buildRef.current?.();
    if (state) saveSession(makeSnapshot({ ...meta.current, state, now: Date.now() }));
  };
  useEffect(save);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let hiddenAt = null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); save(); return; }
      if (hiddenAt === null) return;
      const away = Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= RESUME_WINDOW_MS && !abandoned.current) { abandoned.current = true; clearSession(); expireRef.current?.(); } else save();
    };
    const onHide = () => save();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', onHide); save(); };
  }, []);
  return () => { abandoned.current = true; clearSession(); };
}

// Whether the page is on screen (the question's clock never runs while the player is away).
export function usePageVisible() {
  const read = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const [visible, setVisible] = useState(read);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const on = () => setVisible(read());
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}
