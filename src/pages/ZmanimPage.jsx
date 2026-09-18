import { useEffect, useState } from 'react';
import { locationFromCoordinates, searchLocations, timezoneForCoordinates, ZMANIM, timeLabel } from '../services.mjs';

export default function ZmanimPage({ T, solar, settings, setSettings }) {
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState(settings.location.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const tz = settings.location.tzid;
  const times = solar?.data;
  useEffect(() => setQuery(settings.location.name || ''), [settings.location.name]);
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2 || value === settings.location.name) { setSuggestions([]); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchLocations(value, controller.signal).then(setSuggestions).catch(error => {
        if (error.name !== 'AbortError') setMessage(error.message);
      }).finally(() => setSearching(false));
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, settings.location.name]);
  const chooseLocation = async place => {
    setMessage('מעדכן את אזור הזמן…');
    const tzid = await timezoneForCoordinates(place.latitude, place.longitude, Intl.DateTimeFormat().resolvedOptions().timeZone);
    setSettings(s => ({ ...s, il: place.countryCode === 'il', location: { ...place, tzid } }));
    setQuery(place.name);
    setSuggestions([]);
    setMessage('המיקום נשמר');
  };
  const locate = () => {
    if (!navigator.geolocation) return setMessage('המכשיר אינו תומך באיתור מיקום. בחרו עיר מהרשימה.');
    setMessage('מאתר מיקום…');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const location = await locationFromCoordinates(coords.latitude, coords.longitude);
          setSettings(s => ({ ...s, il: location.il, location }));
          setQuery(location.name);
          setMessage('המיקום עודכן');
        } catch {
          setMessage('לא ניתן היה לזהות את שם המקום. הזמנים חושבו לפי המיקום שנמצא.');
          setSettings(s => ({ ...s, location: { ...s.location, name: 'המיקום שלי', latitude: coords.latitude, longitude: coords.longitude, tzid: Intl.DateTimeFormat().resolvedOptions().timeZone } }));
        }
      },
      error => setMessage(error.code === 1 ? 'לא ניתנה הרשאת מיקום. אפשר לחפש מקום ידנית.' : error.code === 3 ? 'איתור המיקום ארך זמן רב מדי. אפשר לחפש מקום ידנית.' : 'לא ניתן לאתר את המיקום כרגע.'),
      { timeout: 10000 },
    );
  };
  return (
    <div>
      <div className="zman-list" dir="rtl">
        {ZMANIM.map(([key, name, method]) => (
          <div className="zman-row" key={key}>
            <div>{name}<small>{method}</small></div>
            <time>{timeLabel(times?.[key], tz)}</time>
          </div>
        ))}
      </div>
      <p className="zman-note">
        חישוב במישור ללא תיקון גובה, באמצעות Hebcal. צאת שבת וחג לפי 8.5°. השיטות אינן מוסכמות לכל העדות — בירושלים ובחוץ־לארץ יש לבדוק את מנהג המקום.
      </p>
      <section className="loc-form" aria-label="הגדרות מיקום">
        <div className="active-location"><span>מיקום פעיל</span><strong>{settings.location.name}</strong><small>{settings.location.tzid}</small></div>
        <div className="location-search">
          <label htmlFor="location-search">חיפוש מקום</label>
          <div className="location-search-row"><input id="location-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ירושלים, לונדון, New York…" autoComplete="off"/><button type="button" className="locate-button" aria-label="איתור המיקום שלי" title="איתור המיקום שלי" onClick={locate}>◎</button></div>
          {(searching || suggestions.length > 0) && <div className="location-suggestions" role="listbox">{searching && <p>מחפש מקומות…</p>}{suggestions.map(place => <button type="button" role="option" key={`${place.latitude}-${place.longitude}-${place.name}`} onClick={() => chooseLocation(place)}>{place.name}</button>)}</div>}
        </div>
        <p role="status" style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>{message}</p>
        <ManualForm settings={settings} setSettings={setSettings} />
      </section>
    </div>
  );
}

function ManualForm({ settings, setSettings }) {
  const [form, setForm] = useState(settings.location);
  const [formMessage, setFormMessage] = useState('');
  return (
    <details>
      <summary style={{ cursor: 'pointer', fontSize: 13.5 }}>מיקום ידני · קואורדינטות ואזור זמן</summary>
      <form onSubmit={e => {
        e.preventDefault();
        try {
          new Intl.DateTimeFormat('he', { timeZone: form.tzid }).format();
          setSettings(s => ({ ...s, location: { ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) } }));
          setFormMessage('המיקום נשמר');
        } catch {
          setFormMessage('אזור הזמן אינו תקין');
        }
      }}>
        <label>שם המקום<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label>קו רוחב<input type="number" min="-90" max="90" step="any" required value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /></label>
        <label>קו אורך<input type="number" min="-180" max="180" step="any" required value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></label>
        <label>אזור זמן IANA<input dir="ltr" required value={form.tzid} onChange={e => setForm({ ...form, tzid: e.target.value })} /></label>
        <button className="ghost" type="submit">שמירת מיקום</button>
        <p role="status" style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>{formMessage}</p>
      </form>
    </details>
  );
}
