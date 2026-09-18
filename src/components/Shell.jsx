import { useState } from 'react';

const NAV = [['today','היום'],['calendar','לוח שנה'],['tehillim','תהילים'],['siddur','סידור'],['times','זמנים']];
const MORE = [['halacha','הלכה'],['talmud','תלמוד'],['parasha','פרשה'],['learning','לימוד'],['sefaria','מקורות'],['about','אודות ומקורות']];
const THEMES = [['light','בהיר'],['dark','כהה'],['sage','מרווה'],['blue','כחול'],['plum','שזיף']];

export default function Shell({ page, onNav, query, setQuery, theme, setTheme }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  return (
    <>
      <div className="shell-head-safe">
        <header className="shell-head">
          <a className="brand" href="#today" onClick={e => { e.preventDefault(); onNav('today'); }}>
            <img className="brand-mark" src={`${import.meta.env.BASE_URL}branding/kazzohar-emblem.png`} alt="" aria-hidden="true" />
            <span className="brand-name">כזוהר הרקיע<small>זמנים · לוח · מקורות</small></span>
          </a>
          <nav className="shell-nav" aria-label="ניווט ראשי">
            {[...NAV, ...MORE].map(([id, label]) => (
              <button key={id} className={page === id ? 'on' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => onNav(id)}>{label}</button>
            ))}
          </nav>
          <div className="head-tools">
            <label className="head-search">
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="חיפוש בספרייה…" aria-label="חיפוש גלובלי" />
            </label>
            <div className="theme-picker">
              <button className="theme-trigger" onClick={() => setThemeOpen(open => !open)} aria-label="בחירת ערכת צבע" aria-haspopup="listbox" aria-expanded={themeOpen}>
                <span className={`theme-swatch theme-${theme}`} aria-hidden="true" />
                <span>ערכת צבע</span>
              </button>
              {themeOpen && (
                <div className="theme-menu" role="listbox" aria-label="ערכות צבע">
                  {THEMES.map(([id, label]) => (
                    <button key={id} className={theme === id ? 'selected' : ''} role="option" aria-selected={theme === id} onClick={() => { setTheme(id); setThemeOpen(false); }}>
                      <span className={`theme-swatch theme-${id}`} aria-hidden="true" />
                      <span>{label}</span>
                      {theme === id && <span className="theme-check" aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>
      </div>
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
