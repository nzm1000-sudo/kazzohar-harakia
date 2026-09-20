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