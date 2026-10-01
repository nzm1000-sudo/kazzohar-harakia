// בְּהַפְתָּעָה — three wheels on one principle: a whole chapter, a whole verse, or one meaningful word of the Tanakh,
// each from its own shuffle bag (services/leatzmi/surprise.mjs). The turn is a short, gentle rotation; around it the
// geometry is quietly alive (a slow ring of fine gold ticks, a dotted תכלת ring turning the other way, three small
// orbiting lights, a travelling light, a breathing glow). With reduced motion all of it stands still and the result
// simply appears.
import { useEffect, useRef, useState } from 'react';
import { PageHead, leatzmiBack } from './common.jsx';
import { SCOPES, WHEELS, drawChapter, drawVerse, drawWord, readSurprise, setSurpriseScope, setSurpriseWheel } from '../../services/leatzmi/surprise.mjs';
import { verseDisplay } from '../../services/leatzmi/tanakhWords.mjs';
import { gematriaAll, torahWordsWithValue } from '../../services/gematriaCalc.mjs';
import { prefersReducedMotion } from '../../services/autoScroll.mjs';
import { hebrewNumeral } from '../../services/hebrewNumerals.mjs';

const plain = n => hebrewNumeral(n).replace(/[׳״]/g, '');
const range = n => Array.from({ length: n }, (_, index) => index);
const TICKS = range(24);
const FINE = range(72);
const TORAH_BOOKS = new Set(['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']);
const LINES = {
  chapter: 'פרק שלם מן התנ״ך, שנבחר בשבילך עכשיו.',
  verse: 'פסוק אחד מן התנ״ך, שלם, עם מקומו.',
  word: 'מילה אחת מן התנ״ך, כפי שהיא כתובה בפסוק.',
};
const AGAIN = { chapter: 'פרק אחר', verse: 'פסוק אחר', word: 'מילה אחרת' };

// The verse and word wheels read small catalogues (and the verse text) only when they are used.
let catalogues = null;
const loadCatalogues = () => (catalogues ||= Promise.all([import('../../data/leatzmi/tanakhVerses.mjs'), import('../../data/leatzmi/tanakhWords.mjs')]).then(([verses, words]) => ({ books: verses.BOOKS, words: words.WORDS })));
async function verseText(ref) {
  const { localTanakhText } = await import('../../services/localTanakh.mjs');
  const result = await localTanakhText(ref);
  return result?.hebrew?.[0] ? verseDisplay(result.hebrew[0]) : null;
}

export default function SurpriseChapter({ go, wheel: routeWheel = null }) {
  const [wheel, setWheel] = useState(() => (WHEELS.some(([id]) => id === routeWheel) ? routeWheel : readSurprise().wheel));
  const [scope, setScope] = useState(() => readSurprise().scope);
  const [result, setResult] = useState(null);
  const [turning, setTurning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [text, setText] = useState(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (wheel !== 'chapter') loadCatalogues().catch(() => {}); }, [wheel]);
  const title = WHEELS.find(([id]) => id === wheel)[2];
  const chooseWheel = value => { if (turning) return; setWheel(value); setSurpriseWheel(value); setResult(null); setText(null); };
  const chooseScope = value => { setScope(value); setSurpriseScope(value); };
  const spin = async () => {
    if (turning) return;
    let next;
    if (wheel === 'chapter') next = drawChapter(scope);
    else {
      const { books, words } = await loadCatalogues();
      next = wheel === 'verse' ? drawVerse(books, scope) : drawWord(words, books);
    }
    const reveal = () => { setResult({ ...next, wheel }); if (wheel === 'verse') verseText(next.ref).then(setText).catch(() => setText(null)); };
    setText(null);
    if (prefersReducedMotion()) { reveal(); return; }
    setResult(null);
    setTurning(true);
    setAngle(value => value + 300 + Math.round(Math.random() * 120));
    timer.current = setTimeout(() => { setTurning(false); reveal(); }, 1300);
  };
  const shown = result?.wheel === wheel ? result : null;
  return <div className="lz-surprise">
    <PageHead title={title} line={LINES[wheel]} onBack={leatzmiBack(go)} />
    <div className="lz-segments" role="radiogroup" aria-label="מה להגריל">
      {WHEELS.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={wheel === id} className={wheel === id ? 'is-on' : ''} onClick={() => chooseWheel(id)}>{label}</button>)}
    </div>
    {wheel !== 'word' && <div className="lz-scope" role="radiogroup" aria-label="מאיפה לבחור">
      {SCOPES.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={scope === id} className={scope === id ? 'is-on' : ''} onClick={() => chooseScope(id)}>{label}</button>)}
    </div>}
    <div className={`lz-wheel-wrap${turning ? ' is-turning' : ''}`}>
      <WheelGeometry angle={angle} still={Boolean(shown)} />
      <span className="lz-wheel-pointer" aria-hidden="true" />
      <div className="lz-surprise-result" aria-live="polite">
        {shown?.wheel === 'chapter' && <p className="lz-surprise-name"><span className="lz-visually-hidden">הפרק שלך: </span><span>{shown.book}</span><span className="lz-surprise-chapter">פרק {plain(shown.chapter)}</span></p>}
        {shown?.wheel === 'verse' && <p className="lz-surprise-name"><span className="lz-visually-hidden">הפסוק שלך: </span><span>{shown.book}</span><span className="lz-surprise-chapter">{plain(shown.chapter)}, {plain(shown.verse)}</span></p>}
        {shown?.wheel === 'word' && <p className="lz-surprise-name lz-surprise-word"><span className="lz-visually-hidden">המילה שלך: </span><span lang="he">{shown.word}</span></p>}
      </div>
    </div>
    {shown?.wheel === 'verse' && <figure className="lz-surprise-verse">
      {text ? <blockquote lang="he">{text}</blockquote> : <p className="lz-muted" role="status">טוען את הפסוק…</p>}
      <figcaption>{shown.label}</figcaption>
    </figure>}
    {shown?.wheel === 'word' && <WordDetails item={shown} />}
    <div className="lz-center lz-surprise-actions">
      {shown
        ? <><button type="button" className="lz-outline lz-strong" onClick={() => go(shown.route)}>{wheel === 'chapter' ? 'פתיחת הפרק' : 'פתיחה בתנ״ך'}</button><button type="button" className="lz-text-button" onClick={spin}>{AGAIN[wheel]}</button></>
        : <button type="button" className="lz-outline lz-strong" onClick={spin} disabled={turning}>גַּלְגֵּל אֶת הַגַּלְגַּל</button>}
    </div>
  </div>;
}

// The word's place, and — on request — its gematria (the app's own calculator) with a few Torah words of equal value.
function WordDetails({ item }) {
  const [open, setOpen] = useState(false);
  const [same, setSame] = useState(null);
  useEffect(() => { setOpen(false); setSame(null); }, [item.index]);
  const result = open ? gematriaAll(item.word) : null;
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    import('../../data/torahText.mjs').then(module => {
      if (!live) return;
      const torah = module.default.books.filter(book => TORAH_BOOKS.has(book.id));
      setSame(torahWordsWithValue(torah, gematriaAll(item.word).standard, { limit: 6, exclude: item.word }));
    }).catch(() => live && setSame([]));
    return () => { live = false; };
  }, [open, item.index]);
  return <div className="lz-surprise-word-details">
    <p className="lz-surprise-ref">{item.label}</p>
    {!open && <div className="lz-center lz-tight"><button type="button" className="lz-text-button" onClick={() => setOpen(true)}>חשב בגימטריה</button></div>}
    {result && <section className="lz-gematria" aria-label="גימטריה">
      <p className="lz-gematria-value"><span className="lz-visually-hidden">בגימטריה: </span>{result.standard.toLocaleString('he-IL')}</p>
      <p className="lz-gematria-letters" aria-label="פירוט האותיות">{result.letters.map((letter, index) => <span key={index}><b>{letter.letter}</b><small>{letter.value}</small></span>)}</p>
      {same === null && <p className="lz-muted" role="status">מחפש בתורה מילים באותו ערך…</p>}
      {same?.length > 0 && <>
        <p className="lz-gematria-caption">מילים בתורה שערכן {result.standard}</p>
        <p className="lz-gematria-same">{same.map(entry => <span key={entry.word}>{entry.word}</span>)}</p>
      </>}
      {same?.length === 0 && <p className="lz-muted">לא נמצאה בתורה מילה אחרת באותו ערך.</p>}
    </section>}
  </div>;
}

// The geometry: everything thin, in the theme's gold and תכלת; only the inner wheel turns with the spin.
function WheelGeometry({ angle, still }) {
  return <svg className={`lz-wheel${still ? ' is-still' : ''}`} aria-hidden="true" viewBox="0 0 200 200" focusable="false">
    <defs>
      <radialGradient id="lz-wheel-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style={{ stopColor: 'var(--lz-gold)', stopOpacity: 0.22 }} />
        <stop offset="55%" style={{ stopColor: 'var(--lz-sky)', stopOpacity: 0.07 }} />
        <stop offset="100%" style={{ stopColor: 'var(--lz-sky)', stopOpacity: 0 }} />
      </radialGradient>
      <linearGradient id="lz-wheel-comet" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" style={{ stopColor: 'var(--lz-gold)', stopOpacity: 0 }} />
        <stop offset="100%" style={{ stopColor: 'var(--lz-gold-hi)', stopOpacity: 0.95 }} />
      </linearGradient>
    </defs>
    <circle className="lz-wheel-glow" cx="100" cy="100" r="98" fill="url(#lz-wheel-glow)" />
    <circle className="lz-wheel-rim" cx="100" cy="100" r="94" />
    <g className="lz-wheel-fine">{FINE.map(index => <line key={index} x1="100" y1="7.5" x2="100" y2={index % 9 === 0 ? 12 : 10} transform={`rotate(${index * 5} 100 100)`} />)}</g>
    <circle className="lz-wheel-dots" cx="100" cy="100" r="84" />
    <g className="lz-wheel-comet"><path d="M 34.2 34.2 A 93 93 0 0 1 100 7" fill="none" stroke="url(#lz-wheel-comet)" strokeWidth="1.4" strokeLinecap="round" /><circle cx="100" cy="7" r="1.8" /></g>
    <g className="lz-wheel-spin" style={{ transform: `rotate(${angle}deg)` }}>
      <circle cx="100" cy="100" r="74" />
      {TICKS.map(index => <line key={index} x1="100" y1="26" x2="100" y2={index % 6 === 0 ? 36 : 31} strokeWidth={index % 6 === 0 ? 1.1 : 0.7} transform={`rotate(${index * 15} 100 100)`} />)}
    </g>
    <g className="lz-wheel-orbit">{[0, 120, 240].map((turn, index) => <circle key={turn} className={index === 1 ? 'is-gold' : ''} cx="100" cy="16" r={index === 1 ? 1.9 : 1.6} transform={`rotate(${turn} 100 100)`} />)}</g>
    <circle className="lz-wheel-core" cx="100" cy="100" r="58" />
  </svg>;
}
