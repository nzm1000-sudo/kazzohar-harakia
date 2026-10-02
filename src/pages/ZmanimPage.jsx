import { useEffect, useState } from 'react';
import DiasporaIndicator from '../components/DiasporaIndicator.jsx';
import { ZMANIM, timeLabel } from '../services.mjs';
import LocationControl from '../components/LocationControl.jsx';
import { NUSACHIM } from '../data/nusach/registry.mjs';
import TodayAlarmCard from '../components/jewishAlarm/TodayAlarmCard.jsx';
import Selector from '../components/ui/Selector.jsx';
import { Segmented } from '../components/jewishAlarm/AlarmParts.jsx';
import TitleOrnament from '../components/ui/TitleOrnament.jsx';
import { clayBuildEnabled } from '../services/clayExperiment.mjs';

const CLAY = clayBuildEnabled();

export default function ZmanimPage({ T, solar, settings, setSettings, now = new Date(), go }) {
  const tz = settings.location.tzid;
  const times = solar?.data;
  // CLAY build only: a centred title with the ornament (an ordinary build is unchanged). In Clay, עוד holds both זמנים
  // and הגדרות, which open this one page; the title names the one that was chosen.
  const settingsTitle = CLAY && typeof location !== 'undefined' && /^#settings\b/.test(location.hash);
  return (
    <div className="zmanim-page">
      {CLAY && <header className="clay-page-head"><h1>{settingsTitle ? 'הגדרות' : 'זמני היום'}</h1><TitleOrnament /><p>{settingsTitle ? 'מיקום, נוסח, מעמד הלכתי ונגישות' : `לפי ${settings.location.name}`}</p></header>}
      {/* "השעון היהודי" first: the alarm that follows these very times (the same compact entry as on Today). */}
      <TodayAlarmCard settings={settings} now={now} onOpen={() => (go ? go('jewish-alarm') : (window.location.hash = '#jewish-alarm'))} />
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
        <ProfileForm settings={settings} setSettings={setSettings} />
        <ManualForm settings={settings} setSettings={setSettings} />
      </section>
      {/* נגישות: one quiet entry at the end of the settings. */}
      {go && <section className="profile-form a11y-entry" aria-labelledby="a11y-entry-title">
        <p className="eyebrow" id="a11y-entry-title">נגישות</p>
        <button type="button" className="index-row" onClick={() => go('accessibility')}><span>גודל טקסט, ניגודיות, תנועה וקריאה</span><span aria-hidden="true">←</span></button>
      </section>}
    </div>
  );
}

function ProfileForm({ settings, setSettings }) {
  return <section className="profile-form" aria-label="פרופיל הלכתי">
    <p className="eyebrow">פרופיל הלכתי</p>
    <Selector label="נוסח התפילה" value={settings.nusach || 'edot-hamizrach'} onChange={nusach => setSettings(s => ({ ...s, nusach }))} options={NUSACHIM.map(item => [item.id, item.title, item.subtitle])} />
    <p className="zman-note">נוסח ספרד הוא נוסח החסידים; נוסח עדות המזרח הוא נוסח הספרדים ועדות המזרח. הבחירה משנה את נוסח התפילה ואת סדרה בסידור.</p>
    <div className="ui-field"><span className="ui-field-label" aria-hidden="true">מעמד הלכתי</span><Segmented label="מעמד הלכתי" value={settings.residenceChoice || settings.halachicResidenceStatus || (settings.il ? 'israel' : 'diaspora')} onChange={status => setSettings(s => ({ ...s, halachicResidenceStatus: status, residenceChoice: undefined }))} options={[['israel', 'תושב ישראל'], ['diaspora', 'תושב חו״ל']]} /></div>
    <p className="zman-note">המיקום הפעיל קובע זמנים ואזור זמן. הוא אינו משנה את המעמד ההלכתי שבחרת.</p>
    <DiasporaIndicator settings={settings} setSettings={setSettings} compact />
  </section>;
}

function ManualForm({ settings, setSettings }) {
  const [form, setForm] = useState(settings.location);
  const [formMessage, setFormMessage] = useState('');
  // Keep the manual fields in step with a city picked in LocationControl above.
  useEffect(() => { setForm(settings.location); }, [settings.location]);
  return (
    <details>
      <summary style={{ cursor: 'pointer', fontSize: 'var(--font-ui-caption)' }}>מיקום ידני · קואורדינטות ואזור זמן</summary>
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
