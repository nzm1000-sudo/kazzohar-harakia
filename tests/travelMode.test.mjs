import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TRAVEL_STORAGE_KEY, deletePack, deleteTrip, duplicateTrip, emptyTravel, getPack, getTrip,
  listPlaces, loadTravel, migrate, removePlace, savePack, savePlace, saveTravel, setActiveTrip, upsertTrip,
} from '../src/services/travelStorage.mjs';
import {
  datelineAssessment, durationLabel, fastOverlaps, formatZoned, offsetLabel, polarAssessment,
  restOverlaps, tripStatus, tripTimeline, zoneOffsetMinutes, zonedTimeToInstant,
} from '../src/services/travelPlan.mjs';
import { buildPack, estimatePack, formatBytes, packSelection, packStatus } from '../src/services/travelPack.mjs';
import { buildRabbiPack, rabbiPackText } from '../src/services/rabbiPack.mjs';
import { CAUTIONS, OFFLINE_MESSAGE, UNAVAILABLE_MESSAGE, createNearbyService, normalizeResults } from '../src/services/nearbyServices.mjs';
import { TEFILAT_HADERECH, tefilatHaderechPractical } from '../src/services/tefilatHaderech.mjs';
import { REVIEW_STATES } from '../src/services/forgottenAdditions.mjs';
import { CITIES, resolveLocationMetadata } from '../src/services.mjs';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    raw: map,
  };
}

const telAviv = { name: 'תל אביב', latitude: 32.08, longitude: 34.78, tzid: 'Asia/Jerusalem' };
const london = { name: 'לונדון', latitude: 51.51, longitude: -0.13, tzid: 'Europe/London' };
const tokyo = { name: 'טוקיו', latitude: 35.68, longitude: 139.69, tzid: 'Asia/Tokyo' };
const auckland = { name: 'אוקלנד', latitude: -36.85, longitude: 174.76, tzid: 'Pacific/Auckland' };
const tromso = { name: 'טרומסו', latitude: 69.65, longitude: 18.96, tzid: 'Europe/Oslo' };

const baseTrip = {
  id: 'trip-1', origin: telAviv, destination: london,
  departureDate: '2026-10-18', departureTime: '07:30',
  arrivalDate: '2026-10-18', arrivalTime: '11:10',
  transport: 'flight', flightNumber: 'LY315',
};

test('trips persist across reloads in their own namespace', () => {
  const storage = memoryStorage();
  storage.setItem('companion-settings-v2', '{"keep":true}');
  saveTravel(upsertTrip(loadTravel(storage), baseTrip), storage);

  const reloaded = loadTravel(storage);
  assert.equal(reloaded.trips.length, 1);
  assert.equal(reloaded.trips[0].destination.name, 'לונדון');
  assert.equal(reloaded.trips[0].flightNumber, 'LY315');
  assert.equal(storage.getItem('companion-settings-v2'), '{"keep":true}', 'existing settings are untouched');
  assert.ok(storage.getItem(TRAVEL_STORAGE_KEY));
});

test('selected cities resolve coordinates and timezone before storage', async () => {
  const tokyoResult = await resolveLocationMetadata(CITIES.find(city => city.name === 'טוקיו'));
  assert.equal(tokyoResult.tzid, 'Asia/Tokyo');
  assert.ok(Number.isFinite(tokyoResult.latitude));
  assert.ok(Number.isFinite(tokyoResult.longitude));

  const searchedResult = await resolveLocationMetadata(
    { name: 'עיר בדיקה', latitude: '48.8566', longitude: '2.3522' },
    undefined,
    async (latitude, longitude, fallback) => {
      assert.equal(latitude, 48.8566);
      assert.equal(longitude, 2.3522);
      assert.equal(fallback, null, 'a destination must not inherit the device timezone');
      return 'Europe/Paris';
    },
  );
  assert.equal(searchedResult.tzid, 'Europe/Paris');
  assert.equal(searchedResult.latitude, 48.8566);
});

test('trips can be edited, duplicated and deleted', () => {
  let state = upsertTrip(emptyTravel(), baseTrip);
  state = upsertTrip(state, { ...baseTrip, destination: { ...london, name: 'מנצ׳סטר' } });
  assert.equal(state.trips.length, 1, 'editing does not create a second trip');
  assert.equal(getTrip(state, 'trip-1').destination.name, 'מנצ׳סטר');

  state = duplicateTrip(state, 'trip-1');
  assert.equal(state.trips.length, 2);
  assert.notEqual(state.trips[1].id, 'trip-1');

  state = deleteTrip(state, 'trip-1');
  assert.equal(getTrip(state, 'trip-1'), null);
});

test('return time is additive and legacy trips still load', () => {
  const legacy = migrate({ version: 1, trips: [baseTrip] });
  assert.equal(legacy.trips[0].returnTime, null);
  const updated = upsertTrip(legacy, { ...legacy.trips[0], returnDate: '2026-10-25', returnTime: '14:20', notes: '' });
  assert.equal(getTrip(updated, 'trip-1').returnTime, '14:20');
  assert.equal(getTrip(updated, 'trip-1').notes, null, 'optional details do not block normalization');
});

test('travel mode activates only through an explicit call', () => {
  let state = upsertTrip(emptyTravel(), baseTrip);
  assert.equal(state.activeTripId, null, 'creating a trip does not activate travel mode');
  state = setActiveTrip(state, 'trip-1');
  assert.equal(state.activeTripId, 'trip-1');
  assert.equal(setActiveTrip(state, 'missing').activeTripId, null);
});

test('storage migration rejects unknown versions and orphaned records', () => {
  assert.deepEqual(migrate(null).trips, []);
  assert.deepEqual(migrate({ version: 99, trips: [baseTrip] }).trips, []);
  const orphaned = migrate({ version: 1, trips: [baseTrip], packs: { other: {} }, places: { other: [] }, activeTripId: 'other' });
  assert.deepEqual(Object.keys(orphaned.packs), []);
  assert.equal(orphaned.activeTripId, null);
});

test('timezone offsets follow IANA rules including daylight saving', () => {
  const summer = zoneOffsetMinutes(new Date('2026-07-01T12:00:00Z'), 'Europe/London');
  const winter = zoneOffsetMinutes(new Date('2026-12-01T12:00:00Z'), 'Europe/London');
  assert.equal(summer, 60, 'British Summer Time');
  assert.equal(winter, 0, 'Greenwich Mean Time');
  assert.notEqual(summer, winter, 'a stored fixed offset would be wrong half the year');

  assert.equal(zoneOffsetMinutes(new Date('2026-07-01T12:00:00Z'), 'Asia/Jerusalem'), 180);
  assert.equal(zoneOffsetMinutes(new Date('2026-12-01T12:00:00Z'), 'Asia/Jerusalem'), 120);
  assert.equal(zoneOffsetMinutes(new Date('bad'), 'Europe/London'), null);
});

test('wall clock times convert to the correct absolute instant', () => {
  assert.equal(zonedTimeToInstant('2026-10-18', '07:30', 'Asia/Jerusalem').toISOString(), '2026-10-18T04:30:00.000Z');
  assert.equal(zonedTimeToInstant('2026-12-18', '07:30', 'Asia/Jerusalem').toISOString(), '2026-12-18T05:30:00.000Z');
  assert.equal(zonedTimeToInstant('bad-date', '07:30', 'Asia/Jerusalem'), null);
});

test('the trip timeline reports both local times and the difference', () => {
  const timeline = tripTimeline(baseTrip);
  assert.equal(timeline.valid, true);
  assert.equal(timeline.originLocal.date, '18.10.2026');
  assert.equal(timeline.originLocal.time, '07:30');
  assert.equal(timeline.destinationLocal.date, '18.10.2026');
  assert.equal(timeline.destinationLocal.time, '11:10');
  assert.equal(timeline.timeDifferenceMinutes, -120, 'London is two hours behind Jerusalem in October');
  assert.equal(timeline.durationMinutes, 340);
  assert.equal(durationLabel(340), '5 שעות ו־40 דקות');
  assert.equal(offsetLabel(-120), '-02:00');
});

test('origin and destination civil dates can differ across a long flight', () => {
  const longHaul = { ...baseTrip, destination: auckland, arrivalDate: '2026-10-20', arrivalTime: '06:00' };
  const timeline = tripTimeline(longHaul);
  assert.notEqual(timeline.departure.slice(0, 10), timeline.arrival.slice(0, 10));
  assert.equal(timeline.destinationLocal.date, '20.10.2026');
});

test('visible dates keep the D.M.YYYY format', () => {
  const local = formatZoned(new Date('2026-10-18T09:10:00Z'), 'Europe/London');
  assert.match(local.date, /^\d{1,2}\.\d{1,2}\.\d{4}$/);
  assert.equal(local.date, '18.10.2026');
});

test('halachic residence stays explicit and independent of the destination', () => {
  const pack = buildRabbiPack({
    trip: baseTrip,
    settings: { halachicResidenceStatus: 'israel', location: { name: 'תל אביב', tzid: 'Asia/Jerusalem' } },
  });
  assert.equal(pack.residence.status, 'israel');
  assert.equal(pack.residence.label, 'תושב ישראל');
  assert.equal(pack.destination.name, 'לונדון');
  assert.ok(pack.ambiguities.includes('תושב ישראל השוהה בחו״ל'));
  assert.match(rabbiPackText(pack), /מעמד שהוגדר: תושב ישראל/);
});

test('Shabbat overlap is detected and reported without a decision', () => {
  const items = [
    { category: 'candles', date: '2026-10-16T17:50:00+03:00' },
    { category: 'havdalah', date: '2026-10-17T18:50:00+03:00' },
  ];
  const overlapping = { ...baseTrip, departureDate: '2026-10-16', departureTime: '17:00', arrivalDate: '2026-10-16', arrivalTime: '21:00' };
  const overlaps = restOverlaps(overlapping, items);
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].kind, 'shabbat');
  assert.ok(overlaps[0].entry);
  assert.deepEqual(restOverlaps(baseTrip, items), [], 'a trip outside the window is not flagged');
});

test('Yom Tov overlap uses the same candle and havdalah pairing', () => {
  const items = [
    { category: 'candles', date: '2026-10-02T18:00:00+03:00', title: 'Candle lighting Yom Tov' },
    { category: 'havdalah', date: '2026-10-04T19:00:00+03:00' },
  ];
  const trip = { ...baseTrip, departureDate: '2026-10-03', departureTime: '10:00', arrivalDate: '2026-10-03', arrivalTime: '14:00' };
  const overlaps = restOverlaps(trip, items);
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].kind, 'yom-tov');
});

test('fast days inside the trip range are surfaced without medical advice', () => {
  const items = [{ subcat: 'fast', date: '2026-10-18', title: 'Tzom Gedaliah', hebrew: 'צום גדליה' }];
  const fasts = fastOverlaps(baseTrip, items);
  assert.equal(fasts.length, 1);
  assert.equal(fasts[0].name, 'צום גדליה');
  assert.deepEqual(fastOverlaps({ ...baseTrip, departureDate: '2026-11-01', arrivalDate: '2026-11-01' }, items), []);
});

test('dateline candidates are flagged but never ruled on', () => {
  const pacific = { ...baseTrip, origin: auckland, destination: { ...telAviv, name: 'הונולולו', longitude: -157.86 } };
  const assessment = datelineAssessment(pacific);
  assert.equal(assessment.candidate, true);
  assert.equal(assessment.crossesAntimeridian, true);
  assert.match(assessment.reason, /עשוי לעורר/);
  assert.equal('ruling' in assessment, false, 'no ruling field is ever produced');

  assert.equal(datelineAssessment(baseTrip).candidate, false);
  assert.equal(datelineAssessment({ ...baseTrip, destination: tokyo }).candidate, false);
  assert.equal(datelineAssessment({ origin: {}, destination: {} }).candidate, false);
});

test('polar conditions are detected and no surrogate zmanim are invented', () => {
  const midnightSun = polarAssessment({ latitude: tromso.latitude, solar: { sunrise: null, sunset: null } });
  assert.equal(midnightSun.flagged, true);
  assert.equal(midnightSun.missingSunrise, true);
  assert.match(midnightSun.reason, /בירור הלכתי מיוחד/);
  assert.equal('sunrise' in midnightSun, false, 'no substitute sunrise is produced');

  const extreme = polarAssessment({
    latitude: tromso.latitude,
    solar: { sunrise: '2026-12-18T10:30:00Z', sunset: '2026-12-18T11:30:00Z' },
  });
  assert.equal(extreme.flagged, true);
  assert.equal(extreme.extreme, true);

  const normal = polarAssessment({
    latitude: 32.08,
    solar: { sunrise: '2026-10-18T03:00:00Z', sunset: '2026-10-18T15:00:00Z' },
  });
  assert.equal(normal.flagged, false);
  assert.equal(polarAssessment({}).flagged, false);
});

test('offline pack contains only trip relevant content and reports its size', () => {
  const estimate = estimatePack(baseTrip, { overlapsRest: false, hasSavedSources: false, hasTalmudCache: false });
  const ids = estimate.items.map(item => item.id);
  assert.ok(ids.includes('tefilat-haderech'));
  assert.ok(ids.includes('destination-zmanim'));
  assert.ok(!ids.includes('talmud-recent'), 'nothing is bulk downloaded');
  assert.ok(!ids.includes('shabbat-page'));
  assert.match(estimate.label, /KB|MB/);

  const full = packSelection(baseTrip, { overlapsRest: true, hasSavedSources: true, hasTalmudCache: true });
  assert.ok(full.length > estimate.items.length);
  assert.equal(formatBytes(0), '0 KB');
});

test('offline pack records its validity metadata and can be deleted alone', () => {
  const pack = buildPack(baseTrip, {}, new Date('2026-10-01T00:00:00Z'));
  assert.equal(pack.tripId, 'trip-1');
  assert.equal(pack.destination.tzid, 'Europe/London');
  assert.equal(pack.range.from, '2026-10-18');
  assert.ok(pack.generatedAt);
  assert.ok(pack.contentVersion >= 1);

  let state = savePack(upsertTrip(emptyTravel(), baseTrip), 'trip-1', pack);
  state = savePlace(state, 'trip-1', { name: 'בית כנסת מרכזי', address: 'לונדון' });
  assert.ok(getPack(state, 'trip-1'));
  state = deletePack(state, 'trip-1');
  assert.equal(getPack(state, 'trip-1'), null);
  assert.equal(listPlaces(state, 'trip-1').length, 1, 'deleting the pack keeps saved places');
});

test('offline pack spans departure through return for simplified trips', () => {
  const simpleTrip = {
    ...baseTrip,
    arrivalDate: '', arrivalTime: '',
    returnDate: '2026-10-25', returnTime: '14:20',
  };
  const pack = buildPack(simpleTrip);
  assert.deepEqual(pack.range, { from: '2026-10-18', to: '2026-10-25' });
  assert.equal(pack.days.length, 8);
  assert.deepEqual(packStatus(simpleTrip, pack), { exists: true, stale: false, reasons: [] });
  assert.ok(packStatus({ ...simpleTrip, returnDate: '2026-10-26' }, pack).reasons.includes('תאריך החזרה השתנה'));
});

test('editing trip dates or timezone marks the pack stale', () => {
  const pack = buildPack(baseTrip);
  assert.deepEqual(packStatus(baseTrip, pack), { exists: true, stale: false, reasons: [] });

  const moved = packStatus({ ...baseTrip, departureDate: '2026-10-20' }, pack);
  assert.equal(moved.stale, true);
  assert.ok(moved.reasons.some(reason => /תאריך היציאה/.test(reason)));

  const rezoned = packStatus({ ...baseTrip, destination: tokyo }, pack);
  assert.equal(rezoned.stale, true);
  assert.equal(packStatus(baseTrip, null).exists, false);
});

test('saved nearby places persist offline with their source and caveat', () => {
  const storage = memoryStorage();
  let state = upsertTrip(loadTravel(storage), baseTrip);
  state = savePlace(state, 'trip-1', { name: 'מקווה מרכזי', category: 'מקווה', address: 'לונדון', source: 'הוזן ידנית' });
  saveTravel(state, storage);

  const reloaded = loadTravel(storage);
  const places = listPlaces(reloaded, 'trip-1');
  assert.equal(places.length, 1);
  assert.equal(places[0].source, 'הוזן ידנית');
  assert.ok(places[0].savedAt);
  assert.equal(listPlaces(removePlace(reloaded, 'trip-1', places[0].id), 'trip-1').length, 0);
});

test('nearby search never fabricates results', async () => {
  const offline = createNearbyService({ online: () => false });
  assert.deepEqual((await offline.search({ latitude: 51.5, longitude: -0.1, category: 'kosher' })), { status: 'offline', message: OFFLINE_MESSAGE, results: [] });

  const noProvider = createNearbyService({ online: () => true });
  const unavailable = await noProvider.search({ latitude: 51.5, longitude: -0.1, category: 'synagogue' });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.message, UNAVAILABLE_MESSAGE);
  assert.deepEqual(unavailable.results, []);

  const failing = createNearbyService({ provider: async () => { throw new Error('network down'); } });
  const failed = await failing.search({ latitude: 51.5, longitude: -0.1, category: 'synagogue' });
  assert.equal(failed.status, 'error');
  assert.deepEqual(failed.results, []);
});

test('nearby results require an attributed source and carry cautions', async () => {
  const provider = async () => ([
    { name: 'בית כנסת א', address: 'רחוב א', source: 'ספריית קהילות', lastChecked: '2026-09-01' },
    { name: 'ללא מקור', address: 'רחוב ב' },
  ]);
  const service = createNearbyService({ provider });
  const response = await service.search({ latitude: 51.5, longitude: -0.1, category: 'synagogue' });
  assert.equal(response.results.length, 1, 'unattributed entries are dropped');
  assert.equal(response.results[0].source, 'ספריית קהילות');

  const kosher = normalizeResults([{ name: 'מסעדה', source: 'רשימת קהילה' }], 'kosher');
  assert.equal(kosher[0].caution, CAUTIONS.kosher);
  assert.match(CAUTIONS.eruv, /לאמת את מצב העירוב/);
});

test('Tefilat Haderech ships its text with sources and no auto ruling', () => {
  assert.equal(TEFILAT_HADERECH.reviewState, REVIEW_STATES.SOURCE_VERIFIED);
  assert.equal(tefilatHaderechPractical().practical, false);
  assert.match(tefilatHaderechPractical().notice, /דורשים בירור לפי תנאי הדרך/);
  assert.ok(TEFILAT_HADERECH.text.length >= 3);
  assert.ok(TEFILAT_HADERECH.source.primary);
  assert.ok(TEFILAT_HADERECH.openQuestions.length >= 3, 'disputed details stay open');
});

test('the rabbi pack is facts only and exports a clean Hebrew summary', () => {
  const items = [
    { category: 'candles', date: '2026-10-16T17:50:00+03:00' },
    { category: 'havdalah', date: '2026-10-17T18:50:00+03:00' },
  ];
  const pack = buildRabbiPack({
    trip: { ...baseTrip, destination: auckland, arrivalDate: '2026-10-20', arrivalTime: '06:00' },
    settings: { halachicResidenceStatus: 'israel', location: { name: 'תל אביב', tzid: 'Asia/Jerusalem' } },
    items,
    destinationSolar: null,
  });
  assert.ok(pack.timestamps.departureUTC);
  assert.ok(pack.timestamps.arrivalUTC);
  assert.equal(pack.civilDateChange.changed, true);
  assert.ok(pack.timezoneChange.label);
  assert.equal('conclusion' in pack, false, 'no conclusion is generated');
  assert.equal('ruling' in pack, false);

  const text = rabbiPackText(pack);
  assert.match(text, /נתונים לשאלה לרב/);
  assert.match(text, /קואורדינטות: -36\.85, 174\.76/);
  assert.match(text, /אזור זמן: Pacific\/Auckland/);
  assert.match(text, /חותם UTC ביציאה/);
  assert.match(text, /המסמך מכיל נתונים בלבד ואינו כולל מסקנה הלכתית/);
  assert.equal(rabbiPackText(null), '');
  assert.equal(buildRabbiPack({ trip: null }), null);
});

test('trip status reflects the current moment', () => {
  assert.equal(tripStatus(baseTrip, new Date('2026-10-01T00:00:00Z')), 'upcoming');
  assert.equal(tripStatus(baseTrip, new Date('2026-10-18T06:00:00Z')), 'active');
  assert.equal(tripStatus(baseTrip, new Date('2026-11-01T00:00:00Z')), 'past');
  assert.equal(tripStatus({ ...baseTrip, departureDate: '' }, new Date()), 'draft');
});
