// פֶּרֶק בְּהַפְתָּעָה — one elegant card: choose the scope, turn the wheel, and a whole chapter opens in the Tanakh
// reader. The turn is a short, gentle rotation; with reduced motion there is none (the chapter simply appears).
import { useEffect, useRef, useState } from 'react';
import { PageHead, leatzmiBack } from './common.jsx';
import { SCOPES, drawChapter, readSurprise, setSurpriseScope } from '../../services/leatzmi/surprise.mjs';
import { prefersReducedMotion } from '../../services/autoScroll.mjs';
import { hebrewNumeral } from '../../services/hebrewNumerals.mjs';

const plain = n => hebrewNumeral(n).replace(/[׳״]/g, '');
const TICKS = Array.from({ length: 24 }, (_, index) => index);

export default function SurpriseChapter({ go }) {
  const [scope, setScope] = useState(() => readSurprise().scope);
  const [result, setResult] = useState(null);
  const [turning, setTurning] = useState(false);
  const [angle, setAngle] = useState(0);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const chooseScope = value => { setScope(value); setSurpriseScope(value); };
  const spin = () => {
    if (turning) return;
    const next = drawChapter(scope);
    if (prefersReducedMotion()) { setResult(next); return; }
    setResult(null);
    setTurning(true);
    setAngle(value => value + 300 + Math.round(Math.random() * 120));
    timer.current = setTimeout(() => { setTurning(false); setResult(next); }, 1300);
  };
  return <div className="lz-surprise">
    <PageHead title="פֶּרֶק בְּהַפְתָּעָה" line="פרק שלם מן התנ״ך, שנבחר בשבילך עכשיו." onBack={leatzmiBack(go)} />
    <div className="lz-scope" role="radiogroup" aria-label="מאיפה לבחור">
      {SCOPES.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={scope === id} className={scope === id ? 'is-on' : ''} onClick={() => chooseScope(id)}>{label}</button>)}
    </div>
    <div className="lz-wheel-wrap">
      <svg className="lz-wheel" aria-hidden="true" viewBox="0 0 200 200" style={{ transform: `rotate(${angle}deg)` }} focusable="false">
        <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth=".75" opacity=".55" />
        {TICKS.map(index => <line key={index} x1="100" y1="10" x2="100" y2={index % 6 === 0 ? 24 : 18} stroke="currentColor" strokeWidth={index % 6 === 0 ? 1.25 : .75} transform={`rotate(${index * 15} 100 100)`} />)}
        {!result && <circle cx="100" cy="100" r="4" fill="none" stroke="currentColor" strokeWidth="1" />}
      </svg>
      <span className="lz-wheel-pointer" aria-hidden="true" />
      {/* The chapter appears inside the wheel: the book, and the chapter beneath it. */}
      <div className="lz-surprise-result" aria-live="polite">
        {result && <p className="lz-surprise-name"><span className="lz-visually-hidden">הפרק שלך: </span><span>{result.book}</span><span className="lz-surprise-chapter">פרק {plain(result.chapter)}</span></p>}
      </div>
    </div>
    <div className="lz-center lz-surprise-actions">
      {result
        ? <><button type="button" className="lz-outline lz-strong" onClick={() => go(result.route)}>פתיחת הפרק</button><button type="button" className="lz-text-button" onClick={spin}>פרק אחר</button></>
        : <button type="button" className="lz-outline lz-strong" onClick={spin} disabled={turning}>גַּלְגֵּל אֶת הַגַּלְגַּל</button>}
    </div>
  </div>;
}
