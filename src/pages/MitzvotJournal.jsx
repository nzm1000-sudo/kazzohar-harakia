import { useState, useEffect, useMemo } from 'react';
import { useLocal } from '../hooks.jsx';
import { BackNavigation } from '../components/LocalNavigation.jsx';
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
  const todayKey = civilDateKey(now, tzid);
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
  const todayKey = civilDateKey(now, tzid);
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

    lines.push(`היום השלמת ${aggregation.totalActions} פעולות`);

    const categoryOrder = [
      ACTIVITY_CATEGORY.PRAYER,
      ACTIVITY_CATEGORY.TEHILLIM,
      ACTIVITY_CATEGORY.TORAH_STUDY,
      ACTIVITY_CATEGORY.BIRKAT_HAMAZON,
      ACTIVITY_CATEGORY.OMER_COUNT,
      ACTIVITY_CATEGORY.SHNAYIM_MIKRA,
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
        lines.push(`${catData.totalQuantity} דקות לימוד`);
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
      return (
        <div key={event.id} className="mitzvot-event-row undo-active" role="alert">
          <div className="mitzvot-event-main">
            <time>{display.time}</time>
            <span className="mitzvot-event-type">{display.type}</span>
            <span className="mitzvot-event-detail">{display.detail}</span>
          </div>
          <div className="mitzvot-undo-actions">
            <button
              type="button"
              className="mitzvot-undo-confirm"
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
      <BackNavigation label="חזרה" onClick={() => onNav('today')} />

      <header className="mitzvot-header">
        <h1>המצוות שלי</h1>
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