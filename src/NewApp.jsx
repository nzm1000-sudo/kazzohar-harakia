import { useState, useEffect } from 'react';
import { civilDateKey, jewishDateKey } from './civilDate.mjs';
import { zmanim, DEFAULT_SETTINGS } from './services.mjs';
import { useResource } from './hooks.jsx';
import { CAL } from './data/legacyData.mjs';
import Shell from './components/Shell.jsx';
import TodayPage from './pages/TodayPage.jsx';
import '@fontsource/frank-ruhl-libre/400.css';
import '@fontsource/frank-ruhl-libre/700.css';
import '@fontsource/heebo/400.css';
import '@fontsource/heebo/600.css';
import './styles/base.css';

const EVENTS = CAL.e;
const HEBREW = CAL.h;

export default function NewApp() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('kz-dark') === '1'; } catch { return false; } });
  useEffect(() => {
    try { localStorage.setItem('kz-dark', dark ? '1' : '0'); } catch {}
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);
  const [mode, setMode] = useState('today');
  const [query, setQuery] = useState('');
  const todayStr = civilDateKey(now);
  const solar = useResource(signal => zmanim(todayStr, DEFAULT_SETTINGS, signal), [todayStr]);
  const jewishKey = jewishDateKey(now, solar.data?.sunset);
  const hebrew = jewishKey ? HEBREW[jewishKey] : null;
  const events = (jewishKey ? EVENTS[jewishKey] : null) || EVENTS[todayStr] || [];
  const afterSunset = Boolean(jewishKey && jewishKey !== todayStr);
  const nav = id => { setMode(id); window.scrollTo({ top: 0 }); };

  return (
    <div dir="rtl">
      <Shell page={mode} onNav={nav} query={query} setQuery={setQuery} dark={dark} onToggleDark={() => setDark(v => !v)} />
      <main className="page">
        {query.trim()
          ? <p className="notice">החיפוש יחובר בשלב הבא · {query}</p>
          : mode === 'today'
            ? <TodayPage now={now} tz="Asia/Jerusalem" hebrew={hebrew} events={events} solar={solar} locationName="תל אביב" afterSunset={afterSunset} onNav={nav} />
            : <p className="notice">מסך זה נמצא בהעברה לעיצוב החדש · {mode}</p>}
      </main>
      <footer style={{ textAlign: 'center', padding: '18px 16px', color: 'var(--ink-2)', fontSize: 12, borderTop: '1px solid var(--line)' }}>
        כזוהר הרקיע · מבית ניצוצא · לעילוי נשמת הרבנית זהבית זוהרה בת אסתר
      </footer>
    </div>
  );
}
