// השעון היהודי — the small shared parts: a switch, a segmented control of equal parts, a subtle haptic, and a sheet.
import { useEffect, useRef } from 'react';
import { useModalFocus } from '../a11yPrimitives.jsx';
import { hapticsAllowed } from '../../services/accessibility/preferences.mjs';

// A light tap on iOS / Android (the same native bridge the prayer compass uses); nothing on the web.
// Non-essential: silent when the reader turned haptics off in נגישות.
export function haptic() {
  try {
    if (!hapticsAllowed()) return;
    if (window.KZHeading?.haptic) window.KZHeading.haptic();
    else window.webkit?.messageHandlers?.kzHeading?.postMessage({ action: 'haptic' });
  } catch { /* no haptics here */ }
}

export function AlarmSwitch({ checked, onChange, label }) {
  return <button type="button" role="switch" aria-checked={Boolean(checked)} aria-label={label} className={`ja-switch${checked ? ' is-on' : ''}`} onClick={() => { haptic(); onChange(!checked); }}>
    <span className="ja-switch-track" aria-hidden="true"><span className="ja-switch-thumb" /></span>
  </button>;
}

// Equal-width parts, one row; `options`: [[value, label, sublabel?]].
export function Segmented({ value, options, onChange, label, className = '' }) {
  return <div className={`ja-seg ${className}`} role="radiogroup" aria-label={label} style={{ '--ja-parts': options.length }}>
    {options.map(([key, text, sub]) => <button type="button" key={String(key)} role="radio" aria-checked={value === key} className={value === key ? 'is-on' : ''} onClick={() => onChange(key)}>
      <span>{text}</span>{sub && <small>{sub}</small>}
    </button>)}
  </div>;
}

// A small centred sheet. Closes on the backdrop, Escape and the Android back button (NewApp's overlay close).
// A modal dialog for assistive technology: focus moves in (its field, else its first button), Tab stays inside, the page
// behind is inert, and focus returns to the control that opened it.
export function AlarmSheet({ title, onClose, children, labelledBy = 'ja-sheet-title' }) {
  const panel = useRef(null);
  useModalFocus(panel, true, onClose, { initialFocus: 'input' });
  useEffect(() => {
    // Escape inside the sheet is handled by useModalFocus; this catches it when focus has fallen to the page body.
    const onKey = event => { if (event.key === 'Escape' && !panel.current?.contains(document.activeElement)) onClose(); };
    const onBack = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('kz-native-close-overlay', onBack);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('kz-native-close-overlay', onBack); };
  }, [onClose]);
  return <div className="ja-sheet-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="ja-sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panel}>
      <h2 id={labelledBy}>{title}</h2>
      {children}
    </div>
  </div>;
}
