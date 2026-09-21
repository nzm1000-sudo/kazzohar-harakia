import { getNextRelevantZman, timeLabel } from '../services.mjs';
import { formatGregorianDate } from '../civilDate.mjs';
import MemorialTribute from '../components/MemorialTribute.jsx';
import LocationControl from '../components/LocationControl.jsx';
import { tehillimResumeTitle } from '../services/tehillimPresentation.mjs';
import { learningResumeKind, learningResumeSubtitle } from '../services/learningPresentation.mjs';

export default function TodayPage({ now, tz, hebrew, events, solar, locationName, afterSunset, onNav, context, resume, onResume, settings, setSettings, dailyItems, dailyProgress, onCompleteDaily, preparation, travel }) {
  const display = todayDisplayPayload({ now, tz, hebrew, events, context });
  const times = solar?.data || null;
  const upcoming = times ? getNextRelevantZman(now, times, { showRT: settings?.showRT }) : null;
  const minutes = upcoming ? Math.max(0, Math.round((upcoming.at - now) / 60000)) : null;
  const { weekday, gregorian, highlights, parashaName, upcomingName } = display;
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
      {resume?.length > 0 && <section className="learning-resume" aria-label="להמשיך מאיפה שהפסקת">
        <p className="eyebrow">להמשיך מאיפה שהפסקת</p>
        {resume.map(item => <button key={item.id} className="learning-resume-item" type="button" onClick={() => onResume(item)}>
          <span>{learningResumeKind(item)}</span>
          <strong>{item.source === 'tehillim' ? tehillimResumeTitle(item) : item.title}</strong>
          <small>{learningResumeSubtitle(item)}</small>
        </button>)}
      </section>}
      {dailyItems?.length > 0 && <section className="daily-learning" aria-label="מה נשאר לי היום">
        <div className="daily-learning-heading"><p className="eyebrow">קביעות יומית</p><h2>מה נשאר לי היום</h2></div>
        <div className="daily-learning-list">
          {dailyItems.map(item => {
            const complete = Boolean(dailyProgress?.[item.id]);
            return <div className={`daily-learning-item${complete ? ' complete' : ''}`} key={item.id}>
              <button type="button" className="daily-learning-open" onClick={item.onOpen}>
                <span>{item.kind}</span><strong>{item.title}</strong><small>{complete ? 'הושלם' : item.subtitle}</small>
              </button>
              <button type="button" className="daily-learning-complete" aria-pressed={complete} onClick={() => onCompleteDaily(item.id, !complete)}>{complete ? '✓ הושלם' : 'סימון כהושלם'}</button>
            </div>;
          })}
        </div>
      </section>}
      <MemorialTribute />
      {preparation?.active && <button type="button" className="today-prep-card" onClick={() => onNav('preparation')}>
        <span className="eyebrow">הכנה ל{preparation.name}</span>
        <strong>{preparation.remaining > 0 ? `${preparation.remaining} משימות נשארו` : 'הכול מוכן'}</strong>
        {preparation.candles && <small>הדלקת נרות {timeLabel(preparation.candles, tz)}</small>}
      </button>}
      {travel?.active && <button type="button" className="today-prep-card" onClick={() => onNav('travel')}>
        <span className="eyebrow">מצב נסיעה</span>
        <strong>{travel.name || 'נסיעה פעילה'}</strong>
        {travel.tzid && <small>אזור זמן {travel.tzid}</small>}
      </button>}
      {context?.prayerContext && <PrayerContextPanel context={context} onNav={onNav} />}      <div className="today-grid">
        <section className="today-primary">
          <LocationControl settings={settings} setSettings={setSettings} compact />
          <section className="next-zman" data-testid="next-zman" aria-label="הזמן הבא">
            <span className="eyebrow" style={{ margin: 0 }}>הזמן הבא</span>
            {upcoming ? <><strong>{upcoming.name}</strong><time>{timeLabel(upcoming.at, tz)}</time><span className="when">בעוד {minutes} דקות</span></> : <span className="when">{solar?.loading ? 'מחשב זמנים…' : 'אין זמנים נוספים היום'}</span>}
          </section>
          {nextMoments.length > 0 && <section className="today-timeline" aria-label="הזמנים הקרובים"><p className="eyebrow">בהמשך היום</p>{nextMoments.map(item => <div className="timeline-line" key={item.key + item.at}><span>{item.name}</span><time>{timeLabel(item.at, tz)}</time></div>)}</section>}
          <div className="today-links">
            <section className="card-line"><span className="eyebrow">תהילים</span><button className="link" onClick={() => onNav('tehillim', { daily: true })}>לתהילים להיום</button></section>
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

export function todayDisplayPayload({ now, tz, hebrew, events, context }) {
  const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: tz }).format(now);
  const gregorian = formatGregorianDate(now, tz);
  const highlights = (events || [])
    .filter(e => e.category === 'holiday' || ['chag', 'fast', 'rc', 'spec'].includes(e.t))
    .map(e => e.hebrew || e.n);
  const parashaName = context?.parasha?.hebrew || context?.parasha?.title;
  const upcomingName = context?.upcomingHoliday?.hebrew || context?.upcomingHoliday?.title;
  return {
    weekday,
    gregorian,
    highlights,
    parashaName,
    upcomingName,
    title: hebrew || 'התאריך העברי אינו זמין',
    subtitle: `${weekday} · ${gregorian}`,
    chips: highlights,
    visiblePrayerAdditions: context?.additions || [],
    visibleOmissions: context?.prayerContext?.omissions || [],
    parashaLabel: context?.parasha?.hebrew || context?.parasha?.title || null,
    holidayLabel: highlights[0] || context?.specialDay?.hebrew || context?.specialDay?.title || null,
  };
}

function PrayerContextPanel({ context, onNav }) {
  const items = [...(context.prayerContext.additions || []), ...(context.prayerContext.omissions || [])];
  if (!items.length && !context.isRoshChodesh && !context.specialDay) return null;
  return <section className="prayer-context-panel" aria-label="היום בתפילה">
    <div><p className="eyebrow">היום בתפילה</p><strong>{context.specialDay?.hebrew || context.specialDay?.n || (context.isRoshChodesh ? 'ראש חודש' : 'הקשר התפילה של היום')}</strong></div>
    <div className="prayer-context-items">{items.slice(0, 4).map(item => <button type="button" className="prayer-context-item" key={`${item.kind}:${item.text}`} onClick={() => onNav('siddur')}><span>{item.text}</span><small>מותאם להיום · תצוגה מקדימה</small></button>)}</div>
  </section>;
}
