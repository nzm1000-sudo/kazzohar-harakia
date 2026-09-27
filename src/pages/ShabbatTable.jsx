import { useState } from 'react';
import { BackLink } from '../components/LocalNavigation.jsx';
import { shabbatTableContent } from '../services/shabbatTable.mjs';
import { weeklyDivreiTorah } from '../services/weeklyDivreiTorah.mjs';
import { getJewishDateKey } from '../services/mitzvotJournal.mjs';

// A source that is a verse ("בראשית א׳, כ״ז") can be opened in the reader; commentaries are cited only.
const VERSE_REF = /^(?:בראשית|שמות|ויקרא|במדבר|דברים|יהושע|שופטים|שמואל [אב]׳?|מלכים [אב]׳?|ישעיה|ירמיה|יחזקאל|הושע|יואל|עמוס|עובדיה|יונה|מיכה|נחום|חבקוק|צפניה|חגי|זכריה|מלאכי|תהלים|תהילים|משלי|איוב|שיר השירים|רות|איכה|קהלת|אסתר|דניאל|עזרא|נחמיה|דברי הימים [אב]׳?) [א-ת׳״]+, [א-ת׳״]+/;

export default function ShabbatTable({ context, openSource, items = [], now = new Date(), settings }) {
  const [revealed, setRevealed] = useState(false);
  const tz = settings?.location?.tzid || 'Asia/Jerusalem';
  const parashaName = context?.parasha?.hebrew || context?.parasha?.title
    || context?.upcomingShabbat?.hebrew || context?.upcomingShabbat?.title || null;
  const week = weeklyDivreiTorah({ items, todayKey: getJewishDateKey(now, tz), parashaName });
  const content = shabbatTableContent(parashaName);
  // The underlying weekly parasha still exists even when this Shabbat's actual public
  // reading is a holiday override — say so honestly instead of showing unrelated content.
  const holidayReading = context?.shabbatReading?.category === 'holiday' ? context.shabbatReading : null;
  const showParashaExtras = content && week?.kind !== 'holiday';

  return <section className="preparation shabbat-table">
    <BackLink href="#preparation" label="חזרה להכנה" />
    <p className="eyebrow">שולחן שבת</p>
    <h1>{week?.name || parashaName || 'שולחן שבת'}</h1>
    {holidayReading && week?.kind !== 'holiday' && <p className="notice">{`בשבת זו קוראים את קריאת החג${holidayReading.hebrew ? ` — ${holidayReading.hebrew}` : ''}; פרשת ${parashaName} תיקרא בשבת הבאה בסדר הרגיל.`}</p>}
    {!week && !content && <p className="intro">אין כרגע תוכן מאומת לפרשה זו. מוצג רק מה שזמין ומבוסס מקור.</p>}
    {week && <section className="table-divrei-torah" aria-label="דברי תורה">
      <h2>שלושה דברי תורה</h2>
      {week.items.map((dvar, index) => <article className="table-divrei-item" key={dvar.title}>
        <h3><span className="table-divrei-number" aria-hidden="true">{['א', 'ב', 'ג'][index]}</span>{dvar.title}</h3>
        <p>{dvar.text}</p>
        <cite>{VERSE_REF.test(dvar.source) && openSource
          ? <button type="button" className="link" onClick={() => openSource(dvar.source.match(VERSE_REF)[0], week.name)}>{dvar.source}</button>
          : dvar.source}</cite>
      </article>)}
    </section>}
    {showParashaExtras && <>
      <section className="table-block"><h2>לשולחן המשפחה</h2>
        <p>{content.familyQuestion}</p>
        <p><strong>לילדים:</strong> {content.childQuestion}</p>
      </section>
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
