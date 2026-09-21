import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { formatGregorianDate } from '../civilDate.mjs';
import {
  locationFromCoordinates, resolveLocationMetadata, searchLocations, timeLabel, zmanim, ZMANIM,
} from '../services.mjs';
import { useResource } from '../hooks.jsx';
import { dayContext } from '../dayContext.mjs';
import {
  TRANSPORT, deleteTrip, deletePack, duplicateTrip, getPack, getTrip, listPlaces, loadTravel,
  removePlace, savePack, savePlace, saveTravel, setActiveTrip, upsertTrip,
} from '../services/travelStorage.mjs';
import {
  datelineAssessment, durationLabel, fastOverlaps, formatZoned, polarAssessment,
  restOverlaps, tripStatus, tripTimeline,
} from '../services/travelPlan.mjs';
import { buildPack, estimatePack, formatBytes, packStatus } from '../services/travelPack.mjs';
import { TEFILAT_HADERECH, tefilatHaderechPractical } from '../services/tefilatHaderech.mjs';
import { buildRabbiPack, rabbiPackText } from '../services/rabbiPack.mjs';
import { CAUTIONS, SERVICE_CATEGORIES, UNAVAILABLE_MESSAGE, createNearbyService, OFFLINE_MESSAGE } from '../services/nearbyServices.mjs';

export function parseTravelRoute(mode = 'travel') {
  const [, first, second] = mode.split('/');
  if (!first) return { view: 'list' };
  if (first === 'new') return { view: 'new' };
  return { view: second || 'detail', tripId: first };
}

function useTravel() {
  const [state, setState] = useState(() => loadTravel());
  const update = updater => setState(current => saveTravel(typeof updater === 'function' ? updater(current) : updater));
  return [state, update];
}

const localLabel = local => (local ? `${local.date} · ${local.time}` : 'לא זמין');
const tripDateLabel = (date, time, tzid) => date ? `${formatGregorianDate(date, tzid || 'UTC')}${time ? ` · ${time}` : ''}` : 'לא הוגדר';

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
  document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
}

export default function TravelMode({ route = 'travel', now, settings, items, onNav }) {
  const [state, update] = useTravel();
  const { view, tripId } = parseTravelRoute(route);
  const trip = tripId ? getTrip(state, tripId) : null;
  const shared = { state, update, trip, now, settings, items, onNav };
  if (view === 'new') return <TripForm {...shared} />;
  if (!trip) return <TripList {...shared} />;
  if (view === 'edit') return <TripForm {...shared} />;
  if (view === 'offline') return <OfflinePack {...shared} />;
  if (view === 'flight') return <FlightView {...shared} />;
  if (view === 'nearby') return <NearbyView {...shared} />;
  if (view === 'rabbi') return <RabbiView {...shared} />;
  return <TripDetail {...shared} />;
}

function TripList({ state, update, now }) {
  const groups = [
    ['active', 'נסיעה פעילה'],
    ['upcoming', 'נסיעות קרובות'],
    ['past', 'היסטוריית נסיעות'],
    ['draft', 'טיוטות'],
  ];
  return <section className="travel">
    <p className="eyebrow">מצב נסיעה יהודי</p>
    <h1>מצב נסיעה</h1>
    <p className="intro">מצב הנסיעה נדלק ידנית בלבד. שינוי מיקום במכשיר אינו מפעיל אותו.</p>
    <a className="personal-primary travel-new" href="#travel/new">נסיעה חדשה</a>
    {state.trips.length === 0 && <p className="personal-hint">עדיין אין נסיעות שמורות.</p>}
    {groups.map(([status, label]) => {
      const trips = state.trips.filter(trip => tripStatus(trip, now) === status);
      if (!trips.length) return null;
      return <section key={status}>
        <h2>{label}</h2>
        <div className="personal-tool-list">
          {trips.map(trip => <div className="travel-row" key={trip.id}>
            <a className="personal-tool-row" href={`#travel/${trip.id}`}>
              <span><strong>{trip.destination.name || 'ללא יעד'}</strong>
                <small>{trip.origin.name || 'ללא מוצא'} · {trip.departureDate ? formatGregorianDate(trip.departureDate, trip.origin.tzid || 'UTC') : 'ללא תאריך'}</small></span>
              <span aria-hidden="true">←</span>
            </a>
            <div className="travel-row-actions">
              <button type="button" className="ghost" onClick={() => update(current => setActiveTrip(current, current.activeTripId === trip.id ? null : trip.id))}>
                {state.activeTripId === trip.id ? 'כיבוי מצב נסיעה' : 'הפעלת מצב נסיעה'}
              </button>
              <button type="button" className="ghost" onClick={() => update(current => duplicateTrip(current, trip.id))}>שכפול</button>
              <button type="button" className="ghost" onClick={() => { if (window.confirm(`למחוק את הנסיעה ל${trip.destination?.name || 'יעד'}? הפעולה אינה ניתנת לביטול.`)) update(current => deleteTrip(current, trip.id)); }}>מחיקה</button>
            </div>
          </div>)}
        </div>
      </section>;
    })}
  </section>;
}

const emptyDraft = {
  origin: { name: '', latitude: '', longitude: '', tzid: '' },
  destination: { name: '', latitude: '', longitude: '', tzid: '' },
  departureDate: '', departureTime: '', arrivalDate: '', arrivalTime: '',
  returnDate: '', returnTime: '', transport: 'flight', flightNumber: '', notes: '',
};

function TravelPlaceField({ label, place, onSelect, currentLocation = false }) {
  const [query, setQuery] = useState(place.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  useEffect(() => setQuery(place.name || ''), [place.name]);
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2 || (value === place.name && place.tzid)) { setSuggestions([]); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchLocations(value, controller.signal)
        .then(setSuggestions)
        .catch(error => { if (error.name !== 'AbortError') setMessage(error.message); })
        .finally(() => setSearching(false));
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, place.name, place.tzid]);

  const choose = async candidate => {
    setMessage('מזהה את המקום…');
    try {
      const resolved = await resolveLocationMetadata(candidate);
      onSelect(resolved);
      setQuery(resolved.name);
      setSuggestions([]);
      setMessage('המקום נבחר');
    } catch (error) { setMessage(error.message); }
  };

  const applyCoordinates = async ({ latitude, longitude }) => {
    try {
      const resolved = await locationFromCoordinates(latitude, longitude);
      onSelect(resolved);
      setQuery(resolved.name);
      setSuggestions([]);
      setMessage('המיקום נבחר');
    } catch { setMessage('לא ניתן לזהות את המקום כרגע. אפשר לחפש עיר ידנית.'); }
  };

  const locate = async () => {
    setMessage('מאתר מיקום…');
    try {
      if (Capacitor.isNativePlatform()) {
        const current = await Geolocation.checkPermissions();
        const permission = current.location === 'granted' ? current : await Geolocation.requestPermissions();
        if (permission.location !== 'granted') return setMessage('לא ניתנה הרשאת מיקום. אפשר לחפש עיר ידנית.');
        const position = await Geolocation.getCurrentPosition({ timeout: 10000 });
        return applyCoordinates(position.coords);
      }
      if (!navigator.geolocation) return setMessage('איתור מיקום אינו זמין. אפשר לחפש עיר ידנית.');
      navigator.geolocation.getCurrentPosition(({ coords }) => applyCoordinates(coords), error => {
        setMessage(error.code === 1 ? 'לא ניתנה הרשאת מיקום. אפשר לחפש עיר ידנית.' : 'לא ניתן לאתר את המיקום כרגע.');
      }, { timeout: 10000 });
    } catch (error) {
      setMessage(error.code === 1 || error.message?.toLowerCase().includes('permission') ? 'לא ניתנה הרשאת מיקום. אפשר לחפש עיר ידנית.' : 'לא ניתן לאתר את המיקום כרגע.');
    }
  };

  const updateQuery = value => {
    setQuery(value);
    setMessage('');
    if (value !== place.name) onSelect({ name: value, latitude: null, longitude: null, tzid: null });
  };

  return <fieldset className="travel-place-field">
    <legend>{label}</legend>
    <div className="travel-place-search">
      <input ref={inputRef} value={query} onChange={event => updateQuery(event.currentTarget.value)}
        placeholder="חיפוש עיר או מקום" autoComplete="off" aria-label={`${label} חיפוש עיר או מקום`} />
      {currentLocation && <button type="button" className="locate-button" onClick={locate}>⌖ <span>המיקום שלי</span></button>}
      {(searching || suggestions.length > 0) && <div className="location-suggestions" role="listbox">
        {searching && <p>מחפש מקומות…</p>}
        {suggestions.map(candidate => <button type="button" role="option" key={`${candidate.latitude}-${candidate.longitude}-${candidate.name}`} onClick={() => choose(candidate)}>{candidate.name}</button>)}
      </div>}
    </div>
    {place.tzid && <p className="travel-place-selected">נבחר: <strong>{place.name}</strong></p>}
    {message && <p className="location-control-message" role="status">{message}</p>}
  </fieldset>;
}

function TripForm({ trip, state, update, settings }) {
  const [draft, setDraft] = useState(() => (trip ? {
    ...trip,
    origin: { ...trip.origin, latitude: trip.origin.latitude ?? '', longitude: trip.origin.longitude ?? '', tzid: trip.origin.tzid || '' },
    destination: { ...trip.destination, latitude: trip.destination.latitude ?? '', longitude: trip.destination.longitude ?? '', tzid: trip.destination.tzid || '' },
    returnDate: trip.returnDate || '', returnTime: trip.returnTime || '', flightNumber: trip.flightNumber || '', notes: trip.notes || '',
  } : {
    ...emptyDraft,
    origin: {
      name: settings?.location?.name || '', latitude: settings?.location?.latitude ?? '',
      longitude: settings?.location?.longitude ?? '', tzid: settings?.location?.tzid || '',
    },
  }));
  const [saved, setSaved] = useState(null);
  const setPlace = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const setField = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  const placeReady = place => place.name.trim() && place.tzid && Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude));
  const valid = placeReady(draft.origin) && placeReady(draft.destination) && draft.departureDate && draft.departureTime;

  const submit = event => {
    event.preventDefault();
    if (!valid) return;
    const id = trip?.id;
    const next = upsertTrip(state, { ...draft, id });
    update(next);
    setSaved(id || next.trips[next.trips.length - 1].id);
  };

  if (saved) return <section className="travel"><h1>הנסיעה נשמרה</h1><a className="personal-primary" href={`#travel/${saved}`}>פתיחת הנסיעה</a></section>;

  return <section className="travel">
    <a className="link back-link" href="#travel">← חזרה לנסיעות</a>
    <h1>{trip ? 'עריכת נסיעה' : 'נסיעה חדשה'}</h1>
    <form className="personal-form travel-form" onSubmit={submit}>
      <TravelPlaceField label="מאיפה?" place={draft.origin} onSelect={value => setPlace('origin', value)} currentLocation />
      <TravelPlaceField label="לאן?" place={draft.destination} onSelect={value => setPlace('destination', value)} />
      <fieldset className="travel-date-field"><legend>מתי יוצאים?</legend><div>
        <label className="personal-field"><span>תאריך</span><input type="date" value={draft.departureDate} onChange={event => setField('departureDate', event.currentTarget.value)} /></label>
        <label className="personal-field"><span>שעה</span><input type="time" value={draft.departureTime} onChange={event => setField('departureTime', event.currentTarget.value)} /></label>
      </div></fieldset>
      <fieldset className="travel-date-field"><legend>מתי חוזרים?</legend><div>
        <label className="personal-field"><span>תאריך</span><input type="date" value={draft.returnDate} onChange={event => setField('returnDate', event.currentTarget.value)} /></label>
        <label className="personal-field"><span>שעה</span><input type="time" value={draft.returnTime} onChange={event => setField('returnTime', event.currentTarget.value)} /></label>
      </div></fieldset>
      <fieldset className="travel-transport"><legend>אמצעי נסיעה</legend><div className="seg personal-seg">
        {TRANSPORT.map(option => <button type="button" key={option.id} className={draft.transport === option.id ? 'on' : ''}
          aria-pressed={draft.transport === option.id} onClick={() => setField('transport', option.id)}>{option.label}</button>)}
      </div></fieldset>
      <details className="travel-more"><summary>פרטים נוספים</summary>
        {draft.transport === 'flight' && <label className="personal-field"><span>מספר טיסה (רשות)</span><input value={draft.flightNumber} onChange={event => setField('flightNumber', event.currentTarget.value)} /></label>}
        <label className="personal-field"><span>הערות (רשות)</span><textarea rows="3" value={draft.notes} onChange={event => setField('notes', event.currentTarget.value)} /></label>
      </details>
      <button className="personal-primary travel-save" type="submit" disabled={!valid}>שמור נסיעה</button>
    </form>
    <p className="personal-hint">פרטי הנסיעה נשמרים במכשיר בלבד.</p>
  </section>;
}

function ResidenceCard({ settings, trip }) {
  const residence = settings?.halachicResidenceStatus || (settings?.il ? 'israel' : 'diaspora');
  return <section className="travel-residence">
    <div><span className="eyebrow">מיקום נוכחי</span><strong>{settings?.location?.name || 'לא זמין'}</strong></div>
    <div><span className="eyebrow">מעמד הלכתי</span><strong>{residence === 'israel' ? 'תושב ישראל' : 'תושב חו״ל'}</strong></div>
    <div><span className="eyebrow">יעד</span><strong>{trip?.destination?.name || 'לא זמין'}</strong></div>
    <p className="personal-hint">המעמד ההלכתי נקבע בהגדרות בלבד ואינו משתנה בעקבות נסיעה או שינוי מיקום.</p>
  </section>;
}

function useDestinationContext(trip, now, items) {
  const tzid = trip?.destination?.tzid || null;
  const latitude = trip?.destination?.latitude;
  const longitude = trip?.destination?.longitude;
  const timeline = tripTimeline(trip);
  const dayKey = timeline.arrival?.slice(0, 10) || timeline.departure?.slice(0, 10) || null;
  const ready = Boolean(tzid && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && dayKey);
  const destinationSettings = ready ? { location: { name: trip.destination.name, latitude: Number(latitude), longitude: Number(longitude), tzid }, candles: 20 } : null;
  const solar = useResource(
    signal => (ready ? zmanim(dayKey, destinationSettings, signal) : Promise.resolve(null)),
    [ready, dayKey, tzid, latitude, longitude],
  );
  const reference = dayKey ? new Date(`${dayKey}T12:00:00Z`) : now;
  // Calendar and Jewish context reuse the shared engine rather than a travel-specific copy.
  const context = ready ? dayContext(reference, destinationSettings, solar.data, items || []) : null;
  return { ready, dayKey, tzid, solar, context };
}

function TripDetail({ trip, state, update, now, settings, items, onNav }) {
  const timeline = tripTimeline(trip);
  const { ready, dayKey, tzid, solar, context } = useDestinationContext(trip, now, items);
  const rest = restOverlaps(trip, items);
  const fasts = fastOverlaps(trip, items);
  const dateline = datelineAssessment(trip);
  const polar = polarAssessment({ latitude: trip.destination.latitude, solar: solar.data });
  const pack = getPack(state, trip.id);
  const status = packStatus(trip, pack);
  const active = state.activeTripId === trip.id;

  return <section className="travel">
    <a className="link back-link" href="#travel">← חזרה לנסיעות</a>
    <p className="eyebrow">מצב נסיעה</p>
    <h1 className="travel-route">{trip.origin.name || 'מוצא'} → {trip.destination.name || 'יעד'}</h1>
    <ResidenceCard settings={settings} trip={trip} />

    <section className="travel-summary" aria-label="פרטי הנסיעה">
      <div><span>יציאה</span><strong>{tripDateLabel(trip.departureDate, trip.departureTime, trip.origin.tzid)}</strong></div>
      <div><span>חזרה</span><strong>{tripDateLabel(trip.returnDate, trip.returnTime, trip.origin.tzid)}</strong></div>
      <div><span>זמן מקומי ביעד</span><strong>{localLabel(formatZoned(now, tzid))}</strong></div>
    </section>

    {rest.length > 0 && <section className="travel-warning" role="alert">
      <h2>הנסיעה המתוכננת חופפת לכניסת שבת או חג</h2>
      {rest.map(overlap => <p key={overlap.entry}>
        כניסה: {localLabel(formatZoned(overlap.entry, tzid || trip.origin.tzid))}
        {overlap.exit && <> · יציאה: {localLabel(formatZoned(overlap.exit, tzid || trip.origin.tzid))}</>}
        {overlap.location && <> · {overlap.location}</>}
      </p>)}
      <p className="personal-hint">המידע מוצג לידיעה בלבד. ההחלטה בידי המשתמש.</p>
    </section>}

    {fasts.length > 0 && <section className="travel-warning">
      <h2>תענית בטווח הנסיעה</h2>
      {fasts.map(fast => <p key={fast.date}>{fast.name} · {formatGregorianDate(fast.date, tzid || 'UTC')}</p>)}
      <p className="personal-hint">אין כאן הנחיות רפואיות. לשאלות זמן הלכתיות עקב הנסיעה השתמשו בנתונים לשאלה לרב.</p>
    </section>}

    <section className="travel-block">
      <h2>פרטי הדרך</h2>
      <dl>
        <dt>יציאה</dt><dd>{trip.origin.name || 'לא זמין'} · {localLabel(timeline.originLocal)}</dd>
        {timeline.destinationLocal && <><dt>הגעה משוערת</dt><dd>{trip.destination.name || 'לא זמין'} · {localLabel(timeline.destinationLocal)}</dd></>}
        {timeline.durationMinutes !== null && <><dt>משך נסיעה</dt><dd>{durationLabel(timeline.durationMinutes)}</dd></>}
      </dl>
    </section>

    <section className="travel-block">
      <h2>זמני היום</h2>
      {!ready && <p className="notice">לא ניתן לחשב את זמני היעד. יש לערוך את הנסיעה ולבחור יעד מהרשימה.</p>}
      {ready && solar.loading && <p className="notice">מחשב זמנים ליעד…</p>}
      {ready && solar.error && <p className="notice error">{solar.error}</p>}
      {ready && context && <>
        <dl>
          <dt>תאריך עברי</dt><dd>{context.date?.label || 'לא זמין'}</dd>
          <dt>יום בשבוע</dt><dd>{dayKey ? new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: tzid }).format(new Date(`${dayKey}T12:00:00Z`)) : 'לא זמין'}</dd>
          <dt>זריחה</dt><dd>{solar.data?.sunrise ? timeLabel(solar.data.sunrise, tzid) : 'לא זמין'}</dd>
          <dt>שקיעה</dt><dd>{solar.data?.sunset ? timeLabel(solar.data.sunset, tzid) : 'לא זמין'}</dd>
          <dt>ראש חודש</dt><dd>{context.isRoshChodesh ? 'כן' : 'לא'}</dd>
          <dt>עומר</dt><dd>{context.omer?.hebrew || context.omer?.title || 'לא רלוונטי'}</dd>
          <dt>קריאת התורה</dt><dd>{context.parasha?.hebrew || context.upcomingShabbat?.hebrew || 'לא זמין'}</dd>
        </dl>
        {!polar.flagged && <details><summary>זמני תפילה ביעד</summary>
          <dl>{ZMANIM.filter(([key]) => solar.data?.[key]).slice(0, 8).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{timeLabel(solar.data[key], tzid)}</dd></div>)}</dl>
        </details>}
        {context.additions?.length > 0 && <p>תוספות בתפילה: {context.additions.map(addition => addition.text).join(' · ')}</p>}
      </>}
    </section>

    {polar.flagged && <section className="travel-warning" role="alert">
      <h2>זמני היום באזור זה דורשים בירור הלכתי מיוחד</h2>
      <p>תנאי האור באזור זה עשויים לדרוש בירור מיוחד.</p>
      <a className="link" href={`#travel/${trip.id}/rabbi`}>הכן נתונים לשאלה לרב</a>
    </section>}

    {dateline.candidate && <section className="travel-warning" role="alert">
      <h2>שאלת קו התאריך</h2>
      <p>{dateline.reason}</p>
      <a className="link" href={`#travel/${trip.id}/rabbi`}>הכן נתונים לשאלה לרב</a>
    </section>}

    <section className="travel-block">
      <h2>תפילת הדרך</h2>
      <TefilatHaderech />
    </section>

    <div className="personal-tool-list">
      <a className="personal-tool-row" href={`#travel/${trip.id}/offline`}><span><strong>חבילת אופליין</strong><small>{status.exists ? (status.stale ? 'נדרש רענון' : `${formatBytes(pack.bytes)} שמורים`) : 'לא הורדה'}</small></span><span aria-hidden="true">←</span></a>
      {trip.transport === 'flight' && <a className="personal-tool-row" href={`#travel/${trip.id}/flight`}><span><strong>מצב טיסה</strong><small>זמנים במוצא וביעד</small></span><span aria-hidden="true">←</span></a>}
      <a className="personal-tool-row" href={`#travel/${trip.id}/nearby`}><span><strong>שירותים יהודיים ליד היעד</strong><small>{listPlaces(state, trip.id).length} מקומות שמורים</small></span><span aria-hidden="true">←</span></a>
      <a className="personal-tool-row" href={`#travel/${trip.id}/rabbi`}><span><strong>נתונים לשאלה לרב</strong><small>עובדות בלבד</small></span><span aria-hidden="true">←</span></a>
      <a className="personal-tool-row" href={`#travel/${trip.id}/edit`}><span><strong>עריכת נסיעה</strong><small>שינוי תאריכים ויעד</small></span><span aria-hidden="true">←</span></a>
    </div>

    <div className="travel-row-actions">
      <button type="button" className="ghost" onClick={() => update(current => setActiveTrip(current, active ? null : trip.id))}>{active ? 'כיבוי מצב נסיעה' : 'הפעלת מצב נסיעה'}</button>
      <button type="button" className="ghost" onClick={() => onNav?.('siddur-compass')}>פתח מצפן תפילה</button>
    </div>
    <p className="personal-hint">מצפן התפילה עובד לפי מיקום המכשיר בפועל.</p>
  </section>;
}

function TefilatHaderech() {
  const [open, setOpen] = useState(false);
  const { practical, notice } = tefilatHaderechPractical();
  return <div className="travel-tefila">
    <button type="button" className="personal-primary" onClick={() => setOpen(value => !value)}>{open ? 'סגירת תפילת הדרך' : 'פתיחת תפילת הדרך'}</button>
    {open && <div className="travel-tefila-body">
      {!practical && <p className="notice error">{notice}</p>}
      <p className="personal-hint">{TEFILAT_HADERECH.note}</p>
      {TEFILAT_HADERECH.text.map((paragraph, index) => <p className="travel-prayer" key={index} lang="he">{paragraph}</p>)}
      <dl className="forgotten-sources">
        <dt>מקור עיקרי</dt><dd>{TEFILAT_HADERECH.source.primary}</dd>
        <dt>מקור נוסף</dt><dd>{TEFILAT_HADERECH.source.secondary}</dd>
      </dl>
      <p className="personal-hint">נושאים הדורשים בירור: {TEFILAT_HADERECH.openQuestions.join(' · ')}</p>
    </div>}
  </div>;
}

function OfflinePack({ trip, state, update, items }) {
  const pack = getPack(state, trip.id);
  const status = packStatus(trip, pack);
  const overlapsRest = restOverlaps(trip, items).length > 0;
  const estimate = estimatePack(trip, { overlapsRest, hasSavedSources: true, hasTalmudCache: true });
  return <section className="travel">
    <a className="link back-link" href={`#travel/${trip.id}`}>← חזרה לנסיעה</a>
    <h1>חבילת נסיעה</h1>
    <p className="intro">נשמר רק תוכן הרלוונטי לנסיעה. התוכן הרגיל של האפליקציה אינו מושפע.</p>
    <section className="travel-block">
      <h2>גודל משוער</h2>
      <p className="travel-size">{estimate.label}</p>
      <ul className="prep-inline-list">{estimate.items.map(item => <li key={item.id}>{item.label}<small>{formatBytes(item.bytes)}</small></li>)}</ul>
    </section>
    {status.exists && <section className="travel-block">
      <h2>חבילה שמורה</h2>
      <dl>
        <dt>פריטים</dt><dd>{pack.items.length}</dd>
        <dt>נפח</dt><dd>{formatBytes(pack.bytes)}</dd>
        <dt>טווח תאריכים</dt><dd>{pack.range.from || 'לא זמין'} — {pack.range.to || 'לא זמין'}</dd>
        <dt>נוצר</dt><dd>{pack.generatedAt.slice(0, 16).replace('T', ' ')}</dd>
      </dl>
      {status.stale && <p className="notice error">החבילה אינה מעודכנת: {status.reasons.join(' · ')}. יש לרענן כדי למנוע זמנים שגויים.</p>}
    </section>}
    <div className="travel-row-actions">
      <button type="button" className="personal-primary" onClick={() => update(current => savePack(current, trip.id, buildPack(trip, { overlapsRest, hasSavedSources: true, hasTalmudCache: true })))}>
        {status.exists ? 'רענון חבילת נסיעה' : 'הורד חבילת נסיעה'}
      </button>
      {status.exists && <button type="button" className="ghost" onClick={() => update(current => deletePack(current, trip.id))}>מחק חבילת נסיעה</button>}
    </div>
  </section>;
}

function FlightView({ trip, now, items }) {
  const timeline = tripTimeline(trip);
  const { ready, solar, context, tzid } = useDestinationContext(trip, now, items);
  return <section className="travel">
    <a className="link back-link" href={`#travel/${trip.id}`}>← חזרה לנסיעה</a>
    <h1>מצב טיסה</h1>
    <p className="notice">האפליקציה אינה יודעת את מיקום המטוס. הנתונים מבוססים על המוצא, היעד והשעות שהוזנו.</p>
    <section className="travel-block">
      <h2>שעות</h2>
      <dl>
        <dt>שעת מוצא</dt><dd>{trip.origin.name} · {localLabel(timeline.originLocal)}</dd>
        <dt>שעת יעד</dt><dd>{trip.destination.name} · {localLabel(timeline.destinationLocal)}</dd>
        <dt>היציאה לפי שעון היעד</dt><dd>{localLabel(timeline.departureInDestination)}</dd>
        <dt>תאריך מקומי משוער ביעד</dt><dd>{timeline.destinationLocal?.date || 'לא זמין'}</dd>
      </dl>
    </section>
    <section className="travel-block">
      <h2>תאריך עברי</h2>
      <dl>
        <dt>ביעד</dt><dd>{ready && context ? context.date?.label || 'לא זמין' : 'נדרשים נתוני יעד מלאים'}</dd>
        <dt>שקיעה ביעד</dt><dd>{solar.data?.sunset ? timeLabel(solar.data.sunset, tzid) : 'לא זמין'}</dd>
        <dt>זריחה ביעד</dt><dd>{solar.data?.sunrise ? timeLabel(solar.data.sunrise, tzid) : 'לא זמין'}</dd>
      </dl>
      <p className="personal-hint">הערכה · מבוססת על נקודות הקצה בלבד ואינה מיקום בפועל.</p>
    </section>
    <a className="link" href={`#travel/${trip.id}/rabbi`}>נתונים לשאלה לרב</a>
  </section>;
}

function NearbyView({ trip, state, update }) {
  const [category, setCategory] = useState('synagogue');
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState({ name: '', address: '', note: '' });
  const service = createNearbyService({ online: () => navigator.onLine !== false });
  const places = listPlaces(state, trip.id);

  const search = async () => {
    const response = await service.search({ latitude: trip.destination.latitude, longitude: trip.destination.longitude, category });
    setResult(response);
  };

  return <section className="travel">
    <a className="link back-link" href={`#travel/${trip.id}`}>← חזרה לנסיעה</a>
    <h1>שירותים יהודיים ליד היעד</h1>
    <div className="seg personal-seg" role="tablist" aria-label="סוג שירות">
      {SERVICE_CATEGORIES.map(option => <button type="button" key={option.id} role="tab" aria-selected={category === option.id}
        className={category === option.id ? 'on' : ''} onClick={() => { setCategory(option.id); setResult(null); }}>{option.label}</button>)}
    </div>
    {CAUTIONS[category] && <p className="notice error">{CAUTIONS[category]}</p>}
    <button type="button" className="personal-primary" onClick={search}>חיפוש ביעד</button>
    {result && result.status !== 'ok' && <p className="notice" role="status">{result.message || UNAVAILABLE_MESSAGE}</p>}
    {result?.status === 'ok' && result.results.length === 0 && <p className="notice">לא התקבלו תוצאות ממקור מאומת.</p>}
    {result?.status === 'ok' && result.results.map(item => <div className="travel-block" key={`${item.name}-${item.address}`}>
      <strong>{item.name}</strong>
      {item.address && <p>{item.address}</p>}
      <p className="personal-hint">מקור: {item.source}{item.lastChecked ? ` · נבדק: ${item.lastChecked}` : ''}</p>
    </div>)}
    <p className="personal-hint">{OFFLINE_MESSAGE}</p>

    <section className="travel-block">
      <h2>מקומות שמורים</h2>
      {places.length === 0 && <p className="personal-hint">אין מקומות שמורים לנסיעה זו.</p>}
      <ul className="prep-inline-list">
        {places.map(place => <li key={place.id}>
          <span><strong>{place.name}</strong><small>{place.category}{place.address ? ` · ${place.address}` : ''}</small>
            <small>מקור: {place.source} · נשמר ב-{place.savedAt.slice(0, 10)}. ייתכן שהמידע השתנה מאז.</small></span>
          <button type="button" className="ghost" onClick={() => update(current => removePlace(current, trip.id, place.id))}>מחיקה</button>
        </li>)}
      </ul>
      <form className="personal-form" onSubmit={event => {
        event.preventDefault();
        update(current => savePlace(current, trip.id, { ...draft, category: SERVICE_CATEGORIES.find(option => option.id === category)?.label }));
        setDraft({ name: '', address: '', note: '' });
      }}>
        <label className="personal-field"><span>שם המקום</span><input value={draft.name} onChange={event => setDraft({ ...draft, name: event.currentTarget.value })} /></label>
        <label className="personal-field"><span>כתובת</span><input value={draft.address} onChange={event => setDraft({ ...draft, address: event.currentTarget.value })} /></label>
        <label className="personal-field"><span>הערה</span><input value={draft.note} onChange={event => setDraft({ ...draft, note: event.currentTarget.value })} /></label>
        <button className="personal-primary" type="submit" disabled={!draft.name.trim()}>שמירת מקום</button>
      </form>
    </section>
  </section>;
}

function RabbiView({ trip, settings, items, now }) {
  const { solar } = useDestinationContext(trip, now, items);
  const [status, setStatus] = useState('');
  const pack = buildRabbiPack({ trip, settings, items, destinationSolar: solar.data, now });
  const text = rabbiPackText(pack);

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'נתונים לשאלה לרב', text }); return setStatus('נשלח לשיתוף'); }
      catch { /* user cancelled */ }
    }
    setStatus('שיתוף אינו זמין במכשיר זה');
  };

  return <section className="travel">
    <a className="link back-link" href={`#travel/${trip.id}`}>← חזרה לנסיעה</a>
    <h1>נתונים לשאלה לרב</h1>
    <p className="intro">המסמך מרכז עובדות בלבד. אין בו מסקנה או פסיקה.</p>
    {pack?.ambiguities.length > 0 && <section className="travel-block">
      <h2>נקודות לבירור</h2>
      <ul>{pack.ambiguities.map(item => <li key={item}>{item}</li>)}</ul>
    </section>}
    <pre className="travel-rabbi" dir="rtl">{text}</pre>
    <div className="travel-row-actions">
      <button type="button" className="personal-primary" onClick={async () => { await copyToClipboard(text); setStatus('הנתונים הועתקו'); }}>העתק</button>
      <button type="button" className="ghost" onClick={share}>שתף</button>
    </div>
    {status && <p role="status" className="notice">{status}</p>}
  </section>;
}
