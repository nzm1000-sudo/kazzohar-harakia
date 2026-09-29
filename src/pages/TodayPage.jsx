import { getNextRelevantZman, timeLabel } from '../services.mjs';
import { timeZoneLabel } from '../services/timeZoneLabel.mjs';
import SpiritualRing from '../components/SpiritualRing.jsx';
import { formatGregorianDate } from '../civilDate.mjs';
import MemorialTribute from '../components/MemorialTribute.jsx';
import LocationControl from '../components/LocationControl.jsx';
import LtrDate from '../components/LtrDate.jsx';
import { tehillimResumeTitle } from '../services/tehillimPresentation.mjs';
import { learningResumeCompactTitle, learningResumeKind, learningResumeSubtitle } from '../services/learningPresentation.mjs';
import { choosePrayerType, PRAYER_TYPE_LABELS } from '../services/smartPrayer.mjs';
import { hebrewEventLabel } from '../services/hebrewCalendarLabels.mjs';
import NerHashem from '../components/NerHashem.jsx';
import NerZikaronCard from '../components/NerZikaronCard.jsx';
import MeatDairyTimer from '../components/MeatDairyTimer.jsx';
import WeatherStrip from '../components/WeatherStrip.jsx';
import { useEffect, useMemo, useState } from 'react';
import { traditionForToday } from '../services/traditionToday.mjs';
import { halachaForSlot, halachaSlotOf } from '../services/halachaEngine.mjs';
import { rabbenuTamAfterSunset, civilKeyAt } from '../services/zmanimLocal.mjs';
import FastCard from '../components/FastCard.jsx';
import TodayAlarmCard from '../components/jewishAlarm/TodayAlarmCard.jsx';

// Beside "המעגל הרוחני": when the coming Shabbat / Yom Tov begins (right) and ends (left).
const WEEKDAY = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'];
function restSides(window, tz, location = null) {
  if (!window) return null;
  // Rabbenu Tam (sunset + 72) for the night Shabbat / Yom Tov ends: a smaller line under the main end time.
  const rabbenuTam = location ? rabbenuTamAfterSunset(civilKeyAt(window.end, tz), location) : null;
  const part = (value, options) => { try { return new Intl.DateTimeFormat('he-IL', { timeZone: tz, ...options }).format(new Date(value)); } catch { return ''; } };
  const time = value => part(value, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const weekday = value => { const name = part(value, { weekday: 'long' }); const index = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'].indexOf(name); return index >= 0 ? index : null; };
  const shabbat = window.kind === 'shabbat';
  const endDay = weekday(window.end);
  const startDay = weekday(window.start);
  return {
    start: { kicker: shabbat ? 'כניסת שבת' : 'כניסת החג', time: time(window.start), note: window.name || (startDay !== null ? WEEKDAY[startDay] : '') },
    end: { kicker: shabbat ? 'יציאת שבת' : 'צאת החג', time: time(window.end), note: shabbat ? 'מוצאי שבת' : endDay === 6 ? 'מוצאי שבת וחג' : 'מוצאי חג', rabbenuTam: rabbenuTam ? time(rabbenuTam) : null },
  };
}

export default function TodayPage({ now, tz, hebrew, events, solar, locationName, afterSunset, onNav, context, resume, onResume, onOpenPrayer, settings, setSettings, dailyItems, dailyProgress, onCompleteDaily, preparation, travel, ring = null, restWindow = null }) {
  const display = todayDisplayPayload({ now, tz, hebrew, events, context });
  const times = solar?.data || null;
  const upcoming = times ? getNextRelevantZman(now, times, { showRT: settings?.showRT }) : null;
  const minutes = upcoming ? Math.max(0, Math.round((upcoming.at - now) / 60000)) : null;
  const { weekday, gregorian, highlights, parashaName, upcomingName } = display;
  const nextMoments = (context?.timeline || []).filter(item => new Date(item.at) >= now).slice(0, 3);
  const learningCards = (resume || []).slice(0, 2);
  const prayerType = choosePrayerType(now, times);
  // Loaded in the background, only for a user with a tradition profile; the screen never waits for it.
  const [traditionToday, setTraditionToday] = useState(null);
  // One halacha per four-hour slot, chosen for today's date and the time of day; stable for the whole slot.
  // The page's own clock for the slot: it wakes at the next four-hour boundary (and on return to the app), so the
  // halacha turns exactly when its slot does, whether or not anything else on the screen changed.
  const [slotClock, setSlotClock] = useState(() => new Date());
  useEffect(() => {
    const at = new Date(); const next = new Date(at); next.setHours((halachaSlotOf(at) + 1) * 4, 0, 5, 0);
    const timer = setTimeout(() => setSlotClock(new Date()), Math.max(1000, next - at));
    const wake = () => { if (!document.hidden) setSlotClock(new Date()); };
    document.addEventListener('visibilitychange', wake);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', wake); };
  }, [slotClock]);
  const slotTime = new Date(Math.max(new Date(now).getTime() || 0, slotClock.getTime()));
  const halachaSlot = halachaSlotOf(slotTime);
  const slotHalacha = useMemo(() => halachaForSlot(context || {}, slotTime), [context?.key, halachaSlot]);
  useEffect(() => { let live = true; traditionForToday(context?.key).then(value => { if (live) setTraditionToday(value); }).catch(() => {}); return () => { live = false; }; }, [context?.key]);
  return (
    <div className="today">
      <section className="today-hero">
        <WeatherStrip location={settings?.location} />
        {/* The day, centred under the weather: civil line, the Hebrew date, and the day's name between two hairlines. */}
        <div className="today-dateline">
          <p className="today-civil">{weekday}<span aria-hidden="true" className="today-civil-dot">·</span><LtrDate value={now} timeZone={tz} /></p>
          <h1 className="hebrew-date" data-testid="today-hebrew">
            {solar?.loading ? 'טוען תאריך…' : (hebrew || 'התאריך העברי אינו זמין')}
          </h1>
          {highlights.map(name => <p className="holiday-line" key={name}><span>{name}</span></p>)}
        </div>
        {solar?.error && <p className="notice error" role="alert">{solar.error}</p>}
      </section>
      {ring && <section className={`spiritual-circle is-${ring.dayOrNight}`} aria-label="המעגל הרוחני">
        {(() => {
          const sides = restSides(restWindow, tz, settings?.location);
          const Side = ({ side, label }) => <div className="spiritual-side" aria-label={label}>{side && <><span className="spiritual-side-kicker">{side.kicker}</span><strong className="spiritual-side-time">{side.time}</strong><span className="spiritual-side-note">{side.note}</span>{side.rabbenuTam && <span className="spiritual-side-rt">רבנו תם · {side.rabbenuTam}</span>}</>}</div>;
          return <>
            <Side side={sides?.start} label={sides ? `${sides.start.kicker} ${sides.start.time}` : undefined} />
            <div className="spiritual-circle-core">
              <SpiritualRing size="large" todayProgress={ring.weekProgress ?? ring.todayProgress} presenceLevel={ring.presenceLevel} dayOrNight={ring.dayOrNight} />
              <p className="spiritual-circle-label">״המעגל הרוחני״</p>
            </div>
            <Side side={sides?.end} label={sides ? `${sides.end.kicker} ${sides.end.time}` : undefined} />
          </>;
        })()}
      </section>}
      {(learningCards.length > 0 || onOpenPrayer) && <section className="learning-resume" aria-label="להמשיך מהיכן שהפסקת">
        <p className="eyebrow">להמשיך מהיכן שהפסקת</p>
        <div className={`learning-resume-grid${learningCards.length === 1 ? ' is-single' : ''}`}>
          {learningCards.map(item => {
            const compact = learningResumeCompactTitle(item);
            // One structure for every card (kind · title · detail) so cards stay equal and symmetric.
            return <button key={item.id} className="learning-resume-item" type="button" onClick={() => onResume(item)}>
              <span className="learning-resume-kind">{learningResumeKind(item)}</span>
              <strong className="learning-resume-title">{compact ? compact.book : item.source === 'tehillim' ? tehillimResumeTitle(item) : item.title}</strong>
              <small className="learning-resume-detail">{compact ? compact.chapterLabel : learningResumeSubtitle(item)}</small>
            </button>;
          })}
          {onOpenPrayer && <div className="smart-prayer-wrap">
            <button className="learning-resume-item smart-prayer-card" type="button" onClick={() => onOpenPrayer(prayerType)}>
              <span>תפילה חכמה</span><strong>{PRAYER_TYPE_LABELS[prayerType]}</strong><small>נפתח בסידור לפי השעה</small>
            </button>
            <button type="button" className="smart-prayer-compass" aria-label="כיוון תפילה" onClick={() => onNav('siddur-compass')}><span aria-hidden="true">⌖</span></button>
          </div>}
          <MeatDairyTimer />
        </div>
      </section>}
      {dailyItems?.length > 0 && <section className="daily-learning" aria-label="מה נשאר לי היום">
        <div className="daily-learning-heading"><p className="eyebrow">קביעות יומית</p><h2>מה נשאר לי היום</h2></div>
        <div className="daily-learning-list">
          {dailyItems.map(item => {
            const complete = Boolean(dailyProgress?.[item.id]);
            return <div className={`daily-learning-item${complete ? ' complete' : ''}`} key={item.id}>
              <button type="button" className="daily-learning-open" onClick={item.onOpen}>
                <span>{item.kind}</span><strong>{item.title}</strong><small>{complete ? 'הושלם' : item.subtitle}</small>
              </button>
              <button type="button" className="daily-learning-complete" aria-pressed={complete} onClick={() => onCompleteDaily(item.id, !complete)}>{complete ? '✓ הושלם' : 'סימון כהושלם'}</button>
            </div>;
          })}
        </div>
      </section>}
      <MemorialTribute />
      {/* "ממתק הלכתי": one halacha for this hour of the day (six a day), right under the dedication. */}
      {slotHalacha && <button type="button" className="halacha-treat" onClick={() => onNav(`halacha/q/${encodeURIComponent(slotHalacha.entry.id)}`)}>
        <span className="halacha-treat-title">ממתק הלכתי</span>
        <span className="halacha-treat-topic">{slotHalacha.entry.topic}</span>
        <strong className="halacha-treat-text">{slotHalacha.entry.shortAnswer}</strong>
        <span className="halacha-treat-more">להלכה המלאה ←</span>
      </button>}
      {/* "נר ה' נשמת אדם": the yahrzeit of a famous tzaddik today (the Jewish date turns at sunset), right under the treat. */}
      <NerHashem hebrewDate={context?.hebrewDate} />
      {/* "נר זיכרון": the user's own loved one, only while a yahrzeit is active (from its sunset). */}
      <NerZikaronCard hebrewDate={context?.hebrewDate} afterSunset={Boolean(context?.afterSunset)} />
      {preparation?.active && <button type="button" className="today-prep-card" onClick={() => onNav('preparation')}>
        <span className="eyebrow">הכנה ל{preparation.name}</span>
        <strong>{preparation.remaining > 0 ? `${preparation.remaining} משימות נשארו` : 'הכול מוכן'}</strong>
        {preparation.candles && <small>הדלקת נרות {timeLabel(preparation.candles, tz)}</small>}
      </button>}
      {travel?.active && <button type="button" className="today-prep-card" onClick={() => onNav('travel')}>
        <span className="eyebrow">מצב נסיעה</span>
        <strong>{travel.name || 'נסיעה פעילה'}</strong>
        {travel.tzid && <small>{timeZoneLabel(travel.tzid)}</small>}
      </button>}
      {/* "השעון היהודי": one slim line, only when an alarm is on. */}
      <TodayAlarmCard settings={settings} now={now} onOpen={() => onNav('jewish-alarm')} />
      {context?.prayerContext && <PrayerContextPanel context={context} onNav={onNav} />}      <div className="today-grid">
        <section className="today-primary">
          <LocationControl settings={settings} setSettings={setSettings} compact />
          <section className="next-zman" data-testid="next-zman" aria-label="הזמן הבא">
            <span className="eyebrow" style={{ margin: 0 }}>הזמן הבא</span>
            {upcoming ? <><strong>{upcoming.name}</strong><time>{timeLabel(upcoming.at, tz)}</time><span className="when">בעוד {minutes} דקות</span></> : <span className="when">{solar?.loading ? 'מחשב זמנים…' : 'אין זמנים נוספים היום'}</span>}
          </section>
          {nextMoments.length > 0 && <section className="today-timeline" aria-label="הזמנים הקרובים"><p className="eyebrow">בהמשך היום</p>{nextMoments.map(item => <div className="timeline-line" key={item.key + item.at}><span>{item.name}</span><time>{timeLabel(item.at, tz)}</time></div>)}</section>}
          <div className="today-links">
            <section className="card-line"><span className="eyebrow">תהילים</span><button className="link" onClick={() => onNav('tehillim', { daily: true })}>לתהילים של היום</button></section>
            <section className="card-line"><span className="eyebrow">המקום</span><button className="link" onClick={() => onNav('calendar')}>{locationName}</button></section>
          </div>
        </section>
        <aside className="today-context" aria-label="מה חשוב היום">
          <p className="eyebrow">מה חשוב היום</p>
          {parashaName && <button className="today-feature" onClick={() => onNav('parasha')}><span>פרשת השבוע</span><strong>{parashaName}</strong></button>}
          {context?.additions?.map(a => <button className="today-feature" key={a.text} onClick={() => onNav('siddur')}><span>תוספת בתפילה</span><strong>{a.text}</strong></button>)}
          {context?.fasts?.today && <FastCard fast={context.fasts.today} tz={tz} when="today" onOpen={() => onNav('calendar')} />}
          {!context?.fasts?.today && context?.fast && <button className="today-feature" onClick={() => onNav('calendar')}><span>היום</span><strong>{context.fast.hebrew || hebrewEventLabel(context.fast.title)}</strong></button>}
          {context?.fasts?.tomorrow && !context?.fasts?.today && <FastCard fast={context.fasts.tomorrow} tz={tz} when="tomorrow" onOpen={() => onNav('calendar')} />}
          {upcomingName && <button className="today-feature" onClick={() => onNav('calendar')}><span>בקרוב בלוח</span><strong>{upcomingName}</strong></button>}
          {/* A custom of the user's own tradition, only when one is documented for this very day. */}
          {traditionToday && <button className="today-feature" onClick={() => onNav(`personal-tools/tradition/r/${encodeURIComponent(traditionToday.id)}`)}><span>מנהג במסורת שלך · {traditionToday.community}</span><strong>{traditionToday.title}</strong></button>}
          {!parashaName && !context?.additions?.length && !context?.fast && !context?.fasts?.tomorrow && !upcomingName && !traditionToday && <p className="today-quiet">יום חול רגיל. אפשר להתחיל מתהילים או לעיין בלוח.</p>}
        </aside>
      </div>
    </div>
  );
}

export function todayDisplayPayload({ now, tz, hebrew, events, context }) {
  const weekday = new Intl.DateTimeFormat('he-IL', { weekday: 'long', timeZone: tz }).format(now);
  const gregorian = formatGregorianDate(now, tz);
  const highlights = (events || [])
    .filter(e => e.category === 'holiday' || ['chag', 'fast', 'rc', 'spec'].includes(e.t))
    .map(e => e.hebrew || e.n);
  const parashaName = context?.parasha?.hebrew || hebrewEventLabel(context?.parasha?.title || '') || undefined;
  const upcomingName = context?.upcomingHoliday?.hebrew || hebrewEventLabel(context?.upcomingHoliday?.title || '') || undefined;
  return {
    weekday,
    gregorian,
    highlights,
    parashaName,
    upcomingName,
    title: hebrew || 'התאריך העברי אינו זמין',
    subtitle: `${weekday} · ${gregorian}`,
    chips: highlights,
    visiblePrayerAdditions: context?.additions || [],
    visibleOmissions: context?.prayerContext?.omissions || [],
    parashaLabel: context?.parasha?.hebrew || hebrewEventLabel(context?.parasha?.title || '') || null,
    holidayLabel: highlights[0] || context?.specialDay?.hebrew || hebrewEventLabel(context?.specialDay?.title || '') || null,
  };
}

function PrayerContextPanel({ context, onNav }) {
  const items = [...(context.prayerContext.additions || []), ...(context.prayerContext.omissions || [])];
  if (!items.length && !context.isRoshChodesh && !context.specialDay) return null;
  return <section className="prayer-context-panel" aria-label="היום בתפילה">
    <div><p className="eyebrow">היום בתפילה</p><strong>{context.specialDay?.hebrew || context.specialDay?.n || (context.isRoshChodesh ? 'ראש חודש' : 'הקשר התפילה של היום')}</strong></div>
    <div className="prayer-context-items">{items.slice(0, 4).map(item => <button type="button" className="prayer-context-item" key={`${item.kind}:${item.text}`} onClick={() => onNav('siddur')}><span>{item.text}</span><small>מותאם להיום · תצוגה מקדימה</small></button>)}</div>
  </section>;
}
