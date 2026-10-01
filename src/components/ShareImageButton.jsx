import { useState } from 'react';

// "שיתוף כתמונה" — one quiet button beside the other actions. The image is made only on the tap (services/shareImage.mjs,
// loaded then), and the result is said in words: shared, saved, or why not.
const MESSAGES = { shared: '', cancelled: '', saved: 'התמונה נשמרה במכשיר' };
export default function ShareImageButton({ spec, className = 'ghost', label = 'שיתוף כתמונה', style = undefined }) {
  const [state, setState] = useState({ busy: false, message: '' });
  if (!spec) return null;
  const share = async () => {
    if (state.busy) return;
    setState({ busy: true, message: 'מכין תמונה…' });
    try {
      const { shareAsImage, shareCardSpec } = await import('../services/shareImage.mjs');
      const card = shareCardSpec(typeof spec === 'function' ? spec() : spec);
      let base = '/';
      try { base = import.meta.env?.BASE_URL || '/'; } catch { base = '/'; }
      const result = await shareAsImage(card, { baseUrl: base });
      setState({ busy: false, message: MESSAGES[result] ?? '' });
    } catch (error) {
      setState({ busy: false, message: error?.message || 'לא ניתן היה ליצור את התמונה' });
    }
  };
  return <>
    <button type="button" className={`${className} share-image-button`} style={style} onClick={share} disabled={state.busy} aria-busy={state.busy || undefined}>{label}</button>
    {state.message && <span className="share-image-status" role="status">{state.message}</span>}
  </>;
}
