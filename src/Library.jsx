import { useState } from 'react';
import { halachot, prayers, categories, matches, psalmIndex, normalizeHebrew } from './content.mjs';

const STATUS = {
  'awaiting-verification': 'ממתין לאימות תוכן ממקור מוסמך — אין כאן נוסח פסיקה',
  'source-link': 'אינדקס מקורות בלבד · אין כאן פסיקה עצמאית',
  verified: 'מאומת',
};
const card = T => ({ background: T.card, border: '1px solid ' + T.border, borderRadius: 12, padding: '14px 16px' });
const btn = (T, on) => ({ padding: '4px 11px', borderRadius: 16, border: '1px solid ' + T.border, cursor: 'pointer', fontSize: 11, background: on ? T.gold : 'transparent', color: on ? '#111' : T.muted, fontFamily: 'inherit' });

export function Library({ kind, T }) {
  const [category, setCategory] = useState('הכל');
  const [q, setQ] = useState('');
  const records = kind === 'halacha' ? halachot : prayers;
  const visible = records.filter(r => !q.trim() || matches(r, q));
  return (
    <div style={{ padding: 14, direction: 'rtl', display: 'grid', gap: 10 }}>
      <input aria-label="חיפוש בספרייה" placeholder={kind === 'halacha' ? 'לדוגמה: בורא נפשות · מוקצה · קפה' : 'לדוגמה: תפילת הדרך · יעלה ויבוא'}
        value={q} onChange={e => setQ(e.target.value)} style={{ background: T.card, border: '1px solid ' + T.border, color: T.text, padding: '9px 14px', borderRadius: 10, fontFamily: 'inherit', fontSize: 14 }} />
      {kind === 'halacha' && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {['הכל', ...categories].map(c => <button key={c} onClick={() => setCategory(c)} style={btn(T, category === c)}>{c}</button>)}
      </div>}
      {visible.length === 0 && <p className="notice">אין תוצאות. הספרייה נבנית לאט ומתוך מקורות בלבד.</p>}
      {visible.map(r => <article key={r.id} style={card(T)}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <h3 style={{ margin: 0, fontSize: 15, color: T.text }}>{r.title}</h3>
          <span className="eyebrow">{r.category}{r.nusach ? ' · ' + r.nusach : ''}</span>
        </header>
        <p className="notice" style={{ marginTop: 8 }}>{STATUS[r.status] || STATUS['awaiting-verification']}</p>
        {kind === 'siddur' && r.additions && <p style={{ color: T.muted, fontSize: 12 }}>
          תוספות עונתיות בתכנון: {r.additions.map(a => a.text).join(' · ')}</p>}
        {r.sources.map((s, i) => <p key={i} style={{ margin: '4px 0 0', fontSize: 13 }}>
          {s.url && <a href={s.url} target="_blank" rel="noreferrer" style={{ color: T.blue }}>{s.title} · {s.reference} ↗</a>}
          {!s.url && <span style={{ color: T.muted }}>{s.title} · {s.reference}</span>}
        </p>)}
        {r.keywords.length > 0 && <p style={{ color: T.muted, fontSize: 11, marginTop: 6 }}>{r.keywords.join(' · ')}</p>}
      </article>)}
    </div>
  );
}

export function GlobalSearch({ query, days, todayZ, T }) {
  const q = query.trim();
  const words = normalizeHebrew(q).split(' ').filter(Boolean);
  const wantsTimes = words.some(w => ['שקיעה', 'נץ', 'צאת', 'שבת', 'כניסת', 'זמנים', 'היום'].includes(w));
  const halachotHits = halachot.filter(r => matches(r, q));
  const prayerHits = prayers.filter(r => matches(r, q));
  const psalmHits = psalmIndex.filter(p => matches(p, q));
  const fmt = d => d ? d.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
  return (
    <div style={{ padding: 14, direction: 'rtl', display: 'grid', gap: 10 }}>
      <p className="eyebrow">תוצאות עבור: {q}</p>
      {wantsTimes && todayZ && <article style={card(T)}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>זמנים להיום</h3>
        {[['עלות השחר', todayZ.alot], ['הנץ החמה', todayZ.sunrise], ['שקיעת החמה', todayZ.sunset], ['צאת הכוכבים', todayZ.tzet], ['הדלקת נרות', todayZ.candles], ['הבדלה', todayZ.havdalah]].map(([l, v]) =>
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}><span>{l}</span><strong dir="ltr">{fmt(v)}</strong></div>)}
        <p style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>חישוב במישור לפי המנוע הקיים; לפסיקה יש לבדוק מנהג מקומי.</p>
      </article>}
      {psalmHits.length > 0 && <article style={card(T)}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>תהילים</h3>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{psalmHits.slice(0, 10).map(p => <a key={p.chapter} href="#tehillim" style={{ color: T.blue, fontSize: 13 }}>{p.title}</a>)}</div>
      </article>}
      {halachotHits.length > 0 && <article style={card(T)}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>הלכה</h3>
        {halachotHits.slice(0, 8).map(r => <p key={r.id} style={{ margin: '3px 0', fontSize: 13 }}>{r.title} <span style={{ color: T.muted }}>· {r.category}</span></p>)}
      </article>}
      {prayerHits.length > 0 && <article style={card(T)}><h3 style={{ margin: '0 0 8px', fontSize: 14 }}>סידור</h3>
        {prayerHits.slice(0, 8).map(r => <p key={r.id} style={{ margin: '3px 0', fontSize: 13 }}>{r.title} <span style={{ color: T.muted }}>· ממתין למקור מאומת</span></p>)}
      </article>}
      <p className="notice">החיפוש כולל כרגע: אינדקס הלכה, שמות תפילות, פרקי תהילים וזמני היום. טקסטים מלאים יתווספו רק ממקור מאומת.</p>
    </div>
  );
}
