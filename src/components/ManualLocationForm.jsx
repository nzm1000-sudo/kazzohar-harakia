import { useEffect, useState } from 'react';
import ArrowMark from './ui/ArrowMark.jsx';

// מיקום ידני · קואורדינטות ואזור זמן — a place by its coordinates and its IANA time zone. Shown in הגדרות › מיקום
// (pages/SettingsPage.jsx); it was on the זמנים page until the settings page was made (owner, 2026-10-02). The logic
// and the stored record are unchanged: settings.location ← { name, latitude, longitude, tzid } after the zone is checked.
export default function ManualLocationForm({ settings, setSettings }) {
  const [form, setForm] = useState(settings.location);
  const [formMessage, setFormMessage] = useState('');
  // Keep the manual fields in step with a city picked in LocationControl above.
  useEffect(() => { setForm(settings.location); }, [settings.location]);
  return (
    <details className="manual-location">
      <summary style={{ cursor: 'pointer', fontSize: 'var(--font-ui-caption)' }}>מיקום ידני · קואורדינטות ואזור זמן<ArrowMark dir="down" size="inline" clayOnly /></summary>
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
        <p role="status" style={{ margin: 0, fontSize: 'var(--font-ui-caption)', color: 'var(--ink-2)' }}>{formMessage}</p>
      </form>
    </details>
  );
}
