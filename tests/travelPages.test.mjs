import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyTravel, savePlace, setActiveTrip, upsertTrip, TRAVEL_STORAGE_KEY } from '../src/services/travelStorage.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const React = require('react');

const source = fileURLToPath(new URL('../src/pages/TravelMode.jsx', import.meta.url));
const compiled = buildSync({
  entryPoints: [source],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  loader: { '.jsx': 'jsx' },
  jsx: 'automatic',
  define: { 'import.meta.env.BASE_URL': '"/"' },
  external: ['react', 'react/jsx-runtime', 'react-dom/server'],
}).outputFiles[0].text;
const travelModule = new Module(source);
travelModule.filename = source;
travelModule.paths = Module._nodeModulePaths(root);
travelModule._compile(compiled, source);
const TravelMode = travelModule.exports.default;
const { parseTravelRoute } = travelModule.exports;

const trip = {
  id: 'trip-1',
  origin: { name: 'תל אביב', latitude: 32.08, longitude: 34.78, tzid: 'Asia/Jerusalem' },
  destination: { name: 'לונדון', latitude: 51.51, longitude: -0.13, tzid: 'Europe/London' },
  departureDate: '2026-10-18', departureTime: '07:30',
  arrivalDate: '2026-10-18', arrivalTime: '11:10',
  transport: 'flight', flightNumber: 'LY315',
};

const settings = { halachicResidenceStatus: 'israel', location: { name: 'תל אביב', tzid: 'Asia/Jerusalem', latitude: 32.08, longitude: 34.78 } };
const now = new Date('2026-10-01T09:00:00Z');

function withTravelState(state, run) {
  const map = new Map();
  if (state) map.set(TRAVEL_STORAGE_KEY, JSON.stringify(state));
  const originalStorage = globalThis.localStorage;
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: key => map.delete(key),
    },
  });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  try { return run(); }
  finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  }
}

const render = (route, state) => withTravelState(state, () => renderToStaticMarkup(
  React.createElement(TravelMode, { route, now, settings, items: [], onNav: () => {} }),
));

test('travel routes parse into stable views', () => {
  assert.deepEqual(parseTravelRoute('travel'), { view: 'list' });
  assert.deepEqual(parseTravelRoute('travel/new'), { view: 'new' });
  assert.deepEqual(parseTravelRoute('travel/trip-1'), { view: 'detail', tripId: 'trip-1' });
  assert.deepEqual(parseTravelRoute('travel/trip-1/offline'), { view: 'offline', tripId: 'trip-1' });
  assert.deepEqual(parseTravelRoute('travel/trip-1/flight'), { view: 'flight', tripId: 'trip-1' });
  assert.deepEqual(parseTravelRoute('travel/trip-1/nearby'), { view: 'nearby', tripId: 'trip-1' });
  assert.deepEqual(parseTravelRoute('travel/trip-1/rabbi'), { view: 'rabbi', tripId: 'trip-1' });
});

test('the trip list states that travel mode is manual', () => {
  const html = render('travel', emptyTravel());
  assert.match(html, /מצב נסיעה/);
  assert.match(html, /נדלק ידנית בלבד/);
  assert.match(html, /נסיעה חדשה/);
});

test('the new trip form offers every required field', () => {
  const html = render('travel/new', emptyTravel());
  for (const label of ['מוצא', 'יעד', 'תאריך יציאה', 'שעת יציאה', 'תאריך הגעה', 'שעת הגעה', 'תאריך חזרה', 'אופן הנסיעה', 'אזור זמן (IANA)']) {
    assert.ok(html.includes(label), `missing field ${label}`);
  }
  assert.match(html, /נשמרים במכשיר בלבד/);
});

test('trip detail shows current location and halachic status separately', () => {
  const state = upsertTrip(emptyTravel(), trip);
  const html = render('travel/trip-1', state);
  assert.match(html, /מיקום נוכחי/);
  assert.match(html, /מעמד הלכתי/);
  assert.match(html, /תושב ישראל/);
  assert.match(html, /לונדון/);
  assert.match(html, /אינו משתנה בעקבות נסיעה/);
  assert.match(html, /ציר הנסיעה/);
  assert.match(html, /תפילת הדרך/);
});

test('trip detail renders the timeline with both local times', () => {
  const html = render('travel/trip-1', upsertTrip(emptyTravel(), trip));
  assert.match(html, /18\.10\.2026/);
  assert.match(html, /07:30/);
  assert.match(html, /11:10/);
  assert.match(html, /5 שעות/);
});

test('the offline pack view shows an estimate before download', () => {
  const html = render('travel/trip-1/offline', upsertTrip(emptyTravel(), trip));
  assert.match(html, /גודל משוער/);
  assert.match(html, /הורד חבילת נסיעה/);
  assert.match(html, /תפילת הדרך/);
  assert.match(html, /התוכן הרגיל של האפליקציה אינו מושפע/);
});

test('flight view labels estimates and denies knowing the aircraft position', () => {
  const html = render('travel/trip-1/flight', upsertTrip(emptyTravel(), trip));
  assert.match(html, /מצב טיסה/);
  assert.match(html, /אינה יודעת את מיקום המטוס/);
  assert.match(html, /הערכה/);
  assert.match(html, /תאריך מקומי משוער ביעד/);
});

test('nearby view warns about kashrut and eruv and lists saved places', () => {
  let state = upsertTrip(emptyTravel(), trip);
  state = savePlace(state, 'trip-1', { name: 'בית כנסת מרכזי', address: 'לונדון' });
  const html = render('travel/trip-1/nearby', state);
  assert.match(html, /שירותים יהודיים ליד היעד/);
  assert.match(html, /בית כנסת מרכזי/);
  assert.match(html, /מקור:/);
  assert.match(html, /ייתכן שהמידע השתנה מאז/);
  assert.match(html, /אין חיבור לרשת/);
});

test('rabbi view exports facts with no conclusion', () => {
  const html = render('travel/trip-1/rabbi', upsertTrip(emptyTravel(), trip));
  assert.match(html, /נתונים לשאלה לרב/);
  assert.match(html, /עובדות בלבד/);
  assert.match(html, /העתק/);
  assert.match(html, /שתף/);
  assert.match(html, /אינו כולל מסקנה הלכתית/);
});

test('travel pages render offline and with an unknown trip', () => {
  const html = render('travel/missing-trip', upsertTrip(emptyTravel(), trip));
  assert.match(html, /מצב נסיעה/, 'an unknown id falls back to the list');
  const active = render('travel', setActiveTrip(upsertTrip(emptyTravel(), trip), 'trip-1'));
  assert.match(active, /כיבוי מצב נסיעה/);
});
