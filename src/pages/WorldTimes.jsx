import { useEffect, useMemo, useState } from 'react';
import { BackLink } from '../components/LocalNavigation.jsx';
import DiasporaIndicator from '../components/DiasporaIndicator.jsx';
import { timeLabel } from '../services.mjs';
import { countryName, offsetLabel, parseCity, placeNow, searchCities } from '../services/worldTimes.mjs';
import TitleOrnament from '../components/ui/TitleOrnament.jsx';

// זמנים בכל העולם (route travel/world): search any city offline, see its local time, its Hebrew date and the day's
// zmanim; the place can become the active location. The chosen places are kept on the device only.
const KEY = 'kz-world-places-v1';
const MAX_PLACES = 8;
const readPlaces = () => { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value.filter(place => place?.tzid && Number.isFinite(place.latitude)) : []; } catch { return []; } };
const writePlaces = places => { try { localStorage.setItem(KEY, JSON.stringify(places)); } catch { /* storage unavailable */ } };
const JERUSALEM = { id: 'Jerusalem|IL|31.7690|35.2163', name: 'ירושלים', searchName: 'Jerusalem', countryCode: 'il', latitude: 31.769, longitude: 35.2163, tzid: 'Asia/Jerusalem', il: true };

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  return now;
}

function PlaceCard({ place, now, here, current = false, onUse, onRemove }) {
  const view = placeNow(place, now);
  return <article className={`world-place${current ? ' is-current' : ''}`} aria-label={`${place.name}: ${view.time}`}>
    <header className="world-place-head">
      <div className="world-place-name"><strong><bdi>{place.name}</bdi></strong><small>{[countryName(place.countryCode), current ? 'המיקום הפעיל' : offsetLabel(place.tzid, here, now)].filter(Boolean).join(' · ')}</small></div>
      <div className="world-place-clock"><span className="world-place-time" dir="ltr">{view.time}</span><small>{view.date}</small></div>
    </header>
    <p className="world-place-meta">{view.hebrew && <span>{view.hebrew}</span>}<span className={`world-land ${view.eretzYisrael ? 'is-il' : 'is-abroad'}`}>{view.eretzYisrael ? 'ארץ ישראל' : 'חוץ לארץ'}</span></p>
    {view.polar
      ? <p className="notice">באזור זה אין היום זריחה או שקיעה רגילות; הזמנים דורשים בירור הלכתי מיוחד.</p>
      : <dl className="world-zmanim">{view.zmanim.map(item => <div key={item.key}><dt>{item.label}</dt><dd dir="ltr">{item.at ? timeLabel(item.at, place.tzid) : '—'}</dd></div>)}</dl>}
    {(onUse || onRemove) && <div className="world-place-actions">
      {onUse && <button type="button" className="ghost" onClick={onUse}>הגדרה כמיקום הפעיל</button>}
      {onRemove && <button type="button" className="ghost" onClick={onRemove} aria-label={`הסרת ${place.name}`}>הסרה</button>}
    </div>}
  </article>;
}

export default function WorldTimes({ settings, setSettings }) {
  const now = useClock();
  const [cities, setCities] = useState(null);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState(() => { const saved = readPlaces(); return saved.length ? saved : [JERUSALEM]; });
  const [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    import('../data/worldCities.mjs').then(module => { if (live) setCities(module.WORLD_CITIES.map(parseCity)); }).catch(() => { if (live) setMessage('רשימת הערים אינה זמינה כרגע.'); });
    return () => { live = false; };
  }, []);
  const results = useMemo(() => (cities ? searchCities(cities, query) : []), [cities, query]);
  const here = settings?.location?.tzid || 'Asia/Jerusalem';
  const save = next => { setPlaces(next); writePlaces(next); };
  const add = city => {
    setQuery('');
    if (places.some(place => place.id === city.id)) return setMessage(`${city.name} כבר ברשימה.`);
    const next = [city, ...places].slice(0, MAX_PLACES);
    save(next);
    setMessage(`${city.name} נוספה לרשימה.`);
  };
  const use = place => {
    setSettings?.(s => ({ ...s, location: { name: place.name, searchName: place.searchName, latitude: place.latitude, longitude: place.longitude, tzid: place.tzid, il: place.il, countryCode: place.countryCode, source: 'manual' } }));
    setMessage(`המיקום הפעיל: ${place.name}. הזמנים בכל האפליקציה מחושבים עכשיו לפיו.`);
  };
  const current = settings?.location ? { ...settings.location, id: 'current', countryCode: settings.location.countryCode || (settings.location.il ? 'il' : '') } : null;
  return <section className="travel world-times">
    <BackLink href="#travel" label="חזרה למצב מסע" />
    <header className="world-head">
      <p className="eyebrow">מצב מסע</p>
      <h1>זמנים בכל העולם</h1>
      <TitleOrnament />
      <p className="world-intro">השעה המקומית וזמני היום בכל עיר, מחושבים במכשיר וללא אינטרנט.</p>
    </header>
    <DiasporaIndicator settings={settings} setSettings={setSettings} />
    <div className="world-search">
      <label htmlFor="world-city">חיפוש עיר</label>
      <input id="world-city" type="search" value={query} onChange={event => { setQuery(event.target.value); setMessage(''); }} placeholder="לונדון · New York · מלבורן" autoComplete="off" enterKeyHint="search" />
      {query.trim().length >= 2 && <div className="world-results" role="listbox" aria-label="ערים">
        {!cities && <p>טוען את רשימת הערים…</p>}
        {cities && results.length === 0 && <p>לא נמצאה עיר בשם הזה ברשימה שבמכשיר.</p>}
        {results.map(city => <button type="button" role="option" aria-selected="false" key={city.id} onClick={() => add(city)}><strong><bdi>{city.name}</bdi></strong><small>{[city.he && city.searchName, countryName(city.countryCode)].filter(Boolean).join(' · ')}</small></button>)}
      </div>}
    </div>
    {message && <p className="world-message" role="status">{message}</p>}
    <div className="world-places">
      {current && <PlaceCard place={current} now={now} here={here} current />}
      {places.map(place => <PlaceCard key={place.id} place={place} now={now} here={here} onUse={setSettings ? () => use(place) : null} onRemove={() => save(places.filter(item => item.id !== place.id))} />)}
    </div>
    <p className="world-credit">רשימת הערים: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a> (CC BY 4.0) · שמות בעברית: ויקינתונים (CC0) · הזמנים: חישוב במכשיר (Hebcal) · הזריחה והשקיעה במישור, ללא תיקון גובה.</p>
  </section>;
}
