import { useState } from 'react';
import { calendar, monthCells, monthShift, onDate, zmanim, timeLabel, ZMANIM } from '../services.mjs';
import { formatGregorianDate, shiftCivilDate } from '../civilDate.mjs';
import { hebrewDate } from '../dayContext.mjs';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { useResource } from '../hooks.jsx';
import { ResourceState } from '../components/SourceReader.jsx';
const noon = key => new Date(key+'T12:00:00Z');
const label = key => formatGregorianDate(noon(key), 'UTC', false);
const hebrewMonth = key => new Intl.DateTimeFormat('he-u-ca-hebrew', { timeZone: 'UTC', month: 'long' }).format(noon(key));
const hebrewRangeLabel = key => {
  const date = hebrewDate(key);
  return date ? `${hebrewNumeral(date.day)} ${hebrewMonth(key)} ${hebrewNumeral(date.year, { year: true })} (${date.year})` : '';
};

export default function CalendarPage({ today, settings, openSource }) {
  const [selected,setSelected] = useState(today);
  const [month,setMonth] = useState(today);
  const [view,setView] = useState('month');
  const cells = monthCells(month);
  const resource = useResource(signal => calendar(cells[0],cells[41],settings,signal), [month,JSON.stringify(settings)]);
  const items = resource.data || [];
  const select = key => {setSelected(key); if(key.slice(0,7)!==month.slice(0,7))setMonth(key);};
  return <section className="calendar-page">
    <p className="eyebrow">לוח שנה · {(settings.halachicResidenceStatus || (settings.il ? 'israel' : 'diaspora')) === 'israel' ? 'ארץ ישראל' : 'חוץ לארץ'}</p>
    <div className="calendar-range-heading"><h1>{formatGregorianDate(cells[7])} — {formatGregorianDate(cells[34])}</h1><p>{hebrewRangeLabel(cells[7])} — {hebrewRangeLabel(cells[34])}</p></div>
    <div className="cal-controls"><button aria-label="חודש קודם" onClick={()=>setMonth(monthShift(month,-1))}>→</button><button onClick={()=>{setMonth(today);setSelected(today);}}>היום</button><button aria-label="חודש הבא" onClick={()=>setMonth(monthShift(month,1))}>←</button><input aria-label="בחירת תאריך" type="date" value={selected} onChange={e=>e.target.value&&select(e.target.value)}/><div className="seg">{[['day','יום'],['week','שבוע'],['month','חודש'],['year','שנה']].map(([id,t])=><button key={id} className={view===id?'on':''} onClick={()=>setView(id)}>{t}</button>)}</div></div>
    <ResourceState resource={resource}/>
    {view==='year' ? <div className="year-index">{Array.from({length:12},(_,i)=>`${month.slice(0,4)}-${String(i+1).padStart(2,'0')}-01`).map(key=><button key={key} onClick={()=>{setMonth(key);setView('month');}}><span>{label(key).split(' ')[0]}</span><small>{hebrewDate(key)?.label}</small></button>)}</div> : <div className="calendar-layout">
      {view!=='day' && <div className="calendar-grid" role="group" aria-label="ימי החודש">
        {['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','שבת'].map(d=><div className="weekday" key={d}>{d}</div>)}
        {(view==='week'?Array.from({length:7},(_,i)=>shiftCivilDate(selected,i-noon(selected).getUTCDay())):cells).map(key=>{
          const events=onDate(items,key).filter(e=>['holiday','roshchodesh','parashat','omer'].includes(e.category));
          const hebrewDay = hebrewDate(key)?.day;
          return <button key={key} onClick={()=>select(key)} aria-label={key+' '+hebrewDate(key)?.label} aria-pressed={selected===key} className={'calendar-cell '+(key===today?'is-today ':'')+(selected===key?'selected ':'')+(noon(key).getUTCDay()===6?'shabbat ':'')+(key.slice(0,7)!==month.slice(0,7)?'outside':'')}><span className="civil-number">{+key.slice(-2)}</span><span className="hebrew-cell">{hebrewDay ? hebrewNumeral(hebrewDay) : ''}</span>{events.slice(0,2).map((e,i)=><small key={i}>{e.hebrew||e.title}</small>)}</button>;
        })}
      </div>}
      <SelectedDay key={selected+JSON.stringify(settings)} date={selected} settings={settings} events={onDate(items,selected)} openSource={openSource}/>
    </div>}
    <p className="zman-note">תאריכי התאים מתארים את שעות היום. היום היהודי מתחיל בשקיעה בערב שלפניו. מועדים וקריאות: Hebcal.</p>
  </section>;
}
function SelectedDay({date,settings,events,openSource}) {
  const solar=useResource(signal=>zmanim(date,settings,signal),[date,JSON.stringify(settings)]);
  return <aside className="selected-day"><p className="eyebrow">היום שנבחר · {formatGregorianDate(date)}</p><h2>{hebrewDate(date)?.label}</h2>{events.filter(e=>e.category!=='hebdate').map((e,i)=><div className="event-line" key={i}><strong>{e.hebrew||e.title}</strong>{e.date.includes('T')&&<time>{timeLabel(e.date,settings.location.tzid)}</time>}{e.leyning?.torah&&<button onClick={()=>openSource(e.leyning.torah)}>קריאת התורה ↗</button>}</div>)}<ResourceState resource={solar}/><details open><summary>זמני היום</summary>{ZMANIM.filter(([k])=>k!=='tzeit72min'||settings.showRT).map(([key,name,method])=><div className="compact-time" key={key}><span title={method}>{name}</span><time>{timeLabel(solar.data?.[key],settings.location.tzid)}</time></div>)}</details></aside>;
}
