import { useEffect, useState } from 'react';
import { prepareTorahSearch, searchTorahContent, torahSearchReady } from '../../services/torahSearch.mjs';
import { torahRoute } from '../../services/torahContent.mjs';
import ArrowMark from '../ui/ArrowMark.jsx';

// "דברי תורה" in the header search. The search fields load once, lazily, the first time a search is shown; a query runs
// from an effect after the text has settled (the header field is deferred), never inside a render, so typing stays
// instant. A result opens through the app's navigation, so Back returns to these results (services/searchReturn.mjs).
export default function TorahSearchGroup({ query, onNav, limit = 6 }) {
  const text = String(query || '').trim();
  const [hits, setHits] = useState(null);
  useEffect(() => {
    let live = true;
    if (text.length < 2) { setHits([]); return undefined; }
    const run = () => { if (live) setHits(searchTorahContent(text, { limit: limit + 1 })); };
    if (torahSearchReady()) { const timer = setTimeout(run, 0); return () => { live = false; clearTimeout(timer); }; }
    prepareTorahSearch().then(run).catch(() => { if (live) setHits([]); });
    return () => { live = false; };
  }, [text, limit]);
  if (!hits?.length) return null;
  return <section className="search-group torah-content-results" aria-labelledby="torah-content-results-title">
    <h2 id="torah-content-results-title">דברי תורה</h2>
    {hits.slice(0, limit).map(hit => <button type="button" className="index-row" key={hit.id} onClick={() => onNav(torahRoute.article(hit.id))}>
      <span>{hit.title}<small>{hit.meta}</small></span><ArrowMark />
    </button>)}
    {hits.length > limit && <button type="button" className="index-row torah-content-more" onClick={() => onNav(torahRoute.home())}><span>עוד בספריית דברי התורה<small>חיפוש, פרשות, מועדים ונושאים</small></span><ArrowMark /></button>}
  </section>;
}
