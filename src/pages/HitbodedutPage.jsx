// התבודדות — a quiet time the person chose for themselves, in "לעצמי". The choice (how long, which background sound,
// a quiet clock or Tehillim flowing by itself, the screen) and then a session on a very dark screen with almost
// nothing on it: a gentle clock, pause, end. The tab bar and the header are hidden while it runs; Back, the Android
// back button and Escape ask before ending. Every way out restores the brightness, the keep-awake and the sound.
// Services: src/services/hitbodedut/* and src/services/ambientAudio/*. Native: KZHitbodedutPlugin (iOS / Android).
// Routes: leatzmi/hitbodedut · …/focus (the Focus explainer) · …/shomer (שומר הסף) · …/packs (offline audio packs —
// reachable only when a pack exists).
import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StatusBar } from '@capacitor/status-bar';
import '@fontsource/heebo/200.css';
import '@fontsource/heebo/300.css';
import '../styles/hitbodedut.css';
import { Glyph, Ornament, PageHead, leatzmiBack } from '../components/leatzmi/common.jsx';
import { AlarmSwitch } from '../components/jewishAlarm/AlarmParts.jsx';
import CompletionButton from '../components/CompletionButton.jsx';
import { useModalFocus } from '../components/a11yPrimitives.jsx';
import { AUTOSCROLL_CONTROL_ATTR } from '../hooks/useAutoScroll.js';
import { prefersReducedMotion } from '../services/autoScroll.mjs';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import {
  hitbodedut, DISPLAYS, PRESET_MINUTES, CUSTOM_MAX_MINUTES, CUSTOM_MIN_MINUTES, stepMinutes, minutesInWords, formatClock,
  remainingInWords, progress, isPaused, elapsedMs, loadPrefs, savePrefs, sessionMinutes, focusSeen, markFocusSeen,
  FOCUS_INTRO, FOCUS_STEPS, FOCUS_AUTOMATION, FOCUS_HONEST, FOCUS_NAME, GATEKEEPER_TEXT, gatekeeperStatus,
  chaptersLabel, clampChapter, TEHILLIM_CHAPTERS, TEHILLIM_ORDERS, WHEEL_SPEEDS, clampSpeed, createShuffleBag, nextWheelChapter,
  wheelItems, itemDurationMs, createWheelAdvancer, WHEEL_SPEED_NAMES, createTapDetector, isTap, END_RAMP_MS, createControlsReveal,
  DIM_STEP_NAMES, DIM_STEP_COUNT, clampDimStep, overlayOpacity, startDimStep,
  enterImmersive, exitImmersive, leaveSession, guardBack, dropGuard, recordSessionTehillim, breathDelay,
} from '../services/hitbodedut/index.mjs';
import { hitbodedutPluginAvailable, nativePlatform } from '../services/hitbodedut/nativePlugin.mjs';
import { ambientAudio, SOUNDS, SOUND_IDS, TONE_PITCHES, isAudible, resolveAmbientChoice, manualChoice } from '../services/ambientAudio/index.mjs';
import { createPackManager } from '../services/ambientAudio/offlinePacks.mjs';
import { PACK_MANIFEST } from '../services/ambientAudio/packCatalog.mjs';

const BASE = 'leatzmi/hitbodedut';
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

  // Leaving the page altogether while a session runs (Back, a link elsewhere) ends it quietly and puts the app back —
  // the chrome at once, the brightness, keep-awake and sound with the end. (The app-wide route watcher in exitGuard.mjs
  // does the same from the router's side.) Deferred, so React's development double-mount does not end a session that
  // is only being re-attached.
  // (A re-mount cancels the pending check, so no timer of this page outlives it.)
  useEffect(() => {
    HitbodedutPage.mounted = (HitbodedutPage.mounted || 0) + 1;
    clearTimeout(HitbodedutPage.leaving);
    return () => {
      HitbodedutPage.mounted -= 1;
      clearTimeout(HitbodedutPage.leaving);
      HitbodedutPage.leaving = setTimeout(() => { HitbodedutPage.leaving = 0; if (!HitbodedutPage.mounted) leaveSession(controller, { statusBar: StatusBar }).catch(() => {}); }, 400);
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
const PREVIEW_MS = 8000;

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
  // A short listen (8 s): a tap on a sound's tile plays it, a tap on the playing tile (or on "עצירת ההאזנה") stops it.
  const playPreview = choice => {
    const audio = ambientAudio();
    audio.prime();                         // inside the tap itself (Safari lets sound start only from a gesture)
    clearTimeout(previewTimer.current);
    if (!isAudible(choice.sound)) { stopPreview(); return; }
    setPreview(true);
    audio.play({ sound: choice.sound, volume: choice.volume, pitch: choice.pitch, stopAt: Date.now() + PREVIEW_MS, title: 'התבודדות' }).catch(() => {});
    previewTimer.current = setTimeout(stopPreview, PREVIEW_MS + 600);
  };
  const togglePreview = () => { if (preview) stopPreview(); else playPreview(ambient); };
  const pickSound = id => {
    const choice = { sound: id, volume: ambient.volume, pitch: ambient.pitch };
    if (preview && ambient.sound === id) { stopPreview(); return; }
    chooseAmbient({ sound: id });
    playPreview(choice);
  };
  const pickPitch = pitch => { chooseAmbient({ pitch }); if (preview) playPreview({ ...ambient, pitch }); };
  useEffect(() => { if (preview) ambientAudio().setVolume(ambient.volume).catch?.(() => {}); }, [ambient.volume]);

  const start = () => {
    clearTimeout(previewTimer.current);
    setPreview(false);
    ambientAudio().prime();
    controller.start({ minutes, sound: ambient.sound, volume: ambient.volume, pitch: ambient.pitch, display: prefs.display, startChapter: prefs.startChapter, order: prefs.tehillimOrder, speed: prefs.tehillimSpeed, screenOn: prefs.screenOn, dim: prefs.dim, dimStep: startDimStep(prefs), chime: prefs.chime, tzid }).catch(() => {});
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
      <div className="hb-tiles" role="radiogroup" aria-labelledby="hb-sound">
        {SOUND_IDS.map(id => {
          const on = ambient.sound === id;
          const playing = on && preview;
          return <button key={id} type="button" role="radio" aria-checked={on} aria-label={`${SOUNDS[id].title}${playing ? ', מתנגן' : ''}`} className={`hb-tile${on ? ' is-on' : ''}${playing ? ' is-playing' : ''}`} onClick={() => pickSound(id)}>
            <span className="hb-tile-glyph" aria-hidden="true">{SOUND_GLYPHS[id]?.()}</span>
            <span className="hb-tile-name" aria-hidden="true">{SOUNDS[id].short}</span>
          </button>;
        })}
      </div>
      <div className="hb-sound-chosen" aria-live="polite">
        <strong>{SOUNDS[ambient.sound]?.title}</strong>
        <small>{SOUNDS[ambient.sound]?.line}</small>
        {ambient.suggested && <span className="hb-suggested">מוצע לשעה זו</span>}
      </div>
      {isAudible(ambient.sound) && <div className="hb-sound-tools">
        {ambient.sound === 'tone' && <div className="hb-seg hb-seg-small" role="radiogroup" aria-label="גובה הצליל" style={{ '--hb-parts': 3 }}>
          {TONE_PITCHES.map(pitch => <button key={pitch.id} type="button" role="radio" aria-checked={ambient.pitch === pitch.id} className={ambient.pitch === pitch.id ? 'is-on' : ''} onClick={() => pickPitch(pitch.id)}><span>{pitch.title}</span></button>)}
        </div>}
        <label className="hb-volume"><span>עוצמה</span>
          <input type="range" min="0.05" max="1" step="0.05" value={ambient.volume} onChange={event => chooseAmbient({ volume: Number(event.target.value) })} aria-valuetext={`${Math.round(ambient.volume * 100)} אחוז`} />
        </label>
        <button type="button" className="hb-text-button" onClick={togglePreview} aria-pressed={preview}>{preview ? 'עצירת ההאזנה' : 'האזנה קצרה'}</button>
      </div>}
      <p className="hb-note">צלילי רקע להתרכזות ולשקט בלבד. הרעשים והצלילים נוצרים במכשיר; צלילי הטבע הם הקלטות חופשיות לשימוש (Pixabay), שמורות באפליקציה — בלי הורדה.</p>
    </section>

    <section className="hb-block" aria-labelledby="hb-display">
      <h2 className="hb-label" id="hb-display">מה על המסך</h2>
      <div className="hb-pair" role="radiogroup" aria-labelledby="hb-display">
        {Object.values(DISPLAYS).map(display => <button key={display.id} type="button" role="radio" aria-checked={prefs.display === display.id} className={`hb-card${prefs.display === display.id ? ' is-on' : ''}`} onClick={() => setPrefs({ display: display.id })}>
          <span className="hb-card-glyph" aria-hidden="true">{display.id === 'tehillim' ? <ScrollGlyph /> : <ClockGlyph />}</span>
          <strong>{display.title}</strong><small>{display.line}</small>
        </button>)}
      </div>
      {tehillim && <div className="hb-seg hb-seg-small" role="radiogroup" aria-label="סדר הפרקים" style={{ '--hb-parts': 2 }}>
        {Object.values(TEHILLIM_ORDERS).map(order => <button key={order.id} type="button" role="radio" aria-checked={prefs.tehillimOrder === order.id} className={prefs.tehillimOrder === order.id ? 'is-on' : ''} onClick={() => setPrefs({ tehillimOrder: order.id })}><span>{order.title}</span></button>)}
      </div>}
      {tehillim && prefs.tehillimOrder === 'sequential' && <label className="hb-chapter">
        <span>מתחילים בפרק</span>
        <select value={prefs.startChapter} onChange={event => setPrefs({ startChapter: clampChapter(event.target.value) })}>
          {Array.from({ length: TEHILLIM_CHAPTERS }, (_, index) => index + 1).map(chapter => <option key={chapter} value={chapter}>{hebrewNumeral(chapter)}</option>)}
        </select>
      </label>}
      {tehillim && prefs.tehillimOrder === 'random' && <p className="hb-note">כל פרק יבוא פעם אחת לפני שפרק כלשהו יחזור — גם מפעם לפעם.</p>}
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

function Session({ controller, session, summary, tzid }) {
  const active = Boolean(session);
  const now = useNow(active);
  const [confirm, setConfirm] = useState(false);
  // The controls rest behind one golden ring at the bottom: a tap on it (or a double tap anywhere) reveals them — and
  // lights the clock — and they hide again after a few quiet seconds, or with another tap on the ring.
  const [revealed, setRevealed] = useState(false);
  const reveal = useMemo(() => createControlsReveal({ onChange: setRevealed }), []);
  useEffect(() => () => reveal.dispose(), [reveal]);
  const wake = useCallback(() => reveal.touch(), [reveal]);       // a touch inside the controls: the count starts again
  const show = useCallback(() => reveal.reveal(), [reveal]);
  useEffect(() => { reveal.hold(confirm); }, [confirm, reveal]);  // never hidden under the end confirmation
  const ringRef = useRef(null);
  const dockRef = useRef(null);
  // Hidden while the keyboard was in them: the focus goes to the ring, never lost on the page.
  useEffect(() => { if (!revealed && dockRef.current?.contains(document.activeElement)) ringRef.current?.focus(); }, [revealed]);
  // The ring's breath restarts when the controls hide again: back on the session's one phase (breath.mjs).
  const ringBreathAt = useMemo(() => breathDelay(), [revealed]);
  // The dimming: one step (0 none … 4 darkest), changed with − / + or the moon button. Each step moves the native
  // brightness (controller.setDimStep → KZHitbodedut.dim / restore) and the software layer together, so every press is
  // visible — on the web, and on a device where the native brightness barely shows. Remembered for the next session.
  const native = hitbodedutPluginAvailable();
  const dimStep = active ? (session.options.dimStep ?? (session.options.dim ? 2 : 0)) : 0;
  const changeDim = next => {
    const step = clampDimStep(next);
    controller.setDimStep(step).catch(() => {});
    try { savePrefs({ ...loadPrefs(storage()), dimStep: step, dim: step > 0 }, storage()); } catch {}
    wake();
  };
  // The Tehillim wheel's pace and hold live here, beside the other controls (the strip below the wheel).
  const [speed, setSpeed] = useState(() => clampSpeed(session?.options?.speed));
  const [held, setHeld] = useState(false);
  const changeSpeed = step => {
    setSpeed(value => {
      const next = clampSpeed(value + step);
      try { savePrefs({ ...loadPrefs(storage()), tehillimSpeed: next }, storage()); } catch {}
      return next;
    });
    wake();
  };
  const rootRef = useRef(null);
  const wheelTap = useRef(null);                     // the Tehillim wheel's own single tap (hold / let go)
  const paused = active && isPaused(session.timer);

  // Immersive: no header, no tab bar, no status bar; the page behind does not scroll.
  useEffect(() => {
    enterImmersive({ statusBar: StatusBar });
    return () => { exitImmersive({ statusBar: StatusBar }); };
  }, []);

  // The clock: ends the session when the time is up.
  useEffect(() => { if (active) controller.tick(now).catch(() => {}); }, [active, now, controller]);

  // Touch: a double tap anywhere reveals the controls and lights the clock; a single tap on the background does nothing
  // (on the Tehillim wheel it holds / lets go of the wheel, once no second tap followed). Buttons work with one tap.
  const taps = useMemo(() => createTapDetector({ onDouble: () => show() }), [show]);
  useEffect(() => () => taps.cancel(), [taps]);
  const down = useRef(null);
  const onPointerDown = event => { down.current = { x: event.clientX, y: event.clientY, t: event.timeStamp }; };
  const onPointerUp = event => {
    const start = down.current;
    down.current = null;
    if (event.target.closest?.('button, a, input, select, [role="alertdialog"]')) return;
    const up = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    if (!isTap(start, up)) return;
    const onWheel = Boolean(event.target.closest?.('.hb-wheel'));
    taps.tap({ x: up.x, y: up.y, t: up.t, single: onWheel ? () => wheelTap.current?.() : null });
  };

  // Back (the iOS edge swipe, the browser) leaves the session: a guard entry with the same address is pushed; when it
  // is popped the session ends quietly on the choice screen — no question, no closing screen (exitGuard.mjs). Escape
  // and the Android back button (NewApp's overlay close) ask before ending. Coming back to the app lights the
  // controls, so the way out is in sight at once.
  useEffect(() => {
    if (!active) return undefined;
    const offBack = guardBack({ controller, statusBar: StatusBar, onReturn: show });
    const onKey = event => { if (event.key === 'Escape') { event.preventDefault(); setConfirm(open => !open); } };
    const onNativeBack = () => setConfirm(open => !open);
    window.addEventListener('keydown', onKey);
    window.addEventListener('kz-native-close-overlay', onNativeBack);
    window.addEventListener('pageshow', show);
    return () => { offBack(); window.removeEventListener('keydown', onKey); window.removeEventListener('kz-native-close-overlay', onNativeBack); window.removeEventListener('pageshow', show); };
  }, [active, controller, show]);
  useEffect(() => { if (!active) { setConfirm(false); dropGuard(); } }, [active]);

  // "לסיים" ends early: straight back to the choice screen, quietly — the closing screen is only for a session whose
  // time ran out (tick → 'completed'). The guard entry is dropped here, as the screen unmounts at once.
  const end = async () => { setConfirm(false); dropGuard(); await leaveSession(controller, { statusBar: StatusBar }).catch(() => {}); };
  const close = () => { controller.dismissSummary(); };

  if (!active && summary) return <div className="hb-session is-summary" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="hb-summary-title" style={{ '--hb-light-ms': `${END_RAMP_MS}ms` }}>
    <Summary summary={summary} tzid={tzid} onClose={close} />
  </div>;
  if (!active) return null;

  const remaining = controller.remaining(now);
  const tehillim = session.options.display === 'tehillim';
  const dimName = DIM_STEP_NAMES[clampDimStep(dimStep)];
  return <div ref={rootRef} className={`hb-session${revealed ? ' is-awake' : ''}${paused ? ' is-paused' : ''}${tehillim ? ' is-tehillim' : ''}`} dir="rtl" role="dialog" aria-modal="true" aria-label="התבודדות"
    onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { down.current = null; }} onKeyDown={wake} onFocus={wake}>
    {tehillim
      ? <TehillimWheel options={session.options} paused={paused} held={held} setHeld={setHeld} speed={speed} remaining={remaining} onChapterRead={chapter => controller.noteChapter(chapter)} tapRef={wheelTap} />
      : <QuietClock session={session} now={now} remaining={remaining} paused={paused} />}
    <div ref={dockRef} id="hb-dock" className={`hb-dock${revealed ? ' is-open' : ''}`} inert={revealed ? undefined : ''} aria-hidden={revealed ? undefined : 'true'} {...{ [AUTOSCROLL_CONTROL_ATTR]: '' }}>
    <div className={`hb-strip${tehillim ? ' is-pair' : ''}`}>
      {tehillim && (held
        ? <div className="hb-step-group is-held">
          <button type="button" className="hb-pill hb-wheel-go" onClick={() => { setHeld(false); wake(); }}><PlayGlyph />המשך</button>
          <small className="hb-step-name" aria-live="polite">הגלגל עוצר</small>
        </div>
        : <Stepper label="קצב" name={WHEEL_SPEED_NAMES[speed]} count={WHEEL_SPEEDS.length} value={speed}
          lessLabel="לאט יותר" moreLabel="מהר יותר" onLess={() => changeSpeed(-1)} onMore={() => changeSpeed(1)} />)}
      <Stepper label="עמעום" name={dimName} count={DIM_STEP_COUNT} value={dimStep}
        lessLabel="פחות עמעום" moreLabel="יותר עמעום" onLess={() => changeDim(dimStep - 1)} onMore={() => changeDim(dimStep + 1)} />
    </div>
    <div className="hb-controls">
      <button type="button" className="hb-ctl" onClick={() => changeDim((dimStep + 1) % DIM_STEP_COUNT)} aria-label={`עמעום: ${dimName}. הקשה לשלב הבא`}>
        <span className="hb-ctl-ring" aria-hidden="true"><MoonGlyph /></span><small aria-hidden="true">עמעום</small>
      </button>
      <button type="button" className="hb-ctl hb-ctl-main" onClick={() => { (paused ? controller.resume() : controller.pause()).catch(() => {}); wake(); }} aria-label={paused ? 'המשך' : 'השהיה'}>
        <span className="hb-ctl-ring" aria-hidden="true">{paused ? <PlayGlyph /> : <PauseGlyph />}</span><small aria-hidden="true">{paused ? 'המשך' : 'השהיה'}</small>
      </button>
      <button type="button" className="hb-ctl" onClick={() => { setConfirm(true); wake(); }} aria-label="סיום ההתבודדות">
        <span className="hb-ctl-ring" aria-hidden="true"><EndGlyph /></span><small aria-hidden="true">סיום</small>
      </button>
    </div>
    </div>
    <div className="hb-ring-bar" {...{ [AUTOSCROLL_CONTROL_ATTR]: '' }}>
      <button ref={ringRef} type="button" className="hb-reveal" onClick={() => reveal.toggle()} aria-label="הצגת פקדים" aria-expanded={revealed} aria-controls="hb-dock">
        <span className="hb-reveal-ring" aria-hidden="true" style={{ '--hb-breath-at': ringBreathAt }} />
      </button>
    </div>
    <div className="hb-dim-layer" data-step={dimStep} style={{ opacity: overlayOpacity(dimStep, { native: native && session.options.screenOn }) }} aria-hidden="true" />
    {confirm && <ConfirmEnd onEnd={end} onStay={() => setConfirm(false)} remaining={remaining} />}
  </div>;
}

// A small − name/dots + control (the wheel's pace, the dimming): the minus on the right (RTL), always visible — calm at
// rest, lit with the rest of the controls. The current step is said in words and shown as dots.
function Stepper({ label, name, count, value, lessLabel, moreLabel, onLess, onMore }) {
  return <div className="hb-step-group" role="group" aria-label={label}>
    <button type="button" className="hb-mini" onClick={onLess} disabled={value <= 0} aria-label={lessLabel}><Minus /></button>
    <span className="hb-step-face">
      <small className="hb-step-label" aria-hidden="true">{label}</small>
      <span className="hb-speed-dots" aria-hidden="true">{Array.from({ length: count }, (_, index) => <i key={index} className={index === value ? 'is-on' : ''} />)}</span>
      <small className="hb-step-name" aria-live="polite">{name}</small>
    </span>
    <button type="button" className="hb-mini" onClick={onMore} disabled={value >= count - 1} aria-label={moreLabel}><Plus /></button>
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

// תהילים ברצף — a wheel of verses: the current verse large and bright in the centre, by the light of a small candle (a
// warm, regal light behind the centre line that breathes with the session's ring — never a flicker); the verses before and after shrink and fade above and
// below, as on a turning drum. It advances verse by verse by itself at a calm reading pace (five speeds, the − / + of
// "קצב" below it); between chapters a quiet title passes through the centre. A tap on the wheel holds it (and lets it
// go; "המשך" says so); a swipe up / down moves one verse, and the wheel goes on from there. Order: from a chosen chapter, or a random order from a shuffle bag kept on the device.
// Reduced motion: no turning — the centre verse alone, changing with a plain fade; the candle's light is still (no breath).
const WHEEL_REACH = 3;                                   // verses shown on each side of the centre
const WHEEL_SCALE = [1, 0.7, 0.54, 0.44];
const WHEEL_OPACITY = [1, 0.6, 0.3, 0.1];           // the neighbours softer, yet still there to see
const WHEEL_TILT = 15;                                   // degrees per step from the centre
const WHEEL_GAP = 18;                                    // px between neighbours (after scaling)
const shuffleBag = (() => { let bag = null; return () => (bag ||= createShuffleBag({ storage: storage() })); })();

function TehillimWheel({ options, paused, held, setHeld, speed, remaining, onChapterRead, tapRef }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [pos, setPos] = useState(1);                     // index into the items; 0 is the first chapter's title
  const [reduced] = useState(() => prefersReducedMotion());
  // The candle breathes with the session's ring, in phase (services/hitbodedut/breath.mjs).
  const [candleBreathAt] = useState(() => breathDelay());
  const boxRef = useRef(null);
  const itemRefs = useRef(new Map());
  const read = useRef(new Set());

  useEffect(() => {
    let live = true;
    import('../data/tehillim.json').then(module => live && setData(module.default)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);
  // The first chapter, once (the order is fixed for the session).
  useEffect(() => { if (data && !chapters.length) setChapters([nextWheelChapter({ order: options.order, start: options.startChapter, bag: shuffleBag() })]); }, [data]);
  const items = useMemo(() => (data ? chapters.flatMap(chapter => wheelItems(chapter, data.chapters[chapter - 1] || [])) : []), [data, chapters]);
  // Always a chapter ready beyond the end of the wheel.
  useEffect(() => {
    if (items.length && items.length - pos < WHEEL_REACH + 4) setChapters(list => [...list, nextWheelChapter({ order: options.order, previous: list[list.length - 1], bag: shuffleBag() })]);
  }, [items.length, pos]);

  // What the wheel's clock reads, always current (kept in refs, so the clock never has to be rebuilt — the page
  // re-renders every second for the time, and rebuilding the timer on each render is what kept the wheel still).
  const itemsRef = useRef(items);
  const posRef = useRef(pos);
  const speedRef = useRef(speed);
  const onReadRef = useRef(onChapterRead);
  itemsRef.current = items;
  posRef.current = pos;
  speedRef.current = speed;
  onReadRef.current = onChapterRead;

  const go = useCallback(step => {
    const list = itemsRef.current;
    const current = posRef.current;
    const next = Math.max(0, Math.min(list.length - 1, current + step));
    // A chapter is read when its last verse has left the centre going forward.
    for (let i = current; i < next; i += 1) {
      const item = list[i];
      if (item?.type === 'verse' && item.last && !read.current.has(item.chapter)) { read.current.add(item.chapter); onReadRef.current?.(item.chapter); }
    }
    posRef.current = next;
    setPos(next);
  }, []);

  // The pace: verse after verse by itself, each staying for its own time at the chosen speed — the same with reduced
  // motion (only the turning animation is left out). Only the session's pause or the person's tap (hold) stop it.
  const clock = useMemo(() => createWheelAdvancer({
    durationOf: () => itemDurationMs(itemsRef.current[posRef.current], speedRef.current),
    onAdvance: () => go(1),
  }), [go]);
  useEffect(() => () => clock.dispose(), [clock]);
  const running = Boolean(data) && items.length > 0 && !paused && !held;
  useEffect(() => { clock.setRunning(running); }, [clock, running]);
  useEffect(() => { clock.retime(); }, [clock, speed]);

  // A single tap on the wheel (from the session's tap detector) holds / lets go.
  useEffect(() => { tapRef.current = () => setHeld(value => !value); return () => { tapRef.current = null; }; }, [tapRef, setHeld]);
  // A swipe moves one verse (up: onwards) and the wheel goes on from there by itself (it is held only by a tap).
  const swipe = useRef(null);
  const onPointerDown = event => { swipe.current = { y: event.clientY, t: event.timeStamp }; };
  const onPointerUp = event => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dy = event.clientY - start.y;
    if (Math.abs(dy) > 40) { go(dy < 0 ? 1 : -1); clock.moved(); }
  };

  // The drum: each visible item is measured and placed around the centre; transforms animate (CSS) between turns.
  const visible = [];
  for (let k = -WHEEL_REACH; k <= WHEEL_REACH; k += 1) if (items[pos + k]) visible.push({ k, item: items[pos + k], index: pos + k });
  useLayoutEffect(() => {
    if (reduced) return;
    const heights = new Map();
    for (const { index } of visible) heights.set(index, itemRefs.current.get(index)?.offsetHeight || 0);
    const placeOf = k => {
      const step = Math.sign(k);
      let y = 0;
      for (let j = 0; j !== k; j += step) {
        const a = Math.abs(j), b = Math.abs(j + step);
        const ha = (heights.get(pos + j) ?? 60) * (WHEEL_SCALE[a] ?? 0.4), hb = (heights.get(pos + j + step) ?? 60) * (WHEEL_SCALE[b] ?? 0.4);
        y += step * (ha / 2 + WHEEL_GAP + hb / 2);
      }
      return y;
    };
    const style = (k, index) => {
      const a = Math.min(Math.abs(k), WHEEL_SCALE.length - 1);
      const h = heights.get(index) || 0;
      return { transform: `translate3d(0, ${(placeOf(k) - h / 2).toFixed(1)}px, 0) rotateX(${(-k * WHEEL_TILT).toFixed(1)}deg) scale(${WHEEL_SCALE[a]})`, opacity: String(Math.abs(k) > WHEEL_REACH ? 0 : WHEEL_OPACITY[a]) };
    };
    for (const { k, index } of visible) {
      const element = itemRefs.current.get(index);
      if (!element) continue;
      if (!element.dataset.placed) {
        // A newcomer starts one step further out, invisible, and turns into place with the rest.
        const from = style(k + Math.sign(k || 1), index);
        element.style.transition = 'none';
        element.style.transform = from.transform;
        element.style.opacity = '0';
        void element.offsetHeight;
        element.style.transition = '';
        element.dataset.placed = '1';
      }
      const to = style(k, index);
      element.style.transform = to.transform;
      element.style.opacity = to.opacity;
    }
  });

  const current = items[pos];
  return <div className="hb-wheel-wrap">
    <p className="hb-flow-time" aria-hidden="true"><span dir="ltr">{formatClock(remaining)}</span></p>
    <div ref={boxRef} className={`hb-wheel${reduced ? ' is-still' : ''}`} onPointerDown={onPointerDown} onPointerUp={onPointerUp} aria-label="תהילים ברצף" role="region">
      <div className="hb-candle" aria-hidden="true" style={{ '--hb-breath-at': candleBreathAt }}><span /></div>
      {!data && !failed && <p className="hb-flow-status" role="status">טוען…</p>}
      {failed && <p className="hb-flow-status" role="alert">טעינת הטקסט נכשלה</p>}
      {data && !reduced && visible.map(({ k, item, index }) => <WheelItem key={item.key + ':' + index} item={item} centre={k === 0}
        ref={element => { if (element) itemRefs.current.set(index, element); else itemRefs.current.delete(index); }} />)}
      {data && reduced && current && <WheelItem key={current.key + ':' + pos} item={current} centre still />}
      {current && <p className="hb-sr" aria-live="polite">{current.type === 'title' ? `תהילים פרק ${hebrewNumeral(current.chapter)}` : ''}</p>}
    </div>
  </div>;
}

const WheelItem = forwardRef(function WheelItem({ item, centre, still }, ref) {
  const className = `hb-wheel-item${item.type === 'title' ? ' is-title' : ''}${centre ? ' is-centre' : ''}${still ? ' is-still' : ''}`;
  if (item.type === 'title') return <div ref={ref} className={className} lang="he"><span>פרק {hebrewNumeral(item.chapter)}</span><Ornament /></div>;
  return <p ref={ref} className={className} lang="he" aria-hidden={centre ? undefined : 'true'}>{item.text}</p>;
});

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
  // The chapters are already in the journal (recorded silently at the end — exitRecording.mjs), so this "סיימתי" reads
  // "ישר כח!"; should the entry have been undone, it records the very same entry again (same source / id / instant).
  const record = () => recordSessionTehillim(summary, storage() || undefined);
  return <div className="hb-summary">
    <span className="hb-summary-light" aria-hidden="true" />
    <h2 id="hb-summary-title" ref={ref} tabIndex={-1}>{completed ? 'הזמן שבחרת הסתיים' : 'ההתבודדות הסתיימה'}</h2>
    <Ornament />
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

// The sound tiles: one fine-line sign each. The noises are drawn as their spectrum (equal bars for white, gently and
// steeply falling bars for pink and brown); the rest as what they are.
const bars = heights => svg(<>{heights.map((h, i) => <path key={i} d={`M${5 + i * 3.5} ${18 - h / 2 - 6}v${h}`} />)}</>, 24);
const SOUND_GLYPHS = {
  silence: () => svg(<><path d="M5 12h14" /><circle cx="12" cy="12" r="8.5" opacity=".35" /></>, 24),
  white: () => bars([9, 9, 9, 9, 9]),
  pink: () => bars([12, 10, 8, 6.5, 5]),
  brown: () => bars([14, 9, 5.5, 3.5, 2]),
  tone: () => svg(<path d="M3 12c1.5-5 3-5 4.5 0s3 5 4.5 0 3-5 4.5 0 3 5 4.5 0" />, 24),
  deep: () => svg(<><path d="M5 15.5V13a7 7 0 0 1 14 0v2.5" /><rect x="3.8" y="14" width="3.4" height="5.5" rx="1.4" /><rect x="16.8" y="14" width="3.4" height="5.5" rx="1.4" /></>, 24),
  aquarium: () => svg(<><circle cx="9" cy="15.5" r="3.2" /><circle cx="14.8" cy="9.6" r="2.2" /><circle cx="10.6" cy="6.4" r="1.2" /><circle cx="16.4" cy="16.4" r="1.4" /></>, 24),
  brook: () => svg(<><path d="M3 9.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" /><path d="M3 14.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" /><path d="M7 19h4M14 19h3" opacity=".6" /></>, 24),
  flow: () => svg(<path d="M12 3.8c3.2 4.1 5.2 7.1 5.2 10a5.2 5.2 0 0 1-10.4 0c0-2.9 2-5.9 5.2-10z" />, 24),
  rain: () => svg(<><path d="M7.5 14.5h9.2a3.4 3.4 0 0 0 .3-6.8 5 5 0 0 0-9.6 1.2 2.8 2.8 0 0 0 .1 5.6z" /><path d="M9 17.5l-.8 2M13 17.5l-.8 2M17 17.5l-.8 2" /></>, 24),
};
