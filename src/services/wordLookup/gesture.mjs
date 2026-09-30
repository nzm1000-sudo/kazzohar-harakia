// The dismiss-first tap machine of the word lookup — pure (no DOM), so every rule is tested on its own.
//
// STATE A (no bubble): a short tap on a known word opens it and consumes the tap (the verse / passage under it does
//   not open); an unknown word or any other place: nothing here, the reader's own behaviour goes on.
// STATE B (bubble open): any press outside the bubble closes it at once (pointerdown, capture phase) and the whole
//   gesture is consumed — its pointerdown, its touch and mouse compatibility events, its click, a late synthesized
//   click and a double-click — so nothing behind opens (no other word, no commentary, no navigation, no selection of
//   a verse). A scroll that starts outside closes the bubble and keeps scrolling (nothing is prevented but the click).
//   A press inside the bubble's body does nothing; the X closes it.
// The next gesture is a new one: it is never eaten by an earlier dismissal (gestures are numbered).
export const TAP = Object.freeze({
  moveTolerance: 10, // px: more than this between down and up is a scroll or a drag, not a tap
  longPress: 550, // ms: a longer press belongs to the system (selection, loupe), not to the dictionary
  lateClick: 700, // ms: a click this long after a dismissing press, near it, is that press's synthesized click
  lateClickDistance: 30, // px
});

export function createGestureMachine({ now = () => Date.now() } = {}) {
  let open = false;
  let gesture = 0;
  let down = null; // { gesture, x, y, t, moved }
  let swallow = null; // { gesture, x, y, t }
  const near = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) <= d;
  return {
    get isOpen() { return open; },
    get swallowing() { return swallow; },
    opened() { open = true; },
    closed() { open = false; },
    // Returns { close, consume }.
    pointerDown({ x, y, insideBubble = false }) {
      gesture += 1;
      down = { gesture, x, y, t: now(), moved: false };
      if (open && !insideBubble) {
        open = false;
        swallow = { gesture, x, y, t: now() };
        return { close: true, consume: true };
      }
      if (!open) swallow = null;
      return { close: false, consume: false };
    },
    pointerMove({ x, y }) {
      if (down && !down.moved && !near(down, { x, y }, TAP.moveTolerance)) down.moved = true;
      return { close: false, consume: Boolean(swallow && down && swallow.gesture === down.gesture) };
    },
    // Compatibility events of the same gesture (touchstart/touchend, mousedown/mouseup, pointerup, contextmenu).
    companion() { return { consume: Boolean(swallow && down && swallow.gesture === down.gesture) }; },
    // Should a touchend of a dismissing gesture be prevented (no synthesized click, no focus)? Only a tap — a scroll
    // keeps its native end.
    preventTouchEnd() { return Boolean(swallow && down && swallow.gesture === down.gesture && !down.moved); },
    // Returns { consume, lookup, close }: lookup = the caller may open the word under the click.
    click({ x, y, insideBubble = false, keyboard = false, selection = false }) {
      const t = now();
      if (swallow && ((down && swallow.gesture === down.gesture) || (t - swallow.t <= TAP.lateClick && near(swallow, { x, y }, TAP.lateClickDistance)))) {
        swallow = null;
        return { consume: true, lookup: false, close: false };
      }
      if (open) {
        if (insideBubble) return { consume: false, lookup: false, close: false }; // the body is inert; the X handles itself
        // A click with no press before it (an assistive-technology activation): dismiss-first as well.
        open = false;
        return { consume: true, lookup: false, close: true };
      }
      if (keyboard || selection) return { consume: false, lookup: false, close: false };
      const tap = !down || (!down.moved && t - down.t <= TAP.longPress);
      return { consume: false, lookup: tap, close: false };
    },
    // A late double-click of a dismissing gesture.
    dblclick() { return { consume: Boolean(swallow) || open }; },
  };
}
