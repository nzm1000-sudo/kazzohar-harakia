import { useEffect, useRef, useState } from 'react';
import { READING_SIZE_EVENT, READING_SIZE_KEY, canGrow, canShrink, clampScale, percentLabel, readScale, scaledSize, stepScale, writeScale } from '../../services/readingSize.mjs';
import { announce } from '../a11yPrimitives.jsx';
import { MinusGlyph, PlusGlyph } from './Glyphs.jsx';

// The reading-text size shared by every reader (services/readingSize.mjs). Every mounted reader follows a change.
export function useReadingScale() {
  const [scale, setScale] = useState(() => readScale());
  useEffect(() => {
    const own = event => setScale(clampScale(event.detail));
    const other = event => { if (event.key === READING_SIZE_KEY) setScale(readScale()); };
    globalThis.addEventListener?.(READING_SIZE_EVENT, own);
    globalThis.addEventListener?.('storage', other);
    return () => { globalThis.removeEventListener?.(READING_SIZE_EVENT, own); globalThis.removeEventListener?.('storage', other); };
  }, []);
  // The latest value is kept in a ref, so two quick taps take two steps (never two writes of the same step).
  const latest = useRef(scale);
  latest.current = scale;
  const set = next => {
    const value = writeScale(typeof next === 'function' ? next(latest.current) : next);
    latest.current = value;
    setScale(value);
    return value;
  };
  return [scale, set];
}

// A reader's text size in px: its own designed base, times the shared reading size.
export function useReadingFont(base) {
  const [scale] = useReadingScale();
  return scaledSize(base, scale);
}

// TextSizeControl — the ONE text-size control of the app: "−  גודל טקסט  +". Never a slider, never א−/א+.
// The minus sits on the left and the plus on the right in every language direction (as on a phone's own stepper),
// the label between them names the pair, and the current size is spoken after every change.
export default function TextSizeControl({ className = '' }) {
  const [scale, setScale] = useReadingScale();
  const change = direction => {
    let changed = false;
    const next = setScale(current => { const value = stepScale(current, direction); changed = value !== current; return value; });
    if (changed) announce(`גודל טקסט ${percentLabel(next)}`);
  };
  return <div className={`ui-text-size${className ? ` ${className}` : ''}`} role="group" aria-label={`גודל טקסט, ${percentLabel(scale)}`} dir="ltr">
    <button type="button" className="ui-text-size-step" aria-label="הקטנת הטקסט" title="הקטנת הטקסט" disabled={!canShrink(scale)} onClick={() => change(-1)}><MinusGlyph /></button>
    <span className="ui-text-size-label" dir="rtl" aria-hidden="true">גודל טקסט</span>
    <button type="button" className="ui-text-size-step" aria-label="הגדלת הטקסט" title="הגדלת הטקסט" disabled={!canGrow(scale)} onClick={() => change(1)}><PlusGlyph /></button>
  </div>;
}
