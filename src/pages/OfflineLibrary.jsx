import { useEffect, useState } from 'react';
import { clearRecentCache, contentCacheStats, unpinContent } from '../services/contentCache.mjs';

const BUNDLED = [
  { label: 'תהילים · 150 פרקים', bytes: 321312 },
  { label: 'סידור נוסח עדות המזרח · 121 קטעים מאושרי CC0', bytes: 1915846 },
];

function formatBytes(bytes) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function OfflineLibrary() {
  const [stats, setStats] = useState(() => contentCacheStats());
  const refresh = () => setStats(contentCacheStats());
  useEffect(() => {
    window.addEventListener('kz-cache-changed', refresh);
    return () => window.removeEventListener('kz-cache-changed', refresh);
  }, []);
  const remove = entry => {
    unpinContent(entry.type, entry.key);
    window.dispatchEvent(new Event('kz-cache-changed'));
  };
  const bundledBytes = BUNDLED.reduce((sum, item) => sum + item.bytes, 0);
  return <section className="offline-library">
    <p className="eyebrow">אחסון מקומי</p>
    <h1>תוכן זמין ללא אינטרנט</h1>
    <p className="intro">תוכן מאושר נשמר במכשיר בלי להחליף את המקורות המקוונים. תוכן בסיסי לא ניתן למחיקה.</p>
    <section className="source-catalog">
      <div className="section-heading"><h2>זמין תמיד</h2><strong>{formatBytes(bundledBytes)}</strong></div>
      {BUNDLED.map(item => <p className="card-line" key={item.label}><span>{item.label}</span><small>{formatBytes(item.bytes)}</small></p>)}
    </section>
    <section className="source-catalog">
      <div className="section-heading"><h2>שמירה אישית ומטמון</h2><strong>{formatBytes(stats.bytes)}</strong></div>
      <p className="intro">מוצמד: {formatBytes(stats.pinnedBytes)} · אחרון: {formatBytes(stats.recentBytes)} · עד {stats.pinLimit} פריטים מוצמדים · תקרה: {formatBytes(stats.maxBytes)}.</p>
      {stats.entries.length === 0 && <p className="notice">עדיין לא נשמר תוכן נוסף.</p>}
      <div className="book-index">{stats.entries.map(entry => <div className="index-row" key={`${entry.type}:${entry.key}`}>
        <span><strong>{entry.data?.heRef || entry.data?.ref || entry.key}</strong><small>{entry.pinned ? 'מוצמד לשימוש ללא אינטרנט' : 'שמירה אחרונה'} · {entry.type}</small></span>
        {entry.pinned && <button className="link" onClick={() => remove(entry)}>הסר מהשמירה</button>}
      </div>)}</div>
      {stats.entries.some(entry => !entry.pinned) && <button className="link" onClick={() => { clearRecentCache(); refresh(); }}>ניקוי השמירה האחרונה</button>}
    </section>
    <p className="source-credit">מגבלות טקסט: {stats.limits.talmud} דפי תלמוד אחרונים, {stats.limits.source} מקורות הלכה, {stats.limits.siddur} קטעי סידור מקוונים, {stats.limits.scan} סריקות לכל היותר. פריטים מוצמדים אינם מפונים אוטומטית עד להסרתם.</p>
  </section>;
}