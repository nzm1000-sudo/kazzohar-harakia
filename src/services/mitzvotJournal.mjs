// Central Jewish Activity Journal — "המצוות שלי"
// Single source of truth for all verified mitzvah-related activities.
// Local-first, no external transmission, conservative factual recording.

import { civilDateKey, jewishDateKey } from '../civilDate.mjs';

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
  BRACHOT: 'brachot',
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
  // Other Siddur services
  MORNING_BLESSINGS: 'morning_blessings',
  ROSH_CHODESH_PRAYERS: 'rosh_chodesh_prayers',
  HAVDALAH: 'havdalah',
  BEDTIME_SHEMA: 'bedtime_shema',
  // Any other weekday prayer of the Siddur (תיקון חצות, ברכת הלבנה, סליחות…); its own title is kept in metadata.
  SIDDUR_PRAYER: 'siddur_prayer',
  // A reading of the Siddur that is not a prayer (משניות לאבל, קריאת התורה לתענית…).
  SIDDUR_READING: 'siddur_reading',
  // Blessings (ברכות)
  MEIN_SHALOSH: 'mein_shalosh',
  BORE_NEFASHOT: 'bore_nefashot',
  BRACHA_ACHRONA: 'bracha_achrona',
  BIRCHOT_HANEHENIN: 'birchot_hanehenin',
  BIRCHOT_HAREIYAH: 'birchot_hareiyah',
  BIRCHOT_HAMITZVOT: 'birchot_hamitzvot',
  TEFILAT_HADERECH: 'tefilat_haderech',
  BLESSING: 'blessing',
  BIRKAT_HAILANOT: 'birkat_hailanot',
  // Mitzvot of the season read from the Siddur
  CHANUKAH_LIGHTS: 'chanukah_lights',
  MEGILLAH: 'megillah',
  // A prayer of "שלום רב"
  SHALOM_RAV_PRAYER: 'shalom_rav_prayer',
  // An explicit "סיימתי" on a unit of study (a chapter, a daf, a seif, a question) — a count, not minutes.
  STUDY_UNIT: 'study_unit',
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

export const JOURNAL_CHANGE_EVENT = 'kz-journal-change';

function write(data, storage = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or private mode - silently fail
  }
  // Lets always-mounted UI (the Presence Glow in the shell) react to new activity.
  try { if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent === 'function') globalThis.dispatchEvent(new CustomEvent(JOURNAL_CHANGE_EVENT)); } catch { /* no DOM */ }
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

// Sunsets known to the app (the same zmanim dayContext uses), keyed by time zone + civil date.
// The journal never computes sunset itself; it is handed the app's zmanim (registerDaySunset).
const knownSunsets = new Map();
const MAX_KNOWN_SUNSETS = 16;
export function registerDaySunset({ sunset, tzid } = {}) {
  const at = sunset ? new Date(sunset) : null;
  if (!at || !Number.isFinite(at.getTime()) || !tzid) return false;
  knownSunsets.set(`${tzid}|${civilDateKey(at, tzid)}`, at.toISOString());
  while (knownSunsets.size > MAX_KNOWN_SUNSETS) knownSunsets.delete(knownSunsets.keys().next().value);
  return true;
}
export function _clearKnownSunsets() { knownSunsets.clear(); }

// Jewish day key (civil key of the Jewish day). Sunset-aware through civilDate.jewishDateKey — the
// function dayContext uses — whenever the app's sunset for that civil date is known; until then it
// stays on the civil date (the previous behaviour), never guessing a boundary.
export function getJewishDateKey(now = new Date(), tzid = 'Asia/Jerusalem') {
  const civil = civilDateKey(now, tzid);
  const sunset = knownSunsets.get(`${tzid}|${civil}`);
  return (sunset && jewishDateKey(new Date(now), new Date(sunset), tzid)) || civil;
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
  [ACTIVITY_CATEGORY.BRACHOT]: 'ברכות',
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
  [ACTIVITY_TYPE.MORNING_BLESSINGS]: 'ברכות השחר',
  [ACTIVITY_TYPE.ROSH_CHODESH_PRAYERS]: 'תפילות ראש חודש',
  [ACTIVITY_TYPE.HAVDALAH]: 'הבדלה',
  [ACTIVITY_TYPE.BEDTIME_SHEMA]: 'קריאת שמע על המיטה',
  [ACTIVITY_TYPE.SIDDUR_PRAYER]: 'תפילה',
  [ACTIVITY_TYPE.SIDDUR_READING]: 'קריאה מן הסידור',
  [ACTIVITY_TYPE.MEIN_SHALOSH]: 'ברכה מעין שלוש',
  [ACTIVITY_TYPE.BORE_NEFASHOT]: 'בורא נפשות',
  [ACTIVITY_TYPE.BRACHA_ACHRONA]: 'ברכה אחרונה',
  [ACTIVITY_TYPE.BIRCHOT_HANEHENIN]: 'ברכות הנהנין',
  [ACTIVITY_TYPE.BIRCHOT_HAREIYAH]: 'ברכות הראייה והשבח',
  [ACTIVITY_TYPE.BIRCHOT_HAMITZVOT]: 'ברכות המצוות',
  [ACTIVITY_TYPE.TEFILAT_HADERECH]: 'תפילת הדרך',
  [ACTIVITY_TYPE.BLESSING]: 'ברכה',
  [ACTIVITY_TYPE.BIRKAT_HAILANOT]: 'ברכת האילנות',
  [ACTIVITY_TYPE.CHANUKAH_LIGHTS]: 'הדלקת נרות חנוכה',
  [ACTIVITY_TYPE.MEGILLAH]: 'מקרא מגילה',
  [ACTIVITY_TYPE.SHALOM_RAV_PRAYER]: 'תפילה משלום רב',
  [ACTIVITY_TYPE.STUDY_UNIT]: 'סיום לימוד',
};

// Types whose own title (kept in metadata) says more than the type's label: the journal shows the title.
const TITLED_TYPES = new Set([ACTIVITY_TYPE.SIDDUR_PRAYER, ACTIVITY_TYPE.SIDDUR_READING, ACTIVITY_TYPE.BIRCHOT_HAREIYAH, ACTIVITY_TYPE.BIRCHOT_HAMITZVOT, ACTIVITY_TYPE.BLESSING, ACTIVITY_TYPE.SHALOM_RAV_PRAYER, ACTIVITY_TYPE.STUDY_UNIT, ACTIVITY_TYPE.CUSTOM_LEARNING, ACTIVITY_TYPE.SHNAYIM_MIKRA_PORTION]);
function typeLabelOf(event) {
  const label = TYPE_LABELS[event.type] || event.type;
  const title = event.metadata?.title || event.metadata?.workTitle;
  if (!title || !TITLED_TYPES.has(event.type)) return label;
  return event.type === ACTIVITY_TYPE.STUDY_UNIT ? `${label} · ${title}` : title;
}

export function formatEventForDisplay(event) {
  const categoryLabel = CATEGORY_LABELS[event.category] || event.category;
  const typeLabel = typeLabelOf(event);

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

// Study of one minute or more is recorded as one journal event per work per day; later
// minutes on the same day update that event instead of adding more (never a separate count).
export function upsertTorahStudyMinutes(minutes, { jewishDate, occurredAt, tzid, source = 'reader', sourceId, workTitle = null, storage } = {}) {
  const whole = Math.floor(Number(minutes) || 0);
  if (whole < 1) return { created: false, updated: false };
  const event = createEvent({
    category: ACTIVITY_CATEGORY.TORAH_STUDY,
    type: ACTIVITY_TYPE.CUSTOM_LEARNING,
    occurredAt,
    jewishDate,
    tzid,
    source,
    sourceId,
    unit: 'minutes',
    quantity: whole,
    metadata: workTitle ? { workTitle } : {},
  });
  const data = read(storage);
  const existing = data.events.find(e => e.eventKey === event.eventKey);
  if (!existing) {
    data.events.push(event);
    write(data, storage);
    return { event, created: true, updated: false };
  }
  if (whole <= existing.quantity) return { event: existing, created: false, updated: false };
  existing.quantity = whole;
  write(data, storage);
  return { event: existing, created: false, updated: true };
}

export function studyMinutesRecorded({ jewishDate, source = 'reader', sourceId }, storage = defaultStorage()) {
  const probe = createEvent({ category: ACTIVITY_CATEGORY.TORAH_STUDY, type: ACTIVITY_TYPE.CUSTOM_LEARNING, jewishDate, source, sourceId, unit: 'minutes' });
  return read(storage).events.find(e => e.eventKey === probe.eventKey)?.quantity || 0;
}

// Siddur flows that can be marked "סיימתי". Shabbat / Yom Tov services are deliberately
// absent: the app must not invite phone use on Shabbat (they stay in the Siddur for study).
export const SIDDUR_COMPLETION = {
  'Preparatory Prayers': { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.MORNING_BLESSINGS },
  'Weekday Shacharit': { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.SHACHARIT },
  'Weekday Mincha': { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.MINCHA },
  'Weekday Arvit': { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.ARVIT },
  'Rosh Hodesh': { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.ROSH_CHODESH_PRAYERS },
  Hallel: { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.HALLEL },
  Havdalah: { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.HAVDALAH },
  'Post Meal Blessing': { category: ACTIVITY_CATEGORY.BIRKAT_HAMAZON, type: ACTIVITY_TYPE.BIRKAT_HAMAZON_FULL },
  'Bedtime Shema': { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.BEDTIME_SHEMA },
  'Counting of the Omer': { category: ACTIVITY_CATEGORY.OMER_COUNT, type: ACTIVITY_TYPE.OMER_DAY },
  // The blessings of every day (ברכות): after food and the blessings of enjoyment — one entry of each kind per day.
  'Al Hamihya': { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.MEIN_SHALOSH },
  'Borei Nefashot': { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.BORE_NEFASHOT },
  'Berakha Acharona': { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.BRACHA_ACHRONA },
  'Blessings on Enjoyments': { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.BIRCHOT_HANEHENIN },
  'Tefillat HaDerech': { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.TEFILAT_HADERECH },
};

// The composed readers' keys (the rite's services, the Smart Siddur's day services) → the flow they record as.
const RITE_SERVICE_FLOW = { 'weekday-shacharit': 'Weekday Shacharit', 'weekday-mincha': 'Weekday Mincha', 'weekday-maariv': 'Weekday Arvit', 'bedtime-shema': 'Bedtime Shema', havdalah: 'Havdalah', hallel: 'Hallel', 'birkat-hamazon': 'Post Meal Blessing', 'rosh-chodesh-musaf': 'Rosh Hodesh', omer: 'Counting of the Omer' };
const DAY_SERVICE_FLOW = { shacharit: 'Weekday Shacharit', mincha: 'Weekday Mincha', maariv: 'Weekday Arvit', 'birkat-hamazon': 'Post Meal Blessing' };

// Shabbat and Yom Tov: never offered (the user does not use the app then). Havdalah / Motzaei Shabbat are checked first.
const NOT_ON_SHABBAT_OR_YOM_TOV = /shabbat|shabbos|kabbalat|candle lighting|third meal|daytime meal|evening meal|day meal|three festivals|shalosh regalim|festival|^holidays|simchat torah|shavuot|haggadah|yotzerot|prayer for (dew|rain)|song of songs|\bkiddush\b(?!\s*levan)|^musaf$|eruv tavshilin/i;
const NOT_ON_SHABBAT_OR_YOM_TOV_HE = /שבת|קידוש|שלש רגלים|שלוש רגלים|הגדה|אושפיזין|זוהר לסעודת|שירי סוכות|מזמור ל|ראש השנה|יום הכיפורים|כל נדרי/;

// The blessings, by the item (a chip of a collection) first and then the root. A canonical flow = one entry per day
// for that kind, whichever rite or page it was read from; `perItem` kinds keep one entry per blessing.
const BLESSING_RULES = [
  [/birkat ?hamazon|birchat ?hamazon|post meal/i, { flow: 'Post Meal Blessing' }],
  [/al ?hami[ck]?h(i)?yah?|me'?ein shalosh/i, { flow: 'Al Hamihya' }],
  [/borei nefashot|bore nefashot/i, { flow: 'Borei Nefashot' }],
  [/berakha acharona|brachot achronot/i, { flow: 'Berakha Acharona' }],
  [/blessings on enjoyments|birkat hanehenin|b[ae]rachot rishonot|blessing on foods|mealtime blessings|shehakol|ha'?adamah|ha'?etz\b/i, { flow: 'Blessings on Enjoyments' }],
  [/travel|haderech/i, { flow: 'Tefillat HaDerech' }],
  [/sights|lightning|thunder|rainbow|ocean|blossoming|fragrant|shehecheyanu|blessings of praise/i, { kind: { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.BIRCHOT_HAREIYAH }, perItem: true }],
  [/mitzvot|mezuz|challah|hallah|terum|tithes|tevil|immersing|fence/i, { kind: { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.BIRCHOT_HAMITZVOT }, perItem: true }],
  [/blessing|berachot|berakh|brachot|sheva|marriage|circumcision|brit|pidyon|redeeming|medicine|priestly|asher yatzar/i, { kind: { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.BLESSING }, perItem: true }],
];
const SERVICE_RULES = [
  [/^(weekday,? )?shacharit$/i, 'Weekday Shacharit'],
  [/^(weekday,? )?minch?ah?$/i, 'Weekday Mincha'],
  [/^(weekday,? )?(maariv|arvit)$/i, 'Weekday Arvit'],
  [/upon arising|preparatory prayers/i, 'Preparatory Prayers'],
  [/bedtime shema/i, 'Bedtime Shema'],
  [/^hallel$/i, 'Hallel'],
  [/^rosh (chodesh|hodesh)$/i, 'Rosh Hodesh'],
  [/omer/i, 'Counting of the Omer'],
];
const READING = /mishn|torah reading|nassi/i;

const found = (flow, title = null) => (SIDDUR_COMPLETION[flow] ? { kind: SIDDUR_COMPLETION[flow], sourceId: flow, title } : null);

// The festival shelf (flowKey "moadim:<moed>:<end label>"): what may be marked is decided by the item's Hebrew title.
function resolveMoed(flowKey, title) {
  const [, moed = '', endLabel = ''] = String(flowKey).split(':');
  const item = String(endLabel.startsWith('סוף ') ? endLabel.slice(4) : (title || '')).trim();
  if (!item) return null;
  if (/ספירת העומר/.test(item)) return found('Counting of the Omer');
  if (/^הלל/.test(item)) return found('Hallel');
  if (/שחרית/.test(item) && !/שבת/.test(item)) return found('Weekday Shacharit');
  if (/סליחות/.test(item)) return { kind: { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.SIDDUR_PRAYER }, sourceId: `moadim:${moed}:${item}`, title: item };
  if (NOT_ON_SHABBAT_OR_YOM_TOV_HE.test(item)) return null;
  if (/הדלקת נרות חנוכה/.test(item)) return { kind: { category: ACTIVITY_CATEGORY.OTHER, type: ACTIVITY_TYPE.CHANUKAH_LIGHTS }, sourceId: 'moadim:hanukkah:lights', title: item };
  if (/מגיל/.test(item)) return { kind: { category: ACTIVITY_CATEGORY.OTHER, type: ACTIVITY_TYPE.MEGILLAH }, sourceId: 'moadim:purim:megillah', title: 'מקרא מגילה' };
  if (/ברכת האילנות/.test(item)) return { kind: { category: ACTIVITY_CATEGORY.BRACHOT, type: ACTIVITY_TYPE.BIRKAT_HAILANOT }, sourceId: 'moadim:pesach:ilanot', title: item };
  if (/לימוד/.test(item)) return { kind: { category: ACTIVITY_CATEGORY.OTHER, type: ACTIVITY_TYPE.SIDDUR_READING }, sourceId: `moadim:${moed}:${item}`, title: item };
  return { kind: { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.SIDDUR_PRAYER }, sourceId: `moadim:${moed}:${item}`, title: item };
}

// What a "סיימתי" in the Siddur records: { kind: {category, type}, sourceId, title } — or null where nothing is offered
// (Shabbat and Yom Tov). flowKey is the root of the flow (any rite), "rite:<nusach>:<service>", "smart:<prayer>" or
// "moadim:…"; itemEn / title name the section open now; perItem = the root is a collection of separate prayers.
export function resolveSiddurCompletion(flowKey, { itemEn = '', title = '', flowTitle = '', perItem = false } = {}) {
  const key = String(flowKey || '');
  if (!key) return null;
  if (SIDDUR_COMPLETION[key]) return found(key);
  const rite = key.match(/^rite:[^:]+:(.+)$/);
  if (rite) return RITE_SERVICE_FLOW[rite[1]] ? found(RITE_SERVICE_FLOW[rite[1]]) : null;
  const smart = key.match(/^smart:(.+)$/);
  if (smart) return DAY_SERVICE_FLOW[smart[1]] ? found(DAY_SERVICE_FLOW[smart[1]]) : null;
  if (key.startsWith('moadim:')) return resolveMoed(key, title);
  if (/^(book|tanakh|halacha-book):/.test(key)) return null;
  // The root without the edition's shelves ("Festivals, Rosh Chodesh" → "Rosh Chodesh"; "Berachot, …").
  const root = key.replace(/^(Festivals|Weekday|Berachot),\s*/i, '').trim();
  const item = String(itemEn || '').trim();
  const text = `${root} ${item}`;
  if (/havdal|motza?ei shabbat/i.test(text)) return found('Havdalah');
  if (NOT_ON_SHABBAT_OR_YOM_TOV.test(root) || (item && NOT_ON_SHABBAT_OR_YOM_TOV.test(item))) return null;
  if (/levan|blessing of the moon/i.test(root)) return { kind: { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.SIDDUR_PRAYER }, sourceId: 'Blessing of the Moon', title: 'ברכת הלבנה' };
  const name = String(title || flowTitle || item || root).trim();
  const itemId = item && item !== root ? `${key} › ${item}` : key;
  for (const [pattern, rule] of BLESSING_RULES) {
    if (!pattern.test(item) && !(pattern.test(root) && !BLESSING_RULES.some(([other]) => item && other.test(item)))) continue;
    if (rule.flow) return found(rule.flow);
    return { kind: rule.kind, sourceId: rule.perItem ? itemId : key, title: name };
  }
  for (const [pattern, flow] of SERVICE_RULES) if (pattern.test(root)) return found(flow);
  const reading = READING.test(text);
  return {
    kind: { category: reading ? ACTIVITY_CATEGORY.OTHER : ACTIVITY_CATEGORY.PRAYER, type: reading ? ACTIVITY_TYPE.SIDDUR_READING : ACTIVITY_TYPE.SIDDUR_PRAYER },
    sourceId: perItem ? itemId : key,
    title: perItem ? name : String(flowTitle || name),
  };
}

// One entry per Siddur service per day (sourceId = the flow), whatever section it was marked from; per blessing for
// the collections of separate blessings.
export function recordSiddurCompletion(flowKey, { occurredAt = new Date(), tzid, storage, ...where } = {}) {
  const resolved = resolveSiddurCompletion(flowKey, where);
  if (!resolved) return { created: false, unsupported: true };
  return recordEvent(createEvent({ ...resolved.kind, occurredAt, tzid, source: 'siddur', sourceId: resolved.sourceId, unit: 'count', quantity: 1, metadata: resolved.title ? { title: resolved.title } : {} }), storage);
}

// "סיימתי את הלימוד": one unit of study (a chapter, a daf, a seif, a question) completed — one entry per unit per day.
// A count, beside the minutes the study timer records for the same work (never merged with them).
export const studyUnitSourceId = (workId, unitId) => `${workId}#${unitId ?? ''}`;
export function recordStudyCompletion({ workId, workTitle = null, unitId = null, unitLabel = null, source = 'reader', occurredAt = new Date(), tzid, storage } = {}) {
  if (!workId) return { created: false, unsupported: true };
  const title = [workTitle, unitLabel].filter(Boolean).join(' · ') || null;
  return recordEvent(createEvent({ category: ACTIVITY_CATEGORY.TORAH_STUDY, type: ACTIVITY_TYPE.STUDY_UNIT, occurredAt, tzid, source, sourceId: studyUnitSourceId(workId, unitId), unit: 'count', quantity: 1, metadata: title ? { title, workTitle, unitLabel } : {} }), storage);
}

// Any other reading with its own category (שניים מקרא, a prayer of שלום רב): one entry per source item per day.
export function recordReadingCompletion({ category, type, source, sourceId, title = null, occurredAt = new Date(), tzid, storage } = {}) {
  if (!category || !type || !source || !sourceId) return { created: false, unsupported: true };
  return recordEvent(createEvent({ category, type, occurredAt, tzid, source, sourceId, unit: 'count', quantity: 1, metadata: title ? { title } : {} }), storage);
}

export function hasRecordedToday({ jewishDate, source, sourceId }, storage = defaultStorage()) {
  return read(storage).events.some(e => e.jewishDate === jewishDate && e.source === source && e.sourceId === sourceId);
}

// Clear all events (for testing only)
export function _clearAllEvents(storage = defaultStorage()) {
  write({ events: [], schemaVersion: SCHEMA_VERSION }, storage);
}

export const STORAGE_KEY_EXPORT = STORAGE_KEY;