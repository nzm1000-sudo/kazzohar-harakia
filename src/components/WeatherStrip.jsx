import { useEffect, useId, useState } from 'react';
import { loadWeather, WEATHER_FRESH_MS } from '../services/weather.mjs';
import { VisuallyHidden } from './a11yPrimitives.jsx';

const WEATHER_RETRIES = 3;
const WEATHER_RETRY_MS = 15000;

// One quiet line above the date: a small living drawing of the sky, the temperature, what it feels like, and the
// next twelve hours as a thin glowing line. It never blocks the page — no place or no reading simply hides it.
export default function WeatherStrip({ location }) {
  const place = String(location?.name || '').split(/[,،]/)[0].trim();
  const [state, setState] = useState({ status: 'loading', weather: null });
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  useEffect(() => {
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) { setState({ status: 'none', weather: null }); return undefined; }
    const controller = new AbortController();
    // A first request can stall (a cold network right after install): retry a few times before giving up until the next refresh.
    let retries = 0;
    let retryTimer = null;
    const load = () => loadWeather({ latitude, longitude }, { signal: controller.signal })
      .then(weather => { retries = 0; setState({ status: 'ready', weather }); })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState(previous => (previous.weather ? previous : { status: retries < WEATHER_RETRIES ? 'loading' : 'none', weather: null }));
        if (retries < WEATHER_RETRIES) { retries += 1; retryTimer = setTimeout(load, WEATHER_RETRY_MS); }
      });
    load();
    const timer = setInterval(load, WEATHER_FRESH_MS);
    return () => { controller.abort(); clearInterval(timer); clearTimeout(retryTimer); };
  }, [latitude, longitude]);

  if (state.status === 'none') return null;
  if (!state.weather) return <div className="weather-strip is-loading" aria-hidden="true"><span className="weather-shimmer" /></div>;
  const w = state.weather;
  const updated = w.stale && w.savedAt ? new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(w.savedAt)) : null;
  // Numbers with their unit are isolated (⁦…⁩) so "27°" never flips to "°27" inside the Hebrew line.
  const ltr = value => `\u2066${value}\u2069`;
  const details = [w.feelsLike !== null && `מרגיש ${ltr(`${w.feelsLike}°`)}`, w.humidity !== null && `לחות ${ltr(`${w.humidity}%`)}`, w.wind !== null && `רוח ${w.wind} קמ״ש`].filter(Boolean);
  const range = w.high !== null && w.low !== null ? `${w.high}° / ${w.low}°` : '';
  const spoken = `מזג האוויר${place ? ` ב${place}` : ''}: ${w.label}, ${w.temperature} מעלות. ${range ? `היום בין ${w.low} ל־${w.high} מעלות. ` : ''}${details.join(', ')}.${updated ? ` עודכן ב־${updated}.` : ''}`;
  // The drawn cells are hidden from assistive technology; one hidden sentence says it all (a label on the section alone
  // would name an empty region, which some screen readers skip).
  return <section className={`weather-strip is-${w.kind}${w.stale ? ' is-stale' : ''}`} aria-label="מזג האוויר">
    <VisuallyHidden>{spoken}</VisuallyHidden>
    {/* Three mirrored cells on equal side columns — now (drawing + temperature) · place and sky · the day's curve and
        range — so the centre text sits exactly in the middle; the details run centred beneath a hairline. */}
    <span className="weather-now" aria-hidden="true"><WeatherGlyph kind={w.kind} /><strong className="weather-temp"><bdi>{w.temperature}°</bdi></strong></span>
    <span className="weather-text" aria-hidden="true">
      {/* The place in the accent colour, with no side glyph, so both centre lines share one exact axis. */}
      {place && <span className="weather-place">{place}</span>}
      <span className="weather-label">{w.label}</span>
    </span>
    <span className="weather-day" aria-hidden="true"><WeatherTrend hours={w.hours} />{range && <span className="weather-range"><bdi>{range}</bdi></span>}</span>
    <span className="weather-details" aria-hidden="true">{updated ? `עודכן ב־${updated}` : details.join(' · ')}</span>
  </section>;
}

function WeatherGlyph({ kind }) {
  const id = useId().replace(/:/g, '');
  const cloud = <path className="wg-cloud" d="M13 29h16a6 6 0 0 0 0-12 8.5 8.5 0 0 0-16.2 2.6A4.8 4.8 0 0 0 13 29z" />;
  return <svg className={`weather-glyph wg-${kind}`} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <defs><radialGradient id={`wg-glow-${id}`}><stop offset="0" stopColor="currentColor" stopOpacity=".38" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></radialGradient></defs>
    <circle cx="20" cy="20" r="19" fill={`url(#wg-glow-${id})`} className="wg-halo" />
    {kind === 'clear' && <g className="wg-sun"><circle cx="20" cy="20" r="6.5" className="wg-core" /><g className="wg-rays">{Array.from({ length: 8 }, (_, index) => <line key={index} x1="20" y1="7.5" x2="20" y2="10.5" transform={`rotate(${index * 45} 20 20)`} />)}</g></g>}
    {kind === 'night' && <g><path className="wg-moon" d="M24.5 11.5a9 9 0 1 0 4.8 15.6A10 10 0 0 1 24.5 11.5z" /><circle className="wg-star s1" cx="11" cy="12" r="1" /><circle className="wg-star s2" cx="30" cy="9" r=".8" /><circle className="wg-star s3" cx="9" cy="24" r=".7" /></g>}
    {kind === 'partly' && <g><g className="wg-sun small"><circle cx="15" cy="15" r="5" className="wg-core" /></g><g className="wg-drift">{cloud}</g></g>}
    {(kind === 'cloudy' || kind === 'fog') && <g className="wg-drift">{cloud}{kind === 'fog' && <g className="wg-mist"><line x1="9" y1="33" x2="31" y2="33" /><line x1="12" y1="36.5" x2="28" y2="36.5" /></g>}</g>}
    {(kind === 'rain' || kind === 'drizzle' || kind === 'storm') && <g>{cloud}<g className="wg-drops">{[14, 20, 26].map((x, index) => <line key={x} className={`d${index}`} x1={x} y1="31" x2={x - 1.5} y2={kind === 'drizzle' ? 33.5 : 35.5} />)}</g>{kind === 'storm' && <path className="wg-bolt" d="M21 29l-3 5h3l-2 4 5-6h-3l2-3z" />}</g>}
    {kind === 'snow' && <g>{cloud}<g className="wg-flakes">{[14, 20, 26].map((x, index) => <circle key={x} className={`d${index}`} cx={x} cy="33.5" r="1.1" />)}</g></g>}
  </svg>;
}

// The next twelve hours: a hairline with a soft fill, a dot at "now", and the day's turning points.
function WeatherTrend({ hours }) {
  const id = useId().replace(/:/g, '');
  if (!hours || hours.length < 3) return null;
  const temps = hours.map(point => point.temperature);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = Math.max(1, max - min);
  const width = 80;
  const height = 22;
  // Right to left, as the page reads: now on the right, twelve hours ahead on the left.
  const points = hours.map((point, index) => [width - 3 - (index / (hours.length - 1)) * (width - 6), 3 + (1 - (point.temperature - min) / span) * (height - 8)]);
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points.at(-1)[0].toFixed(1)} ${height} L${points[0][0].toFixed(1)} ${height} Z`;
  const rainy = hours.some(point => point.rain >= 40);
  return <svg className="weather-trend" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`wt-line-${id}`} x1="1" x2="0" y1="0" y2="0"><stop offset="0" stopColor="currentColor" stopOpacity=".95" /><stop offset="1" stopColor="currentColor" stopOpacity=".25" /></linearGradient>
      <linearGradient id={`wt-fill-${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".18" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient>
    </defs>
    <path d={area} fill={`url(#wt-fill-${id})`} />
    <path d={line} className="wt-line" stroke={`url(#wt-line-${id})`} />
    {rainy && hours.map((point, index) => point.rain >= 40 && <circle key={index} className="wt-rain" cx={points[index][0]} cy={height - 2} r=".9" />)}
    <circle className="wt-now" cx={points[0][0]} cy={points[0][1]} r="2.2" />
    {/* A slow pulse travelling along the next twelve hours, like a gentle EEG trace; still for reduced motion. */}
    {!reducedMotion() && <g className="wt-pulse">
      {['wt-pulse-halo', 'wt-pulse-dot'].map(className => <circle key={className} r={className === 'wt-pulse-halo' ? 4 : 1.7} className={className}>
        {/* Out along the next twelve hours and back again, easing at both ends: never a jump. */}
        <animateMotion dur="36s" repeatCount="indefinite" path={line} keyPoints="0;1;0" keyTimes="0;.5;1" calcMode="spline" keySplines=".42 0 .58 1;.42 0 .58 1" />
      </circle>)}
    </g>}
  </svg>;
}

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
