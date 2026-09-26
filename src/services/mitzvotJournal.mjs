// Central Jewish Activity Journal — "המצוות שלי"
// Single source of truth for all verified mitzvah-related activities.
// Local-first, no external transmission, conservative factual recording.

import { civilDateKey } from '../civilDate.mjs';

const STORAGE_KEY = 'kz-mitzvot-journal-v1';
const SCHEMA_VERSION = 1;

// Activity categories (conservative, factual labels)
export const ACTIVITY_CATEGORY = {
  PRAYER: 'prayer',
  TEHILLIM: 'tehillim',
  TORAH_STUDY: 'torah_study',
  BIRKAT_HAMAZON: 'birkat_hamazon',
  OMER_COUNT: 'omer_count',
  SHNAYIM_MIKRA: 'shnayim_mikra',
  OTHER: 'other',
};

// Activity types within categories
export const ACTIVITY_TYPE = {
  // Prayer
  SHACHARIT: 'shacharit',
  MINCHA: 'mincha',
  ARVIT: 'arvit',
  MUSAF: 'musaf',
  // Tehillim
  TEHILLIM_CHAPTER: 'tehillim_chapter',
  TEHILLIM_DAILY_PORTION: 'tehillim_daily_portion',
  // Torah Study
  DAF_YOMI: 'daf_yomi',
  MISHNAH_YOMIT: 'mishnah_yomit',
  RAMBAM_YOMI: 'rambam_yomi',
  CUSTOM_LEARNING: 'custom_learning',
  // Other
  BIRKAT_HAMAZON_FULL: 'birkat_hamazon_full',
  OMER_DAY: 'omer_day',
  SHNAYIM_MIKRA_PORTION: 'shnayim_mikra_portion',
  // Prayer additions (not whole prayers)
  HALLEL: 'hallel',
  YAALEH_VEYAVO: 'yaaleh_veyavo',
  AL_HANISSIM: 'al_hanissim',
  VETEN_TAL_UMATAR: 'veten_tal_umatar',
  MASHIV_HARUACH: 'mashiv_haruach',
  VIDUI: 'vidui',
};

const defaultStorage = () => {
  try { return globalThis.localStorage || null; } catch { return null; }
};

function read(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { events: [], schemaVersion: SCHEMA_VERSION };
    const parsed = JSON.parse(raw);
    if (!parsed.schemaVersion) {
      return { events: parsed.events || [], schemaVersion: SCHEMA_VERSION };
    }
    if (parsed.schemaVersion > SCHEMA_VERSION) {
      return { events: parsed.events || [], schemaVersion: parsed.schemaVersion };
    }
    return { events: parsed.events || [], schemaVersion: parsed.schemaVersion };
  } catch {
    return { events: [], schemaVersion: SCHEMA_VERSION };
  }
}

function write(data, storage = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or private mode - silently fail
  }
}

// Generate a deterministic ID for duplicate protection
// Combines: category, type, jewishDate, source, sourceId
function generateEventKey(event) {
  const base = `${event.category}|${event.type}|${event.jewishDate}|${event.source}|${event.sourceId || ''}`;
  // Simple hash for shorter storage
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Get current Jewish date string (YYYY-MM-DD in Hebrew calendar)
export function getJewishDateKey(now = new Date(), tzid = 'Asia/Jerusalem') {
  // Use existing civilDateKey with timezone for day boundary
  // The Jewish day starts at sunset, but for aggregation we use the civil date
  // in the user's timezone as a practical approximation.
  // TODO: Use proper Jewish calendar day boundary when available.
  return civilDateKey(now, tzid);
}

// Create a JewishActivityEvent
export function createEvent({
  category,
  type,
  occurredAt = new Date(),
  jewishDate = null,
  completed = true,
  quantity = 1,
  unit = 'count',
  source = 'manual',
  sourceId = null,
  metadata = {},
  tzid = 'Asia/Jerusalem',
}) {
  const timestamp = occurredAt instanceof Date ? occurredAt.toISOString() : new Date(occurredAt).toISOString();
  const jDate = jewishDate || getJewishDateKey(new Date(timestamp), tzid);

  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    category,
    type,
    occurredAt: timestamp,
    jewishDate: jDate,
    completed: Boolean(completed),
    quantity: Number(quantity) || 1,
    unit,
    source,
    sourceId,
    metadata,
    schemaVersion: SCHEMA_VERSION,
    eventKey: null, // Will be set below
  };

  event.eventKey = generateEventKey(event);
  return event;
}

// Record an event with duplicate protection
export function recordEvent(event, storage = defaultStorage()) {
  const data = read(storage);
  const existingIndex = data.events.findIndex(e => e.eventKey === event.eventKey);

  if (existingIndex >= 0) {
    // Event already exists - do not duplicate
    // Return the existing event to indicate no new record was created
    return { event: data.events[existingIndex], created: false, duplicate: true };
  }

  data.events.push(event);
  write(data, storage);
  return { event, created: true, duplicate: false };
}

// Get all events (optionally filtered)
export function getEvents({ category, type, fromDate, toDate, jewishDate, limit } = {}, storage = defaultStorage()) {
  const data = read(storage);
  let events = [...data.events].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

  if (category) events = events.filter(e => e.category === category);
  if (type) events = events.filter(e => e.type === type);
  if (jewishDate) events = events.filter(e => e.jewishDate === jewishDate);
  if (fromDate) events = events.filter(e => e.jewishDate >= fromDate);
  if (toDate) events = events.filter(e => e.jewishDate <= toDate);
  if (limit && limit > 0) events = events.slice(0, limit);

  return events;
}

// Remove an event (for undo/correction)
export function removeEvent(eventId, storage = defaultStorage()) {
  const data = read(storage);
  const index = data.events.findIndex(e => e.id === eventId);
  if (index < 0) return { removed: false };

  const removed = data.events.splice(index, 1)[0];
  write(data, storage);
  return { removed: true, event: removed };
}

// Remove event by eventKey (for duplicate protection cleanup)
export function removeEventByKey(eventKey, storage = defaultStorage()) {
  const data = read(storage);
  const index = data.events.findIndex(e => e.eventKey === eventKey);
  if (index < 0) return { removed: false };

  const removed = data.events.splice(index, 1)[0];
  write(data, storage);
  return { removed: true, event: removed };
}
// Aggregation functions
export function aggregateByJewishDate(events) {
  const byDate = {};
  for (const event of events) {
    if (!byDate[event.jewishDate]) {
      byDate[event.jewishDate] = {
        jewishDate: event.jewishDate,
        totalActions: 0,
        byCategory: {},
        events: [],
      };
    }
    const day = byDate[event.jewishDate];
    day.totalActions += 1;
    day.events.push(event);

    if (!day.byCategory[event.category]) {
      day.byCategory[event.category] = {
        count: 0,
        totalQuantity: 0,
        types: {},
      };
    }
    const cat = day.byCategory[event.category];
    cat.count += 1;
    cat.totalQuantity += event.quantity;
    cat.types[event.type] = (cat.types[event.type] || 0) + 1;
  }
  return byDate;
}

export function aggregateForRange(events, { fromDate, toDate }) {
  const filtered = events.filter(e => e.jewishDate >= fromDate && e.jewishDate <= toDate);
  const byCategory = {};
  let totalActions = 0;

  for (const event of filtered) {
    totalActions += 1;
    if (!byCategory[event.category]) {
      byCategory[event.category] = {
        count: 0,
        totalQuantity: 0,
        types: {},
      };
    }
    const cat = byCategory[event.category];
    cat.count += 1;
    cat.totalQuantity += event.quantity;
    cat.types[event.type] = (cat.types[event.type] || 0) + 1;
  }

  return { totalActions, byCategory, events: filtered };
}

// Hebrew label helpers for UI
export const CATEGORY_LABELS = {
  [ACTIVITY_CATEGORY.PRAYER]: 'תפילות',
  [ACTIVITY_CATEGORY.TEHILLIM]: 'פרקי תהילים',
  [ACTIVITY_CATEGORY.TORAH_STUDY]: 'לימוד תורה',
  [ACTIVITY_CATEGORY.BIRKAT_HAMAZON]: 'ברכת המזון',
  [ACTIVITY_CATEGORY.OMER_COUNT]: 'ספירת העומר',
  [ACTIVITY_CATEGORY.SHNAYIM_MIKRA]: 'שניים מקרא',
  [ACTIVITY_CATEGORY.OTHER]: 'אחר',
};

export const TYPE_LABELS = {
  [ACTIVITY_TYPE.SHACHARIT]: 'שחרית',
  [ACTIVITY_TYPE.MINCHA]: 'מנחה',
  [ACTIVITY_TYPE.ARVIT]: 'ערבית',
  [ACTIVITY_TYPE.MUSAF]: 'מוסף',
  [ACTIVITY_TYPE.TEHILLIM_CHAPTER]: 'פרק תהילים',
  [ACTIVITY_TYPE.TEHILLIM_DAILY_PORTION]: 'מנה יומית',
  [ACTIVITY_TYPE.DAF_YOMI]: 'דף יומי',
  [ACTIVITY_TYPE.MISHNAH_YOMIT]: 'משנה יומית',
  [ACTIVITY_TYPE.RAMBAM_YOMI]: 'רמב״ם יומי',
  [ACTIVITY_TYPE.CUSTOM_LEARNING]: 'לימוד',
  [ACTIVITY_TYPE.BIRKAT_HAMAZON_FULL]: 'ברכת המזון',
  [ACTIVITY_TYPE.OMER_DAY]: 'יום העומר',
  [ACTIVITY_TYPE.SHNAYIM_MIKRA_PORTION]: 'קטע',
  [ACTIVITY_TYPE.HALLEL]: 'הלל',
  [ACTIVITY_TYPE.YAALEH_VEYAVO]: 'יעלה ויבוא',
  [ACTIVITY_TYPE.AL_HANISSIM]: 'על הניסים',
  [ACTIVITY_TYPE.VETEN_TAL_UMATAR]: 'ותן טל ומטר',
  [ACTIVITY_TYPE.MASHIV_HARUACH]: 'משיב הרוח',
  [ACTIVITY_TYPE.VIDUI]: 'וידוי',
};

export function formatEventForDisplay(event) {
  const categoryLabel = CATEGORY_LABELS[event.category] || event.category;
  const typeLabel = TYPE_LABELS[event.type] || event.type;

  let detail = '';
  if (event.quantity > 1 || event.unit !== 'count') {
    const unitLabel = event.unit === 'chapters' ? 'פרקים' :
                      event.unit === 'minutes' ? 'דקות' :
                      event.unit === 'verses' ? 'פסוקים' :
                      event.unit === 'pages' ? 'עמודים' :
                      event.unit;
    detail = `${event.quantity} ${unitLabel}`;
  } else if (event.completed) {
    detail = 'הושלמה';
  }

  const time = new Date(event.occurredAt).toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  return {
    time,
    category: categoryLabel,
    type: typeLabel,
    detail,
    completed: event.completed,
  };
}

// Convenience functions for common activities
export function recordPrayerCompletion(prayerType, { occurredAt, tzid, source = 'siddur', sourceId, storage } = {}) {
  const typeMap = {
    shacharit: ACTIVITY_TYPE.SHACHARIT,
    mincha: ACTIVITY_TYPE.MINCHA,
    arvit: ACTIVITY_TYPE.ARVIT,
    musaf: ACTIVITY_TYPE.MUSAF,
  };
  const type = typeMap[prayerType] || ACTIVITY_TYPE.SHACHARIT;
  const event = createEvent({
    category: ACTIVITY_CATEGORY.PRAYER,
    type,
    occurredAt,
    tzid,
    source,
    sourceId,
    unit: 'count',
    quantity: 1,
  });
  return recordEvent(event, storage);
}

export function recordPrayerAddition(additionKind, { occurredAt, tzid, source = 'today', sourceId, storage } = {}) {
  const typeMap = {
    hallel: ACTIVITY_TYPE.HALLEL,
    'yaaleh-veyavo': ACTIVITY_TYPE.YAALEH_VEYAVO,
    'al-hanissim': ACTIVITY_TYPE.AL_HANISSIM,
    'veten-tal-umatar': ACTIVITY_TYPE.VETEN_TAL_UMATAR,
    'mashiv-haruach': ACTIVITY_TYPE.MASHIV_HARUACH,
    vidui: ACTIVITY_TYPE.VIDUI,
  };
  const type = typeMap[additionKind] || ACTIVITY_TYPE.CUSTOM_LEARNING;
  const event = createEvent({
    category: ACTIVITY_CATEGORY.PRAYER,
    type,
    occurredAt,
    tzid,
    source,
    sourceId,
    unit: 'count',
    quantity: 1,
  });
  return recordEvent(event, storage);
}

export function recordTehillimCompletion(chapterCount, { occurredAt, tzid, source = 'tehillim', sourceId, isDailyPortion = false, storage } = {}) {
  const event = createEvent({
    category: ACTIVITY_CATEGORY.TEHILLIM,
    type: isDailyPortion ? ACTIVITY_TYPE.TEHILLIM_DAILY_PORTION : ACTIVITY_TYPE.TEHILLIM_CHAPTER,
    occurredAt,
    tzid,
    source,
    sourceId,
    unit: 'chapters',
    quantity: chapterCount,
  });
  return recordEvent(event, storage);
}

export function recordTorahStudy(minutes, { occurredAt, tzid, source = 'learning', sourceId, learningType = ACTIVITY_TYPE.CUSTOM_LEARNING, storage } = {}) {
  const event = createEvent({
    category: ACTIVITY_CATEGORY.TORAH_STUDY,
    type: learningType,
    occurredAt,
    tzid,
    source,
    sourceId,
    unit: 'minutes',
    quantity: minutes,
  });
  return recordEvent(event, storage);
}

// Clear all events (for testing only)
export function _clearAllEvents(storage = defaultStorage()) {
  write({ events: [], schemaVersion: SCHEMA_VERSION }, storage);
}

export const STORAGE_KEY_EXPORT = STORAGE_KEY;