export const SERVICE_CATEGORIES = Object.freeze([
  { id: 'synagogue', label: 'בתי כנסת' },
  { id: 'minyan', label: 'מניינים' },
  { id: 'kosher', label: 'אוכל כשר' },
  { id: 'mikveh', label: 'מקווה' },
  { id: 'eruv', label: 'עירוב' },
]);

export const CAUTIONS = Object.freeze({
  kosher: 'אין להסתמך על רשימה זו לקביעת כשרות עדכנית. יש לאמת מול ההשגחה במקום.',
  eruv: 'יש לאמת את מצב העירוב לפני שבת.',
});

export const OFFLINE_MESSAGE = 'אין חיבור לרשת. לא ניתן לחפש שירותים כעת; מוצגים רק מקומות שנשמרו.';
export const UNAVAILABLE_MESSAGE = 'אין כרגע מקור נתונים זמין לחיפוש שירותים ביעד.';

/**
 * Results are only ever returned from a configured provider. When none exists the
 * framework reports that fact instead of inventing places.
 */
export function createNearbyService({ provider = null, online = () => true } = {}) {
  return {
    hasProvider: Boolean(provider),
    async search({ latitude, longitude, category, signal } = {}) {
      if (!online()) return { status: 'offline', message: OFFLINE_MESSAGE, results: [] };
      if (!provider) return { status: 'unavailable', message: UNAVAILABLE_MESSAGE, results: [] };
      if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
        return { status: 'unavailable', message: 'אין קואורדינטות ליעד.', results: [] };
      }
      try {
        const raw = await provider({ latitude, longitude, category, signal });
        return { status: 'ok', message: null, results: normalizeResults(raw, category) };
      } catch (error) {
        return { status: 'error', message: error?.message || OFFLINE_MESSAGE, results: [] };
      }
    },
  };
}

/** Entries without a named source are dropped rather than shown as unattributed facts. */
export function normalizeResults(raw, category) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => ({
      name: String(item?.name || '').trim(),
      category: item?.category || category || null,
      address: String(item?.address || '').trim() || null,
      link: item?.link || null,
      contact: item?.contact || null,
      source: String(item?.source || '').trim(),
      lastChecked: item?.lastChecked || null,
      caution: CAUTIONS[item?.category || category] || null,
    }))
    .filter(item => item.name && item.source);
}
