// A gentle, one-time hint in the Android app when its System WebView is older than Chrome 111 — the engine the app's
// colours and layout are designed for (color-mix() and friends). The app works without the update (fallbacks exist);
// the hint only offers it. Never on iOS or in a browser (there the engine is the browser's own).

export const WEBVIEW_HINT_KEY = 'kz-webview-update-hint';
export const WEBVIEW_MODERN_MAJOR = 111;
export const WEBVIEW_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.google.android.webview';
export const WEBVIEW_HINT_TEXT = 'לחוויה מיטבית עדכנו את Android System WebView בחנות Google Play';

export function androidWebViewMajor(userAgent = '') {
  const ua = String(userAgent);
  if (!/Android/i.test(ua)) return null;
  const match = ua.match(/Chrome\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function shouldShowWebViewHint({ platform, userAgent, alreadyShown }) {
  if (platform !== 'android' || alreadyShown) return false;
  const major = androidWebViewMajor(userAgent);
  return major !== null && major < WEBVIEW_MODERN_MAJOR;
}
