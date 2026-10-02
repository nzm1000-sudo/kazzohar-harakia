import { useEffect, useState } from 'react';
import { clearRecentCache, contentCacheStats, getContentCacheDiagnostics, unpinContent } from '../services/contentCache.mjs';
import { PACK_EVENT, getPackPrefs, installAllPacks, installPack, packStatuses, packStorageUsed, pausePack, refreshCatalog, removePack, restoreInstalledPacks, setPackPrefs } from '../services/torah/packManager.mjs';
import { offlineSummary } from '../services/torah/offlineAudit.mjs';
import ArrowMark from '../components/ui/ArrowMark.jsx';

function formatBytes(bytes) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// The states of a pack, as the user reads them.
export const PACK_STATUS = {
  installed: 'זמין במכשיר',
  available: 'זמין להורדה',
  downloading: 'מוריד…',
  queued: 'ממתין',
  paused: 'ההורדה הושהתה',
  update: 'נדרש עדכון',
  error: 'ההורדה לא הושלמה',
};
export const PACK_ERROR = {
  OFFLINE: 'אין חיבור לאינטרנט. ההורדה תתאפשר כשהרשת תחזור.',
  WIFI_ONLY: 'ההורדה ממתינה לרשת Wi‑Fi (לפי ההגדרה).',
  NO_SPACE: 'אין די מקום פנוי במכשיר. פנו מקום ונסו שוב; שום דבר לא נמחק.',
  CORRUPT: 'הקובץ שהתקבל אינו תקין ולכן לא נשמר. נסו שוב.',
  NOT_PUBLISHED: 'החבילה עדיין אינה זמינה באתר. נסו מאוחר יותר.',
  NETWORK: 'החיבור נקטע. ההורדה תמשיך מהמקום שבו נעצרה.',
  STALE: 'החבילה אינה מתאימה לגרסה זו של האפליקציה.',
  SCHEMA: 'החבילה אינה מתאימה לגרסה זו של האפליקציה.',
  APP_TOO_OLD: 'החבילה דורשת גרסה חדשה יותר של האפליקציה.',
  FAILED: 'ההורדה לא הושלמה. נסו שוב.',
};

// Downloadable full-text packs: one obvious choice ("הורד את הספרייה למכשיר"), then one row per shelf.
export function OfflinePacksView({ packs, summary, prefs, used, online = true, busy = false, onInstall, onInstallAll, onPause, onRemove, onWifiOnly }) {
  const missing = packs.filter(pack => pack.status !== 'installed');
  const missingBytes = missing.reduce((sum, pack) => sum + pack.size, 0);
  const lowStorage = packs.some(pack => pack.error === 'NO_SPACE');
  return <section className="source-catalog offline-packs" aria-label="הספרייה במכשיר">
    <div className="section-heading"><h2>הספרייה במכשיר</h2><strong>{formatBytes(summary.textBytes)}</strong></div>
    <p className="intro">{summary.localBooks.toLocaleString('he-IL')} ספרים נקראים במכשיר גם ללא אינטרנט, והחיפוש המלא בתנ״ך, במשנה, בתלמוד, בהלכה ובזוהר פועל תמיד.</p>
    {missing.length > 0 ? <button type="button" className="offline-primary" disabled={busy || !online} onClick={onInstallAll}>
      <strong>הורד את הספרייה למכשיר</strong><small>חיפוש מלא גם ב{missing.map(pack => pack.title).join(', ')} · {formatBytes(missingBytes)}</small>
    </button> : <p className="offline-all-set" role="status">כל החיפוש המלא זמין במכשיר.</p>}
    {!online && <p className="notice">אין חיבור כרגע · מה שבמכשיר ממשיך לעבוד; ההורדה תתאפשר כשהרשת תחזור.</p>}
    {lowStorage && <p className="notice" role="alert">{PACK_ERROR.NO_SPACE}</p>}
    <div className="book-index offline-pack-list">{packs.map(pack => {
      const percent = pack.total ? Math.min(100, Math.round((pack.done / pack.total) * 100)) : 0;
      return <div className={`offline-pack-row is-${pack.status}`} key={pack.packId}>
        <span className="offline-pack-text"><strong>חיפוש מלא · {pack.title}</strong><small>{pack.works} ספרים · {formatBytes(pack.size)}</small>
          <small className="offline-pack-status">{PACK_STATUS[pack.status]}{pack.status === 'downloading' ? ` ${percent}%` : ''}{pack.error && pack.status !== 'installed' ? ` · ${PACK_ERROR[pack.error] || PACK_ERROR.FAILED}` : ''}</small>
          {pack.status === 'downloading' && <span className="offline-pack-bar" role="progressbar" aria-label={`הורדה: ${pack.title}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent} aria-valuetext={`${percent} אחוזים`}><span style={{ width: `${percent}%` }} /></span>}
        </span>
        <span className="offline-pack-actions">
          {(pack.status === 'available' || pack.status === 'error' || pack.status === 'paused' || pack.status === 'update') && <button type="button" className="link" disabled={!online} onClick={() => onInstall(pack.packId)}>{pack.status === 'update' ? 'עדכון' : pack.status === 'paused' ? 'המשך' : pack.status === 'error' ? 'נסו שוב' : 'הורדה'}</button>}
          {pack.status === 'downloading' && <button type="button" className="link" onClick={() => onPause(pack.packId)}>השהיה</button>}
          {(pack.status === 'installed' || pack.status === 'update') && <button type="button" className="link" aria-label={`הסרה: ${pack.title}`} onClick={() => onRemove(pack.packId)}>הסרה</button>}
        </span>
      </div>;
    })}
    {summary.onlineOnlyLayers > 0 && <div className="offline-pack-row is-online-only">
      <span className="offline-pack-text"><strong>מפרשים נוספים</strong><small>{summary.onlineOnlyNames.slice(0, 5).join(', ')} ועוד · {summary.onlineOnlyLayers} שכבות</small><small className="offline-pack-status">זמין רק באינטרנט</small></span>
    </div>}</div>
    <label className="offline-wifi"><input type="checkbox" checked={Boolean(prefs.wifiOnly)} onChange={event => onWifiOnly(event.target.checked)} /> להוריד רק ברשת Wi‑Fi</label>
    <p className="source-credit">בשימוש לחיפוש המלא: {formatBytes(used)} · ההורדה אינה חובה; בלעדיה החיפוש בשמות הספרים ובתוך כל ספר ממשיך לפעול.</p>
  </section>;
}

function OfflinePacks() {
  const [packs, setPacks] = useState(() => packStatuses());
  const [prefs, setPrefs] = useState(() => getPackPrefs());
  const [used, setUsed] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const refresh = () => { setPacks(packStatuses()); setPrefs(getPackPrefs()); packStorageUsed().then(setUsed).catch(() => {}); };
    const net = () => setOnline(navigator.onLine !== false);
    window.addEventListener(PACK_EVENT, refresh);
    window.addEventListener('online', net);
    window.addEventListener('offline', net);
    restoreInstalledPacks().then(() => refreshCatalog()).then(refresh).catch(refresh);
    return () => { window.removeEventListener(PACK_EVENT, refresh); window.removeEventListener('online', net); window.removeEventListener('offline', net); };
  }, []);
  const run = async task => { setBusy(true); try { await task(); } catch { /* the row shows the reason */ } finally { setBusy(false); setPacks(packStatuses()); packStorageUsed().then(setUsed).catch(() => {}); } };
  return <OfflinePacksView packs={packs} summary={offlineSummary()} prefs={prefs} used={used} online={online} busy={busy}
    onInstall={packId => run(() => installPack(packId))} onInstallAll={() => run(() => installAllPacks())}
    onPause={pausePack} onRemove={packId => run(() => removePack(packId))} onWifiOnly={wifiOnly => { setPackPrefs({ wifiOnly }); setPrefs(getPackPrefs()); }} />;
}

export default function OfflineLibrary() {
  const [stats, setStats] = useState(() => contentCacheStats());
  const [diagnostics, setDiagnostics] = useState(() => getContentCacheDiagnostics());
  const refresh = () => { setStats(contentCacheStats()); setDiagnostics(getContentCacheDiagnostics()); };
  useEffect(() => {
    window.addEventListener('kz-cache-changed', refresh);
    return () => window.removeEventListener('kz-cache-changed', refresh);
  }, []);
  const remove = entry => {
    unpinContent(entry.type, entry.key);
    window.dispatchEvent(new Event('kz-cache-changed'));
  };
  return <section className="offline-library">
    <p className="eyebrow">אחסון מקומי</p>
    <h1>תוכן זמין ללא אינטרנט</h1>
    <p className="intro">הספרים, הסידור והתהילים נמצאים במכשיר ואינם נמחקים. כאן אפשר להוסיף חיפוש מלא במדפים נוספים, ולראות מה נשמר מהרשת.</p>
    <OfflinePacks />
    <section className="source-catalog">
      <div className="section-heading"><h2>שמירה אישית ומטמון</h2><strong>{formatBytes(stats.bytes)}</strong></div>
      <p className="intro">מוצמד: {formatBytes(stats.pinnedBytes)} · מטמון אוטומטי: {formatBytes(stats.recentBytes)} · עד {stats.pinLimit} פריטים מוצמדים · תקרה: {formatBytes(stats.maxBytes)}.</p>
      {stats.entries.length === 0 && <p className="notice">עדיין לא נשמר תוכן נוסף.</p>}
      <div className="book-index">{stats.entries.map(entry => <div className="index-row" key={`${entry.type}:${entry.key}`}>
        <span><strong>{entry.data?.heRef || entry.data?.ref || entry.key}</strong><small>{entry.pinned ? 'מוצמד לשימוש ללא אינטרנט' : 'שמירה אחרונה'} · {entry.type}</small></span>
        {entry.pinned && <button className="link" onClick={() => remove(entry)}>הסר מהשמירה</button>}
      </div>)}</div>
      {stats.entries.some(entry => !entry.pinned) && <button className="link" onClick={() => { clearRecentCache(); refresh(); }}>ניקוי השמירה האחרונה</button>}
    </section>
    <p className="source-credit">מגבלות טקסט: {stats.limits.talmud} דפי תלמוד אוטומטיים, {stats.limits.source} מקורות הלכה, {stats.limits.siddur} קטעי סידור מקוונים, {stats.limits.scan} סריקות לכל היותר. פריטים מוצמדים אינם תופסים מקום במטמון האוטומטי ואינם מפונים עד להסרתם.</p>
    <details className="source-credit"><summary>אבחון זמני<ArrowMark dir="down" size="inline" clayOnly /></summary><p>מטמון תלמוד: {diagnostics.autoEntryCount || 0}/{diagnostics.slotCount || 0} · בתים: {diagnostics.totalBytes || 0} · תקרה: {diagnostics.ceilingBytes || 0}</p><p>מפתחות: {(diagnostics.keys || []).join(' · ') || 'אין'}</p><p>גודל: {(diagnostics.bytesByEntry || []).map(entry => `${entry.key}=${entry.bytes}B`).join(' · ') || 'אין'}</p><p>כתיבה אחרונה: {String(diagnostics.lastWriteResult)} · אימות: {String(diagnostics.lastWriteVerification)} · סיבה: {diagnostics.lastEvictionReason || 'אין'} · שגיאה: {diagnostics.lastWriteError || 'אין'}</p></details>
  </section>;
}