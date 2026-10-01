// Weather for the Today strip, from Open-Meteo (free, keyless, data under CC BY 4.0 — credited in About).
// Only the chosen place's coordinates, rounded to two decimals (about 1 km), are sent. A reading is kept on the
// device for 30 minutes; offline, the last reading (up to 12 hours old) is shown with its time.

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const CACHE_KEY = 'kz-weather-v1';
export const WEATHER_FRESH_MS = 30 * 60 * 1000;
export const WEATHER_STALE_MS = 12 * 60 * 60 * 1000;
export const WEATHER_ATTRIBUTION = { name: 'Open-Meteo', url: 'https://open-meteo.com/', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', sourcesUrl: 'https://open-meteo.com/en/license' };

const round2 = value => Math.round(Number(value) * 100) / 100;

export function weatherURL(location) {
  const params = new URLSearchParams({
    latitude: String(round2(location.latitude)),
    longitude: String(round2(location.longitude)),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    hourly: 'temperature_2m,precipitation_probability',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '2',
    wind_speed_unit: 'kmh',
  });
  return `${ENDPOINT}?${params}`;
}

// WMO weather interpretation codes → a Hebrew word and one of eight drawings.
const WMO = [
  [[0], 'clear', 'בהיר'],
  [[1], 'clear', 'בהיר ברובו'],
  [[2], 'partly', 'מעונן חלקית'],
  [[3], 'cloudy', 'מעונן'],
  [[45, 48], 'fog', 'ערפל'],
  [[51, 53, 55, 56, 57], 'drizzle', 'טפטוף'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'rain', 'גשם'],
  [[71, 73, 75, 77, 85, 86], 'snow', 'שלג'],
  [[95, 96, 99], 'storm', 'סופת רעמים'],
];
export function describeWeatherCode(code) {
  const match = WMO.find(([codes]) => codes.includes(Number(code)));
  return match ? { kind: match[1], label: match[2] } : { kind: 'cloudy', label: 'מזג אוויר' };
}

const round = value => (Number.isFinite(Number(value)) ? Math.round(Number(value)) : null);

// The strip's model: now, today's range, and the next twelve hours as a line.
export function summarizeWeather(data) {
  const current = data?.current;
  if (!current || !Number.isFinite(Number(current.temperature_2m))) return null;
  const { kind, label } = describeWeatherCode(current.weather_code);
  const hourlyTimes = data.hourly?.time || [];
  const currentHour = String(current.time || '').slice(0, 13);
  const start = Math.max(0, hourlyTimes.findIndex(time => String(time).slice(0, 13) === currentHour));
  const hours = hourlyTimes.slice(start, start + 13).map((time, index) => ({
    hour: Number(String(time).slice(11, 13)),
    temperature: Number(data.hourly.temperature_2m?.[start + index]),
    rain: Number(data.hourly.precipitation_probability?.[start + index]) || 0,
  })).filter(point => Number.isFinite(point.temperature));
  return {
    temperature: round(current.temperature_2m),
    feelsLike: round(current.apparent_temperature),
    humidity: round(current.relative_humidity_2m),
    wind: round(current.wind_speed_10m),
    isDay: Number(current.is_day) === 1,
    kind: kind === 'clear' && Number(current.is_day) !== 1 ? 'night' : kind,
    label,
    high: round(data.daily?.temperature_2m_max?.[0]),
    low: round(data.daily?.temperature_2m_min?.[0]),
    rainChance: round(data.daily?.precipitation_probability_max?.[0]),
    hours,
  };
}

const locationKey = location => `${round2(location.latitude)},${round2(location.longitude)}`;
function readCache(storage) {
  try { return JSON.parse(storage?.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}
function writeCache(storage, entry) {
  try { storage?.setItem(CACHE_KEY, JSON.stringify(entry)); } catch { /* storage full or blocked: the reading is still shown */ }
  // The home-screen widgets show this same reading (services/nativeWidgets.mjs); they never fetch weather themselves.
  try { globalThis.dispatchEvent?.(new CustomEvent(WEATHER_CHANGE_EVENT)); } catch { /* no window */ }
}
export const WEATHER_CHANGE_EVENT = 'kz-weather-change';
/** The last reading kept on the device for this place ({ weather, savedAt }), or null — no network. */
export function cachedWeather(location, storage = globalThis.localStorage) {
  if (!location) return null;
  const cached = readCache(storage);
  return cached?.key === locationKey(location) && cached.weather ? { weather: cached.weather, savedAt: cached.savedAt } : null;
}

export async function loadWeather(location, { fetchImpl = globalThis.fetch, storage = globalThis.localStorage, now = Date.now(), signal } = {}) {
  if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) throw new Error('אין מיקום למזג האוויר');
  const key = locationKey(location);
  const cached = readCache(storage);
  const usable = cached?.key === key && cached.weather;
  if (usable && now - cached.savedAt < WEATHER_FRESH_MS) return { ...cached.weather, savedAt: cached.savedAt, stale: false };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const abort = () => controller.abort();
    signal?.addEventListener?.('abort', abort);
    let response;
    try { response = await fetchImpl(weatherURL(location), { signal: controller.signal }); } finally { clearTimeout(timer); signal?.removeEventListener?.('abort', abort); }
    if (!response.ok) throw new Error('שירות מזג האוויר אינו זמין');
    const weather = summarizeWeather(await response.json());
    if (!weather) throw new Error('נתוני מזג האוויר חסרים');
    writeCache(storage, { key, savedAt: now, weather });
    return { ...weather, savedAt: now, stale: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (usable && now - cached.savedAt < WEATHER_STALE_MS) return { ...cached.weather, savedAt: cached.savedAt, stale: true };
    throw error;
  }
}
