import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import ClearableInput from './ClearableInput.jsx';
import { useModalFocus } from './a11yPrimitives.jsx';
import SpiritualRing from './SpiritualRing.jsx';
import { computePresence, PRESENCE_STATE } from '../services/presenceGlow.mjs';
import { hasDockedNav, subscribeDockedNav } from '../services/dockedNav.mjs';
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
export const MORE = [['halacha','הלכה'],['books','ספרים'],['talmud','תלמוד'],['parasha','פרשה'],['otiyot','אותיות 26'],['shalom-rav','שלום רב'],['personal-tools','כלים אישיים'],['leatzmi','לעצמי'],['mitzvot-journal','המעגל הרוחני'],['about','אודות ומקורות']];
// "המעגל הרוחני" stands apart from its sibling categories wherever it is listed (top bar, its overflow menu, the mobile
// "עוד" sheet) by its name alone — bold, in the palette's accent colour; no ring, frame or tint (owner, 2026-09-30).
// (Styles: .nav-circle.)
export const CIRCLE_ENTRY = 'mitzvot-journal';
const circleClass = id => (id === CIRCLE_ENTRY ? ' nav-circle' : '');
function EntryLabel({ label }) { return label; }
// Mobile "more" sheet also carries the desktop-only NAV entries so every page stays reachable on phones.
const MOBILE_MORE = [...NAV.slice(4), ...MORE];
const THEMES = [['light','בהיר'],['dark','כהה'],['sage','מרווה'],['blue','כחול'],['plum','שזיף'],['coral','קורל ים'],['teal','טורקיז עמוק'],['amber','זהב לילי']];
const ROUTE_ALIASES = { settings: 'times', accessibility: 'times', 'shabbat-page': 'personal-tools', 'shabbat-table': 'personal-tools', preparation: 'personal-tools', sefaria: 'books', learning: 'talmud', offline: 'talmud' };
// Map any route (including nested ones like halacha/q/x) to the nav entry that owns it.
export function navRootFor(page) {
  const root = String(page || 'today').split('/')[0];
  return ROUTE_ALIASES[root] || root;
}

// Desktop (a mouse, wide window): the top navigation shows as many destinations as fit on one line and gathers the
// rest under "עוד" at its end, so none is cut off. Measured from the rendered buttons; on phones and tablets the top
// navigation is not displayed (it has no width) and nothing here changes anything.
// The same query scopes the desktop CSS (base.css, "Desktop top navigation"); touch screens never match it.
export const DESKTOP_NAV_QUERY = '(min-width:861px) and (hover:hover) and (pointer:fine)';
export function navOverflowCount(widths, available, moreWidth, gap = 0) {
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  if (!available || total <= available) return widths.length;
  let used = moreWidth;
  let count = 0;
  for (const width of widths) {
    if (used + gap + width > available) break;
    used += gap + width;
    count += 1;
  }
  return count;
}
function useNavFit(navRef, deps) {
  const [fit, setFit] = useState(Infinity);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const measure = () => {
      const available = nav.clientWidth;
      if (!available || !window.matchMedia?.(DESKTOP_NAV_QUERY).matches) { setFit(Infinity); return; }
      const items = [...nav.querySelectorAll(':scope > .shell-nav-item')];
      const more = nav.querySelector(':scope > .shell-nav-more');
      const gap = parseFloat(getComputedStyle(nav).columnGap) || 0;
      const count = navOverflowCount(items.map(item => item.getBoundingClientRect().width), available, more ? more.getBoundingClientRect().width : 0, gap);
      setFit(count >= items.length ? Infinity : count);
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(nav);
    window.addEventListener('resize', measure);
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, deps);
  return fit;
}

// Up/Down (and Home/End) move between the items of an open menu.
function arrowKeys(event) {
  const items = [...event.currentTarget.querySelectorAll('button')];
  const index = items.indexOf(document.activeElement);
  const to = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[event.key];
  if (to === undefined || !items.length) return;
  event.preventDefault();
  items[(to + items.length) % items.length].focus();
}

export default function Shell({ page, onNav, query, setQuery, theme, setTheme, presenceOptions = { tzid: 'Asia/Jerusalem', il: true }, isTodayPage = false, ring = null }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const docked = useSyncExternalStore(subscribeDockedNav, hasDockedNav, hasDockedNav);
  const moreRef = useRef(null);
  const navRef = useRef(null);
  const navMoreRef = useRef(null);
  const [navMoreOpen, setNavMoreOpen] = useState(false);
  const navFit = useNavFit(navRef, []);
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
  useEffect(() => {
    if (!navMoreOpen) return undefined;
    const outside = event => { if (navMoreRef.current && !navMoreRef.current.contains(event.target)) setNavMoreOpen(false); };
    const key = event => { if (event.key === 'Escape') { setNavMoreOpen(false); navMoreRef.current?.querySelector('.shell-nav-more-button')?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [navMoreOpen]);
  useEffect(() => { if (navFit === Infinity) setNavMoreOpen(false); }, [navFit]);
  // The two pop-ups (the phone's "עוד" menu, the colour themes): focus moves in, Escape closes, focus returns to the
  // button that opened them; arrows move between the items. The page behind stays as it is (they are menus, not modal).
  const moreSheetRef = useRef(null);
  const themeMenuRef = useRef(null);
  useModalFocus(moreSheetRef, moreOpen, () => setMoreOpen(false), { inert: false, initialFocus: '[aria-current="page"]' });
  useModalFocus(themeMenuRef, themeOpen, () => setThemeOpen(false), { inert: false, initialFocus: '[aria-selected="true"]' });
  const navItems = [...NAV, ...MORE];
  const overflow = navFit === Infinity ? [] : navItems.slice(navFit);
  return (
    <>
      <div className={`shell-head-safe presence-${presence.state}${presence.celebrate ? ' presence-celebrate' : ''}${docked ? ' is-docked' : ''}`}>
        <header className="shell-head">
          <a className="brand" href="#today" title={PRESENCE_WORDS[presence.state]} onClick={e => { e.preventDefault(); if (longPressed.current) { longPressed.current = false; return; } onNav('today'); }}
            onPointerDown={pressStart} onPointerUp={pressEnd} onPointerLeave={pressEnd} onPointerCancel={pressEnd} onContextMenu={e => e.preventDefault()}>
            <span className="brand-mark-wrap"><span className={`brand-mark presence-${presence.state}${presence.litToday ? ' is-lit' : ''}${presence.waking ? ' presence-waking' : ''}`} aria-hidden="true"><img src={`${import.meta.env.BASE_URL}branding/kazzohar-emblem.png`} alt="" /><span className="presence-spark" /></span>{ring && !isTodayPage && <SpiritualRing size="small" decorative className="brand-ring" todayProgress={ring.weekProgress ?? ring.todayProgress} presenceLevel={ring.presenceLevel} dayOrNight={ring.dayOrNight} showCenterDot={false} />}</span>
            {whisper && <span className="presence-whisper" role="status">{PRESENCE_WORDS[presence.state]}</span>}
            <span className="brand-name">כזוהר הרקיע<small>זמנים · לוח · מקורות</small></span>
          </a>
          <nav ref={navRef} className={`shell-nav${overflow.length ? ' has-overflow' : ''}`} aria-label="ניווט ראשי">
            {navItems.map(([id, label], index) => {
              const hidden = index >= navFit;
              return <button key={id} className={`shell-nav-item${circleClass(id)}${active === id ? ' on' : ''}${hidden ? ' is-overflow' : ''}`} aria-current={active === id ? 'page' : undefined} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : undefined} onClick={() => onNav(id)}><EntryLabel id={id} label={label} /></button>;
            })}
            <div ref={navMoreRef} className={`shell-nav-more${overflow.length ? '' : ' is-idle'}`} aria-hidden={overflow.length ? undefined : true}>
              <button type="button" className={`shell-nav-more-button${overflow.some(([id]) => id === active) ? ' on' : ''}`} tabIndex={overflow.length ? undefined : -1} aria-haspopup="menu" aria-expanded={navMoreOpen} onClick={() => setNavMoreOpen(open => !open)}>עוד<svg className="shell-nav-more-chevron" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
              {navMoreOpen && overflow.length > 0 && <div className="shell-nav-more-menu" role="menu" aria-label="יעדים נוספים">
                {overflow.map(([id, label], index) => <button key={id} type="button" role="menuitem" autoFocus={index === 0} className={`${active === id ? 'on' : ''}${circleClass(id)}`.trim() || undefined} aria-current={active === id ? 'page' : undefined} onClick={() => { onNav(id); setNavMoreOpen(false); }}><EntryLabel id={id} label={label} /></button>)}
              </div>}
            </div>
          </nav>
          <div className="head-tools">
            {/* The docked reader navigation: whenever a reading with previous / next is open (a prayer's sections,
                a Talmud page, a Tehillim chapter, a library unit…), its bar is portaled here and the search makes room.
                The slot is always present, so no reader ever falls back to a bar floating over the text. */}
            <div className="head-prayer-slot" id="kz-head-prayer-slot" hidden={!docked} />
            {!docked && <label className="head-search">
              {/* deferred: the field shows each letter at once; the app and the search page follow as a low-priority update. */}
              <ClearableInput deferred value={query} onChange={e => setQuery(e.target.value)} placeholder="חיפוש בספרייה…" aria-label="חיפוש בכל האפליקציה" clearLabel="נקה חיפוש" type="search" enterKeyHint="search" />
            </label>}
            <div className="theme-picker">
              <button className="theme-trigger" onClick={() => setThemeOpen(open => !open)} aria-label={`ערכת צבע: ${THEMES.find(([id]) => id === theme)?.[1] || ''}`} aria-haspopup="listbox" aria-expanded={themeOpen}>
                <span className={`theme-swatch theme-${theme}`} aria-hidden="true" />
                <span>ערכת צבע</span>
              </button>
              {themeOpen && (
                <div ref={themeMenuRef} className="theme-menu" role="listbox" aria-label="ערכות צבע" onKeyDown={arrowKeys}>
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
          {moreOpen && <div ref={moreSheetRef} className="sheet" role="menu" aria-label="תפריט נוסף" onKeyDown={arrowKeys}>
            {MOBILE_MORE.map(([id, label]) => <button key={id} role="menuitem" className={circleClass(id).trim() || undefined} aria-current={active === id ? 'page' : undefined} onClick={() => { onNav(id); setMoreOpen(false); }}><EntryLabel id={id} label={label} /></button>)}
          </div>}
        </div>
      </nav>
    </>
  );
}
