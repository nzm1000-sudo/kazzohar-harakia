
import { useState, useEffect } from 'react';
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
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('kz-dark') === '1'; } catch { return false; } });
  useEffect(() => {
    try { localStorage.setItem('kz-dark', dark ? '1' : '0'); } catch {}
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);
  const [settings,setSettings]=useLocal('companion-settings-v2',DEFAULT_SETTINGS);
  const [mode, setMode] = useState(()=>location.hash.slice(1)||'today');
  const [query, setQuery] = useState('');
  const [source,setSource]=useState(null);
  const [psalm,setPsalm]=useState(null);
  useEffect(()=>{history.replaceState(history.state||{source:null},'',location.href);const change=()=>{setMode(location.hash.slice(1)||'today');setSource(history.state?.source||null);setQuery('');};const pop=event=>{setMode(location.hash.slice(1)||'today');setSource(event.state?.source||null);};window.addEventListener('hashchange',change);window.addEventListener('popstate',pop);return()=>{window.removeEventListener('hashchange',change);window.removeEventListener('popstate',pop);};},[]);
  const todayStr = civilDateKey(now,settings.location.tzid);
  const solar = useResource(signal => zmanim(todayStr, settings, signal), [todayStr,JSON.stringify(settings)]);
  const calendarResource=useResource(signal=>calendar(todayStr,shiftCivilDate(todayStr,40),settings,signal),[todayStr,JSON.stringify(settings)]);
  const context=dayContext(now,settings,solar.data,calendarResource.data||[]);
  const hebrew = context.key ? HEBREW[context.key] || context.date?.label : null;
  const nav = id => { setMode(id);setQuery('');setSource(null);location.hash=id; window.scrollTo({ top: 0 }); };
  const go = id => { history.pushState({source:null},'',`#${id}`); setMode(id); setSource(null); window.scrollTo({top:0}); };
  const openSource=(reference,title,mode='nikud',navigation)=>{const next={reference,title,mode,navigation};history.pushState({source:{reference,title,mode}},'',location.href);setSource(next);window.scrollTo({top:0});};
  const openPsalm=chapter=>{setPsalm(chapter);nav('tehillim');};
  const T = { card: 'var(--surface)', border: 'var(--line)', gold: 'var(--accent)', muted: 'var(--ink-2)', text: 'var(--ink)', blue: 'var(--focus)' };

  return (
    <div dir="rtl">
      <Shell page={mode} onNav={nav} query={query} setQuery={setQuery} dark={dark} onToggleDark={() => setDark(v => !v)} />
      <main className="page">
        {source ? <SourceReader key={source.reference} {...source} onClose={()=>history.back()}/>
          : query.trim() ? <SearchPage query={query} context={context} onNav={nav} openSource={openSource} openPsalm={openPsalm}/>
          : mode==='calendar' ? <CalendarPage today={todayStr} settings={settings} openSource={openSource}/>
          : mode==='times' || mode==='settings' ? <ZmanimPage solar={solar} settings={settings} setSettings={setSettings}/>
          : mode==='tehillim' ? <Tehillim T={T} initialChapter={psalm} hebrewDay={context.date?.day}/>
          : mode==='halacha' || mode.startsWith('halacha/') ? <HalachaLibrary route={parseHalachaRoute(mode)} openSource={openSource} go={go} back={()=>history.back()}/>
          : mode==='talmud' || mode.startsWith('talmud/') ? <TalmudPage route={parseTalmudRoute(mode)} go={go}/>
          : mode==='siddur' ? <SiddurPage context={context} openSource={openSource}/>
          : mode==='parasha' ? <ParashaPage context={context} settings={settings} openSource={openSource}/>
          : mode==='learning' ? <LearningPage context={context} settings={settings} openSource={openSource} onNav={nav} go={go}/>
          : mode==='sefaria' ? <SearchPage query={query||'תפילה'} context={context} onNav={nav} openSource={openSource} openPsalm={openPsalm}/>
            : <TodayPage
              now={now}
              tz={settings.location.tzid}
              hebrew={hebrew}
              events={context.events}
              solar={solar}
              locationName={settings.location.name}
              afterSunset={context.afterSunset}
              context={context}
                onNav={nav}/>
              }

      </main>
      <footer style={{ textAlign: 'center', padding: '18px 16px', color: 'var(--ink-2)', fontSize: 12, borderTop: '1px solid var(--line)' }}>
        כזוהר הרקיע · מבית ניצוצא · לעילוי נשמת הרבנית זהבית זוהרה בת אסתר
      </footer>
    </div>
  );
}
