import { useEffect, useRef, useState } from 'react';
import { PACK_EVENT, packStatuses, restoreInstalledPacks } from '../services/torah/packManager.mjs';
import { INVITE_TEXT, INVITE_WORDS, currentRunIds, formatInviteSize, inviteModel, refreshCatalogOnce, spokenInviteSize, startInviteDownload } from '../services/torah/offlineInvite.mjs';

// A thin download glyph (an arrow into a tray), drawn in the line's own colour.
function DownloadGlyph() {
  return <svg className="offline-invite-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
    <path d="M8 2.2v7.6M4.9 6.9 8 10l3.1-3.1M2.8 11.2v1.4c0 .7.5 1.2 1.2 1.2h8c.7 0 1.2-.5 1.2-1.2v-1.4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

// The quiet line at the very end of the ספרים / תלמוד / הלכה homes (variant 'books' | 'search'). See offlineInvite.mjs.
export default function OfflineInvite({ variant = 'books', go }) {
  const [packs, setPacks] = useState(() => packStatuses());
  const [phase, setPhase] = useState('idle'); // idle · confirm · offline · done
  const ranHere = useRef(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => { if (alive) setPacks(packStatuses()); };
    const online = () => setPhase(value => (value === 'offline' ? 'idle' : value));
    window.addEventListener(PACK_EVENT, refresh);
    window.addEventListener('online', online);
    restoreInstalledPacks().catch(() => {}).then(refreshCatalogOnce).then(refresh);
    return () => { alive = false; window.removeEventListener(PACK_EVENT, refresh); window.removeEventListener('online', online); };
  }, []);
  const model = inviteModel(packs, currentRunIds());
  // Everything on the device: a short word of completion where the download ran, then the line is gone for good.
  useEffect(() => {
    if (model.visible || !ranHere.current) return undefined;
    ranHere.current = false;
    setPhase('done');
    const timer = setTimeout(() => setPhase('idle'), 4000);
    return () => clearTimeout(timer);
  }, [model.visible]);
  useEffect(() => {
    if (phase !== 'offline') return undefined;
    const timer = setTimeout(() => setPhase('idle'), 5000);
    return () => clearTimeout(timer);
  }, [phase]);
  if (!model.visible && phase !== 'done') return null;

  const start = async (options = {}) => {
    const result = await startInviteDownload(options);
    if (result.phase === 'started') { ranHere.current = true; setPhase('idle'); setPacks(packStatuses()); result.done.then(() => setPacks(packStatuses())); }
    else setPhase(result.phase);
  };
  const text = INVITE_TEXT[variant] || INVITE_TEXT.books;
  const size = formatInviteSize(model.missingBytes);
  const manage = <><span className="offline-invite-sep" aria-hidden="true">·</span><button type="button" className="offline-invite-link" onClick={() => go('offline')} aria-label="ניהול הספרייה במכשיר">{INVITE_WORDS.manage}</button></>;
  let line;
  if (phase === 'done') line = <span className="offline-invite-note" role="status"><DownloadGlyph />{INVITE_WORDS.done}</span>;
  else if (model.downloading) line = <><span className="offline-invite-note" role="status"><DownloadGlyph />{INVITE_WORDS.downloading} <bdi>{model.percent}%</bdi></span>{manage}</>;
  else if (phase === 'confirm') line = <><span className="offline-invite-note"><bdi>{size}</bdi> {INVITE_WORDS.cellular}</span>
    <button type="button" className="offline-invite-link" onClick={() => start({ confirmCellular: true })}>{INVITE_WORDS.confirm}</button>
    <span className="offline-invite-sep" aria-hidden="true">·</span>
    <button type="button" className="offline-invite-link is-quiet" onClick={() => setPhase('idle')}>{INVITE_WORDS.later}</button></>;
  else if (phase === 'offline') line = <><span className="offline-invite-note" role="status"><DownloadGlyph />{INVITE_WORDS.offline}</span>{manage}</>;
  else if (model.failed) line = <><span className="offline-invite-note" role="status">{INVITE_WORDS.failed}</span><span className="offline-invite-sep" aria-hidden="true">·</span>
    <button type="button" className="offline-invite-link" onClick={() => start()} aria-label={`${INVITE_WORDS.retry}: ${text}, ${spokenInviteSize(model.missingBytes)}`}>{INVITE_WORDS.retry}</button>{manage}</>;
  else line = <>
    {/* Two centred lines: what it is, then its size and the two words. The sentence is tappable too (one button for a screen reader). */}
    <button type="button" className="offline-invite-go" onClick={() => start()} tabIndex={-1} aria-hidden="true"><DownloadGlyph />{text}</button>
    <span className="offline-invite-row">
      <bdi className="offline-invite-size">{size}</bdi><span className="offline-invite-sep" aria-hidden="true">·</span>
      <button type="button" className="offline-invite-link" onClick={() => start()} aria-label={`${INVITE_WORDS.action}: ${text}, ${spokenInviteSize(model.missingBytes)}`}>{INVITE_WORDS.action}</button>{manage}
    </span>
  </>;
  return <aside className={`offline-invite${model.downloading ? ' is-downloading' : ''}`} aria-label="הורדה לשימוש ללא אינטרנט" style={{ '--invite-progress': `${model.downloading ? model.percent : 0}%` }}>
    <span className="offline-invite-rule" aria-hidden="true" />
    <p className="offline-invite-line" aria-live="polite">{line}</p>
  </aside>;
}
