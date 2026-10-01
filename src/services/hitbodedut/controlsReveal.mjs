// התבודדות — the session's controls behind one golden ring. At rest only the ring shows at the bottom (a hollow gold
// circle, breathing softly); a tap on it reveals the controls (pace, dimming, pause, end), which hide again after a few
// quiet seconds — every touch inside them starts the count again — or at once with another tap on the ring. Pure, with
// injected timers (tests/hitbodedutRing.test.mjs).

export const CONTROLS_HIDE_MS = 6000;   // how long the revealed controls stay without a touch

export function createControlsReveal({ hideAfterMs = CONTROLS_HIDE_MS, onChange = () => {}, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id) } = {}) {
  let open = false;
  let timer = null;
  let held = false;                     // something needs the controls to stay (the end confirmation)
  const stopTimer = () => { if (timer != null) clearTimer(timer); timer = null; };
  const arm = () => { stopTimer(); if (open && !held) timer = setTimer(() => { timer = null; set(false); }, hideAfterMs); };
  const set = next => { if (next === open) return; open = next; if (!open) stopTimer(); onChange(open); };
  return {
    get open() { return open; },
    // The ring: reveals, or hides what is revealed.
    toggle() { if (open) set(false); else { set(true); arm(); } },
    // Reveals (a double tap, coming back to the app) and starts the count again.
    reveal() { set(true); arm(); },
    // A touch or a key inside the revealed controls: the count starts again (nothing happens while hidden).
    touch() { if (open) arm(); },
    hide() { set(false); },
    // While held (the end confirmation is open) the controls never hide by themselves.
    hold(on) { held = Boolean(on); if (held) stopTimer(); else arm(); },
    dispose() { stopTimer(); },
  };
}
