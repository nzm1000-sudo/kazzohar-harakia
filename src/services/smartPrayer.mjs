import { prayerRootFor } from '../data/nusach/siddurLayouts.mjs';

// Chooses which prayer (shacharit/mincha/maariv) is currently relevant using real
// zmanim boundaries rather than fixed clock hours, falling back to a coarse clock
// guess only when zmanim data has not loaded yet.
export function choosePrayerType(now = new Date(), times = null) {
  const current = now instanceof Date ? now : new Date(now);
  const at = key => {
    const value = times?.[key];
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
  };
  const alotHaShachar = at('alotHaShachar');
  const chatzot = at('chatzot');
  const sunset = at('sunset');
  if (alotHaShachar && current < alotHaShachar) return 'maariv';
  if (chatzot) {
    if (current < chatzot) return 'shacharit';
    if (sunset) return current < sunset ? 'mincha' : 'maariv';
    return 'mincha';
  }
  // No zmanim yet: coarse fallback until real times load, using the device's local hour.
  const hour = current.getHours();
  if (hour < 12) return 'shacharit';
  if (hour < 18) return 'mincha';
  return 'maariv';
}

export const PRAYER_TYPE_LABELS = Object.freeze({ shacharit: 'שחרית', mincha: 'מנחה', maariv: 'ערבית' });

// Maps a chosen prayer to the Siddur root that holds it in the chosen rite (data/nusach/siddurLayouts.mjs), so the
// existing Siddur flow (not a new one) can be opened directly. Without a rite: Edot HaMizrach, as before.
export function prayerRootKey(prayerType, { isShabbat = false, nusach = 'edot-hamizrach' } = {}) {
  return prayerRootFor(nusach, prayerType, { isShabbat }) || `${isShabbat ? 'Shabbat' : 'Weekday'} ${prayerType === 'shacharit' ? 'Shacharit' : prayerType === 'mincha' ? 'Mincha' : 'Arvit'}`;
}
