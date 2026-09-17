import { useState } from 'react';

const NAV = [['today','היום'],['calendar','לוח שנה'],['tehillim','תהילים'],['siddur','סידור']];
const MORE = [['halacha','הלכה'],['sefaria','ספריא']];

export default function Shell({ page, onNav, query, setQuery, dark, onToggleDark }) {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <>
      <header className="shell-head">
        <a className="brand" href="#today" onClick={e => { e.preventDefault(); onNav('today'); }}>
          <span className="brand-mark" aria-hidden="true">כז</span>
          <span className="brand-name">כזוהר הרקיע<small>זמנים · לוח · מקורות</small></span>
        </a>
        <nav className="shell-nav" aria-label="ניווט ראשי">
          {NAV.map(([id, label]) => (
            <button key={id} className={page === id ? 'on' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => onNav(id)}>{label}</button>
          ))}
        </nav>
        <div className="head-tools">
          <label className="head-search">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="חיפוש בספרייה…" aria-label="חיפוש גלובלי" />
          </label>
          <button className="ghost" onClick={onToggleDark} aria-label={dark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}>{dark ? '☾' : '☀'}</button>
        </div>
      </header>
      <nav className="tabbar" aria-label="ניווט נייד">
        {NAV.slice(0, 4).map(([id, label]) => (
          <button key={id} className={page === id ? 'on' : ''} onClick={() => { onNav(id); setMoreOpen(false); }}>{label}</button>
        ))}
        <button className={moreOpen || MORE.some(([id]) => id === page) ? 'on' : ''} aria-expanded={moreOpen} onClick={() => setMoreOpen(o => !o)}>עוד</button>
        {moreOpen && (
          <div className="sheet" role="menu" aria-label="תפריט נוסף">
            {MORE.map(([id, label]) => (
              <button key={id} role="menuitem" onClick={() => { onNav(id); setMoreOpen(false); }}>{label}</button>
            ))}
          </div>
        )}
      </nav>
    </>
  );
}
