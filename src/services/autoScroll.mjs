// Auto-Scroll — the one engine every reader shares (Siddur, Tehillim, the library, Shnayim Mikra, התבודדות).
// Pure: the clock, the frame scheduler and the scroll target are injected, so the tests drive it with a fake clock.
//
// Motion: requestAnimationFrame, never setInterval. Each frame adds speed × elapsed to a floating-point position and
// writes the rounded position — the fraction is carried to the next frame (sub-pixel accumulation), so a slow speed
// moves one pixel every few frames, evenly, with no jumps. A long gap (the app was in the background) is clamped to
// one short step. If something else moved the page (the reader dragged it, a heading opened), the engine re-anchors
// at the new place instead of pulling the text back. At the end of the text it stops by itself.
//
// Speeds are pixels per second; the three named speeds are calm reading paces.
export const SPEED_PRESETS = Object.freeze({ slow: 14, medium: 26, fast: 44 });
export const SPEED_MIN = 6;
export const SPEED_MAX = 90;
export const DEFAULT_SPEED = SPEED_PRESETS.medium;
export const SPEED_KEY = 'kz-autoscroll-v1';
const MAX_FRAME_MS = 100;
const DRIFT_PX = 3;

export const STATE = Object.freeze({ IDLE: 'idle', RUNNING: 'running', PAUSED: 'paused' });

// 'slow' | 'medium' | 'fast' | a number → a speed in px/s within the allowed range.
export function resolveSpeed(value, fallback = DEFAULT_SPEED) {
  const raw = typeof value === 'string' && Object.prototype.hasOwnProperty.call(SPEED_PRESETS, value) ? SPEED_PRESETS[value] : Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, raw));
}
// The named speed a value is (for the control's label), or null for a speed set on the fine slider.
export function presetOf(speed) {
  const entry = Object.entries(SPEED_PRESETS).find(([, value]) => value === speed);
  return entry ? entry[0] : null;
}

// The remembered speed (a per-viewer convenience; any failure falls back to the default).
export function readStoredSpeed(storage = safeStorage()) {
  try { const saved = JSON.parse(storage?.getItem(SPEED_KEY) || 'null'); return saved && Number.isFinite(saved.speed) ? resolveSpeed(saved.speed) : null; } catch { return null; }
}
export function storeSpeed(speed, storage = safeStorage()) {
  try { storage?.setItem(SPEED_KEY, JSON.stringify({ v: 1, speed: resolveSpeed(speed) })); } catch { /* private mode / full */ }
}
function safeStorage() { try { return globalThis.localStorage || null; } catch { return null; } }

/**
 * createAutoScroller({ target, now, requestFrame, cancelFrame, speed, onChange })
 *   target: { get(): number, set(top: number): void, max(): number } — the scroll position and its end.
 * Returns { start, pause, resume, stop, setSpeed, destroy, get state, get speed, step(at) }.
 */
// Scrollers moving the page right now. The study timer asks this so that the app's own movement is never counted as
// the reader's engagement (only a real touch, key or wheel is) — unattended auto-scroll adds no study time.
const RUNNING_SCROLLERS = new Set();
export const isAutoScrolling = () => RUNNING_SCROLLERS.size > 0;
export const runningAutoScrollers = () => RUNNING_SCROLLERS.size;

export function createAutoScroller({
  target,
  now = () => (globalThis.performance?.now?.() ?? Date.now()),
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = handle => globalThis.cancelAnimationFrame(handle),
  speed = DEFAULT_SPEED,
  onChange = () => {},
} = {}) {
  let state = STATE.IDLE;
  let pxPerSecond = resolveSpeed(speed);
  let position = 0; // the exact (fractional) position
  let written = 0; // the last whole position written
  let last = 0;
  let handle = null;
  let destroyed = false;

  const token = {};
  const track = () => { if (state === STATE.RUNNING && !destroyed) RUNNING_SCROLLERS.add(token); else RUNNING_SCROLLERS.delete(token); };
  const emit = (reason = null) => { track(); onChange({ state, speed: pxPerSecond, reason }); };
  const schedule = () => { if (handle === null && !destroyed) handle = requestFrame(frame); };
  const unschedule = () => { if (handle !== null) { cancelFrame(handle); handle = null; } };
  const anchor = () => { position = target.get(); written = Math.round(position); last = now(); };
  const atEnd = () => target.get() >= target.max() - 1;

  function frame(at) {
    handle = null;
    if (state !== STATE.RUNNING || destroyed) return;
    step(typeof at === 'number' ? at : now());
    if (state === STATE.RUNNING) schedule();
  }
  // One frame's movement (exported for the tests' fake clock).
  function step(at) {
    if (state !== STATE.RUNNING) return;
    const current = target.get();
    // Moved by something else since the last write → continue from there.
    if (Math.abs(current - written) > DRIFT_PX) { position = current; written = Math.round(current); }
    const elapsed = Math.min(MAX_FRAME_MS, Math.max(0, at - last));
    last = at;
    const end = target.max();
    position = Math.min(end, position + (pxPerSecond * elapsed) / 1000);
    const next = Math.round(position);
    if (next !== written) { written = next; target.set(next); }
    if (position >= end - 0.5) { state = STATE.IDLE; unschedule(); emit('end'); }
  }

  return {
    get state() { return state; },
    get speed() { return pxPerSecond; },
    start() {
      if (destroyed) return false;
      if (atEnd()) { emit('end'); return false; }
      anchor();
      state = STATE.RUNNING;
      schedule();
      emit('start');
      return true;
    },
    pause(reason = 'pause') {
      if (state !== STATE.RUNNING) return;
      state = STATE.PAUSED;
      unschedule();
      emit(reason);
    },
    resume() {
      if (destroyed || state !== STATE.PAUSED) return false;
      if (atEnd()) { state = STATE.IDLE; emit('end'); return false; }
      anchor();
      state = STATE.RUNNING;
      schedule();
      emit('resume');
      return true;
    },
    stop() {
      if (state === STATE.IDLE) return;
      state = STATE.IDLE;
      unschedule();
      emit('stop');
    },
    setSpeed(value) {
      pxPerSecond = resolveSpeed(value, pxPerSecond);
      emit('speed');
      return pxPerSecond;
    },
    destroy() { destroyed = true; state = STATE.IDLE; unschedule(); track(); },
    step,
  };
}

// The scroll target of a scrolling element, or of the page (window) when `element` is null.
export function scrollTargetOf(element, win = globalThis.window) {
  if (element) return { get: () => element.scrollTop, set: top => { element.scrollTop = top; }, max: () => Math.max(0, element.scrollHeight - element.clientHeight) };
  const doc = win.document;
  const scroller = () => doc.scrollingElement || doc.documentElement;
  return { get: () => win.scrollY ?? scroller().scrollTop, set: top => win.scrollTo(0, top), max: () => Math.max(0, scroller().scrollHeight - win.innerHeight) };
}

// Should auto-start be held back? The device's reduce-motion request or the app's own (data-a11y-motion on <html>,
// services/accessibility). Starting by hand always works — this only blocks starting by itself.
export function prefersReducedMotion(win = globalThis.window) {
  try {
    if (win?.document?.documentElement?.hasAttribute('data-a11y-motion')) return true;
    return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch { return false; }
}
