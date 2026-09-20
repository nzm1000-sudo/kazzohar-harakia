
import { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { civilDateKey, jewishDateKey, shiftCivilDate } from './civilDate.mjs';
import { zmanim, calendar, DEFAULT_SETTINGS } from './services.mjs';
import { useResource, useLocal } from './hooks.jsx';
import { dayContext } from './dayContext.mjs';
import ZmanimPage from './pages/ZmanimPage.jsx';
import { HalachaPage, SiddurPage, ParashaPage } from './pages/BooksPage.jsx';
import HalachaLibrary, { parseHalachaRoute } from './pages/HalachaLibrary.jsx';
import TalmudPage, { parseTalmudRoute } from './pages/TalmudPage.jsx';
import { LearningPage, SearchPage } from './pages/LearningSearch.jsx';
import SourceReader from './components/SourceReader.jsx';
import { CAL } from './data/legacyData.mjs';
import Shell from './components/Shell.jsx';
import TodayPage from './pages/TodayPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Tehillim from './Tehillim.jsx';
import { Library } from './Library.jsx';
import SefariaPanel from './SefariaPanel.jsx';
import AboutPage from './pages/AboutPage.jsx';
import OfflineLibrary from './pages/OfflineLibrary.jsx';
import PersonalTools from './pages/PersonalTools.jsx';
import PrayerCompass from './pages/PrayerCompass.jsx';
import { getLearningMemory } from './services/learningMemory.mjs';
import { getDailyProgress, setDailyCompletion } from './services/dailyLearning.mjs';
import { backAction } from './navigation.mjs';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import '@fontsource/heebo/400.css';
import '@fontsource/heebo/600.css';
// Heebo's Hebrew subset has no glyphs for te'amim (U+0591–U+05AF), meteg, paseq or sof pasuq.
// Noto Sans Hebrew is the per-glyph fallback for UI text; Noto Serif Hebrew is the reading face.
import '@fontsource/noto-sans-hebrew/hebrew-400.css';
import '@fontsource/noto-sans-hebrew/hebrew-600.css';
import '@fontsource/noto-serif-hebrew/hebrew-400.css';
import '@fontsource/noto-serif-hebrew/hebrew-700.css';
import './styles/base.css';

const EVENTS = CAL.e;
const HEBREW = CAL.h;

export default function NewApp() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('kz-theme') || (localStorage.getItem('kz-dark') === '1' ? 'dark' : 'light'); } catch { return 'light'; } });
  useEffect(() => {
    try { localStorage.setItem('kz-theme', theme); } catch {}
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const [settings,setSettings]=useLocal('companion-settings-v2',DEFAULT_SETTINGS);
  const [mode, setMode] = useState(()=>location.hash.slice(1)||'today');
  const [query, setQuery] = useState('');
  const [source,setSource]=useState(null);
  const [psalm,setPsalm]=useState(null);
  const [dailyTehillim,setDailyTehillim]=useState(false);
  useEffect(()=>{const previousRestoration=history.scrollRestoration;history.scrollRestoration='manual';history.replaceState({ ...(history.state || {}), source: history.state?.source || null, kzDepth: 0 },'',location.href);let lastSignature=`${location.hash}|${JSON.stringify(history.state?.source||null)}`;const sync=state=>{const source=state?.source||null;const signature=`${location.hash}|${JSON.stringify(source)}`;if(signature===lastSignature)return;lastSignature=signature;setMode(location.hash.slice(1)||'today');setSource(source);setQuery('');};const change=()=>sync(history.state);const pop=event=>sync(event.state);window.addEventListener('hashchange',change);window.addEventListener('popstate',pop);return()=>{history.scrollRestoration=previousRestoration;window.removeEventListener('hashchange',change);window.removeEventListener('popstate',pop);};},[]);
  useEffect(() => { const frame = requestAnimationFrame(() => window.scrollTo(0, 0)); return () => cancelAnimationFrame(frame); }, [mode, source]);
  const todayStr = civilDateKey(now,settings.location.tzid);
  const solar = useResource(signal => zmanim(todayStr, settings, signal), [todayStr,JSON.stringify(settings)]);
  const calendarResource=useResource(signal=>calendar(todayStr,shiftCivilDate(todayStr,40),settings,signal),[todayStr,JSON.stringify(settings)]);
  const context=dayContext(now,settings,solar.data,calendarResource.data||[]);
  const hebrew = context.key ? HEBREW[context.key] || context.date?.label : null;
  const [dailyProgress, setDailyProgress] = useState(() => getDailyProgress(context.key));
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => { setDailyProgress(getDailyProgress(context.key)); }, [context.key]);
  useEffect(() => { const on = () => setOnline(true); const off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  useEffect(() => { if (import.meta.env.VITE_NATIVE !== 'true' && 'serviceWorker' in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}); }, []);
  const closeOverlayOrBack = () => {
    const action = backAction({
      overlay: Boolean(document.querySelector('.sheet, .theme-menu, .memorial-backdrop')),
      source: Boolean(source),
      depth: Number(history.state?.kzDepth || 0),
    });
    if (action === 'overlay') {
      window.dispatchEvent(new Event('kz-native-close-overlay'));
      return true;
    }
    if (action === 'history') {
      window.history.back();
      return true;
    }
    return false;
  };
  useEffect(() => {
    if (import.meta.env.VITE_NATIVE !== 'true') return undefined;
    const listener = App.addListener('backButton', () => { closeOverlayOrBack(); });
    return () => { listener.then(handle => handle.remove()); };
  }, [source]);
  const nav = (id, options = {}) => {
    history.pushState({ ...(history.state || {}), source: null, kzDepth: Number(history.state?.kzDepth || 0) + 1 },'',`#${id}`);
    setMode(id);setQuery('');setSource(null);setDailyTehillim(id === 'tehillim' && options.daily === true);
    if (id === 'tehillim' && options.daily) setPsalm(null);
  };
  const go = id => { history.pushState({ ...(history.state || {}), source:null, kzDepth: Number(history.state?.kzDepth || 0) + 1 },'',`#${id}`); setMode(id); setSource(null); };
  const openSource=(reference,title,mode='nikud',navigation)=>{const next={reference,title,mode,navigation};history.pushState({ ...(history.state || {}), source:{reference,title,mode}, kzDepth: Number(history.state?.kzDepth || 0) + 1 },'',location.href);setSource(next);};
  const openPsalm=chapter=>{setPsalm(chapter);nav('tehillim');};
  const resume = Object.entries(getLearningMemory()).map(([id, item]) => ({ id, ...item })).filter(item => item.reference && item.status !== 'completed').sort((a, b) => (b.lastOpenedAt || '').localeCompare(a.lastOpenedAt || '')).slice(0, 3);
  const resumeLearning = item => {
    if (item.source === 'talmud') return go(`talmud/${encodeURIComponent(item.tractate)}/${item.amud}`);
    if (item.source === 'tehillim') return setPsalm(item.chapter), nav('tehillim');
    openSource(item.reference, item.title);
  };
  const completeDaily = (id, completed) => setDailyProgress(setDailyCompletion(context.key, id, completed));
  const dailyItems = context.key ? [
    { id: 'tehillim', kind: 'תהילים', title: 'תהילים היום', subtitle: 'לא התחלת', onOpen: () => nav('tehillim', { daily: true }) },
    ...(context.additions || []).map(addition => ({ id: `prayer:${addition.text}`, kind: 'תפילה', title: addition.text, subtitle: 'לתפילה של היום', onOpen: () => nav('siddur') })),
  ] : [];
  const T = { card: 'var(--surface)', border: 'var(--line)', gold: 'var(--accent)', muted: 'var(--ink-2)', text: 'var(--ink)', blue: 'var(--focus)' };

  return (
    <AppErrorBoundary><div dir="rtl">
      {!online && <div className="offline-banner" role="status">אין חיבור לרשת · התוכן השמור וההעדפות עדיין זמינים</div>}
      <Shell page={mode} onNav={nav} query={query} setQuery={setQuery} theme={theme} setTheme={setTheme} />
      <main className="page">
        {source ? <SourceReader key={source.reference} {...source} onClose={()=>history.back()}/>
          : query.trim() ? <SearchPage query={query} context={context} onNav={nav} openSource={openSource} openPsalm={openPsalm}/>
          : mode==='calendar' ? <CalendarPage today={todayStr} settings={settings} openSource={openSource}/>
          : mode==='times' || mode==='settings' ? <ZmanimPage solar={solar} settings={settings} setSettings={setSettings}/>
          : mode==='tehillim' ? <Tehillim T={T} initialChapter={psalm} dailyDay={dailyTehillim ? context.date?.day : null}/>
          : mode==='halacha' || mode.startsWith('halacha/') ? <HalachaLibrary route={parseHalachaRoute(mode)} openSource={openSource} go={go} back={()=>history.back()}/>
          : mode==='talmud' || mode.startsWith('talmud/') ? <TalmudPage route={parseTalmudRoute(mode)} go={go}/>
          : mode==='siddur' ? <SiddurPage context={context} openSource={openSource} onOpenCompass={() => nav('siddur-compass')}/>
          : mode==='siddur-compass' ? <PrayerCompass settings={settings} setSettings={setSettings} onBack={() => history.back()}/>
          : mode==='parasha' ? <ParashaPage context={context} settings={settings} openSource={openSource}/>
          : mode==='personal-tools' || mode.startsWith('personal-tools/') ? <PersonalTools route={mode} settings={settings} openSource={openSource}/>
          : mode==='learning' ? <LearningPage context={context} settings={settings} openSource={openSource} onNav={nav} go={go}/>
          : mode==='sefaria' ? <SearchPage query={query||'תפילה'} context={context} onNav={nav} openSource={openSource} openPsalm={openPsalm}/>
          : mode==='about' ? <AboutPage />
          : mode==='offline' ? <OfflineLibrary />
            : <TodayPage
              now={now}
              tz={settings.location.tzid}
              hebrew={hebrew}
              events={context.events}
              solar={solar}
              locationName={settings.location.name}
              afterSunset={context.afterSunset}
              context={context}
              settings={settings}
              setSettings={setSettings}
                onNav={nav}
                resume={resume}
                onResume={resumeLearning}
                dailyItems={dailyItems}
                dailyProgress={dailyProgress}
                onCompleteDaily={completeDaily}/>
              }

      </main>
      <footer style={{ textAlign: 'center', padding: '18px 16px', color: 'var(--ink-2)', fontSize: 12, borderTop: '1px solid var(--line)' }}>
        כזוהר הרקיע · מבית ניצוצא · לעילוי נשמת הרבנית זהבית זוהרה בת אסתר
      </footer>
    </div></AppErrorBoundary>
  );
}
