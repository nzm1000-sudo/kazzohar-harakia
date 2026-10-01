// המזכיר היהודי — every reminder of the app in one place, as a grid of tiles grouped by kind: the day's prayers,
// learning and mitzvot, Shabbat and the seasons, and the Hebrew dates (yahrzeit, birthday, anniversary). Quiet
// notifications (not alarms), never on Shabbat or Yom Tov, all on this device. Routes:
//   #personal-tools/mazkir · …/k/<kind> (a reminder's settings) · …/d/<yahrzeit|birthday|anniversary> (the dates)
//   …/new/<type>[/<memorialId>] · …/e/<id> (the Hebrew-date editor, components/reminders/ReminderEventEditor.jsx)
import { useEffect, useMemo, useState } from 'react';
import { HDate } from '@hebcal/core';
import { BackLink } from '../components/LocalNavigation.jsx';
import { AlarmSwitch, Segmented } from '../components/jewishAlarm/AlarmParts.jsx';
import ReminderEventEditor from '../components/reminders/ReminderEventEditor.jsx';
import { alarmContext, civilKeyOf, dayText, timeText } from '../services/jewishAlarm/index.mjs';
import { loadMemorials, MEMORIAL_CHANGE_EVENT } from '../services/memorialStore.mjs';
import { memorialName } from '../services/memorialYahrzeit.mjs';
import { nusachOf } from '../services/nusach.mjs';
import { EVENT_TYPES, REMINDERS_CHANGE_EVENT, REMINDER_TAP_EVENT, SHMA_OPINIONS, SMART_KINDS, eventHebrewDate, hebrewDayLabel, loadReminders, setSmart, smartReminders, syncReminders, upcomingOccurrences } from '../services/reminders/index.mjs';
import { MAZKIR_KINDS, MAZKIR_LEARNING_TRACKS, mazkirSummary } from '../services/reminders/mazkir.mjs';
import { siddurHasText } from '../services/reminders/siddurTargets.mjs';
import { minutesText } from '../services/jewishAlarm/format.mjs';

const BASE = 'personal-tools/mazkir';
const go = route => { window.location.hash = route; };
const decode = value => { try { return decodeURIComponent(value || ''); } catch { return ''; } };

function useReminders() {
  const [state, setState] = useState(loadReminders);
  useEffect(() => { const update = () => setState(loadReminders()); window.addEventListener(REMINDERS_CHANGE_EVENT, update); return () => window.removeEventListener(REMINDERS_CHANGE_EVENT, update); }, []);
  return state;
}
function useMemorials() {
  const [memorials, setMemorials] = useState(loadMemorials);
  useEffect(() => { const update = () => setMemorials(loadMemorials()); window.addEventListener(MEMORIAL_CHANGE_EVENT, update); return () => window.removeEventListener(MEMORIAL_CHANGE_EVENT, update); }, []);
  return memorials;
}
function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  return now;
}

// The four reminders of the day (smart.mjs) in the hub's words.
const DAY_KINDS = Object.freeze({
  shma: { title: 'סוף זמן קריאת שמע', description: 'לפני סוף הזמן, לפי השיטה שתבחרו', rule: 'לפני סוף זמן קריאת שמע של שחרית, לפי מגן אברהם או הגר״א. לא בשבת ובחג. הקשה פותחת את שחרית.', route: 'prayer/shacharit' },
  mincha: { title: 'מנחה לפני השקיעה', description: 'כדי להספיק להתפלל מנחה', rule: 'לפני השקיעה, לפי המיקום. לא בשבת ובחג; בערב שבת — רק כשהתזכורת לפני הדלקת הנרות. הקשה פותחת את מנחה.', route: 'prayer/mincha' },
  candles: { title: 'הדלקת נרות', description: 'שבת וחג, לפני זמן ההדלקה', rule: 'לפני זמן הדלקת הנרות של שבת (וגם של חג, אם תבחרו), לפי דקות ההדלקה שבהגדרות. הקשה פותחת את ברכת הדלקת הנרות.', route: 'prayer/candles' },
  omer: { title: 'ספירת העומר', description: 'בלילות הספירה, בצאת הכוכבים', rule: 'בלילות הספירה, מצאת הכוכבים. לא בליל שבת וחג; במוצאי שבת וחג — בצאתם. הקשה פותחת את ספירת העומר.', route: 'prayer/omer' },
});
const kindMeta = id => MAZKIR_KINDS[id] || (DAY_KINDS[id] ? { id, ...DAY_KINDS[id] } : null);

// The groups of the hub: centred titles, tiles two by two (an odd last tile spans the row, centred).
const GROUPS = Object.freeze([
  { id: 'day', title: 'תפילות היום', kinds: ['shachar', 'shma', 'mincha', 'bedtime'] },
  { id: 'torah', title: 'לימוד, תיקון וצדקה', kinds: ['learning', 'shnayim', 'tikkun', 'tzedaka'] },
  { id: 'seasons', title: 'שבת, מועדים וחודשים', kinds: ['candles', 'omer', 'chanukah', 'levana', 'ilanot'] },
]);

// The settings in one short phrase (the tile's second line when it is on).
function summaryOf(kind, config) {
  if (!config) return '';
  if (kind === 'shma') return `${minutesText(config.minutesBefore)} לפני · ${SHMA_OPINIONS[config.opinion]?.short || ''}`;
  if (kind === 'mincha') return `${minutesText(config.minutesBefore)} לפני השקיעה`;
  if (kind === 'candles') return `${minutesText(config.minutesBefore)} לפני${config.yomTov !== false ? '' : ' · שבת בלבד'}`;
  if (kind === 'omer') return config.offsetMinutes ? `${minutesText(config.offsetMinutes)} אחרי צאת הכוכבים` : 'בצאת הכוכבים';
  return mazkirSummary(kind, config);
}

const HORIZON = { omer: 400, chanukah: 400, ilanot: 400, levana: 45, candles: 21, shnayim: 8 };
function nextOf(kind, config, ctx, now, count = 1) {
  if (!ctx.valid || !config) return [];
  return smartReminders({ [kind]: { ...config, enabled: true } }, ctx, { now, days: HORIZON[kind] || 7 }).slice(0, count);
}

const toggleKind = async (settings, kind, enabled) => { setSmart(kind, { enabled }); await syncReminders(settings, { ask: enabled }).catch(() => {}); };
const changeKind = async (settings, kind, patch) => { setSmart(kind, patch); await syncReminders(settings).catch(() => {}); };

export default function MazkirPage({ route = BASE, settings, backLabel = 'כלים אישיים', backHref = '#personal-tools' }) {
  const parts = String(route).split('/');
  const view = parts[2] || '';
  const state = useReminders();
  const memorials = useMemorials();
  const now = useMinute();
  if (view === 'new' || view === 'e') {
    const existing = view === 'e' ? state.events.find(entry => entry.id === decode(parts[3])) || null : null;
    const type = existing?.type || (EVENT_TYPES[parts[3]] ? parts[3] : 'birthday');
    const memorialId = existing ? existing.memorialId : (type === 'yahrzeit' ? decode(parts[4]) || null : null);
    return <ReminderEventEditor key={route} existing={existing} type={type} memorialId={memorialId} memorials={memorials} settings={settings} now={now} onDone={() => history.back()} go={go} />;
  }
  if (view === 'k' && kindMeta(parts[3])) return <KindSettings key={parts[3]} kind={parts[3]} state={state} settings={settings} now={now} />;
  if (view === 'd' && EVENT_TYPES[parts[3]]) return <DatesOfType type={parts[3]} state={state} memorials={memorials} now={now} />;
  return <MazkirHub state={state} memorials={memorials} settings={settings} now={now} backLabel={backLabel} backHref={backHref} />;
}

export function MazkirIcon({ size = 30 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M6.5 16.5V11.5a5.5 5.5 0 0 1 11 0v5l1.5 2h-14z" /><path d="M10 20.5a2 2 0 0 0 4 0" /><path d="M12 3v2.5" /></svg>;
}

function MazkirHub({ state, memorials, settings, now, backLabel, backHref }) {
  const ctx = useMemo(() => alarmContext(settings), [settings]);
  // Reconcile on opening the hub (never asks for permission here).
  useEffect(() => { syncReminders(settings).catch(() => {}); }, []);
  const today = new HDate(now);
  const byMemorial = new Map(memorials.map(record => [record.id, record]));
  const dateTiles = Object.values(EVENT_TYPES).map(type => {
    const entries = state.events.filter(entry => entry.type === type.id);
    const nexts = entries.filter(entry => entry.enabled !== false && (entry.eve?.enabled || entry.day?.enabled))
      .map(entry => upcomingOccurrences(entry, today, 1, entry.memorialId ? byMemorial.get(entry.memorialId) || null : null)[0]).filter(Boolean)
      .sort((a, b) => a.hd.abs() - b.hd.abs());
    return { type, entries, next: nexts[0] || null };
  });
  const active = Object.values(state.smart || {}).filter(item => item?.enabled).length + state.events.filter(entry => entry.eve?.enabled || entry.day?.enabled).length;
  return <section className="personal-tools mz-page" aria-labelledby="mz-title">
    <BackLink href={backHref} label={backLabel} />
    <header className="mz-head">
      <span className="mz-mark" aria-hidden="true"><MazkirIcon /></span>
      <h1 id="mz-title">המזכיר היהודי</h1>
      <p className="intro">תזכורות שקטות לפי זמני היום, לוח השנה והתאריך העברי.</p>
      <p className="mz-count">{active ? `${active} ${active === 1 ? 'תזכורת פעילה' : 'תזכורות פעילות'}` : 'אין עדיין תזכורת פעילה'}</p>
    </header>
    <p className="mz-rest"><strong>לעולם לא בשבת ובחג.</strong> תזכורת שחלה בהם אינה נשלחת; תזכורת לתאריך עברי שחל בהם מוקדמת לשעה לפני הדלקת הנרות.</p>
    <StatusLine state={state} settings={settings} />
    {GROUPS.map(group => <section className="mz-group" key={group.id} aria-labelledby={`mz-g-${group.id}`}>
      <h2 className="mz-group-title" id={`mz-g-${group.id}`}>{group.title}</h2>
      <div className="mz-grid">{group.kinds.map(kind => <KindTile key={kind} kind={kind} config={state.smart?.[kind]} ctx={ctx} now={now} />)}</div>
    </section>)}
    <section className="mz-group" aria-labelledby="mz-g-dates">
      <h2 className="mz-group-title" id="mz-g-dates">תאריכים עבריים</h2>
      <div className="mz-grid">
        {dateTiles.map(({ type, entries, next }) => <button type="button" key={type.id} className={`mz-tile${entries.length ? ' is-on' : ''}`} onClick={() => go(`${BASE}/d/${type.id}`)}
          aria-label={`${TYPE_TITLES[type.id]}: ${entries.length ? `${entries.length} ${entries.length === 1 ? 'תזכורת' : 'תזכורות'}${next ? `, הבא ${hebrewDayLabel(next.hd)}` : ''}` : 'אין תזכורות'}`}>
          <strong>{TYPE_TITLES[type.id]}</strong>
          <small>{TYPE_LINES[type.id]}</small>
          <span className="mz-state">{entries.length ? <><i aria-hidden="true" />{next ? `הבא: ${hebrewDayLabel(next.hd)}` : entries.length === 1 ? 'תזכורת אחת' : `${entries.length} תזכורות`}</> : 'לא הוגדרו'}</span>
        </button>)}
        <button type="button" className="mz-tile" onClick={() => go('personal-tools/memorial')}>
          <strong>נר זיכרון</strong>
          <small>האזכרות של יקירינו ונר על מסך הבית</small>
          <span className="mz-state">{memorials.length ? `${memorials.length} ${memorials.length === 1 ? 'אזכרה' : 'אזכרות'}` : 'לפתיחה'}</span>
        </button>
      </div>
    </section>
    {ctx.valid && <p className="ja-method">לפי {ctx.location.name || 'המיקום שנבחר'} ולפי שיטת הזמנים של האפליקציה · <button type="button" className="ja-link" onClick={() => go('times')}>זמני היום</button></p>}
    {state.horizonEnd && state.permission === 'granted' && <p className="ja-method">התזכורות מתוזמנות עד {dayText(civilKeyOf(new Date(state.horizonEnd).getTime(), ctx.tz || 'UTC'), civilKeyOf(now.getTime(), ctx.tz || 'UTC'))} · כל פתיחה של האפליקציה ממשיכה הלאה.</p>}
    <p className="ja-method">הפרטים נשמרים במכשיר זה בלבד ואינם נשלחים לשום מקום.</p>
  </section>;
}
const TYPE_TITLES = { yahrzeit: 'אזכרות', birthday: 'ימי הולדת עבריים', anniversary: 'ימי נישואין עבריים' };
const TYPE_LINES = { yahrzeit: 'בערב שלפני האזכרה או ביום עצמו', birthday: 'בכל שנה ביום העברי', anniversary: 'בכל שנה ביום העברי' };

function KindTile({ kind, config, ctx, now }) {
  const meta = kindMeta(kind);
  const on = Boolean(config?.enabled);
  const minute = Math.floor(now.getTime() / 60000);
  const next = useMemo(() => (on ? nextOf(kind, config, ctx, now)[0] || null : null), [kind, on, JSON.stringify(config), ctx, minute]);
  const todayKey = ctx.valid ? civilKeyOf(now.getTime(), ctx.tz) : '';
  const nextText = next ? `${dayText(civilKeyOf(next.at.getTime(), ctx.tz), todayKey)} ${timeText(next.at, ctx.tz)}` : '';
  // On the tile the minutes are written short, so the line never breaks.
  const summary = summaryOf(kind, config).replace(/(\d+) דקות/, '$1 דק׳');
  return <button type="button" className={`mz-tile${on ? ' is-on' : ''}`} onClick={() => go(`${BASE}/k/${kind}`)}
    aria-label={`${meta.title}: ${on ? `פעילה, ${summary}${nextText ? `, הבאה ${nextText}` : ''}` : 'כבויה'}. להגדרות`}>
    <strong>{meta.title}</strong>
    <small>{meta.description}</small>
    <span className="mz-state">{on ? <><i aria-hidden="true" />{summary}</> : 'כבויה'}</span>
  </button>;
}

// One reminder's settings: the switch, its options, the next times, the rule with its sources, and its text.
function KindSettings({ kind, state, settings, now }) {
  const meta = kindMeta(kind);
  const config = state.smart?.[kind];
  const ctx = useMemo(() => alarmContext(settings), [settings]);
  const on = Boolean(config?.enabled);
  const minute = Math.floor(now.getTime() / 60000);
  const upcoming = useMemo(() => nextOf(kind, config, ctx, now, 3), [kind, JSON.stringify(config), ctx, minute]);
  const todayKey = ctx.valid ? civilKeyOf(now.getTime(), ctx.tz) : '';
  const set = patch => changeKind(settings, kind, patch);
  const nusach = nusachOf(settings);
  const target = meta.siddur || null;
  const hasText = target ? siddurHasText(target, nusach) : true;
  const openText = () => window.dispatchEvent(new CustomEvent(REMINDER_TAP_EVENT, { detail: meta.route }));
  return <section className="personal-tools mz-page mz-settings" aria-labelledby="mz-k-title">
    <BackLink label="המזכיר היהודי" onClick={() => (Number(history.state?.kzDepth) > 0 ? history.back() : go(BASE))} />
    <header className="mz-head">
      <p className="eyebrow">המזכיר היהודי</p>
      <h1 id="mz-k-title">{meta.title}</h1>
      <p className="intro">{meta.description}</p>
    </header>
    <div className={`mz-card mz-switch-row${on ? ' is-on' : ''}`}>
      <span><strong>{on ? 'התזכורת פעילה' : 'התזכורת כבויה'}</strong><small>{on ? summaryOf(kind, config) : 'אפשר לבחור את ההגדרות גם לפני ההפעלה'}</small></span>
      <AlarmSwitch checked={on} onChange={enabled => toggleKind(settings, kind, enabled)} label={`${meta.title} — ${on ? 'פעילה' : 'כבויה'}`} />
    </div>
    <div className="mz-card mz-options"><KindOptions kind={kind} config={config} set={set} /></div>
    {on && <section className="mz-card mz-next" aria-labelledby="mz-next-title">
      <h2 id="mz-next-title">התזכורות הבאות</h2>
      {upcoming.length ? <ul>{upcoming.map(item => <li key={item.key}><strong>{dayText(civilKeyOf(item.at.getTime(), ctx.tz), todayKey)} · <time dir="ltr">{timeText(item.at, ctx.tz)}</time></strong><span>{item.body}</span></li>)}</ul>
        : <p>{ctx.valid ? 'אין תזכורת בימים הקרובים.' : 'בחרו מיקום כדי לחשב את הזמנים.'}</p>}
    </section>}
    <section className="mz-card mz-rule" aria-labelledby="mz-rule-title"><h2 id="mz-rule-title">ההלכה והזמן</h2><p>{meta.rule}</p></section>
    {target && (hasText
      ? <button type="button" className="ja-button mz-open" onClick={openText}>פתיחת הטקסט בסידור</button>
      : <p className="mz-missing">הנוסח שנבחר בסידור אינו כולל טקסט זה באפליקציה. הקשה על התזכורת תפתח את הסידור.</p>)}
    {kind === 'shnayim' && <button type="button" className="ja-button mz-open" onClick={() => go('shnayim-mikra')}>שניים מקרא ואחד תרגום</button>}
    {kind === 'learning' && <button type="button" className="ja-button mz-open" onClick={() => go('learning')}>הלימוד היומי</button>}
    <p className="ja-method">הפרטים נשמרים במכשיר זה בלבד ואינם נשלחים לשום מקום.</p>
  </section>;
}

const minuteOptions = (values, suffix) => values.map(m => (m === 0 ? [0, suffix.zero[0], suffix.zero[1]] : m === 60 ? [60, 'שעה', suffix.unit] : [m, String(m), `דקות ${suffix.unit}`]));
function TimeField({ label, value, onChange }) {
  return <label className="ja-time-field mz-time"><span className="mz-label">{label}</span>
    <input type="time" dir="ltr" value={value} onChange={event => { if (event.currentTarget.value) onChange(event.currentTarget.value); }} />
  </label>;
}

function KindOptions({ kind, config = {}, set }) {
  switch (kind) {
    case 'shma': return <>
      <Segmented label="כמה זמן לפני" value={config.minutesBefore} onChange={minutesBefore => set({ minutesBefore })} options={SMART_KINDS.shma.options.map(m => (m === 60 ? [60, 'שעה', 'לפני'] : [m, String(m), 'דקות לפני']))} className="rm-seg" />
      <Segmented label="לפי שיטת" value={config.opinion} onChange={opinion => set({ opinion })} options={Object.values(SHMA_OPINIONS).map(item => [item.id, item.label, item.id === 'mga' ? 'המוקדם' : 'המאוחר'])} className="rm-seg" />
    </>;
    case 'mincha': return <Segmented label="כמה זמן לפני השקיעה" value={config.minutesBefore} onChange={minutesBefore => set({ minutesBefore })} options={SMART_KINDS.mincha.options.map(m => (m === 60 ? [60, 'שעה', 'לפני'] : [m, String(m), 'דקות לפני']))} className="rm-seg" />;
    case 'candles': return <>
      <Segmented label="כמה זמן לפני" value={config.minutesBefore} onChange={minutesBefore => set({ minutesBefore })} options={SMART_KINDS.candles.options.map(m => (m === 60 ? [60, 'שעה', 'לפני'] : m === 120 ? [120, 'שעתיים', 'לפני'] : [m, String(m), 'דקות לפני']))} className="rm-seg" />
      <div className="ja-row rm-sub-row"><span><strong>גם בערבי חג</strong><small>נרות יום טוב, כשההדלקה לפני החג</small></span>
        <AlarmSwitch checked={config.yomTov !== false} onChange={yomTov => set({ yomTov })} label={`הדלקת נרות גם בערבי חג — ${config.yomTov !== false ? 'פעיל' : 'כבוי'}`} /></div>
    </>;
    case 'omer': return <Segmented label="מתי" value={config.offsetMinutes} onChange={offsetMinutes => set({ offsetMinutes })} options={SMART_KINDS.omer.options.map(m => (m === 0 ? [0, 'בצאת', 'הכוכבים'] : m === 60 ? [60, 'שעה', 'אחרי'] : [m, String(m), 'דקות אחרי']))} className="rm-seg" />;
    case 'chanukah': return <><Segmented label="כמה זמן לפני ההדלקה" value={config.minutesBefore} onChange={minutesBefore => set({ minutesBefore })} options={minuteOptions(MAZKIR_KINDS.chanukah.options, { zero: ['בזמן', 'ההדלקה'], unit: 'לפני' })} className="rm-seg" />
      <p className="mz-hint">בימי החול. בערב שבת ובמוצאי שבת — לפי הכלל שלמטה.</p></>;
    case 'tikkun': return <Segmented label="מתי" value={config.minutesBefore} onChange={minutesBefore => set({ minutesBefore })} options={minuteOptions(MAZKIR_KINDS.tikkun.options, { zero: ['בחצות', 'הלילה'], unit: 'לפני' })} className="rm-seg" />;
    case 'levana': return <Segmented label="מתי בלילה" value={config.offsetMinutes} onChange={offsetMinutes => set({ offsetMinutes })} options={minuteOptions(MAZKIR_KINDS.levana.options, { zero: ['בצאת', 'הכוכבים'], unit: 'אחרי' })} className="rm-seg" />;
    case 'shachar': return <>
      <Segmented label="מתי" value={config.mode} onChange={mode => set({ mode })} options={[['sunrise', 'לפי הנץ', 'משתנה'], ['time', 'שעה קבועה', 'בכל יום']]} className="rm-seg" />
      {config.mode === 'time' ? <TimeField label="השעה" value={config.time} onChange={time => set({ time })} />
        : <Segmented label="אחרי הנץ" value={config.offsetMinutes} onChange={offsetMinutes => set({ offsetMinutes })} options={minuteOptions(MAZKIR_KINDS.shachar.options, { zero: ['בנץ', 'החמה'], unit: 'אחרי' })} className="rm-seg" />}
    </>;
    case 'learning': return <>
      <TimeField label="השעה" value={config.time} onChange={time => set({ time })} />
      <fieldset className="mz-tracks"><legend className="mz-label">המסלולים</legend>
        <div>{MAZKIR_LEARNING_TRACKS.map(([id, label]) => { const chosen = (config.tracks || []).includes(id); return <button type="button" key={id} aria-pressed={chosen} className={`mz-chip${chosen ? ' is-on' : ''}`}
          onClick={() => { const next = chosen ? config.tracks.filter(track => track !== id) : [...(config.tracks || []), id]; if (next.length) set({ tracks: next }); }}>{label}</button>; })}</div>
      </fieldset>
    </>;
    default: return <TimeField label="השעה" value={config.time} onChange={time => set({ time })} />;
  }
}

// One kind of Hebrew-date reminder: its saved dates, adding one, and (for a yahrzeit) the memorials of נר זיכרון.
function DatesOfType({ type, state, memorials, now }) {
  const today = new HDate(now);
  const byMemorial = new Map(memorials.map(record => [record.id, record]));
  const rows = state.events.filter(entry => entry.type === type).map(entry => {
    const memorial = entry.memorialId ? byMemorial.get(entry.memorialId) || null : null;
    const next = upcomingOccurrences(entry, today, 1, memorial)[0] || null;
    return { entry, memorial, next, inDays: next ? next.hd.abs() - today.abs() : null };
  }).sort((a, b) => (a.next ? a.inDays : 1e9) - (b.next ? b.inDays : 1e9));
  const unlinked = type === 'yahrzeit' ? memorials.filter(record => record.dateConfidence === 'exact' && !state.events.some(entry => entry.memorialId === record.id)) : [];
  return <section className="personal-tools mz-page" aria-labelledby="mz-d-title">
    <BackLink label="המזכיר היהודי" onClick={() => (Number(history.state?.kzDepth) > 0 ? history.back() : go(BASE))} />
    <header className="mz-head"><p className="eyebrow">המזכיר היהודי</p><h1 id="mz-d-title">{TYPE_TITLES[type]}</h1><p className="intro">בכל שנה ביום העברי הנכון — בערב שלפני, ביום עצמו או בשניהם.</p></header>
    {rows.length > 0 ? <div className="rm-events">{rows.map(({ entry, memorial, next, inDays }) => <EventRow key={entry.id} entry={entry} memorial={memorial} next={next} inDays={inDays} onOpen={() => go(`${BASE}/e/${encodeURIComponent(entry.id)}`)} />)}</div>
      : <p className="rm-empty">עוד לא נשמרה תזכורת כזו.</p>}
    <button type="button" className="ja-button mz-open" onClick={() => go(`${BASE}/new/${type}`)}><span aria-hidden="true">+</span> {EVENT_TYPES[type].newTitle}</button>
    {unlinked.length > 0 && <div className="rm-from-memorial">
      <p className="ja-label">מנר זיכרון</p>
      {unlinked.slice(0, 8).map(record => <button type="button" key={record.id} className="rm-memorial-row" onClick={() => go(`${BASE}/new/yahrzeit/${encodeURIComponent(record.id)}`)} aria-label={`הוספת תזכורת לאזכרה של ${memorialName(record)}`}>
        <span>{memorialName(record)}</span><small>הוספת תזכורת</small>
      </button>)}
    </div>}
    <p className="ja-method">לעולם לא בשבת ובחג: תזכורת שחלה בהם מוקדמת לשעה לפני הדלקת הנרות.</p>
  </section>;
}

const civilShort = date => new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(date);
const inDaysText = days => (days === 0 ? 'היום' : days === 1 ? 'מחר' : days === 2 ? 'מחרתיים' : `בעוד ${days} ימים`);
function EventRow({ entry, memorial, next, inDays, onOpen }) {
  const type = EVENT_TYPES[entry.type];
  const name = memorial ? memorialName(memorial) : entry.name;
  const date = eventHebrewDate(entry, memorial);
  const origin = date ? hebrewDayLabel(new HDate(date.day, date.month, date.year)) : '';
  const off = !entry.eve?.enabled && !entry.day?.enabled;
  const spoken = `${type.title}: ${name}${origin ? `, ${origin}` : ''}. ${next ? `הבא ${hebrewDayLabel(next.hd)}, ${civilShort(next.hd.greg())}, ${inDaysText(inDays)}` : ''}. לעריכה`;
  return <article className={`rm-event${off ? ' is-off' : ''}`}>
    <button type="button" className="ja-card-hit" aria-label={spoken} onClick={onOpen} />
    <span className="rm-event-text" aria-hidden="true"><strong>{name}</strong><small>{origin || type.title}</small></span>
    <span className="rm-event-next" aria-hidden="true">{next ? <><strong>{hebrewDayLabel(next.hd)}</strong><small><span dir="ltr">{civilShort(next.hd.greg())}</span> · {inDaysText(inDays)}</small></> : <small>אין מועד קרוב</small>}</span>
  </article>;
}

function StatusLine({ state, settings }) {
  const [busy, setBusy] = useState(false);
  const wants = Object.values(state.smart || {}).some(item => item?.enabled) || state.events.length > 0;
  if (!wants) return null;
  if (state.platform === 'web') return <p className="ja-status">בדפדפן לא ניתן לשלוח תזכורת כשהדף סגור. באפליקציה באייפון ובאנדרואיד התזכורות מגיעות גם כשהיא סגורה.</p>;
  if (state.permission === 'denied') return <p className="ja-status is-warn" role="alert">כדי לקבל תזכורות יש לאשר התראות בהגדרות המכשיר.</p>;
  if (state.permission === 'prompt' || state.permission === 'prompt-with-rationale') return <p className="ja-status is-warn" role="alert">התזכורות ממתינות לאישור התראות. <button type="button" className="ja-link" disabled={busy} onClick={async () => { setBusy(true); await syncReminders(settings, { ask: true }).catch(() => {}); setBusy(false); }}>אישור התראות</button></p>;
  return null;
}
