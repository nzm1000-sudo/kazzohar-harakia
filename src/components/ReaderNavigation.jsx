export default function ReaderNavigation({ previous, next, onSelect, endLabel = 'סיימת את הרצף' }) {
  if (!previous && !next) return <section className="reader-end" aria-label="סיום הקריאה"><strong>{endLabel}</strong></section>;
  return <nav className="reader-navigation" aria-label="ניווט בקריאה">
    {previous ? <button className="reader-step previous" onClick={() => onSelect(previous)} aria-label={`הקודם: ${previous.title}`}><span>הקודם</span><strong>{previous.title}</strong><b aria-hidden="true">→</b></button> : <span />}
    {next ? <button className="reader-step next" onClick={() => onSelect(next)} aria-label={`הבא: ${next.title}`}><span>הבא</span><strong>{next.title}</strong><b aria-hidden="true">←</b></button> : <span className="reader-end-label">{endLabel}</span>}
  </nav>;
}
