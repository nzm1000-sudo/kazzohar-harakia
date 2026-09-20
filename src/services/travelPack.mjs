import { tripTimeline } from './travelPlan.mjs';

export const PACK_CONTENT_VERSION = 1;

/** Only trip-relevant content is listed; nothing is bulk downloaded. */
export const PACK_ITEMS = Object.freeze([
  { id: 'siddur-core', label: 'סידור · תפילות היום', bytes: 180_000, required: true },
  { id: 'tefilat-haderech', label: 'תפילת הדרך', bytes: 6_000, required: true },
  { id: 'tehillim', label: 'תהילים', bytes: 172_000, required: true },
  { id: 'parasha', label: 'הפרשה הקרובה', bytes: 48_000, required: true },
  { id: 'destination-calendar', label: 'לוח עברי ביעד', bytes: 24_000, required: true },
  { id: 'destination-zmanim', label: 'זמני היעד לתאריכי הנסיעה', bytes: 12_000, required: true },
  { id: 'holiday-context', label: 'הקשר חג רלוונטי', bytes: 16_000, required: false },
  { id: 'talmud-recent', label: 'תלמוד · מטמון אחרון', bytes: 210_000, required: false },
  { id: 'saved-sources', label: 'מקורות והלכה שמורים', bytes: 90_000, required: false },
  { id: 'shabbat-page', label: 'דף שבת לנסיעה', bytes: 20_000, required: false },
]);

function tripDays(trip) {
  const timeline = tripTimeline(trip);
  if (!timeline.departure || !timeline.arrival) return [];
  const days = [];
  const start = new Date(`${timeline.departure.slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${timeline.arrival.slice(0, 10)}T12:00:00Z`);
  for (let cursor = start; cursor <= end && days.length < 40; cursor = new Date(cursor.getTime() + 86400000)) {
    days.push(cursor.toISOString().slice(0, 10));
  }
  return days;
}

export function packSelection(trip, { overlapsRest = false, hasSavedSources = false, hasTalmudCache = false } = {}) {
  return PACK_ITEMS.filter(item => {
    if (item.required) return true;
    if (item.id === 'shabbat-page' || item.id === 'holiday-context') return overlapsRest;
    if (item.id === 'saved-sources') return hasSavedSources;
    if (item.id === 'talmud-recent') return hasTalmudCache;
    return false;
  });
}

export function estimatePack(trip, options = {}) {
  const items = packSelection(trip, options);
  const days = tripDays(trip);
  const perDay = items.some(item => item.id === 'destination-zmanim') ? Math.max(days.length, 1) * 1_200 : 0;
  const bytes = items.reduce((total, item) => total + item.bytes, 0) + perDay;
  return { items, days, bytes, label: formatBytes(bytes) };
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildPack(trip, options = {}, now = new Date()) {
  const estimate = estimatePack(trip, options);
  const timeline = tripTimeline(trip);
  return {
    tripId: trip.id,
    contentVersion: PACK_CONTENT_VERSION,
    generatedAt: (now instanceof Date ? now : new Date(now)).toISOString(),
    origin: { name: trip.origin.name, tzid: trip.origin.tzid },
    destination: { name: trip.destination.name, tzid: trip.destination.tzid },
    range: { from: timeline.departure?.slice(0, 10) || null, to: timeline.arrival?.slice(0, 10) || null },
    days: estimate.days,
    items: estimate.items.map(item => ({ id: item.id, label: item.label, bytes: item.bytes })),
    bytes: estimate.bytes,
  };
}

/** Trip edits invalidate the pack so stale zmanim are never presented as current. */
export function packStatus(trip, pack) {
  if (!pack) return { exists: false, stale: false, reasons: [] };
  const timeline = tripTimeline(trip);
  const reasons = [];
  if (pack.contentVersion !== PACK_CONTENT_VERSION) reasons.push('גרסת התוכן השתנתה');
  if (pack.range?.from !== (timeline.departure?.slice(0, 10) || null)) reasons.push('תאריך היציאה השתנה');
  if (pack.range?.to !== (timeline.arrival?.slice(0, 10) || null)) reasons.push('תאריך ההגעה השתנה');
  if (pack.destination?.tzid !== trip.destination.tzid) reasons.push('אזור הזמן ביעד השתנה');
  if (pack.destination?.name !== trip.destination.name) reasons.push('היעד השתנה');
  if (pack.origin?.tzid !== trip.origin.tzid) reasons.push('אזור הזמן במוצא השתנה');
  return { exists: true, stale: reasons.length > 0, reasons };
}
