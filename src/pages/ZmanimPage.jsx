import { useState } from 'react';
import { CITIES, ZMANIM, timeLabel } from '../services.mjs';

export default function ZmanimPage({ T, solar, settings, setSettings }) {
  const [message, setMessage] = useState('');
  const tz = settings.location.tzid;
  const times = solar?.data;
  const locate = () => {
    if (!navigator.geolocation) return setMessage('המכשיר אינו תומך באיתור מיקום. בחרו עיר מהרשימה.');
    setMessage('מאתר מיקום…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setSettings(s => ({ ...s, location: { name: 'המיקום שלי', latitude: coords.latitude, longitude: coords.longitude, tzid: Intl.DateTimeFormat().resolvedOptions().timeZone } }));
        setMessage('המיקום עודכן. אימתו את אזור הזמן למטה.');
      },
      () => setMessage('לא ניתנה הרשאת מיקום. ניתן לבחור עיר או להזין קואורדינטות ידנית.'),
      { timeout: 10000 },
    );
  };
  return (
    <div>
      <Status />
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
        <label>עיר
          <select value={CITIES.findIndex(c => c.name === settings.location.name)} onChange={e => {
            const city = CITIES[Number(e.target.value)];
            if (city) setSettings(s => ({ ...s, location: city, il: city.il }));
          }}>
            <option value="-1" disabled>מיקום מותאם</option>
            {CITIES.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
          </select>
        </label>
        <button className="ghost" onClick={locate}>◎ איתור המיקום שלי</button>
        <p role="status" style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>{message}</p>
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13.5 }}>מיקום ידני</summary>
          <ManualForm settings={settings} setSettings={setSettings} />
        </details>
      </section>
    </div>
  );
}

function Status() {}
