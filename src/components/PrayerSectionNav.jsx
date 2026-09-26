import { useState } from 'react';

// One in-prayer navigation for every prayer: a compact "הקודם | תוכן | הבא" bar and a
// sections panel, built from the prayer's real sections. `currentIndex` may be a number
// or a function (resolved at tap time, for readers that track position by scroll).
export default function PrayerSectionNav({ title, items, currentIndex = 0, onSelect }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length < 2) return null;
  const resolveIndex = () => (typeof currentIndex === 'function' ? currentIndex() : currentIndex);
  const current = typeof currentIndex === 'number' ? currentIndex : -1;
  const select = item => { setOpen(false); onSelect(item); };
  const step = delta => { const target = items[resolveIndex() + delta]; if (target) onSelect(target); };
  return <>
    {open && <div className="prayer-toc-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
    {open && <aside className="prayer-toc-panel" role="dialog" aria-label="תוכן התפילה" aria-modal="true">
      <header className="prayer-toc-header">
        <h2 className="prayer-toc-title">{title}</h2>
        <button type="button" className="prayer-toc-close" onClick={() => setOpen(false)} aria-label="סגירת תוכן התפילה">✕</button>
      </header>
      <div className="prayer-toc-list">
        {items.map((item, index) => <button key={item.key} type="button" className="prayer-toc-item" aria-current={index === current ? 'true' : undefined} onClick={() => select(item)}>{item.title}</button>)}
      </div>
    </aside>}
    {!open && <nav className="prayer-quicknav" aria-label="ניווט בתוך התפילה">
      <button type="button" onClick={() => step(-1)} disabled={current === 0} aria-label="לחלק הקודם בתפילה"><span aria-hidden="true">→</span> הקודם</button>
      <button type="button" className="prayer-quicknav-toc" onClick={() => setOpen(true)} aria-expanded={open}>תוכן</button>
      <button type="button" onClick={() => step(1)} disabled={current === items.length - 1} aria-label="לחלק הבא בתפילה">הבא <span aria-hidden="true">←</span></button>
    </nav>}
  </>;
}
