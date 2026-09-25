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
        <article className="table-divrei-item"><h3>בקצרה</h3><p>{content.summary}</p></article>
        <article className="table-divrei-item"><h3>שאלה לשולחן המשפחה</h3><p>{content.familyQuestion}</p></article>
        <article className="table-divrei-item"><h3>שאלה לילדים</h3><p>{content.childQuestion}</p></article>
      </div>}
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
