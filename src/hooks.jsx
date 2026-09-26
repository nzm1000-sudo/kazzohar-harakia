import { useEffect, useState, useRef, useCallback } from 'react';
export function useLocal(key, initial) {
  const [value, setValue] = useState(() => {
    try { const saved = localStorage.getItem(key); return saved === null ? initial : JSON.parse(saved); } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing/storage-full: keep session state. */ } }, [key, value]);
  return [value, setValue];
}
export function useResource(loader, dependencies) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ loading: true, data: null, error: null });
    Promise.resolve().then(() => loader(controller.signal)).then(data => {
      if (active) setState({ loading: false, data, error: null });
    }).catch(error => {
      if (active && error.name !== 'AbortError') {
        const message = navigator.onLine === false || error.name === 'TypeError'
          ? 'אין חיבור לאינטרנט והתוכן הזה עדיין לא נשמר במכשיר'
          : error.message;
        setState({ loading: false, data: null, error: message });
      }
    });
    return () => { active = false; controller.abort(); };
  }, [...dependencies, retry]);
  useEffect(() => {
    const retryOnline = () => setRetry(n => n + 1);
    window.addEventListener('online', retryOnline);
    return () => window.removeEventListener('online', retryOnline);
  }, []);
  return { ...state, retry: () => setRetry(n => n + 1) };
}
export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 15000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  return now;
}

// Study timer hook — integrates with the active study session engine
export function useStudyTimer({
  workId,
  workTitle,
  unitId = null,
  unitLabel = null,
  category = 'torah_study',
  source = 'reader',
  tzid = 'Asia/Jerusalem',
  enabled = true,
}) {
  const [session, setSession] = useState(null);
  const interactionRef = useRef(0);
  const isActiveRef = useRef(false);

  // Initialize session on mount
  useEffect(() => {
    if (!enabled || !workId) return;
    const { startStudySession, createPendingSession } = require('./services/studySession.mjs');
    const pending = createPendingSession({ workId, workTitle, unitId, unitLabel, category, source, tzid });
    const started = startStudySession(pending);
    setSession(started);
    isActiveRef.current = true;

    // Record initial interaction
    const { recordInteraction } = require('./services/studySession.mjs');
    recordInteraction();

    // Set up periodic interaction recording (every 30 seconds while active)
    const interval = setInterval(() => {
      if (isActiveRef.current && typeof document !== 'undefined' && !document.hidden) {
        recordInteraction();
      }
    }, 30000);

    // Track visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActiveRef.current = false;
        const { pauseStudySession } = require('./services/studySession.mjs');
        pauseStudySession();
      } else {
        isActiveRef.current = true;
        const { startStudySession, createPendingSession } = require('./services/studySession.mjs');
        const pending = createPendingSession({ workId, workTitle, unitId, unitLabel, category, source, tzid });
        startStudySession(pending);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Track beforeunload to pause
    const handleBeforeUnload = () => {
      const { pauseStudySession } = require('./services/studySession.mjs');
      pauseStudySession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (isActiveRef.current) {
        const { pauseStudySession } = require('./services/studySession.mjs');
        pauseStudySession();
      }
    };
  }, [workId, workTitle, unitId, unitLabel, category, source, tzid, enabled]);

  // Call this on meaningful user interactions (scroll, navigation, etc.)
  const recordInteraction = useCallback(() => {
    if (!enabled || !isActiveRef.current) return;
    interactionRef.current = Date.now();
    const { recordInteraction } = require('./services/studySession.mjs');
    recordInteraction();
  }, [enabled]);

  // Call this when the user explicitly completes a unit
  const completeUnit = useCallback(async () => {
    if (!enabled) return { saved: false };
    const { completeStudySession } = require('./services/studySession.mjs');
    const result = completeStudySession();
    setSession(null);
    isActiveRef.current = false;
    return result;
  }, [enabled]);

  return { session, recordInteraction, completeUnit, isActive: isActiveRef.current };
}
