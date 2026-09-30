// Where the gloss bubble sits: a pure function of the tapped word's rect, the bubble's measured size, the viewport and
// the insets that must stay clear (safe areas, the app's fixed header and tab bar). Above the word by preference, below
// when there is no room above, shifted inward at the edges, never outside the margins. No caret: the bubble is centred
// over the word itself, which is what the eye follows.
export const GLOSS_GEOMETRY = Object.freeze({
  gap: 7, // between the word's glyph box (nikud included) and the bubble
  margin: 10, // from the viewport's usable edges
});

const clamp = (value, min, max) => (max < min ? min : Math.min(Math.max(value, min), max));

export function placeGloss({ anchor, size, viewport, insets = {}, gap = GLOSS_GEOMETRY.gap, margin = GLOSS_GEOMETRY.margin }) {
  const inset = { top: 0, bottom: 0, left: 0, right: 0, ...insets };
  const minLeft = inset.left + margin;
  const maxLeft = viewport.width - inset.right - margin - size.width;
  const centre = (anchor.left + anchor.right) / 2;
  const left = Math.round(clamp(centre - size.width / 2, minLeft, maxLeft));
  const topLimit = inset.top + margin;
  const bottomLimit = viewport.height - inset.bottom - margin;
  const above = anchor.top - gap - size.height;
  const below = anchor.bottom + gap;
  let placement;
  let top;
  if (above >= topLimit) { placement = 'above'; top = above; } else if (below + size.height <= bottomLimit) { placement = 'below'; top = below; } else {
    // Neither side has full room (a word under the header on a short screen): the roomier side, kept inside.
    const roomAbove = anchor.top - topLimit;
    const roomBelow = bottomLimit - anchor.bottom;
    placement = roomAbove >= roomBelow ? 'above' : 'below';
    top = clamp(placement === 'above' ? above : below, topLimit, bottomLimit - size.height);
  }
  return { left, top: Math.round(top), placement };
}

// The bubble's size comes from its GLOSS, never from the tapped word (which decides only where it goes). CSS
// shrink-to-fit is not trusted: a fixed box whose left edge is moved toward the right edge of the screen shrinks to
// its min-content on iOS WebKit (a narrow column, one letter per line). So the width is computed here from the gloss's
// own one-line width, measured once with white-space:nowrap, and set explicitly in pixels:
//   [ X slot | gloss | mirror slot ]  — both slots the same width, so the gloss is centred on the bubble's axis.
// Only a gloss wider than the screen allows is wrapped — at spaces, in a bubble as wide as the safe area.
// textWidth is the gloss element's own width (its 2px side padding included).
export const GLOSS_BOX = Object.freeze({ slot: 30, border: 1, minWidth: 88 });
export function sizeGloss({ textWidth, viewportWidth, insets = {}, margin = GLOSS_GEOMETRY.margin }) {
  const { slot, border, minWidth } = GLOSS_BOX;
  const chrome = 2 * slot + 2 * border;
  const maxWidth = Math.max(minWidth, viewportWidth - (insets.left || 0) - (insets.right || 0) - 2 * margin);
  const natural = Math.ceil(textWidth) + chrome;
  if (natural <= maxWidth) return { width: Math.max(minWidth, natural), wrap: false };
  return { width: Math.floor(maxWidth), wrap: true };
}
