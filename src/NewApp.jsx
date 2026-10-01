
import { Fragment, Suspense, lazy, useState, useEffect, useRef, useMemo } from 'react';
import { HOUSE_CREDIT } from './data/credits.mjs';
import { nextRestWindow } from './services/notificationEngine.mjs';
import { isDaylight } from './services/presenceGlow.mjs';
import { dailyTehillimChapterCount, getDailyTehillim } from './tehillimDaily.mjs';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { civilDateKey, shiftCivilDate } from './civilDate.mjs';
import { formatVisibleSourceTitle } from './services/tanakhReferences.mjs';
import { SiddurSourcesPage, NusachComparePage } from './pages/SiddurNusachPages.jsx';
import { nusachOf, siddurIndexTitle } from './services/nusach.mjs';
import { getIndex } from './services/sefaria.mjs';
import { siddurRoots, buildSiddurFlows, counterpartIn, siddurLayout } from './services/siddurIndex.mjs';
import { buildSiddurConditionSummary, shouldDisplaySiddurSection } from './services/siddurConditionEngine.mjs';
import { zmanim, calendar, DEFAULT_SETTINGS, normalizeSettings } from './services.mjs';
import { useResource, useLocal, useSpiritualPresence } from './hooks.jsx';
import { useWidgetSync } from './services/nativeWidgets.mjs';
import { dayContext } from './dayContext.mjs';
import { setAppActivity, prayerFromTitle, sectionFromTitle } from './services/appActivity.mjs';
import { SIDDUR_HALACHA } from './data/halachaSiddurLinks.mjs';
const SIDDUR_HALACHA_TITLE = section => SIDDUR_HALACHA[section]?.title || '';
import ZmanimPage from './pages/ZmanimPage.jsx';
import { SiddurPage, ParashaPage } from './pages/BooksPage.jsx';
import LibraryPage, { parseLibraryRoute } from './pages/LibraryPage.jsx';
import ShnayimMikra from './pages/ShnayimMikra.jsx';
import HalachaLibrary, { parseHalachaRoute } from './pages/HalachaLibrary.jsx';
import TalmudPage, { parseTalmudRoute } from './pages/TalmudPage.jsx';
import { LearningPage, SearchPage } from './pages/LearningSearch.jsx';
import SourceReader from './components/SourceReader.jsx';
import { CAL } from './data/legacyData.mjs';
import Shell from './components/Shell.jsx';
import TodayPage from './pages/TodayPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Tehillim from './Tehillim.jsx';
import AboutPage from './pages/AboutPage.jsx';
import AccessibilityPage from './pages/AccessibilityPage.jsx';
import DebugJewishContextPage from './pages/DebugJewishContextPage.jsx';
import ForgottenAddition from './pages/ForgottenAddition.jsx';
import ShabbatTable from './pages/ShabbatTable.jsx';
import ShabbatPage from './pages/ShabbatPage.jsx';
import OtiyotPage from './pages/OtiyotPage.jsx';
import PreparationHub from './pages/PreparationHub.jsx';
import TravelMode from './pages/TravelMode.jsx';
import OfflineLibrary from './pages/OfflineLibrary.jsx';
import PersonalTools from './pages/PersonalTools.jsx';
// לעצמי (and בחן אותי / התבודדות inside it): its own chunk, loaded when first opened.
const LeatzmiPage = lazy(() => import('./pages/LeatzmiPage.jsx'));
import PrayerCompass from './pages/PrayerCompass.jsx';
import ZemirotPage from './pages/ZemirotPage.jsx';
import BlessingsEngine from './pages/BlessingsEngine.jsx';
import PrayerCompletion from './components/PrayerCompletion.jsx';
import ShalomRavPage from './pages/ShalomRavPage.jsx';
import MitzvotJournal from './pages/MitzvotJournal.jsx';
import OlamPage from './pages/OlamPage.jsx';
import JewishAlarmPage from './pages/JewishAlarmPage.jsx';
import { syncJewishAlarms, alarmContext } from './services/jewishAlarm/index.mjs';
import { syncReminders, onReminderTap, parseDeepLink, REMINDER_TAP_EVENT } from './services/reminders/index.mjs';
import { contextSignature as alarmSignature } from './services/jewishAlarm/engine.mjs';
import { getLearningMemory } from './services/learningMemory.mjs';
import { getDailyProgress, setDailyCompletion } from './services/dailyLearning.mjs';
import { recordTehillimCompletion, registerDaySunset } from './services/mitzvotJournal.mjs';
import { activePreparation, remainingCount } from './services/preparationPlan.mjs';
import { loadPreparation } from './services/preparationStorage.mjs';
import { getTrip, loadTravel } from './services/travelStorage.mjs';
import { applyYomTovRule } from './services/diasporaMode.mjs';
import { backAction } from './navigation.mjs';
import { serializeReaderNavigation, restoreReaderNavigation } from './services/readerHistory.mjs';
import { beginRestore, consumeScrollPosition, currentEntryKey, isRestoring, linkEntry, newEntryKey, readRouteState, rememberScroll, restoreScroll, writeRouteState } from './services/scrollRestoration.mjs';
import { focusSearchResults, noteSearchValue, registerSearchState, splitAfterHashNavigation, splitSearchEntry } from './services/searchReturn.mjs';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { focusPageTitle } from './components/a11yPrimitives.jsx';
import '@fontsource/heebo/400.css';
import '@fontsource/heebo/600.css';
// Heebo's Hebrew subset has no glyphs for te'amim (U+0591–U+05AF), meteg, paseq or sof pasuq.
// Noto Sans Hebrew is the per-glyph fallback for UI text; Noto Serif Hebrew is the reading face.
import '@fontsource/noto-sans-hebrew/hebrew-400.css';
import '@fontsource/noto-sans-hebrew/hebrew-600.css';
import '@fontsource/noto-serif-hebrew/hebrew-400.css';
import '@fontsource/noto-serif-hebrew/hebrew-700.css';
import './styles/base.css';
import './styles/seal.css';
import './styles/touch-targets.css';
import './styles/accessibility.css';
import './styles/reminders.css';
import './styles/jewish-reminder.css';
import './styles/daily-share-travel.css';
import './styles/autoscroll.css';
import { reconcileMemorialReminders } from './services/memorialStore.mjs';

const HEBREW = CAL.h;
// The header search's text is kept per history entry like every other search (services/searchReturn.mjs).
const GLOBAL_SEARCH = 'global-search';
registerSearchState(GLOBAL_SEARCH, '');
const resultsKeyOf = state => (state?.kzResults ? state.kzKey || '' : '');

// Milliseconds until the next midnight in the given time zone (falls back to the device's zone).
export function msUntilLocalMidnight(now, tzid) {
  let parts;
  try { parts = new Intl.DateTimeFormat('en-US', { timeZone: tzid, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(now); } catch { parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(now); }
  const get = type => Number(parts.find(part => part.type === type)?.value || 0);
  const elapsed = ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000 + now.getMilliseconds();
  return 24 * 60 * 60 * 1000 - elapsed;
}

// Tell Halacha what is open now (a prayer, birkat hamazon, the Omer…), so "שכחתי" there needs no extra words.
function noteActivity(reference, title) {
  const text = `${reference || ''} ${title || ''}`;
  const prayer = prayerFromTitle(text);
  const section = sectionFromTitle(text);
  if (prayer || section || /^Smart Siddur|^Siddur /.test(String(reference || ''))) setAppActivity({ area: 'siddur', prayer, section, title });
}

export default function NewApp() {
  const [now, setNow] = useState(() => new Date());
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('kz-theme') || (localStorage.getItem('kz-dark') === '1' ? 'dark' : 'light'); } catch { return 'light'; } });
  useEffect(() => {
    try { localStorage.setItem('kz-theme', theme); } catch {}
    document.documentElement.dataset.theme = theme;
    // Status-bar glyphs follow the app theme, not the iOS/Android system appearance.
    if (Capacitor.isNativePlatform()) StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(() => {});
  }, [theme]);
  const [storedSettings,setSettings]=useLocal('companion-settings-v2',DEFAULT_SETTINGS);
  // מצב חו״ל: under the default rule (לפי מרן) the calendar follows the saved residence; "לפי המיקום" follows the place.
  const settings=useMemo(()=>applyYomTovRule(normalizeSettings(storedSettings)),[storedSettings]);
  const [mode, setMode] = useState(()=>location.hash.slice(1)||'today');
  const [query, setQuery] = useState(() => readRouteState(currentEntryKey(), GLOBAL_SEARCH)?.value || '');
  // A results entry (split off when a result was opened) draws its page afresh from the state kept for it.
  const [resultsKey, setResultsKey] = useState(() => resultsKeyOf(history.state));
  // After a navigation (a tap on a destination, Back, a link to another page — not a move within the same page), the
  // new page's title takes the focus, so a screen reader starts reading where the new page begins.
  const mainRef = useRef(null);
  const titleFocusRef = useRef(false);
  // A previous search offered by the header search's suggestions (searchHistory.mjs) fills the header search box.
  useEffect(() => { const pick = event => setQuery(String(event.detail || '')); window.addEventListener('kz-global-search', pick); return () => window.removeEventListener('kz-global-search', pick); }, []);
  const [source,setSource]=useState(() => history.state?.source || null);
  const [psalm,setPsalm]=useState(null);
  const [dailyTehillim,setDailyTehillim]=useState(false);
  const [autoPrayer,setAutoPrayer]=useState(null);
  const depthRef = useRef(0);
  // The entry being shown (its key, and whether it is a results entry): a plain link has replaced history.state by the
  // time the app hears of it, and the entry it left may have been showing a search.
  const shownRef = useRef({ key: null, results: false });
  const track = state => { depthRef.current = Number(state?.kzDepth || 0); shownRef.current = { key: state?.kzKey || null, results: Boolean(state?.kzResults) }; };
  // The header search text belongs to the entry it was typed in (a Map write, no storage; nothing else per keystroke).
  // (Over an open source the header search shows no results, so there it keeps nothing.)
  useEffect(() => { const key = currentEntryKey(); if (!key) return; const text = source ? '' : query; writeRouteState(key, GLOBAL_SEARCH, text); noteSearchValue(key, text); }, [query, source]);
  const poppedRef = useRef(false);
  const signatureRef = useRef(null);
  const routeSignature = source => `${location.hash}|${JSON.stringify(source || null)}|${resultsKeyOf(history.state)}`;
  useEffect(()=>{const previousRestoration=history.scrollRestoration;history.scrollRestoration='manual';history.replaceState({ ...(history.state || {}), source: history.state?.source || null, kzDepth: 0, kzKey: history.state?.kzKey || newEntryKey() },'',location.href);track(history.state);signatureRef.current=routeSignature(history.state?.source);const sync=state=>{const source=state?.source||null;const signature=routeSignature(source);if(signature===signatureRef.current)return;signatureRef.current=signature;setMode(location.hash.slice(1)||'today');setSource(source);setQuery(readRouteState(state?.kzKey,GLOBAL_SEARCH)?.value||'');setResultsKey(resultsKeyOf(state));setDailyTehillim(false);};
  // Plain <a href="#…"> navigation fires popstate(null state) + hashchange; stamp those entries so hardware back keeps working.
  const change=event=>{if(history.state===null||typeof history.state?.kzDepth!=='number'){const kzKey=newEntryKey();const from=shownRef.current;
  // Leaving a search by a plain link: this entry becomes the results (at the address it left) and the link's destination follows it.
  const split=from.results?null:splitAfterHashNavigation({fromKey:from.key,fromURL:event.oldURL,fromDepth:depthRef.current});if(split)history.pushState({ source:null, kzDepth: split.depth, kzKey },'',split.destination);else history.replaceState({ source:null, kzDepth: depthRef.current + 1, kzKey },'',location.href);try{linkEntry(kzKey,new URL(event.oldURL).hash);}catch{}}track(history.state);sync(history.state);};const pop=event=>{if(event.state===null)return;poppedRef.current=true;titleFocusRef.current=true;beginRestore();setTimeout(()=>{if(poppedRef.current){poppedRef.current=false;restoreScroll(currentEntryKey());}},80);track(event.state);sync(event.state);};window.addEventListener('hashchange',change);window.addEventListener('popstate',pop);return()=>{history.scrollRestoration=previousRestoration;window.removeEventListener('hashchange',change);window.removeEventListener('popstate',pop);};},[]);
  useEffect(() => {
    // Returning to Books (e.g. Back from an opened book) restores the exact scroll
    // position saved just before opening it; every other navigation resets to top.
    // Back/Forward restores the entry's own scroll position; a new navigation starts at the top.
    if (poppedRef.current) {
      poppedRef.current = false;
      let cancel = () => {};
      const frame = requestAnimationFrame(() => { cancel = restoreScroll(currentEntryKey()); });
      return () => { cancelAnimationFrame(frame); cancel(); };
    }
    const restored = mode === 'books' && !source ? consumeScrollPosition('books') : null;
    const frame = requestAnimationFrame(() => window.scrollTo(0, restored ?? 0));
    return () => cancelAnimationFrame(frame);
  }, [mode, source]);
  useEffect(() => {
    // Keep the current entry's scroll position up to date (covers plain <a href> navigation too).
    let frame = 0;
    const onScroll = () => { if (frame || isRestoring()) return; frame = requestAnimationFrame(() => { frame = 0; rememberScroll(currentEntryKey(), window.scrollY); }); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);
  const todayStr = civilDateKey(now,settings.location.tzid);
  const solarToday = useResource(signal => zmanim(todayStr, settings, signal), [todayStr,JSON.stringify(settings)]);
  const nextSolar = useResource(signal => zmanim(shiftCivilDate(todayStr, 1), settings, signal), [todayStr,JSON.stringify(settings)]);
  const solar = { ...solarToday, data: solarToday.data ? { ...solarToday.data, nextDay: nextSolar.data } : null };
  const calendarResource=useResource(signal=>calendar(todayStr,shiftCivilDate(todayStr,40),settings,signal),[todayStr,JSON.stringify(settings)]);
  const context=dayContext(now,settings,solar.data,calendarResource.data||[]);
  const isIsraelRegime = (settings.halachicResidenceStatus || (settings.il ? 'israel' : 'diaspora')) === 'israel';
  const presenceSnapshot = useSpiritualPresence({ todayKey: context.key, il: isIsraelRegime });
  // The home-screen widgets, lock-screen accessories, Siri and shortcuts: one on-device snapshot, and the ways back in.
  useWidgetSync(settings);
  // One snapshot for every ring. Day only from sunrise to sunset (the app's zmanim — the same data
  // dayContext uses); before sunrise and after sunset it is night. Without zmanim: dayContext.afterSunset.
  const daylight = isDaylight(now, solar.data);
  // Beside the circle on Today: the next (or current) Shabbat / Yom Tov, from the real candle-lighting and havdalah events.
  const restWindow = nextRestWindow(calendarResource.data || [], now);
  const ring = { ...presenceSnapshot, dayOrNight: daylight === null ? (context.afterSunset ? 'night' : 'day') : daylight ? 'day' : 'night' };
  // Hand the journal the same sunsets dayContext uses, so every journal day key is sunset-aware.
  useEffect(() => {
    registerDaySunset({ sunset: solar.data?.sunset, tzid: settings.location.tzid });
    registerDaySunset({ sunset: solar.data?.nextDay?.sunset, tzid: settings.location.tzid });
  }, [solar.data, settings.location.tzid]);
  // "נר זיכרון": keep the native reminders in line with the saved memorials on launch and on every return to the app
  // (a new Hebrew year, a changed time zone). Never asks for permission here — only when the user saves a reminder.
  useEffect(() => {
    const sync = () => { reconcileMemorialReminders().catch(() => {}); };
    sync();
    const resume = App.addListener('resume', sync);
    return () => { resume.then(handle => handle.remove()); };
  }, []);
  // "השעון היהודי": keep the native alarms in line with the rules on launch, on every return to the app, and whenever the
  // location, time zone, residence or candle minutes change (the times are recalculated). Never asks for permission here.
  const alarmSettingsSignature = alarmSignature(alarmContext(settings));
  const alarmSettingsRef = useRef(settings);
  alarmSettingsRef.current = settings;
  // תזכורות follow the same context (and the same moments): launch, return, and a change of location / zmanim settings.
  useEffect(() => { syncJewishAlarms(settings).catch(() => {}); }, [alarmSettingsSignature]);
  useEffect(() => { syncReminders(settings).catch(() => {}); }, [alarmSettingsSignature]);
  useEffect(() => {
    const resume = App.addListener('resume', () => { syncJewishAlarms(alarmSettingsRef.current).catch(() => {}); syncReminders(alarmSettingsRef.current).catch(() => {}); });
    return () => { resume.then(handle => handle.remove()); };
  }, []);
  // A tapped reminder opens its screen: a prayer in the Siddur (the Omer, Shacharit, Mincha, the candle-lighting
  // blessing), or a route (נר זיכרון, the reminder itself). services/reminders/deepLinks.mjs.
  const reminderTapRef = useRef(null);
  useEffect(() => onReminderTap(target => reminderTapRef.current?.(target)), []);
  // The same targets from inside the app (המזכיר היהודי's "פתיחת הטקסט"): a validated deep link in the event's detail.
  useEffect(() => {
    const open = event => { const target = parseDeepLink(event?.detail); if (target) reminderTapRef.current?.(target); };
    window.addEventListener(REMINDER_TAP_EVENT, open);
    return () => window.removeEventListener(REMINDER_TAP_EVENT, open);
  }, []);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    document.addEventListener('visibilitychange', refresh);
    const resume = App.addListener('resume', refresh);
    return () => { document.removeEventListener('visibilitychange', refresh); resume.then(handle => handle.remove()); };
  }, []);
  useEffect(() => {
    const nextBoundary = (context.timeline || [])
      .map(item => new Date(item.at))
      .filter(value => Number.isFinite(value.getTime()) && value > now)
      .sort((a, b) => a - b)[0];
    // The civil date and weekday turn at the location's midnight, which is not a zmanim boundary: refresh then too,
    // so a page left open past midnight does not show yesterday's date for up to half an hour.
    const untilMidnight = msUntilLocalMidnight(now, settings.location.tzid);
    const delay = Math.max(1000, Math.min(nextBoundary ? nextBoundary.getTime() - now.getTime() + 1000 : Infinity, untilMidnight + 1000, 30 * 60 * 1000));
    const timer = setTimeout(() => setNow(new Date()), delay);
    return () => clearTimeout(timer);
  }, [now, context.timeline?.map(item => `${item.key}:${item.at}`).join('|')]);
  const hebrew = context.key ? HEBREW[context.key] || context.date?.label : null;
  const [dailyProgress, setDailyProgress] = useState(() => getDailyProgress(context.key));
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => { setDailyProgress(getDailyProgress(context.key)); }, [context.key]);
  useEffect(() => { const on = () => setOnline(true); const off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  useEffect(() => { if (import.meta.env.VITE_NATIVE !== 'true' && 'serviceWorker' in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}); }, []);
  const closeOverlayOrBack = () => {
    const action = backAction({
      overlay: Boolean(document.querySelector('.sheet, .theme-menu, .memorial-backdrop, .hb-session, .ja-sheet-backdrop')),
      source: Boolean(source),
      depth: Number(history.state?.kzDepth || 0),
    });
    if (action === 'overlay') {
      window.dispatchEvent(new Event('kz-native-close-overlay'));
      return true;
    }
    if (action === 'history') {
      window.history.back();
      return true;
    }
    return false;
  };
  useEffect(() => {
    if (import.meta.env.VITE_NATIVE !== 'true') return undefined;
    const listener = App.addListener('backButton', () => { closeOverlayOrBack(); });
    return () => { listener.then(handle => handle.remove()); };
  }, [source]);
  const pushRoute = (id, source = null) => {
    // Leaving a search (a result opened, or anywhere else): the results become an entry of their own first, so Back
    // returns to them and Back again to the screen before the search (services/searchReturn.mjs).
    splitSearchEntry();
    rememberScroll(currentEntryKey(), window.scrollY);
    const kzDepth = Number(history.state?.kzDepth || 0) + 1;
    const kzKey = newEntryKey();
    const fromHash = history.state?.source ? null : location.hash;
    const { kzResults: _results, ...previous } = history.state || {};
    history.pushState({ ...previous, source, kzDepth, kzKey }, '', id === null ? location.href : `#${id}`);
    if (fromHash !== null) linkEntry(kzKey, fromHash);
    track(history.state);
    signatureRef.current = routeSignature(source);
    setResultsKey('');
  };
  const nav = (id, options = {}) => {
    titleFocusRef.current = true;
    pushRoute(id);
    setMode(id);setQuery('');setSource(null);setDailyTehillim(id === 'tehillim' && options.daily === true);
    if (id === 'tehillim' && options.daily) setPsalm(null);
  };
  const go = (id, options = {}) => {
    // Moving within one book replaces the entry so Back returns to the list in one step.
    if (options.replace) { history.replaceState({ ...(history.state || {}), source: null }, '', `#${id}`); signatureRef.current = routeSignature(null); }
    else { pushRoute(id); titleFocusRef.current = true; }
    // A page that keeps its own open state (e.g. "מאגר השאלות השלם") records it in the route with { replace, quiet }:
    // the entry's address changes without re-rendering or scrolling, so Back to this entry — or a relaunch — reopens the same place.
    if (options.replace && options.quiet) return;
    setMode(id); setSource(null);
  };
  const openSource=(reference,title,mode='nikud',navigation,extra={})=>{titleFocusRef.current=true;const displayTitle=formatVisibleSourceTitle(title,reference);noteActivity(reference,displayTitle);const persisted=serializeReaderNavigation(navigation);const showCompass=Boolean(extra.showCompass);const next={reference,title:displayTitle,mode,navigation:persisted||navigation,showCompass};const entry={reference,title:displayTitle,mode,navigation:persisted,showCompass};if(extra.replace&&history.state?.source){history.replaceState({...history.state,source:entry},'',location.href);signatureRef.current=routeSignature(entry);}else pushRoute(null,entry);setSource(next);setQuery('');};
  const openPsalm=chapter=>{setPsalm(chapter);nav('tehillim');};
  // A new install is asked once which rite it prays in (on the Siddur home); an existing install keeps its rite.
  const [askNusach, setAskNusach] = useState(() => { try { return localStorage.getItem('companion-settings-v2') === null && localStorage.getItem('kz-nusach-asked') !== '1'; } catch { return false; } });
  const nusachAsked = () => { setAskNusach(false); try { localStorage.setItem('kz-nusach-asked', '1'); } catch { /* ignore */ } };
  // Changing the rite while a prayer is open keeps the reader at the same prayer and section in the new rite, when
  // that rite has one; otherwise the Siddur home (never another rite's text, never a silent fallback).
  const changeNusach = async id => {
    if (id === nusachOf(settings)) return;
    setSettings(s => ({ ...s, nusach: id }));
    nusachAsked();
    const navigation = source?.navigation;
    if (!source || navigation?.returnRoute !== 'siddur' || !navigation?.flowKey || /^(smart|moadim):/.test(String(navigation.flowKey))) return;
    try {
      const indexTitle = siddurIndexTitle(id);
      const index = await getIndex(indexTitle);
      const summary = buildSiddurConditionSummary(context);
      const roots = siddurRoots(index.schema.nodes, indexTitle, siddurLayout(id), (root, name) => shouldDisplaySiddurSection(name, summary), { has: index.has });
      const flows = buildSiddurFlows(roots, (reference, title, mode, nextNavigation) => openSource(reference, title, mode, nextNavigation));
      const hit = counterpartIn({ rootEn: navigation.flowKey, en: navigation.itemEn, concept: navigation.concept }, roots, { toNusach: id });
      if (hit) openSource(hit.item.reference, hit.item.title, hit.item.mode, flows.navigation.get(hit.item.reference), { replace: true });
      else go('siddur', { replace: true });
    } catch { go('siddur', { replace: true }); }
  };
  const openPrayerFromToday=prayerType=>{setAutoPrayer(prayerType);nav('siddur');};
  reminderTapRef.current = target => (target.kind === 'prayer' ? openPrayerFromToday(target.prayer) : nav(target.route));
  const resume = Object.entries(getLearningMemory()).map(([id, item]) => ({ id, ...item, title: formatVisibleSourceTitle(item.title, item.reference) })).filter(item => item.reference && item.status !== 'completed').sort((a, b) => (b.lastOpenedAt || '').localeCompare(a.lastOpenedAt || '')).slice(0, 2);
  const resumeLearning = item => {
    if (item.source === 'talmud') return go(`talmud/${encodeURIComponent(item.tractate)}/${item.amud}`);
    if (item.source === 'tehillim') return setPsalm(item.chapter), nav('tehillim');
    openSource(item.reference, item.title);
  };
  const completeDaily = (id, completed) => {
    setDailyProgress(setDailyCompletion(context.key, id, completed));
    if (completed && now && settings.location.tzid) {
      if (id === 'tehillim') {
        // The day's real portion size (e.g. Psalms 1–9 on day 1), not a hardcoded one.
        recordTehillimCompletion(dailyTehillimChapterCount(getDailyTehillim(context.date?.day)), { occurredAt: now, tzid: settings.location.tzid, source: 'today', sourceId: 'daily-tehillim', isDailyPortion: true, storage: globalThis.localStorage });
      } else if (id.startsWith('prayer:')) {
        // Prayer additions (יעלה ויבוא, על הניסים, הלל, etc.) are NOT whole-prayer completions.
        // Do NOT record a prayer completion event for them.
        // They remain as daily checklist items only.
      }
    }
  };
  const dailyItems = context.key ? [
    { id: 'tehillim', kind: 'תהילים', title: 'תהילים של היום', subtitle: 'לא התחלת', onOpen: () => nav('tehillim', { daily: true }) },
    ...(context.additions || []).map(addition => ({ id: `prayer:${addition.text}`, kind: 'תפילה', title: addition.text, subtitle: 'לתפילה של היום', onOpen: () => nav('siddur') })),
  ] : [];
  const T = { card: 'var(--surface)', border: 'var(--line)', gold: 'var(--accent)', muted: 'var(--ink-2)', text: 'var(--ink)', blue: 'var(--focus)' };
  const preparationPlan = activePreparation({ now, tz: settings.location.tzid, currentJewishKey: context.key, items: calendarResource.data || [] });
  const preparation = preparationPlan.kind === 'none' ? { active: false } : {
    active: true,
    name: preparationPlan.name,
    candles: preparationPlan.candles,
    remaining: remainingCount(preparationPlan, loadPreparation()),
  };
  const travelState = loadTravel();
  const activeTrip = travelState.activeTripId ? getTrip(travelState, travelState.activeTripId) : null;
  const travel = activeTrip ? { active: true, name: activeTrip.destination.name, tzid: activeTrip.destination.tzid } : { active: false };

  // One decision for what the page shows: TodayPage renders exactly when nothing else matched.
  const routed = source ? <SourceReader key={source.reference} {...source} settings={settings} now={now} times={solar.data} jewishContext={context} onOpenCompass={() => nav('siddur-compass')} onHalacha={(section, prayer) => { setAppActivity({ area: 'siddur', prayer: prayerFromTitle(prayer === 'maariv' ? 'ערבית' : prayer === 'mincha' ? 'מנחה' : prayer === 'shacharit' ? 'שחרית' : '') || null, section: section === 'birkat-hamazon' ? 'birkat-hamazon' : section, title: SIDDUR_HALACHA_TITLE(section) }); go(`halacha/ctx/${section}/${prayer}`); }} navigation={restoreReaderNavigation(source.navigation,{openSource,navigate:nav}) || source.navigation} onClose={()=>history.back()}/>
          : query.trim() ? <SearchPage query={query} context={context} onNav={nav} openSource={openSource} openPsalm={openPsalm}/>
          : mode==='calendar' ? <CalendarPage today={todayStr} settings={settings} openSource={openSource}/>
          : mode==='times' || mode==='settings' ? <ZmanimPage solar={solar} settings={settings} setSettings={setSettings} now={now} go={go}/>
          : mode==='tehillim' ? <Tehillim T={T} initialChapter={psalm} dailyDay={dailyTehillim ? context.date?.day : null} now={now} tzid={settings.location.tzid} />
          : mode==='halacha' || mode.startsWith('halacha/') ? <HalachaLibrary route={parseHalachaRoute(mode)} openSource={openSource} go={go} back={()=>history.back()} context={context} tzid={settings.location.tzid}/>
          : mode==='books' || mode.startsWith('books/') ? <LibraryPage route={parseLibraryRoute(mode)} go={go} openSource={openSource} tzid={settings.location.tzid}/>
          : mode==='talmud' || mode.startsWith('talmud/') ? <TalmudPage route={parseTalmudRoute(mode)} go={go} tzid={settings.location.tzid} context={context}/>
          : mode==='siddur' ? <SiddurPage context={context} settings={settings} now={now} times={solar.data} openSource={openSource} onOpenCompass={() => nav('siddur-compass')} autoOpenPrayer={autoPrayer} onAutoOpenHandled={() => setAutoPrayer(null)} go={go} onNusachChange={changeNusach} askNusach={askNusach} onNusachAsked={nusachAsked}/>
          : mode==='siddur-sources' ? <SiddurSourcesPage settings={settings} onBack={() => history.back()}/>
          : mode==='siddur-zemirot' || mode.startsWith('siddur-zemirot/') ? <ZemirotPage route={mode} go={go} onBack={() => history.back()}/>
          : mode==='siddur-brachot' ? <BlessingsEngine settings={settings} go={go} openSource={openSource} onBack={() => history.back()} completionSlot={record => <PrayerCompletion flowKey="Blessings on Enjoyments" tzid={settings.location.tzid} title={record.name || record.he || record.title || ''} perItem />}/>
          : mode==='shalom-rav' || mode.startsWith('shalom-rav/') ? <ShalomRavPage route={mode} go={go} tzid={settings.location.tzid}/>
          : mode==='siddur-compare' ? <NusachComparePage settings={settings} openSource={openSource} onBack={() => history.back()} context={context}/>
          : mode==='siddur-compass' ? <PrayerCompass settings={settings} setSettings={setSettings} onBack={() => history.back()}/>
          : mode==='parasha' ? <ParashaPage context={context} settings={settings} openSource={openSource} onOpenShnayim={() => nav('shnayim-mikra')}/>
          : mode==='shnayim-mikra' || mode.startsWith('shnayim-mikra/') ? <ShnayimMikra route={mode} context={context} go={go} onBack={() => history.back()} tzid={settings.location.tzid}/>
          : mode==='personal-tools' || mode.startsWith('personal-tools/') ? <PersonalTools route={mode} settings={settings} openSource={openSource} openPsalm={openPsalm} todayKey={context.key}/>
          : mode==='leatzmi' || mode.startsWith('leatzmi/') ? <Suspense fallback={<p className="loading" role="status">טוען…</p>}><LeatzmiPage route={mode} go={go} openSource={openSource} openPsalm={openPsalm} settings={settings} context={context}/></Suspense>
          : mode==='jewish-alarm' || mode.startsWith('jewish-alarm/') ? <JewishAlarmPage route={mode} settings={settings} now={now} go={go}/>
          : mode==='mitzvot-journal' ? <MitzvotJournal now={now} tzid={settings.location.tzid} onNav={nav} settings={settings} />
          : mode==='mitzvot-journal/olam' ? <OlamPage ring={ring} onBack={() => (Number(history.state?.kzDepth) > 0 ? history.back() : nav('mitzvot-journal'))} />
          : mode==='learning' || mode.startsWith('learning/') ? <LearningPage route={mode} context={context} settings={settings} openSource={openSource} onNav={nav} go={go}/>
          : mode==='sefaria' ? <SearchPage query={query||'תפילה'} context={context} onNav={nav} openSource={openSource} openPsalm={openPsalm}/>
          : mode==='otiyot' || mode.startsWith('otiyot/') ? <OtiyotPage route={mode} go={go}/>
          : mode==='about' ? <AboutPage onNav={nav} />
          : mode==='accessibility' || mode.startsWith('accessibility/') ? <AccessibilityPage route={mode} go={go}/>
          : mode==='preparation' || mode.startsWith('preparation/') ? <PreparationHub route={mode} now={now} settings={settings} items={calendarResource.data||[]} onNav={nav}/>
          : mode==='forgotten-addition' ? <ForgottenAddition />
          : mode==='shabbat-table' ? <ShabbatTable context={context} openSource={openSource} items={calendarResource.data||[]} now={now} settings={settings}/>
          : mode==='shabbat-page' ? <ShabbatPage now={now} settings={settings} items={calendarResource.data||[]} context={context}/>
          : mode==='travel' || mode.startsWith('travel/') ? <TravelMode route={mode} now={now} settings={settings} setSettings={setSettings} items={calendarResource.data||[]} onNav={nav}/>
          : import.meta.env.DEV && mode==='debug/jewish-context' ? <DebugJewishContextPage now={now} settings={settings} solar={solar} calendarResource={calendarResource} context={context} hebrew={hebrew} todayStr={todayStr}/>
          : mode==='offline' ? <OfflineLibrary />
          : null;
  const isTodayPage = routed === null;
  useEffect(() => {
    if (!titleFocusRef.current) return undefined;
    titleFocusRef.current = false;
    // After the page has drawn its title (a page loading its text draws the title first).
    // Back to a results entry: the results take the focus (their heading), never the search field — no keyboard pops up.
    let timer = setTimeout(() => {
      if (!history.state?.kzResults) return focusPageTitle(mainRef.current);
      if (!focusSearchResults()) timer = setTimeout(() => { if (!focusSearchResults()) focusPageTitle(mainRef.current); }, 380);
    }, 120);
    return () => clearTimeout(timer);
  }, [mode, source?.reference, resultsKey]);
  return (
    <AppErrorBoundary><div dir="rtl">
      {!online && <div className="offline-banner" role="status">אין חיבור לרשת · התוכן השמור וההעדפות עדיין זמינים</div>}
      <Shell isTodayPage={isTodayPage} ring={ring} page={mode} onNav={nav} query={query} setQuery={setQuery} theme={theme} setTheme={setTheme} presenceOptions={{ tzid: settings.location.tzid, il: (settings.halachicResidenceStatus || (settings.il ? 'israel' : 'diaspora')) === 'israel' }} />
      <main className="page" ref={mainRef}>
        <Fragment key={resultsKey || 'page'}>{routed ?? <TodayPage
              now={now}
              tz={settings.location.tzid}
              hebrew={hebrew}
              events={context.events}
              solar={solar}
              locationName={settings.location.name}
              afterSunset={context.afterSunset}
              context={context}
              settings={settings}
              setSettings={setSettings}
                onNav={nav}
                resume={resume}
                onResume={resumeLearning}
                onOpenPrayer={openPrayerFromToday}
                dailyItems={dailyItems}
                dailyProgress={dailyProgress}
                onCompleteDaily={completeDaily}
                preparation={preparation}
                travel={travel}
                ring={ring}
                restWindow={restWindow}/>}</Fragment>


      </main>
      <footer className={`app-footer${mode==='about'&&!source?' is-about':''}`}>
        <p className="app-footer-brand">כזוהר הרקיע · {HOUSE_CREDIT}</p>
        <p className="app-footer-memorial">לעילוי נשמת הרבנית זהבית זוהרה בת אסתר</p>
      </footer>
    </div></AppErrorBoundary>
  );
}
