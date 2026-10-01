// useAutoScroll — the React face of services/autoScroll.mjs, shared by every reader (and by התבודדות's Tehillim).
//
//   const auto = useAutoScroll(scrollContainerRef | null, { speed: 'slow' | 'medium' | 'fast' | pxPerSecond, enabled, autoStart })
//   → { running, paused, state, start, pause, resume, stop, setSpeed, speed, preset }
//
// null scrolls the page itself (window). Off until started: `autoStart` only starts it when neither the device nor the
// app (data-a11y-motion) asks for reduced motion. A touch, the wheel, a key or dragging the page pauses it (the
// control itself is excluded: anything inside [data-autoscroll-control]); it resumes from the control's button.
// Leaving the app pauses it. The last speed is remembered on this device. It never moves focus and announces nothing
// (no aria-live), so a screen reader's own reading is never disturbed. Everything is released on unmount.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createAutoScroller, presetOf, prefersReducedMotion, readStoredSpeed, resolveSpeed, scrollTargetOf, storeSpeed, STATE } from '../services/autoScroll.mjs';

const INTERRUPTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
export const AUTOSCROLL_CONTROL_ATTR = 'data-autoscroll-control';
const RUNNING_ATTR = 'data-kz-autoscroll';

export function useAutoScroll(containerRef = null, { speed: initialSpeed = 'medium', enabled = true, autoStart = false } = {}) {
  const [state, setState] = useState(STATE.IDLE);
  const [speed, setSpeedState] = useState(() => readStoredSpeed() ?? resolveSpeed(initialSpeed));
  const scrollerRef = useRef(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const element = containerRef && 'current' in containerRef ? containerRef.current : null;
    if (containerRef && !element) return undefined;
    const scroller = createAutoScroller({
      target: scrollTargetOf(element, window),
      speed: speedRef.current,
      onChange: ({ state: next }) => {
        setState(next);
        if (next === STATE.RUNNING) document.documentElement.setAttribute(RUNNING_ATTR, '');
        else document.documentElement.removeAttribute(RUNNING_ATTR);
      },
    });
    scrollerRef.current = scroller;
    const root = element || window;
    const interrupt = event => {
      if (scroller.state !== STATE.RUNNING) return;
      const node = event.target;
      if (node && typeof node.closest === 'function' && node.closest(`[${AUTOSCROLL_CONTROL_ATTR}]`)) return;
      if (event.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
      scroller.pause('interrupt');
    };
    const options = { passive: true, capture: true };
    for (const type of INTERRUPTS) (type === 'keydown' ? window : root).addEventListener(type, interrupt, options);
    const hidden = () => { if (document.hidden) scroller.pause('hidden'); };
    document.addEventListener('visibilitychange', hidden);
    if (autoStart && !prefersReducedMotion(window)) scroller.start();
    return () => {
      for (const type of INTERRUPTS) (type === 'keydown' ? window : root).removeEventListener(type, interrupt, options);
      document.removeEventListener('visibilitychange', hidden);
      scroller.destroy();
      document.documentElement.removeAttribute(RUNNING_ATTR);
      if (scrollerRef.current === scroller) scrollerRef.current = null;
      setState(STATE.IDLE);
    };
  }, [enabled, containerRef, autoStart]);

  const start = useCallback(() => scrollerRef.current?.start() ?? false, []);
  const pause = useCallback(() => scrollerRef.current?.pause(), []);
  const resume = useCallback(() => scrollerRef.current?.resume() ?? false, []);
  const stop = useCallback(() => scrollerRef.current?.stop(), []);
  const setSpeed = useCallback(value => {
    const next = resolveSpeed(value, speedRef.current);
    scrollerRef.current?.setSpeed(next);
    setSpeedState(next);
    storeSpeed(next);
    return next;
  }, []);

  return { state, running: state === STATE.RUNNING, paused: state === STATE.PAUSED, start, pause, resume, stop, setSpeed, speed, preset: presetOf(speed) };
}

export default useAutoScroll;
