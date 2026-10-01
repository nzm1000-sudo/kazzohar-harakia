import { CloseGlyph } from './Glyphs.jsx';

// IconButton — a glyph-only button: always named (aria-label), always a 44px hit area (docs/design-system.md).
// `variant`: "quiet" (no frame, the default), "framed" (the hairline frame of a secondary button) or "row" (no frame
// of its own: it takes the frame of the buttons beside it, e.g. the Talmud panel's steps).
export default function IconButton({ label, children, className = '', variant = 'quiet', buttonRef, ...props }) {
  return <button ref={buttonRef} type="button" className={`ui-icon-button${variant === 'row' ? '' : ` is-${variant}`}${className ? ` ${className}` : ''}`} aria-label={label} title={props.title ?? label} {...props}>{children}</button>;
}

// CloseButton — the one ✕ of the app: closes a sheet, a panel or a dialog, or removes one row. Its name says what.
export function CloseButton({ label = 'סגירה', className = '', variant = 'quiet', ...props }) {
  return <IconButton label={label} className={`ui-close${className ? ` ${className}` : ''}`} variant={variant} {...props}><CloseGlyph /></IconButton>;
}
