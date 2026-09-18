import { useState } from 'react';
import { ZMANIM, timeLabel } from '../services.mjs';
import LocationControl from '../components/LocationControl.jsx';

export default function ZmanimPage({ T, solar, settings, setSettings }) {
  const tz = settings.location.tzid;
  const times = solar?.data;
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
        <LocationControl settings={settings} setSettings={setSettings} />
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
