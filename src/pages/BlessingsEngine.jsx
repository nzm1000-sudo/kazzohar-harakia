import { useMemo, useState } from 'react';
import { useResource } from '../hooks.jsx';
import { BackNavigation } from '../components/LocalNavigation.jsx';
import ClearableInput from '../components/ClearableInput.jsx';
import { packBytesToText } from '../services/library/packs.mjs';
import { nusachOf, nusachTitle } from '../data/nusach/registry.mjs';
import { riteFamily } from '../data/blessings/rules.mjs';
import { indexRecord, openDataRecord, presentRecord, searchFoods } from '../services/blessingsEngine.mjs';

// מנוע הברכות החכם — route "siddur-brachot", a category of the Siddur's "ברכות" family.
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
    const response = await fetch(`${base()}blessings/foods.json.gz`, { signal });
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
  const open = source.route ? () => go?.(source.route) : source.open ? () => openSource?.(source.open.ref, source.open.title, 'nikud') : null;
  return <div className="brachot-source">
    <button type="button" className="brachot-source-open" onClick={open || undefined} disabled={!open} aria-label={`פתיחת המקור: ${source.citation}`}>{source.citation}<span aria-hidden="true">←</span></button>
    {source.excerpt && <blockquote className="brachot-excerpt">{source.excerpt}</blockquote>}
    {(source.questions || []).slice(0, 2).map(question => <button key={question.id} type="button" className="brachot-question" onClick={() => go?.(`halacha/q/${encodeURIComponent(question.id)}`)}>{question.question}<span aria-hidden="true">←</span></button>)}
  </div>;
}

// One of the two symmetric boxes. A blessing that depends on conditions is not squeezed into the box: the box says so,
// and the book's words (or the rule's conditions) follow once, in full, under the pair.
function Blessing({ title, part, hasText }) {
  const label = part?.label || null;
  const spoken = label ? `${title}: ${label}` : `${title}: לפי התנאים${hasText ? ' שבהמשך' : ''}`;
  return <div className="brachot-blessing" aria-label={spoken}>
    <span className="brachot-blessing-title" aria-hidden="true">{title}</span>
    <strong aria-hidden="true">{label || 'לפי התנאים'}</strong>
    {part?.byNusach && <small aria-hidden="true" className="brachot-by-nusach">לפי הנוסח שנבחר</small>}
  </div>;
}

export function FoodCard({ record, nusach, sources, go, openSource, completionSlot }) {
  const view = presentRecord(record, { nusach, sources });
  const [open, setOpen] = useState(false);
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
    {view.nusachNote && <div className="brachot-nusach" role="note">
      <p>{view.nusachNote.text}</p>
      {book && <p className="brachot-nusach-book">בספר עונג שבת (לפי מנהג הספרדים): {book.before || book.text}</p>}
    </div>}
    {view.otherRite && <p className="brachot-other-rite">{view.otherRite.text} <span>({view.otherRite.sources.map(source => source.citation).join('; ')})</span></p>}
    {view.nusachNote && view.nusachNote.sources.length > 0 && <p className="brachot-other-rite"><span>מקור: {view.nusachNote.sources.map(source => source.citation).join('; ')}</span></p>}
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
    {(view.ruleSources.length > 0 || (book && book.shiur) || view.nusachNote || view.otherRite) && <details className="brachot-more" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>המקורות במלואם</summary>
      {view.ruleSources.map(source => <SourceButton key={source.id} source={source} go={go} openSource={openSource} />)}
      {[...(view.nusachNote?.sources || []), ...(view.otherRite?.sources || [])].map(source => <SourceButton key={`rite:${source.id}`} source={source} go={go} openSource={openSource} />)}
      {book?.shiur && <SourceButton source={sources[book.shiur.source]} go={go} openSource={openSource} />}
    </details>}
    <footer className="brachot-source-line">
      {view.sources.map(line => <span key={line}>{line}</span>)}
      {book?.route && <button type="button" className="link" onClick={() => go?.(book.route)}>פתיחה בספר</button>}
    </footer>
    {typeof completionSlot === 'function' ? completionSlot(record) : null}
  </article>;
}

export default function BlessingsEngine({ settings, go, openSource, onBack, completionSlot }) {
  const engine = useResource(loadEngine, []);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(30);
  const nusach = nusachOf(settings);
  const found = useMemo(() => (engine.data && query.trim() ? searchFoods(engine.data.index, query, limit) : { total: 0, results: [] }), [engine.data, query, limit]);
  const sources = engine.data?.book.BLESSING_SOURCES || {};
  const counts = engine.data?.book.ENGINE_COUNTS;
  const search = value => { setQuery(value); setLimit(30); };
  return <section className="brachot-engine">
    <BackNavigation label="חזרה לסידור" onClick={onBack} />
    <header className="brachot-head">
      <h1>מנוע הברכות החכם</h1>
      <span className="gold-divider" aria-hidden="true"><i /></span>
      <p>מה מברכים לפני ואחרי — עם התנאים, והמקור של כל פסק</p>
      <p className="brachot-rite">לפי {riteFamily(nusach) === 'ashkenazi' ? 'מנהג אשכנז' : 'מנהג הספרדים ועדות המזרח'} · נוסח {nusachTitle(nusach)}</p>
    </header>
    <ClearableInput className="brachot-search" inputClassName="brachot-search-input" type="search" value={query} onChange={event => search(event.target.value)} placeholder="חפשו מאכל או משקה" aria-label="חיפוש מאכל או משקה" clearLabel="ניקוי החיפוש" autoComplete="off" enterKeyHint="search" />
    <p className="brachot-status" role="status" aria-live="polite">
      {engine.loading ? 'פותחים את מאגר הברכות…' : engine.error ? engine.error : query.trim() ? (found.total ? `${found.total.toLocaleString('he-IL')} תוצאות` : 'לא נמצא מאכל בשם הזה. נסו שם אחר, או שם כללי יותר.') : counts ? `${counts.bookRows} ערכים מלוח הברכות של עונג שבת · ${(counts.wikidata + counts.openFoodFacts).toLocaleString('he-IL')} מאכלים ומוצרים לפי כללים` : ''}
    </p>
    {engine.data?.foodsError && <p className="notice">{engine.data.foodsError}</p>}
    {!query.trim() && <div className="brachot-quick" aria-label="חיפושים נפוצים">{QUICK.map(word => <button key={word} type="button" onClick={() => search(word)}>{word}</button>)}</div>}
    {found.results.length > 0 && <ol className="brachot-results">{found.results.map(record => <li key={record.id}><FoodCard record={record} nusach={nusach} sources={sources} go={go} openSource={openSource} completionSlot={completionSlot} /></li>)}</ol>}
    {found.total > found.results.length && <button type="button" className="brachot-more-results" onClick={() => setLimit(value => value + 30)}>עוד תוצאות</button>}
    {!query.trim() && engine.data && <section className="brachot-about" aria-label="על המנוע">
      <h2>כך נקבעת כל תשובה</h2>
      <dl>
        <div><dt><span className="brachot-kind is-book">מן הספר</span></dt><dd>לשון לוח הברכות של הספר "עונג שבת" (הרב ישראל שריקי, פרק כ״ו), כפי שנדפס, עם העמוד. המקור שהספר מציין לכל הלוח: ילקוט יוסף.</dd></div>
        <div><dt><span className="brachot-kind is-rule">לפי הכלל</span></dt><dd>מאכל שאינו בלוח, שכלל אחד מן השולחן ערוך, ילקוט יוסף או עונג שבת חל עליו. הכלל ותנאיו מוצגים עם מקורותיהם. מומלץ לברר במקרה של ספק.</dd></div>
        <div><dt><span className="brachot-kind is-conditional">יש בזה דעות</span></dt><dd>מאכל שברכתו תלויה בתנאים או בדעות שהנתונים אינם מכריעים (תערובות, עיקר וטפל, מוצרי אורז ותירס ועוד) — מוצגים התנאים, ולשאול רב.</dd></div>
      </dl>
      <p className="brachot-credit">{engine.data.book.BOOK_TABLE_INFO.intro} (עונג שבת, עמ׳ {engine.data.book.BOOK_TABLE_INFO.introPage})</p>
      <p className="brachot-credit">שמות מוצרים ורכיביהם: Open Food Facts, ברישיון Open Database License (ODbL) — המאגר הנגזר זמין ברישיון זה. שמות מאכלים וסוגיהם: ויקינתונים (CC0). הברכה אינה נלקחת משם: היא נקבעת רק לפי הכללים שבמקורות.</p>
    </section>}
  </section>;
}
