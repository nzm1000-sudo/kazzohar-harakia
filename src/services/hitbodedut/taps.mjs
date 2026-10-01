// התבודדות — the touch rules of the dark session (pure; tests/hitbodedutTaps.test.mjs):
//   · a DOUBLE tap anywhere lights up the controls and the clock for a few seconds;
//   · a single tap on the background does nothing — so a hand resting on the phone never disturbs the session;
//   · on the Tehillim wheel a single tap (once it is clear no second tap follows) holds / lets go of the wheel.
// A "tap" is a short touch that barely moved (a swipe is not a tap). Timers are injected so the tests run instantly.

export const DOUBLE_TAP_MS = 320;     // the most time between the two taps
export const TAP_SLOP_PX = 28;        // the most distance between the two taps
export const TAP_MAX_MS = 350;        // a longer touch is a hold, not a tap
export const TAP_MOVE_PX = 12;        // a touch that moved further is a swipe
export const REVEAL_MS = 5000;        // how long the controls stay lit

// Whether a touch (down → up) was a tap.
export function isTap(down, up) {
  if (!down || !up) return false;
  const moved = Math.hypot((up.x ?? 0) - (down.x ?? 0), (up.y ?? 0) - (down.y ?? 0));
  return moved <= TAP_MOVE_PX && (up.t ?? 0) - (down.t ?? 0) <= TAP_MAX_MS;
}

export function createTapDetector({ onDouble = () => {}, onSingle = null, windowMs = DOUBLE_TAP_MS, slopPx = TAP_SLOP_PX, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id) } = {}) {
  let pending = null;   // { x, y, t, timer }
  const clear = () => { if (pending?.timer != null) clearTimer(pending.timer); pending = null; };
  return {
    // A tap at (x, y) at time t (ms). Returns 'double' or 'pending' (a single tap, waiting to see if a second follows).
    tap({ x = 0, y = 0, t = Date.now(), single = onSingle } = {}) {
      if (pending && t - pending.t <= windowMs && Math.hypot(x - pending.x, y - pending.y) <= slopPx) {
        clear();
        onDouble();
        return 'double';
      }
      clear();
      const timer = single ? setTimer(() => { pending = null; single(); }, windowMs) : null;
      pending = { x, y, t, timer };
      return 'pending';
    },
    cancel: clear,
    get pending() { return Boolean(pending); },
  };
}
