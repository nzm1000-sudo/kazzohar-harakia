import { Fragment, useEffect, useRef, useState } from 'react';
import { searchTorah } from '../services/torah/search.mjs';
import { FAMILIES } from '../services/torah/inventory.mjs';

// The unit's own words around the match; matched words marked. The text is shown exactly as the edition has it.
export function HitSnippet({ snippet }) {
  const parts = [];
  let at = 0;
  for (const [start, end] of snippet.highlights) {
    if (start > at) parts.push({ text: snippet.text.slice(at, start) });
    parts.push({ text: snippet.text.slice(start, end), mark: true });
    at = end;
  }
  if (at < snippet.text.length) parts.push({ text: snippet.text.slice(at) });
  return <span className="torah-hit-snippet" dir="rtl">{snippet.before && '…'}{parts.map((part, i) => (part.mark ? <mark key={i}>{part.text}</mark> : <Fragment key={i}>{part.text}</Fragment>))}{snippet.after && '…'}</span>;
}

export function TorahHitRow({ hit, onOpen, showWork = true }) {
  const source = hit.commentator && hit.displayRef.startsWith(hit.commentator) ? null : hit.commentator || (showWork && !hit.answer ? hit.workTitle : null);
  return <button type="button" className="library-row torah-hit" onClick={() => onOpen(hit)} aria-label={`${hit.displayRef}${source ? `, ${source}` : ''}`}>
    <span className="library-row-title">{hit.displayRef}</span>
    <span className="library-row-meta">{hit.answer && <span className="torah-hit-kind">{hit.workTitle}</span>}{source && <span>{source}</span>}{hit.partial && <span>התאמה חלקית</span>}</span>
    <HitSnippet snippet={hit.snippet} />
    <span className="library-row-arrow" aria-hidden="true">›</span>
  </button>;
}

const PAGE = 20;
// Full-text search of the Torah corpora on the device (debounced; results page by page).
export function useTorahSearch(query, { family = 'all', workIds = null, delay = 280 } = {}) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const token = useRef(0);
  const text = String(query || '').trim();
  const key = `${text}|${family}|${workIds?.join(',') || ''}`;
  useEffect(() => {
    const run = ++token.current;
    if (text.length < 2) { setState({ status: 'idle', data: null, error: null }); return undefined; }
    setState(previous => ({ status: 'loading', data: previous.data && previous.data.query === text ? previous.data : null, error: null }));
    const timer = setTimeout(() => {
      searchTorah(text, { family, workIds, limit: PAGE })
        .then(data => { if (run === token.current) setState({ status: 'done', data, error: null }); })
        .catch(error => { if (run === token.current) setState({ status: 'error', data: null, error }); });
    }, delay);
    return () => clearTimeout(timer);
  }, [key]);
  const more = () => {
    const current = state.data;
    if (!current) return;
    const run = token.current;
    searchTorah(text, { family, workIds, offset: current.results.length, limit: PAGE })
      .then(data => { if (run === token.current) setState({ status: 'done', data: { ...data, results: [...current.results, ...data.results] }, error: null }); })
      .catch(() => {});
  };
  return { ...state, more };
}

export default function TorahSearchResults({ query, family = 'all', workIds = null, ...rest }) {
  const state = useTorahSearch(query, { family, workIds });
  return <TorahResultsView {...state} family={family} {...rest} />;
}

// The results as rendered (no state of its own), so a test can render the engine's real output.
export function TorahResultsView({ status, data, error, more = () => {}, onOpen, family = 'all', setFamily = null, heading = 'בתוך המקורות', onSuggest = null, showWork = true }) {
  if (status === 'idle') return null;
  const results = data?.results || [];
  const count = data ? `${data.total.toLocaleString('he-IL')} ${data.total === 1 ? 'מקום' : 'מקומות'}${data.partial ? ' · התאמה חלקית' : ''}` : '';
  return <section className="torah-search" aria-label={heading}>
    <div className="torah-search-head">
      <h2 className="library-subhead">{heading}</h2>
      {data && <p className="torah-search-count" aria-live="polite">{count}</p>}
    </div>
    {setFamily && <div className="seg torah-families" role="radiogroup" aria-label="סינון לפי תחום">{FAMILIES.map(item => <button key={item.id} type="button" role="radio" aria-checked={family === item.id} className={family === item.id ? 'on' : ''} onClick={() => setFamily(item.id)}>{item.title}</button>)}</div>}
    {status === 'loading' && !data && <p className="loading" role="status">מחפשים בטקסט…</p>}
    {status === 'error' && <p className="notice" role="alert">{/INDEX_UNAVAILABLE/.test(error?.message || '') ? 'החיפוש בטקסט אינו זמין כרגע במכשיר זה ללא חיבור.' : 'החיפוש בטקסט נכשל. נסו שוב.'}</p>}
    {data && data.partial && results.length > 0 && <p className="torah-search-note">לא נמצא מקום שבו מופיעות כל המילים; מוצגים מקומות שבהם מופיעות רובן.</p>}
    {results.length > 0 && <div className="book-index torah-hits">{results.map(hit => <TorahHitRow key={hit.id} hit={hit} onOpen={onOpen} showWork={showWork} />)}</div>}
    {data && results.length > 0 && data.shown < data.total && <button type="button" className="torah-more" onClick={more}>עוד תוצאות</button>}
    {data && !results.length && <div className="torah-empty">
      <p className="notice">{data.onlyStopWords ? 'המילים שבחיפוש שכיחות מאוד במקורות; הוסיפו מילה מבחינה.' : 'לא נמצאו מקורות שבהם מופיעות המילים האלה.'}</p>
      {data.suggestions.length > 0 && onSuggest && <p className="torah-suggest">חיפוש מילה אחת: {data.suggestions.map(item => <button key={item.query} type="button" className="link" onClick={() => onSuggest(item.query)}>{item.label}</button>)}</p>}
    </div>}
  </section>;
}
