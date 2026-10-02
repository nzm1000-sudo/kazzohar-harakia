import { HALACHA_SOURCE_MAP } from '../../data/halachaSourceMap.mjs';
import { hebrewNumeral } from '../../services/hebrewNumerals.mjs';
import ArrowMark from '../ui/ArrowMark.jsx';

// "מפת המקורות" and "השווה מקורות" for one verified entry. Loaded only when a question page opens it.
// Only verified relationships are drawn: the Yalkut Yosef section the answer quotes (and any supporting sections); the
// Shulchan Arukh siman that section is built on, where the wording confirms it (scripts/halacha/source-map.mjs); and
// the commentaries arranged on that same siman. Nothing here says that sources agree.
export default function SourceDepth({ entry, openSource, nav }) {
  const parallel = HALACHA_SOURCE_MAP[entry.id];
  const [primary, ...supporting] = entry.sources || [];
  if (!primary) return null;
  const oc = parallel?.book === 'Orach_Chayim';
  const siman = parallel ? hebrewNumeral(parallel.siman) : '';
  const seif = parallel ? hebrewNumeral(parallel.seif) : '';
  const commentaries = oc ? [
    { ref: `Beit Yosef, Orach Chayim ${parallel.siman}`, title: `בית יוסף, אורח חיים סימן ${siman}`, note: 'על הטור, באותו סימן' },
    { ref: `Kaf HaChayim on Shulchan Arukh, Orach Chayim ${parallel.siman}`, title: `כף החיים, אורח חיים סימן ${siman}`, note: 'על השולחן ערוך, באותו סימן' },
  ] : [];
  return <>
    <details className="halacha-more">
      <summary>מפת המקורות<ArrowMark dir="down" size="inline" clayOnly /></summary>
      <ol className="source-map">
        {parallel && <li className="source-map-node"><span className="source-map-kind">יסוד</span><button type="button" className="link" onClick={() => openSource(parallel.simanRef, `שולחן ערוך · ${parallel.bookHe} ${siman}`, 'nikud', nav)}>שולחן ערוך, {parallel.bookHe}, סימן {siman}</button><small>ילקוט יוסף בנוי על סדר סימן זה; ההתאמה נבדקה בהשוואת הנוסח.</small></li>}
        {commentaries.length > 0 && <li className="source-map-node"><span className="source-map-kind">פירושים על אותו סימן</span>{commentaries.map(item => <button type="button" key={item.ref} className="link" onClick={() => openSource(item.ref, item.title, 'nikud', nav)}>{item.title}</button>)}<small>נפתחים מהרשת. אין בהם קביעה שהדין זהה.</small></li>}
        <li className="source-map-node is-practical"><span className="source-map-kind">הפסיקה המעשית באפליקציה</span><button type="button" className="link" onClick={() => openSource(primary.ref, `${primary.work} · ${primary.citation}`, 'nikud', nav)}>{primary.work}, {primary.citation}</button>{supporting.map(source => <button type="button" key={source.localSourceId} className="link" onClick={() => openSource(source.ref, `${source.work} · ${source.citation}`, 'nikud', nav)}>ובנוסף: {source.citation}</button>)}</li>
        {primary.furtherRefs?.length > 0 && <li className="source-map-node"><span className="source-map-kind">ילקוט יוסף מפנה ל</span><small>{primary.furtherRefs.join(' · ')}</small></li>}
      </ol>
      {!parallel && <p className="source-map-note">לתשובה זו לא נמצאה התאמה מאומתת לסימן בשולחן ערוך, ולכן היא מוצגת ללא קישור כזה.</p>}
    </details>
    {parallel && <details className="halacha-more">
      <summary>השווה מקורות<ArrowMark dir="down" size="inline" clayOnly /></summary>
      <section className="compare-block is-practical"><p className="compare-kind">הפסיקה המעשית המוצגת באפליקציה</p><h3>{primary.work}, {primary.citation}</h3><blockquote>{primary.excerpt || entry.shortAnswer}</blockquote></section>
      <section className="compare-block"><p className="compare-kind">מקור לעיון</p><h3>שולחן ערוך, {parallel.bookHe} {siman}, סעיף {seif}</h3><blockquote>{parallel.text}</blockquote><small>הסעיף הקרוב ביותר בנוסחו באותו סימן. ההשוואה ללימוד; אין בה הכרעה.</small><button type="button" className="link" onClick={() => openSource(parallel.ref, `שולחן ערוך · ${parallel.bookHe} ${siman}, ${seif}`, 'nikud', nav)}>פתיחת הסימן במלואו<ArrowMark size="inline" legacy={'\u00A0←'} /></button></section>
      {commentaries.map(item => <section className="compare-block" key={item.ref}><p className="compare-kind">מקור לעיון · {item.note}</p><h3>{item.title}</h3><button type="button" className="link" onClick={() => openSource(item.ref, item.title, 'nikud', nav)}>פתיחה בקורא<ArrowMark size="inline" legacy={'\u00A0←'} /></button></section>)}
    </details>}
  </>;
}
