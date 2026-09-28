import { useEffect, useRef, useState } from 'react';
import ClearableInput from './ClearableInput.jsx';
import SpiritualRing from './SpiritualRing.jsx';
import { computePresence, PRESENCE_STATE } from '../services/presenceGlow.mjs';
import { getEvents, getJewishDateKey, JOURNAL_CHANGE_EVENT } from '../services/mitzvotJournal.mjs';

// Presence Glow: the emblem shines with the user's consistency ("יזהירו כזוהר הרקיע").
// Rendered once, here in the shell. No numbers, no alerts — a spark for today, a halo for
// the longer rhythm, a single light sweep when today's spark is first lit.
const PRESENCE_WORDS = {
  [PRESENCE_STATE.BRIGHT]: 'וְהַמַּשְׂכִּלִים יַזְהִרוּ כְּזֹהַר הָרָקִיעַ',
  [PRESENCE_STATE.GLOWING]: 'האור שלך נשמר',
  [PRESENCE_STATE.DIM]: 'כל יום הוא התחלה',
};
const RANK = { [PRESENCE_STATE.DIM]: 0, [PRESENCE_STATE.GLOWING]: 1, [PRESENCE_STATE.BRIGHT]: 2 };
function readPresence({ tzid, il }) {
  try { return computePresence(getEvents(), getJewishDateKey(new Date(), tzid), { il }); } catch { return { state: PRESENCE_STATE.DIM, litToday: false }; }
}
function usePresenceGlow(options) {
  const [presence, setPresence] = useState(() => readPresence(options));
  const [celebrate, setCelebrate] = useState(false);
  const [waking, setWaking] = useState(true);
  const previous = useRef(presence);
  useEffect(() => { const timer = setTimeout(() => setWaking(false), 1400); return () => clearTimeout(timer); }, []);
  useEffect(() => {
    let timer = 0;
    const refresh = () => {
      const next = readPresence(options);
      const before = previous.current;
      previous.current = next;
      setPresence(next);
      if ((next.litToday && !before.litToday) || RANK[next.state] > RANK[before.state]) {
        setCelebrate(true);
        clearTimeout(timer);
        timer = setTimeout(() => setCelebrate(false), 1700);
      }
    };
    refresh();
    const onVisible = () => { if (!document.hidden) refresh(); };
    window.addEventListener(JOURNAL_CHANGE_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer); window.removeEventListener(JOURNAL_CHANGE_EVENT, refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, [options.tzid, options.il]);
  return { ...presence, celebrate, waking };
}

const NAV = [['today','היום'],['calendar','לוח שנה'],['tehillim','תהילים'],['siddur','סידור'],['times','זמנים']];
// Daily Learning lives inside Talmud, the Shabbat page inside Personal Tools; אותיות 26 is its own category.
export const MORE = [['halacha','הלכה'],['books','ספרים'],['talmud','תלמוד'],['parasha','פרשה'],['otiyot','אותיות 26'],['shalom-rav','שלום רב'],['personal-tools','כלים אישיים'],['mitzvot-journal','המעגל הרוחני'],['about','אודות ומקורות']];
// Mobile "more" sheet also carries the desktop-only NAV entries so every page stays reachable on phones.
const MOBILE_MORE = [...NAV.slice(4), ...MORE];
const THEMES = [['light','בהיר'],['dark','כהה'],['sage','מרווה'],['blue','כחול'],['plum','שזיף'],['coral','קורל ים'],['teal','טורקיז עמוק'],['amber','זהב לילי']];
const ROUTE_ALIASES = { settings: 'times', 'shabbat-page': 'personal-tools', 'shabbat-table': 'personal-tools', preparation: 'personal-tools', sefaria: 'books', learning: 'talmud', offline: 'talmud' };
// Map any route (including nested ones like halacha/q/x) to the nav entry that owns it.
export function navRootFor(page) {
  const root = String(page || 'today').split('/')[0];
  return ROUTE_ALIASES[root] || root;
}

export default function Shell({ page, onNav, query, setQuery, theme, setTheme, prayerMode = false, presenceOptions = { tzid: 'Asia/Jerusalem', il: true }, isTodayPage = false, ring = null }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const moreRef = useRef(null);
  const active = navRootFor(page);
  const presence = usePresenceGlow(presenceOptions);
  const [whisper, setWhisper] = useState(false);
  const pressTimer = useRef(0);
  const longPressed = useRef(false);
  useEffect(() => { if (!whisper) return undefined; const timer = setTimeout(() => setWhisper(false), 3200); return () => clearTimeout(timer); }, [whisper]);
  const pressStart = () => { longPressed.current = false; clearTimeout(pressTimer.current); pressTimer.current = setTimeout(() => { longPressed.current = true; setWhisper(true); }, 550); };
  const pressEnd = () => clearTimeout(pressTimer.current);
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
      <div className={`shell-head-safe presence-${presence.state}${presence.celebrate ? ' presence-celebrate' : ''}`}>
        <header className="shell-head">
          <a className="brand" href="#today" title={PRESENCE_WORDS[presence.state]} onClick={e => { e.preventDefault(); if (longPressed.current) { longPressed.current = false; return; } onNav('today'); }}
            onPointerDown={pressStart} onPointerUp={pressEnd} onPointerLeave={pressEnd} onPointerCancel={pressEnd} onContextMenu={e => e.preventDefault()}>
            <span className="brand-mark-wrap"><span className={`brand-mark presence-${presence.state}${presence.litToday ? ' is-lit' : ''}${presence.waking ? ' presence-waking' : ''}`} aria-hidden="true"><img src={`${import.meta.env.BASE_URL}branding/kazzohar-emblem.png`} alt="" /><span className="presence-spark" /></span>{ring && !isTodayPage && <SpiritualRing size="small" className="brand-ring" todayProgress={ring.weekProgress ?? ring.todayProgress} presenceLevel={ring.presenceLevel} dayOrNight={ring.dayOrNight} showCenterDot={false} />}</span>
            {whisper && <span className="presence-whisper" role="status">{PRESENCE_WORDS[presence.state]}</span>}
            <span className="brand-name">כזוהר הרקיע<small>זמנים · לוח · מקורות</small></span>
          </a>
          <nav className="shell-nav" aria-label="ניווט ראשי">
            {[...NAV, ...MORE].map(([id, label]) => (
              <button key={id} className={active === id ? 'on' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => onNav(id)}>{label}</button>
            ))}
          </nav>
          <div className="head-tools">
            {/* Inside a Siddur prayer the search makes room for the prayer's own navigation (portaled in). */}
            {prayerMode ? <div className="head-prayer-slot" id="kz-head-prayer-slot" /> : <label className="head-search">
              <ClearableInput value={query} onChange={e => setQuery(e.target.value)} placeholder="חיפוש בספרייה…" aria-label="חיפוש גלובלי" clearLabel="נקה חיפוש גלובלי" type="search" />
            </label>}
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
