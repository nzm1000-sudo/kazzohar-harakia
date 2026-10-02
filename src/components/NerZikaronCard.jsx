import { useEffect, useMemo, useState } from 'react';
import { HDate } from '@hebcal/core';
import { Candle } from './NerHashem.jsx';
import { activeMemorials, memorialName, hebrewDayLabel } from '../services/memorialYahrzeit.mjs';
import { loadMemorials, MEMORIAL_CHANGE_EVENT } from '../services/memorialStore.mjs';
import ArrowMark from './ui/ArrowMark.jsx';

// "נר זיכרון" on the Today screen: the user's own loved one whose yahrzeit is now, under נר ה' נשמת אדם. It appears
// with the app's Jewish day — at the sunset that begins the yahrzeit — and stays one Jewish day (or three, as chosen).
// One candle (the public strip has two); tapping opens the tool at that memorial. Nothing when nothing is active.
const qaDate = () => {
  if (import.meta.env?.VITE_QA !== '1') return null;
  try { return JSON.parse(localStorage.getItem('kz-qa-hebrew-date') || 'null'); } catch { return null; }
};

export default function NerZikaronCard({ hebrewDate: appDate, afterSunset = false }) {
  const hebrewDate = qaDate() || appDate;
  const [records, setRecords] = useState(loadMemorials);
  useEffect(() => { const refresh = () => setRecords(loadMemorials()); window.addEventListener(MEMORIAL_CHANGE_EVENT, refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener(MEMORIAL_CHANGE_EVENT, refresh); window.removeEventListener('storage', refresh); }; }, []);
  const active = useMemo(() => {
    if (!hebrewDate?.day || !hebrewDate?.month || !hebrewDate?.year) return [];
    try { return activeMemorials(records, new HDate(hebrewDate.day, hebrewDate.month, hebrewDate.year), { afterSunset }); } catch { return []; }
  }, [records, hebrewDate?.day, hebrewDate?.month, hebrewDate?.year, afterSunset]);
  if (!active.length) return null;
  const href = `#personal-tools/memorial/${active.map(item => item.record.id).join(',')}`;
  const [first] = active;
  const spoken = active.length === 1
    ? `נר זיכרון. ${first.status}: ${first.record.displayName} ${first.record.gender === 'f' ? 'עליה השלום' : 'זכרונו לברכה'}. ${hebrewDayLabel(first.yahrzeit)}.`
    : `נר זיכרון. ${active.length} אזכרות. הקש להצגת הרשימה.`;
  return <a className="ner-zikaron" href={href} aria-label={spoken}>
    <span className="ner-title-row"><Candle /><span className="ner-title">נר זיכרון</span></span>
    {active.length === 1 ? <>
      <span className="nz-card-label">לעילוי נשמת</span>
      <strong className="ner-name">{memorialName(first.record)}</strong>
      <span className="nz-card-status">{hebrewDayLabel(first.yahrzeit)} · {first.status}</span>
    </> : <span className="ner-more">{active.length} אזכרות היום<ArrowMark size="inline" className="ner-chevron" legacy="‹" /></span>}
  </a>;
}
