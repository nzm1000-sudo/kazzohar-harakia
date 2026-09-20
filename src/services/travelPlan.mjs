import { formatGregorianDate } from '../civilDate.mjs';

const MINUTE = 60000;

/** Offset is resolved per instant so daylight saving transitions are handled correctly. */
export function zoneOffsetMinutes(instant, tzid) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime()) || !tzid) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tzid, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date);
    const get = type => Number(parts.find(part => part.type === type)?.value);
    const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
    return Math.round((asUTC - date.getTime()) / MINUTE);
  } catch { return null; }
}

/** Converts a wall-clock date/time in a zone into an absolute instant. */
export function zonedTimeToInstant(dateKey, timeText, tzid) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
  const [hour, minute] = String(timeText || '00:00').split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const naive = Date.parse(`${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
  if (!Number.isFinite(naive)) return null;
  let instant = new Date(naive);
  // Two passes settle the offset when the wall time sits near a DST boundary.
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = zoneOffsetMinutes(instant, tzid);
    if (offset === null) return null;
    instant = new Date(naive - offset * MINUTE);
  }
  return instant;
}

export function formatZoned(instant, tzid) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime()) || !tzid) return null;
  try {
    const time = new Intl.DateTimeFormat('he-IL', { timeZone: tzid, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
    return { date: formatGregorianDate(date, tzid), time };
  } catch { return null; }
}

export function offsetLabel(minutes) {
  if (minutes === null || minutes === undefined) return 'לא זמין';
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

export function tripTimeline(trip) {
  const origin = trip?.origin || {};
  const destination = trip?.destination || {};
  const departure = zonedTimeToInstant(trip?.departureDate, trip?.departureTime, origin.tzid);
  const arrival = zonedTimeToInstant(trip?.arrivalDate, trip?.arrivalTime, destination.tzid);
  const durationMinutes = departure && arrival ? Math.round((arrival - departure) / MINUTE) : null;
  const originOffset = departure ? zoneOffsetMinutes(departure, origin.tzid) : null;
  const destinationOffset = arrival ? zoneOffsetMinutes(arrival, destination.tzid) : null;
  return {
    departure: departure ? departure.toISOString() : null,
    arrival: arrival ? arrival.toISOString() : null,
    durationMinutes: durationMinutes !== null && durationMinutes >= 0 ? durationMinutes : null,
    originLocal: departure ? formatZoned(departure, origin.tzid) : null,
    destinationLocal: arrival ? formatZoned(arrival, destination.tzid) : null,
    departureInDestination: departure ? formatZoned(departure, destination.tzid) : null,
    originOffset,
    destinationOffset,
    timeDifferenceMinutes: originOffset !== null && destinationOffset !== null ? destinationOffset - originOffset : null,
    valid: Boolean(departure && arrival && arrival >= departure),
  };
}

export function durationLabel(minutes) {
  if (minutes === null || minutes === undefined) return 'לא זמין';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} דקות`;
  return rest ? `${hours} שעות ו־${rest} דקות` : `${hours} שעות`;
}

function overlaps(startISO, endISO, windowStart, windowEnd) {
  if (!startISO || !endISO || !windowStart) return false;
  const end = windowEnd || windowStart;
  return startISO < end && endISO > windowStart;
}

/**
 * Detects travel that runs into Shabbat or Yom Tov using the real candle and havdalah
 * events. The app reports the overlap; it never decides whether to travel.
 */
export function restOverlaps(trip, items = []) {
  const timeline = tripTimeline(trip);
  if (!timeline.departure || !timeline.arrival) return [];
  const candles = items.filter(item => item.category === 'candles' && item.date).sort((a, b) => a.date.localeCompare(b.date));
  const havdalah = items.filter(item => item.category === 'havdalah' && item.date).sort((a, b) => a.date.localeCompare(b.date));
  const results = [];
  for (const start of candles) {
    const end = havdalah.find(item => item.date > start.date);
    const startISO = new Date(start.date).toISOString();
    const endISO = end ? new Date(end.date).toISOString() : null;
    if (!overlaps(timeline.departure, timeline.arrival, startISO, endISO)) continue;
    results.push({
      kind: start.title && /yom tov|chag|חג/i.test(start.title) ? 'yom-tov' : 'shabbat',
      entry: startISO,
      exit: endISO,
      location: trip?.destination?.name || trip?.origin?.name || null,
    });
  }
  return results;
}

export function fastOverlaps(trip, items = []) {
  const timeline = tripTimeline(trip);
  if (!timeline.departure || !timeline.arrival) return [];
  const departureDay = timeline.departure.slice(0, 10);
  const arrivalDay = timeline.arrival.slice(0, 10);
  return items
    .filter(item => item.subcat === 'fast' && item.date)
    .filter(item => {
      const day = item.date.slice(0, 10);
      return day >= departureDay && day <= arrivalDay;
    })
    .map(item => ({ name: item.hebrew || item.title, date: item.date.slice(0, 10) }));
}

const normalizeLongitude = value => ((Number(value) + 540) % 360) - 180;

/**
 * Flags routes that may raise the halachic date line question. It never rules; the
 * caller routes the user to the rabbi data pack.
 */
export function datelineAssessment(trip) {
  const origin = trip?.origin || {};
  const destination = trip?.destination || {};
  const originLon = Number(origin.longitude);
  const destinationLon = Number(destination.longitude);
  if (!Number.isFinite(originLon) || !Number.isFinite(destinationLon)) {
    return { candidate: false, reason: 'אין נתוני קואורדינטות מלאים' };
  }
  const a = normalizeLongitude(originLon);
  const b = normalizeLongitude(destinationLon);
  const direct = Math.abs(a - b);
  const shortest = Math.min(direct, 360 - direct);
  const crossesAntimeridian = direct > 180;
  const nearLine = Math.abs(a) > 150 || Math.abs(b) > 150;
  const candidate = crossesAntimeridian || (nearLine && shortest > 20);
  return {
    candidate,
    crossesAntimeridian,
    nearLine,
    originLongitude: a,
    destinationLongitude: b,
    separationDegrees: Number(shortest.toFixed(2)),
    reason: candidate ? 'מסלול זה עשוי לעורר שאלת קו התאריך ההלכתי.' : 'לא זוהה חשש לקו התאריך במסלול זה.',
  };
}

export const POLAR_LATITUDE = 60;

/**
 * Reports missing or abnormal solar events. No surrogate zmanim are ever generated.
 */
export function polarAssessment({ latitude, solar = null } = {}) {
  const lat = Number(latitude);
  if (!Number.isFinite(lat)) return { flagged: false, reason: 'אין נתוני קו רוחב' };
  const highLatitude = Math.abs(lat) >= POLAR_LATITUDE;
  const sunrise = solar?.sunrise ? new Date(solar.sunrise) : null;
  const sunset = solar?.sunset ? new Date(solar.sunset) : null;
  const validSunrise = Boolean(sunrise && Number.isFinite(sunrise.getTime()));
  const validSunset = Boolean(sunset && Number.isFinite(sunset.getTime()));
  const missing = solar !== null && (!validSunrise || !validSunset);
  const dayLengthHours = validSunrise && validSunset ? (sunset - sunrise) / 3600000 : null;
  const extreme = dayLengthHours !== null && (dayLengthHours < 3 || dayLengthHours > 21);
  const flagged = highLatitude && (missing || extreme || solar === null);
  return {
    flagged,
    highLatitude,
    latitude: lat,
    missingSunrise: solar !== null && !validSunrise,
    missingSunset: solar !== null && !validSunset,
    dayLengthHours: dayLengthHours === null ? null : Number(dayLengthHours.toFixed(2)),
    extreme,
    reason: flagged ? 'זמני היום באזור זה דורשים בירור הלכתי מיוחד' : 'זמני היום באזור זה מחושבים כרגיל.',
  };
}

export function tripStatus(trip, now = new Date()) {
  const timeline = tripTimeline(trip);
  const current = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  if (!timeline.departure || !timeline.arrival) return 'draft';
  if (current < timeline.departure) return 'upcoming';
  if (current > timeline.arrival) return 'past';
  return 'active';
}
