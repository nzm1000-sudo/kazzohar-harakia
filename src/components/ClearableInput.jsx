import { useRef } from 'react';

export default function ClearableInput({
  value,
  onChange,
  inputRef: externalInputRef,
  clearLabel = 'נקה',
  className = '',
  inputClassName = '',
  type = 'text',
  ...inputProps
}) {
  const inputRef = useRef(null);
  const hasValue = String(value ?? '').length > 0;
  const clear = () => {
    onChange({ target: { value: '' }, currentTarget: { value: '' } });
    inputRef.current?.focus();
  };
  const setInputRef = node => {
    inputRef.current = node;
    if (typeof externalInputRef === 'function') externalInputRef(node);
    else if (externalInputRef) externalInputRef.current = node;
  };

  return <span className={`clearable-input ${className}`.trim()}>
    <input ref={setInputRef} className={inputClassName} type={type} value={value} onChange={onChange} {...inputProps} />
    <button className="clearable-input-button" type="button" aria-label={clearLabel} tabIndex={hasValue ? 0 : -1} onClick={clear} hidden={!hasValue}>
      <span aria-hidden="true">×</span>
    </button>
  </span>;
}