import { useEffect, useRef, useState } from 'react';
import { locationFromCoordinates, searchLocations, timezoneForCoordinates } from '../services.mjs';

export default function LocationControl({ settings, setSettings, compact = false }) {
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState(settings.location.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => setQuery(settings.location.name || ''), [settings.location.name]);
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2 || value === settings.location.name) { setSuggestions([]); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchLocations(value, controller.signal).then(setSuggestions).catch(error => { if (error.name !== 'AbortError') setMessage(error.message); }).finally(() => setSearching(false));
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, settings.location.name]);
  const chooseLocation = async place => {
    setMessage('מעדכן את אזור הזמן…');
    const tzid = place.tzid || await timezoneForCoordinates(place.latitude, place.longitude, Intl.DateTimeFormat().resolvedOptions().timeZone);
    setSettings(s => ({ ...s, il: place.countryCode === 'il' || place.il === true, location: { ...place, tzid } }));
    setQuery(place.name); setSuggestions([]); setMessage('המיקום נשמר');
  };
  const locate = () => {
    if (!navigator.geolocation) return setMessage('המכשיר אינו תומך באיתור מיקום. אפשר לחפש מקום ידנית.');
    setMessage('מאתר מיקום…');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const location = await locationFromCoordinates(coords.latitude, coords.longitude);
        setSettings(s => ({ ...s, il: location.il, location })); setQuery(location.name); setMessage('המיקום עודכן');
      } catch {
        setSettings(s => ({ ...s, il: false, location: { ...s.location, name: 'המיקום שלי', latitude: coords.latitude, longitude: coords.longitude, tzid: Intl.DateTimeFormat().resolvedOptions().timeZone } }));
        setQuery('המיקום שלי'); setMessage('המיקום עודכן לפי הקואורדינטות');
      }
    }, error => setMessage(error.code === 1 ? 'לא ניתנה הרשאת מיקום. אפשר לחפש מקום ידנית.' : 'לא ניתן לאתר את המיקום כרגע.'), { timeout: 10000 });
  };
  return <section className={`location-control${compact ? ' location-control-compact' : ''}`} aria-label="מיקום פעיל וזמנים">
    <button type="button" className="location-control-head" onClick={() => inputRef.current?.focus()} aria-label={`שינוי המיקום הפעיל: ${settings.location.name}`}><span>מיקום פעיל</span><strong>{settings.location.name}</strong><small>{settings.location.tzid}</small></button>
    <div className="location-control-actions">
      <label htmlFor={compact ? 'today-location-search' : 'times-location-search'}>חיפוש עיר או מקום</label>
      <div className="location-search-row"><input ref={inputRef} id={compact ? 'today-location-search' : 'times-location-search'} value={query} onChange={e => setQuery(e.target.value)} placeholder="ירושלים, לונדון, New York…" autoComplete="off" /><button type="button" className="locate-button" onClick={locate} aria-label="המיקום שלי" title="המיקום שלי">⌖ <span>המיקום שלי</span></button></div>
      {(searching || suggestions.length > 0) && <div className="location-suggestions" role="listbox">{searching && <p>מחפש מקומות…</p>}{suggestions.map(place => <button type="button" role="option" key={`${place.latitude}-${place.longitude}-${place.name}`} onClick={() => chooseLocation(place)}>{place.name}</button>)}</div>}
    </div>
    {message && <p className="location-control-message" role="status">{message}</p>}
  </section>;
}
