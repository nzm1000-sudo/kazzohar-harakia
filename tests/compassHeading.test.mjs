import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { androidSampleDetail, applyDeclination, CALIBRATION_HINT, compassPointName, headingFromOrientationEvent, needsCalibration, selectHeadingSource, staticDirectionText } from '../src/services/compassHeading.mjs';
import { headingQuality, normalizeHeadingSample, smoothHeading } from '../src/services/prayerCompass.mjs';

test('heading source: Android native plugin first, the iOS bridge kept, the browser as the fallback', () => {
  assert.equal(selectHeadingSource({ platform: 'android', hasAndroidPlugin: true, hasDeviceOrientation: true }), 'android-native');
  assert.equal(selectHeadingSource({ platform: 'android', hasAndroidPlugin: false, hasDeviceOrientation: true }), 'web', 'an older APK without the plugin');
  assert.equal(selectHeadingSource({ platform: 'ios', hasIOSBridge: true, hasDeviceOrientation: true }), 'ios-native');
  assert.equal(selectHeadingSource({ platform: 'ios', hasIOSBridge: false, hasDeviceOrientation: true }), 'web');
  assert.equal(selectHeadingSource({ platform: 'web', hasDeviceOrientation: true }), 'web');
  assert.equal(selectHeadingSource({ platform: 'web' }), 'none');
  assert.equal(selectHeadingSource({ platform: 'web', hasAndroidPlugin: true, hasDeviceOrientation: true }), 'web', 'the plugin only on Android');
});

test('declination turns magnetic into true north, across 0/360', () => {
  assert.equal(applyDeclination(100, 4.5), 104.5);
  assert.equal(applyDeclination(358, 5), 3);
  assert.equal(applyDeclination(2, -5), 357);
  assert.equal(applyDeclination(90, undefined), 90);
  assert.equal(applyDeclination(NaN, 3), null);
});

test('an Android sample becomes a true-north detail with the sensor status as its quality', () => {
  const detail = androidSampleDetail({ magneticHeading: 358, trueHeading: 2.5, declination: 4.5, quality: 'medium', timestamp: 9 });
  assert.equal(detail.trueHeading, 2.5);
  assert.equal(detail.source, 'true');
  const sample = normalizeHeadingSample(detail);
  assert.equal(sample.heading, 2.5);
  assert.equal(sample.quality.level, 'medium');
  const noTrue = androidSampleDetail({ magneticHeading: 10, declination: 3, quality: 'high' });
  assert.equal(noTrue.trueHeading, 13, 'computed from the declination when only it came');
  const magnetic = androidSampleDetail({ magneticHeading: 10, quality: 'bogus' });
  assert.equal(magnetic.source, 'magnetic');
  assert.equal(magnetic.quality, 'unreliable');
  assert.equal(normalizeHeadingSample(magnetic).heading, 10);
  assert.equal(androidSampleDetail({}), null);
});

test('browser events: only a reading with north counts (never a relative deviceorientation alpha)', () => {
  assert.equal(headingFromOrientationEvent({ type: 'deviceorientation', webkitCompassHeading: 72, alpha: 10 }), 72, 'iOS Safari');
  assert.equal(headingFromOrientationEvent({ type: 'deviceorientationabsolute', alpha: 90, absolute: true }), 270);
  assert.equal(headingFromOrientationEvent({ type: 'deviceorientation', alpha: 90, absolute: true }), 270);
  assert.equal(headingFromOrientationEvent({ type: 'deviceorientation', alpha: 90, absolute: false }), null, 'relative: ignored');
  assert.equal(headingFromOrientationEvent({ type: 'deviceorientation', alpha: 90 }), null);
  assert.equal(headingFromOrientationEvent({ type: 'deviceorientationabsolute', alpha: 0 }, 90), 90, 'landscape screen');
  assert.equal(headingFromOrientationEvent({ type: 'deviceorientationabsolute', alpha: null }), null);
  assert.equal(headingFromOrientationEvent(null), null);
});

test('smoothing crosses north the short way in both directions and settles on the new heading', () => {
  let heading = 355;
  for (let step = 0; step < 60; step += 1) {
    heading = smoothHeading(heading, 5, 50);
    assert.ok(heading >= 355 || heading <= 5, `stays in the short arc (${heading})`);
  }
  assert.ok(Math.abs(heading - 5) < 0.5);
  heading = 3;
  for (let step = 0; step < 60; step += 1) heading = smoothHeading(heading, 350, 50);
  assert.ok(Math.abs(heading - 350) < 0.5);
});

test('calibration is asked for only when the sensor says it is unreliable or low', () => {
  assert.equal(needsCalibration(headingQuality(-1, 'true', 'unreliable')), true);
  assert.equal(needsCalibration(headingQuality(-1, 'true', 'low')), true);
  assert.equal(needsCalibration(headingQuality(40, 'true')), true, 'iOS accuracy worse than 25°');
  assert.equal(needsCalibration(headingQuality(-1, 'true', 'high')), false);
  assert.equal(needsCalibration(headingQuality(-1, 'orientation')), false, 'a browser reading has no accuracy to judge');
  assert.equal(CALIBRATION_HINT, 'יש לכייל את המצפן — הזז את הטלפון בצורת 8');
});

test('without a live compass the direction is told from north in words', () => {
  assert.equal(compassPointName(128), 'דרום-מזרח');
  assert.equal(compassPointName(359), 'צפון');
  assert.match(staticDirectionText(128.4), /כיוון ירושלים: 128° מהצפון \(דרום-מזרח\)/);
  assert.match(staticDirectionText(128.4), /פנו 128° בכיוון השעון/);
  assert.match(staticDirectionText(null), /בחרו מיקום/);
});

test('the page wires the plugin, the watchdog, the calibration request and the static direction', () => {
  const page = readFileSync(new URL('../src/pages/PrayerCompass.jsx', import.meta.url), 'utf8');
  assert.match(page, /const KZCompass = registerPlugin\('KZCompass'\);/);
  assert.match(page, /KZCompass\.addListener\('heading'/);
  assert.match(page, /KZCompass\.start\(locationArgs\(location\)\)/);
  assert.match(page, /KZCompass\.stop\(\)/);
  assert.match(page, /action: 'location' \}, settings\.location\)/, 'the declination follows the location');
  assert.match(page, /armWatchdog\(\)/);
  assert.match(page, /needsCalibration\(quality\) && sensorState === 'ready' && <p className="prayer-compass-hint">\{CALIBRATION_HINT\}<\/p>/);
  assert.match(page, /sensorState === 'unavailable' && <p className="prayer-compass-hint">\{staticDirectionText\(target\)\}<\/p>/);
  assert.match(page, /window\.webkit\.messageHandlers\.kzHeading\.postMessage/, 'iOS path kept');
  assert.doesNotMatch(page, /window\.KZHeading/);
});
