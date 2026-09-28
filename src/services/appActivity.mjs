// What the user is doing elsewhere in the app, for Halacha to use as context ("שכחתי" while in Mincha means Mincha).
// Contract: { area: 'siddur' | 'birkat-hamazon' | 'reader' | ..., prayer?: 'shacharit' | 'mincha' | 'arvit' | 'musaf',
//             section?: 'amida' | 'birkat-hamazon' | 'hallel' | 'omer' | 'kiddush' | 'havdala' | 'shema', title?, at }.
// Kept for the session only (sessionStorage) and forgotten after MAX_AGE: it describes "now", not a history.
const KEY = 'kz-app-activity-v1';
export const ACTIVITY_MAX_AGE = 30 * 60 * 1000;
const store = () => { try { return globalThis.sessionStorage || null; } catch { return null; } };

export function setAppActivity(activity, storage = store(), now = Date.now()) {
  if (!activity?.area) return null;
  const value = { area: activity.area, ...(activity.prayer ? { prayer: activity.prayer } : {}), ...(activity.section ? { section: activity.section } : {}), ...(activity.title ? { title: String(activity.title).slice(0, 80) } : {}), at: now };
  try { storage?.setItem(KEY, JSON.stringify(value)); } catch { /* storage unavailable */ }
  return value;
}

export function getAppActivity(storage = store(), now = Date.now(), maxAge = ACTIVITY_MAX_AGE) {
  try {
    const value = JSON.parse(storage?.getItem(KEY) || 'null');
    return value && now - value.at <= maxAge ? value : null;
  } catch { return null; }
}

export function clearAppActivity(storage = store()) { try { storage?.removeItem(KEY); } catch { /* ignore */ } }

// A siddur title → the prayer it belongs to (used by the siddur hook).
export function prayerFromTitle(title = '') {
  const text = String(title);
  if (/מנחה/.test(text)) return 'mincha';
  if (/ערבית|מעריב/.test(text)) return 'arvit';
  if (/מוסף/.test(text)) return 'musaf';
  if (/שחרית|ברכות השחר/.test(text)) return 'shacharit';
  return null;
}
export function sectionFromTitle(title = '') {
  const text = String(title);
  if (/ברכת המזון|ברהמ"ז/.test(text)) return 'birkat-hamazon';
  if (/הלל/.test(text)) return 'hallel';
  if (/ספירת העומר|העומר/.test(text)) return 'omer';
  if (/הבדלה/.test(text)) return 'havdala';
  if (/קידוש/.test(text)) return 'kiddush';
  return null;
}
