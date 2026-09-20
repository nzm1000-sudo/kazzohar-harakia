import { formatGregorianDate } from '../civilDate.mjs';
import { datelineAssessment, formatZoned, offsetLabel, polarAssessment, restOverlaps, fastOverlaps, tripTimeline, durationLabel } from './travelPlan.mjs';

const value = (input, fallback = 'לא זמין') => (input === null || input === undefined || input === '' ? fallback : input);

/**
 * Compiles verifiable facts for a rabbinic question. It deliberately contains no
 * conclusion, recommendation or ruling of any kind.
 */
export function buildRabbiPack({ trip, settings = {}, items = [], destinationSolar = null, now = new Date() } = {}) {
  if (!trip) return null;
  const timeline = tripTimeline(trip);
  const dateline = datelineAssessment(trip);
  const polar = polarAssessment({ latitude: trip.destination?.latitude, solar: destinationSolar });
  const rest = restOverlaps(trip, items);
  const fasts = fastOverlaps(trip, items);
  const residence = settings.halachicResidenceStatus || (settings.il ? 'israel' : 'diaspora');

  const ambiguities = [];
  if (dateline.candidate) ambiguities.push('שאלת קו התאריך');
  if (polar.flagged) ambiguities.push('זמני יום באזור קו רוחב גבוה');
  if (rest.length) ambiguities.push('חפיפה לשבת או ליום טוב');
  if (fasts.length) ambiguities.push('חפיפה ליום תענית');
  if (residence === 'israel' && trip.destination?.name && trip.origin?.name !== trip.destination?.name) {
    ambiguities.push('תושב ישראל השוהה בחו״ל');
  }

  return {
    generatedAt: (now instanceof Date ? now : new Date(now)).toISOString(),
    // The explicit profile is reported as-is and is never inferred from location.
    residence: { status: residence, label: residence === 'israel' ? 'תושב ישראל' : 'תושב חו״ל' },
    currentLocation: { name: value(settings.location?.name), tzid: value(settings.location?.tzid) },
    origin: {
      name: value(trip.origin?.name), latitude: value(trip.origin?.latitude), longitude: value(trip.origin?.longitude),
      tzid: value(trip.origin?.tzid), local: timeline.originLocal, utcOffset: offsetLabel(timeline.originOffset),
    },
    destination: {
      name: value(trip.destination?.name), latitude: value(trip.destination?.latitude), longitude: value(trip.destination?.longitude),
      tzid: value(trip.destination?.tzid), local: timeline.destinationLocal, utcOffset: offsetLabel(timeline.destinationOffset),
    },
    route: { transport: trip.transport, flightNumber: value(trip.flightNumber, 'ללא'), durationMinutes: timeline.durationMinutes },
    timestamps: { departureUTC: value(timeline.departure), arrivalUTC: value(timeline.arrival) },
    civilDateChange: {
      departureDay: value(timeline.departure?.slice(0, 10)),
      arrivalDay: value(timeline.arrival?.slice(0, 10)),
      changed: Boolean(timeline.departure && timeline.arrival && timeline.departure.slice(0, 10) !== timeline.arrival.slice(0, 10)),
    },
    timezoneChange: { differenceMinutes: timeline.timeDifferenceMinutes, label: offsetLabel(timeline.timeDifferenceMinutes) },
    dateline,
    polar,
    restOverlaps: rest,
    fasts,
    ambiguities,
  };
}

export function rabbiPackText(pack) {
  if (!pack) return '';
  const lines = [
    'נתונים לשאלה לרב · כזוהר הרקיע',
    '',
    `מעמד שהוגדר: ${pack.residence.label}`,
    `מיקום נוכחי: ${pack.currentLocation.name} (${pack.currentLocation.tzid})`,
    '',
    `יציאה: ${pack.origin.name}`,
    `  קואורדינטות: ${pack.origin.latitude}, ${pack.origin.longitude}`,
    `  אזור זמן: ${pack.origin.tzid} (UTC${pack.origin.utcOffset})`,
    `  מועד מקומי: ${pack.origin.local ? `${pack.origin.local.date} · ${pack.origin.local.time}` : 'לא זמין'}`,
    '',
    `יעד: ${pack.destination.name}`,
    `  קואורדינטות: ${pack.destination.latitude}, ${pack.destination.longitude}`,
    `  אזור זמן: ${pack.destination.tzid} (UTC${pack.destination.utcOffset})`,
    `  מועד מקומי: ${pack.destination.local ? `${pack.destination.local.date} · ${pack.destination.local.time}` : 'לא זמין'}`,
    '',
    `אופן הנסיעה: ${pack.route.transport}`,
    `מספר טיסה: ${pack.route.flightNumber}`,
    `משך: ${durationLabel(pack.route.durationMinutes)}`,
    `הפרש אזורי זמן: ${pack.timezoneChange.label}`,
    '',
    `חותם UTC ביציאה: ${pack.timestamps.departureUTC}`,
    `חותם UTC בהגעה: ${pack.timestamps.arrivalUTC}`,
    `שינוי תאריך אזרחי: ${pack.civilDateChange.changed ? 'כן' : 'לא'} (${pack.civilDateChange.departureDay} → ${pack.civilDateChange.arrivalDay})`,
    '',
    `קו התאריך: ${pack.dateline.candidate ? 'ייתכן שרלוונטי' : 'לא זוהה'}`,
    `  מרחק אורך: ${pack.dateline.separationDegrees ?? 'לא זמין'} מעלות`,
    `קו רוחב גבוה: ${pack.polar.flagged ? 'כן' : 'לא'}`,
    `  קו רוחב: ${pack.polar.latitude ?? 'לא זמין'}`,
    `  אורך היום: ${pack.polar.dayLengthHours ?? 'לא זמין'} שעות`,
  ];
  if (pack.restOverlaps.length) {
    lines.push('', 'חפיפה לשבת או ליום טוב:');
    for (const overlap of pack.restOverlaps) {
      const entry = formatZoned(overlap.entry, pack.destination.tzid);
      lines.push(`  כניסה: ${entry ? `${entry.date} · ${entry.time}` : overlap.entry}`);
    }
  }
  if (pack.fasts.length) {
    lines.push('', 'ימי תענית בטווח הנסיעה:');
    for (const fast of pack.fasts) lines.push(`  ${fast.name} · ${formatGregorianDate(fast.date, pack.destination.tzid)}`);
  }
  lines.push('', 'נקודות לבירור:');
  if (pack.ambiguities.length) for (const item of pack.ambiguities) lines.push(`  · ${item}`);
  else lines.push('  · לא זוהתה שאלה מיוחדת');
  lines.push('', 'המסמך מכיל נתונים בלבד ואינו כולל מסקנה הלכתית.');
  return lines.join('\n');
}
