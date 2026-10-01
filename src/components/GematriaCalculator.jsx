import { useEffect, useMemo, useState } from 'react';
import { BackLink } from './LocalNavigation.jsx';
import ClearableInput from './ClearableInput.jsx';
import { gematriaAll, torahWordsWithValue } from '../services/gematriaCalc.mjs';
import TitleOrnament from './ui/TitleOrnament.jsx';

const TORAH_BOOKS = new Set(['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']);
// Every method as one equal card: its name, its value, and one line saying how it was counted.
const METHODS = [
  ['standard', 'גימטריה רגילה', 'מספר הכרחי: א=1 … ת=400', r => r.standard],
  ['gadol', 'מספר גדול', 'עם האותיות הסופיות: ך=500 … ץ=900', r => r.gadol],
  ['katan', 'מספר קטן', 'כל אות בלי האפסים: י=1, כ=2, ק=1', r => r.katan],
  ['ordinal', 'מספר סידורי', 'מקום האות בא״ב: א=1 … ת=22', r => r.ordinal],
  ['reduced', 'מספר מצומצם', 'סכום הספרות עד ספרה אחת', r => r.reduced],
  ['kolel', 'עם הכולל', 'הרגילה ועוד 1 כנגד המילה כולה', r => r.kolel],
  ['kolelWords', 'עם הכולל (מילים)', 'הרגילה ועוד מספר המילים', r => r.kolelWords],
  ['withLetters', 'עם האותיות', 'הרגילה ועוד מספר האותיות', r => r.withLetters],
  ['milui', 'מילוי', 'ערך שמות האותיות (אלף, בית…)', r => r.milui.value],
  ['neelam', 'נעלם (נסתר)', 'המילוי בלי האותיות עצמן', r => r.neelam],
];
const CIPHERS = [['atbash', 'אתב״ש', 'א↔ת, ב↔ש …'], ['albam', 'אלב״ם', 'א↔ל, ב↔מ …'], ['atbach', 'אטב״ח', 'א↔ט, ב↔ח …']];

export default function GematriaCalculator() {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  // The calculation follows the typing a moment later, so the keyboard never waits for it.
  useEffect(() => { const timer = setTimeout(() => setQuery(text), 200); return () => clearTimeout(timer); }, [text]);
  const result = useMemo(() => gematriaAll(query), [query]);
  const [torah, setTorah] = useState(null);
  useEffect(() => { let live = true; import('../data/torahText.mjs').then(module => { if (live) setTorah(module.default.books.filter(book => TORAH_BOOKS.has(book.id))); }); return () => { live = false; }; }, []);
  const same = useMemo(() => (result && torah ? torahWordsWithValue(torah, result.standard, { exclude: query }) : []), [result, torah]);
  return <section className="personal-tools gematria-calc">
    <BackLink />
    <header className="gematria-head"><h1>מחשבון גימטריה</h1><TitleOrnament /><p>כל שיטות החישוב המקובלות, עם פירוט האותיות — כדי שאפשר יהיה לבדוק כל תוצאה ביד.</p></header>
    <label className="personal-field gematria-input"><span>מילה, שם או פסוק</span><ClearableInput value={text} onChange={event => setText(event.target.value)} placeholder="למשל: שלום" autoComplete="off" clearLabel="נקה" /></label>
    {!result && query.trim() && <p className="notice" role="status">לא נמצאו אותיות עבריות לחישוב.</p>}
    {result && <>
      <div className="gematria-letters" role="group" aria-label="פירוט האותיות">{result.letters.map((item, index) => <span key={index}><b>{item.letter}</b><small>{item.value}</small></span>)}</div>
      <div className="gematria-grid">{METHODS.map(([key, title, how, value]) => <article key={key} className={`gematria-card${key === 'standard' ? ' is-main' : ''}`}><h2>{title}</h2><strong>{value(result).toLocaleString('he-IL')}</strong><small>{how}</small></article>)}</div>
      <p className="gematria-milui">מילוי: {result.milui.names.join(' · ')}</p>
      <h2 className="gematria-subhead">חילופי אותיות</h2>
      <div className="gematria-grid gematria-ciphers">{CIPHERS.map(([key, title, how]) => <article key={key} className="gematria-card"><h2>{title}</h2><strong className="gematria-word">{result[key].word}</strong><small>{how}</small><small>בגימטריה {result[key].value}</small></article>)}</div>
      {same.length > 0 && <section className="gematria-same" aria-label="מילים בתורה באותו ערך"><h2 className="gematria-subhead">מילים בתורה שערכן {result.standard}</h2><div className="gematria-chips">{same.map(item => <span key={item.word}>{item.word}<small>{item.count}</small></span>)}</div><p className="personal-hint">מתוך חמשת חומשי תורה; המספר הקטן — כמה פעמים המילה מופיעה.</p></section>}
    </>}
  </section>;
}
