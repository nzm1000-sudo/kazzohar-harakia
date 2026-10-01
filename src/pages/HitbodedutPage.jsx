// התבודדות — a quiet time the person chose for themselves, in "לעצמי". The choice (how long, which background sound,
// a quiet clock or Tehillim flowing by itself, the screen) and then a session on a very dark screen with almost
// nothing on it: a gentle clock, pause, end. The tab bar and the header are hidden while it runs; Back, the Android
// back button and Escape ask before ending. Every way out restores the brightness, the keep-awake and the sound.
// Services: src/services/hitbodedut/* and src/services/ambientAudio/*. Native: KZHitbodedutPlugin (iOS / Android).
// Routes: leatzmi/hitbodedut · …/focus (the Focus explainer) · …/shomer (שומר הסף) · …/packs (offline audio packs —
// reachable only when a pack exists).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StatusBar } from '@capacitor/status-bar';
import '@fontsource/heebo/200.css';
import '@fontsource/heebo/300.css';
import '../styles/hitbodedut.css';
import { Glyph, Ornament, PageHead, leatzmiBack } from '../components/leatzmi/common.jsx';
import { AlarmSwitch } from '../components/jewishAlarm/AlarmParts.jsx';
import CompletionButton from '../components/CompletionButton.jsx';
import { useModalFocus } from '../components/a11yPrimitives.jsx';
import { useAutoScroll, AUTOSCROLL_CONTROL_ATTR } from '../hooks/useAutoScroll.js';
import { recordTehillimCompletion } from '../services/mitzvotJournal.mjs';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import {
  hitbodedut, DISPLAYS, PRESET_MINUTES, CUSTOM_MAX_MINUTES, CUSTOM_MIN_MINUTES, stepMinutes, minutesInWords, formatClock,
  remainingInWords, progress, isPaused, elapsedMs, loadPrefs, savePrefs, sessionMinutes, focusSeen, markFocusSeen,
  FOCUS_INTRO, FOCUS_STEPS, FOCUS_AUTOMATION, FOCUS_HONEST, FOCUS_NAME, GATEKEEPER_TEXT, gatekeeperStatus,
  chapterSequence, chaptersLabel, clampChapter, TEHILLIM_CHAPTERS,
} from '../services/hitbodedut/index.mjs';
import { nativePlatform } from '../services/hitbodedut/nativePlugin.mjs';
import { ambientAudio, SOUNDS, SOUND_IDS, TONE_PITCHES, isAudible, resolveAmbientChoice, manualChoice } from '../services/ambientAudio/index.mjs';
import { createPackManager } from '../services/ambientAudio/offlinePacks.mjs';
import { PACK_MANIFEST } from '../services/ambientAudio/packCatalog.mjs';

const BASE = 'leatzmi/hitbodedut';
const IMMERSIVE_ATTR = 'data-kz-immersive';
const storage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const packManager = (() => { let manager = null; return () => (manager ||= createPackManager({ manifest: PACK_MANIFEST, storage: storage() })); })();

// The controller's state as React state (the session lives in the service, so a re-render or a sub-route never ends it).
function useHitbodedut() {
  const controller = useMemo(() => hitbodedut(), []);
  const [snapshot, setSnapshot] = useState(() => ({ session: controller.session, summary: controller.summary }));
  useEffect(() => {
    const update = () => setSnapshot({ session: controller.session, summary: controller.summary });
    const off = controller.subscribe(update);
    controller.ready?.then(update);
    update();
    return off;
  }, [controller]);
  return { controller, ...snapshot };
}

function useNow(active, interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [active, interval]);
  return now;
}

export default function HitbodedutPage({ route = BASE, go = id => { window.location.hash = id; }, settings }) {
  const parts = String(route).split('/');
  const view = parts[2] || '';
  const tzid = settings?.location?.tzid || 'Asia/Jerusalem';
  const { controller, session, summary } = useHitbodedut();
  const overlay = Boolean(session || summary);
  const back = leatzmiBack(go, BASE);

  // Leaving the page altogether while a session runs (a deep link elsewhere) ends it, so nothing stays dimmed. Deferred,
  // so React's development double-mount does not end a session that is only being re-attached.
  useEffect(() => {
    HitbodedutPage.mounted = (HitbodedutPage.mounted || 0) + 1;
    return () => {
      HitbodedutPage.mounted -= 1;
      setTimeout(() => { if (!HitbodedutPage.mounted && controller.active) controller.end('ended').catch(() => {}); }, 400);
    };
  }, [controller]);

  let page;
  if (view === 'focus') page = <FocusGuide onBack={back} />;
  else if (view === 'shomer') page = <ShomerHasaf onBack={back} />;
  else if (view === 'packs' && packManager().hasPacks) page = <OfflinePacks onBack={back} />;
  else page = <Setup controller={controller} go={go} tzid={tzid} />;
  return <section className="lz hb" dir="rtl">
    {page}
    {overlay && createPortal(<Session controller={controller} session={session} summary={summary} tzid={tzid} />, document.body)}
  </section>;
}

// ── The choice ──────────────────────────────────────────────────────────────────────────────────────────────────────

const DURATION_LABEL = { 15: '15', 30: '30', 60: '60' };

function Setup({ controller, go, tzid }) {
  const [prefs, setPrefsState] = useState(() => loadPrefs(storage()));
  const setPrefs = patch => setPrefsState(previous => savePrefs({ ...previous, ...patch }, storage()));
  const ambient = resolveAmbientChoice(prefs.ambient, new Date(), tzid);
  const chooseAmbient = patch => setPrefs({ ambient: manualChoice({ sound: ambient.sound, volume: ambient.volume, pitch: ambient.pitch }, patch) });
  const minutes = sessionMinutes(prefs);
  const [preview, setPreview] = useState(false);
  const previewTimer = useRef(0);
  const seenFocus = useMemo(() => focusSeen(storage()), []);
  const gate = gatekeeperStatus({ platform: nativePlatform() });

  const stopPreview = useCallback(() => {
    clearTimeout(previewTimer.current);
    setPreview(false);
    if (!controller.active) ambientAudio().stop().catch(() => {});
  }, [controller]);
  useEffect(() => () => { clearTimeout(previewTimer.current); if (!controller.active) ambientAudio().stop().catch(() => {}); }, [controller]);
  const togglePreview = () => {
    if (preview) { stopPreview(); return; }
    const audio = ambientAudio();
    audio.prime();
    setPreview(true);
    audio.play({ sound: ambient.sound, volume: ambient.volume, pitch: ambient.pitch, stopAt: Date.now() + 8000, title: 'התבודדות' }).catch(() => {});
    previewTimer.current = setTimeout(stopPreview, 8600);
  };
  // A change of sound while previewing plays the new one.
  useEffect(() => { if (preview) { if (isAudible(ambient.sound)) ambientAudio().play({ sound: ambient.sound, volume: ambient.volume, pitch: ambient.pitch, stopAt: Date.now() + 8000 }).catch(() => {}); else stopPreview(); } }, [ambient.sound, ambient.pitch]);
  useEffect(() => { if (preview) ambientAudio().setVolume(ambient.volume).catch?.(() => {}); }, [ambient.volume]);

  const start = () => {
    clearTimeout(previewTimer.current);
    setPreview(false);
    ambientAudio().prime();
    controller.start({ minutes, sound: ambient.sound, volume: ambient.volume, pitch: ambient.pitch, display: prefs.display, startChapter: prefs.startChapter, screenOn: prefs.screenOn, dim: prefs.dim, chime: prefs.chime }).catch(() => {});
  };
  const tehillim = prefs.display === 'tehillim';

  return <div className="hb-setup">
    <PageHead title="התבודדות" line="זמן שקט שבחרת לעצמך — לשיחה עם הבורא, ועם עצמך." onBack={leatzmiBack(go, 'leatzmi')} />

    <section className="hb-block" aria-labelledby="hb-duration">
      <h2 className="hb-label" id="hb-duration">משך</h2>
      <div className="hb-seg" role="radiogroup" aria-labelledby="hb-duration" style={{ '--hb-parts': 4 }}>
        {PRESET_MINUTES.map(value => <button key={value} type="button" role="radio" aria-checked={prefs.minutes === value} aria-label={minutesInWords(value)} className={prefs.minutes === value ? 'is-on' : ''} onClick={() => setPrefs({ minutes: value })}>
          <span className="hb-seg-num">{DURATION_LABEL[value]}</span><small>דקות</small>
        </button>)}
        <button type="button" role="radio" aria-checked={prefs.minutes === 'custom'} className={prefs.minutes === 'custom' ? 'is-on' : ''} onClick={() => setPrefs({ minutes: 'custom' })}>
          <span className="hb-seg-num">{prefs.minutes === 'custom' ? prefs.customMinutes : 'אחר'}</span><small>{prefs.minutes === 'custom' ? 'דקות' : 'משלך'}</small>
        </button>
      </div>
      {prefs.minutes === 'custom' && <div className="hb-stepper" role="group" aria-label="משך מותאם">
        <button type="button" className="hb-round" aria-label="פחות" disabled={prefs.customMinutes <= CUSTOM_MIN_MINUTES} onClick={() => setPrefs({ customMinutes: stepMinutes(prefs.customMinutes, -1) })}><Minus /></button>
        <output aria-live="polite">{minutesInWords(prefs.customMinutes)}</output>
        <button type="button" className="hb-round" aria-label="יותר" disabled={prefs.customMinutes >= CUSTOM_MAX_MINUTES} onClick={() => setPrefs({ customMinutes: stepMinutes(prefs.customMinutes, 1) })}><Plus /></button>
      </div>}
    </section>

    <section className="hb-block" aria-labelledby="hb-sound">
      <h2 className="hb-label" id="hb-sound">צליל ברקע</h2>
      <div className="hb-list" role="radiogroup" aria-labelledby="hb-sound">
        {SOUND_IDS.map(id => {
          const on = ambient.sound === id;
          return <button key={id} type="button" role="radio" aria-checked={on} className={`hb-option${on ? ' is-on' : ''}`} onClick={() => chooseAmbient({ sound: id })}>
            <span className="hb-option-mark" aria-hidden="true" />
            <span className="hb-option-text"><strong>{SOUNDS[id].title}</strong><small>{SOUNDS[id].line}</small></span>
            {on && ambient.suggested && <span className="hb-suggested">מוצע לשעה זו</span>}
          </button>;
        })}
      </div>
      {isAudible(ambient.sound) && <div className="hb-sound-tools">
        {ambient.sound === 'tone' && <div className="hb-seg hb-seg-small" role="radiogroup" aria-label="גובה הצליל" style={{ '--hb-parts': 3 }}>
          {TONE_PITCHES.map(pitch => <button key={pitch.id} type="button" role="radio" aria-checked={ambient.pitch === pitch.id} className={ambient.pitch === pitch.id ? 'is-on' : ''} onClick={() => chooseAmbient({ pitch: pitch.id })}><span>{pitch.title}</span></button>)}
        </div>}
        <label className="hb-volume"><span>עוצמה</span>
          <input type="range" min="0.05" max="1" step="0.05" value={ambient.volume} onChange={event => chooseAmbient({ volume: Number(event.target.value) })} aria-valuetext={`${Math.round(ambient.volume * 100)} אחוז`} />
        </label>
        <button type="button" className="hb-text-button" onClick={togglePreview} aria-pressed={preview}>{preview ? 'עצירת ההאזנה' : 'האזנה קצרה'}</button>
      </div>}
      <p className="hb-note">צליל רקע להתרכזות ולשקט בלבד. נוצר במכשיר, בלי הורדה.</p>
    </section>

    <section className="hb-block" aria-labelledby="hb-display">
      <h2 className="hb-label" id="hb-display">מה על המסך</h2>
      <div className="hb-pair" role="radiogroup" aria-labelledby="hb-display">
        {Object.values(DISPLAYS).map(display => <button key={display.id} type="button" role="radio" aria-checked={prefs.display === display.id} className={`hb-card${prefs.display === display.id ? ' is-on' : ''}`} onClick={() => setPrefs({ display: display.id })}>
          <span className="hb-card-glyph" aria-hidden="true">{display.id === 'tehillim' ? <ScrollGlyph /> : <ClockGlyph />}</span>
          <strong>{display.title}</strong><small>{display.line}</small>
        </button>)}
      </div>
      {tehillim && <label className="hb-chapter">
        <span>מתחילים בפרק</span>
        <select value={prefs.startChapter} onChange={event => setPrefs({ startChapter: clampChapter(event.target.value) })}>
          {Array.from({ length: TEHILLIM_CHAPTERS }, (_, index) => index + 1).map(chapter => <option key={chapter} value={chapter}>{hebrewNumeral(chapter)}</option>)}
        </select>
      </label>}
    </section>

    <section className="hb-block" aria-labelledby="hb-screen">
      <h2 className="hb-label" id="hb-screen">המסך</h2>
      <div className="hb-rows">
        <div className="hb-row">
          <span><strong>המסך נשאר דלוק</strong><small>{tehillim ? 'תמיד, כשתהילים זורמים על המסך' : prefs.screenOn ? 'שעון עדין לאורך כל הזמן' : 'אפשר לנעול את הטלפון; הצליל ממשיך'}</small></span>
          <AlarmSwitch checked={tehillim || prefs.screenOn} onChange={value => !tehillim && setPrefs({ screenOn: value })} label="המסך נשאר דלוק" />
        </div>
        {(tehillim || prefs.screenOn) && <div className="hb-row">
          <span><strong>עמעום</strong><small>המסך כהה במיוחד, והבהירות שלך חוזרת בסיום</small></span>
          <AlarmSwitch checked={prefs.dim} onChange={value => setPrefs({ dim: value })} label="עמעום המסך" />
        </div>}
        <div className="hb-row">
          <span><strong>צליל עדין בסיום</strong><small>כשהזמן מסתיים והמסך פתוח</small></span>
          <AlarmSwitch checked={prefs.chime} onChange={value => setPrefs({ chime: value })} label="צליל עדין בסיום" />
        </div>
      </div>
    </section>

    <div className="hb-start-wrap">
      <button type="button" className="hb-start" onClick={start}>התחלה<small>{minutesInWords(minutes)}</small></button>
    </div>

    <nav className="hb-more" aria-label="עוד על התבודדות">
      <a className="hb-more-link" href={`#${BASE}/focus`} onClick={() => markFocusSeen(storage())}>
        <span className="hb-more-glyph" aria-hidden="true"><MoonGlyph /></span>
        <span><strong>שקט מהתראות</strong><small>{seenFocus ? 'מצב ריכוז „התבודדות”' : 'איך מגדירים מצב ריכוז — פעם אחת'}</small></span>
      </a>
      <a className="hb-more-link" href={`#${BASE}/shomer`}>
        <span className="hb-more-glyph" aria-hidden="true"><ShieldGlyph /></span>
        <span><strong>{GATEKEEPER_TEXT.title}</strong><small>{gate.available ? GATEKEEPER_TEXT.line : 'בגרסה עתידית'}</small></span>
      </a>
      {packManager().hasPacks && <a className="hb-more-link" href={`#${BASE}/packs`}>
        <span className="hb-more-glyph" aria-hidden="true">{Glyph.today()}</span>
        <span><strong>הורדה לשימוש ללא רשת</strong><small>הקלטות לבחירתך</small></span>
      </a>}
    </nav>
  </div>;
}

// ── The session ─────────────────────────────────────────────────────────────────────────────────────────────────────

const DIM_LEVELS = [0, 0.35, 0.6];

function Session({ controller, session, summary, tzid }) {
  const active = Boolean(session);
  const now = useNow(active);
  const [confirm, setConfirm] = useState(false);
  const [awake, setAwake] = useState(true);          // the controls fully visible (a touch shows them again)
  const [dimIndex, setDimIndex] = useState(() => (session?.options?.dim ? 1 : 0));
  const idleTimer = useRef(0);
  const rootRef = useRef(null);
  const paused = active && isPaused(session.timer);

  // Immersive: no header, no tab bar, no status bar; the page behind does not scroll.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(IMMERSIVE_ATTR, 'hitbodedut');
    StatusBar.hide().catch(() => {});
    return () => {
      root.removeAttribute(IMMERSIVE_ATTR);
      StatusBar.show().catch(() => {});
    };
  }, []);

  // The clock: ends the session when the time is up.
  useEffect(() => { if (active) controller.tick(now).catch(() => {}); }, [active, now, controller]);

  // The controls rest after a few quiet seconds (dim, never gone: the way out stays visible).
  const wake = useCallback(() => {
    setAwake(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setAwake(false), 5000);
  }, []);
  useEffect(() => { wake(); return () => clearTimeout(idleTimer.current); }, [wake]);

  // Back (the iOS edge swipe, the browser) and Escape ask before ending. A guard entry with the same address is pushed;
  // when it is popped the session re-pushes it and asks. The Android back button arrives as NewApp's overlay close.
  useEffect(() => {
    if (!active) return undefined;
    if (!history.state?.kzHitGuard) history.pushState({ ...(history.state || {}), kzHitGuard: true }, '', location.href);
    const onPop = () => {
      if (!controller.active) return;
      history.pushState({ ...(history.state || {}), kzHitGuard: true }, '', location.href);
      setConfirm(true);
      wake();
    };
    const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); setConfirm(open => !open); wake(); } };
    const onNativeBack = () => { setConfirm(open => !open); wake(); };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    window.addEventListener('kz-native-close-overlay', onNativeBack);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey); window.removeEventListener('kz-native-close-overlay', onNativeBack); };
  }, [active, controller, wake]);
  const dropGuard = () => { if (history.state?.kzHitGuard) history.back(); };
  useEffect(() => { if (!active) { setConfirm(false); dropGuard(); } }, [active]);

  const end = async () => { setConfirm(false); await controller.end('ended').catch(() => {}); };
  const close = () => { controller.dismissSummary(); };

  if (!active && summary) return <div className="hb-session is-summary" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="hb-summary-title">
    <Summary summary={summary} tzid={tzid} onClose={close} />
  </div>;
  if (!active) return null;

  const remaining = controller.remaining(now);
  const tehillim = session.options.display === 'tehillim';
  return <div ref={rootRef} className={`hb-session${awake ? ' is-awake' : ''}${paused ? ' is-paused' : ''}${tehillim ? ' is-tehillim' : ''}`} dir="rtl" role="dialog" aria-modal="true" aria-label="התבודדות"
    onPointerDown={wake} onKeyDown={wake} onFocus={wake}>
    {tehillim
      ? <TehillimFlow start={session.options.startChapter} paused={paused} remaining={remaining} onChapterRead={chapter => controller.noteChapter(chapter)} awake={awake} />
      : <QuietClock session={session} now={now} remaining={remaining} paused={paused} />}
    <div className="hb-controls" {...{ [AUTOSCROLL_CONTROL_ATTR]: '' }}>
      <button type="button" className="hb-ctl" onClick={() => { setDimIndex(index => (index + 1) % DIM_LEVELS.length); wake(); }} aria-label={`עמעום: ${['ללא', 'עמעום', 'עמעום חזק'][dimIndex]}`}>
        <span className="hb-ctl-ring" aria-hidden="true"><MoonGlyph /></span><small aria-hidden="true">עמעום</small>
      </button>
      <button type="button" className="hb-ctl hb-ctl-main" onClick={() => { (paused ? controller.resume() : controller.pause()).catch(() => {}); wake(); }} aria-label={paused ? 'המשך' : 'השהיה'}>
        <span className="hb-ctl-ring" aria-hidden="true">{paused ? <PlayGlyph /> : <PauseGlyph />}</span><small aria-hidden="true">{paused ? 'המשך' : 'השהיה'}</small>
      </button>
      <button type="button" className="hb-ctl" onClick={() => { setConfirm(true); wake(); }} aria-label="סיום ההתבודדות">
        <span className="hb-ctl-ring" aria-hidden="true"><EndGlyph /></span><small aria-hidden="true">סיום</small>
      </button>
    </div>
    <div className="hb-dim-layer" style={{ opacity: DIM_LEVELS[dimIndex] }} aria-hidden="true" />
    {confirm && <ConfirmEnd onEnd={end} onStay={() => setConfirm(false)} remaining={remaining} />}
  </div>;
}

function QuietClock({ session, now, remaining, paused }) {
  const share = progress(session.timer, now);
  const radius = 118;
  const length = 2 * Math.PI * radius;
  const words = remainingInWords(remaining);
  // VoiceOver hears the minutes (once a minute), never a second-by-second count.
  const spoken = useMemo(() => words, [Math.ceil(remaining / 60000), paused]);
  return <div className="hb-clock-wrap">
    <p className="hb-session-name">התבודדות</p>
    <div className="hb-clock" role="timer" aria-live="off" aria-label={`${spoken}${paused ? ', בהשהיה' : ''}`}>
      <svg className="hb-ring" viewBox="0 0 260 260" aria-hidden="true" focusable="false">
        <circle className="hb-ring-track" cx="130" cy="130" r={radius} />
        <circle className="hb-ring-arc" cx="130" cy="130" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - share)} transform="rotate(-90 130 130)" />
      </svg>
      <div className="hb-clock-face" aria-hidden="true">
        <span className="hb-time" dir="ltr">{formatClock(remaining)}</span>
        <span className="hb-time-label">{paused ? 'בהשהיה' : 'נותרו'}</span>
      </div>
    </div>
  </div>;
}

// תהילים ברצף: the chapters flow upwards by themselves (the app's one auto-scroll engine), large and calm, from the
// chosen chapter onwards; more chapters are added before the end is reached. A touch pauses the flow (the engine's
// rule); "המשך הגלילה" brings it back. Under reduced motion it does not start by itself.
function TehillimFlow({ start, paused, remaining, onChapterRead, awake }) {
  const scrollRef = useRef(null);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [count, setCount] = useState(3);
  const read = useRef(new Set());
  useEffect(() => {
    let live = true;
    import('../data/tehillim.json').then(module => live && setData(module.default)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);
  const auto = useAutoScroll(scrollRef, { speed: 'slow', enabled: Boolean(data), autoStart: true });
  const chapters = chapterSequence(start, count);

  // The session's pause holds the flow; its resume lets it go on.
  const heldBySession = useRef(false);
  useEffect(() => {
    if (paused && auto.running) { heldBySession.current = true; auto.pause(); }
    else if (!paused && heldBySession.current) { heldBySession.current = false; auto.resume() || auto.start(); }
  }, [paused]);
  // More text before the end, and a flow that stopped at the end of the text goes on with the new chapter.
  const wasRunning = useRef(false);
  useEffect(() => { if (auto.running) wasRunning.current = true; }, [auto.running]);
  useEffect(() => { if (wasRunning.current && auto.state === 'idle' && !paused) auto.start(); }, [count]);

  const onScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    if (box.scrollHeight - (box.scrollTop + box.clientHeight) < box.clientHeight * 1.6) setCount(value => value + 2);
    for (const element of box.querySelectorAll('[data-chapter]')) {
      const chapter = Number(element.dataset.chapter);
      if (read.current.has(chapter)) continue;
      if (element.offsetTop + element.offsetHeight < box.scrollTop + box.clientHeight * 0.35) { read.current.add(chapter); onChapterRead(chapter); }
    }
  };
  useEffect(() => {
    const box = scrollRef.current;
    if (box && auto.state === 'idle' && data && box.scrollHeight - (box.scrollTop + box.clientHeight) < 2) setCount(value => value + 2);
  }, [auto.state, data]);

  return <div className="hb-flow-wrap">
    <p className="hb-flow-time" aria-hidden="true"><span dir="ltr">{formatClock(remaining)}</span></p>
    <div ref={scrollRef} className="hb-flow" onScroll={onScroll} tabIndex={0} aria-label="תהילים ברצף">
      <div className="hb-flow-lead" aria-hidden="true" />
      {!data && !failed && <p className="hb-flow-status" role="status">טוען…</p>}
      {failed && <p className="hb-flow-status" role="alert">טעינת הטקסט נכשלה</p>}
      {data && chapters.map((chapter, index) => <article key={`${chapter}-${index}`} className="hb-psalm" data-chapter={chapter} lang="he" aria-label={`תהילים פרק ${hebrewNumeral(chapter)}`}>
        <h2 className="hb-psalm-title"><Ornament />פרק {hebrewNumeral(chapter)}</h2>
        {(data.chapters[chapter - 1] || []).map((verse, verseIndex) => <p key={verseIndex} className="hb-verse">{verse}</p>)}
      </article>)}
      <div className="hb-flow-tail" aria-hidden="true" />
    </div>
    {data && !auto.running && !paused && <div className="hb-flow-resume" {...{ [AUTOSCROLL_CONTROL_ATTR]: '' }}>
      <button type="button" className={`hb-pill${awake ? '' : ' is-quiet'}`} onClick={() => auto.resume() || auto.start()}><PlayGlyph />{auto.state === 'paused' ? 'המשך הגלילה' : 'התחלת הגלילה'}</button>
    </div>}
    {data && auto.running && <div className="hb-flow-speed" {...{ [AUTOSCROLL_CONTROL_ATTR]: '' }}>
      <button type="button" className="hb-mini" onClick={() => auto.setSpeed(auto.speed - 4)} aria-label="גלילה איטית יותר"><Minus /></button>
      <span aria-hidden="true">קצב</span>
      <button type="button" className="hb-mini" onClick={() => auto.setSpeed(auto.speed + 4)} aria-label="גלילה מהירה יותר"><Plus /></button>
    </div>}
  </div>;
}

function ConfirmEnd({ onEnd, onStay, remaining }) {
  const panel = useRef(null);
  useModalFocus(panel, true, onStay, { initialFocus: null, inert: false });
  return <div className="hb-confirm-backdrop" onClick={event => { if (event.target === event.currentTarget) onStay(); }}>
    <div className="hb-confirm" role="alertdialog" aria-modal="true" aria-labelledby="hb-confirm-title" aria-describedby="hb-confirm-line" ref={panel}>
      <h2 id="hb-confirm-title">לסיים את ההתבודדות?</h2>
      <p id="hb-confirm-line">{remainingInWords(remaining)}</p>
      <div className="hb-confirm-actions">
        <button type="button" className="hb-pill" onClick={onStay}>להמשיך</button>
        <button type="button" className="hb-pill is-end" onClick={onEnd}>לסיים</button>
      </div>
    </div>
  </div>;
}

function Summary({ summary, tzid, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const { timer, options, chapters } = summary;
  const completed = timer.endReason === 'completed';
  const minutes = Math.max(1, Math.round(elapsedMs(timer) / 60000));
  const record = () => recordTehillimCompletion(chapters.length, { occurredAt: new Date(), tzid, source: 'tehillim', sourceId: `hitbodedut-${timer.id}`, storage: storage() });
  return <div className="hb-summary">
    <Ornament />
    <h2 id="hb-summary-title" ref={ref} tabIndex={-1}>{completed ? 'הזמן שבחרת הסתיים' : 'ההתבודדות הסתיימה'}</h2>
    <p className="hb-summary-line">{completed ? minutesInWords(Math.round(timer.durationMs / 60000)) : `${minutesInWords(minutes)} מתוך ${minutesInWords(Math.round(timer.durationMs / 60000))}`}</p>
    {options.display === 'tehillim' && chapters.length > 0 && <div className="hb-summary-tehillim">
      <p>{chaptersLabel(chapters)}</p>
      <CompletionButton source="tehillim" sourceId={`hitbodedut-${timer.id}`} tzid={tzid} label={chapters.length === 1 ? 'סיימתי את הפרק' : 'סיימתי את הפרקים'} ariaLabel={`סימון ${chaptersLabel(chapters)} כהושלמו`} record={record} />
    </div>}
    <button type="button" className="hb-pill hb-summary-close" onClick={onClose}>חזרה</button>
  </div>;
}

// ── The explainers ──────────────────────────────────────────────────────────────────────────────────────────────────

function FocusGuide({ onBack }) {
  useEffect(() => { markFocusSeen(storage()); }, []);
  const android = nativePlatform() === 'android';
  return <div className="hb-doc">
    <PageHead title="שקט מהתראות" line={`מצב ריכוז בשם „${FOCUS_NAME}”`} onBack={onBack} backLabel="התבודדות" />
    <p className="hb-doc-intro">{FOCUS_INTRO}</p>
    {android
      ? <p className="hb-doc-intro">ב־Android: הגדרות ← צלילים ← „נא לא להפריע” (או „מצבים”), ושם אפשר ליצור מצב בשם „{FOCUS_NAME}”.</p>
      : <ol className="hb-steps">{FOCUS_STEPS.map((step, index) => <li key={step.title}><span className="hb-step-num" aria-hidden="true">{index + 1}</span><span><strong>{step.title}</strong><small>{step.text}</small></span></li>)}</ol>}
    {!android && <p className="hb-doc-note">{FOCUS_AUTOMATION}</p>}
    <p className="hb-doc-note">{FOCUS_HONEST}</p>
  </div>;
}

function ShomerHasaf({ onBack }) {
  const status = gatekeeperStatus({ platform: nativePlatform() });
  return <div className="hb-doc">
    <PageHead title={GATEKEEPER_TEXT.title} line={GATEKEEPER_TEXT.line} onBack={onBack} backLabel="התבודדות" />
    <p className="hb-status"><span aria-hidden="true" className="hb-status-dot" />{status.text}</p>
    <p className="hb-doc-intro">בזמן ההתבודדות, אפליקציות שתבחר ייחסמו במסך שקט — והחסימה תוסר מעצמה בסיום.</p>
    <figure className="hb-shield-preview" aria-label="כך ייראה מסך החסימה">
      <span className="hb-shield-mark" aria-hidden="true"><ShieldGlyph /></span>
      <strong>{GATEKEEPER_TEXT.shieldTitle}</strong>
      <small>{GATEKEEPER_TEXT.shieldSubtitle}</small>
      <span className="hb-shield-button">{GATEKEEPER_TEXT.shieldButton}</span>
    </figure>
    <p className="hb-doc-note">החסימה משתמשת בממשק „זמן מסך” של אפל, שמותר רק לאפליקציות שקיבלו ממנה אישור מיוחד. כשהאישור יתקבל, התכונה תופעל כאן — בבחירתך, ורק בזמן שבחרת.</p>
  </div>;
}

function OfflinePacks({ onBack }) {
  const manager = packManager();
  const [, refresh] = useState(0);
  const [asking, setAsking] = useState(null);
  const [progressById, setProgress] = useState({});
  const [error, setError] = useState('');
  const used = manager.storageUsed();
  const download = async pack => {
    setAsking(null);
    setError('');
    try {
      const { createCapacitorPackFs } = await import('../services/ambientAudio/capacitorFs.mjs');
      const fs = await createCapacitorPackFs();
      const scoped = createPackManager({ manifest: PACK_MANIFEST, fs, storage: storage() });
      await scoped.download(pack.id, { consent: true, onProgress: p => setProgress(state => ({ ...state, [pack.id]: p.fraction })) });
    } catch { setError('ההורדה לא הושלמה. לא נשמר דבר.'); }
    setProgress(state => { const next = { ...state }; delete next[pack.id]; return next; });
    refresh(value => value + 1);
  };
  const remove = async pack => {
    try { const { createCapacitorPackFs } = await import('../services/ambientAudio/capacitorFs.mjs'); await createPackManager({ manifest: PACK_MANIFEST, fs: await createCapacitorPackFs(), storage: storage() }).remove(pack.id); } catch {}
    refresh(value => value + 1);
  };
  return <div className="hb-doc">
    <PageHead title="הורדה לשימוש ללא רשת" line={`בשימוש: ${used.text}`} onBack={onBack} backLabel="התבודדות" />
    <ul className="hb-packs">{manager.list().map(pack => <li key={pack.id} className="hb-pack">
      <span><strong>{pack.title}</strong><small>{pack.sizeText} · {pack.license}</small></span>
      {progressById[pack.id] != null
        ? <progress max="1" value={progressById[pack.id]} aria-label={`מוריד ${pack.title}`} />
        : pack.installed
          ? <button type="button" className="hb-text-button" onClick={() => remove(pack)}>מחיקה</button>
          : <button type="button" className="hb-text-button" onClick={() => setAsking(pack)}>הורדה</button>}
    </li>)}</ul>
    {asking && <div className="hb-consent" role="group" aria-label="אישור הורדה">
      <p>להוריד את „{asking.title}” ({asking.sizeText})? ההורדה משתמשת ברשת פעם אחת, והקבצים נשמרים במכשיר בלבד.</p>
      <div className="hb-confirm-actions"><button type="button" className="hb-pill" onClick={() => setAsking(null)}>לא עכשיו</button><button type="button" className="hb-pill" onClick={() => download(asking)}>הורדה</button></div>
    </div>}
    {error && <p className="hb-doc-note" role="alert">{error}</p>}
  </div>;
}

// ── Glyphs (thin lines, the palette's colour) ──────────────────────────────────────────────────────────────────────

const svg = (children, size = 22) => <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
const Minus = () => svg(<path d="M6 12h12" />, 20);
const Plus = () => svg(<path d="M6 12h12M12 6v12" />, 20);
const PauseGlyph = () => svg(<path d="M9.5 6.5v11M14.5 6.5v11" />);
const PlayGlyph = () => svg(<path d="M15.5 6.8v10.4L8 12z" />);
const EndGlyph = () => svg(<rect x="7.5" y="7.5" width="9" height="9" rx="1.5" />);
const MoonGlyph = () => svg(<path d="M18.5 14.6A7 7 0 0 1 9.4 5.5a7 7 0 1 0 9.1 9.1z" />);
const ShieldGlyph = () => svg(<path d="M12 3.5 5.5 6v5.5c0 4 2.8 7.3 6.5 9 3.7-1.7 6.5-5 6.5-9V6z" />);
const ClockGlyph = () => svg(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></>, 26);
const ScrollGlyph = () => svg(<><path d="M7 4.5h10M7 19.5h10" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" /></>, 26);
