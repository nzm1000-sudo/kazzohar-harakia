import { useEffect, useMemo } from 'react';
import { useResource, useRouteState, useSearchState } from '../hooks.jsx';
import { BackNavigation } from '../components/LocalNavigation.jsx';
import { VisuallyHidden } from '../components/a11yPrimitives.jsx';
import ClearableInput from '../components/ClearableInput.jsx';
import { packBytesToText } from '../services/library/packs.mjs';
import { nusachOf, nusachTitle } from '../data/nusach/registry.mjs';
import { riteFamily } from '../data/blessings/rules.mjs';
import { indexRecord, openDataRecord, presentRecord, searchFoods } from '../services/blessingsEngine.mjs';
import { hebrewLocations } from '../services/hebrewNumerals.mjs';
import ShareImageButton from '../components/ShareImageButton.jsx';
import { blessingShareSpec } from '../services/shareSpecs.mjs';
import { takeEntryBlessingQuery } from '../services/nativeWidgets.mjs';

// מנוע הברכות החכם — route "siddur-brachot", its own category on the Siddur home (last, under ברכות).
// The page is the search and its answers only: no explanatory essay. Each card carries its own source line; the data
// licences (Open Food Facts ODbL, Wikidata CC0) are credited on every card and on the Siddur's "פרטי מקור ורישיון" page.
// The book table (עונג שבת, chapter כ״ו) is part of this page's chunk; the open-data foods (Open Food Facts, Wikidata)
// are one gzip file in public/blessings, cached with the app shell and bundled in the native app, so all of it works
// offline. Every card says where its ruling comes from; see docs/halacha/blessings-engine.md.
//
// completionSlot — PLACEHOLDER for the "סיימתי" (journal) feature, which another change owns: when given, it is called
// with a card's record and what it returns is rendered at the foot of that card. Nothing is recorded by this page.
const base = () => { try { return import.meta.env?.BASE_URL || '/'; } catch { return '/'; } };
async function loadEngine(signal) {
  const book = await import('../data/blessings/bookTable.mjs');
  let foods = [];
  let foodsError = null;
  try {
    // The data version is in the URL: a cached copy of an older build (whose answers may differ) is never read.
    const response = await fetch(`${base()}blessings/foods.json.gz?v=${book.FOODS_VERSION || 1}`, { signal });
    if (!response.ok) throw new Error(String(response.status));
    foods = JSON.parse(await packBytesToText(await response.arrayBuffer())).records;
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    foodsError = 'מאגר המאכלים הרחב אינו זמין כרגע; מוצגים ערכי הספר בלבד.';
  }
  const bookRecords = [...book.BOOK_ROWS, ...book.BOOK_HALACHA_RECORDS];
  const records = [...bookRecords, ...foods.map(row => openDataRecord(row, book.BOOK_ROWS))];
  return { book, records, index: records.map(indexRecord), foodsError, openCount: foods.length };
}

const QUICK = ['תפוח', 'במבה', 'ביסלי', 'קורנפלקס', 'פיצה', 'חלה', 'אורז', 'תירס', 'שוקולד', 'קפה', 'מרק', 'מצה'];

function SourceButton({ source, go, openSource }) {
  if (!source) return null;
  const open = source.route ? () => go?.(source.route) : source.open ? () => openSource?.(source.open.ref, hebrewLocations(source.open.title), 'nikud') : null;
  return <div className="brachot-source">
    <button type="button" className="brachot-source-open" onClick={open || undefined} disabled={!open} aria-label={`פתיחת המקור: ${hebrewLocations(source.citation)}`}>{hebrewLocations(source.citation)}<span aria-hidden="true">←</span></button>
    {source.excerpt && <blockquote className="brachot-excerpt">{source.excerpt}</blockquote>}
    {(source.questions || []).slice(0, 2).map(question => <button key={question.id} type="button" className="brachot-question" onClick={() => go?.(`halacha/q/${encodeURIComponent(question.id)}`)}>{question.question}<span aria-hidden="true">←</span></button>)}
  </div>;
}

// One of the two symmetric boxes. A blessing that depends on conditions is not squeezed into the box: the box says so,
// and the book's words (or the rule's conditions) follow once, in full, under the pair.
function Blessing({ title, part, hasText }) {
  const label = part?.label || null;
  const empty = part?.pending ? 'טרם אומת' : 'לפי התנאים';
  const spoken = label ? `${title}: ${label}` : part?.pending ? `${title}: טרם אומת` : `${title}: לפי התנאים${hasText ? ' שבהמשך' : ''}`;
  // A generic <div> cannot carry a name (aria-label on it is ignored), and every visible part is hidden: the spoken line
  // is its own hidden text.
  return <div className="brachot-blessing">
    <VisuallyHidden>{spoken}</VisuallyHidden>
    <span className="brachot-blessing-title" aria-hidden="true">{title}</span>
    <strong aria-hidden="true">{label || empty}</strong>
    {part?.byNusach && <small aria-hidden="true" className="brachot-by-nusach">לפי הנוסח שנבחר</small>}
  </div>;
}

export function FoodCard({ record, nusach, sources, go, openSource, completionSlot }) {
  const view = presentRecord(record, { nusach, sources });
  // Opened details stay open on Back (a source opened from them returns here as it was).
  const [open, setOpen] = useRouteState(`brachot-open:${record.id}`, false);
  const book = record.kind === 'book' ? record : record.bookRow;
  return <article className={`brachot-card is-${view.kind}`} aria-label={view.name}>
    <header className="brachot-card-head">
      <h3>{view.name}{view.brand && <small className="brachot-brand">{view.brand}</small>}</h3>
      <span className={`brachot-kind is-${view.kind}`}>{view.kindLabel}</span>
    </header>
    {view.ruleTitle && <p className="brachot-rule-title">{view.ruleTitle}</p>}
    <div className="brachot-pair">
      <Blessing title="לפני" part={view.before} hasText={Boolean(view.bookText || view.conditions.length)} />
      <Blessing title="אחרי" part={view.after} hasText={Boolean(view.bookText || view.conditions.length)} />
    </div>
    {view.question && <p className="brachot-ask" role="note"><strong>שאלה אחת מכריעה: </strong>{view.question}</p>}
    {view.nusachNote && <div className="brachot-nusach" role="note">
      <p>{view.nusachNote.text}</p>
      {book && <p className="brachot-nusach-book">בספר עונג שבת (לפי מנהג הספרדים): {book.before || book.text}</p>}
    </div>}
    {view.otherRite && <p className="brachot-other-rite">{view.otherRite.text} <span>({view.otherRite.sources.map(source => hebrewLocations(source.citation)).join('; ')})</span></p>}
    {view.nusachNote && view.nusachNote.sources.length > 0 && <p className="brachot-other-rite"><span>מקור: {view.nusachNote.sources.map(source => hebrewLocations(source.citation)).join('; ')}</span></p>}
    {view.bookText && <blockquote className="brachot-book-text" aria-label="לשון הספר"><span className="brachot-quote-label">לשון הספר</span>{view.bookText}</blockquote>}
    {view.conditions.length > 0 && <ul className="brachot-conditions" aria-label="תנאים">{view.conditions.map(item => <li key={item.text}>{item.text}</li>)}</ul>}
    {view.yalkut.length > 0 && <div className="brachot-beside">
      {view.yalkut.map(item => <div key={item.source.id} className={`brachot-beside-item is-${item.relation}`}>
        <p className="brachot-beside-head"><strong>{item.source.work}</strong> · {item.relationLabel}</p>
        <SourceButton source={item.source} go={go} openSource={openSource} />
      </div>)}
    </div>}
    {view.note && <p className="brachot-note">{view.note}{view.via ? ` (${view.via})` : ''}</p>}
    {view.examples.length > 0 && <p className="brachot-examples">בלוח הברכות של הספר: {view.examples.join(' · ')}</p>}
    {(view.ruleSources.length > 0 || view.web.length > 0 || (book && book.shiur) || view.nusachNote || view.otherRite) && <details className="brachot-more" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>המקורות במלואם</summary>
      {view.ruleSources.map(source => <SourceButton key={source.id} source={source} go={go} openSource={openSource} />)}
      {[...(view.nusachNote?.sources || []), ...(view.otherRite?.sources || [])].map(source => <SourceButton key={`rite:${source.id}`} source={source} go={go} openSource={openSource} />)}
      {book?.shiur && <SourceButton source={sources[book.shiur.source]} go={go} openSource={openSource} />}
      {view.web.length > 0 && <ul className="brachot-web" aria-label="פסקים באתרי רבנים ומוסדות הוראה">
        {view.web.map(item => <li key={item.id}>
          <a href={item.url} target="_blank" rel="noopener noreferrer">{item.citation}</a>
          <small>{item.posek}</small>
          <p>{item.says}</p>
        </li>)}
      </ul>}
    </details>}
    <footer className="brachot-source-line">
      {view.sources.map(line => <span key={line}>{line}</span>)}
      {book?.route && <button type="button" className="link" onClick={() => go?.(book.route)}>פתיחה בספר</button>}
      <ShareImageButton className="link" spec={blessingShareSpec(view)} />
    </footer>
    {typeof completionSlot === 'function' ? completionSlot(record) : null}
  </article>;
}

export default function BlessingsEngine({ settings, go, openSource, onBack, completionSlot }) {
  const engine = useResource(loadEngine, []);
  // The search, and how many results are shown, belong to this history entry: Back from a source returns to them.
  const [query, setQuery] = useSearchState('brachot-query');
  const [limit, setLimit] = useRouteState('brachot-limit', 30);
  const nusach = nusachOf(settings);
  const found = useMemo(() => (engine.data && query.trim() ? searchFoods(engine.data.index, query, limit) : { total: 0, results: [] }), [engine.data, query, limit]);
  const sources = engine.data?.book.BLESSING_SOURCES || {};
  const counts = engine.data?.book.ENGINE_COUNTS;
  const search = value => { setQuery(value); setLimit(30); };
  // A visit opened by Siri / a shortcut ("מה מברכים על…") starts with its words searched.
  useEffect(() => { const words = takeEntryBlessingQuery(); if (words) search(words); }, []);
  return <section className="brachot-engine">
    <BackNavigation label="חזרה לסידור" onClick={onBack} />
    <header className="brachot-head">
      <h1>מנוע הברכות החכם</h1>
      <span className="gold-divider" aria-hidden="true"><i /></span>
      <p>מה מברכים לפני ואחרי — עם התנאים, והמקור של כל פסק</p>
      <p className="brachot-rite">לפי {riteFamily(nusach) === 'ashkenazi' ? 'מנהג אשכנז' : 'מנהג הספרדים ועדות המזרח'} · נוסח {nusachTitle(nusach)}</p>
    </header>
    <ClearableInput className="brachot-search" inputClassName="brachot-search-input" type="search" value={query} onChange={event => search(event.target.value)} placeholder="חפשו מאכל או משקה" aria-label="חיפוש מאכל או משקה" clearLabel="נקה חיפוש" autoComplete="off" enterKeyHint="search" deferred />
    <p className="brachot-status" role="status" aria-live="polite" data-kz-results={query.trim() ? '' : undefined}>
      {engine.loading ? 'פותחים את מאגר הברכות…' : engine.error ? engine.error : query.trim() ? (found.total ? `${found.total.toLocaleString('he-IL')} תוצאות` : 'לא נמצא מאכל בשם הזה. נסו שם אחר, או שם כללי יותר.') : counts ? `${counts.bookRows} ערכים מלוח הברכות של עונג שבת · ${(counts.wikidata + counts.openFoodFacts).toLocaleString('he-IL')} מאכלים ומוצרים לפי כללים` : ''}
    </p>
    {engine.data?.foodsError && <p className="notice">{engine.data.foodsError}</p>}
    {!query.trim() && <div className="brachot-quick" role="group" aria-label="חיפושים נפוצים">{QUICK.map(word => <button key={word} type="button" onClick={() => search(word)}>{word}</button>)}</div>}
    {found.results.length > 0 && <ol className="brachot-results">{found.results.map(record => <li key={record.id}><FoodCard record={record} nusach={nusach} sources={sources} go={go} openSource={openSource} completionSlot={completionSlot} /></li>)}</ol>}
    {found.total > found.results.length && <button type="button" className="brachot-more-results" onClick={() => setLimit(value => value + 30)}>עוד תוצאות</button>}
  </section>;
}
