export const JERUSALEM_TARGET = Object.freeze({
  name: 'מקום המקדש',
  latitude: 31.77805,
  longitude: 35.23593,
  source: 'OpenStreetMap geographic reference for the Temple Mount area',
});

const toRadians = value => value * Math.PI / 180;
const toDegrees = value => value * 180 / Math.PI;
const normalizeDegrees = value => ((Number(value) % 360) + 360) % 360;

export function initialBearing(from, to = JERUSALEM_TARGET) {
  if (!Number.isFinite(from?.latitude) || !Number.isFinite(from?.longitude) || !Number.isFinite(to?.latitude) || !Number.isFinite(to?.longitude)) return null;
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x = Math.cos(latitude1) * Math.sin(latitude2) - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta);
  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
}

export function isEastSector(bearing, halfWidth = 22.5) {
  if (!Number.isFinite(bearing)) return false;
  return Math.abs(angularDifference(90, bearing)) <= halfWidth;
}

export function prayerDirectionLabel(bearing) {
  return isEastSector(bearing) ? 'מזרח · ירושלים' : 'ירושלים';
}

export function distanceKm(from, to = JERUSALEM_TARGET) {
  if (!Number.isFinite(from?.latitude) || !Number.isFinite(from?.longitude) || !Number.isFinite(to?.latitude) || !Number.isFinite(to?.longitude)) return null;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function angularDifference(target, heading) {
  if (!Number.isFinite(target) || !Number.isFinite(heading)) return null;
  return ((normalizeDegrees(target) - normalizeDegrees(heading) + 540) % 360) - 180;
}

export function compassState(target, heading, tolerance = 5) {
  const difference = angularDifference(target, heading);
  if (difference === null) return { status: 'unavailable', difference: null, direction: null };
  if (Math.abs(difference) <= tolerance) return { status: 'aligned', difference, direction: null };
  return { status: 'adjust', difference, direction: difference > 0 ? 'right' : 'left' };
}

export function alignmentZone(error) {
  const absolute = Math.abs(error ?? Infinity);
  if (absolute <= 2) return 'aligned';
  if (absolute <= 5) return 'near';
  if (absolute <= 10) return 'approaching';
  if (absolute <= 20) return 'close';
  return 'neutral';
}

export function alignedWithHysteresis(error, wasAligned, qualityLevel) {
  if (qualityLevel === 'low' || !Number.isFinite(error)) return false;
  return wasAligned ? Math.abs(error) <= 5 : Math.abs(error) <= 2;
}

export function headingQuality(accuracy, source = 'unknown', quality = null) {
  if (quality === 'high') return { level: 'high', label: 'גבוה', source, quality };
  if (quality === 'medium') return { level: 'medium', label: 'בינוני', source, quality };
  if (quality === 'low') return { level: 'low', label: 'נמוך', source, quality };
  if (quality === 'unreliable') return { level: 'low', label: 'נמוך', source, quality };
  if (source === 'orientation' || !Number.isFinite(accuracy) || accuracy < 0) return { level: 'low', label: 'נמוך', source };
  if (accuracy <= 10) return { level: 'high', label: 'גבוה', source };
  if (accuracy <= 25) return { level: 'medium', label: 'בינוני', source };
  return { level: 'low', label: 'נמוך', source };
}

export function normalizeHeadingSample(detail = {}) {
  const heading = Number(detail.trueHeading ?? detail.magneticHeading ?? detail.heading);
  if (!Number.isFinite(heading) || heading < 0) return null;
  const source = detail.source || (detail.trueHeading != null ? 'true' : 'magnetic');
  const accuracy = Number(detail.headingAccuracy);
  if (!detail.quality && source !== 'orientation' && Number.isFinite(accuracy) && accuracy < 0) return null;
  return {
    heading: normalizeDegrees(heading),
    source,
    quality: headingQuality(Number(detail.headingAccuracy), source, detail.quality),
    timestamp: Number.isFinite(Number(detail.timestamp)) ? Number(detail.timestamp) : null,
  };
}

export function smoothHeading(previous, sample, elapsedMs = 50) {
  if (!Number.isFinite(sample)) return previous;
  if (!Number.isFinite(previous)) return normalizeDegrees(sample);
  const delta = angularDifference(sample, previous);
  const elapsed = Math.max(8, Math.min(elapsedMs, 250));
  const speed = Math.abs(delta) / (elapsed / 1000);
  const timeConstant = speed > 90 ? 0.11 : speed > 25 ? 0.2 : 0.42;
  const alpha = 1 - Math.exp(-elapsed / 1000 / timeConstant);
  return normalizeDegrees(previous + delta * alpha);
}

export function circularAverage(values) {
  const valid = values.filter(value => Number.isFinite(value));
  if (!valid.length) return null;
  const x = valid.reduce((sum, value) => sum + Math.cos(toRadians(value)), 0) / valid.length;
  const y = valid.reduce((sum, value) => sum + Math.sin(toRadians(value)), 0) / valid.length;
  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
}

export function headingFromOrientation(event) {
  if (Number.isFinite(event?.webkitCompassHeading)) return normalizeDegrees(event.webkitCompassHeading);
  if (!Number.isFinite(event?.alpha)) return null;
  return normalizeDegrees(360 - event.alpha);
}
// The target by where one stands — שולחן ערוך, אורח חיים צד, א (ברכות ל ע״א): outside the Land, toward Eretz Yisrael
// (and so toward Jerusalem and the Mikdash); in the Land, toward Jerusalem; in Jerusalem, toward the Mikdash; at the
// Mikdash, toward the Holy of Holies. The Kotel (the western retaining wall) is where one stands, facing it and so
// the Holy of Holies — so near Jerusalem the compass shows the Kotel as a landmark beside the target, never instead of it.
// Coordinates: Wikipedia (checked 2026-09-30) — Western Wall 31.7767, 35.2345; Foundation Stone (Dome of the Rock)
// 31.7780, 35.2354, where the Holy of Holies is identified by the accepted view.
export const KOTEL = Object.freeze({ name: 'הכותל המערבי', latitude: 31.7767, longitude: 35.2345, source: 'Wikipedia: Western Wall, 31.7767 N 35.2345 E' });
export const KODESH_HAKODASHIM = Object.freeze({ name: 'קודש הקודשים', latitude: 31.778, longitude: 35.2354, source: 'Wikipedia: Foundation Stone (Dome of the Rock), 31.7780 N 35.2354 E' });
export const JERUSALEM_RADIUS_KM = 12;
export const MIKDASH_AREA_KM = 0.6;

export function prayerTarget(location, { inEretzYisrael = null } = {}) {
  const distance = distanceKm(location, KODESH_HAKODASHIM);
  if (distance === null) return { tier: 'unknown', target: JERUSALEM_TARGET, label: 'ירושלים', landmark: null, distance: null };
  if (distance <= MIKDASH_AREA_KM) return { tier: 'mikdash', target: KODESH_HAKODASHIM, label: 'קודש הקודשים', landmark: KOTEL, distance, note: 'ליד הכותל ובעיר העתיקה: הכיוון לקודש הקודשים. הכותל מסומן על המצפן.' };
  if (distance <= JERUSALEM_RADIUS_KM) return { tier: 'jerusalem', target: KODESH_HAKODASHIM, label: 'מקום המקדש', landmark: KOTEL, distance, note: 'בירושלים: הכיוון למקום המקדש וקודש הקודשים; הכותל המערבי מסומן על המצפן.' };
  const inLand = inEretzYisrael ?? Boolean(location?.il);
  return { tier: inLand ? 'israel' : 'abroad', target: JERUSALEM_TARGET, label: 'ירושלים', landmark: null, distance: distanceKm(location), note: inLand ? 'בארץ ישראל: הכיוון לירושלים ולמקום המקדש.' : 'בחוץ לארץ: הכיוון לארץ ישראל, לירושלים ולמקום המקדש.' };
}
