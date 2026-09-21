
import { useState, useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { civilDateKey, shiftCivilDate } from './civilDate.mjs';
import { formatVisibleSourceTitle } from './services/tanakhReferences.mjs';
import { zmanim, calendar, DEFAULT_SETTINGS } from './services.mjs';
import { useResource, useLocal } from './hooks.jsx';
import { dayContext } from './dayContext.mjs';
import ZmanimPage from './pages/ZmanimPage.jsx';
import { BooksCatalog, SiddurPage, ParashaPage } from './pages/BooksPage.jsx';
import HalachaLibrary, { parseHalachaRoute } from './pages/HalachaLibrary.jsx';
import TalmudPage, { parseTalmudRoute } from './pages/TalmudPage.jsx';
import { LearningPage, SearchPage } from './pages/LearningSearch.jsx';
import SourceReader from './components/SourceReader.jsx';
import { CAL } from './data/legacyData.mjs';
import Shell from './components/Shell.jsx';
import TodayPage from './pages/TodayPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Tehillim from './Tehillim.jsx';
import AboutPage from './pages/AboutPage.jsx';
import DebugJewishContextPage from './pages/DebugJewishContextPage.jsx';
import ForgottenAddition from './pages/ForgottenAddition.jsx';
import ShabbatTable from './pages/ShabbatTable.jsx';
import ShabbatPage from './pages/ShabbatPage.jsx';
import TravelMode from './pages/TravelMode.jsx';
import OfflineLibrary from './pages/OfflineLibrary.jsx';
import PersonalTools from './pages/PersonalTools.jsx';
import PrayerCompass from './pages/PrayerCompass.jsx';
import { getLearningMemory } from './services/learningMemory.mjs';
import { getDailyProgress, setDailyCompletion } from './services/dailyLearning.mjs';
import { activePreparation, remainingCount } from './services/preparationPlan.mjs';
import { loadPreparation } from './services/preparationStorage.mjs';
import { getTrip, loadTravel } from './services/travelStorage.mjs';
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

const HEBREW = CAL.h;

export default function NewApp() {
  const [now, setNow] = useState(() => new Date());
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
  const depthRef = useRef(0);
  const signatureRef = useRef(null);
  const routeSignature = source => `${location.hash}|${JSON.stringify(source || null)}`;
  useEffect(()=>{const previousRestoration=history.scrollRestoration;history.scrollRestoration='manual';history.replaceState({ ...(history.state || {}), source: history.state?.source || null, kzDepth: 0 },'',location.href);signatureRef.current=routeSignature(history.state?.source);const sync=state=>{const source=state?.source||null;const signature=routeSignature(source);if(signature===signatureRef.current)return;signatureRef.current=signature;setMode(location.hash.slice(1)||'today');setSource(source);setQuery('');setDailyTehillim(false);};
  // Plain <a href="#…"> navigation fires popstate(null state) + hashchange; stamp those entries so hardware back keeps working.
  const change=()=>{if(history.state===null||typeof history.state?.kzDepth!=='number'){history.replaceState({ source:null, kzDepth: depthRef.current + 1 },'',location.href);}depthRef.current=Number(history.state?.kzDepth||0);sync(history.state);};const pop=event=>{if(event.state===null)return;depthRef.current=Number(event.state?.kzDepth||0);sync(event.state);};window.addEventListener('hashchange',change);window.addEventListener('popstate',pop);return()=>{history.scrollRestoration=previousRestoration;window.removeEventListener('hashchange',change);window.removeEventListener('popstate',pop);};},[]);
  useEffect(() => { const frame = requestAnimationFrame(() => window.scrollTo(0, 0)); return () => cancelAnimationFrame(frame); }, [mode, source]);
  const todayStr = civilDateKey(now,settings.location.tzid);
  const solarToday = useResource(signal => zmanim(todayStr, settings, signal), [todayStr,JSON.stringify(settings)]);
  const nextSolar = useResource(signal => zmanim(shiftCivilDate(todayStr, 1), settings, signal), [todayStr,JSON.stringify(settings)]);
  const solar = { ...solarToday, data: solarToday.data ? { ...solarToday.data, nextDay: nextSolar.data } : null };
  const calendarResource=useResource(signal=>calendar(todayStr,shiftCivilDate(todayStr,40),settings,signal),[todayStr,JSON.stringify(settings)]);
  const context=dayContext(now,settings,solar.data,calendarResource.data||[]);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    document.addEventListener('visibilitychange', refresh);
    const resume = App.addListener('resume', refresh);
    return () => { document.removeEventListener('visibilitychange', refresh); resume.then(handle => handle.remove()); };
  }, []);
  useEffect(() => {
    const nextBoundary = (context.timeline || [])
      .map(item => new Date(item.at))
      .filter(value => Number.isFinite(value.getTime()) && value > now)
      .sort((a, b) => a - b)[0];
    const delay = nextBoundary ? Math.max(1000, nextBoundary.getTime() - now.getTime() + 1000) : 30 * 60 * 1000;
    const timer = setTimeout(() => setNow(new Date()), delay);
    return () => clearTimeout(timer);
  }, [now, context.timeline?.map(item => `${item.key}:${item.at}`).join('|')]);
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
  const pushRoute = (id, source = null) => {
    const kzDepth = Number(history.state?.kzDepth || 0) + 1;
    history.pushState({ ...(history.state || {}), source, kzDepth }, '', id === null ? location.href : `#${id}`);
    depthRef.current = kzDepth;
    signatureRef.current = routeSignature(source);
  };
  const nav = (id, options = {}) => {
    pushRoute(id);
    setMode(id);setQuery('');setSource(null);setDailyTehillim(id === 'tehillim' && options.daily === true);
    if (id === 'tehillim' && options.daily) setPsalm(null);
  };
  const go = id => { pushRoute(id); setMode(id); setSource(null); };
  const openSource=(reference,title,mode='nikud',navigation)=>{const displayTitle=formatVisibleSourceTitle(title,reference);const next={reference,title:displayTitle,mode,navigation};pushRoute(null,{reference,title:displayTitle,mode});setSource(next);};
  const openPsalm=chapter=>{setPsalm(chapter);nav('tehillim');};
  const resume = Object.entries(getLearningMemory()).map(([id, item]) => ({ id, ...item, title: formatVisibleSourceTitle(item.title, item.reference) })).filter(item => item.reference && item.status !== 'completed').sort((a, b) => (b.lastOpenedAt || '').localeCompare(a.lastOpenedAt || '')).slice(0, 3);
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
  const preparationPlan = activePreparation({ now, tz: settings.location.tzid, currentJewishKey: context.key, items: calendarResource.data || [] });
  const preparation = preparationPlan.kind === 'none' ? { active: false } : {
    active: true,
    name: preparationPlan.name,
    candles: preparationPlan.candles,
    remaining: remainingCount(preparationPlan, loadPreparation()),
  };
  const travelState = loadTravel();
  const activeTrip = travelState.activeTripId ? getTrip(travelState, travelState.activeTripId) : null;
  const travel = activeTrip ? { active: true, name: activeTrip.destination.name, tzid: activeTrip.destination.tzid } : { active: false };

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
          : mode==='books' ? <BooksCatalog openSource={openSource}/>
          : mode==='talmud' || mode.startsWith('talmud/') ? <TalmudPage route={parseTalmudRoute(mode)} go={go}/>
          : mode==='siddur' ? <SiddurPage context={context} openSource={openSource} onOpenCompass={() => nav('siddur-compass')}/>
          : mode==='siddur-compass' ? <PrayerCompass settings={settings} setSettings={setSettings} onBack={() => history.back()}/>
          : mode==='parasha' ? <ParashaPage context={context} settings={settings} openSource={openSource}/>
          : mode==='personal-tools' || mode.startsWith('personal-tools/') ? <PersonalTools route={mode} settings={settings} openSource={openSource}/>
          : mode==='learning' ? <LearningPage context={context} settings={settings} openSource={openSource} onNav={nav} go={go}/>
          : mode==='sefaria' ? <SearchPage query={query||'תפילה'} context={context} onNav={nav} openSource={openSource} openPsalm={openPsalm}/>
          : mode==='about' ? <AboutPage onNav={nav} />
          : mode==='preparation' || mode.startsWith('preparation/') ? <ShabbatPage now={now} settings={settings} items={calendarResource.data||[]} context={context}/>
          : mode==='forgotten-addition' ? <ForgottenAddition />
          : mode==='shabbat-table' ? <ShabbatTable context={context} openSource={openSource}/>
          : mode==='shabbat-page' ? <ShabbatPage now={now} settings={settings} items={calendarResource.data||[]} context={context}/>
          : mode==='travel' || mode.startsWith('travel/') ? <TravelMode route={mode} now={now} settings={settings} items={calendarResource.data||[]} onNav={nav}/>
          : mode==='debug/jewish-context' ? <DebugJewishContextPage now={now} settings={settings} solar={solar} calendarResource={calendarResource} context={context} hebrew={hebrew} todayStr={todayStr}/>
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
                onCompleteDaily={completeDaily}
                preparation={preparation}
                travel={travel}/>
              }

      </main>
      <footer style={{ textAlign: 'center', padding: '18px 16px', color: 'var(--ink-2)', fontSize: 12, borderTop: '1px solid var(--line)' }}>
        כזוהר הרקיע · מבית ניצוצא · לעילוי נשמת הרבנית זהבית זוהרה בת אסתר
      </footer>
    </div></AppErrorBoundary>
  );
}
