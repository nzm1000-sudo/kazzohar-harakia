import { civilDateKey } from '../../civilDate.mjs';

const validInstant = value => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
};

// Where the user is, when it is there, and where the sun is — nothing halachic yet.
// Zmanim only count when they belong to the local civil date being prayed; data from
// another day is treated as missing instead of being reused.
export function buildTimeContext({ now = new Date(), settings = {}, times = null, answers = {} } = {}) {
  const instant = validInstant(now) || new Date();
  const location = settings.location || {};
  const tzid = location.tzid || 'Asia/Jerusalem';
  const civilDate = civilDateKey(instant, tzid);
  const onThisDay = value => {
    const date = validInstant(value);
    return date && civilDateKey(date, tzid) === civilDate ? date : null;
  };
  const sunrise = onThisDay(times?.sunrise);
  const sunset = onThisDay(times?.sunset);
  let sun;
  if (sunset) {
    const after = instant >= sunset;
    const seasonalHour = sunrise ? (sunset - sunrise) / 12 : null;
    const minutesAfter = after ? (instant - sunset) / 60000 : 0;
    sun = {
      basis: 'zmanim',
      state: after ? 'after' : 'before',
      sunrise: sunrise?.toISOString() || null,
      sunset: sunset.toISOString(),
      zmaniyotMinutesAfterSunset: after && seasonalHour ? minutesAfter / (seasonalHour / 60000 / 60) : null,
    };
  } else if (answers.sunset === 'before' || answers.sunset === 'after') {
    sun = { basis: 'answer', state: answers.sunset, sunrise: null, sunset: null, zmaniyotMinutesAfterSunset: null };
  } else {
    sun = { basis: 'missing', state: 'unknown', sunrise: null, sunset: null, zmaniyotMinutesAfterSunset: null };
  }
  return {
    instant: instant.toISOString(),
    tzid,
    location: { name: location.name || null, isDefault: !location.source },
    civilDate,
    // Mincha belongs to the day whose afternoon it is, even when opened after sunset.
    prayerDate: civilDate,
    sun,
  };
}
