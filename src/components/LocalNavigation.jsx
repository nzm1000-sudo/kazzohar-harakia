export function BackNavigation({ label = 'חזרה', onClick }) {
  return <button className="local-back" type="button" onClick={onClick} aria-label={label}><span aria-hidden="true">←</span>{label}</button>;
}

export function Breadcrumbs({ items = [], onNavigate }) {
  if (!items.length) return null;
  const activate = item => { if (item.onNavigate) item.onNavigate(); else if (onNavigate) onNavigate(item); else history.back(); };
  return <nav className="breadcrumbs" aria-label="מיקום נוכחי">{items.map((item, index) => <span key={`${item.label}-${index}`}>{index > 0 && <b aria-hidden="true">›</b>}{index === items.length - 1 ? <strong>{item.label}</strong> : <button type="button" onClick={() => activate(item)}>{item.label}</button>}</span>)}</nav>;
}
