const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
export function checkedCivilKey(key) {
  if (typeof key !== 'string' || !DATE_KEY.test(key) || Number(key.slice(0, 4)) < 1) throw new RangeError('Expected YYYY-MM-DD');
  const date = new Date(`${key}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) throw new RangeError('Invalid civil date');
  return key;
}
export function civilKeyAsLocalDate(key) {
  checkedCivilKey(key);
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  // HDate(Date) consumes HOST-local calendar components, not UTC components.
  return date;
}
export function nextShabbatKey(key) {
  checkedCivilKey(key);
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (6 - date.getUTCDay() + 7) % 7);
  return date.toISOString().slice(0, 10);
}
export function calendarIsIsrael(settings = {}) {
  const status = settings.halachicResidenceStatus || (settings.il ? 'israel' : 'diaspora');
  return status !== 'diaspora';
}
const keyOf = event => typeof event?.date === 'string' ? event.date.slice(0, 10) : '';
const parashaEvent = event => event?.category === 'parashat' || event?.t === 'parashat';
export function selectShabbatReading(items, dayKey) {
  const shabbatKey = nextShabbatKey(dayKey);
  const ordered = (Array.isArray(items) ? items : []).filter(e => DATE_KEY.test(keyOf(e)))
    .slice().sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  const parashot = ordered.filter(e => parashaEvent(e) && new Date(`${keyOf(e)}T12:00:00Z`).getUTCDay() === 6);
  const atShabbat = ordered.filter(e => keyOf(e) === shabbatKey);
  const currentReading = atShabbat.find(parashaEvent)
    || atShabbat.find(e => e.category === 'holiday' && e.leyning?.torah)
    || atShabbat.find(e => e.category === 'holiday' && e.subcat === 'major')
    || null;
  return {
    shabbatKey,
    shabbatReading: currentReading,
    // A future regular parasha is kept separate; never call it THIS Shabbat.
    parasha: parashot.find(e => keyOf(e) >= dayKey) || null,
    previousShabbat: parashot.filter(e => keyOf(e) < dayKey).at(-1) || null,
    upcomingShabbat: parashot.find(e => keyOf(e) > dayKey) || null,
  };
}
