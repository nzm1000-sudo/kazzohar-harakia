import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { BackNavigation, Breadcrumbs } from '../components/LocalNavigation.jsx';
import ReaderNavigation from '../components/ReaderNavigation.jsx';
import HeartToggle from '../components/HeartToggle.jsx';
import ClearableInput from '../components/ClearableInput.jsx';
import { routeFavorite } from '../services/favorites.mjs';
import { loadShalomRav, parseShalomRavRoute, shalomRavRoute, tocRoute, entryById, entriesInCategory, entriesForNeed, readableEntries,
  neighbours, relatedEntries, searchShalomRav, personalize, inlineParts } from '../services/shalomRav.mjs';

// "שלום רב" — the author's book as a library: what do you need now, by topic, in the book's own order, and a reader
// that keeps the author's explanation, the instructions and the words to be said apart. Offline; the text is its own chunk.
const ORIGIN_LINE = entry => ({
  author: 'מאת הרב שלום יוסף ברבי',
  attributed: entry.attributedTo ? `מקור: ${entry.attributedTo}` : '',
  scripture: entry.scriptureRef ? `מן המקרא · ${entry.scriptureRef}` : '',
}[entry.origin] || '');
const pagesLabel = entry => (entry.printedPages[0] === entry.printedPages[1] ? `עמ׳ ${entry.printedPages[0]} בספר` : `עמ׳ ${entry.printedPages[0]}–${entry.printedPages[1]} בספר`);

function EntryRow({ entry, go, meta }) {
  return <button type="button" className="siddur-entry sr-row" onClick={() => go(shalomRavRoute.entry(entry.id))}>
    <span className="siddur-entry-text"><strong>{entry.title}</strong>{meta && <small>{meta}</small>}</span><span aria-hidden="true">←</span>
  </button>;
}

function SearchResults({ book, query, go }) {
  const results = useMemo(() => searchShalomRav(book, query), [book, query]);
  if (!query.trim()) return null;
  if (!results.length) return <p className="notice sr-empty" role="status">לא נמצא בשלום רב.</p>;
  return <div className="siddur-group-rows sr-results">{results.map(({ entry, snippet }) => <EntryRow key={entry.id} entry={entry} go={go} meta={snippet} />)}</div>;
}

function Home({ book, go }) {
  const [view, setView] = useLocal('shalom-rav-view-v1', 'topic');
  const [open, setOpen] = useLocal('shalom-rav-open-v1', {});
  const [query, setQuery] = useState('');
  const entries = readableEntries(book);
  const partOf = Object.fromEntries(book.entries.filter(entry => entry.part).map(entry => [entry.id, entry.part]));
  return <section className="shalom-rav sr-home">
    <header className="sr-head">
      <h1>{book.book.title}</h1>
      <span className="gold-divider" aria-hidden="true"><i /></span>
      <p className="sr-subtitle">{book.book.subtitle}</p>
      <p className="sr-editor">{book.book.editor}</p>
    </header>
    <label className="sr-search"><ClearableInput value={query} onChange={event => setQuery(event.target.value)} placeholder="חיפוש בשלום רב — פרנסה, חולה, עין הרע…" aria-label="חיפוש בשלום רב" clearLabel="ניקוי החיפוש" type="search" /></label>
    <SearchResults book={book} query={query} go={go} />
    {!query.trim() && <>
      <section className="sr-needs" aria-labelledby="sr-needs-title">
        <h2 id="sr-needs-title">מה אתה צריך עכשיו?</h2>
        <div className="sr-need-grid">{book.needs.map(need => <button type="button" key={need.key} onClick={() => go(shalomRavRoute.need(need.key))}><strong>{need.title}</strong><small>{entriesForNeed(book, need.key).length}</small></button>)}</div>
      </section>
      <div className="seg sr-view" role="radiogroup" aria-label="סידור התוכן">
        <button type="button" role="radio" aria-checked={view === 'topic'} className={view === 'topic' ? 'on' : ''} onClick={() => setView('topic')}>לפי נושא</button>
        <button type="button" role="radio" aria-checked={view === 'book'} className={view === 'book' ? 'on' : ''} onClick={() => setView('book')}>לפי סדר הספר</button>
      </div>
      {view === 'topic' ? <div className="siddur-groups sr-groups">{book.categories.map(category => {
        const list = entriesInCategory(book, category.key);
        return <details key={category.key} className="siddur-group" open={Boolean(open[category.key])} onToggle={event => { const isOpen = event.currentTarget.open; setOpen(state => ({ ...state, [category.key]: isOpen })); }}>
          <summary><strong>{category.title}</strong><span className="siddur-chevron" aria-hidden="true">›</span></summary>
          <div className="siddur-group-rows">{list.map(entry => <EntryRow key={entry.id} entry={entry} go={go} />)}</div>
        </details>;
      })}</div> : <ol className="sr-book-order" aria-label="תוכן הספר">{book.entries.map(entry => <Fragment key={entry.id}>
        {partOf[entry.id] && <li className="sr-part" aria-hidden="true">{partOf[entry.id]}</li>}
        <li><button type="button" onClick={() => go(shalomRavRoute.entry(entry.id))}><span>{entry.title}</span><small>{entry.printedPages[0]}</small></button></li>
        {entry.id === 'brit-mila' && <li className="sr-sub"><button type="button" onClick={() => go(tocRoute('brit-mila#sandak'))}><span>תפילה לסנדק</span><small>81</small></button></li>}
      </Fragment>)}</ol>}
      <footer className="sr-about">
        <button type="button" onClick={() => go(shalomRavRoute.entry('hakdama'))}>הקדמה ודברי ברכה</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => go(shalomRavRoute.entry('divrei-siyum'))}>דברי סיום</button>
        <p>{book.book.printedSubtitle} · {book.book.editorLine}. {entries.length} פרקים, בסדר הספר ולפי נושא, זמינים גם בלי חיבור לרשת.</p>
      </footer>
    </>}
  </section>;
}

function ListPage({ book, title, eyebrow, list, go }) {
  return <section className="shalom-rav sr-list">
    <Breadcrumbs items={[{ label: 'שלום רב', onNavigate: () => go(shalomRavRoute.home()) }, { label: title }]} />
    <BackNavigation label="לשלום רב" onClick={() => go(shalomRavRoute.home())} />
    <header className="sr-head"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><span className="gold-divider" aria-hidden="true"><i /></span></header>
    {list.length ? <div className="siddur-group-rows sr-list-rows">{list.map(entry => <EntryRow key={entry.id} entry={entry} go={go} meta={book.categories.find(c => c.key === entry.category)?.title} />)}</div>
      : <p className="notice">אין כאן עדיין פרקים.</p>}
  </section>;
}

// A text block: the words to be said, the book's own asides in parentheses shown quietly, the names the book leaves
// blank shown filled in when the reader has written them (presentation only; "הנוסח המקורי" shows the book as is).
function TextBlock({ text, entry, names, original, counters, className }) {
  const parts = original || !entry.personalization ? [{ text }] : personalize(text, entry.personalization, names, counters);
  return <p className={className}>{parts.map((part, i) => part.placeholder
    ? (part.filled ? <mark key={i} className="sr-name" title={part.placeholder}>{part.filled}</mark> : <span key={i} className="sr-placeholder">{part.placeholder}</span>)
    : inlineParts(part.text).map((piece, j) => (piece.aside ? <span key={`${i}-${j}`} className="sr-aside">{piece.text}</span> : <Fragment key={`${i}-${j}`}>{piece.text}</Fragment>)))}</p>;
}

function NamesPanel({ entry, names, setNames, original, setOriginal }) {
  const people = entry.personalization.people;
  const set = (key, field, value) => setNames(state => ({ ...state, [key]: { ...(state[key] || {}), [field]: value } }));
  return <details className="sr-names">
    <summary>השלמת שמות בנוסח</summary>
    <p className="sr-names-note">השמות מוצגים בנוסח במקום שהספר משאיר ריק, ונשמרים במכשיר בלבד. הנוסח עצמו אינו משתנה.</p>
    {people.map(person => <fieldset key={person.key} className="sr-person">
      <legend>{person.label}</legend>
      <input type="text" value={names[person.key]?.name || ''} onChange={event => set(person.key, 'name', event.target.value)} placeholder={person.kind === 'city' ? 'שם העיר' : 'שם'} aria-label={person.label} />
      {person.mother && <>
        <div className="seg sr-link" role="radiogroup" aria-label="בן או בת">
          {['בן', 'בת'].map(link => <button key={link} type="button" role="radio" aria-checked={names[person.key]?.link === link} className={names[person.key]?.link === link ? 'on' : ''} onClick={() => set(person.key, 'link', link)}>{link}</button>)}
        </div>
        <input type="text" value={names[person.key]?.mother || ''} onChange={event => set(person.key, 'mother', event.target.value)} placeholder="שם האם" aria-label={`${person.label} — שם האם`} />
      </>}
    </fieldset>)}
    <label className="sr-original"><input type="checkbox" checked={original} onChange={event => setOriginal(event.target.checked)} /> הצגת הנוסח המקורי, כפי שהוא בספר</label>
  </details>;
}

function Reader({ book, entry, anchor, go }) {
  const [font, setFont] = useLocal('shalom-rav-font-v1', 22);
  const [allNames, setAllNames] = useLocal('shalom-rav-names-v1', {});
  const [original, setOriginal] = useState(false);
  const names = allNames[entry.id] || {};
  const setNames = update => setAllNames(state => ({ ...state, [entry.id]: typeof update === 'function' ? update(state[entry.id] || {}) : update }));
  useEffect(() => {
    if (!anchor) { window.scrollTo(0, 0); return; }
    const target = document.getElementById(`sr-${anchor}`);
    if (target) target.scrollIntoView({ block: 'start' });
  }, [entry.id, anchor]);
  const category = book.categories.find(c => c.key === entry.category);
  const { previous, next } = neighbours(book, entry.id);
  const related = relatedEntries(book, entry);
  const counters = {};
  const about = entry.category === 'about';
  let explanationLabelShown = false;
  return <section className={`shalom-rav sr-reader${about ? ' sr-about-entry' : ''}`} style={{ '--sr-size': `${font}px` }}>
    <Breadcrumbs items={[{ label: 'שלום רב', onNavigate: () => go(shalomRavRoute.home()) }, ...(category ? [{ label: category.title, onNavigate: () => go(shalomRavRoute.category(category.key)) }] : []), { label: entry.title }]} />
    <BackNavigation label="לשלום רב" onClick={() => go(shalomRavRoute.home())} />
    <header className="sr-head">
      <p className="eyebrow">{category?.title || 'שלום רב'}</p>
      <div className="reader-title-row"><h1>{entry.title}</h1><HeartToggle item={routeFavorite('shalom-rav', shalomRavRoute.entry(entry.id), entry.title, 'שלום רב')} /></div>
      {entry.subtitle && <p className="sr-entry-subtitle">{entry.subtitle}</p>}
      {ORIGIN_LINE(entry) && <p className="sr-origin">{ORIGIN_LINE(entry)}</p>}
      <span className="gold-divider" aria-hidden="true"><i /></span>
      <div className="reader-tools"><button type="button" onClick={() => setFont(size => Math.max(16, size - 2))} aria-label="הקטנת גופן">א−</button><button type="button" onClick={() => setFont(size => Math.min(40, size + 2))} aria-label="הגדלת גופן">א+</button></div>
    </header>
    {entry.personalization && <NamesPanel entry={entry} names={names} setNames={setNames} original={original} setOriginal={setOriginal} />}
    <article className="sr-body" lang="he">
      {entry.blocks.map((block, i) => {
        if (block.type === 'section') return <h2 key={i} id={block.anchor ? `sr-${block.anchor}` : undefined} className="sr-section">{block.title}{block.origin === 'author' && <small>מאת הרב שלום יוסף ברבי</small>}{block.origin === 'attributed' && block.attributedTo && block.origin !== entry.origin && <small>מקור: {block.attributedTo}</small>}</h2>;
        if (block.type === 'explanation') {
          const label = !about && !explanationLabelShown;
          explanationLabelShown = true;
          return <aside key={i} className={`sr-explanation${about ? ' is-about' : ''}`}>{label && <span className="sr-explanation-label">הסבר מתוך שלום רב</span>}<TextBlock text={block.text} entry={entry} names={names} original={original} counters={counters} /></aside>;
        }
        explanationLabelShown = explanationLabelShown && block.type !== 'text';
        if (block.type === 'instruction') return <TextBlock key={i} className="sr-instruction" text={block.text} entry={entry} names={names} original={original} counters={counters} />;
        if (block.type === 'source') return <blockquote key={i} className="sr-source"><TextBlock text={block.text} entry={entry} names={names} original={original} counters={counters} /></blockquote>;
        if (block.type === 'signature') return <p key={i} className="sr-signature">{block.text}</p>;
        if (block.type === 'motto') return <p key={i} className="sr-motto">{block.text}</p>;
        return <TextBlock key={i} className="sr-text" text={block.text} entry={entry} names={names} original={original} counters={counters} />;
      })}
    </article>
    <p className="sr-provenance">{pagesLabel(entry)}</p>
    {entry.siddur && <button type="button" className="sr-siddur-link" onClick={() => go('siddur')}><span>התפילה בסידור, לפי הנוסח שלך</span><span aria-hidden="true">←</span></button>}
    {related.length > 0 && <section className="sr-related" aria-label="עוד בנושא"><h2>עוד בנושא</h2><div className="sr-related-list">{related.map(other => <button type="button" key={other.id} onClick={() => go(shalomRavRoute.entry(other.id))}>{other.title}</button>)}</div></section>}
    <ReaderNavigation previous={previous} next={next} onSelect={target => go(shalomRavRoute.entry(target.id), { replace: true })} endLabel="סוף הספר" />
    <button type="button" className="sr-toc-link" onClick={() => go(shalomRavRoute.byBook())}>תוכן הספר</button>
  </section>;
}

export default function ShalomRavPage({ route, go }) {
  const book = useResource(loadShalomRav, []);
  const parsed = parseShalomRavRoute(route) || { view: 'home' };
  const [, setView] = useLocal('shalom-rav-view-v1', 'topic');
  useEffect(() => { if (parsed.view === 'book') { setView('book'); go(shalomRavRoute.home(), { replace: true }); } }, [parsed.view]);
  if (book.loading) return <section className="shalom-rav"><p className="loading" role="status">פותחים את שלום רב…</p></section>;
  if (!book.data) return <section className="shalom-rav"><p className="notice" role="alert">שלום רב אינו זמין כרגע.</p></section>;
  const data = book.data;
  if (parsed.view === 'entry') {
    const entry = entryById(data, parsed.id);
    if (entry) return <Reader key={entry.id} book={data} entry={entry} anchor={parsed.anchor} go={go} />;
  }
  if (parsed.view === 'need') {
    const need = data.needs.find(item => item.key === parsed.key);
    if (need) return <ListPage book={data} title={need.title} eyebrow="מה אתה צריך עכשיו?" list={entriesForNeed(data, need.key)} go={go} />;
  }
  if (parsed.view === 'category') {
    const category = data.categories.find(item => item.key === parsed.key);
    if (category) return <ListPage book={data} title={category.title} eyebrow="שלום רב" list={entriesInCategory(data, category.key)} go={go} />;
  }
  return <Home book={data} go={go} />;
}

// The global search's "שלום רב" group (the book is loaded on first use).
export function ShalomRavSearchGroup({ query, onNav }) {
  const book = useResource(loadShalomRav, []);
  const results = useMemo(() => (book.data ? searchShalomRav(book.data, query, { limit: 6 }) : []), [book.data, query]);
  if (!results.length) return null;
  return <section className="search-group"><h2>שלום רב</h2>{results.map(({ entry }) => <button type="button" className="index-row" key={entry.id} onClick={() => onNav(shalomRavRoute.entry(entry.id))}>{entry.title}<small>שלום רב · {pagesLabel(entry)}</small></button>)}</section>;
}
