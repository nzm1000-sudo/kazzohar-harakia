// ArrowMark — THE one arrow of the app (docs/design-system.md › CLAY › Arrows). The owner (2026-10-02): "כל החצים
// באפליקציה: עטופים במעגל עדין בצבע זהב (של הפלטה), כמו במסך שכחתי תוספת". Every navigation arrow, row arrow,
// accordion chevron, stepper and dropdown cue is this mark; no screen types its own ← › ‹ ▾ or draws its own chevron
// (tests/arrowsUnified.test.mjs keeps it so).
//
//   <ArrowMark />                         forward — in a right-to-left page it points left (into the next page/row)
//   <ArrowMark dir="back" />              back — points right (→ in RTL), for "חזרה" and "הקודם"
//   <ArrowMark dir="up" | "down" />       a stepper, a scroll-to-top, an accordion (down; turns up when its fold opens)
//   size="row" (default)                  the 30px disc of a list row / a stepper / a card foot
//   size="inline"                         the 22px disc after the words of a text link
//   as="b"                                the element, when the host's own CSS knows the arrow by its tag
//   className                             the host's own class (its place in the row: margin, order, flex)
//   legacy                                the typed glyph the NON-Clay build keeps (its look is unchanged there)
//   clayOnly                              nothing at all in the non-Clay build (where that screen had no typed arrow:
//                                         its arrow was a CSS chevron or a native marker, which that build keeps)
//
// In the CLAY build (VITE_CLAY=true) it draws one SVG arrow — the same shape and the same 1.4px stroke in every size —
// in a fine ring of the palette's gold over a soft, raised micro disc (styles/clay/arrows.css). The disc is decorative
// and aria-hidden: the host button or link carries the name; a transparent ::after grows the tap target to 44×44px
// without moving the layout. Elsewhere it renders exactly the glyph the screen had before.
import { clayBuildEnabled } from '../../services/clayExperiment.mjs';

const CLAY = clayBuildEnabled();
export const ARROW_DIRECTIONS = Object.freeze(['forward', 'back', 'up', 'down']);
export const ARROW_SIZES = Object.freeze(['row', 'inline']);
// The non-Clay build's glyph for each direction, when the screen does not name its own.
const LEGACY_GLYPH = { forward: '←', back: '→', up: '↑', down: '↓' };
// Drawn pointing left (forward in a right-to-left page); the other directions turn it (arrows.css).
export const ARROW_PATH = 'M18 12H6.5M11.5 7 6.5 12l5 5';

export default function ArrowMark({ dir = 'forward', size = 'row', as: Tag = 'span', className, legacy, clayOnly = false }) {
  const direction = ARROW_DIRECTIONS.includes(dir) ? dir : 'forward';
  if (!CLAY && clayOnly) return null;
  if (!CLAY) return <Tag className={className || undefined} aria-hidden="true">{legacy ?? LEGACY_GLYPH[direction]}</Tag>;
  return <Tag className={`arrow-mark${className ? ` ${className}` : ''}`} data-dir={direction} data-size={ARROW_SIZES.includes(size) ? size : 'row'} aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d={ARROW_PATH} /></svg>
  </Tag>;
}
