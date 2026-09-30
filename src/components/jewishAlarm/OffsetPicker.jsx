// השעון היהודי — before, at or after the Jewish time: three equal parts, then the common amounts in two even rows,
// then "מותאם אישית" for any other amount (typed, with −5 / +5 steps). No minute wheel.
import { useState } from 'react';
import { AlarmSheet, Segmented } from './AlarmParts.jsx';
import { QUICK_OFFSETS } from '../../services/jewishAlarm/model.mjs';
import { MAX_OFFSET_MINUTES } from '../../services/jewishAlarm/engine.mjs';
import { durationBreakdown } from '../../services/jewishAlarm/format.mjs';

export default function OffsetPicker({ direction, minutes, onChange, question }) {
  const [custom, setCustom] = useState(false);
  const isCustom = minutes !== null && minutes !== undefined && minutes > 0 && !QUICK_OFFSETS.includes(minutes);
  const choose = next => onChange(direction, next);
  return <div className="ja-offset">
    <Segmented label="לפני, בזמן או אחרי" value={direction} onChange={next => onChange(next, next === 'at' ? 0 : (minutes || null))} options={[['before', 'לפני'], ['at', 'בזמן'], ['after', 'אחרי']]} className="ja-seg-direction" />
    {(direction === 'before' || direction === 'after') && <>
      {question && <p className="ja-question">{question}</p>}
      <div className="ja-quick" role="radiogroup" aria-label="כמה דקות">
        {QUICK_OFFSETS.map(value => <button type="button" key={value} role="radio" aria-checked={minutes === value} className={minutes === value ? 'is-on' : ''} onClick={() => choose(value)} aria-label={`${value} דקות`}><span dir="ltr">{value}</span></button>)}
      </div>
      <button type="button" className={`ja-custom-row${isCustom ? ' is-on' : ''}`} aria-haspopup="dialog" onClick={() => setCustom(true)}>
        <span>מותאם אישית</span><small>{isCustom ? durationBreakdown(minutes) : 'כל מספר דקות'}</small>
      </button>
    </>}
    {custom && <CustomOffsetSheet initial={minutes && minutes > 0 ? minutes : 90} onCancel={() => setCustom(false)} onDone={value => { setCustom(false); choose(value); }} />}
  </div>;
}

function CustomOffsetSheet({ initial, onCancel, onDone }) {
  const [text, setText] = useState(String(initial));
  const value = Number.parseInt(text, 10);
  const valid = Number.isInteger(value) && value >= 1 && value <= MAX_OFFSET_MINUTES;
  const step = delta => setText(String(Math.max(1, Math.min(MAX_OFFSET_MINUTES, (Number.isInteger(value) ? value : 0) + delta))));
  return <AlarmSheet title="מספר דקות" onClose={onCancel}>
    <div className="ja-custom-entry">
      <button type="button" className="ja-step" onClick={() => step(-5)} aria-label="פחות 5 דקות"><span dir="ltr">−5</span></button>
      <label className="ja-custom-field"><span className="visually-hidden">דקות</span>
        <input dir="ltr" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off" value={text} onChange={event => setText(event.currentTarget.value.replace(/\D/g, '').slice(0, 3))} onKeyDown={event => { if (event.key === 'Enter' && valid) onDone(value); }} aria-describedby="ja-custom-hint" />
        <small aria-hidden="true">דקות</small>
      </label>
      <button type="button" className="ja-step" onClick={() => step(5)} aria-label="עוד 5 דקות"><span dir="ltr">+5</span></button>
    </div>
    <p className="ja-custom-hint" id="ja-custom-hint" role="status">{valid ? `${value} דקות = ${durationBreakdown(value)}` : `אפשר לבחור בין דקה אחת ל־${MAX_OFFSET_MINUTES} דקות (12 שעות).`}</p>
    <div className="ja-sheet-actions">
      <button type="button" className="ja-button" onClick={onCancel}>ביטול</button>
      <button type="button" className="ja-button is-primary" disabled={!valid} onClick={() => onDone(value)}>אישור</button>
    </div>
  </AlarmSheet>;
}
