import { useRef, useState } from 'react';
import { calendar, monthCells, monthShift, onDate, zmanim, timeLabel, ZMANIM } from '../services.mjs';
import { formatGregorianDate, shiftCivilDate } from '../civilDate.mjs';
import { hebrewDate } from '../dayContext.mjs';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { hebrewEventLabel } from '../services/hebrewCalendarLabels.mjs';
import { useResource } from '../hooks.jsx';
import { ResourceState } from '../components/SourceReader.jsx';
import LtrDate from '../components/LtrDate.jsx';
const noon = key => new Date(key+'T12:00:00Z');
const label = key => formatGregorianDate(noon(key), 'UTC', false);
const hebrewMonth = key => new Intl.DateTimeFormat('he-u-ca-hebrew', { timeZone: 'UTC', month: 'long' }).format(noon(key));
const hebrewMonthYear = key => {
  const date = hebrewDate(key);
  return date ? `${hebrewMonth(key)} ${hebrewNumeral(date.year, { year: true })}` : '';
};
// Subtitle shows only the Hebrew MONTH(s) overlapping this Gregorian month — never a
// confusing day-to-day range — deduplicated when the whole month falls in one Hebrew month.
export const hebrewMonthsOverlapLabel = (monthStartKey, monthEndKey) => {
  const start = hebrewMonthYear(monthStartKey);
  const end = hebrewMonthYear(monthEndKey);
  if (!start || !end) return start || end || '';
  return start === end ? start : `${start} · ${end}`;
};
const hebrewDateLabel = key => {
  const date = hebrewDate(key);
  return date ? `${hebrewNumeral(date.day)} ב${hebrewMonth(key)} ${hebrewNumeral(date.year, { year: true })}` : '';
};
// Month header shows only "<Gregorian month> <year>" (e.g. ספטמבר 2026) — never the
// selected day, which already appears highlighted in the calendar grid.
export const gregorianMonthLabel = key => new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(noon(key));

export default function CalendarPage({ today, settings, openSource }) {
  const [selected,setSelected] = useState(today);
  const [month,setMonth] = useState(today);
  const [view,setView] = useState('month');
  const dateInputRef = useRef(null);
  const cells = monthCells(month);
  const monthStart = month.slice(0, 7) + '-01';
  const monthEnd = shiftCivilDate(monthShift(monthStart, 1), -1);
  const resource = useResource(signal => calendar(cells[0],cells[41],settings,signal), [month,JSON.stringify(settings)]);
  const items = resource.data || [];
  const select = key => {setSelected(key); if(key.slice(0,7)!==month.slice(0,7))setMonth(key);};
  const openDatePicker = () => { const input = dateInputRef.current; if (!input) return; if (typeof input.showPicker === 'function') input.showPicker(); else input.click(); };
  return <section className="calendar-page">
    <p className="eyebrow">לוח שנה · {(settings.halachicResidenceStatus || (settings.il ? 'israel' : 'diaspora')) === 'israel' ? 'ארץ ישראל' : 'חוץ לארץ'}</p>
    <div className="calendar-range-heading"><h1>{gregorianMonthLabel(monthStart)}</h1><p>{hebrewMonthsOverlapLabel(monthStart, monthEnd)}</p></div>
    <div className="cal-controls"><button aria-label="חודש קודם" onClick={()=>setMonth(monthShift(month,-1))}>→</button><button onClick={()=>{setMonth(today);setSelected(today);}}>היום</button><button aria-label="חודש הבא" onClick={()=>setMonth(monthShift(month,1))}>←</button><div className="date-picker-field calendar-date-field"><button type="button" className="date-display" onClick={openDatePicker} aria-label={`התאריך העברי הנבחר: ${hebrewDateLabel(selected)}`}><span dir="rtl">{hebrewDateLabel(selected)}</span></button><input ref={dateInputRef} className="date-picker-native" dir="ltr" type="date" aria-label="בחירת תאריך" value={selected} onChange={e=>e.target.value&&select(e.target.value)} tabIndex={-1}/></div><div className="seg">{[['day','יום'],['week','שבוע'],['month','חודש'],['year','שנה']].map(([id,t])=><button key={id} className={view===id?'on':''} onClick={()=>setView(id)}>{t}</button>)}</div></div>
    <ResourceState resource={resource}/>
    {view==='year' ? <div className="year-index">{Array.from({length:12},(_,i)=>`${month.slice(0,4)}-${String(i+1).padStart(2,'0')}-01`).map(key=><button key={key} onClick={()=>{setMonth(key);setView('month');}}><span>{label(key).split(' ')[0]}</span><small>{hebrewDate(key)?.label}</small></button>)}</div> : <div className="calendar-layout">
      {view!=='day' && <div className="calendar-grid" role="group" aria-label="ימי החודש">
        {['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','שבת'].map(d=><div className="weekday" key={d}>{d}</div>)}
        {(view==='week'?Array.from({length:7},(_,i)=>shiftCivilDate(selected,i-noon(selected).getUTCDay())):cells).map(key=>{
          const events=onDate(items,key).filter(e=>['holiday','roshchodesh','parashat','omer'].includes(e.category));
          const hebrewDay = hebrewDate(key)?.day;
          return <button key={key} onClick={()=>select(key)} aria-label={key+' '+hebrewDate(key)?.label} aria-pressed={selected===key} className={'calendar-cell '+(key===today?'is-today ':'')+(selected===key?'selected ':'')+(noon(key).getUTCDay()===6?'shabbat ':'')+(key.slice(0,7)!==month.slice(0,7)?'outside':'')}><span className="civil-number">{+key.slice(-2)}</span><span className="hebrew-cell">{hebrewDay ? hebrewNumeral(hebrewDay) : ''}</span>{events.slice(0,2).map((e,i)=><small key={i}>{hebrewEventLabel(e.hebrew||e.title)}</small>)}</button>;
        })}
      </div>}
      <SelectedDay key={selected+JSON.stringify(settings)} date={selected} settings={settings} events={onDate(items,selected)} openSource={openSource}/>
    </div>}
    <p className="zman-note">תאריכי התאים מתארים את שעות היום. היום היהודי מתחיל בשקיעה בערב שלפניו. מועדים וקריאות: Hebcal.</p>
  </section>;
}
function SelectedDay({date,settings,events,openSource}) {
  const solar=useResource(signal=>zmanim(date,settings,signal),[date,JSON.stringify(settings)]);
  return <aside className="selected-day"><p className="eyebrow">היום שנבחר · <LtrDate value={date} /></p><h2>{hebrewDateLabel(date)}</h2>{events.filter(e=>e.category!=='hebdate').map((e,i)=><div className="event-line" key={i}><strong>{hebrewEventLabel(e.hebrew||e.title)}</strong>{e.date.includes('T')&&<time>{timeLabel(e.date,settings.location.tzid)}</time>}{e.leyning?.torah&&<button onClick={()=>openSource(e.leyning.torah, e.hebrew || e.title, 'cantillation')}>קריאת התורה ↗</button>}</div>)}<ResourceState resource={solar}/><details open><summary>זמני היום</summary>{ZMANIM.filter(([k])=>k!=='tzeit72min'||settings.showRT).map(([key,name,method])=><div className="compact-time" key={key}><span title={method}>{name}</span><time>{timeLabel(solar.data?.[key],settings.location.tzid)}</time></div>)}</details></aside>;
}
