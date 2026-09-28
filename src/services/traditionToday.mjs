// The Today screen's link to "המסורת שלי", kept light: the tradition data (over a thousand records) loads in its own
// chunk, and only for someone who has set up a tradition profile — never on app start for everyone.
const PROFILE_KEY = 'kz-tradition-profile-v1';
export function hasTraditionProfile(store = globalThis.localStorage) {
  try { const profile = JSON.parse(store?.getItem(PROFILE_KEY) || 'null'); return Boolean(profile && Object.keys(profile.roots || {}).length); } catch { return false; }
}
export async function traditionForToday(key) {
  if (!key || !hasTraditionProfile()) return null;
  const tradition = await import('./tradition.mjs');
  const match = tradition.todaysRecords(tradition.loadTraditionProfile(), key)[0];
  return match ? { id: match.record.id, title: match.record.title, community: tradition.communityById(match.communityId)?.nameHe || '' } : null;
}
