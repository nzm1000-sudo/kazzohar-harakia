import { useState } from 'react';
import { BackLink } from '../components/LocalNavigation.jsx';
import { shabbatTableContent } from '../services/shabbatTable.mjs';

export default function ShabbatTable({ context, openSource }) {
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const parashaName = context?.parasha?.hebrew || context?.parasha?.title
    || context?.upcomingShabbat?.hebrew || context?.upcomingShabbat?.title || null;
  const content = shabbatTableContent(parashaName);
  // The underlying weekly parasha still exists even when this Shabbat's actual public
  // reading is a holiday override — say so honestly instead of showing unrelated content.
  const holidayReading = context?.shabbatReading?.category === 'holiday' ? context.shabbatReading : null;

  return <section className="preparation shabbat-table">
    <BackLink href="#preparation" label="חזרה להכנה" />
    <p className="eyebrow">שולחן שבת</p>
    <h1>{parashaName || 'שולחן שבת'}</h1>
    {holidayReading && <p className="notice">{`בשבת זו קוראים את קריאת החג${holidayReading.hebrew ? ` — ${holidayReading.hebrew}` : ''}; פרשת ${parashaName} תיקרא בשבת הבאה בסדר הרגיל.`}</p>}
    {!content && <p className="intro">אין כרגע תוכן מאומת לפרשה זו. מוצג רק מה שזמין ומבוסס מקור.</p>}
    {content && <>
      <button type="button" className="table-preview-card" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        <span className="table-preview-text"><strong>דברי תורה לפרשה</strong><small>{content.summary}</small></span>
        <span className="table-preview-arrow" aria-hidden="true">{expanded ? '︿' : '‹'}</span>
      </button>
      {expanded && <div className="table-divrei-torah">
        {content.divreiTorah && content.divreiTorah.length > 0 && content.divreiTorah.map((item, idx) => (
          <article key={idx} className="table-divrei-item">
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            {item.type && <small className="table-item-type">{item.type}</small>}
          </article>
        ))}
      </div>}
      <section className="table-block"><h2>דברי תורה</h2>
        {content.divreiTorah && content.divreiTorah.length > 0 && (
          <div className="divrei-torah-items">
            {content.divreiTorah.map((item, idx) => (
              <article key={idx} className="table-divrei-item">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                {item.type && <small className="table-item-type">{item.type}</small>}
              </article>
            ))}
          </div>
        )}
      </section>
      {content.childContent && <section className="table-block"><h2>לילדים</h2>
        <p>{content.childContent}</p>
      </section>}
      <section className="table-block"><h2>שאלה לשולחן</h2>
        <p>{content.familyQuestion}</p>
      </section>
      <section className="table-block"><h2>מקור קצר</h2>
        <blockquote className="table-source"><p lang="he">{content.source.text}</p><cite>{content.source.ref}</cite></blockquote>
        {openSource && <button type="button" className="ghost" onClick={() => openSource(content.source.ref, parashaName)}>פתיחת המקור</button>}
      </section>
      {content.practicalPoint && <section className="table-block"><h2>נקודה למעשה</h2>
        <p>{content.practicalPoint}</p>
      </section>}
      <section className="table-block"><h2>חידון</h2>
        <p>{content.quiz.question}</p>
        {revealed ? <p className="table-answer"><strong>{content.quiz.answer}</strong></p>
          : <button type="button" className="personal-primary" onClick={() => setRevealed(true)}>הצגת התשובה</button>}
      </section>
    </>}
  </section>;
}
