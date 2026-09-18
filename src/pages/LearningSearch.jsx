import { useState, useEffect } from 'react';
import { useResource } from '../hooks.jsx';
import { learningSchedule, search, sefariaLink } from '../services/sefaria.mjs';
import { halachot, psalmIndex, prayers, matches, normalizeHebrew } from '../content.mjs';
import { ResourceState } from '../components/SourceReader.jsx';
import { dafYomiTarget } from '../services/talmud.mjs';
import { talmudRoute } from './TalmudPage.jsx';
export function LearningPage({context,settings,openSource,onNav,go}) {
  const resource=useResource(()=>learningSchedule(context.civil,settings.il),[context.civil,settings.il]);
  const entries=(resource.data||[]).filter(e=>e.ref&&['Daf Yomi','Daily Mishnah','Daily Rambam','Daily Rambam (3 Chapters)','Halakhah Yomit'].includes(e.title?.en));
  const openEntry=e=>{ if(e.title?.en==='Daf Yomi'&&go){ const t=dafYomiTarget(e.ref); if(t?.tractate) return go(talmudRoute.amud(t.tractate,t.amud)); } openSource(e.ref,e.title.he); };
  const dafNote=(()=>{const d=entries.find(e=>e.title?.en==='Daf Yomi'); const t=d?dafYomiTarget(d.ref):null; return t?.unsupported?t.note:null;})();
  return <section><p className="eyebrow">קביעות קטנה, בכל יום</p><h1>סדר הלימוד.</h1><p className="intro">{context.civil} · לוח הלימוד של ספריא לפי התאריך האזרחי. זהו סדר לימוד, לא פסק הלכה.</p>{dafNote&&<p className="notice">{dafNote}</p>}<ResourceState resource={resource}/><div className="book-index">{entries.map((e,i)=><button className="index-row" key={e.ref} onClick={()=>openEntry(e)}><span className="index-number">{String(i+1).padStart(2,'0')}</span><span><strong>{e.title.he}</strong><small>{e.displayValue?.he||e.ref}{e.title?.en==='Daf Yomi'&&dafYomiTarget(e.ref)?.tractate?' · נפתח עם ביאור שטיינזלץ':''}</small></span><span>←</span></button>)}<button className="index-row" onClick={()=>onNav('tehillim')}><strong>תהילים · חלוקת השבוע והחודש</strong><span>←</span></button><a className="index-row" href="https://halachayomit.co.il/" target="_blank" rel="noreferrer"><strong>הלכה יומית · באתר המקור</strong><small>תוכן עכשווי; אין העתקת ספרים מוגנים</small></a></div></section>;
}
export function SearchPage({query,context,onNav,openSource,openPsalm}) {
  const [remote,setRemote]=useState({loading:false,data:null,error:null});
  useEffect(()=>{let active=true;setRemote({loading:true,data:null,error:null});const timer=setTimeout(()=>search(query).then(data=>active&&setRemote({loading:false,data,error:null})).catch(e=>active&&setRemote({loading:false,data:null,error:e.message})),650);return()=>{active=false;clearTimeout(timer);};},[query]);
  const topics=halachot.filter(r=>matches(r,query));
  const psalms=psalmIndex.filter(r=>matches(r,query));
  const prayerHits=prayers.filter(r=>matches(r,query));
  const events=[...context.events,...(context.upcomingHoliday?[context.upcomingHoliday]:[])].filter(e=>normalizeHebrew(e.hebrew||e.title).includes(normalizeHebrew(query)));
  const wantsTimes=/שקיע|זמנים|נכנסת שבת|צאת|נרות/.test(query);
  return <section><p className="eyebrow">חיפוש בכל הספרייה</p><h1>״{query}״</h1>{wantsTimes&&<button className="index-row" onClick={()=>onNav('times')}><strong>זמני היום וכניסת שבת</strong><span>לפי המיקום שלך ←</span></button>}{events.map((e,i)=><button className="index-row" key={i} onClick={()=>onNav('calendar')}>{e.hebrew||e.title}<small>{e.date}</small></button>)}{psalms.length>0&&<section className="search-group"><h2>תהילים</h2>{psalms.slice(0,8).map(p=><button key={p.chapter} className="prayer-link" onClick={()=>openPsalm(p.chapter)}>{p.title} ←</button>)}</section>}{topics.length>0&&<section className="search-group"><h2>הלכה ומקורות</h2>{topics.map(r=><button className="index-row" key={r.id} onClick={()=>openSource('Shulchan Arukh, Orach Chayim '+r.sources[0].reference,r.title)}>{r.title}<small>שולחן ערוך · מקור לעיון</small></button>)}</section>}{prayerHits.length>0&&<section className="search-group"><h2>סידור</h2>{prayerHits.slice(0,5).map(p=><button className="prayer-link" key={p.id} onClick={()=>onNav('siddur')}>{p.title} · לתוכן העניינים ←</button>)}</section>}<section className="search-group"><h2>בספריית ספריא</h2>{remote.loading&&<p className="loading" role="status">מחפשים במקורות…</p>}{remote.error&&<p className="notice" role="alert">{remote.error}</p>}{remote.data?.map((hit,i)=><button className="index-row" key={i} onClick={()=>openSource(hit.ref)}><span>{hit.title}<small>{hit.ref}</small></span><span>←</span></button>)}{remote.data?.length===0&&<p>לא נמצאו מקורות תואמים.</p>}<a href={'https://www.sefaria.org/search?q='+encodeURIComponent(query)} target="_blank" rel="noreferrer">המשך חיפוש באתר ספריא ↗</a></section></section>;
}
