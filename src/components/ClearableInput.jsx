import { startTransition, useEffect, useRef, useState } from 'react';

// A text field with a clear button ("נקה"), the one used by every search in the app.
//
// deferred: the field owns the text it shows. A keystroke renders the field alone, at once, and the page hears the new
// value as a low-priority update (startTransition) — so a search, a filter or a long list never stands between a key
// and its letter (the keyboard's click came at once, the letter half a second later). A value set from outside (a
// suggestion tapped, the page clearing it) still reaches the field. Clearing is immediate.
export default function ClearableInput({
  value,
  onChange,
  inputRef: externalInputRef,
  clearLabel = 'נקה',
  className = '',
  inputClassName = '',
  type = 'text',
  deferred = false,
  ...inputProps
}) {
  const inputRef = useRef(null);
  const [text, setText] = useState(() => String(value ?? ''));
  const sent = useRef(value);
  useEffect(() => {
    if (!deferred || value === sent.current) return;
    sent.current = value;
    setText(String(value ?? ''));
  }, [deferred, value]);
  const shown = deferred ? text : value;
  const hasValue = String(shown ?? '').length > 0;
  const emit = next => onChange({ target: { value: next }, currentTarget: { value: next } });
  const change = event => {
    if (!deferred) { onChange(event); return; }
    const next = event.target.value;
    setText(next);
    sent.current = next;
    if (next) startTransition(() => emit(next)); else emit(next);
  };
  const clear = () => {
    if (deferred) { setText(''); sent.current = ''; }
    emit('');
    inputRef.current?.focus();
  };
  const setInputRef = node => {
    inputRef.current = node;
    if (typeof externalInputRef === 'function') externalInputRef(node);
    else if (externalInputRef) externalInputRef.current = node;
  };

  return <span className={`clearable-input ${className}`.trim()}>
    <input ref={setInputRef} className={inputClassName} type={type} value={shown} onChange={change} {...inputProps} />
    <button className="clearable-input-button" type="button" aria-label={clearLabel} tabIndex={hasValue ? 0 : -1} onClick={clear} hidden={!hasValue}>
      <span aria-hidden="true">×</span>
    </button>
  </span>;
}
