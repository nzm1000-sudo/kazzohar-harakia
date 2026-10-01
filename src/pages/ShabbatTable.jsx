import { useState } from 'react';
import { BackLink } from '../components/LocalNavigation.jsx';
import { shabbatTableContent } from '../services/shabbatTable.mjs';
import { weeklyDivreiTorah } from '../services/weeklyDivreiTorah.mjs';
import { getJewishDateKey } from '../services/mitzvotJournal.mjs';
import { useWeeklyTorah } from '../components/torah/useTorah.js';
import { BNEI_ZION, articleKindLine, torahRoute } from '../services/torahContent.mjs';
import { announce } from '../components/a11yPrimitives.jsx';

// A source that is a verse ("בראשית א׳, כ״ז") can be opened in the reader; commentaries are cited only.
const VERSE_REF = /^(?:בראשית|שמות|ויקרא|במדבר|דברים|יהושע|שופטים|שמואל [אב]׳?|מלכים [אב]׳?|ישעיה|ירמיה|יחזקאל|הושע|יואל|עמוס|עובדיה|יונה|מיכה|נחום|חבקוק|צפניה|חגי|זכריה|מלאכי|תהלים|תהילים|משלי|איוב|שיר השירים|רות|איכה|קהלת|אסתר|דניאל|עזרא|נחמיה|דברי הימים [אב]׳?) [א-ת׳״]+, [א-ת׳״]+/;

export default function ShabbatTable({ context, openSource, items = [], now = new Date(), settings }) {
  const [revealed, setRevealed] = useState(false);
  const tz = settings?.location?.tzid || 'Asia/Jerusalem';
  const parashaName = context?.parasha?.hebrew || context?.parasha?.title
    || context?.upcomingShabbat?.hebrew || context?.upcomingShabbat?.title || null;
  const todayKey = getJewishDateKey(now, tz);
  // The week's three from the Torah content engine (stable all week, one can be replaced); the old data only if it has none.
  const torah = useWeeklyTorah({ items, todayKey, parashaName, bodies: true });
  const legacy = torah.week?.picks?.length ? null : weeklyDivreiTorah({ items, todayKey, parashaName });
  const week = torah.week?.picks?.length
    ? { kind: torah.focus.kind, name: torah.focus.name, route: torah.focus.route, more: torah.week.more, canReplace: torah.week.canReplace,
      items: torah.week.picks.map(pick => ({ ...pick, archive: pick.collection === 'bnei-zion', text: torah.textOf(pick), source: pick.body?.source?.ref || null })) }
    : legacy ? { kind: legacy.kind, name: legacy.name, route: null, more: 0, canReplace: false, items: legacy.items.map(item => ({ ...item, id: item.title, text: { status: 'ready', paragraphs: [item.text] } })) } : null;
  const archiveShown = week?.items.some(item => item.archive);
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
      {week.items.map((dvar, index) => <article className="table-divrei-item" key={dvar.id}>
        <h3><span className="table-divrei-number" aria-hidden="true">{['א', 'ב', 'ג'][index]}</span>{dvar.title}</h3>
        {dvar.readMinutes && <small className="tc-table-meta">{articleKindLine(dvar)}</small>}
        {dvar.text.status === 'ready' ? dvar.text.paragraphs.map((text, n) => <p className="tc-table-text" key={n}>{text}</p>)
          : dvar.text.status === 'error' ? <p className="notice">{dvar.text.message}</p> : <p className="loading" role="status">טוען…</p>}
        <cite>{dvar.archive ? `מתוך ״${BNEI_ZION.collection}״ · ${BNEI_ZION.author}`
          : VERSE_REF.test(dvar.source || '') && openSource
            ? <button type="button" className="link" onClick={() => openSource(dvar.source.match(VERSE_REF)[0], week.name)}>{dvar.source}</button>
            : dvar.source}</cite>
        {(week.canReplace || dvar.archive) && <div className="tc-table-actions">
          {dvar.archive && <a className="tc-action" href={`#${torahRoute.article(dvar.id)}`}>לקריאה בקורא</a>}
          {week.canReplace && <button type="button" className="tc-action" onClick={() => { torah.replace(index); announce('דבר התורה הוחלף'); }} aria-label={`החלפת דבר התורה: ${dvar.title}`}>החלף דבר תורה</button>}
        </div>}
      </article>)}
      {archiveShown && <footer className="tc-table-credit" aria-label="מקור">
        <p className="tc-credit-from">מתוך ״{BNEI_ZION.collection}״</p>
        <p className="tc-credit-author">{BNEI_ZION.author}</p>
        <p className="tc-credit-note">{BNEI_ZION.permission}</p>
      </footer>}
      {week.more > 0 && week.route && <p className="tc-table-more"><a href={`#${week.route}`}>{`עוד ${week.more} דברי תורה ל${week.kind === 'parasha' ? 'פרשה' : week.name}`}</a></p>}
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
