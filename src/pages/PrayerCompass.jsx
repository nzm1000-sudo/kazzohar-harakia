import { useEffect, useMemo, useRef, useState } from 'react';
import LocationControl from '../components/LocationControl.jsx';
import { circularAverage, compassState, distanceKm, headingFromOrientation, initialBearing, JERUSALEM_TARGET } from '../services/prayerCompass.mjs';

const TOLERANCE = 5;
const nativeBridge = () => {
  if (window.webkit?.messageHandlers?.kzHeading) return { postMessage: value => window.webkit.messageHandlers.kzHeading.postMessage(value) };
  if (window.KZHeading) return { postMessage: value => value.action === 'start' ? window.KZHeading.start() : window.KZHeading.stop() };
  return null;
};

function formatBearing(value) { return value === null ? '—' : `${Math.round(value)}°`; }
function formatDistance(value) {
  if (value === null) return '—';
  return value < 100 ? `${Math.round(value)} ק״מ` : `${Math.round(value)} ק״מ`;
}

export default function PrayerCompass({ settings, setSettings, onBack }) {
  const target = useMemo(() => initialBearing(settings.location), [settings.location]);
  const distance = useMemo(() => distanceKm(settings.location), [settings.location]);
  const [heading, setHeading] = useState(null);
  const [sensorState, setSensorState] = useState('idle');
  const [sensorMessage, setSensorMessage] = useState('הפעלת החיישן תבקש גישה למצפן רק עכשיו.');
  const samples = useRef([]);
  const listening = useRef(false);
  const activeHandlers = useRef({ native: null, orientation: null });

  useEffect(() => () => stopHeading(), []);

  const receiveHeading = event => {
    if (event?.detail?.available === false) {
      stopHeading();
      setSensorState('unavailable');
      setSensorMessage('החיישן אינו זמין במכשיר זה. אפשר להמשיך עם מיקום ידני.');
      return;
    }
    const value = Number(event?.detail?.trueHeading ?? event?.detail?.magneticHeading ?? event?.detail?.heading);
    if (!Number.isFinite(value) || value < 0) return;
    samples.current = [...samples.current.slice(-5), value];
    setHeading(circularAverage(samples.current));
    setSensorState('ready');
    setSensorMessage('');
  };

  function stopHeading() {
    listening.current = false;
    if (activeHandlers.current.native) window.removeEventListener('kz-native-heading', activeHandlers.current.native);
    if (activeHandlers.current.orientation) {
      window.removeEventListener('deviceorientationabsolute', activeHandlers.current.orientation);
      window.removeEventListener('deviceorientation', activeHandlers.current.orientation);
    }
    activeHandlers.current = { native: null, orientation: null };
    nativeBridge()?.postMessage({ action: 'stop' });
  }

  function receiveOrientation(event) {
    const value = headingFromOrientation(event);
    if (value !== null) receiveHeading({ detail: { heading: value } });
  }

  async function startHeading() {
    if (listening.current) return;
    listening.current = true;
    samples.current = [];
    setHeading(null);
    setSensorState('requesting');
    setSensorMessage('מפעיל חיישן מצפן…');
    const bridge = nativeBridge();
    if (bridge) {
      activeHandlers.current.native = receiveHeading;
      window.addEventListener('kz-native-heading', activeHandlers.current.native);
      bridge.postMessage({ action: 'start' });
      return;
    }
    try {
      if (typeof DeviceOrientationEvent === 'undefined') throw new Error('unsupported');
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') throw new Error('denied');
      }
      activeHandlers.current.orientation = receiveOrientation;
      window.addEventListener('deviceorientationabsolute', activeHandlers.current.orientation, true);
      window.addEventListener('deviceorientation', activeHandlers.current.orientation, true);
      setSensorState('waiting');
      setSensorMessage('החזק את הטלפון יציב.');
    } catch (error) {
      listening.current = false;
      setSensorState(error.message === 'denied' ? 'denied' : 'unavailable');
      setSensorMessage(error.message === 'denied' ? 'גישה למצפן נדחתה. אפשר להמשיך עם מיקום ידני.' : 'החיישן אינו זמין במכשיר זה.');
    }
  }

  const state = compassState(target, heading, TOLERANCE);
  const rotation = target === null ? 0 : (heading === null ? 0 : target - heading);
  const status = state.status === 'aligned' ? 'מכוון למקום המקדש' : state.direction === 'right' ? 'הסתובב מעט ימינה' : state.direction === 'left' ? 'הסתובב מעט שמאלה' : sensorMessage;
  const aria = state.status === 'aligned' ? 'מכוון למקום המקדש' : target === null ? 'אין מיקום זמין לחישוב הכיוון' : heading === null ? `כיוון מקום המקדש: ${formatBearing(target)} מצפון. החיישן אינו זמין.` : `${status}. כיוון מקום המקדש: ${formatBearing(target)} מצפון.`;

  return <section className="prayer-compass-page" aria-label="מצפן תפילה">
    <button type="button" className="local-back" onClick={onBack}><span aria-hidden="true">→</span>חזרה לסידור</button>
    <header className="prayer-compass-heading"><p className="eyebrow">סידור · כלי תפילה</p><h1>מצפן תפילה</h1><p>הכוונה מקומית לכיוון ירושלים ומקום המקדש.</p></header>
    <section className={`prayer-compass-card is-${state.status}`}>
      <div className="prayer-compass-status" role="status" aria-live="polite"><strong>{status}</strong>{target !== null && <span>{formatBearing(target)} מצפון · מרחק משוער {formatDistance(distance)}</span>}</div>
      <div className="prayer-compass-visual" role="img" aria-label={aria}>
        <div className="prayer-compass-ring" style={{ '--compass-rotation': `${rotation}deg` }}><span className="compass-mark compass-north">צ</span><span className="compass-mark compass-east">מ</span><span className="compass-mark compass-south">ד</span><span className="compass-mark compass-west">מ</span><span className="prayer-arrow" aria-hidden="true">↑</span><span className="siddur-icon" aria-hidden="true"><i /><i /></span></div>
      </div>
      {sensorState === 'idle' || sensorState === 'unavailable' || sensorState === 'denied' ? <button type="button" className="prayer-compass-primary" onClick={startHeading}>{sensorState === 'idle' ? 'הפעל מצפן' : 'נסה שוב'}</button> : <button type="button" className="prayer-compass-secondary" onClick={stopHeading}>עצירת חיישן</button>}
      {sensorState === 'waiting' && <p className="prayer-compass-hint">ייתכן שנדרש כיול מצפן · סובב את המכשיר בתנועת 8.</p>}
    </section>
    <section className="prayer-compass-location"><p className="eyebrow">מיקום לחישוב</p><p className="prayer-compass-location-mode">{settings.location.source === 'manual' ? 'מיקום ידני' : settings.location.source === 'device' ? 'מיקום המכשיר' : 'מיקום שמור'}</p><LocationControl settings={settings} setSettings={setSettings} compact /><p className="prayer-compass-note">הכיוון והמרחק מחושבים במכשיר. המיקום משמש כאן בלבד ואינו משנה את המעמד ההלכתי שלך.</p></section>
    <details className="prayer-compass-info"><summary>פרטי הלכה ומקור</summary><p>המתפלל מכוון בתפילתו לכיוון ירושלים ומקום המקדש. החישוב משתמש בנקודת יעד קבועה באזור הר הבית ובכיוון גאוגרפי ראשוני.</p><p>במקרים מיוחדים, כגון אזורים קוטביים או מיקומים חריגים, כדאי לברר את הכיוון.</p><small>מקור: שולחן ערוך, אורח חיים צד · יעד גאוגרפי: {JERUSALEM_TARGET.source}.</small></details>
  </section>;
}