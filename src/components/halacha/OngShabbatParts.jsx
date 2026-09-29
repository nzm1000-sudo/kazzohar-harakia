import { useEffect, useMemo, useState } from 'react';
import { PRACTICAL_HALACHA_QA_INDEX } from '../../data/practicalHalachaQa.mjs';
import { searchYalkut } from '../../services/yalkutYosef.mjs';
import { ongNotesFor, ongBookRoute, ONG_CREDIT } from '../../services/ongShabbat.mjs';
import { HIGH_STAKES_NOTE } from '../../services/ongShabbatGate.mjs';
import GlossaryText from './GlossaryText.jsx';

// A question answered from עונג שבת. Three layers, never mixed, in the order a reader needs them:
//   תשובה קצרה (derived; absent for חולה / יולדת / תרופות) → לשון הספר (the book's exact words, always shown) → הסבר
//   (plain language, never a quote). Then the book's own "מקורות וטעמים" for this halacha (with exact links), the
//   same question in Yalkut Yosef side by side, and Yalkut Yosef sections for further study. Loaded only on a question
//   page of this book.
const geresh = label => String(label || '');
export default function OngShabbatAnswer({ entry, go, openSource, nav }) {
  const place = entry.bookPlace;
  const source = entry.sources[0];
  const bookRoute = ongBookRoute(place.chapter, place.unit);
  const parallels = (entry.yalkutParallels || []).map(id => PRACTICAL_HALACHA_QA_INDEX[id]).filter(item => item && item.answerStatus === 'published');
  const yalkutStudy = useMemo(() => [...new Map([entry.question, ...entry.variants.slice(0, 2)].flatMap(query => searchYalkut(query, 2, { requireTitleMatch: true })).map(item => [item.id, item])).values()].slice(0, 2), [entry.id]);
  return <>
    {entry.highStakes ? <section className="ong-high-stakes" aria-label="מקרה של חולה, יולדת או תרופה">
      <p className="notice sensitive">{HIGH_STAKES_NOTE}</p>
      {entry.dangerExcerpt && <figure className="halacha-excerpt ong-danger"><figcaption>במצב של סכנה — כלשון הספר:</figcaption><blockquote>{entry.dangerExcerpt}</blockquote></figure>}
    </section> : <section className="practical-answer" aria-label="תשובה קצרה">
      <p className="ong-layer-label">תשובה קצרה</p>
      <GlossaryText as="p" text={entry.shortAnswer} />
    </section>}
    {entry.techNote && <p className="notice ong-tech-note">{entry.techNote}</p>}
    <section className="ong-book-words" aria-label="לשון הספר">
      <h2>לשון הספר</h2>
      <figure className="halacha-excerpt"><blockquote>{source.excerpt}</blockquote><figcaption>עונג שבת, {source.citation}</figcaption></figure>
      <button type="button" className="link" onClick={() => go(bookRoute)}>ההלכה המלאה בספר ←</button>
    </section>
    {entry.explanation && <section className="ong-explanation" aria-label="הסבר">
      <h2>הסבר</h2>
      <p>{entry.explanation}</p>
      <small>הסבר במילים פשוטות, אינו ציטוט מהספר ואינו פסק נוסף.</small>
    </section>}
    <OngNotes entry={entry} go={go} />
    {parallels.length > 0 && <details className="halacha-more ong-parallels">
      <summary>באותו עניין בילקוט יוסף</summary>
      <p className="source-map-note">שני הספרים זה לצד זה, כל אחד בלשונו. ההשוואה ללימוד: אין כאן קביעה שהם מסכימים או חולקים, ואין הכרעה ביניהם. אם הדברים נראים שונים — פונים לרב.</p>
      <section className="compare-block is-practical"><p className="compare-kind">עונג שבת · {source.citation}</p><blockquote>{source.excerpt}</blockquote></section>
      {parallels.map(other => <section className="compare-block" key={other.id}>
        <p className="compare-kind">ילקוט יוסף · {other.sources[0].citation}</p>
        <h3>{other.question}</h3>
        <blockquote>{other.sources[0].excerpt || other.shortAnswer}</blockquote>
        <button type="button" className="link" onClick={() => go(`halacha/q/${encodeURIComponent(other.id)}`)}>לתשובה בילקוט יוסף ←</button>
      </section>)}
    </details>}
    {yalkutStudy.length > 0 && <section className="source-group"><h3>לעיון בילקוט יוסף (קיצור שו״ע, מהדורת תשס״ז)</h3><div className="book-index">{yalkutStudy.map(item => <button className="index-row" key={item.id} onClick={() => openSource(item.ref, `ילקוט יוסף · ${item.title}`, 'nikud', nav)}><span><strong>{item.title}</strong><small>{item.citation}</small></span><span aria-hidden="true">←</span></button>)}</div></section>}
    <p className="source-credit library-credit">{ONG_CREDIT}</p>
  </>;
}

// "מקורות וטעמים": the book's own notes for this halacha, from the pack (offline), with the exact links they carry.
function OngNotes({ entry, go }) {
  const [state, setState] = useState({ status: 'idle', notes: [] });
  const place = entry.bookPlace;
  useEffect(() => {
    let live = true;
    setState({ status: 'loading', notes: [] });
    ongNotesFor(place.chapter, place.unit).then(notes => { if (live) setState({ status: 'ready', notes }); }, error => { if (live) setState({ status: 'error', notes: [], error: error.message }); });
    return () => { live = false; };
  }, [entry.id]);
  if (state.status === 'ready' && !state.notes.length) return null;
  return <details className="halacha-more ong-notes">
    <summary>מקורות וטעמים ({entry.sources[0].notes?.length || 0})</summary>
    {state.status === 'loading' && <p className="notice">טוען…</p>}
    {state.status === 'error' && <p className="notice">{state.error}</p>}
    {state.notes.map(note => <div key={note.id} className="ong-note">
      <p><sup className="library-fn library-fn-lead">{note.fn}</sup>{note.text}</p>
      {note.links.length > 0 && <div className="ong-note-links">{note.links.map(link => <button key={link.label} type="button" className="link" onClick={() => go(link.route || `books/r/${link.workId}/${link.node}/${link.unit}`)}>{link.label} ←</button>)}</div>}
    </div>)}
    <small>מקורות וטעמים — כלשון הספר, הערות {geresh(entry.sources[0].notes?.join(', '))}.</small>
  </details>;
}
