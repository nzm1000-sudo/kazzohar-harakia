import { useEffect, useRef, useState } from 'react';
import { NUSACHIM, nusachTitle } from '../data/nusach/registry.mjs';

// The rite indicator of the Siddur home ("נוסח: עדות המזרח"): a small control that opens a compact chooser — four
// rows, each a distinct tradition, with a word of context. Nothing about the choice is inferred; it is the user's.
export default function NusachSelector({ value, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);
  useEffect(() => { if (open) listRef.current?.querySelector('[aria-checked="true"]')?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const close = event => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  return <div className={`nusach-selector${compact ? ' is-compact' : ''}`}>
    <button type="button" className="nusach-indicator" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}>
      <span className="nusach-indicator-label">נוסח</span><strong>{nusachTitle(value)}</strong><span className="nusach-chevron" aria-hidden="true">›</span>
    </button>
    {open && <div className="nusach-menu" role="listbox" aria-label="בחירת נוסח התפילה" ref={listRef}>
      {NUSACHIM.map(item => <button type="button" role="option" key={item.id} aria-checked={item.id === value} className={`nusach-option${item.id === value ? ' is-selected' : ''}`} onClick={() => { onChange(item.id); setOpen(false); }}>
        <span className="nusach-option-mark" aria-hidden="true">{item.id === value ? '✓' : ''}</span>
        <span className="nusach-option-text"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
      </button>)}
    </div>}
  </div>;
}

// The one-time question for a new install ("מהו נוסח התפילה שלך?"): four choices, changeable later in the settings.
export function NusachOnboarding({ value, onChoose, onDismiss }) {
  return <section className="nusach-onboarding" aria-label="בחירת נוסח התפילה">
    <p className="eyebrow">פעם אחת, ואפשר לשנות בכל עת</p>
    <h2>מהו נוסח התפילה שלך?</h2>
    <div className="nusach-onboarding-grid" role="radiogroup" aria-label="נוסח התפילה">
      {NUSACHIM.map(item => <button type="button" role="radio" aria-checked={item.id === value} key={item.id} className={item.id === value ? 'is-selected' : undefined} onClick={() => onChoose(item.id)}>
        <strong>{item.title}</strong><small>{item.subtitle}</small>
      </button>)}
    </div>
    <p className="nusach-onboarding-note">נוסח ספרד הוא נוסח החסידים; נוסח עדות המזרח הוא נוסח הספרדים ועדות המזרח — שני נוסחים שונים.</p>
    <button type="button" className="link" onClick={onDismiss}>להשאיר {nusachTitle(value)} ←</button>
  </section>;
}
