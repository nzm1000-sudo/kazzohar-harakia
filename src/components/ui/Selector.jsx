import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '../a11yPrimitives.jsx';
import ClearableInput from '../ClearableInput.jsx';
import { CloseButton } from './IconButton.jsx';
import { CheckGlyph, ChevronGlyph } from './Glyphs.jsx';
import { filterOptions, nextIndex, normalizeOptions, plainText as plain, sameValue, wantsSearch } from './selectorLogic.mjs';
import ArrowMark from './ArrowMark.jsx';

export { filterOptions, nextIndex, normalizeOptions, sameValue, wantsSearch };

// Selector — the ONE way to choose one value from a list (docs/design-system.md › Selector). Never a native <select>.
// A framed trigger (a full-width field, or a compact chip in a filter row) opens a sheet: from the bottom on a phone,
// a popover under the trigger on a wide screen. Large rows, a drawn check on the chosen one, a search field when the
// list is long, a grid for short symbols (days, letters, digits). Keyboard: arrows, Home / End, Page Up / Down, Enter,
// typing a letter; Tab stays inside, Escape and the Android back button close it, and focus returns to the trigger.
// `options`: [[value, label, hint?]] or [{ value, label, hint, wide }] or plain values (`wide`: a whole grid row, e.g.
// "כל האותיות"). `onChange` receives the option's own value (a number stays a number). `label` names the control (and
// the sheet); `shownLabel` is the shorter visible caption when the name needs more words to be unique ("תזכורת" shown,
// "תזכורת עבור …" spoken).

const wide = () => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 700px)').matches;
const still = () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-a11y-motion'));

export default function Selector({
  label, shownLabel = label, value, options, onChange, variant = 'field', hideLabel = false, placeholder = 'בחירה', disabled = false,
  searchable, columns = 1, defaultValue, title, className = '', triggerClassName = '',
}) {
  const items = useMemo(() => normalizeOptions(options), [options]);
  const current = items.find(item => sameValue(item.value, value));
  const [open, setOpen] = useState(false);
  const uid = `ui-sel-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const trigger = useRef(null);
  const shown = current ? current.label : placeholder;
  const changed = defaultValue !== undefined && current && !sameValue(current.value, defaultValue);
  const search = searchable ?? wantsSearch(items.length, columns);
  return <div className={`ui-select is-${variant}${changed ? ' is-changed' : ''}${className ? ` ${className}` : ''}`}>
    {variant === 'field' && !hideLabel && <span className="ui-select-label" aria-hidden="true">{shownLabel}</span>}
    <button ref={trigger} type="button" className={`ui-select-trigger${triggerClassName ? ` ${triggerClassName}` : ''}`} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? `${uid}-list` : undefined} aria-label={`${label}, ${shown}`} disabled={disabled} onClick={() => setOpen(true)}>
      {variant === 'chip' && <span className="ui-select-chip-label" aria-hidden="true">{shownLabel}</span>}
      <span className={`ui-select-value${current ? '' : ' is-placeholder'}`} aria-hidden="true">{shown}</span>
      <ArrowMark dir="down" size="inline" className="ui-select-chevron" legacy={<ChevronGlyph />} />
    </button>
    {open && <SelectorSheet uid={uid} title={title || label} items={items} value={value} search={search} columns={columns} anchor={trigger}
      onPick={next => { if (!sameValue(next, value)) onChange(next); }} onClose={() => setOpen(false)} />}
  </div>;
}

function SelectorSheet({ uid, title, items, value, search, columns, anchor, onPick, onClose }) {
  const panel = useRef(null);
  const list = useRef(null);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterOptions(items, query), [items, query]);
  const [active, setActive] = useState(() => Math.max(0, items.findIndex(item => sameValue(item.value, value))));
  const [leaving, setLeaving] = useState(false);
  const [place, setPlace] = useState(null);
  const typed = useRef({ text: '', at: 0 });
  const close = () => {
    if (leaving) return;
    if (still()) { onClose(); return; }
    setLeaving(true);
    setTimeout(onClose, 150);
  };
  const pick = item => { if (!item || item.disabled) return; onPick(item.value); close(); };
  useModalFocus(panel, true, close, { initialFocus: search ? 'input' : '[role="listbox"]' });
  useEffect(() => {
    const back = () => close();
    window.addEventListener('kz-native-close-overlay', back);
    document.documentElement.classList.add('ui-picker-open');
    return () => { window.removeEventListener('kz-native-close-overlay', back); document.documentElement.classList.remove('ui-picker-open'); };
  }, []);
  // On a wide screen: a popover under the trigger (above it when there is no room), aligned to its start edge.
  useLayoutEffect(() => {
    if (!wide() || !anchor.current) return;
    const box = anchor.current.getBoundingClientRect();
    const width = Math.min(380, Math.max(box.width, 280));
    const right = Math.max(12, Math.min(window.innerWidth - box.right, window.innerWidth - width - 12));
    const below = window.innerHeight - box.bottom - 18;
    const above = box.top - 18;
    setPlace(below >= 300 || below >= above
      ? { top: box.bottom + 6, right, width, maxHeight: Math.min(520, below) }
      : { bottom: window.innerHeight - box.top + 6, right, width, maxHeight: Math.min(520, above) });
  }, []);
  useEffect(() => { setActive(query ? 0 : Math.max(0, shown.findIndex(item => sameValue(item.value, value)))); }, [query]);
  useEffect(() => { list.current?.querySelector(`#${uid}-o-${active}`)?.scrollIntoView?.({ block: 'nearest' }); }, [active, shown]);
  const onKey = event => {
    const fromField = event.target.tagName === 'INPUT';
    if (fromField && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Enter'].includes(event.key)) return;
    const next = nextIndex(active, event.key, shown.length, columns);
    if (next !== null) { event.preventDefault(); setActive(next); return; }
    if (event.key === 'Enter' || (event.key === ' ' && !fromField)) { event.preventDefault(); pick(shown[active]); return; }
    // Typing on the list (no search field): jump to the next option that starts with the letters typed.
    if (!fromField && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + plain(event.key), at: now };
      const order = shown.map((item, index) => [item, index]);
      const hit = [...order.slice(active + 1), ...order.slice(0, active + 1)].find(([item]) => plain(item.label).startsWith(typed.current.text));
      if (hit) { event.preventDefault(); setActive(hit[1]); }
    }
  };
  const grid = columns > 1;
  const layer = <div className={`ui-picker-layer${place ? ' is-popover' : ' is-sheet'}${leaving ? ' is-leaving' : ''}`} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={panel} className="ui-picker" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} onKeyDown={onKey}
      style={place ? { top: place.top, bottom: place.bottom, right: place.right, width: place.width, maxHeight: place.maxHeight } : undefined}>
      {!place && <span className="ui-picker-grip" aria-hidden="true" />}
      <div className="ui-picker-head">
        <h2 id={`${uid}-title`}>{title}</h2>
        <CloseButton label={`סגירת ${title}`} onClick={close} />
      </div>
      {search && <div className="ui-picker-search"><ClearableInput type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`חיפוש ב${title}`} aria-label={`חיפוש ב${title}`} clearLabel="נקה את החיפוש" autoComplete="off" enterKeyHint="done" /></div>}
      <ul ref={list} id={`${uid}-list`} className={`ui-picker-list${grid ? ' is-grid' : ''}`} role="listbox" aria-labelledby={`${uid}-title`} tabIndex={0}
        aria-activedescendant={shown[active] ? `${uid}-o-${active}` : undefined} style={grid ? { '--ui-picker-columns': columns } : undefined}>
        {shown.map((item, index) => {
          const selected = sameValue(item.value, value);
          return <li key={`${String(item.value)}-${index}`} id={`${uid}-o-${index}`} role="option" aria-selected={selected} aria-disabled={item.disabled || undefined}
            className={`ui-picker-option${selected ? ' is-selected' : ''}${index === active ? ' is-active' : ''}${item.wide ? ' is-wide' : ''}`} onClick={() => pick(item)} onPointerMove={() => { if (index !== active) setActive(index); }}>
            <span className="ui-picker-option-text">{item.label}{item.hint && !grid && <small>{item.hint}</small>}</span>
            {!grid && <span className="ui-picker-check" aria-hidden="true">{selected && <CheckGlyph />}</span>}
          </li>;
        })}
      </ul>
      {shown.length === 0 && <p className="ui-picker-empty" role="status">לא נמצא. נסו מילה אחרת.</p>}
    </div>
  </div>;
  return typeof document === 'undefined' ? null : createPortal(layer, document.body);
}
