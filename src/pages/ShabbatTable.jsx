import { useState } from 'react';
import { shabbatTableContent } from '../services/shabbatTable.mjs';

export default function ShabbatTable({ context, openSource }) {
  const [revealed, setRevealed] = useState(false);
  const parashaName = context?.parasha?.hebrew || context?.parasha?.title
    || context?.upcomingShabbat?.hebrew || context?.upcomingShabbat?.title || null;
  const content = shabbatTableContent(parashaName);

  return <section className="preparation shabbat-table">
    <a className="link back-link" href="#preparation">← חזרה להכנה</a>
    <p className="eyebrow">שולחן שבת</p>
    <h1>{parashaName || 'שולחן שבת'}</h1>
    {!content && <p className="intro">אין כרגע תוכן מאומת לפרשה זו. מוצג רק מה שזמין ומבוסס מקור.</p>}
    {content && <>
      <section className="table-block"><h2>בקצרה</h2><p>{content.summary}</p></section>
      <section className="table-block"><h2>שאלה לשולחן</h2><p>{content.familyQuestion}</p></section>
      <section className="table-block"><h2>שאלה לילדים</h2><p>{content.childQuestion}</p></section>
      <section className="table-block"><h2>מקור קצר</h2>
        <blockquote className="table-source"><p lang="he">{content.source.text}</p><cite>{content.source.ref}</cite></blockquote>
        {openSource && <button type="button" className="ghost" onClick={() => openSource(content.source.ref, parashaName)}>פתיחת המקור</button>}
      </section>
      <section className="table-block"><h2>חידון</h2>
        <p>{content.quiz.question}</p>
        {revealed ? <p className="table-answer"><strong>{content.quiz.answer}</strong></p>
          : <button type="button" className="personal-primary" onClick={() => setRevealed(true)}>הצגת התשובה</button>}
      </section>
    </>}
  </section>;
}
