import { useId, useMemo, useState } from 'react';
import { HDate } from '@hebcal/core';
import { YAHRZEITS } from '../data/yahrzeits.mjs';
import { yahrzeitsOn, nameWithHonorific, spokenSummary, EMPTY_DAY_LINE } from '../services/yahrzeits.mjs';

// "נר ה' נשמת אדם" — the yahrzeit of a famous tzaddik on today's Hebrew date (the app's date: it turns at sunset),
// right under "ממתק הלכתי". A thin strip in a fine gold frame whose light travels slowly around it; the title between
// two small candles that breathe; under it the name alone. Several on one day: the first, "ועוד N", and a tap opens the whole list. None: the
// title and, under it, one quiet line — "הדליקו נר לרחל אמנו" (not a name; never on a day that has a record).

// A small candle drawn by hand: a cream body, a wick, a flame with a light core, and around the flame an oval glow
// that breathes (two layers: a wide soft aura and a warm inner light). `mirror` sets the other candle's flame a
// little out of phase, so the pair looks alive rather than mechanical.
export function Candle({ mirror = false }) {
  const id = useId().replace(/:/g, '');
  return <svg className={`ner-candle${mirror ? ' is-mirror' : ''}`} viewBox="-4 -4 40 52" width="26" height="34" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`a${id}`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffe29a" stopOpacity=".95" /><stop offset=".45" stopColor="#ffc95e" stopOpacity=".5" /><stop offset="1" stopColor="#ffc861" stopOpacity="0" /></radialGradient>
      <radialGradient id={`h${id}`} cx="50%" cy="55%" r="50%"><stop offset="0" stopColor="#fff6dc" stopOpacity=".95" /><stop offset=".6" stopColor="#ffdf93" stopOpacity=".45" /><stop offset="1" stopColor="#ffd27a" stopOpacity="0" /></radialGradient>
      <linearGradient id={`f${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#e8872a" /><stop offset=".5" stopColor="#f8c55c" /><stop offset="1" stopColor="#fff3d0" /></linearGradient>
      <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#efe4cc" /><stop offset=".5" stopColor="#fbf6ea" /><stop offset="1" stopColor="#e2d4b4" /></linearGradient>
    </defs>
    <ellipse className="ner-aura-glow" cx="16" cy="11.5" rx="17" ry="14.5" fill={`url(#a${id})`} />
    <ellipse className="ner-halo" cx="16" cy="11.5" rx="8" ry="11" fill={`url(#h${id})`} />
    <g className="ner-flame"><path d="M16 3.5c2.7 3.5 4 5.8 4 7.9a4 4 0 0 1-8 0c0-2.1 1.3-4.4 4-7.9z" fill={`url(#f${id})`} /><ellipse cx="16" cy="13" rx="1.35" ry="2.1" fill="#fffaf0" opacity=".9" /></g>
    <path d="M16 16.3v3" stroke="#5a4630" strokeWidth=".9" strokeLinecap="round" />
    <rect x="12" y="19" width="8" height="27" rx="1.6" fill={`url(#b${id})`} stroke="var(--gold,#b8912f)" strokeOpacity=".45" strokeWidth=".6" />
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
  const spoken = hebrewDate ? spokenSummary(list) : "נר ה' נשמת אדם";  // no date at all: the title alone
  const body = <>
    <span className="ner-title-row"><Candle /><span className="ner-title">נר ה׳ נשמת אדם</span><Candle mirror /></span>
    {first && <span className="ner-person">
      <strong className="ner-name">{nameWithHonorific(first)}</strong>
      {many && <span className="ner-more">ועוד {rest.length}<span className={`ner-chevron${open ? ' is-open' : ''}`} aria-hidden="true">›</span></span>}
    </span>}
    {!first && hebrewDate && <span className="ner-person ner-empty-day"><span className="ner-empty-line">{EMPTY_DAY_LINE}</span></span>}
  </>;
  return <section className={`ner-hashem${first ? '' : hebrewDate ? ' is-empty-day' : ' is-quiet'}${many && open ? ' is-open' : ''}`} aria-label={spoken}>
    {many
      ? <button type="button" className="ner-inner" aria-expanded={open} aria-label={spoken} onClick={() => setOpen(value => !value)}>{body}</button>
      : <div className="ner-inner" role="text" aria-label={spoken}>{body}</div>}
    {many && open && <div className="ner-list" role="region" aria-label="אזכרות היום">
      <p className="ner-list-title">אזכרות היום</p>
      {hebrewDate?.label && <p className="ner-list-date">{hebrewDate.label}</p>}
      <ul>{list.map(record => <li key={record.id}><strong>{nameWithHonorific(record)}</strong></li>)}</ul>
    </div>}
  </section>;
}
