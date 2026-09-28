import { useId, useMemo, useState } from 'react';
import { HDate } from '@hebcal/core';
import { YAHRZEITS } from '../data/yahrzeits.mjs';
import { yahrzeitsOn, labelFor, nameWithHonorific, spokenSummary } from '../services/yahrzeits.mjs';

// "נר ה' נשמת אדם" — the yahrzeit of a famous tzaddik on today's Hebrew date (the app's date: it turns at sunset),
// right under "ממתק הלכתי". A thin strip in a fine gold frame whose light travels slowly around it, with a small
// candle that breathes. Several on one day: the first, "ועוד N", and a tap opens the whole list. None: only the
// quiet title and the candle.

// A tiny candle drawn by hand: a cream body, a wick, a flame with a light core, and a warm halo.
export function Candle() {
  const id = useId().replace(/:/g, '');
  return <svg className="ner-candle" viewBox="0 0 24 40" width="16" height="27" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`h${id}`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffd98a" stopOpacity=".55" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
      <linearGradient id={`f${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#e8912d" /><stop offset=".55" stopColor="#f7c35a" /><stop offset="1" stopColor="#fff1c9" /></linearGradient>
      <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#efe4cc" /><stop offset=".5" stopColor="#fbf6ea" /><stop offset="1" stopColor="#e2d4b4" /></linearGradient>
    </defs>
    <circle className="ner-halo" cx="12" cy="10" r="9" fill={`url(#h${id})`} />
    <g className="ner-flame"><path d="M12 2.5c2.6 3.4 3.9 5.6 3.9 7.6a3.9 3.9 0 0 1-7.8 0c0-2 1.3-4.2 3.9-7.6z" fill={`url(#f${id})`} /><ellipse cx="12" cy="11.2" rx="1.3" ry="2" fill="#fffaf0" opacity=".85" /></g>
    <path d="M12 14.2v3" stroke="#5a4630" strokeWidth=".9" strokeLinecap="round" />
    <rect x="8.2" y="17" width="7.6" height="20" rx="1.6" fill={`url(#b${id})`} stroke="var(--gold,#b8912f)" strokeOpacity=".45" strokeWidth=".6" />
  </svg>;
}

// Screenshot QA only (a build made with VITE_QA=1): a fixed Hebrew date from localStorage. Absent from normal builds.
const qaDate = () => {
  if (import.meta.env?.VITE_QA !== '1') return null;
  try { return JSON.parse(localStorage.getItem('kz-qa-hebrew-date') || 'null'); } catch { return null; }
};

export default function NerHashem({ hebrewDate: appDate }) {
  const hebrewDate = qaDate() || appDate;
  const [open, setOpen] = useState(false);
  const list = useMemo(() => {
    if (!hebrewDate) return [];
    let lengths;
    try { lengths = { [hebrewDate.month]: HDate.daysInMonth(hebrewDate.month, hebrewDate.year) }; } catch { lengths = undefined; }
    return yahrzeitsOn(hebrewDate, YAHRZEITS, { monthLengths: lengths });
  }, [hebrewDate?.day, hebrewDate?.month, hebrewDate?.year]);
  const [first, ...rest] = list;
  const many = rest.length > 0;
  const body = <>
    <span className="ner-title-row"><Candle /><span className="ner-title">נר ה׳ נשמת אדם</span></span>
    {first && <span className="ner-person">
      <span className="ner-label">{labelFor(first)}</span>
      <strong className="ner-name">{nameWithHonorific(first)}</strong>
      {many && <span className="ner-more">ועוד {rest.length}<span className={`ner-chevron${open ? ' is-open' : ''}`} aria-hidden="true">›</span></span>}
    </span>}
  </>;
  return <section className={`ner-hashem${first ? '' : ' is-quiet'}${many && open ? ' is-open' : ''}`} aria-label={spokenSummary(list)}>
    {many
      ? <button type="button" className="ner-inner" aria-expanded={open} aria-label={spokenSummary(list)} onClick={() => setOpen(value => !value)}>{body}</button>
      : <div className="ner-inner" role="text" aria-label={spokenSummary(list)}>{body}</div>}
    {many && open && <div className="ner-list" role="region" aria-label="אזכרות היום">
      <p className="ner-list-title">אזכרות היום</p>
      {hebrewDate?.label && <p className="ner-list-date">{hebrewDate.label}</p>}
      <ul>{list.map(record => <li key={record.id}><span className="ner-label">{labelFor(record)}</span><strong>{nameWithHonorific(record)}</strong></li>)}</ul>
    </div>}
  </section>;
}
