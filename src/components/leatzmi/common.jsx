// לעצמי — the few shared pieces of its screens: one centred head, one quiet row, one way back, one way to share.
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export const leatzmiBack = (go, fallback = 'leatzmi') => () => (Number(history.state?.kzDepth) > 0 ? history.back() : go(fallback, { replace: true }));

// The quiet ornament above a centred title: a thin line, a small open circle, a thin line.
export function Ornament() {
  return <svg className="lz-ornament" viewBox="0 0 120 12" width="120" height="12" aria-hidden="true" focusable="false"><path d="M8 6h44M68 6h44" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /><circle cx="60" cy="6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1" /></svg>;
}

export function PageHead({ title, line = null, onBack = null, backLabel = 'לעצמי', ornament = true, titleLang }) {
  return <header className="lz-head">
    {onBack && <div className="lz-back-row"><button type="button" className="lz-back" onClick={onBack}><span aria-hidden="true">→</span>{backLabel}</button></div>}
    {ornament && <Ornament />}
    <h1 className="lz-title" lang={titleLang}>{title}</h1>
    {line && <p className="lz-line">{line}</p>}
  </header>;
}

// One entry of a quiet list: a thin line glyph, a title, one line of description, and the way in.
export function EntryRow({ href, onClick, title, text, glyph = null, hint = null }) {
  const body = <>
    {glyph && <span className="lz-entry-glyph" aria-hidden="true">{glyph}</span>}
    <span className="lz-entry-text"><strong>{title}</strong>{text && <small>{text}</small>}</span>
    {hint ? <span className="lz-entry-hint">{hint}</span> : <span className="lz-entry-chevron" aria-hidden="true">‹</span>}
  </>;
  return href ? <a className="lz-entry" href={href}>{body}</a> : <button type="button" className="lz-entry" onClick={onClick}>{body}</button>;
}

// A value read from a store that announces its changes (services/leatzmi/*).
export function useStore(read, subscribe) {
  const [value, setValue] = useState(read);
  useEffect(() => { setValue(read()); return subscribe(() => setValue(read())); }, []);
  return value;
}

// The system share sheet (the app's native one, else the browser's), else a copy to the clipboard.
export async function shareText({ title, text }) {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: 'שיתוף' });
      return 'shared';
    }
  } catch { return 'cancelled'; }
  if (navigator.share) { try { await navigator.share({ title, text }); return 'shared'; } catch { return 'cancelled'; } }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}

// Thin-line glyphs (stroke only, the palette's accent), one family for every entry.
const icon = paths => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths}</svg>;
export const Glyph = {
  today: () => icon(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  quill: () => icon(<><path d="M19 4.5c-6 1-10.5 5.5-12 12.5" /><path d="M19 4.5c.5 5-3 9.5-9 11" /><path d="M5 20l2-3" /></>),
  quiz: () => icon(<><path d="M12 3.5l7.5 13H4.5z" /><path d="M12 20.5l-7.5-13h15z" /></>),
  stillness: () => icon(<><path d="M4 15.5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2" /><path d="M4 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2" /><circle cx="12" cy="7" r="2.5" /></>),
  review: () => icon(<><path d="M5 12a7 7 0 1 0 2.1-5" /><path d="M5 4.5v3h3" /></>),
  wheel: () => icon(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2" /><path d="M12 3.5V10M12 14v6.5M3.5 12H10M14 12h6.5" /></>),
};
