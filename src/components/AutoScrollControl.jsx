// גלילה אוטומטית — one small control, the same in every reader. Off by default: a quiet button among the reader's
// tools; once started, a slim bar docks at the bottom edge (above the tab bar, never over the reader's tools) with
// pause / resume, the speed (a compact popover: איטי · בינוני · מהיר and a fine slider) and close. The page gets room
// at its end while the bar is open, so the last lines are never under it. Engine: services/autoScroll.mjs.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAutoScroll, AUTOSCROLL_CONTROL_ATTR } from '../hooks/useAutoScroll.js';
import { SPEED_MAX, SPEED_MIN, SPEED_PRESETS } from '../services/autoScroll.mjs';
import { CloseGlyph } from './ui/Glyphs.jsx';
// Its styles: styles/autoscroll.css, imported once by NewApp.jsx with the app's other global styles.

const PRESET_LABEL = { slow: 'איטי', medium: 'בינוני', fast: 'מהיר' };
const OPEN_ATTR = 'data-kz-autoscroll-open';
const control = { [AUTOSCROLL_CONTROL_ATTR]: '' };

export function AutoScrollGlyph() {
  return <svg className="autoscroll-glyph" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6 5.5 10 9.5l4-4M6 10.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
const PauseGlyph = () => <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M7.5 5v10M12.5 5v10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
const PlayGlyph = () => <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M13.5 5.2v9.6L6.2 10z" fill="currentColor" /></svg>;

/** The reader's button plus, while a session is open, the docked bar. `scrollRef`: null for the page itself. */
export default function AutoScrollControl({ scrollRef = null, className = '' }) {
  const auto = useAutoScroll(scrollRef, { speed: 'medium' });
  const [open, setOpen] = useState(false); // a session: from start until close / the end of the text
  const [speedOpen, setSpeedOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverId = useId();
  const popRef = useRef(null);
  useEffect(() => { if (open && auto.state === 'idle') { setOpen(false); setSpeedOpen(false); } }, [auto.state, open]);
  useEffect(() => {
    if (!open) return undefined;
    document.documentElement.setAttribute(OPEN_ATTR, '');
    return () => document.documentElement.removeAttribute(OPEN_ATTR);
  }, [open]);
  useEffect(() => {
    if (!speedOpen) return undefined;
    const outside = event => { if (popRef.current && !popRef.current.contains(event.target) && !event.target.closest?.('.autoscroll-speed')) setSpeedOpen(false); };
    const key = event => { if (event.key === 'Escape') setSpeedOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [speedOpen]);
  const begin = () => { if (open) { close(); return; } if (auto.start()) setOpen(true); };
  const close = () => { auto.stop(); setOpen(false); setSpeedOpen(false); triggerRef.current?.focus({ preventScroll: true }); };
  const toggle = () => (auto.running ? auto.pause() : auto.resume());
  const speedLabel = PRESET_LABEL[auto.preset] || 'מותאם';
  const bar = open && typeof document !== 'undefined' ? createPortal(
    <div className="autoscroll-bar" role="toolbar" aria-label="גלילה אוטומטית" {...control}>
      <button type="button" className="autoscroll-play" onClick={toggle} aria-label={auto.running ? 'השהיית הגלילה' : 'המשך הגלילה'}>{auto.running ? <PauseGlyph /> : <PlayGlyph />}</button>
      <button type="button" className="autoscroll-speed" aria-expanded={speedOpen} aria-controls={popoverId} onClick={() => setSpeedOpen(value => !value)}><span className="autoscroll-speed-caption">מהירות</span><span>{speedLabel}</span></button>
      <button type="button" className="autoscroll-close" onClick={close} aria-label="סגירת הגלילה האוטומטית"><CloseGlyph /></button>
      {speedOpen && <div ref={popRef} id={popoverId} className="autoscroll-popover" role="group" aria-label="מהירות הגלילה">
        <div className="autoscroll-presets" role="radiogroup" aria-label="מהירות">
          {Object.keys(SPEED_PRESETS).map(id => <button key={id} type="button" role="radio" aria-checked={auto.preset === id} className={auto.preset === id ? 'on' : ''} onClick={() => auto.setSpeed(id)}>{PRESET_LABEL[id]}</button>)}
        </div>
        <label className="autoscroll-fine"><span>כוונון עדין</span><input type="range" min={SPEED_MIN} max={SPEED_MAX} step="1" value={Math.round(auto.speed)} onChange={event => auto.setSpeed(Number(event.target.value))} aria-valuetext={`${speedLabel}`} /></label>
      </div>}
    </div>, document.body) : null;
  return <>
    <button ref={triggerRef} type="button" className={`autoscroll-trigger${className ? ` ${className}` : ''}`} aria-pressed={open} onClick={begin} {...control}><AutoScrollGlyph /><span>גלילה אוטומטית</span></button>
    {bar}
  </>;
}
