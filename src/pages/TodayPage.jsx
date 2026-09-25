import { getNextRelevantZman, timeLabel } from '../services.mjs';
import { formatGregorianDate } from '../civilDate.mjs';
import MemorialTribute from '../components/MemorialTribute.jsx';
import LocationControl from '../components/LocationControl.jsx';
import LtrDate from '../components/LtrDate.jsx';
import { tehillimResumeTitle } from '../services/tehillimPresentation.mjs';
import { learningResumeCompactTitle, learningResumeKind, learningResumeSubtitle } from '../services/learningPresentation.mjs';
import { choosePrayerType, PRAYER_TYPE_LABELS } from '../services/smartPrayer.mjs';
import { hebrewEventLabel } from '../services/hebrewCalendarLabels.mjs';

export default function TodayPage({ now, tz, hebrew, events, solar, locationName, afterSunset, onNav, context, resume, onResume, onOpenPrayer, settings, setSettings, dailyItems, dailyProgress, onCompleteDaily, preparation, travel }) {
  const display = todayDisplayPayload({ now, tz, hebrew, events, context });
  const times = solar?.data || null;
  const upcoming = times ? getNextRelevantZman(now, times, { showRT: settings?.showRT }) : null;
  const minutes = upcoming ? Math.max(0, Math.round((upcoming.at - now) / 60000)) : null;
  const { weekday, gregorian, highlights, parashaName, upcomingName } = display;
  const nextMoments = (context?.timeline || []).filter(item => new Date(item.at) >= now).slice(0, 3);
  const learningCards = (resume || []).slice(0, 2);
  const prayerType = choosePrayerType(now, times);
  return (
    <div className="today">
      <section className="today-hero">
        <p className="eyebrow">{weekday} · <LtrDate value={now} timeZone={tz} /></p>
        <h1 className="hebrew-date" data-testid="today-hebrew">
          {solar?.loading ? 'טוען תאריך…' : (hebrew || 'התאריך העברי אינו זמין')}
        </h1>
        {highlights.map(name => <p className="holiday-line" key={name}>{name}</p>)}
        {afterSunset && <p className="eyebrow" style={{ marginTop: 8 }}>לאחר השקיעה · בין השמשות הוא זמן ספק; התצוגה אינה היתר מלאכה.</p>}
        {solar?.error && <p className="notice error" role="alert">{solar.error}</p>}
      </section>

      {/* LEARNING RESUME + SMART PRAYER - combined section with heading */}
      {(learningCards.length > 0 || onOpenPrayer) && (
        <section className="learning-resume" aria-label="להמשיך מהיכן שהפסקת">
          <p className="eyebrow">להמשיך מהיכן שהפסקת</p>
          <div className="learning-resume-grid">
            {learningCards.map(item => {
              const compact = learningResumeCompactTitle(item);
              return (
                <button key={item.id} className="learning-resume-item" type="button" onClick={() => onResume(item)}>
                  <span>{learningResumeKind(item)}</span>
                  {compact ? (
                    <span className="learning-resume-compact">
                      <strong>{compact.book}</strong>
                      <small>{compact.chapterLabel}</small>
                    </span>
                  ) : (
                    <>
                      <strong>{item.source === 'tehillim' ? tehillimResumeTitle(item) : item.title}</strong>
                      <small>{learningResumeSubtitle(item)}</small>
                    </>
                  )}
                </button>
              );
            })}
            {onOpenPrayer && (
              <div className="smart-prayer-wrap">
                <button className="learning-resume-item smart-prayer-card" type="button" onClick={() => onOpenPrayer(prayerType)}>
                  <span>תפילה חכמה</span>
                  <strong>{PRAYER_TYPE_LABELS[prayerType]}</strong>
                  <small>נפתח בסידור לפי השעה</small>
                </button>
                <button type="button" className="smart-prayer-compass" aria-label="כיוון תפילה" onClick={() => onNav('siddur-compass')}><span aria-hidden="true">⌖</span></button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* PRIMARY: הזמן היהודי הבא */}
      <section className="primary-section" data-testid="next-zman" aria-label="הזמן היהודי הבא">
        <span className="eyebrow">הזמן היהודי הבא</span>
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

      {/* SECONDARY: מה נשאר לי היום */}
      {dailyItems?.length > 0 && (
        <section className="secondary-section" aria-label="מה נשאר לי היום">
          <span className="eyebrow">מה נשאר לי היום</span>
          <div className="secondary-list">
            {dailyItems.map(item => {
              const complete = Boolean(dailyProgress?.[item.id]);
              return (
                <div className={`secondary-item daily-item${complete ? ' complete' : ''}`} key={item.id}>
                  <button type="button" className="secondary-open" onClick={item.onOpen}>
                    <span>{item.kind}</span>
                    <strong>{item.title}</strong>
                    <small>{complete ? 'הושלם' : item.subtitle}</small>
                  </button>
                  <button
                    type="button"
                    className="secondary-complete"
                    aria-pressed={complete}
                    onClick={() => onCompleteDaily(item.id, !complete)}
                  >
                    {complete ? '✓ הושלם' : 'סימון כהושלם'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECONDARY: preparation/travel when active */}
      {(preparation?.active || travel?.active) && (
        <section className="secondary-section" aria-label="הכנות ונסיעות">
          {preparation?.active && (
            <button type="button" className="secondary-item prep-card" onClick={() => onNav('preparation')}>
              <span className="eyebrow">הכנה ל{preparation.name}</span>
              <strong>{preparation.remaining > 0 ? `${preparation.remaining} משימות נשארו` : 'הכול מוכן'}</strong>
              {preparation.candles && <small>הדלקת נרות {timeLabel(preparation.candles, tz)}</small>}
            </button>
          )}
          {travel?.active && (
            <button type="button" className="secondary-item travel-card" onClick={() => onNav('travel')}>
              <span className="eyebrow">מצב נסיעה</span>
              <strong>{travel.name || 'נסיעה פעילה'}</strong>
              {travel.tzid && <small>אזור זמן {travel.tzid}</small>}
            </button>
          )}
        </section>
      )}

      {/* CONTEXTUAL: פרשת השבוע, תוספות/השמטות, צום/חג */}
      {(parashaName || context?.additions?.length || context?.fast || upcomingName) && (
        <aside className="contextual-panel" aria-label="פרשת השבוע והקשר היום">
          {parashaName && (
            <button className="context-link" onClick={() => onNav('parasha')}>
              <span>פרשת השבוע</span>
              <strong>{parashaName}</strong>
            </button>
          )}
          {context?.additions?.map(a => (
            <button key={a.text} className="context-link" onClick={() => onNav('siddur')}>
              <span>תוספת בתפילה</span>
              <strong>{a.text}</strong>
            </button>
          ))}
          {context?.fast && (
            <button className="context-link" onClick={() => onNav('calendar')}>
              <span>צום</span>
              <strong>{context.fast.hebrew || hebrewEventLabel(context.fast.title)}</strong>
            </button>
          )}
          {upcomingName && (
            <button className="context-link" onClick={() => onNav('calendar')}>
              <span>חג קרוב</span>
              <strong>{upcomingName}</strong>
            </button>
          )}
        </aside>
      )}

      {/* Secondary extras: Location, timeline, links */}
      {nextMoments.length > 0 && (
        <section className="tertiary-section" aria-label="הזמנים הקרובים">
          <span className="eyebrow">בהמשך היום</span>
          {nextMoments.map(item => (
            <div className="timeline-line" key={item.key + item.at}>
              <span>{item.name}</span>
              <time>{timeLabel(item.at, tz)}</time>
            </div>
          ))}
        </section>
      )}

      {context?.prayerContext && <PrayerContextPanel context={context} onNav={onNav} />}

      <LocationControl settings={settings} setSettings={setSettings} compact />

      <div className="tertiary-links">
        <button className="link-item" onClick={() => onNav('tehillim', { daily: true })}>לתהילים של היום</button>
        <button className="link-item" onClick={() => onNav('calendar')}>{locationName}</button>
      </div>

      <MemorialTribute />
    </div>
  );
}

export function todayDisplayPayload({ now, tz, hebrew, events, context }) {
  const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: tz }).format(now);
  const gregorian = formatGregorianDate(now, tz);
  const highlights = (events || [])
    .filter(e => e.category === 'holiday' || ['chag', 'fast', 'rc', 'spec'].includes(e.t))
    .map(e => e.hebrew || e.n);
  const parashaName = context?.parasha?.hebrew || hebrewEventLabel(context?.parasha?.title || '') || undefined;
  const upcomingName = context?.upcomingHoliday?.hebrew || hebrewEventLabel(context?.upcomingHoliday?.title || '') || undefined;
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
    parashaLabel: context?.parasha?.hebrew || hebrewEventLabel(context?.parasha?.title || '') || null,
    holidayLabel: highlights[0] || context?.specialDay?.hebrew || hebrewEventLabel(context?.specialDay?.title || '') || null,
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
