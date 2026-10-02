import { ZMANIM, timeLabel } from '../services.mjs';
import LocationControl from '../components/LocationControl.jsx';
import TodayAlarmCard from '../components/jewishAlarm/TodayAlarmCard.jsx';
import TitleOrnament from '../components/ui/TitleOrnament.jsx';
import { clayBuildEnabled } from '../services/clayExperiment.mjs';

const CLAY = clayBuildEnabled();

export default function ZmanimPage({ T, solar, settings, setSettings, now = new Date(), go }) {
  const tz = settings.location.tzid;
  const times = solar?.data;
  // CLAY build only: a centred title with the ornament (an ordinary build is unchanged).
  return (
    <div className="zmanim-page">
      {CLAY && <header className="clay-page-head"><h1>זמני היום</h1><TitleOrnament /><p>{`לפי ${settings.location.name}`}</p></header>}
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
      {/* The place the times follow (a city, or the device's location). The manual place by coordinates, the halachic
          residence, the rite and accessibility live in הגדרות (pages/SettingsPage.jsx) — "שינוי מיקום" opens it there. */}
      <section className="loc-form" aria-label="מיקום הזמנים">
        <LocationControl settings={settings} setSettings={setSettings} />
        {go && <button type="button" className="index-row zman-settings-link" onClick={() => go('settings/location')}><span>שינוי מיקום<small>קואורדינטות, אזור זמן ומעמד הלכתי</small></span><span aria-hidden="true">←</span></button>}
      </section>
    </div>
  );
}
