// The app's small line glyphs (docs/design-system.md › Icons): drawn, never typed characters (✕ × ♥ ♡ א+ differ from
// font to font). 1.6px strokes in currentColor, so every one takes its button's colour in light, dark and high contrast.
const svg = { viewBox: '0 0 20 20', width: 18, height: 18, 'aria-hidden': 'true', focusable: 'false' };
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const CloseGlyph = ({ size = 16 }) => <svg {...svg} width={size} height={size} className="ui-glyph"><path d="M6 6l8 8M14 6l-8 8" {...stroke} /></svg>;
export const MinusGlyph = ({ size = 18 }) => <svg {...svg} width={size} height={size} className="ui-glyph"><path d="M5 10h10" {...stroke} /></svg>;
export const PlusGlyph = ({ size = 18 }) => <svg {...svg} width={size} height={size} className="ui-glyph"><path d="M5 10h10M10 5v10" {...stroke} /></svg>;
