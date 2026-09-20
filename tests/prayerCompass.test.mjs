import test from 'node:test';
import assert from 'node:assert/strict';
import { alignedWithHysteresis, alignmentZone, angularDifference, circularAverage, compassState, distanceKm, headingFromOrientation, headingQuality, initialBearing, isEastSector, JERUSALEM_TARGET, prayerDirectionLabel, smoothHeading } from '../src/services/prayerCompass.mjs';

const places = {
  'Tel Aviv': { latitude: 32.0853, longitude: 34.7818 },
  Netivot: { latitude: 31.42, longitude: 34.59 },
  London: { latitude: 51.5074, longitude: -0.1278 },
  'New York': { latitude: 40.7128, longitude: -74.006 },
  Tokyo: { latitude: 35.6762, longitude: 139.6503 },
};

test('bearing and distance use the central Temple Mount target', () => {
  assert.ok(Math.abs(initialBearing(places['Tel Aviv']) - 128.4) < 1);
  assert.ok(Math.abs(initialBearing(places.Netivot) - 56.8) < 1);
  assert.ok(Math.abs(initialBearing(places.London) - 113.6) < 1);
  assert.ok(Math.abs(initialBearing(places['New York']) - 54.1) < 1);
  assert.ok(Math.abs(initialBearing(places.Tokyo) - 303.8) < 1);
  assert.ok(distanceKm(places.London) > 3500 && distanceKm(places.London) < 3700);
  assert.equal(initialBearing(JERUSALEM_TARGET), 0);
});

test('angular difference handles 359 degree and zero degree wraparound', () => {
  assert.equal(angularDifference(1, 359), 2);
  assert.equal(angularDifference(359, 1), -2);
});

test('compass state uses a five degree alignment tolerance and turn direction', () => {
  assert.equal(compassState(100, 95).status, 'aligned');
  assert.equal(compassState(100, 90).status, 'adjust');
  assert.equal(compassState(100, 90).direction, 'right');
  assert.equal(compassState(90, 100).direction, 'left');
  assert.equal(compassState(null, 100).status, 'unavailable');
});

test('circular averaging does not jump at north', () => {
  const average = circularAverage([359, 0, 1]);
  assert.ok(average < 1 || average > 359);
});

test('orientation heading prefers iOS compass heading and handles web alpha', () => {
  assert.equal(headingFromOrientation({ webkitCompassHeading: 72, alpha: 288 }), 72);
  assert.equal(headingFromOrientation({ alpha: 90 }), 270);
  assert.equal(headingFromOrientation({}), null);
});

test('heading quality rejects invalid accuracy and distinguishes true north sources', () => {
  assert.equal(headingQuality(-1, 'true').level, 'low');
  assert.equal(headingQuality(8, 'true').level, 'high');
  assert.equal(headingQuality(18, 'magnetic').level, 'medium');
  assert.equal(headingQuality(null, 'orientation').level, 'low');
});

test('adaptive smoothing follows the shortest path across north', () => {
  const next = smoothHeading(359, 1, 50);
  assert.ok(next < 1 || next > 359);
  assert.ok(Math.abs(angularDifference(next, 359)) < 2);
});

test('alignment zones become progressively stronger', () => {
  assert.equal(alignmentZone(30), 'neutral');
  assert.equal(alignmentZone(15), 'close');
  assert.equal(alignmentZone(8), 'approaching');
  assert.equal(alignmentZone(4), 'near');
  assert.equal(alignmentZone(1), 'aligned');
});

test('alignment hysteresis prevents flicker around the two degree entry point', () => {
  assert.equal(alignedWithHysteresis(2, false, 'high'), true);
  assert.equal(alignedWithHysteresis(4, true, 'high'), true);
  assert.equal(alignedWithHysteresis(6, true, 'high'), false);
  assert.equal(alignedWithHysteresis(1, true, 'low'), false);
});

test('mizrach label follows the real Jerusalem bearing', () => {
  assert.equal(isEastSector(90), true);
  assert.equal(prayerDirectionLabel(100), 'מזרח · ירושלים');
  assert.equal(isEastSector(128), false);
  assert.equal(prayerDirectionLabel(303), 'ירושלים');
});