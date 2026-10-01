import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { shouldShowWebViewHint, WEBVIEW_HINT_KEY, WEBVIEW_HINT_TEXT, WEBVIEW_PLAY_URL } from '../services/webViewHint.mjs';

const readShown = () => { try { return window.localStorage.getItem(WEBVIEW_HINT_KEY) === 'shown'; } catch { return false; } };
const markShown = () => { try { window.localStorage.setItem(WEBVIEW_HINT_KEY, 'shown'); } catch { /* shown once per launch then */ } };

// Shown once (the first launch it applies to), dismissible; the button opens the WebView's page in Google Play.
export default function WebViewUpdateHint() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!shouldShowWebViewHint({ platform: Capacitor.getPlatform(), userAgent: navigator.userAgent, alreadyShown: readShown() })) return;
    markShown();
    setOpen(true);
  }, []);
  if (!open) return null;
  return <aside className="webview-hint" role="status">
    {/* The product names are kept whole and in their own direction inside the Hebrew line. */}
    <p aria-label={WEBVIEW_HINT_TEXT}>לחוויה מיטבית עדכנו את <bdi className="webview-hint-name">Android System WebView</bdi> בחנות <bdi className="webview-hint-name">Google Play</bdi></p>
    <div className="webview-hint-actions">
      <button type="button" className="webview-hint-open" onClick={() => { setOpen(false); window.location.href = WEBVIEW_PLAY_URL; }}>לעדכון בחנות</button>
      <button type="button" className="webview-hint-close" onClick={() => setOpen(false)}>לא עכשיו</button>
    </div>
  </aside>;
}
