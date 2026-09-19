import { useEffect, useState } from 'react';
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
