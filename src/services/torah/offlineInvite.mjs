// The quiet invitation to download the full-text packs: one line at the very end of the ספרים, תלמוד and הלכה homes.
// No banner, no badge, no popup: the line says what can be downloaded and its size (from the catalog), starts the
// download in place with one tap, shows progress and a quiet failure in the same line, and disappears for good once
// every pack is on the device (the manager stays in הלימוד היומי → "תוכן ללא אינטרנט").
import { canDownloadNow, connectionType, installAllPacks, packStatuses, refreshCatalog } from './packManager.mjs';

// ספרים offers the library itself; תלמוד and הלכה already work offline, so their line speaks only of the added search.
export const INVITE_TEXT = {
  books: 'אפשר להוריד את הספרייה לשימוש ללא אינטרנט',
  search: 'חיפוש מלא גם במדרש, חסידות ושו״ת — ללא אינטרנט',
};
export const INVITE_WORDS = {
  action: 'הורדה',
  manage: 'ניהול',
  downloading: 'מוריד…',
  failed: 'ההורדה נכשלה',
  retry: 'לנסות שוב',
  offline: 'להורדה נדרש חיבור לאינטרנט',
  cellular: 'ברשת הסלולרית · להוריד עכשיו?',
  confirm: 'כן, להוריד',
  later: 'לא עכשיו',
  done: 'הספרייה נשמרה במכשיר',
};

// 18554168 bytes → "17.7MB" (the catalog's sizes; one decimal, as the manager shows them).
export const formatInviteSize = bytes => `${(Math.max(0, bytes) / 1024 / 1024).toFixed(1)}MB`;
// The same size, spoken ("17.7 מגה־בייט").
export const spokenInviteSize = bytes => `${(Math.max(0, bytes) / 1024 / 1024).toFixed(1)} מגה־בייט`;

// On the device already: installed, or installed and awaiting an update (the manager handles updates; no nagging).
const onDevice = pack => pack.status === 'installed' || pack.status === 'update';
const active = pack => pack.status === 'downloading' || pack.status === 'queued';

// What the line shows, from the manager's statuses. runIds: the packs the current download began with (progress is
// measured over them, so a second run does not start at the share already on the device).
export function inviteModel(packs, runIds = []) {
  const missing = packs.filter(pack => !onDevice(pack));
  const missingBytes = missing.reduce((sum, pack) => sum + (pack.size || 0), 0);
  const downloading = packs.some(active);
  const run = packs.filter(pack => runIds.includes(pack.packId));
  const runBytes = run.reduce((sum, pack) => sum + (pack.size || 0), 0);
  const runDone = run.reduce((sum, pack) => sum + (onDevice(pack) ? pack.size || 0 : pack.status === 'downloading' ? Math.min(pack.done || 0, pack.size || 0) : 0), 0);
  const percent = runBytes ? Math.min(100, Math.floor((runDone / runBytes) * 100)) : 0;
  const failed = !downloading && run.some(pack => pack.status === 'error' || pack.status === 'paused');
  return { visible: missing.length > 0, missingBytes, downloading, percent, failed };
}

// ---- One session's state, shared by the three homes (a download started on one continues on the others) ----
let runIds = [];
let cellularConfirmed = false;
let catalogRefresh = null;
export const currentRunIds = () => runIds;
// The catalog is read from the site once per session (the bundled catalog answers until then, and offline).
export const refreshCatalogOnce = () => (catalogRefresh ||= refreshCatalog().catch(() => null));
export function _resetInviteSession() { runIds = []; cellularConfirmed = false; catalogRefresh = null; }

// A tap on the line. Returns { phase: 'offline' } (nothing starts; the line explains quietly), { phase: 'confirm' }
// (on a cellular connection: asked once, in the line itself), or { phase: 'started', done } with the running download.
export async function startInviteDownload({ confirmCellular = false } = {}) {
  if (!(await canDownloadNow({ allowCellular: true })).ok) return { phase: 'offline' };
  if (confirmCellular) cellularConfirmed = true;
  if (!cellularConfirmed && await connectionType().catch(() => 'unknown') === 'cellular') return { phase: 'confirm' };
  runIds = packStatuses().filter(pack => pack.status !== 'installed').map(pack => pack.packId); // what installAllPacks takes on
  const done = installAllPacks({ allowCellular: cellularConfirmed }).catch(() => []);
  return { phase: 'started', done };
}
