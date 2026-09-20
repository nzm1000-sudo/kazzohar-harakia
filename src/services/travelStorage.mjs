// Versioned travel store. Namespaced away from companion-settings-v2 and the Phase 2 store.
export const TRAVEL_STORAGE_KEY = 'kz-travel-v1';
export const SCHEMA_VERSION = 1;

export const TRANSPORT = Object.freeze([
  { id: 'flight', label: 'טיסה' },
  { id: 'car', label: 'רכב' },
  { id: 'train', label: 'רכבת' },
  { id: 'other', label: 'אחר' },
]);

const EMPTY = Object.freeze({ version: SCHEMA_VERSION, trips: [], packs: {}, places: {}, activeTripId: null });

const clone = value => JSON.parse(JSON.stringify(value));
const array = value => (Array.isArray(value) ? value : []);
const record = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const text = value => String(value ?? '').trim();

function defaultStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

function normalizePlace(raw) {
  const place = record(raw);
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  return {
    name: text(place.name),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    // IANA identifiers only, so daylight saving is resolved at render time.
    tzid: text(place.tzid) || null,
  };
}

function normalizeTrip(raw) {
  const trip = record(raw);
  return {
    id: text(trip.id) || createId('trip'),
    origin: normalizePlace(trip.origin),
    destination: normalizePlace(trip.destination),
    departureDate: text(trip.departureDate),
    departureTime: text(trip.departureTime),
    arrivalDate: text(trip.arrivalDate),
    arrivalTime: text(trip.arrivalTime),
    returnDate: text(trip.returnDate) || null,
    returnTime: text(trip.returnTime) || null,
    transport: TRANSPORT.some(option => option.id === trip.transport) ? trip.transport : 'other',
    flightNumber: text(trip.flightNumber) || null,
    notes: text(trip.notes) || null,
    createdAt: text(trip.createdAt) || new Date().toISOString(),
    updatedAt: text(trip.updatedAt) || new Date().toISOString(),
  };
}

export function migrate(raw) {
  const base = clone(EMPTY);
  if (!raw || typeof raw !== 'object') return base;
  const version = Number(raw.version);
  if (!Number.isFinite(version) || version < 1 || version > SCHEMA_VERSION) return base;
  const trips = array(raw.trips).map(normalizeTrip).filter(trip => trip.destination.name || trip.origin.name);
  const ids = new Set(trips.map(trip => trip.id));
  return {
    version: SCHEMA_VERSION,
    trips,
    packs: Object.fromEntries(Object.entries(record(raw.packs)).filter(([tripId]) => ids.has(tripId))),
    places: Object.fromEntries(Object.entries(record(raw.places)).map(([tripId, list]) => [tripId, array(list)]).filter(([tripId]) => ids.has(tripId))),
    activeTripId: ids.has(raw.activeTripId) ? raw.activeTripId : null,
  };
}

export function loadTravel(storage = defaultStorage()) {
  try { return migrate(JSON.parse(storage?.getItem(TRAVEL_STORAGE_KEY) || 'null')); }
  catch { return clone(EMPTY); }
}

export function saveTravel(state, storage = defaultStorage()) {
  const next = migrate(state);
  try { storage?.setItem(TRAVEL_STORAGE_KEY, JSON.stringify(next)); } catch { /* storage full or private mode */ }
  return next;
}

export function emptyTravel() {
  return clone(EMPTY);
}

let counter = 0;
export function createId(prefix = 'trip') {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function upsertTrip(state, trip) {
  const normalized = normalizeTrip({ ...trip, updatedAt: new Date().toISOString() });
  const trips = array(state.trips);
  const index = trips.findIndex(item => item.id === normalized.id);
  const next = index >= 0
    ? trips.map((item, position) => (position === index ? { ...item, ...normalized, createdAt: item.createdAt } : item))
    : [...trips, normalized];
  return { ...state, trips: next };
}

export function getTrip(state, tripId) {
  return array(state.trips).find(trip => trip.id === tripId) || null;
}

export function deleteTrip(state, tripId) {
  const packs = { ...record(state.packs) };
  const places = { ...record(state.places) };
  delete packs[tripId];
  delete places[tripId];
  return {
    ...state,
    trips: array(state.trips).filter(trip => trip.id !== tripId),
    packs,
    places,
    activeTripId: state.activeTripId === tripId ? null : state.activeTripId,
  };
}

export function duplicateTrip(state, tripId) {
  const trip = getTrip(state, tripId);
  if (!trip) return state;
  const copy = { ...trip, id: createId('trip'), createdAt: new Date().toISOString() };
  return { ...state, trips: [...array(state.trips), normalizeTrip(copy)] };
}

/** Travel Mode is never turned on by a GPS change; only this explicit call activates it. */
export function setActiveTrip(state, tripId) {
  return { ...state, activeTripId: getTrip(state, tripId) ? tripId : null };
}

export function savePack(state, tripId, pack) {
  if (!getTrip(state, tripId)) return state;
  return { ...state, packs: { ...record(state.packs), [tripId]: pack } };
}

export function getPack(state, tripId) {
  return record(state.packs)[tripId] || null;
}

/** Only the namespaced travel pack is removed; regular offline content is untouched. */
export function deletePack(state, tripId) {
  const packs = { ...record(state.packs) };
  delete packs[tripId];
  return { ...state, packs };
}

export function savePlace(state, tripId, place) {
  if (!getTrip(state, tripId)) return state;
  const entry = {
    id: createId('place'),
    name: text(place?.name),
    category: text(place?.category) || 'בית כנסת',
    address: text(place?.address),
    note: text(place?.note),
    source: text(place?.source) || 'הוזן ידנית על ידי המשתמש',
    savedAt: new Date().toISOString(),
  };
  if (!entry.name) return state;
  const current = array(record(state.places)[tripId]);
  return { ...state, places: { ...record(state.places), [tripId]: [...current, entry] } };
}

export function listPlaces(state, tripId) {
  return array(record(state.places)[tripId]);
}

export function removePlace(state, tripId, placeId) {
  const current = array(record(state.places)[tripId]).filter(place => place.id !== placeId);
  return { ...state, places: { ...record(state.places), [tripId]: current } };
}
