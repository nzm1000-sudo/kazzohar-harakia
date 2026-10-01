// The bridge to the home-screen widgets, the lock-screen accessories, Siri / Shortcuts (iOS) and the app shortcuts
// (Android) — the only file that talks to the native KZWidgets plugin. Offline and private: the snapshot is computed
// on the device (services/widgetSnapshot.mjs) and stays on it (iOS: the app's shared keychain item and, when the App
// Group is provisioned, its UserDefaults; Android: the app's SharedPreferences). Nothing is sent anywhere.
//
// Also the way in: a tap on a widget, a Siri answer's "open", or an Android shortcut opens the app on a route
// ("kzohaar://open/<route>?q=…"); only the routes below are honoured.
import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { buildWidgetSnapshot } from './widgetSnapshot.mjs';
import { getEvents, JOURNAL_CHANGE_EVENT } from './mitzvotJournal.mjs';
import { readCircles } from './spiritualCircle.mjs';

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
});

// "kzohaar://open/brachot?q=תפוח" → { route: 'siddur-brachot', query: 'תפוח' }; anything else → null.
export function parseEntryUrl(url) {
  let parsed;
  try { parsed = new URL(String(url)); } catch { return null; }
  if (parsed.protocol !== 'kzohaar:') return null;
  const name = (parsed.host === 'open' ? parsed.pathname.replace(/^\/+/, '') : parsed.host || parsed.pathname.replace(/^\/+/, '')).split('/')[0];
  const route = ENTRY_ROUTES[name];
  if (!route) return null;
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
  if (entry.query) pendingBlessingQuery = { query: entry.query, at: Date.now() };
  const hash = `#${entry.route}`;
  if (location.hash === hash && !entry.query) return;
  if (location.hash === hash) location.hash = '#today';
  // A new history entry, handled by the app's own hashchange navigation (NewApp) like any in-app link.
  setTimeout(() => { location.hash = hash; }, 0);
}

export async function publishWidgetSnapshot(settings, now = new Date()) {
  if (!native()) return false;
  const snapshot = buildWidgetSnapshot({ now, settings, events: getEvents(), lifetimeBest: readCircles()?.best || 0 });
  if (!snapshot) return false;
  await KZWidgets.setSnapshot({ json: JSON.stringify(snapshot) });
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
    publish();
    window.addEventListener(JOURNAL_CHANGE_EVENT, publish);
    const resume = App.addListener('resume', publish);
    return () => { clearTimeout(timer); window.removeEventListener(JOURNAL_CHANGE_EVENT, publish); resume.then(handle => handle.remove()); };
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
