import PrayerSectionNav from './PrayerSectionNav.jsx';
import ArrowMark from './ui/ArrowMark.jsx';

// The docked previous / next of a reading: the same header bar as the Siddur's "הקודם | תוכן | הבא", here as
// "הקודם | הבא". Every reader that ends with ReaderNavigation places this at its top (rendered before the text loads,
// so the header never changes under the reader); the cards below stay as the continuation at the end of the reading.
export function ReaderDock({ previous, next, onSelect, label = 'ניווט בקריאה' }) {
  return <PrayerSectionNav previous={previous || null} next={next || null} onSelect={onSelect} label={label} />;
}

// The continuation at the end of a reading: large "הקודם" / "הבא" cards with the neighbours' titles.
export default function ReaderNavigation({ previous, next, onSelect, endLabel = 'סיימת את הרצף' }) {
  if (!previous && !next) return <section className="reader-end" aria-label="סיום הקריאה"><strong>{endLabel}</strong></section>;
  return <nav className="reader-navigation" aria-label="ניווט בקריאה">
    {previous ? <button className="reader-step previous" onClick={() => onSelect(previous)} aria-label={`הקודם: ${previous.title}`}><span>הקודם</span><strong>{previous.title}</strong><ArrowMark as="b" dir="back" /></button> : <span />}
    {next ? <button className="reader-step next" onClick={() => onSelect(next)} aria-label={`הבא: ${next.title}`}><span>הבא</span><strong>{next.title}</strong><ArrowMark as="b" /></button> : <span className="reader-end-label">{endLabel}</span>}
  </nav>;
}
