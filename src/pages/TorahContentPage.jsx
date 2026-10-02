// "דברי תורה" — the Torah content engine's library and reader (routes #torah…, services/torahContent.mjs).
//   torah                     the library: this week, the 54 parashot by book, festivals, special Shabbatot, topics, favourites, search
//   torah/parasha/<name>      a parasha: a picker to any other parasha (by book), the three of the week, all its divrei torah
//   torah/holiday/<id>, torah/special/<id>, torah/topic/<name>   the same for a festival, a special Shabbat, a topic
//   torah/favorites           the divrei torah saved with a heart
//   torah/article/<id>        the reader: the text, the credit, and quiet actions (save, share, more, next / previous)
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouteState, useSearchState, useStudyTimer } from '../hooks.jsx';
import ClearableInput from '../components/ClearableInput.jsx';
import { BackNavigation } from '../components/LocalNavigation.jsx';
import { HeartIcon, useFavorite } from '../components/HeartToggle.jsx';
import ShareImageButton from '../components/ShareImageButton.jsx';
import TextSizeControl, { useReadingScale } from '../components/ui/TextSizeControl.jsx';
import Selector from '../components/ui/Selector.jsx';
import { announce } from '../components/a11yPrimitives.jsx';
import { onFavoritesChange, readFavorites, routeFavorite } from '../services/favorites.mjs';
import { completeLearning, rememberLearning } from '../services/learningMemory.mjs';
import { getJewishDateKey } from '../services/mitzvotJournal.mjs';
import { markTorahRead } from '../services/torahReadHistory.mjs';
import { collectionFocus, torahWeekFocus } from '../services/torahSelection.mjs';
import { prepareTorahSearch, searchTorahContent, torahSearchReady } from '../services/torahSearch.mjs';
import { BNEI_ZION, READ_TIME_FILTERS, SORTS, articleKindLine, groupArticles, articleMetaLine, articleNeighbours, filterArticles, holidayCollections, parashaCounts, parseTorahRoute, primaryScope, scopeArticles, sortArticles, specialShabbatCollections, topicCollections, torahArticle, torahRoute } from '../services/torahContent.mjs';
import { CONTENT_TYPES, TORAH_BOOKS, bookOfParasha, canonicalParasha, contentTypeLabel, holidayLabel, neighbourParashot, parashotOfReading, specialShabbatLabel } from '../services/torahTaxonomy.mjs';
import { TORAT_SHAI_CREDIT, isToratShaiArticle } from '../services/toratShaiTorah.mjs';
import { useTorahArticle, useTorahCatalog, useWeeklyPicks } from '../components/torah/useTorah.js';
import TitleOrnament from '../components/ui/TitleOrnament.jsx';
import ArrowMark from '../components/ui/ArrowMark.jsx';

const goBack = (go, fallback) => (Number(history.state?.kzDepth) > 0 ? history.back() : go(fallback));
const countLabel = count => (count === 1 ? 'דבר תורה אחד' : `${count} דברי תורה`);

export default function TorahContentPage({ route = 'torah', go, context = null, items = [], now = new Date(), tzid = 'Asia/Jerusalem' }) {
  const parsed = parseTorahRoute(route);
  const todayKey = getJewishDateKey(now, tzid);
  if (parsed.view === 'article') return <TorahArticleReader key={parsed.id} id={parsed.id} go={go} tzid={tzid} />;
  if (parsed.view === 'favorites') return <TorahFavorites go={go} />;
  if (parsed.view !== 'home') return <TorahCollection kind={parsed.view} id={parsed.id} go={go} todayKey={todayKey} />;
  return <TorahHome go={go} context={context} items={items} todayKey={todayKey} />;
}

// ---- one row of a list: the title, a quiet line (time · topic), an arrow; the whole row opens the article ----
export function TorahRow({ article, onOpen, meta = null, action = null }) {
  return <li className={`tc-row${action ? ' has-action' : ''}`}>
    <button type="button" className="tc-row-open" onClick={() => onOpen(article)}>
      <span className="tc-row-text"><strong className="tc-row-title">{article.title}</strong><small className="tc-row-meta">{meta || articleKindLine(article)}</small></span>
      <ArrowMark className="tc-row-arrow" legacy="‹" />
    </button>
    {action}
  </li>;
}

function WeekPicks({ week, replace, go, heading, headingId }) {
  if (!week?.picks?.length) return null;
  return <section className="tc-section" aria-labelledby={headingId}>
    <h2 className="tc-section-title" id={headingId}>{heading}</h2>
    <ol className="tc-list">{week.picks.map((article, index) => <TorahRow key={article.id} article={article} onOpen={item => go(torahRoute.article(item.id))}
      action={week.canReplace && !article.pinned ? <button type="button" className="tc-replace" onClick={() => { replace(index); announce('דבר התורה הוחלף'); }} aria-label={`החלפת דבר התורה: ${article.title}`}>החלפה</button> : null} />)}</ol>
  </section>;
}

// ---- the library's home ----
function TorahHome({ go, context, items, todayKey }) {
  const catalog = useTorahCatalog();
  const parashaName = context?.parasha?.hebrew || context?.parasha?.title || context?.upcomingShabbat?.hebrew || null;
  const focus = useMemo(() => torahWeekFocus({ items, todayKey, parashaName, catalog }), [items, todayKey, parashaName, catalog]);
  const { week, replace } = useWeeklyPicks(focus, catalog);
  const [query, setQuery] = useSearchState('torah-query');
  const counts = useMemo(() => parashaCounts(catalog), [catalog]);
  const holidays = useMemo(() => holidayCollections(catalog), [catalog]);
  const specials = useMemo(() => specialShabbatCollections(catalog), [catalog]);
  const topics = useMemo(() => topicCollections(catalog), [catalog]);
  const favorites = useTorahFavorites();
  // The tile of the week follows what is read on the coming Shabbat (dayContext.weekReading): none on a festival
  // Shabbat, וזאת הברכה on Israel's Shemini Atzeret.
  const reading = context?.weekReading;
  const current = reading ? (reading.kind === 'parasha' ? parashotOfReading(reading.name) : []) : focus?.kind === 'parasha' ? focus.parashot : [];
  return <section className="tc-page tc-home" aria-labelledby="tc-home-title">
    <header className="tc-head">
      <p className="eyebrow">ספריית מקורות</p>
      <h1 id="tc-home-title">דברי תורה</h1>
      <TitleOrnament />
      <p className="tc-head-line">לפרשות השבוע, למועדים ולשבתות המיוחדות</p>
    </header>
    <form className="halacha-search tc-search" role="search" onSubmit={event => event.preventDefault()}>
      <label htmlFor="tc-search-field">חיפוש בדברי התורה</label>
      <ClearableInput id="tc-search-field" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="כותרת, פרשה, מועד, נושא או מילה מן הטקסט" autoComplete="off" clearLabel="נקה חיפוש בדברי התורה" deferred />
    </form>
    {query.trim() ? <TorahSearchResults query={query} go={go} /> : <>
      {week && <WeekPicks week={week} replace={replace} go={go} heading={`השבוע · ${focus.name}`} headingId="tc-week" />}
      {week && week.more > 0 && <p className="tc-more"><button type="button" className="tc-more-link" onClick={() => go(focus.route)}>{`עוד ${countLabel(week.more)} ל${focus.kind === 'parasha' ? 'פרשה' : focus.name}`}</button></p>}
      <section className="tc-section" aria-labelledby="tc-parashot">
        <h2 className="tc-section-title" id="tc-parashot">פרשות השבוע</h2>
        {TORAH_BOOKS.map(book => <div className="tc-book" key={book.id} role="group" aria-labelledby={`tc-book-${book.id}`}>
          <h3 className="tc-book-title" id={`tc-book-${book.id}`}>ספר {book.he}</h3>
          <div className="tc-tiles">{book.parashot.map(name => <button type="button" key={name} className="tc-tile" aria-current={current.includes(name) ? 'true' : undefined} onClick={() => go(torahRoute.parasha(name))} aria-label={`פרשת ${name}, ${countLabel(counts[name] || 0)}${current.includes(name) ? ', פרשת השבוע' : ''}`}>
            <strong>{name}</strong><small aria-hidden="true">{counts[name] || 0}</small>
          </button>)}</div>
        </div>)}
      </section>
      {holidays.length > 0 && <TileSection id="tc-moadim" title="מועדים" items={holidays} onOpen={item => go(torahRoute.holiday(item.id))} />}
      {specials.length > 0 && <TileSection id="tc-specials" title="שבתות מיוחדות" items={specials} onOpen={item => go(torahRoute.special(item.id))} />}
      {topics.length > 0 && <TileSection id="tc-topics" title="נושאים" items={topics.slice(0, 24)} onOpen={item => go(torahRoute.topic(item.id))} />}
      <section className="tc-section" aria-labelledby="tc-favorites">
        <h2 className="tc-section-title" id="tc-favorites">מועדפים</h2>
        {favorites.length ? <ol className="tc-list">{favorites.slice(0, 3).map(item => <li className="tc-row" key={item.key}><button type="button" className="tc-row-open" onClick={() => go(item.open.route)}><span className="tc-row-text"><strong className="tc-row-title">{item.title}</strong>{item.subtitle && <small className="tc-row-meta">{item.subtitle}</small>}</span><ArrowMark className="tc-row-arrow" legacy="‹" /></button></li>)}</ol>
          : <p className="tc-quiet">דבר תורה שתשמרו בלב יופיע כאן.</p>}
        {favorites.length > 3 && <p className="tc-more"><button type="button" className="tc-more-link" onClick={() => go(torahRoute.favorites())}>{`לכל המועדפים (${favorites.length})`}</button></p>}
      </section>
      {catalog.hasArchive && <p className="tc-archive-note">חלק ממאגר דברי התורה מבוסס על עלוני ״{BNEI_ZION.collection}״ מאת {BNEI_ZION.author}, ומשמש באפליקציה באישורו.</p>}
    </>}
  </section>;
}

function TileSection({ id, title, items, onOpen }) {
  return <section className="tc-section" aria-labelledby={id}>
    <h2 className="tc-section-title" id={id}>{title}</h2>
    <div className="tc-tiles tc-tiles-wide">{items.map(item => <button type="button" key={item.id} className="tc-tile" onClick={() => onOpen(item)} aria-label={`${item.he}, ${countLabel(item.count)}`}><strong>{item.he}</strong><small aria-hidden="true">{item.count}</small></button>)}</div>
  </section>;
}

function useTorahFavorites() {
  const read = () => readFavorites().filter(item => item.kind === 'torah');
  const [items, setItems] = useState(read);
  useEffect(() => onFavoritesChange(() => setItems(read())), []);
  return items;
}

// ---- search inside the library (the same fields as the global search; the query runs after the text settles) ----
export function useTorahSearch(query, limit = 30) {
  const [hits, setHits] = useState(null);
  useEffect(() => {
    let live = true;
    const run = () => { if (live) setHits(searchTorahContent(query, { limit })); };
    if (torahSearchReady()) { const timer = setTimeout(run, 0); return () => { live = false; clearTimeout(timer); }; }
    prepareTorahSearch().then(run).catch(() => { if (live) setHits([]); });
    return () => { live = false; };
  }, [query, limit]);
  return hits;
}

function TorahSearchResults({ query, go }) {
  const hits = useTorahSearch(query.trim());
  return <section className="tc-section" aria-labelledby="tc-results" data-kz-results>
    <h2 className="tc-section-title" id="tc-results">{hits === null ? 'מחפשים…' : hits.length ? `נמצאו ${hits.length === 30 ? 'לפחות 30' : hits.length}` : 'לא נמצאו דברי תורה'}</h2>
    {hits?.length > 0 && <ol className="tc-list">{hits.map(hit => <TorahRow key={hit.id} article={hit.article} meta={hit.meta} onOpen={item => go(torahRoute.article(item.id))} />)}</ol>}
    {hits?.length === 0 && <p className="tc-quiet">נסו שם של פרשה, מועד או נושא, או מילה אחרת מן הטקסט.</p>}
  </section>;
}

// ---- a parasha / festival / special Shabbat / topic ----
function collectionTitle(kind, id) {
  if (kind === 'parasha') return { title: `פרשת ${id}`, eyebrow: `ספר ${bookOfParasha(id)?.he || ''}`.trim() };
  if (kind === 'holiday') return { title: holidayLabel(id) || id, eyebrow: 'מועדים' };
  if (kind === 'special') return { title: specialShabbatLabel(id) || id, eyebrow: 'שבתות מיוחדות' };
  return { title: id, eyebrow: 'נושא' };
}

function TorahCollection({ kind, id: rawId, go, todayKey }) {
  const catalog = useTorahCatalog();
  const id = kind === 'parasha' ? canonicalParasha(rawId) || rawId : rawId;
  const scope = { kind, id };
  const all = useMemo(() => scopeArticles(catalog, scope), [catalog, kind, id]);
  const focus = useMemo(() => collectionFocus(kind, id, { todayKey }), [kind, id, todayKey]);
  const { week, replace } = useWeeklyPicks(all.length > 3 && kind !== 'topic' ? focus : null, catalog);
  const [type, setType] = useRouteState('torah-type', 'all');
  const [topic, setTopic] = useRouteState('torah-topic', 'all');
  const [readTime, setReadTime] = useRouteState('torah-time', 'all');
  const [sort, setSort] = useRouteState('torah-sort', 'order');
  const types = useMemo(() => [...new Set(all.map(item => item.contentType))], [all]);
  const topics = useMemo(() => [...new Set(all.flatMap(item => item.topics))].sort((a, b) => a.localeCompare(b, 'he')), [all]);
  const shown = useMemo(() => sortArticles(filterArticles(all, { contentType: type, topic, readTime }), sort), [all, type, topic, readTime, sort]);
  const { title, eyebrow } = collectionTitle(kind, id);
  const filtered = type !== 'all' || topic !== 'all' || readTime !== 'all';
  const showFilters = all.length > 4;
  const neighbours = kind === 'parasha' ? neighbourParashot(id) : null;
  const open = item => go(torahRoute.article(item.id));
  return <section className="tc-page tc-collection" aria-labelledby="tc-collection-title">
    <BackNavigation label="דברי תורה" onClick={() => goBack(go, torahRoute.home())} />
    {kind === 'parasha' && <ParashaPicker current={id} go={go} counts={parashaCounts(catalog)} />}
    <header className="tc-head">
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="tc-collection-title">{title}</h1>
      <TitleOrnament />
      <p className="tc-head-line">{all.length ? countLabel(all.length) : 'עדיין אין כאן דברי תורה'}</p>
    </header>
    {!all.length && <p className="tc-empty">דברי התורה ל{title} יתווספו בהמשך. בינתיים אפשר לעבור לפרשה אחרת, או לחפש לפי נושא.</p>}
    {week && <WeekPicks week={week} replace={replace} go={go} heading="שלושה לשבת" headingId="tc-collection-week" />}
    {all.length > 0 && <section className="tc-section" aria-labelledby="tc-all">
      <h2 className="tc-section-title" id="tc-all">{week ? 'כל דברי התורה' : 'דברי התורה'}</h2>
      {showFilters && <div className="tc-filters" role="group" aria-label="סינון ומיון">
        <Selector variant="chip" className="tc-filter" label="סוג" value={type} defaultValue="all" onChange={setType} options={[['all', 'כל הסוגים'], ...types.map(value => [value, CONTENT_TYPES[value] || contentTypeLabel(value)])]} />
        <Selector variant="chip" className="tc-filter" label="נושא" value={topic} defaultValue="all" onChange={setTopic} disabled={!topics.length} options={[['all', 'כל הנושאים'], ...topics.map(value => [value, value])]} />
        <Selector variant="chip" className="tc-filter" label="אורך" value={readTime} defaultValue="all" onChange={setReadTime} options={READ_TIME_FILTERS} />
        <Selector variant="chip" className="tc-filter" label="סדר" value={sort} defaultValue="order" onChange={setSort} options={SORTS} />
      </div>}
      {filtered && <p className="tc-count" role="status">{shown.length ? `${shown.length} מתוך ${all.length}` : 'אין דברי תורה מתאימים לסינון'}{shown.length < all.length && <button type="button" className="tc-clear" onClick={() => { setType('all'); setTopic('all'); setReadTime('all'); }}>הצגת הכול</button>}</p>}
      {filtered || sort !== 'order' ? <ol className="tc-list">{shown.map(article => <TorahRow key={article.id} article={article} onOpen={open} />)}</ol>
        : groupArticles(shown).map(group => <ArticleGroup key={group.slot} group={group} onOpen={open} single={groupArticles(shown).length === 1} />)}
    </section>}
    {neighbours && <nav className={`tc-prevnext${neighbours.previous && neighbours.next ? '' : ' is-single'}`} aria-label="הפרשה הקודמת והבאה">
      {neighbours.previous ? <button type="button" className="tc-step is-previous" onClick={() => go(torahRoute.parasha(neighbours.previous))}><span className="tc-step-label"><ArrowMark dir="back" size="inline" legacy="→ " />הפרשה הקודמת</span><strong>{neighbours.previous}</strong></button> : null}
      {neighbours.next ? <button type="button" className="tc-step is-next" onClick={() => go(torahRoute.parasha(neighbours.next))}><span className="tc-step-label">הפרשה הבאה<ArrowMark size="inline" legacy=" ←" /></span><strong>{neighbours.next}</strong></button> : null}
    </nav>}
  </section>;
}

// One group of a collection (stories and meshalim / short / longer), the first ones shown and the rest one tap away.
const GROUP_SHOWN = 8;
function ArticleGroup({ group, onOpen, single = false }) {
  const [all, setAll] = useRouteState(`torah-group-${group.slot}`, false);
  const list = all ? group.items : group.items.slice(0, GROUP_SHOWN);
  return <section className="tc-group" aria-labelledby={`tc-group-${group.slot}`}>
    {!single && <h3 className="tc-group-title" id={`tc-group-${group.slot}`}>{group.label}<small>{group.items.length}</small></h3>}
    <ol className="tc-list">{list.map(article => <TorahRow key={article.id} article={article} onOpen={onOpen} />)}</ol>
    {group.items.length > list.length && <p className="tc-more"><button type="button" className="tc-more-link" onClick={() => setAll(true)}>{`${{ story: 'כל הסיפורים והמשלים', short: 'כל הקצרים', deep: 'כל דברי העיון' }[group.slot]} (${group.items.length})`}</button></p>}
  </section>;
}

// From any parasha to any other: the five books, and the chosen book's parashot in one strip (the current one marked).
export function ParashaPicker({ current, go, counts = {} }) {
  const [bookId, setBookId] = useState(() => bookOfParasha(current)?.id || TORAH_BOOKS[0].id);
  useEffect(() => { setBookId(bookOfParasha(current)?.id || TORAH_BOOKS[0].id); }, [current]);
  const book = TORAH_BOOKS.find(item => item.id === bookId) || TORAH_BOOKS[0];
  const strip = useRef(null);
  useEffect(() => {
    const active = strip.current?.querySelector('[aria-current="page"]');
    if (active && strip.current) { const box = strip.current; box.scrollLeft = active.offsetLeft - (box.clientWidth - active.offsetWidth) / 2; }
  }, [bookId, current]);
  return <nav className="tc-picker" aria-label="מעבר לפרשה אחרת">
    <div className="tc-picker-books" role="group" aria-label="ספר">
      {TORAH_BOOKS.map(item => <button type="button" key={item.id} className="tc-picker-book" aria-pressed={item.id === book.id} onClick={() => setBookId(item.id)}>{item.he}</button>)}
    </div>
    <div className="tc-picker-strip" ref={strip}>
      {book.parashot.map(name => <button type="button" key={name} className="tc-picker-parasha" aria-current={name === current ? 'page' : undefined} onClick={() => go(torahRoute.parasha(name))} aria-label={`פרשת ${name}, ${countLabel(counts[name] || 0)}`}>{name}</button>)}
    </div>
  </nav>;
}

function TorahFavorites({ go }) {
  const favorites = useTorahFavorites();
  return <section className="tc-page" aria-labelledby="tc-fav-title">
    <BackNavigation label="דברי תורה" onClick={() => goBack(go, torahRoute.home())} />
    <header className="tc-head"><p className="eyebrow">דברי תורה</p><h1 id="tc-fav-title">מועדפים</h1><TitleOrnament /></header>
    {favorites.length ? <ol className="tc-list">{favorites.map(item => <li className="tc-row" key={item.key}><button type="button" className="tc-row-open" onClick={() => go(item.open.route)}><span className="tc-row-text"><strong className="tc-row-title">{item.title}</strong>{item.subtitle && <small className="tc-row-meta">{item.subtitle}</small>}</span><ArrowMark className="tc-row-arrow" legacy="‹" /></button></li>)}</ol>
      : <p className="tc-empty">עוד לא נשמר כאן דבר. בתחתית כל דבר תורה יש ״שמירה״.</p>}
  </section>;
}

// ---- the reader ----
export function TorahArticleReader({ id, go, tzid = 'Asia/Jerusalem' }) {
  const { catalog, status, article, message } = useTorahArticle(id);
  const meta = article || torahArticle(catalog, id);
  const scope = primaryScope(meta);
  const ready = status === 'ready' && article;
  // Study time: only real engagement, a full minute at least (useStudyTimer), never a tap.
  useStudyTimer({ workId: `torah:${id}`, workTitle: meta?.title || 'דבר תורה', unitId: id, unitLabel: scope?.label || null, category: 'torah_study', source: 'torah-content', tzid, enabled: Boolean(ready) });
  useEffect(() => { if (ready) rememberLearning(`torah:${id}`, { source: 'torah', reference: torahRoute.article(id), title: article.title, detail: scope?.label || 'דבר תורה' }); }, [ready, id]);
  // Read to its end: the device remembers it (the weekly selection prefers what was not read), and "continue" lets go.
  const end = useRef(null);
  useEffect(() => {
    if (!ready || !end.current || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || window.scrollY < 40) return;
      markTorahRead(id); completeLearning(`torah:${id}`); observer.disconnect();
    });
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [ready, id]);
  const neighbours = meta ? articleNeighbours(catalog, id) : { previous: null, next: null };
  const favorite = meta ? routeFavorite('torah', torahRoute.article(id), meta.title, scope?.label) : null;
  const topicRoute = meta?.topics?.length && !(scope?.kind === 'topic') ? torahRoute.topic(meta.topics[0]) : null;
  const archive = meta?.collection === 'bnei-zion';
  const own = isToratShaiArticle(meta);
  const blocks = own ? meta.body?.blocks : null;
  const back = () => goBack(go, scope?.route || torahRoute.home());
  const [readingScale] = useReadingScale();
  if (status === 'missing' || (!meta && catalog.loaded)) return <section className="tc-page"><BackNavigation label="דברי תורה" onClick={() => goBack(go, torahRoute.home())} /><p className="tc-empty" role="status">דבר התורה לא נמצא במאגר שבמכשיר.</p></section>;
  return <article className="tc-page tc-article" aria-labelledby="tc-article-title" style={{ '--reading-scale': readingScale }}>
    <BackNavigation label={scope?.label || 'דברי תורה'} onClick={back} />
    <header className="tc-article-head">
      <h1 id="tc-article-title">{meta?.title || 'דבר תורה'}</h1>
      {meta?.heading && <p className="tc-article-heading">{meta.heading}</p>}
      {own && meta.verse && <p className="tc-article-verse">„{meta.verse.text}” <small>({meta.verse.ref})</small></p>}
      {own && <p className="tc-article-byline">מאת {TORAT_SHAI_CREDIT.author}</p>}
      {meta && <p className="tc-article-meta">{articleMetaLine(meta)}</p>}
    </header>
    {status === 'loading' && <p className="loading tc-loading" role="status">טוען…</p>}
    {status === 'error' && <p className="tc-empty" role="alert">{message || 'דבר התורה אינו זמין כרגע במכשיר.'}</p>}
    {ready && <div className="reader-tools tc-article-tools"><TextSizeControl /></div>}
    {ready && <div className="tc-article-body" lang="he">{blocks ? blocks.map((block, index) => {
      // The owner's piece keeps its form: sub-headings, quotations with their reference, the signature.
      if (block.type === 'section') return <h2 key={index} className="tc-article-section">{block.title}</h2>;
      if (block.type === 'source') return <blockquote key={index} className="tc-article-source"><p>{block.text}</p><cite>{block.ref}</cite></blockquote>;
      if (block.type === 'signature') return <p key={index} className="tc-article-signature">{block.text}</p>;
      return <p key={index}>{block.text}</p>;
    }) : article.paragraphs.map((text, index) => <p key={index}>{text}</p>)}</div>}
    {ready && <footer className="tc-credit" ref={end} aria-label="מקור">
      <TitleOrnament />
      {archive ? <>
        <p className="tc-credit-from">מתוך ״{BNEI_ZION.collection}״</p>
        <p className="tc-credit-author">{BNEI_ZION.author}</p>
        <p className="tc-credit-note">{BNEI_ZION.permission}</p>
      </> : own ? <>
        <p className="tc-credit-from">{TORAT_SHAI_CREDIT.collection}</p>
        <p className="tc-credit-author">מאת {TORAT_SHAI_CREDIT.author}</p>
      </> : <p className="tc-credit-from">{article.source?.ref || 'מקורות הדברים מצוינים בגוף הטקסט'}</p>}
    </footer>}
    {meta && <div className="tc-actions" role="group" aria-label="פעולות">
      <FavoriteAction item={favorite} />
      {ready && <ShareImageButton className="tc-action" label="שיתוף" spec={() => shareSpecOf(article, scope)} />}
      {scope && scope.kind !== 'all' && <button type="button" className="tc-action" onClick={() => go(scope.route)}>{{ parasha: 'עוד לפרשה', holiday: 'עוד למועד', special: 'עוד לשבת זו', topic: 'עוד בנושא' }[scope.kind]}</button>}
      {topicRoute && <button type="button" className="tc-action" onClick={() => go(topicRoute)}>עוד בנושא</button>}
    </div>}
    {(neighbours.previous || neighbours.next) && <nav className={`tc-prevnext${neighbours.previous && neighbours.next ? '' : ' is-single'}`} aria-label="דבר התורה הקודם והבא">
      {neighbours.previous ? <button type="button" className="tc-step is-previous" onClick={() => go(torahRoute.article(neighbours.previous.id))}><span className="tc-step-label"><ArrowMark dir="back" size="inline" legacy="→ " />הקודם</span><strong>{neighbours.previous.title}</strong></button> : null}
      {neighbours.next ? <button type="button" className="tc-step is-next" onClick={() => go(torahRoute.article(neighbours.next.id))}><span className="tc-step-label">הבא<ArrowMark size="inline" legacy=" ←" /></span><strong>{neighbours.next.title}</strong></button> : null}
    </nav>}
  </article>;
}

function FavoriteAction({ item }) {
  const [saved, toggle] = useFavorite(item);
  if (!item) return null;
  return <button type="button" className={`tc-action tc-favorite${saved ? ' is-saved' : ''}`} aria-pressed={saved} onClick={() => { toggle(); announce(saved ? 'הוסר ממועדפים וסימניות' : 'נשמר במועדפים וסימניות'); }}>
    <HeartIcon filled={saved} />{saved ? 'נשמר' : 'שמירה'}
  </button>;
}

// The share image carries the opening of the text and, for the archive, its credit in full.
export function shareSpecOf(article, scope = primaryScope(article)) {
  const archive = article.collection === 'bnei-zion';
  const opening = article.paragraphs.slice(0, 2).join(' ');
  const body = opening.length > 520 ? `${opening.slice(0, opening.lastIndexOf(' ', 500))}…` : opening;
  return {
    kind: 'verse', eyebrow: ['דבר תורה', scope?.label].filter(Boolean).join(' · '), title: article.title, body,
    source: archive ? `מתוך ״${BNEI_ZION.collection}״ · ${BNEI_ZION.author}` : (article.source?.ref || 'כזוהר הרקיע'),
    notice: archive ? BNEI_ZION.permission : null,
  };
}

