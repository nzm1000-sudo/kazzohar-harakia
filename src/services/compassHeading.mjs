// מצפן תפילה — where the live heading comes from, and how a raw reading becomes one the dial can trust.
//   • Android app: the app's KZCompass plugin (SensorManager: rotation vector → accelerometer+magnetometer → legacy
//     orientation), already corrected to true north with the magnetic declination at the app's location.
//   • iOS app: the existing CLHeading bridge (window.webkit.messageHandlers.kzHeading), unchanged.
//   • Browser: deviceorientationabsolute / iOS webkitCompassHeading. A plain (relative) deviceorientation event is never
//     taken as a heading: its alpha starts wherever the phone happened to point, which is what made the needle drift.
// Pure functions only (no DOM access except through the arguments), so the pipeline is tested in node.

const normalize = value => ((Number(value) % 360) + 360) % 360;

export const CALIBRATION_HINT = 'יש לכייל את המצפן — הזז את הטלפון בצורת 8';
export const NO_MAGNETOMETER_MESSAGE = 'במכשיר זה אין חיישן מצפן (מגנטומטר), ולכן אין חיווי חי.';
export const NO_SIGNAL_MESSAGE = 'המצפן אינו מוסר כיוון במכשיר זה.';

export function selectHeadingSource({ platform = 'web', hasAndroidPlugin = false, hasIOSBridge = false, hasDeviceOrientation = false } = {}) {
  if (platform === 'android' && hasAndroidPlugin) return 'android-native';
  if (platform === 'ios' && hasIOSBridge) return 'ios-native';
  if (hasIOSBridge) return 'ios-native';
  if (hasDeviceOrientation) return 'web';
  return 'none';
}

export function applyDeclination(magneticHeading, declination) {
  if (!Number.isFinite(magneticHeading)) return null;
  return normalize(magneticHeading + (Number.isFinite(declination) ? declination : 0));
}

// A native Android sample → the detail normalizeHeadingSample() reads. True north when the declination was known.
export function androidSampleDetail(data = {}) {
  const magnetic = Number(data.magneticHeading);
  if (!Number.isFinite(magnetic)) return null;
  const declination = Number(data.declination);
  const hasTrue = data.trueHeading != null && Number.isFinite(Number(data.trueHeading));
  const trueHeading = hasTrue ? normalize(Number(data.trueHeading)) : Number.isFinite(declination) ? applyDeclination(magnetic, declination) : null;
  return {
    trueHeading,
    magneticHeading: normalize(magnetic),
    source: trueHeading === null ? 'magnetic' : 'true',
    quality: ['high', 'medium', 'low', 'unreliable'].includes(data.quality) ? data.quality : 'unreliable',
    headingAccuracy: -1,
    timestamp: data.timestamp,
    available: true,
  };
}

export function screenAngle(win = globalThis) {
  const angle = Number(win?.screen?.orientation?.angle ?? win?.orientation ?? 0);
  return Number.isFinite(angle) ? angle : 0;
}

// Browser orientation events → heading of the screen's top edge, or null when the event carries no north.
export function headingFromOrientationEvent(event, angle = 0) {
  if (!event) return null;
  if (Number.isFinite(event.webkitCompassHeading)) return normalize(event.webkitCompassHeading);
  const absolute = event.type === 'deviceorientationabsolute' || event.absolute === true;
  if (!absolute || !Number.isFinite(event.alpha)) return null;
  return normalize(360 - event.alpha + (Number(angle) || 0));
}

// The figure-8 request only when the sensor itself says so (Android SENSOR_STATUS_* / iOS headingAccuracy); a browser
// reading carries no accuracy at all, which is not a reason to ask for calibration.
export function needsCalibration(quality) {
  if (quality?.quality === 'unreliable' || quality?.quality === 'low') return true;
  return quality?.level === 'low' && quality?.source !== 'orientation';
}

const POINTS = ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'];
export function compassPointName(bearing) {
  if (!Number.isFinite(bearing)) return null;
  return POINTS[Math.round(normalize(bearing) / 45) % 8];
}

// Without a live compass: the direction told in words, from north.
export function staticDirectionText(bearing) {
  if (!Number.isFinite(bearing)) return 'בחרו מיקום כדי לחשב את כיוון ירושלים.';
  const degrees = Math.round(normalize(bearing)) % 360;
  return `כיוון ירושלים: ${degrees}° מהצפון (${compassPointName(bearing)}). עמדו מול הצפון ופנו ${degrees}° בכיוון השעון.`;
}
