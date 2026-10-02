import { useState, useEffect, useMemo } from 'react';
import { formatGregorianDate } from '../civilDate.mjs';
import { search } from '../services/sefaria.mjs';
import { normalizeHebrew } from '../content.mjs';
import TorahSearchResults from '../components/TorahSearchResults.jsx';
import { isOnline, localSections, remoteSearch } from '../services/torah/globalSearch.mjs';
import { rememberSearch, suggestSearches } from '../services/torah/searchHistory.mjs';
import { DailyLearningTrack, dailyLearningDateLine, useDailyPortions } from '../components/DailyLearning.jsx';
import { PENDING_TRACKS } from '../services/dailyLearningSchedule.mjs';
import { CHOK_CREDIT, CHOK_LICENSE } from '../services/chokLeYisrael.mjs';
import { ShalomRavSearchGroup } from './ShalomRavPage.jsx';
import TorahSearchGroup from '../components/torah/TorahSearchGroup.jsx';
import TitleOrnament from '../components/ui/TitleOrnament.jsx';
import ArrowMark from '../components/ui/ArrowMark.jsx';
// לימוד יומי (route "learning", and "learning/<track>" for one track): the recognised daily cycles computed on the device
// (components/DailyLearning.jsx, services/dailyLearningSchedule.mjs) — no network needed.
export function LearningPage({context,settings,times=null,openSource,onNav,go,route='learning'}) {
  const tzid=settings?.location?.tzid||'Asia/Jerusalem';
  const trackId=String(route||'').split('/')[1]||null;
  const {portions,done}=useDailyPortions(context,tzid,{times,settings});
  if(trackId) return <DailyLearningTrack trackId={trackId} context={context} tzid={tzid} go={go||onNav} openSource={openSource} times={times} settings={settings}/>;
  const open=id=>(go||onNav)?.(`learning/${id}`);
  const count=portions.filter(p=>done[p.trackId]).length;
  return <section className="dl-page"><header className="dl-head"><p className="eyebrow">קביעות קטנה, בכל יום</p><h1>לימוד יומי</h1><TitleOrnament /><p className="dl-date">{dailyLearningDateLine(context)}</p>{portions.length>0&&<p className="dl-summary" role="status">{count===portions.length?'כל מסלולי היום הושלמו · ישר כח':count?`${count} מתוך ${portions.length} הושלמו היום`:'הלימוד נפתח בקורא שבמכשיר, גם בלי אינטרנט'}</p>}</header>
    <div className="daily-learning-cards">{portions.map((p,i)=><button className={`daily-learning-card tone-${i%6}`} data-done={done[p.trackId]?'':undefined} key={p.trackId} onClick={()=>open(p.trackId)}><span className="daily-learning-badge">{String(i+1).padStart(2,'0')}</span><span className="daily-learning-card-text"><strong>{p.track.title}</strong><small className="dl-card-portion-line">{p.label}</small>{done[p.trackId]&&<small className="dl-done-line">הושלם היום</small>}</span><ArrowMark className="daily-learning-card-arrow" /></button>)}
      {PENDING_TRACKS.map(t=><button className="daily-learning-card is-pending" key={t.id} onClick={()=>open(t.id)}><span className="daily-learning-badge" aria-hidden="true">·</span><span className="daily-learning-card-text"><strong>{t.title}</strong><small>בהכנה · ממתין למקור פתוח ומאומת</small></span><ArrowMark className="daily-learning-card-arrow" /></button>)}</div>
    <p className="dl-credit">לוחות הלימוד מחושבים במכשיר לפי ספריית Hebcal ‏(<span dir="ltr">@hebcal/learning</span>, רישיון BSD) ונבדקו מול לוח הלימוד של ספריא. {CHOK_CREDIT} ‏(<span dir="ltr">{CHOK_LICENSE.title}</span>).</p>
  </section>;
}
// The header search: the Torah Engine on the device first (a reference, books, the app's topics, the full text of every
// indexed corpus), and the provider's online search only as an extra group, marked as such, asked only when online.
const lastRemote={text:null,result:null};
export function SearchPage({query,context,onNav,openSource,openPsalm}) {
  const text=String(query||'').trim();
  // The last online answer is kept in memory: Back to these results shows them at once (no flicker, no second request).
  const [remote,setRemote]=useState(()=>lastRemote.text===text?lastRemote.result:{status:'idle',hits:[]});
  useEffect(()=>{let active=true;if(lastRemote.text===text){setRemote(lastRemote.result);return()=>{active=false;};}setRemote({status:isOnline()?'loading':'offline',hits:[]});if(!isOnline())return()=>{active=false;};const timer=setTimeout(()=>remoteSearch(text,{search}).then(result=>{if(result?.status==='done'){lastRemote.text=text;lastRemote.result=result;}if(active)setRemote(result);}),650);return()=>{active=false;clearTimeout(timer);};},[text]);
  const local=useMemo(()=>localSections(text),[text]);
  const openTarget=target=>{rememberSearch(text);return target?.route?onNav(target.route):target?.source?openSource(target.source.reference,target.source.title):null;};
  return <GlobalSearchView query={text} context={context} local={local} remote={remote} recent={suggestSearches(text)} onNav={onNav} openTarget={openTarget} openSource={openSource} openPsalm={openPsalm}
    torah={<TorahSearchResults query={text} family="all" onOpen={hit=>openTarget(hit.target)} onSuggest={null} heading="בתוך המקורות · במכשיר" onManagePacks={()=>onNav('offline')} />}
    shalomRav={<ShalomRavSearchGroup query={query} onNav={onNav}/>} divrei={<TorahSearchGroup query={text} onNav={onNav}/>} />;
}
// The view alone (no effects), so a test renders exactly what the phone shows for a given state.
export function GlobalSearchView({query,context,local,remote,onNav,openTarget,openSource,openPsalm,torah=null,shalomRav=null,divrei=null,recent=[]}) {
  const events=[...(context?.events||[]),...(context?.upcomingHoliday?[context.upcomingHoliday]:[])].filter(e=>normalizeHebrew(e.hebrew||e.title).includes(normalizeHebrew(query)));
  const wantsTimes=/שקיע|זמנים|נכנסת שבת|צאת|נרות/.test(query);
  return <section className="global-search" data-kz-results><p className="eyebrow">חיפוש בכל הספרייה</p><h1>״{query}״</h1>
    {recent.length>0&&<p className="global-search-recent" role="group" aria-label="חיפושים קודמים במכשיר">חיפשת בעבר: {recent.map(item=><a key={item} className="link" href="#" onClick={event=>{event.preventDefault();window.dispatchEvent(new CustomEvent('kz-global-search',{detail:item}));}}>{item}</a>)}</p>}
    {wantsTimes&&<button className="index-row" onClick={()=>onNav('times')}><strong>זמני היום וכניסת שבת</strong><span>לפי המיקום שלך<ArrowMark size="inline" legacy={'\u00A0←'} /></span></button>}
    {events.map(e=><button className="index-row" key={`${e.date}-${e.hebrew||e.title}`} onClick={()=>onNav('calendar')}>{e.hebrew||e.title}<small>{formatGregorianDate(e.date)}</small></button>)}
    {local.reference&&<section className="search-group"><h2>מראה מקום</h2><button className="index-row" onClick={()=>onNav(local.reference.route)}>{local.reference.label}<small>מקום מדויק · במכשיר</small></button></section>}
    {local.books.length>0&&<section className="search-group"><h2>ספרים</h2>{local.books.map(book=><button className="index-row" key={book.id} onClick={()=>onNav(book.route)}>{book.title}<small>{book.local?'בספרייה שבמכשיר':'דורש חיבור לאינטרנט'}</small></button>)}</section>}
    {local.psalms.length>0&&<section className="search-group"><h2>תהילים</h2>{local.psalms.map(p=><button key={p.chapter} className="prayer-link" aria-label={p.title} onClick={()=>openPsalm(p.chapter)}>{p.title}<ArrowMark size="inline" legacy=" ←" /></button>)}</section>}
    {local.topics.length>0&&<section className="search-group"><h2>הלכה ומקורות</h2>{local.topics.map(r=><button className="index-row" key={r.id} onClick={()=>openTarget(r.target)}>{r.title}<small>שולחן ערוך · {r.target.route?'במכשיר':'מקור לעיון'}</small></button>)}</section>}
    {shalomRav}
    {divrei}
    {local.prayers.length>0&&<section className="search-group"><h2>סידור</h2>{local.prayers.map(p=><button className="prayer-link" key={p.id} aria-label={`${p.title} · לתוכן העניינים`} onClick={()=>onNav('siddur')}>{p.title} · לתוכן העניינים<ArrowMark size="inline" legacy=" ←" /></button>)}</section>}
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
    {remote.hits.map(hit=><button className="index-row" key={hit.ref} onClick={()=>(hit.localRoute?onNav(hit.localRoute):openSource(hit.ref))}><span>{hit.title}<small>{hit.localRoute?'נפתח מהספר שבמכשיר':'מקוון'}</small></span><ArrowMark /></button>)}
    {remote.status==='done'&&remote.hits.length===0&&<p className="global-search-quiet">לא נמצאו תוצאות נוספות בספריא.</p>}
  </section>;
}
