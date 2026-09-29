import { useState, useEffect, useMemo } from 'react';
import { useResource } from '../hooks.jsx';
import { formatGregorianDate } from '../civilDate.mjs';
import { learningSchedule, search } from '../services/sefaria.mjs';
import { normalizeHebrew } from '../content.mjs';
import TorahSearchResults from '../components/TorahSearchResults.jsx';
import { isOnline, localSections, remoteSearch } from '../services/torah/globalSearch.mjs';
import { rememberSearch, suggestSearches } from '../services/torah/searchHistory.mjs';
import { ResourceState } from '../components/SourceReader.jsx';
import { dafYomiTarget } from '../services/talmud.mjs';
import { talmudRoute } from './TalmudPage.jsx';
import { ShalomRavSearchGroup } from './ShalomRavPage.jsx';
export function LearningPage({context,settings,openSource,onNav,go}) {
  const resource=useResource(()=>learningSchedule(context.civil,settings.il),[context.civil,settings.il]);
  const entries=(resource.data||[]).filter(e=>e.ref&&['Daf Yomi','Daily Mishnah','Daily Rambam','Daily Rambam (3 Chapters)','Halakhah Yomit'].includes(e.title?.en));
  const openEntry=e=>{ if(e.title?.en==='Daf Yomi'&&go){ const t=dafYomiTarget(e.ref); if(t?.tractate) return go(talmudRoute.amud(t.tractate,t.amud)); } openSource(e.ref,e.title.he); };
  const dafNote=(()=>{const d=entries.find(e=>e.title?.en==='Daf Yomi'); const t=d?dafYomiTarget(d.ref):null; return t?.unsupported?t.note:null;})();
  return <section><p className="eyebrow">קביעות קטנה, בכל יום</p><h1>הלימוד היומי</h1><p className="intro">{formatGregorianDate(context.civil)}{context.date?.label?` · ${context.date.label}`:''} · לוח הלימוד של ספריא לפי התאריך האזרחי.</p>{dafNote&&<p className="notice">{dafNote}</p>}<ResourceState resource={resource}/><div className="daily-learning-cards">{entries.map((e,i)=><button className={`daily-learning-card tone-${i%5}`} key={e.ref} onClick={()=>openEntry(e)}><span className="daily-learning-badge">{String(i+1).padStart(2,'0')}</span><span className="daily-learning-card-text"><strong>{e.title.he}</strong><small>{e.displayValue?.he||e.ref}{e.title?.en==='Daf Yomi'&&dafYomiTarget(e.ref)?.tractate?' · נפתח עם ביאור שטיינזלץ':''}</small></span><span className="daily-learning-card-arrow" aria-hidden="true">←</span></button>)}<button className="daily-learning-card" onClick={() => onNav?.('offline')}><span className="daily-learning-card-text"><strong>תוכן ללא אינטרנט</strong><small>שמירת מקורות ללימוד גם בלי חיבור</small></span><span className="daily-learning-card-arrow" aria-hidden="true">←</span></button></div></section>;
}
// The header search: the Torah Engine on the device first (a reference, books, the app's topics, the full text of every
// indexed corpus), and the provider's online search only as an extra group, marked as such, asked only when online.
export function SearchPage({query,context,onNav,openSource,openPsalm}) {
  const text=String(query||'').trim();
  const [remote,setRemote]=useState({status:'idle',hits:[]});
  useEffect(()=>{let active=true;setRemote({status:isOnline()?'loading':'offline',hits:[]});if(!isOnline())return()=>{active=false;};const timer=setTimeout(()=>remoteSearch(text,{search}).then(result=>{if(active)setRemote(result);}),650);return()=>{active=false;clearTimeout(timer);};},[text]);
  const local=useMemo(()=>localSections(text),[text]);
  const openTarget=target=>{rememberSearch(text);return target?.route?onNav(target.route):target?.source?openSource(target.source.reference,target.source.title):null;};
  return <GlobalSearchView query={text} context={context} local={local} remote={remote} recent={suggestSearches(text)} onNav={onNav} openTarget={openTarget} openSource={openSource} openPsalm={openPsalm}
    torah={<TorahSearchResults query={text} family="all" onOpen={hit=>openTarget(hit.target)} onSuggest={null} heading="בתוך המקורות · במכשיר" onManagePacks={()=>onNav('offline')} />}
    shalomRav={<ShalomRavSearchGroup query={query} onNav={onNav}/>} />;
}
// The view alone (no effects), so a test renders exactly what the phone shows for a given state.
export function GlobalSearchView({query,context,local,remote,onNav,openTarget,openSource,openPsalm,torah=null,shalomRav=null,recent=[]}) {
  const events=[...(context?.events||[]),...(context?.upcomingHoliday?[context.upcomingHoliday]:[])].filter(e=>normalizeHebrew(e.hebrew||e.title).includes(normalizeHebrew(query)));
  const wantsTimes=/שקיע|זמנים|נכנסת שבת|צאת|נרות/.test(query);
  return <section className="global-search"><p className="eyebrow">חיפוש בכל הספרייה</p><h1>״{query}״</h1>
    {recent.length>0&&<p className="global-search-recent" aria-label="חיפושים קודמים במכשיר">חיפשת בעבר: {recent.map(item=><a key={item} className="link" href="#" onClick={event=>{event.preventDefault();window.dispatchEvent(new CustomEvent('kz-global-search',{detail:item}));}}>{item}</a>)}</p>}
    {wantsTimes&&<button className="index-row" onClick={()=>onNav('times')}><strong>זמני היום וכניסת שבת</strong><span>לפי המיקום שלך ←</span></button>}
    {events.map(e=><button className="index-row" key={`${e.date}-${e.hebrew||e.title}`} onClick={()=>onNav('calendar')}>{e.hebrew||e.title}<small>{formatGregorianDate(e.date)}</small></button>)}
    {local.reference&&<section className="search-group"><h2>מראה מקום</h2><button className="index-row" onClick={()=>onNav(local.reference.route)}>{local.reference.label}<small>מקום מדויק · במכשיר</small></button></section>}
    {local.books.length>0&&<section className="search-group"><h2>ספרים</h2>{local.books.map(book=><button className="index-row" key={book.id} onClick={()=>onNav(book.route)}>{book.title}<small>{book.local?'בספרייה שבמכשיר':'דורש חיבור לאינטרנט'}</small></button>)}</section>}
    {local.psalms.length>0&&<section className="search-group"><h2>תהילים</h2>{local.psalms.map(p=><button key={p.chapter} className="prayer-link" onClick={()=>openPsalm(p.chapter)}>{p.title} ←</button>)}</section>}
    {local.topics.length>0&&<section className="search-group"><h2>הלכה ומקורות</h2>{local.topics.map(r=><button className="index-row" key={r.id} onClick={()=>openTarget(r.target)}>{r.title}<small>שולחן ערוך · {r.target.route?'במכשיר':'מקור לעיון'}</small></button>)}</section>}
    {shalomRav}
    {local.prayers.length>0&&<section className="search-group"><h2>סידור</h2>{local.prayers.map(p=><button className="prayer-link" key={p.id} onClick={()=>onNav('siddur')}>{p.title} · לתוכן העניינים ←</button>)}</section>}
    {torah}
    <RemoteGroup remote={remote} onNav={onNav} openSource={openSource}/>
  </section>;
}
// The provider's search: an extra group, never the only one, never an error that breaks the page.
function RemoteGroup({remote,onNav,openSource}) {
  if(remote.status==='idle')return null;
  return <section className="search-group global-search-remote" aria-label="תוצאות נוספות מספריא, דורש חיבור לאינטרנט"><h2>עוד מספריא <small className="global-search-online">דורש חיבור לאינטרנט</small></h2>
    {remote.status==='offline'&&<p className="global-search-quiet">אין חיבור כרגע · החיפוש שלמעלה נעשה במכשיר ופועל במלואו.</p>}
    {remote.status==='loading'&&<p className="loading" role="status">מחפשים גם בספריא…</p>}
    {remote.status==='unavailable'&&<p className="global-search-quiet">ספריא אינה זמינה כרגע · התוצאות שלמעלה נמצאות במכשיר.</p>}
    {remote.hits.map(hit=><button className="index-row" key={hit.ref} onClick={()=>(hit.localRoute?onNav(hit.localRoute):openSource(hit.ref))}><span>{hit.title}<small>{hit.localRoute?'נפתח מהספר שבמכשיר':'מקוון'}</small></span><span>←</span></button>)}
    {remote.status==='done'&&remote.hits.length===0&&<p className="global-search-quiet">לא נמצאו תוצאות נוספות בספריא.</p>}
  </section>;
}
