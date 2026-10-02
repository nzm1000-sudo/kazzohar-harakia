import { Fragment, useEffect, useRef, useState } from 'react';
import { searchTorah } from '../services/torah/search.mjs';
import { analyzeQuery } from '../services/torah/queryIntent.mjs';
import { FAMILIES, PACK_FAMILIES } from '../services/torah/inventory.mjs';
import { INDEX_CHANGE_EVENT, registeredPacks } from '../services/torah/searchIndex.mjs';
import ArrowMark from './ui/ArrowMark.jsx';

// The filter chips: the built-in families, and a pack's family only while that pack is installed (never pretended).
export function availableFamilies(installed = registeredPacks().map(pack => pack.id)) {
  return [...FAMILIES, ...PACK_FAMILIES.filter(family => installed.includes(family.packId))];
}
// Re-render when a pack is installed or removed (its results appear or vanish at once).
export function useIndexChange() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const bump = () => setRevision(value => value + 1);
    window.addEventListener(INDEX_CHANGE_EVENT, bump);
    return () => window.removeEventListener(INDEX_CHANGE_EVENT, bump);
  }, []);
  return revision;
}

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
    <ArrowMark className="library-row-arrow" legacy="›" />
  </button>;
}

const PAGE = 20;
// The last few finished searches (with every page of "עוד תוצאות" already loaded), in memory: Back to a results list
// shows it at once, as it was — the same results and the same length — without searching again.
const RESULTS_KEPT = 12;
const kept = new Map();
const keptKey = (text, family, workIds) => `${text}|${family}|${workIds?.join(',') || ''}|${registeredPacks().map(pack => pack.id).join(',')}`;
function keep(key, data) {
  kept.delete(key);
  kept.set(key, data);
  while (kept.size > RESULTS_KEPT) kept.delete(kept.keys().next().value);
}
export function keptTorahResults(text, { family = 'all', workIds = null } = {}) { return kept.get(keptKey(String(text || '').trim(), family, workIds)) || null; }
export function keepTorahResults(text, { family = 'all', workIds = null } = {}, data) { keep(keptKey(String(text || '').trim(), family, workIds), data); }
export function _clearKeptTorahResults() { kept.clear(); }
// Full-text search of the Torah corpora on the device (debounced; results page by page).
export function useTorahSearch(query, { family = 'all', workIds = null, delay = 280 } = {}) {
  const text = String(query || '').trim();
  const [state, setState] = useState(() => { const data = text.length >= 2 ? keptTorahResults(text, { family, workIds }) : null; return data ? { status: 'done', data, error: null } : { status: 'idle', data: null, error: null }; });
  const token = useRef(0);
  const revision = useIndexChange();
  const key = `${text}|${family}|${workIds?.join(',') || ''}|${revision}`;
  useEffect(() => {
    const run = ++token.current;
    if (text.length < 2) { setState({ status: 'idle', data: null, error: null }); return undefined; }
    const known = keptTorahResults(text, { family, workIds });
    if (known) { setState(previous => (previous.data === known ? previous : { status: 'done', data: known, error: null })); return undefined; }
    const storeKey = keptKey(text, family, workIds);
    setState(previous => ({ status: 'loading', data: previous.data && previous.data.query === text ? previous.data : null, error: null }));
    const timer = setTimeout(() => {
      // Lexical first (fast, as typed); when the query is a question or uses words the sources say otherwise, the
      // hybrid search follows and replaces the list in place when ready ("מחפשים גם לפי המשמעות…" meanwhile).
      const deeper = !workIds && analyzeQuery(text).rewrites.length > 0;
      searchTorah(text, { family, workIds, limit: PAGE, mode: deeper ? 'lexical' : 'hybrid' })
        .then(data => {
          if (run !== token.current) return;
          setState({ status: deeper ? 'refining' : 'done', data, error: null });
          if (!deeper) keep(storeKey, data);
          if (deeper) {
            searchTorah(text, { family, workIds, limit: PAGE, mode: 'hybrid' })
              .then(better => { keep(storeKey, better); if (run === token.current) setState({ status: 'done', data: better, error: null }); })
              .catch(() => { if (run === token.current) setState(previous => ({ ...previous, status: 'done' })); });
          }
        })
        .catch(error => { if (run === token.current) setState({ status: 'error', data: null, error }); });
    }, delay);
    return () => clearTimeout(timer);
  }, [key]);
  const more = () => {
    const current = state.data;
    if (!current) return;
    const run = token.current;
    searchTorah(text, { family, workIds, offset: current.results.length, limit: PAGE, mode: current.intent === 'lexical' ? 'lexical' : 'hybrid' })
      .then(data => { const merged = { ...data, results: [...current.results, ...data.results] }; keep(keptKey(text, family, workIds), merged); if (run === token.current) setState({ status: 'done', data: merged, error: null }); })
      .catch(() => {});
  };
  return { ...state, more };
}

export default function TorahSearchResults({ query, family = 'all', workIds = null, ...rest }) {
  const state = useTorahSearch(query, { family, workIds });
  // In-book search never offers the shelf packs (it already searches that one book).
  return <TorahResultsView {...state} family={family} {...(workIds ? { missingPacks: [] } : {})} {...rest} />;
}

// A natural question: the app's verified answers, clearly marked, beside (above) the real sources — never generated.
export function VerifiedAnswers({ data, onOpen }) {
  const answers = data?.answers || [];
  const blessing = data?.blessing || null;
  if (!answers.length && !blessing) return null;
  return <section className="torah-verified" aria-label="תשובה מאומתת מתוך האפליקציה">
    <p className="torah-verified-label">תשובה מאומתת מתוך האפליקציה · המקורות המלאים למטה</p>
    {blessing && <button type="button" className="torah-verified-row" onClick={() => onOpen({ target: { route: blessing.route } })}>
      <strong>מנוע הברכות החכם · {blessing.name}</strong><span>{blessing.text}</span><small>{blessing.cite}</small>
    </button>}
    {answers.map(hit => <button type="button" key={hit.id} className="torah-verified-row" onClick={() => onOpen(hit)}>
      <strong>{hit.displayRef}</strong><span>{hit.snippet.text}</span><small>{hit.workTitle}</small>
    </button>)}
  </section>;
}

// The results as rendered (no state of its own), so a test can render the engine's real output.
export function TorahResultsView({ status, data, error, more = () => {}, onOpen, family = 'all', setFamily = null, heading = 'בתוך המקורות', onSuggest = null, showWork = true, families = null, onManagePacks = null, missingPacks = null }) {
  if (status === 'idle') return null;
  const chips = families || availableFamilies();
  // Shelves whose full text is not on the device yet: said plainly, one tap from the download (never a fake result).
  const notInstalled = missingPacks || PACK_FAMILIES.filter(item => !registeredPacks().some(pack => pack.id === item.packId));
  const results = data?.results || [];
  const count = data ? `${data.total.toLocaleString('he-IL')} ${data.total === 1 ? 'מקום' : 'מקומות'}${data.partial ? ' · התאמה חלקית' : ''}` : '';
  return <section className="torah-search" aria-label={heading} data-kz-results>
    <div className="torah-search-head">
      <h2 className="library-subhead">{heading}</h2>
      {data && <p className="torah-search-count" aria-live="polite">{count}</p>}
    </div>
    {setFamily && <div className="seg torah-families" role="radiogroup" aria-label="סינון לפי תחום">{chips.map(item => <button key={item.id} type="button" role="radio" aria-checked={family === item.id} className={family === item.id ? 'on' : ''} onClick={() => setFamily(item.id)}>{item.title}</button>)}</div>}
    {status === 'loading' && !data && <p className="loading" role="status">מחפשים בטקסט…</p>}
    {status === 'refining' && <p className="torah-search-note" role="status">מחפשים גם לפי המשמעות…</p>}
    {data?.corrected && <p className="torah-search-note">לא נמצאו המילים כפי שנכתבו · מוצגות תוצאות עבור תיקון כתיב: {data.corrected}</p>}
    <VerifiedAnswers data={data} onOpen={onOpen} />
    {status === 'error' && <p className="notice" role="alert">{/INDEX_UNAVAILABLE/.test(error?.message || '') ? 'החיפוש בטקסט אינו זמין כרגע במכשיר זה ללא חיבור.' : 'החיפוש בטקסט נכשל. נסו שוב.'}</p>}
    {data && data.partial && results.length > 0 && <p className="torah-search-note">לא נמצא מקום שבו מופיעות כל המילים; מוצגים מקומות שבהם מופיעות רובן.</p>}
    {results.length > 0 && <div className="book-index torah-hits">{results.map(hit => <TorahHitRow key={hit.id} hit={hit} onOpen={onOpen} showWork={showWork} />)}</div>}
    {data && results.length > 0 && data.shown < data.total && <button type="button" className="torah-more" onClick={more}>עוד תוצאות</button>}
    {data && notInstalled.length > 0 && <p className="torah-packs-hint">{onManagePacks ? <button type="button" className="link" onClick={onManagePacks}>חיפוש מלא גם ב{notInstalled.map(item => item.title).join(', ')} · הורדה למכשיר<ArrowMark size="inline" legacy={'\u00A0←'} /></button> : <a href="#offline">חיפוש מלא גם ב{notInstalled.map(item => item.title).join(', ')} · הורדה למכשיר<ArrowMark size="inline" legacy={'\u00A0←'} /></a>}</p>}
    {data && !results.length && <div className="torah-empty">
      <p className="notice">{data.onlyStopWords ? 'המילים שבחיפוש שכיחות מאוד במקורות; הוסיפו מילה מבחינה.' : 'לא נמצאו מקורות שבהם מופיעות המילים האלה.'}</p>
      {data.suggestions.length > 0 && onSuggest && <p className="torah-suggest">חיפוש מילה אחת: {data.suggestions.map(item => <button key={item.query} type="button" className="link" onClick={() => onSuggest(item.query)}>{item.label}</button>)}</p>}
    </div>}
  </section>;
}
