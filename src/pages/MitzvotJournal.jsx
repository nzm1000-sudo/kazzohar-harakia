import { useState, useEffect, useMemo } from 'react';
import { useLocal } from '../hooks.jsx';
import SpiritualRing from '../components/SpiritualRing.jsx';
import { computeCircle, mergeAchievements, readAchievements, saveAchievements, WEEK_GOAL } from '../services/spiritualCircle.mjs';
import { BackNavigation } from '../components/LocalNavigation.jsx';
import { VisuallyHidden } from '../components/a11yPrimitives.jsx';
import {
  getEvents,
  getJewishDateKey,
  aggregateForRange,
  aggregateByJewishDate,
  formatEventForDisplay,
  removeEvent,
  CATEGORY_LABELS,
  ACTIVITY_CATEGORY,
  ACTIVITY_TYPE,
  recordPrayerCompletion,
  recordTehillimCompletion,
  _clearAllEvents,
} from '../services/mitzvotJournal.mjs';
import { civilDateKey, shiftCivilDate } from '../civilDate.mjs';
import { hebrewDate } from '../dayContext.mjs';

const RANGE_OPTIONS = [
  { id: 'today', label: 'היום' },
  { id: 'week', label: 'השבוע' },
  { id: 'month', label: 'החודש' },
  { id: 'year', label: 'השנה' },
];

function getRangeBounds(rangeId, now, tzid) {
  const todayKey = getJewishDateKey(now, tzid); // the Jewish day (after sunset: tomorrow), as every record is keyed
  const today = new Date(todayKey + 'T12:00:00Z');

  switch (rangeId) {
    case 'today':
      return { fromDate: todayKey, toDate: todayKey };
    case 'week': {
      const weekAgo = shiftCivilDate(todayKey, -6);
      return { fromDate: weekAgo, toDate: todayKey };
    }
    case 'month': {
      const monthAgo = shiftCivilDate(todayKey, -29);
      return { fromDate: monthAgo, toDate: todayKey };
    }
    case 'year': {
      const yearAgo = shiftCivilDate(todayKey, -364);
      return { fromDate: yearAgo, toDate: todayKey };
    }
    default:
      return { fromDate: todayKey, toDate: todayKey };
  }
}

function formatHebrewDateRange(fromKey, toKey) {
  const from = hebrewDate(fromKey);
  const to = hebrewDate(toKey);
  if (from?.label && to?.label) {
    if (from.label === to.label) return from.label;
    return `${from.label} — ${to.label}`;
  }
  return null;
}

export default function MitzvotJournal({ now, tzid, onNav, settings }) {
const [range, setRange] = useLocal('mitzvot-journal-range-v1', 'today');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [undoTooltip, setUndoTooltip] = useState(null); // { eventId, timeoutId }

  // Load events on mount and when range changes
  useEffect(() => {
    setLoading(true);
    const allEvents = getEvents({}, globalThis.localStorage);
    setEvents(allEvents);
    setLoading(false);
  }, [range]);

  // Clear undo tooltip on unmount
  useEffect(() => {
    return () => {
      if (undoTooltip?.timeoutId) clearTimeout(undoTooltip.timeoutId);
    };
  }, [undoTooltip]);

  const { fromDate, toDate } = getRangeBounds(range, now, tzid);
  const hebrewRangeLabel = formatHebrewDateRange(fromDate, toDate);

  // Aggregate for current range
  const aggregation = useMemo(() => aggregateForRange(events, { fromDate, toDate }), [events, fromDate, toDate]);

  // Today's events for the history list
  const todayKey = getJewishDateKey(now, tzid); // the Jewish day (after sunset: tomorrow), as every record is keyed
  // The week's circle and what was built over time (kept, never lowered).
  const circle = useMemo(() => computeCircle(events, todayKey), [events, todayKey]);
  const lasting = useMemo(() => { const record = mergeAchievements(readAchievements(), circle, todayKey); saveAchievements(record); return record; }, [circle, todayKey]);
  const todayEvents = useMemo(() => getEvents({ jewishDate: todayKey }, globalThis.localStorage), [events, todayKey]);

  // Group events by date for history display
  const eventsByDate = useMemo(() => aggregateByJewishDate(events), [events]);

  // Sort dates descending
  const sortedDates = useMemo(() =>
    Object.keys(eventsByDate).sort((a, b) => (a < b ? 1 : -1)),
    [eventsByDate]
  );
// Summary lines for top section
  const summaryLines = useMemo(() => {
    const lines = [];
    if (aggregation.totalActions === 0) return ['אין פעולות רשומות בטווח זה'];

    const when = { today: 'היום', week: 'השבוע', month: 'החודש', year: 'השנה' }[range] || 'היום';
    lines.push(`${when} השלמת ${aggregation.totalActions} ${aggregation.totalActions === 1 ? 'פעולה' : 'פעולות'}`);

    const categoryOrder = [
      ACTIVITY_CATEGORY.PRAYER,
      ACTIVITY_CATEGORY.TEHILLIM,
      ACTIVITY_CATEGORY.TORAH_STUDY,
      ACTIVITY_CATEGORY.BIRKAT_HAMAZON,
      ACTIVITY_CATEGORY.BRACHOT,
      ACTIVITY_CATEGORY.OMER_COUNT,
      ACTIVITY_CATEGORY.SHNAYIM_MIKRA,
      ACTIVITY_CATEGORY.OTHER,
    ];

    for (const cat of categoryOrder) {
      const catData = aggregation.byCategory[cat];
      if (!catData) continue;

      const label = CATEGORY_LABELS[cat] || cat;
      if (cat === ACTIVITY_CATEGORY.PRAYER) {
        lines.push(`${catData.count} ${label}`);
      } else if (cat === ACTIVITY_CATEGORY.TEHILLIM) {
        lines.push(`${catData.totalQuantity} ${catData.totalQuantity === 1 ? 'פרק' : 'פרקי'} תהילים`);
      } else if (cat === ACTIVITY_CATEGORY.TORAH_STUDY) {
        // Minutes (the study timer) and units marked "סיימתי" are two different measures, never added together.
        const study = aggregation.events.filter(event => event.category === cat);
        const minutes = study.filter(event => event.unit !== 'count').reduce((sum, event) => sum + (Number(event.quantity) || 0), 0);
        const units = study.filter(event => event.unit === 'count').length;
        lines.push([minutes ? `${minutes} דקות לימוד` : null, units ? `${units} ${units === 1 ? 'סיום לימוד' : 'סיומי לימוד'}` : null].filter(Boolean).join(' · '));
      } else {
        lines.push(`${catData.count} ${label}`);
      }
    }
    return lines;
  }, [aggregation]);

  const handleUndo = (eventId, event) => {
    if (undoTooltip?.timeoutId) clearTimeout(undoTooltip.timeoutId);
    const timeoutId = setTimeout(() => { setUndoTooltip(null); }, 5000);
    setUndoTooltip({ eventId, event, timeoutId });
  };

  const handleConfirmUndo = (eventId) => {
    if (undoTooltip?.timeoutId) clearTimeout(undoTooltip.timeoutId);
    removeEvent(eventId, globalThis.localStorage);
    const allEvents = getEvents({}, globalThis.localStorage);
    setEvents(allEvents);
    setUndoTooltip(null);
  };

  const handleCancelUndo = () => {
    if (undoTooltip?.timeoutId) clearTimeout(undoTooltip.timeoutId);
    setUndoTooltip(null);
  };
const renderEventRow = (event) => {
    const display = formatEventForDisplay(event);
    const isUndo = undoTooltip?.eventId === event.id;

    if (isUndo) {
      // The ✕ that opened this row is gone; focus lands on the confirming choice that replaced it.
      return (
        <div key={event.id} className="mitzvot-event-row undo-active" role="group" aria-label={`ביטול הסימון: ${display.type}`}>
          <div className="mitzvot-event-main">
            <time>{display.time}</time>
            <span className="mitzvot-event-type">{display.type}</span>
            <span className="mitzvot-event-detail">{display.detail}</span>
          </div>
          <div className="mitzvot-undo-actions">
            <button
              type="button"
              className="mitzvot-undo-confirm"
              autoFocus
              onClick={() => handleConfirmUndo(event.id)}
              aria-label="אשר ביטול סימון"
            >
              בטל סימון
            </button>
            <button
              type="button"
              className="mitzvot-undo-cancel"
              onClick={handleCancelUndo}
              aria-label="בטל פעולה"
            >
              לא
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={event.id}
        className="mitzvot-event-row"
      >
        <div className="mitzvot-event-main">
          <time>{display.time}</time>
          <span className="mitzvot-event-type">{display.type}</span>
          <span className="mitzvot-event-detail">{display.detail}</span>
        </div>
        <button
          type="button"
          className="mitzvot-event-remove"
          onClick={() => handleUndo(event.id, event)}
          aria-label={`הסר ${display.type} מהרישום`}
          title="הסר מהרישום"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="mitzvot-journal" style={{ padding: 14, direction: 'rtl' }}>
        <p className="notice">טוען רישום פעולות…</p>
      </div>
    );
  }

  return (
    <div className="mitzvot-journal" style={{ padding: 14, direction: 'rtl' }}>
      <BackNavigation label="חזרה" onClick={() => (Number(history.state?.kzDepth) > 0 ? history.back() : onNav('today'))} />

      <header className="mitzvot-header">
        <h1 className="mitzvot-title">המעגל הרוחני</h1>
        <span className="gold-divider" aria-hidden="true"><i /></span>
        <div className="mitzvot-range-selector" role="group" aria-label="בחירת טווח זמן">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`mitzvot-range-btn${range === opt.id ? ' active' : ''}`}
              onClick={() => setRange(opt.id)}
              aria-pressed={range === opt.id}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {/* The week's circle: 72 lights fill it; it starts again every Motzaei Shabbat. What was built stays. */}
      <section className="circle-week" aria-label="מעגל השבוע">
        <div className="circle-week-ring">
          <SpiritualRing size="large" todayProgress={circle.progress} presenceLevel={circle.progress >= 1 ? 'bright' : circle.progress > 0.4 ? 'glowing' : 'dim'} dayOrNight="day" showCenterDot={false} period="השבוע" />
          <div className="circle-week-count"><strong>{circle.week}</strong><span>מתוך {WEEK_GOAL} אורות</span></div>
        </div>
        <p className="circle-week-note">{circle.progress >= 1 ? 'המעגל של השבוע התמלא. כל הכבוד!' : `עוד ${Math.max(0, WEEK_GOAL - circle.week)} אורות למעגל מלא השבוע · המעגל מתחדש במוצאי שבת`}</p>
        <div className="circle-level" role="group" aria-label="המדרגה">
          <span className="circle-level-name">מדרגת {circle.level.name}</span>
          <span className="circle-level-bar" aria-hidden="true"><i style={{ width: `${Math.round(circle.level.progress * 100)}%` }} /></span>
          <small>{circle.level.next ? `עוד ${circle.level.next.remaining} אורות למדרגת ${circle.level.next.name}` : 'המדרגה העליונה'}</small>
        </div>
        <dl className="circle-stats">
          <div><dt>אורות מאז ומעולם</dt><dd>{Math.max(lasting.total, circle.total)}</dd></div>
          <div><dt>שבועות מלאים</dt><dd>{Math.max(lasting.fullWeeks, circle.fullWeeks)}</dd></div>
          <div><dt>רצף שבועות</dt><dd>{circle.streak}</dd></div>
          <div><dt>השבוע הטוב ביותר</dt><dd>{Math.max(lasting.bestWeek, circle.bestWeek)}</dd></div>
        </dl>
        <details className="circle-milestones">
          <summary>ציוני דרך · {Object.keys(lasting.earned || {}).length} מתוך {circle.milestones.length}</summary>
          <ul>{circle.milestones.map(item => { const day = lasting.earned?.[item.id]; return <li key={item.id} className={day ? 'is-earned' : undefined}><span aria-hidden="true">{day ? '✦' : '·'}</span>{day && <VisuallyHidden>הושג: </VisuallyHidden>}{item.title}{day && <small>{hebrewDate(day)?.label || day}</small>}</li>; })}</ul>
          <p className="circle-milestones-note">כל תפילה, ברכת המזון, ברכה, ספירת העומר ושניים מקרא — אור אחד. תהילים — אור לכל שני פרקים, לימוד — אור לכל עשר דקות או לכל ״סיימתי את הלימוד״ (ברכות, תהילים ולימוד — עד תקרה יומית), כדי שהמעגל יתמלא בהתמדה.</p>
        </details>
      </section>

      {/* Top Summary */}
      <section className="mitzvot-summary" aria-label="סיכום פעולות">
        <div className="mitzvot-summary-main">
          {summaryLines.map((line, i) => (
            <p key={i} className={i === 0 ? 'mitzvot-summary-total' : 'mitzvot-summary-line'}>
              {line}
            </p>
          ))}
        </div>
        {hebrewRangeLabel && (
          <p className="mitzvot-hebrew-range">{hebrewRangeLabel}</p>
        )}
      </section>

      {/* Recent Activity History */}
      <section className="mitzvot-history" aria-label="רישום פעולות אחרונות">
        {sortedDates.length === 0 ? (
          <p className="mitzvot-empty">אין פעולות רשומות עדיין</p>
        ) : (
          sortedDates.map(dateKey => {
            const dayData = eventsByDate[dateKey];
            const hebrew = hebrewDate(dateKey);
            return (
              <div key={dateKey} className="mitzvot-day-group">
                <h2 className="mitzvot-day-header">
                  <span>{dateKey === todayKey ? 'היום' : dateKey}</span>
                  {hebrew?.label && <span className="mitzvot-day-hebrew">{hebrew.label}</span>}
                  <span className="mitzvot-day-count">{dayData.totalActions} פעולות</span>
                </h2>
                <div className="mitzvot-day-events">
                  {dayData.events.slice(0, 10).map(renderEventRow)}
                  {dayData.events.length > 10 && (
                    <p className="mitzvot-more-events">ועוד {dayData.events.length - 10} פעולות…</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Debug: Clear all button (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mitzvot-debug">
          <summary>כלי פיתוח</summary>
          <button type="button" onClick={() => { _clearAllEvents(globalThis.localStorage); setEvents([]); }}>
            נקה את כל הרישומים (פיתוח בלבד)
          </button>
        </details>
      )}
    </div>
  );
}