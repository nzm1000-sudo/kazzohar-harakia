import { timeLabel } from '../services.mjs';

const ORDER = [
  ['alotHaShachar','עלות השחר'],['misheyakir','משיכיר'],['sunrise','הנץ החמה'],
  ['sofZmanShma','סוף זמן קריאת שמע'],['sofZmanTfilla','סוף זמן תפילה'],
  ['chatzot','חצות היום'],['minchaGedola','מנחה גדולה'],['minchaKetana','מנחה קטנה'],
  ['plagHaMincha','פלג המנחה'],['sunset','שקיעה'],['tzeit85deg','צאת הכוכבים'],
];

export default function TodayPage({ now, tz, hebrew, events, solar, parasha, locationName, afterSunset, onNav }) {
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
      <section className="next-zman" data-testid="next-zman" aria-label="הזמן הבא">
        <span className="eyebrow" style={{ margin: 0 }}>הזמן הבא</span>
        {upcoming ? (
          <>
            <strong>{upcoming.name}</strong>
            <time>{timeLabel(upcoming.at, tz)}</time>
            <span className="when">בעוד {minutes} דקות</span>
          </>
        ) : (
          <span className="when">{solar?.loading ? 'מחשב זמנים…' : 'אין זמנים נוספים היום'}</span>
        )}
      </section>
      {parasha && (
        <section className="card-line">
          <span className="eyebrow">פרשת השבוע</span>
          <button className="link" onClick={() => onNav('calendar')}>{parasha[0]}</button>
        </section>
      )}
      <section className="card-line">
        <span className="eyebrow">תהילים</span>
        <button className="link" onClick={() => onNav('tehillim')}>לתהילים להיום</button>
      </section>
      <section className="card-line">
        <span className="eyebrow">המקום</span>
        <button className="link" onClick={() => onNav('calendar')}>{locationName}</button>
      </section>
    </div>
  );
}
