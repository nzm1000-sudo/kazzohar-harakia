import { useEffect, useMemo, useRef, useState } from 'react';
import LocationControl from '../components/LocationControl.jsx';
import { alignedWithHysteresis, alignmentZone, angularDifference, distanceKm, headingFromOrientation, headingQuality, initialBearing, JERUSALEM_TARGET, normalizeHeadingSample, prayerDirectionLabel, smoothHeading } from '../services/prayerCompass.mjs';

const NATIVE_EVENT = 'kz-native-heading';

function nativeBridge() {
  if (window.webkit?.messageHandlers?.kzHeading) return { send: value => window.webkit.messageHandlers.kzHeading.postMessage(value) };
  if (window.KZHeading) return { send: value => value.action === 'start' ? window.KZHeading.start() : value.action === 'haptic' ? window.KZHeading.haptic() : window.KZHeading.stop() };
  return null;
}

function formatBearing(value) { return value === null ? '—' : `${Math.round(value)}°`; }
function formatDistance(value) { return value === null ? '—' : `${Math.round(value)} ק״מ`; }
function qualityText(quality) {
  if (quality.level === 'high') return 'דיוק גבוה';
  if (quality.level === 'medium') return 'דיוק בינוני';
  return 'דיוק נמוך';
}

const ticks = Array.from({ length: 72 }, (_, index) => index * 5);

export default function PrayerCompass({ settings, setSettings, onBack }) {
  const target = useMemo(() => initialBearing(settings.location), [settings.location]);
  // The rAF loop is created once per session; read the live target through a ref so location changes apply immediately.
  const targetRef = useRef(target);
  useEffect(() => { targetRef.current = target; }, [target]);
  const alignmentRef = useRef('neutral');
  const distance = useMemo(() => distanceKm(settings.location), [settings.location]);
  const visualRef = useRef(null);
  const dialRef = useRef(null);
  const latestHeading = useRef(null);
  const filteredHeading = useRef(null);
  const previousTime = useRef(0);
  const latestQuality = useRef(headingQuality(-1));
  const frame = useRef(null);
  const listening = useRef(false);
  const activeHandlers = useRef({ native: null, orientation: null });
  const alignedRef = useRef(false);
  const [sensorState, setSensorState] = useState('idle');
  const [quality, setQuality] = useState(headingQuality(-1));
  const [alignment, setAlignment] = useState('neutral');
  const [displayHeading, setDisplayHeading] = useState(null);
  const [sensorMessage, setSensorMessage] = useState('הפעלת החיישן תבקש גישה למצפן רק עכשיו.');

  const updateSemanticState = (heading, nextQuality) => {
    const currentTarget = targetRef.current;
    const error = currentTarget === null || heading === null ? null : angularDifference(currentTarget, heading);
    const zone = alignmentZone(error);
    const canAlign = alignedWithHysteresis(error, alignedRef.current, nextQuality.level);
    const commitAlignment = value => { if (alignmentRef.current !== value) { alignmentRef.current = value; setAlignment(value); } };
    if (canAlign !== alignedRef.current) {
      if (canAlign) nativeBridge()?.send({ action: 'haptic' });
      alignedRef.current = canAlign;
      commitAlignment(canAlign ? 'aligned' : zone);
    } else if (!canAlign) {
      commitAlignment(zone);
    }
    setQuality(previous => previous.level === nextQuality.level && previous.source === nextQuality.source ? previous : nextQuality);
    setDisplayHeading(previous => previous === null || heading === null || Math.abs(angularDifference(heading, previous)) >= 1 ? heading : previous);
  };

  const renderFrame = time => {
    frame.current = null;
    const sample = latestHeading.current;
    if (sample !== null) {
      const elapsed = previousTime.current ? time - previousTime.current : 50;
      filteredHeading.current = smoothHeading(filteredHeading.current, sample, elapsed);
      previousTime.current = time;
      const heading = filteredHeading.current;
      if (dialRef.current) dialRef.current.style.setProperty('--dial-rotation', `${-heading}deg`);
      if (visualRef.current) visualRef.current.style.setProperty('--relative-target', `${angularDifference(targetRef.current, heading) ?? 0}deg`);
      updateSemanticState(heading, latestQuality.current);
    }
    if (listening.current) frame.current = requestAnimationFrame(renderFrame);
  };

  const scheduleFrame = () => {
    if (!frame.current) frame.current = requestAnimationFrame(renderFrame);
  };

  const receiveHeading = event => {
    if (event?.detail?.available === false) {
      stopHeading();
      setSensorState('unavailable');
      setSensorMessage('המצפן החי אינו זמין. הכיוון חושב, אך ניתן להמשיך ללא חיווי חי.');
      return;
    }
    const sample = normalizeHeadingSample(event?.detail);
    if (!sample) return;
    latestHeading.current = sample.heading;
    latestQuality.current = sample.quality;
    setSensorState('ready');
    setSensorMessage(latestQuality.current.source === 'magnetic' ? 'הכיוון מבוסס על צפון מגנטי.' : '');
    scheduleFrame();
  };

  function stopHeading() {
    listening.current = false;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (activeHandlers.current.native) window.removeEventListener(NATIVE_EVENT, activeHandlers.current.native);
    if (activeHandlers.current.orientation) {
      window.removeEventListener('deviceorientationabsolute', activeHandlers.current.orientation, true);
      window.removeEventListener('deviceorientation', activeHandlers.current.orientation, true);
    }
    activeHandlers.current = { native: null, orientation: null };
    nativeBridge()?.send({ action: 'stop' });
  }

  function receiveOrientation(event) {
    const value = headingFromOrientation(event);
    if (value !== null) receiveHeading({ detail: { heading: value, source: 'orientation', headingAccuracy: -1, available: true } });
  }

  async function startHeading() {
    if (listening.current) return;
    listening.current = true;
    latestHeading.current = null;
    filteredHeading.current = null;
    previousTime.current = 0;
    alignedRef.current = false;
    setDisplayHeading(null);
    setAlignment('neutral');
    setSensorState('requesting');
    setSensorMessage('מפעיל חיישן מצפן…');
    const bridge = nativeBridge();
    if (bridge) {
      activeHandlers.current.native = receiveHeading;
      window.addEventListener(NATIVE_EVENT, activeHandlers.current.native);
      bridge.send({ action: 'start' });
      frame.current = requestAnimationFrame(renderFrame);
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
      setSensorMessage('החזק את הטלפון יציב והרחיק אותו ממתכת.');
      frame.current = requestAnimationFrame(renderFrame);
    } catch (error) {
      listening.current = false;
      setSensorState(error.message === 'denied' ? 'denied' : 'unavailable');
      setSensorMessage(error.message === 'denied' ? 'גישה למצפן נדחתה. אפשר להמשיך עם מיקום ידני.' : 'המצפן החי אינו זמין. הכיוון חושב, אך ניתן להמשיך ללא חיווי חי.');
    }
  }

  useEffect(() => () => stopHeading(), []);
  // Fit the whole dial on the first screen: the largest diameter that fits between the
  // dial's top and the bottom tab bar (never wider than the design maximum).
  useEffect(() => {
    const fit = () => {
      const visual = visualRef.current;
      if (!visual) return;
      const width = window.innerWidth;
      const designMax = width <= 560 ? Math.min(width * 0.84, 330) : Math.min(width * 0.82, 390);
      const tabbar = document.querySelector('.tabbar');
      const tabbarHeight = tabbar && getComputedStyle(tabbar).display !== 'none' ? tabbar.getBoundingClientRect().height : 0;
      const topOnPage = visual.getBoundingClientRect().top + window.scrollY;
      const available = window.innerHeight - tabbarHeight - topOnPage - 16;
      visual.style.setProperty('--compass-size', `${Math.round(Math.max(220, Math.min(designMax, available)))}px`);
    };
    fit();
    const frame = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', fit); };
  }, [sensorState]);

  const error = target === null || displayHeading === null ? null : angularDifference(target, displayHeading);
  const zone = alignment === 'aligned' ? 'aligned' : alignmentZone(error);
  const qualityLabel = qualityText(quality);
  const prayerLabel = prayerDirectionLabel(target);
  const turnText = error === null ? sensorMessage : `${error > 0 ? 'פנה' : 'פנה'} ${Math.round(Math.abs(error))}° ${error > 0 ? 'ימינה' : 'שמאלה'}`;
  const status = zone === 'aligned' ? 'מכוון לירושלים' : turnText;
  const aria = target === null ? 'אין מיקום זמין לחישוב הכיוון' : displayHeading === null ? `כיוון ירושלים ${formatBearing(target)}. ${sensorMessage}` : `${status}. כיוון ירושלים ${formatBearing(target)}. ${Math.round(Math.abs(error))} מעלות.`;

  return <section className={`prayer-compass-page compass-zone-${zone}`} aria-label="מצפן תפילה">
    <button type="button" className="local-back" onClick={onBack}><span aria-hidden="true">→</span>חזרה לסידור</button>
    <header className="prayer-compass-heading"><p className="eyebrow">סידור · כלי תפילה</p><h1>מצפן תפילה</h1><p>מכשיר מדויק לכיוון ירושלים ומקום המקדש.</p></header>
    <section className="prayer-compass-card">
      <div className="prayer-compass-status" role="status" aria-live="polite"><strong>{status}</strong><span>{sensorState === 'ready' ? qualityLabel : sensorMessage}</span></div>
      {sensorState === 'idle' || sensorState === 'unavailable' || sensorState === 'denied' ? <button type="button" className="prayer-compass-primary" onClick={startHeading}>{sensorState === 'idle' ? 'הפעל מצפן' : 'נסה שוב'}</button> : <button type="button" className="prayer-compass-secondary" onClick={stopHeading}>עצירת חיישן</button>}
      <div ref={visualRef} className="prayer-compass-visual" role="img" aria-label={aria}>
        {/* Near a cardinal point the Jerusalem label takes that word's place ("מזרח · ירושלים"), so words never overlap. */}
        <div ref={dialRef} className={`prayer-compass-dial${target !== null ? ` target-near-${['north', 'east', 'south', 'west'][Math.round(((target % 360) + 360) % 360 / 90) % 4]}` : ''}`} aria-hidden="true">
          {ticks.map(degrees => <i key={degrees} className={degrees % 30 === 0 ? 'compass-tick is-major' : 'compass-tick'} style={{ '--tick-angle': `${degrees}deg` }} />)}
          <div className="compass-cardinals"><span className="cardinal cardinal-north">צפון</span><span className="cardinal cardinal-east">מזרח</span><span className="cardinal cardinal-south">דרום</span><span className="cardinal cardinal-west">מערב</span></div>
          {/* Jerusalem: a small heart on the rim (its tip toward the centre), the name just inside it on the same line —
              never over the cardinal words. Aligned, the heart glows red within a soft white halo. */}
          {target !== null && <b className="prayer-target-marker" style={{ '--target-angle': `${target}deg` }}><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 21.2l-1.4-1.3C5.4 15.3 2 12.2 2 8.4 2 5.4 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.4 22 8.4c0 3.8-3.4 6.9-8.6 11.5L12 21.2z" /></svg></b>}
          {target !== null && <b className="prayer-target-label" style={{ '--target-angle': `${target}deg` }}><span>{prayerLabel}</span></b>}
        </div>
        <div className="prayer-top-index" aria-hidden="true"><span /></div>
        <div className="prayer-needle" aria-hidden="true" />
        {/* The open book: a faint sky spread across both pages as one picture, "כזוהר" on the right page, "הרקיע" on the left. */}
        <span className="siddur-icon" aria-hidden="true">{['כזוהר', 'הרקיע'].map((word, index) => <i key={word} className={index ? 'page-left' : 'page-right'}><span className="page-sky" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}branding/about-heaven.jpg)` }} /><em className="page-word">{word}</em></i>)}</span>
      </div>
      <div className="prayer-compass-stats"><div><small>כיוון תפילה</small><strong>{formatBearing(target)}</strong></div><div><small>מרחק משוער</small><strong>{formatDistance(distance)}</strong></div><div><small>דיוק</small><strong>{qualityLabel.replace('דיוק ', '')}</strong></div></div>
      {quality.level === 'low' && sensorState === 'ready' && <p className="prayer-compass-hint">הרחיקו את המכשיר ממתכת ונסו להזיזו בצורת 8.</p>}
    </section>
    <section className="prayer-compass-location"><p className="eyebrow">מיקום לחישוב</p><p className="prayer-compass-location-mode">{settings.location.source === 'manual' ? 'מיקום ידני' : settings.location.source === 'device' ? 'מיקום המכשיר' : 'מיקום שמור'}</p><LocationControl settings={settings} setSettings={setSettings} compact /><p className="prayer-compass-note">הכיוון והמרחק מחושבים במכשיר. המיקום משמש כאן בלבד ואינו משנה את המעמד ההלכתי שלך.</p></section>
    <details className="prayer-compass-info"><summary>פרטי הלכה ומקור</summary><p>המתפלל מכוון בתפילתו לכיוון ירושלים ומקום המקדש. החישוב משתמש בנקודת יעד קבועה באזור הר הבית ובכיוון גאוגרפי ראשוני.</p><p>במקרים מיוחדים, כגון אזורים קוטביים או מיקומים חריגים, כדאי לברר את הכיוון.</p><small>מקור: שולחן ערוך, אורח חיים צד · יעד גאוגרפי: {JERUSALEM_TARGET.source}.</small></details>
  </section>;
}
