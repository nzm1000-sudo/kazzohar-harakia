import { useEffect, useState, useRef, useCallback } from 'react';
import { getEvents, JOURNAL_CHANGE_EVENT } from './services/mitzvotJournal.mjs';
import { computePresenceLevel, computeTodayCategories, computeTodayProgress } from './services/presenceGlow.mjs';
import { computeCircle, mergeAchievements, readAchievements, saveAchievements, syncCircles } from './services/spiritualCircle.mjs';
import * as studySession from './services/studySession.mjs';
import { currentEntryKey, readRouteState, writeRouteState } from './services/scrollRestoration.mjs';
import { noteSearchValue, registerSearchState } from './services/searchReturn.mjs';

// Like useState, but the value belongs to the current history entry: Back to this
// screen brings the value back (selected date, search text…); a new visit starts fresh.
export function useRouteState(name, initial) {
  const initialValue = () => (typeof initial === 'function' ? initial() : initial);
  const load = key => { const saved = key ? readRouteState(key, name) : null; return saved ? saved.value : initialValue(); };
  const [slot, setSlot] = useState(() => { const key = currentEntryKey() || ''; return { key, value: load(key) }; });
  // The same component can stay mounted across two history entries (e.g. one category to another).
  const key = currentEntryKey() || '';
  const current = slot.key === key ? slot : { key, value: load(key) };
  if (current !== slot) setSlot(current);
  useEffect(() => { if (current.key) writeRouteState(current.key, name, current.value); }, [name, current.key, current.value]);
  const setValue = useCallback(next => setSlot(previous => ({ key: previous.key, value: typeof next === 'function' ? next(previous.value) : next })), []);
  return [current.value, setValue];
}
// A search's text (or a filter that only matters while searching): route state that also marks this entry as showing
// results, so opening a result keeps them one Back away (services/searchReturn.mjs). `empty` is the no-search value.
export function useSearchState(name, initial = '', empty = '') {
  registerSearchState(name, empty);
  const [value, setValue] = useRouteState(name, initial);
  const key = currentEntryKey() || '';
  useEffect(() => { if (key) noteSearchValue(key, value); }, [key, value]);
  return [value, setValue];
}
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
const ENGAGE_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'];
const ENGAGE_THROTTLE_MS = 2000;
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
    const pending = studySession.createPendingSession({ workId, workTitle, unitId, unitLabel, category, source, tzid });
    const started = studySession.startStudySession(pending);
    setSession(started);
    isActiveRef.current = true;

    // Record initial interaction
    studySession.recordInteraction();
    interactionRef.current = Date.now();

    // Active time only: the reader's own engagement keeps the timer alive — a scroll, a touch, a click, a key, the wheel.
    // No clock ticks it forward: after three minutes without any of these it stops counting (studySession.mjs), and
    // the idle stretch is dropped. Throttled, so a long scroll writes at most once every two seconds.
    const engage = () => {
      if (!isActiveRef.current || (typeof document !== 'undefined' && document.hidden)) return;
      const at = Date.now();
      if (at - interactionRef.current < ENGAGE_THROTTLE_MS) return;
      interactionRef.current = at;
      studySession.recordInteraction();
    };
    const engageOptions = { capture: true, passive: true };
    for (const type of ENGAGE_EVENTS) window.addEventListener(type, engage, engageOptions);

    // Track visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActiveRef.current = false;
        studySession.pauseStudySession();
      } else {
        isActiveRef.current = true;
        const pending = studySession.createPendingSession({ workId, workTitle, unitId, unitLabel, category, source, tzid });
        studySession.startStudySession(pending);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Track beforeunload to pause
    const handleBeforeUnload = () => {
      studySession.pauseStudySession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      for (const type of ENGAGE_EVENTS) window.removeEventListener(type, engage, engageOptions);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (isActiveRef.current) {
        studySession.pauseStudySession();
      }
    };
  }, [workId, workTitle, unitId, unitLabel, category, source, tzid, enabled]);

  // Call this on meaningful user interactions (scroll, navigation, etc.). Throttled like the listeners above; the
  // pause (leaving, closing) always settles the time up to that moment.
  const recordInteraction = useCallback(() => {
    if (!enabled || !isActiveRef.current) return;
    const at = Date.now();
    if (at - interactionRef.current < ENGAGE_THROTTLE_MS) return;
    interactionRef.current = at;
    studySession.recordInteraction();
  }, [enabled]);

  // Call this when the user explicitly completes a unit
  const completeUnit = useCallback(async () => {
    if (!enabled) return { saved: false };
    const result = studySession.completeStudySession();
    setSession(null);
    isActiveRef.current = false;
    return result;
  }, [enabled]);

  return { session, recordInteraction, completeUnit, isActive: isActiveRef.current };
}

// "מעגל הרוחני" — the single derived snapshot for every ring in the app. Called once (NewApp) and
// passed down; reads the journal only, refreshes when the journal changes or the app returns.
export function useSpiritualPresence({ todayKey, il = true }) {
  const read = () => {
    try {
      const events = getEvents();
      // The ring shows the OPEN circle of lights (services/spiritualCircle.mjs): 72 lights complete it and the next one
      // begins at once; the unfinished one vanishes at Motzaei Shabbat. Completed circles are derived from the journal
      // and kept by a high-water record (never lowered), with the lasting achievements beside it.
      const circle = todayKey ? computeCircle(events, todayKey) : null;
      if (circle) saveAchievements(mergeAchievements(readAchievements(), circle, todayKey));
      const circles = circle ? syncCircles(circle.lifetime) : null;
      return { todayProgress: todayKey ? computeTodayProgress(events, todayKey) : 0, weekProgress: circle ? circle.progress : 0, circle, lifetime: circles ? circles.best : 0, categories: todayKey ? computeTodayCategories(events, todayKey) : { prayer: false, tehillim: false, study: false }, presenceLevel: todayKey ? computePresenceLevel(events, todayKey, { il }) : 'dim' };
    }
    catch { return { todayProgress: 0, weekProgress: 0, circle: null, lifetime: 0, categories: { prayer: false, tehillim: false, study: false }, presenceLevel: 'dim' }; }
  };
  const [snapshot, setSnapshot] = useState(read);
  useEffect(() => {
    const refresh = () => setSnapshot(read());
    refresh();
    const onVisible = () => { if (!document.hidden) refresh(); };
    window.addEventListener(JOURNAL_CHANGE_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener(JOURNAL_CHANGE_EVENT, refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, [todayKey, il]);
  return snapshot;
}
