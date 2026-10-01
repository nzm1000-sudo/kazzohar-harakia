// React glue for the Torah content engine: the catalog (the app's own divrei torah at once, the archive when loaded),
// the week's three (stable for the week; written to the device from an effect, never during a render) and one article.
import { useEffect, useMemo, useState } from 'react';
import { cachedTorahArticle, currentTorahCatalog, loadTorahArticle, loadTorahCatalog, torahArticle, torahCatalogLoaded } from '../../services/torahContent.mjs';
import { replaceWeeklyPick, torahWeekFocus, weeklyTorah } from '../../services/torahSelection.mjs';
import { readTorahIds } from '../../services/torahReadHistory.mjs';

export function useTorahCatalog({ enabled = true } = {}) {
  const [catalog, setCatalog] = useState(currentTorahCatalog);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    if (torahCatalogLoaded()) { setCatalog(currentTorahCatalog()); return undefined; }
    loadTorahCatalog().then(next => { if (live) setCatalog(next); });
    return () => { live = false; };
  }, [enabled]);
  return catalog;
}

/** The three of a focus (the week's, or a collection's): { week, replace(position), catalog }. */
export function useWeeklyPicks(focus, catalog) {
  const [version, setVersion] = useState(0);
  const week = useMemo(() => weeklyTorah(focus, { catalog, readHistory: readTorahIds() }), [focus?.scopeKey, focus?.weekKey, catalog, version]);
  // The first choice of the week is kept on the device (from an effect: a render never writes).
  useEffect(() => { if (focus && catalog.loaded) weeklyTorah(focus, { catalog, readHistory: readTorahIds(), persist: true }); }, [focus?.scopeKey, focus?.weekKey, catalog]);
  const replace = position => { replaceWeeklyPick(focus, position, { catalog, readHistory: readTorahIds() }); setVersion(value => value + 1); };
  return { week, replace };
}

/** The week of the Shabbat table: the focus from the calendar, its three, and (optionally) their full texts. */
export function useWeeklyTorah({ items = [], todayKey = null, parashaName = null, bodies = false } = {}) {
  const catalog = useTorahCatalog();
  const focus = useMemo(() => torahWeekFocus({ items, todayKey, parashaName, catalog }), [items, todayKey, parashaName, catalog]);
  const { week, replace } = useWeeklyPicks(focus, catalog);
  const [texts, setTexts] = useState({});
  const ids = (week?.picks || []).map(item => item.id).join('|');
  useEffect(() => {
    if (!bodies || !week?.picks?.length) return undefined;
    let live = true;
    for (const pick of week.picks) {
      if (pick.body || texts[pick.id] || cachedTorahArticle(pick.id)) continue;
      loadTorahArticle(pick.id, { catalog }).then(article => { if (live) setTexts(current => ({ ...current, [pick.id]: { status: 'ready', paragraphs: article.paragraphs } })); })
        .catch(error => { if (live) setTexts(current => ({ ...current, [pick.id]: { status: 'error', message: error.message } })); });
    }
    return () => { live = false; };
  }, [bodies, ids, catalog]);
  // An article's paragraphs: the app's own are in the catalog; the archive's arrive from their pack.
  const textOf = pick => (pick.body ? { status: 'ready', paragraphs: pick.body.paragraphs } : cachedTorahArticle(pick.id) ? { status: 'ready', paragraphs: cachedTorahArticle(pick.id).paragraphs } : texts[pick.id] || { status: 'loading' });
  return { catalog, focus, week, replace, textOf };
}

export function useTorahArticle(id) {
  const catalog = useTorahCatalog();
  const meta = torahArticle(catalog, id);
  const ready = () => (meta?.body ? { status: 'ready', article: { ...meta, paragraphs: meta.body.paragraphs, source: meta.body.source } } : cachedTorahArticle(id) ? { status: 'ready', article: cachedTorahArticle(id) } : null);
  const [state, setState] = useState(() => ready() || { status: 'loading', article: null });
  useEffect(() => {
    let live = true;
    const now = ready();
    if (now) { setState(now); return undefined; }
    if (!catalog.loaded) { setState({ status: 'loading', article: null }); return undefined; }
    if (!meta) { setState({ status: 'missing', article: null }); return undefined; }
    setState({ status: 'loading', article: null });
    loadTorahArticle(id, { catalog }).then(article => { if (live) setState({ status: 'ready', article }); })
      .catch(error => { if (live) setState({ status: 'error', article: null, message: error.message }); });
    return () => { live = false; };
  }, [id, catalog]);
  return { catalog, ...state };
}
