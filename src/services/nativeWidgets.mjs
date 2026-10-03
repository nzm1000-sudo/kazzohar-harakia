// The bridge to the home-screen widgets, the lock-screen accessories, Siri / Shortcuts (iOS) and the app shortcuts
// (Android) — the only file that talks to the native KZWidgets plugin. Offline and private: the snapshot is computed
// on the device (services/widgetSnapshot.mjs) and stays on it (iOS: the app's shared keychain item and, when the App
// Group is provisioned, its UserDefaults; Android: the app's SharedPreferences). Nothing is sent anywhere.
//
// Also the way in: a tap on a widget, a Siri answer's "open", or an Android shortcut opens the app on a route
// ("kzohaar://open/<route>?q=…", or "kzohaar://open/prayer/<prayer>" for the Siddur); only the routes below are honoured.
// The weather the widgets show is the app's own last reading (services/weather.mjs) — the widgets never fetch.
import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { buildWidgetSnapshot } from './widgetSnapshot.mjs';
import { getEvents, JOURNAL_CHANGE_EVENT } from './mitzvotJournal.mjs';
import { readCircles } from './spiritualCircle.mjs';
import { cachedWeather, WEATHER_CHANGE_EVENT } from './weather.mjs';
import { readMeatDairy, adoptSharedMeatDairy, applySharedMeatDairy, meatDairyReminder, MEAT_DAIRY_CHANGE_EVENT } from './meatDairy.mjs';
import { REMINDER_TAP_EVENT } from './reminders/deepLinks.mjs';
import { stableId } from './notificationEngine.mjs';
import { scheduleSingle, cancelSingle } from './notifications.mjs';
import { loadDivreiChachamim } from './leatzmi/divreiChachamim.mjs';

const KZWidgets = registerPlugin('KZWidgets');
const native = () => Capacitor.isNativePlatform() && ['ios', 'android'].includes(Capacitor.getPlatform());

// Deep-link routes: the widget / Siri / shortcut name → the app's hash route.
export const ENTRY_ROUTES = Object.freeze({
  today: 'today',
  zmanim: 'times',
  parasha: 'parasha',
  brachot: 'siddur-brachot',
  omer: 'today',
  ring: 'mitzvot-journal/olam',
  hitbodedut: 'leatzmi/hitbodedut',
  sayings: 'leatzmi/today',
  meat: 'today',
  weather: 'times',
  shabbat: 'parasha',
  prayer: 'siddur',
});

// "kzohaar://open/prayer/<one of these>" opens that prayer in the Siddur, through the same validated path as a
// reminder's tap (services/reminders/deepLinks.mjs → NewApp → the Siddur's auto-open).
export const WIDGET_PRAYERS = Object.freeze(['shacharit', 'mincha', 'maariv', 'birkat-hamazon', 'omer']);

// "kzohaar://open/brachot?q=תפוח" → { route: 'siddur-brachot', query: 'תפוח' }; anything else → null.
export function parseEntryUrl(url) {
  let parsed;
  try { parsed = new URL(String(url)); } catch { return null; }
  if (parsed.protocol !== 'kzohaar:') return null;
  const path = parsed.pathname.replace(/^\/+/, '').split('/');
  const [name, second] = parsed.host === 'open' || !parsed.host ? path : [parsed.host, ...path];
  const route = Object.hasOwn(ENTRY_ROUTES, name) ? ENTRY_ROUTES[name] : null;
  if (!route) return null;
  if (name === 'prayer') return WIDGET_PRAYERS.includes(second) ? { route, query: '', prayer: second } : null;
  const query = (parsed.searchParams.get('q') || '').trim().slice(0, 80);
  return { route, query: name === 'brachot' ? query : '' };
}

// The blessings engine takes a query handed over by Siri / a shortcut once, when it opens. Kept for a few seconds only,
// so a later, unrelated visit starts empty.
let pendingBlessingQuery = null;
export function takeEntryBlessingQuery() {
  const pending = pendingBlessingQuery;
  pendingBlessingQuery = null;
  return pending && Date.now() - pending.at <= 5000 ? pending.query : '';
}

export function openEntry(entry) {
  if (!entry) return;
  if (entry.prayer) {
    setTimeout(() => { window.dispatchEvent(new CustomEvent(REMINDER_TAP_EVENT, { detail: `prayer/${entry.prayer}` })); }, 0);
    return;
  }
  if (entry.query) pendingBlessingQuery = { query: entry.query, at: Date.now() };
  const hash = `#${entry.route}`;
  if (location.hash === hash && !entry.query) return;
  if (location.hash === hash) location.hash = '#today';
  // A new history entry, handled by the app's own hashchange navigation (NewApp) like any in-app link.
  setTimeout(() => { location.hash = hash; }, 0);
}

// The sayings are a large, lazily loaded collection; read once, only on a device that has widgets to feed.
let sayingsData = null;
const loadSayings = async () => { if (!sayingsData) { try { sayingsData = await loadDivreiChachamim(); } catch { sayingsData = null; } } return sayingsData; };

const MEAT_NOTIFY_ID = stableId('meat-dairy-wait'); // the card's own reminder (components/MeatDairyTimer.jsx)

// A wait started from the widget's "אכלתי בשרי" button, newer than the app's: adopt it (the card, its reminder).
export async function syncMeatFromWidget() {
  if (!native()) return false;
  let shared = null;
  try { const result = await KZWidgets.getMeatState(); shared = result?.json ? JSON.parse(result.json) : null; } catch { return false; }
  const wait = adoptSharedMeatDairy(readMeatDairy(), shared);
  if (wait === undefined) return false;
  applySharedMeatDairy(wait, Number(shared.updatedAt));
  if (wait) { const reminder = meatDairyReminder(wait.startedAt, wait.hours); scheduleSingle({ id: MEAT_NOTIFY_ID, ...reminder }); } else cancelSingle(MEAT_NOTIFY_ID);
  return true;
}

// The app's colour palette (NewApp: <html data-theme>, kept in "kz-theme"), so the widgets wear the same clay. Only
// the eight known names are carried; the widgets fall back to the light / dark clay of the system for anything else.
export const WIDGET_PALETTES = Object.freeze(['light', 'dark', 'sage', 'blue', 'plum', 'coral', 'teal', 'amber']);
export function widgetPalette(root = globalThis.document?.documentElement, storage = globalThis.localStorage) {
  let id = root?.dataset?.theme || '';
  if (!id) { try { id = storage?.getItem('kz-theme') || ''; } catch { id = ''; } }
  return WIDGET_PALETTES.includes(id) ? id : null;
}

export async function publishWidgetSnapshot(settings, now = new Date()) {
  if (!native()) return false;
  const snapshot = buildWidgetSnapshot({
    now, settings, events: getEvents(), lifetimeBest: readCircles()?.best || 0,
    weather: cachedWeather(settings?.location), sayings: await loadSayings(), meat: readMeatDairy(),
  });
  if (!snapshot) return false;
  await KZWidgets.setSnapshot({ json: JSON.stringify({ ...snapshot, palette: widgetPalette() }) });
  return true;
}

// Keeps the widgets current: on start, on every return to the app, when the location / settings change, and when the
// journal changes (the ring). Also handles the ways into the app (widget taps, Siri, shortcuts).
export function useWidgetSync(settings) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const signature = JSON.stringify([settings?.location, settings?.candles, settings?.il, settings?.halachicResidenceStatus, settings?.showRT]);
  useEffect(() => {
    if (!native()) return undefined;
    let timer = 0;
    const publish = () => { clearTimeout(timer); timer = setTimeout(() => { publishWidgetSnapshot(settingsRef.current).catch(() => {}); }, 400); };
    // On start and on every return: first take in a wait the widget started, then publish.
    const refresh = () => { syncMeatFromWidget().catch(() => false).finally(publish); };
    refresh();
    const changes = [JOURNAL_CHANGE_EVENT, WEATHER_CHANGE_EVENT, MEAT_DAIRY_CHANGE_EVENT];
    changes.forEach(name => window.addEventListener(name, publish));
    const resume = App.addListener('resume', refresh);
    // A new palette chosen in the app: the widgets change with it.
    const themes = typeof MutationObserver === 'function' ? new MutationObserver(publish) : null;
    themes?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { clearTimeout(timer); themes?.disconnect(); changes.forEach(name => window.removeEventListener(name, publish)); resume.then(handle => handle.remove()); };
  }, [signature]);
  useEffect(() => {
    if (!native()) return undefined;
    const takePending = () => { KZWidgets.takePendingRoute().then(result => { if (result?.url) openEntry(parseEntryUrl(result.url)); }).catch(() => {}); };
    takePending();
    App.getLaunchUrl().then(launch => { if (launch?.url) openEntry(parseEntryUrl(launch.url)); }).catch(() => {});
    const url = App.addListener('appUrlOpen', event => openEntry(parseEntryUrl(event?.url)));
    const route = KZWidgets.addListener('route', event => openEntry(parseEntryUrl(event?.url)));
    const resume = App.addListener('resume', takePending);
    return () => { [url, route, resume].forEach(handle => handle.then(h => h.remove()).catch(() => {})); };
  }, []);
}
