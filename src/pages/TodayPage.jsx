import { timeLabel } from '../services.mjs';
import MemorialTribute from '../components/MemorialTribute.jsx';

const ORDER = [
  ['alotHaShachar','עלות השחר'],['misheyakir','משיכיר'],['sunrise','הנץ החמה'],
  ['sofZmanShma','סוף זמן קריאת שמע'],['sofZmanTfilla','סוף זמן תפילה'],
  ['chatzot','חצות היום'],['minchaGedola','מנחה גדולה'],['minchaKetana','מנחה קטנה'],
  ['plagHaMincha','פלג המנחה'],['sunset','שקיעה'],['tzeit85deg','צאת הכוכבים'],
];

export default function TodayPage({ now, tz, hebrew, events, solar, locationName, afterSunset, onNav, context }) {
  const times = solar?.data || null;
  const upcoming = times
    ? ORDER.map(([key, name]) => ({ key, name, at: times[key] ? new Date(times[key]) : null }))
        .find(e => e.at && e.at > now)
    : null;
  const minutes = upcoming ? Math.max(0, Math.round((upcoming.at - now) / 60000)) : null;
  const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: tz }).format(now);
  const gregorian = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(now);
  // Accepts both legacy {n} day events and future Hebcal items with {category, hebrew}.
  const highlights = (events || [])
    .filter(e => e.category === 'holiday' || ['chag','fast','rc','spec'].includes(e.t))
    .map(e => e.hebrew || e.n);
  const parashaName = context?.parasha?.hebrew || context?.parasha?.title;
  const upcomingName = context?.upcomingHoliday?.hebrew || context?.upcomingHoliday?.title;
  const nextMoments = (context?.timeline || []).filter(item => new Date(item.at) >= now).slice(0, 3);
  return (
    <div className="today">
      <section className="today-hero">
        <p className="eyebrow">{weekday} · {gregorian}</p>
        <h1 className="hebrew-date" data-testid="today-hebrew">
          {solar?.loading ? 'טוען תאריך…' : (hebrew || 'התאריך העברי אינו זמין')}
        </h1>
        {highlights.map(name => <p className="holiday-line" key={name}>{name}</p>)}
        {afterSunset && <p className="eyebrow" style={{ marginTop: 8 }}>לאחר השקיעה · בין השמשות הוא זמן ספק; התצוגה אינה היתר מלאכה.</p>}
        {solar?.error && <p className="notice error" role="alert">{solar.error}</p>}
      </section>
      <MemorialTribute />
      <div className="today-grid">
        <section className="today-primary">
          <section className="next-zman" data-testid="next-zman" aria-label="הזמן הבא">
            <span className="eyebrow" style={{ margin: 0 }}>הזמן הבא</span>
            {upcoming ? <><strong>{upcoming.name}</strong><time>{timeLabel(upcoming.at, tz)}</time><span className="when">בעוד {minutes} דקות</span></> : <span className="when">{solar?.loading ? 'מחשב זמנים…' : 'אין זמנים נוספים היום'}</span>}
          </section>
          {nextMoments.length > 0 && <section className="today-timeline" aria-label="הזמנים הקרובים"><p className="eyebrow">בהמשך היום</p>{nextMoments.map(item => <div className="timeline-line" key={item.key + item.at}><span>{item.name}</span><time>{timeLabel(item.at, tz)}</time></div>)}</section>}
          <div className="today-links">
            <section className="card-line"><span className="eyebrow">תהילים</span><button className="link" onClick={() => onNav('tehillim')}>לתהילים להיום</button></section>
            <section className="card-line"><span className="eyebrow">המקום</span><button className="link" onClick={() => onNav('calendar')}>{locationName}</button></section>
          </div>
        </section>
        <aside className="today-context" aria-label="מה חשוב היום">
          <p className="eyebrow">מה חשוב היום</p>
          {parashaName && <button className="today-feature" onClick={() => onNav('parasha')}><span>פרשת השבוע</span><strong>{parashaName}</strong></button>}
          {context?.additions?.map(a => <button className="today-feature" key={a.text} onClick={() => onNav('siddur')}><span>תוספת בתפילה</span><strong>{a.text}</strong></button>)}
          {context?.fast && <button className="today-feature" onClick={() => onNav('calendar')}><span>היום</span><strong>{context.fast.hebrew || context.fast.title}</strong></button>}
          {upcomingName && <button className="today-feature" onClick={() => onNav('calendar')}><span>בקרוב בלוח</span><strong>{upcomingName}</strong></button>}
          {!parashaName && !context?.additions?.length && !context?.fast && !upcomingName && <p className="today-quiet">יום חול רגיל. אפשר להתחיל מתהילים או לעיין בלוח.</p>}
        </aside>
      </div>
    </div>
  );
}
