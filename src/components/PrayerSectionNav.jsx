import { useEffect, useRef, useState } from 'react';

// One in-prayer navigation for every prayer: a slim bar pinned under the status bar
// ("הקודם | תוכן | הבא") and a compact sections popover that opens right beneath it.
// Built from the prayer's real sections. `currentIndex` may be a number or a function
// (resolved at tap time, for readers that track position by scroll).
export default function PrayerSectionNav({ title, items, currentIndex = 0, onSelect }) {
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);
  const resolveIndex = () => (typeof currentIndex === 'function' ? currentIndex() : currentIndex);
  const [shownIndex, setShownIndex] = useState(-1);
  useEffect(() => {
    if (!open) return undefined;
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView?.({ block: 'center' });
    const onKey = event => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!items || items.length < 2) return null;
  const current = typeof currentIndex === 'number' ? currentIndex : -1;
  const toggle = () => { if (!open) setShownIndex(resolveIndex()); setOpen(value => !value); };
  const select = item => { setOpen(false); onSelect(item); };
  const step = delta => { setOpen(false); const target = items[resolveIndex() + delta]; if (target) onSelect(target); };
  const marked = open ? shownIndex : current;
  return <div className="prayer-nav">
    <nav className="prayer-nav-bar" aria-label="ניווט בתוך התפילה">
      <button type="button" onClick={() => step(-1)} disabled={current === 0} aria-label="לחלק הקודם בתפילה"><span aria-hidden="true">‹</span>הקודם</button>
      <button type="button" className="prayer-nav-toc" onClick={toggle} aria-expanded={open} aria-haspopup="dialog">תוכן</button>
      <button type="button" onClick={() => step(1)} disabled={current === items.length - 1} aria-label="לחלק הבא בתפילה">הבא<span aria-hidden="true">›</span></button>
    </nav>
    {open && <div className="prayer-nav-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
    {open && <div className="prayer-nav-popover" role="dialog" aria-label={`תוכן ${title}`}>
      <p className="prayer-nav-title">{title}</p>
      <ol className="prayer-nav-list" ref={listRef}>
        {items.map((item, index) => <li key={item.key}>
          <button type="button" aria-current={index === marked ? 'true' : undefined} onClick={() => select(item)}>{item.title}</button>
        </li>)}
      </ol>
    </div>}
  </div>;
}
