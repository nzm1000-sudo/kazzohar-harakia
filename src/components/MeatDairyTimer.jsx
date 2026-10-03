import { useEffect, useRef, useState } from 'react';
import { useLocal } from '../hooks.jsx';
import { MEAT_DAIRY_DEFAULT_HOURS, MEAT_DAIRY_HOURS, MEAT_DAIRY_OPEN_EVENT, MEAT_DAIRY_SYNC_EVENT, clockLabel, formatRemaining, mealInstant, meatDairyStatus, recordMeatDairyChange, takeMeatDairySheetRequest } from '../services/meatDairy.mjs';
import { stableId } from '../services/notificationEngine.mjs';
import { cancelSingle, scheduleSingle } from '../services/notifications.mjs';
import { useModalFocus } from './a11yPrimitives.jsx';
import { CloseButton } from './ui/IconButton.jsx';
import ArrowMark from './ui/ArrowMark.jsx';

// Meat → dairy, on the Today page beside the smart prayer: one tap starts the wait; "בשעה אחרת?" turns a wheel
// to the hour the meal really was. Six hours by default; three for those whose custom it is.
const NOTIFY_ID = stableId('meat-dairy-wait');
const ITEM = 40;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = n => String(n).padStart(2, '0');

function Wheel({ values, value, onChange, label }) {
  const ref = useRef(null);
  const settle = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = values.indexOf(value) * ITEM; }, []);
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const node = ref.current; if (!node) return;
      const next = values[Math.max(0, Math.min(values.length - 1, Math.round(node.scrollTop / ITEM)))];
      if (next !== value) onChange(next);
    }, 90);
  };
  const pick = next => { ref.current?.scrollTo({ top: values.indexOf(next) * ITEM, behavior: 'smooth' }); onChange(next); };
  return <div className="md-wheel" ref={ref} onScroll={onScroll} role="listbox" aria-label={label}>
    <span className="md-wheel-pad" aria-hidden="true" />
    {values.map(item => <button type="button" role="option" aria-selected={item === value} key={item} onClick={() => pick(item)}>{pad(item)}</button>)}
    <span className="md-wheel-pad" aria-hidden="true" />
  </div>;
}

export default function MeatDairyTimer() {
  const [wait, setWait] = useLocal('meat-dairy-v1', null);
  const [preferred, setPreferred] = useLocal('meat-dairy-hours', MEAT_DAIRY_DEFAULT_HOURS);
  const [open, setOpen] = useState(false);
  const [choosingHours, setChoosingHours] = useState(false);
  const [picking, setPicking] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [pick, setPick] = useState({ hour: 0, minute: 0 });
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 20000); return () => clearInterval(timer); }, []);
  // A wait started from the home-screen widget's "אכלתי בשרי" (services/nativeWidgets.mjs) shows here at once.
  useEffect(() => {
    const sync = event => { setWait(event?.detail?.wait ?? null); setNow(new Date()); };
    globalThis.addEventListener?.(MEAT_DAIRY_SYNC_EVENT, sync);
    return () => globalThis.removeEventListener?.(MEAT_DAIRY_SYNC_EVENT, sync);
  }, []);
  // A tap on the home-screen widget (kzohaar://open/meat) opens this sheet: at once when the card is on screen, or as
  // it mounts (a cold start, or from another page) — services/meatDairy.mjs keeps the request for a few seconds only.
  useEffect(() => {
    const ask = () => { if (takeMeatDairySheetRequest()) { setNow(new Date()); setOpen(true); } };
    ask();
    globalThis.addEventListener?.(MEAT_DAIRY_OPEN_EVENT, ask);
    return () => globalThis.removeEventListener?.(MEAT_DAIRY_OPEN_EVENT, ask);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    // Escape inside the sheet is useModalFocus's; this one catches it when focus has fallen to the page body.
    const onKey = event => { if (event.key === 'Escape' && !sheet.current?.contains(globalThis.document?.activeElement)) close(); };
    globalThis.addEventListener?.('keydown', onKey);
    return () => globalThis.removeEventListener?.('keydown', onKey);
  }, [open]);
  // Pull the sheet down to close it — from the grip, or anywhere while the sheet is scrolled to its top. The drag is
  // never the only way: the visible "סגור" button, Escape and the backdrop close it too.
  const sheet = useRef(null);
  const drag = useRef(null);
  const close = () => {
    const node = sheet.current;
    if (!node) { setOpen(false); return; }
    node.style.transition = 'transform .18s ease-in'; node.style.transform = 'translateY(100%)';
    setTimeout(() => setOpen(false), 170);
  };
  const onDragStart = event => {
    const node = sheet.current;
    if (!node || event.target.closest?.('.md-wheel') || node.scrollTop > 0) { drag.current = null; return; }
    drag.current = { y: event.touches[0].clientY, dy: 0, at: Date.now() };
    node.style.transition = 'none';
  };
  const onDragMove = event => {
    const node = sheet.current; const state = drag.current;
    if (!node || !state) return;
    state.dy = Math.max(0, event.touches[0].clientY - state.y);
    node.style.transform = state.dy ? `translateY(${state.dy}px)` : '';
  };
  const onDragEnd = () => {
    const node = sheet.current; const state = drag.current; drag.current = null;
    if (!node || !state) return;
    const fast = state.dy > 40 && state.dy / Math.max(1, Date.now() - state.at) > 0.5;
    if (state.dy > 110 || fast) { close(); return; }
    node.style.transition = 'transform .18s ease-out'; node.style.transform = '';
  };
  // A modal sheet for assistive technology: focus moves in, Tab stays inside, the page behind is inert, focus returns.
  useModalFocus(sheet, open, close);
  const status = meatDairyStatus(wait, now);
  const hours = status?.hours || (MEAT_DAIRY_HOURS.includes(preferred) ? preferred : MEAT_DAIRY_DEFAULT_HOURS);

  const start = (startedAt, withHours = hours) => {
    const next = { startedAt: new Date(startedAt).toISOString(), hours: withHours };
    setWait(next); setNow(new Date()); setPicking(false); recordMeatDairyChange({ wait: next });
    const end = new Date(new Date(startedAt).getTime() + withHours * 3600000);
    scheduleSingle({ id: NOTIFY_ID, title: 'אפשר לאכול חלבי', body: `עברו ${withHours} שעות מהארוחה הבשרית (${clockLabel(new Date(startedAt))}).`, at: end });
  };
  const reset = () => { setWait(null); setPicking(false); cancelSingle(NOTIFY_ID); recordMeatDairyChange({ wait: null }); };
  const chooseHours = value => {
    setPreferred(value); setChoosingHours(false); recordMeatDairyChange({ preferred: value });
    if (status && !status.done) start(status.start, value);
  };
  const openPicker = () => {
    const base = status ? status.start : new Date(now.getTime() - 3600000);
    setPick({ hour: base.getHours(), minute: Math.floor(base.getMinutes() / 5) * 5 });
    setPicking(true);
  };
  const picked = mealInstant(now, pick.hour, pick.minute);
  const pickedStatus = meatDairyStatus({ startedAt: picked.toISOString(), hours }, now);

  const card = status
    ? status.done
      ? { title: 'אפשר חלבי', detail: `מאז ${clockLabel(status.end)}` }
      : { title: `נותרו ${formatRemaining(status.remaining)}`, detail: `חלבי מ־${clockLabel(status.end)}` }
    : { title: 'אכלתי בשרי', detail: `המתנה של ${hours} שעות` };

  return <>
    <button type="button" className={`learning-resume-item meat-dairy-card${status ? (status.done ? ' is-done' : ' is-waiting') : ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
      <span>בשרי · חלבי</span><strong>{card.title}</strong><small>{card.detail}</small>
      {status && !status.done && <i className="meat-dairy-progress" style={{ '--progress': status.progress }} aria-hidden="true" />}
    </button>
    {open && <div className="md-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <section className="md-sheet" ref={sheet} role="dialog" aria-modal="true" aria-label="המתנה בין בשר לחלב" onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd} onTouchCancel={onDragEnd}>
        <span className="md-grip" aria-hidden="true" />
        <header className="md-head"><h2>המתנה בין בשר לחלב</h2><CloseButton className="md-close" variant="framed" onClick={close} label="סגירת ההמתנה בין בשר לחלב" /></header>

        {status && <div className={`md-status${status.done ? ' is-done' : ''}`}>
          <span>{status.done ? 'ההמתנה הסתיימה' : 'נותרו'}</span>
          <strong>{status.done ? 'אפשר לאכול חלבי' : formatRemaining(status.remaining)}</strong>
          <small>אכלתי ב־{clockLabel(status.start)} · חלבי מ־{clockLabel(status.end)}</small>
          {!status.done && <i className="meat-dairy-progress" style={{ '--progress': status.progress }} aria-hidden="true" />}
        </div>}

        <div className="md-row">
          <span className="md-row-title">משך ההמתנה</span>
          <button type="button" className="md-hours" aria-expanded={choosingHours} aria-label={`משך ההמתנה: ${hours} שעות`} onClick={() => setChoosingHours(value => !value)}>{hours} שעות <ArrowMark dir="down" size="inline" legacy="‹" /></button>
        </div>
        {choosingHours && <div className="md-hour-options" role="group" aria-label="משך ההמתנה">
          {MEAT_DAIRY_HOURS.map(value => <button type="button" key={value} aria-pressed={value === hours} onClick={() => chooseHours(value)}><strong>{value} שעות</strong><small>{value === 6 ? 'ברירת המחדל' : 'למנהג שלוש שעות'}</small></button>)}
        </div>}

        {picking ? <div className="md-picker">
          <p className="md-picker-title">באיזו שעה אכלת בשרי?</p>
          <div className="md-wheels" dir="ltr">
            <Wheel values={HOURS} value={pick.hour} onChange={hour => setPick(value => ({ ...value, hour }))} label="שעה" />
            <b aria-hidden="true">:</b>
            <Wheel values={MINUTES} value={pick.minute} onChange={minute => setPick(value => ({ ...value, minute }))} label="דקות" />
          </div>
          <p className="md-picker-summary">{pickedStatus && !pickedStatus.done ? `נותרו ${formatRemaining(pickedStatus.remaining)} · חלבי מ־${clockLabel(pickedStatus.end)}` : 'ההמתנה כבר הסתיימה'}</p>
          <div className="md-actions">
            <button type="button" className="md-primary" onClick={() => start(picked)}>התחלה מ־{pad(pick.hour)}:{pad(pick.minute)}</button>
            <button type="button" className="md-secondary" onClick={() => setPicking(false)}>ביטול</button>
          </div>
        </div> : <div className="md-actions">
          <button type="button" className="md-primary" onClick={() => start(new Date())}>{status ? 'אכלתי בשרי שוב — מעכשיו' : 'אכלתי בשרי — מעכשיו'}</button>
          <button type="button" className="md-secondary" onClick={openPicker}>{status ? 'שינוי שעת הארוחה' : 'בשעה אחרת?'}</button>
          {status && <button type="button" className="md-secondary" onClick={reset}>איפוס</button>}
        </div>}
        <p className="md-note">בסיום ההמתנה תישלח תזכורת, אם ההתראות מאושרות.</p>
      </section>
    </div>}
  </>;
}
