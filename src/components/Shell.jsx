import { useEffect, useRef, useState } from 'react';

const NAV = [['today','היום'],['calendar','לוח שנה'],['tehillim','תהילים'],['siddur','סידור'],['times','זמנים']];
export const MORE = [['halacha','הלכה'],['books','ספרים'],['talmud','תלמוד'],['parasha','פרשה'],['learning','הלימוד היומי'],['personal-tools','כלים אישיים'],['shabbat-page','דף שבת'],['about','אודות ומקורות']];
// Mobile "more" sheet also carries the desktop-only NAV entries so every page stays reachable on phones.
const MOBILE_MORE = [...NAV.slice(4), ...MORE];
const THEMES = [['light','בהיר'],['dark','כהה'],['sage','מרווה'],['blue','כחול'],['plum','שזיף'],['coral','קורל ים'],['teal','טורקיז עמוק'],['amber','זהב לילי']];
const ROUTE_ALIASES = { settings: 'times', 'shabbat-table': 'shabbat-page', preparation: 'shabbat-page', sefaria: 'books', offline: 'learning' };
// Map any route (including nested ones like halacha/q/x) to the nav entry that owns it.
export function navRootFor(page) {
  const root = String(page || 'today').split('/')[0];
  return ROUTE_ALIASES[root] || root;
}

export default function Shell({ page, onNav, query, setQuery, theme, setTheme }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const moreRef = useRef(null);
  const active = navRootFor(page);
  useEffect(() => {
    const close = () => { setMoreOpen(false); setThemeOpen(false); };
    window.addEventListener('kz-native-close-overlay', close);
    return () => window.removeEventListener('kz-native-close-overlay', close);
  }, []);
  useEffect(() => {
    const closeMoreOutside = event => {
      if (moreOpen && moreRef.current && !moreRef.current.contains(event.target)) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', closeMoreOutside);
    return () => document.removeEventListener('pointerdown', closeMoreOutside);
  }, [moreOpen]);
  return (
    <>
      <div className="shell-head-safe">
        <header className="shell-head">
          <a className="brand" href="#today" onClick={e => { e.preventDefault(); onNav('today'); }}>
            <span className="brand-mark" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}branding/kazzohar-emblem.png`} alt="" /></span>
            <span className="brand-name">כזוהר הרקיע<small>זמנים · לוח · מקורות</small></span>
          </a>
          <nav className="shell-nav" aria-label="ניווט ראשי">
            {[...NAV, ...MORE].map(([id, label]) => (
              <button key={id} className={active === id ? 'on' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => onNav(id)}>{label}</button>
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
          <button key={id} className={active === id ? 'on' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => { onNav(id); setMoreOpen(false); }}>{label}</button>
        ))}
        <div ref={moreRef} className="more-menu">
          <button className={moreOpen || MOBILE_MORE.some(([id]) => id === active) ? 'on' : ''} aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen(o => !o)}>עוד</button>
          {moreOpen && <div className="sheet" role="menu" aria-label="תפריט נוסף">
            {MOBILE_MORE.map(([id, label]) => <button key={id} role="menuitem" aria-current={active === id ? 'page' : undefined} onClick={() => { onNav(id); setMoreOpen(false); }}>{label}</button>)}
          </div>}
        </div>
      </nav>
    </>
  );
}
