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

// Maps a chosen prayer to the Siddur schema's English root node name so the
// existing dynamic Siddur flow (not a new one) can be opened directly.
export function prayerRootKey(prayerType, { isShabbat = false } = {}) {
  const prefix = isShabbat ? 'Shabbat' : 'Weekday';
  const suffix = prayerType === 'shacharit' ? 'Shacharit' : prayerType === 'mincha' ? 'Mincha' : 'Arvit';
  return `${prefix} ${suffix}`;
}
