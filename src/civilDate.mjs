// A civil date is a calendar key, not the current Jewish date after sunset.
// Always resolve it in the zmanim location's timezone, never the device timezone.
export function civilDateKey(instant = new Date(), timeZone = 'Asia/Jerusalem') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = type => parts.find(value => value.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Sunset is supplied by a trusted provider. Missing sunset means unknown, not midnight.
export function jewishDateKey(instant, sunset, timeZone = 'Asia/Jerusalem') {
  const civil = civilDateKey(instant, timeZone);
  if (!sunset || !Number.isFinite(new Date(sunset).getTime())) return null;
  if (civilDateKey(new Date(sunset), timeZone) !== civil) return null;
  return instant >= new Date(sunset) ? shiftCivilDate(civil, 1) : civil;
}

export function shiftCivilDate(key, days) {
  const date = civilDateForSolarEngine(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The existing solar engine accepts a UTC date representing a civil calendar day.
export function civilDateForSolarEngine(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new RangeError('Expected a YYYY-MM-DD civil date');
  }
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    throw new RangeError('Invalid civil date');
  }
  return date;
}

export function formatGregorianDate(value, timeZone = 'UTC', includeDay = true) {
  const date = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(`${value}T12:00:00Z`)
      : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('תאריך לועזי אינו תקין');
  const parts = new Intl.DateTimeFormat('en-US', {
    day: includeDay ? 'numeric' : undefined,
    month: 'numeric',
    year: 'numeric',
    timeZone,
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value;
  return includeDay ? `${part('day')}.${part('month')}.${part('year')}` : `${part('month')}.${part('year')}`;
}
