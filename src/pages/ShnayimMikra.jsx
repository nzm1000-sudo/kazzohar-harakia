import { useEffect, useMemo } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { routeParts } from '../services/safeRoute.mjs';
import { ResourceState } from '../components/SourceReader.jsx';
import { BackNavigation } from '../components/LocalNavigation.jsx';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { formatTanakhReference } from '../services/tanakhReferences.mjs';
import { loadEditionChunk } from '../services/library/packs.mjs';
import { SHNAYIM_PACK, SHNAYIM_PROGRESS_V2, shnayimEdition, shnayimParashaById, shnayimParashaForContext, shnayimParashot, shnayimVerses, weeklyParashaForShnayimMikra } from '../services/shnayimMikra.mjs';

export const shnayimRoute = { list: () => 'shnayim-mikra', parasha: id => `shnayim-mikra/${encodeURIComponent(id)}` };
const rangeLabel = parasha => formatTanakhReference(parasha.reference);

export default function ShnayimMikra({ route = 'shnayim-mikra', context, go, onBack }) {
  const [, id] = routeParts(route);
  const parasha = id ? shnayimParashaById(id) : null;
  if (id && parasha) return <ShnayimReader parasha={parasha} go={go} />;
  return <ShnayimList context={context} go={go} onBack={onBack} unknown={id && !parasha} />;
}

function ShnayimList({ context, go, onBack, unknown }) {
  const [progress] = useLocal(SHNAYIM_PROGRESS_V2, {});
  const current = shnayimParashaForContext(context);
  const weekly = weeklyParashaForShnayimMikra(context);
  const books = useMemo(() => {
    const groups = new Map();
    shnayimParashot().filter(item => !item.combined).forEach(item => { if (!groups.has(item.bookHe)) groups.set(item.bookHe, []); groups.get(item.bookHe).push(item); });
    return [...groups];
  }, []);
  const combined = shnayimParashot().filter(item => item.combined);
  const meta = item => {
    const saved = progress[item.id];
    const at = saved ? item.verseIds.indexOf(saved.verseId) : -1;
    return [rangeLabel(item), at >= 0 ? `${at + 1} מתוך ${item.verseIds.length}` : null];
  };
  const Row = ({ item }) => <button type="button" className="library-row" onClick={() => go(shnayimRoute.parasha(item.id))}>
    <span className="library-row-title">{item.he}</span>
    <span className="library-row-meta">{meta(item).filter(Boolean).map(part => <span key={part}>{part}</span>)}</span>
    <span className="library-row-arrow" aria-hidden="true">›</span>
  </button>;
  return <section className="shnayim-mikra" aria-label="שניים מקרא ואחד תרגום">
    {onBack && <BackNavigation label="חזרה לפרשה" onClick={onBack} />}
    <p className="eyebrow">שניים מקרא ואחד תרגום</p>
    <h1>פרשות השבוע</h1>
    {unknown && <p className="notice">הפרשה המבוקשת לא נמצאה.</p>}
    {current && <section><h2 className="library-subhead">השבוע</h2><Row item={current} />{weekly.festivalOverride && <p className="shnayim-note">בשבת זו קוראים קריאת חג; שניים מקרא נשאר על הפרשה הקבועה.</p>}</section>}
    {books.map(([book, items]) => <section key={book}><h2 className="library-subhead">ספר {book}</h2><div className="book-index">{items.map(item => <Row key={item.id} item={item} />)}</div></section>)}
    <section><h2 className="library-subhead">פרשות מחוברות</h2><div className="book-index">{combined.map(item => <Row key={item.id} item={item} />)}</div></section>
  </section>;
}

function ShnayimReader({ parasha, go }) {
  const edition = shnayimEdition(parasha.range.book);
  const resource = useResource(() => loadEditionChunk(edition), [edition.editionId]);
  const [progress, setProgress] = useLocal(SHNAYIM_PROGRESS_V2, {});
  const verses = resource.data ? shnayimVerses(parasha, resource.data) : null;
  const saved = progress[parasha.id]?.verseId || null;
  useEffect(() => {
    if (!verses?.length) return;
    const node = saved ? document.getElementById(`shnayim-${saved}`) : null;
    if (node) node.scrollIntoView({ block: 'start' }); else window.scrollTo({ top: 0 });
  }, [Boolean(verses), parasha.id]);
  const remember = verseId => setProgress(value => ({ ...value, [parasha.id]: { verseId, at: new Date().toISOString() } }));
  const back = () => (Number(history.state?.kzDepth) > 0 ? history.back() : go(shnayimRoute.list()));
  return <section className="shnayim-mikra shnayim-reader" aria-label={`שניים מקרא · ${parasha.he}`}>
    <BackNavigation label="חזרה לפרשות" onClick={back} />
    <p className="eyebrow">שניים מקרא ואחד תרגום</p>
    <h1>פרשת {parasha.he}</h1>
    <p className="shnayim-range">{rangeLabel(parasha)} · {parasha.verseIds.length} פסוקים</p>
    <ResourceState resource={resource} />
    {resource.data && !verses && <p className="notice">לא ניתן להציג את הפרשה במלואה.</p>}
    {verses?.map(verse => <article className="shnayim-verse" id={`shnayim-${verse.id}`} key={verse.id}>
      {verse.chapterStart && <p className="shnayim-chapter">פרק {hebrewNumeral(verse.chapter)}</p>}
      <header><strong>{verse.label}</strong>{verse.id === saved && <small>המשך מכאן</small>}</header>
      <p className="shnayim-mikra-text">{verse.mikra}</p>
      <p className="shnayim-mikra-text">{verse.mikra}</p>
      <p className="shnayim-targum"><span>תרגום אונקלוס</span>{verse.targum}</p>
      <button type="button" className="link shnayim-save" aria-pressed={verse.id === saved} onClick={() => remember(verse.id)}>{verse.id === saved ? 'המקום נשמר' : 'שמירת מקום'}</button>
    </article>)}
    {verses && <div className="source-credit"><p>מקרא: {SHNAYIM_PACK.mikra.heTitle} · נחלת הכלל</p><p>תרגום: {SHNAYIM_PACK.targum.heTitle} · נחלת הכלל</p><p>כל פסוק מוצג עם התרגום של אותו פסוק בדיוק (לפי ספר, פרק ופסוק).</p></div>}
  </section>;
}
