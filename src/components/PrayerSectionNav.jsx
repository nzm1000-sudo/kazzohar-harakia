import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from './a11yPrimitives.jsx';
import { dockedNavOwner, registerDockedNav, subscribeDockedNav } from '../services/dockedNav.mjs';

// One in-prayer navigation for every prayer: a slim bar pinned under the status bar
// ("הקודם | תוכן | הבא") and a compact sections popover that opens right beneath it.
// Built from the prayer's real sections. `currentIndex` may be a number or a function
// (resolved at tap time, for readers that track position by scroll).
// Items may carry a `group` (e.g. a Talmud chapter): the contents list then shows a heading where each group begins.
// An item with `part` is a named part of the prayer (ברכות השחר): a stop of its own, drawn as the part's centred title.
// Without `items`, the same bar carries a reading's `previous` / `next` ({ title }) alone — "הקודם | הבא" — for
// Tehillim, the library, Zemirot, Halacha… (see ReaderDock in ReaderNavigation.jsx). Either way it is docked in the
// header (services/dockedNav.mjs): one fixed place at the top of every reading, previous and next of equal width.
export default function PrayerSectionNav({ title, items, currentIndex = 0, onSelect, previous = null, next = null, pending = false, label = 'ניווט בתוך התפילה', previousLabel = 'לחלק הקודם בתפילה', nextLabel = 'לחלק הבא בתפילה' }) {
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);
  const popoverRef = useRef(null);
  const resolveIndex = () => (typeof currentIndex === 'function' ? currentIndex() : currentIndex);
  const [shownIndex, setShownIndex] = useState(-1);
  // The header offers a slot (in place of its search) while a Siddur prayer is open.
  const [slot, setSlot] = useState(null);
  useLayoutEffect(() => { setSlot(document.getElementById('kz-head-prayer-slot')); }, []);
  const withContents = Boolean(items && items.length >= 2);
  const pairOnly = !items && Boolean(previous || next);
  // `pending`: the prayer is still being composed — the bar already holds its place (its buttons wait), so the header
  // does not switch from the search to the bar under the reader's eyes.
  const waiting = pending && !withContents && !pairOnly;
  const docked = withContents || pairOnly || waiting;
  // Claim the header's slot while mounted; a bar with a contents list outranks a bare previous / next pair.
  const [dockId, setDockId] = useState(0);
  useLayoutEffect(() => {
    if (!docked) return undefined;
    const registration = registerDockedNav(withContents || waiting ? 1 : 0);
    setDockId(registration.id);
    return () => { registration.release(); setDockId(0); };
  }, [docked, withContents, waiting]);
  const owner = useSyncExternalStore(subscribeDockedNav, dockedNavOwner, dockedNavOwner);
  useEffect(() => {
    if (!open) return undefined;
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView?.({ block: 'center' });
    // Escape inside the popover is useModalFocus's; this catches it when focus has fallen to the page body.
    const onKey = event => { if (event.key === 'Escape' && !popoverRef.current?.contains(document.activeElement)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const [popoverTop, setPopoverTop] = useState(null);
  // The contents list is a modal dialog for assistive technology: focus lands on the current section, Tab stays in the
  // list, Escape closes it and focus returns to "תוכן". The page is not made inert: the scrim beside the popover must
  // keep closing it on a tap (aria-modal already tells a screen reader to stay inside).
  useModalFocus(popoverRef, open, () => setOpen(false), { initialFocus: '[aria-current="true"]', inert: false });
  if (!docked) return null;
  // Another reader's bar holds the header right now (e.g. a prayer flow above its own end-of-reading links).
  if (slot && owner !== dockId) return null;
  if (pairOnly) {
    const pair = <div className={slot ? 'prayer-nav in-header' : 'prayer-nav'}>
      <nav className="prayer-nav-bar is-pair" aria-label={label}>
        <button type="button" onClick={() => previous && onSelect(previous)} disabled={!previous} aria-label={previous ? `הקודם: ${previous.title || previous.label || ''}` : undefined}><span aria-hidden="true">‹</span>הקודם</button>
        <button type="button" onClick={() => next && onSelect(next)} disabled={!next} aria-label={next ? `הבא: ${next.title || next.label || ''}` : undefined}>הבא<span aria-hidden="true">›</span></button>
      </nav>
    </div>;
    return slot ? createPortal(pair, slot) : pair;
  }
  const current = typeof currentIndex === 'number' ? currentIndex : -1;
  const toggle = () => {
    if (!open) {
      setShownIndex(resolveIndex());
      // In the header, open centred on screen just below the header's bottom edge.
      const header = slot?.closest('.shell-head-safe');
      setPopoverTop(header ? header.getBoundingClientRect().bottom + 8 : null);
    }
    setOpen(value => !value);
  };
  const select = item => { setOpen(false); onSelect(item); };
  const step = delta => { setOpen(false); const target = items[resolveIndex() + delta]; if (target) onSelect(target); };
  const marked = open ? shownIndex : current;
  const nav = <div className={slot ? 'prayer-nav in-header' : 'prayer-nav'}>
    <nav className="prayer-nav-bar" aria-label={label} aria-busy={waiting || undefined}>
      <button type="button" onClick={() => step(-1)} disabled={waiting || current === 0} aria-label={current > 0 && items[current - 1] ? `${previousLabel}: ${items[current - 1].title}` : previousLabel}><span aria-hidden="true">‹</span>הקודם</button>
      <button type="button" className="prayer-nav-toc" onClick={toggle} disabled={waiting} aria-expanded={open} aria-haspopup="dialog">תוכן</button>
      <button type="button" onClick={() => step(1)} disabled={waiting || current === items.length - 1} aria-label={current >= 0 && items[current + 1] ? `${nextLabel}: ${items[current + 1].title}` : nextLabel}>הבא<span aria-hidden="true">›</span></button>
    </nav>
    {open && <div className="prayer-nav-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
    {open && <div className="prayer-nav-popover" role="dialog" aria-modal="true" aria-label={`תוכן ${title}`} ref={popoverRef} style={popoverTop === null ? undefined : { position: 'fixed', top: popoverTop }}>
      <p className="prayer-nav-title">{title}</p>
      <ol className="prayer-nav-list" ref={listRef}>
        {items.map((item, index) => [
          item.group && item.group !== items[index - 1]?.group && <li key={`group:${item.group}`} className="prayer-nav-group">{item.group}</li>,
          <li key={item.key} className={item.part ? 'prayer-nav-part' : undefined}><button type="button" aria-current={index === marked ? 'true' : undefined} onClick={() => select(item)}>{item.title}</button></li>,
        ])}
      </ol>
    </div>}
  </div>;
  return slot ? createPortal(nav, slot) : nav;
}
