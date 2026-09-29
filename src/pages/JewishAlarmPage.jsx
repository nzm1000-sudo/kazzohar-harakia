// השעון היהודי — an alarm clock whose time can follow the Jewish day: "wake me 25 minutes before sunrise" is set once
// and rings at the right time every day, in every season, wherever the app's location is. Routes:
//   #jewish-alarm · #jewish-alarm/new · #jewish-alarm/new/<preset> · #jewish-alarm/e/<id>
import { useEffect, useMemo, useState } from 'react';
import { BackLink } from '../components/LocalNavigation.jsx';
import { JewishAlarmIcon } from '../components/ToolIcons.jsx';
import AlarmCard from '../components/jewishAlarm/AlarmCard.jsx';
import AlarmEditor from '../components/jewishAlarm/AlarmEditor.jsx';
import { AlarmSheet } from '../components/jewishAlarm/AlarmParts.jsx';
import { ALARM_CHANGE_EVENT, alarmContext, blankRule, civilKeyOf, clearNotice, dayText, findDuplicate, getNextAlarm, loadAlarmState, nextOccurrence, normalizeRule, offsetPhrase, platformAdapter, setRuleEnabled, syncJewishAlarms, timeText, titleOf, upsertRule, ANCHORS } from '../services/jewishAlarm/index.mjs';

const PRESETS = {
  sunrise: { title: 'השכמה לנץ', label: 'השכמה לנץ', note: 'לפני הנץ, בכל בוקר', rule: { mode: 'jewish', jewishAnchorId: 'sunrise', direction: 'before', title: 'השכמה לנץ' } },
  shabbat: { title: 'הכנות לשבת', label: 'הכנות לשבת', note: 'לפני הדלקת הנרות' },
  omer: { title: 'ספירת העומר', label: 'ספירת העומר', note: 'בלילות הספירה', rule: { mode: 'jewish', jewishAnchorId: 'omer', direction: 'after', title: 'ספירת העומר' } },
  chanukah: { title: 'נרות חנוכה', label: 'נרות חנוכה', note: 'בלילות חנוכה', rule: { mode: 'jewish', jewishAnchorId: 'chanukah', title: 'הדלקת נרות חנוכה' } },
};
// Friday preparation: several independent alarms on the same anchor (the same rule model — no separate engine).
const SHABBAT_STEPS = [[-180, '3 שעות לפני הדלקת הנרות'], [-90, '90 דקות לפני'], [-45, '45 דקות לפני'], [-20, '20 דקות לפני']];

function useAlarmState() {
  const [state, setState] = useState(loadAlarmState);
  useEffect(() => { const update = () => setState(loadAlarmState()); window.addEventListener(ALARM_CHANGE_EVENT, update); return () => window.removeEventListener(ALARM_CHANGE_EVENT, update); }, []);
  return state;
}

export default function JewishAlarmPage({ route = 'jewish-alarm', settings, now = new Date(), go }) {
  const parts = route.split('/');
  const state = useAlarmState();
  if (parts[1] === 'new' || parts[1] === 'e') {
    const existing = parts[1] === 'e' ? state.rules.find(rule => rule.id === decodeURIComponent(parts[2] || '')) : null;
    const preset = parts[1] === 'new' ? PRESETS[parts[2]]?.rule : null;
    const initial = existing || blankRule({ ...(preset || {}), offsetMinutes: null });
    const withDirection = preset?.direction && !existing ? { ...initial, direction: preset.direction } : initial;
    return <AlarmEditor key={route} initial={withDirection} isNew={!existing} settings={settings} now={now} onDone={() => history.back()} />;
  }
  return <AlarmHome state={state} settings={settings} now={now} go={go} />;
}

function AlarmHome({ state, settings, now, go }) {
  const ctx = useMemo(() => alarmContext(settings), [settings]);
  const [engine, setEngine] = useState(state.engine);
  const [preparing, setPreparing] = useState(false);
  const minute = Math.floor(new Date(now).getTime() / 60000);
  // Reconcile on opening the screen (never asks for permission here) and learn which engine rings.
  useEffect(() => { platformAdapter().then(adapter => setEngine(adapter.engine)).catch(() => {}); syncJewishAlarms(settings).catch(() => {}); }, []);
  // The location-change notice is shown once.
  const [notice] = useState(state.notice);
  useEffect(() => { if (state.notice) clearNotice(); }, []);
  const todayKey = ctx.valid ? civilKeyOf(new Date(now).getTime(), ctx.tz) : '';
  const rules = state.rules;
  const occurrences = useMemo(() => new Map(rules.map(rule => [rule.id, rule.enabled ? nextOccurrence(rule, ctx, new Date(now)) : null])), [rules, ctx, minute]);
  const next = useMemo(() => getNextAlarm(rules, ctx, new Date(now)), [rules, ctx, minute]);
  const toggle = async (rule, enabled) => {
    setRuleEnabled(rule.id, enabled);
    const adapter = await platformAdapter();
    const permission = adapter.engine === 'none' ? 'unsupported' : await adapter.permission().catch(() => 'prompt');
    await syncJewishAlarms(settings, { ask: enabled && permission === 'prompt' }).catch(() => {});
  };
  const open = rule => go(`jewish-alarm/e/${encodeURIComponent(rule.id)}`);
  const permissionLine = <PermissionLine state={state} engine={engine} hasEnabled={rules.some(rule => rule.enabled)} settings={settings} />;
  return <section className="personal-tools jewish-alarm" aria-labelledby="ja-title">
    <BackLink label="חזרה" onClick={() => history.back()} />
    <header className="ja-head">
      <span className="ja-mark" aria-hidden="true"><JewishAlarmIcon size={34} strokeWidth={1.3} /></span>
      <h1 id="ja-title">השעון היהודי</h1>
      <p className="intro">שעון מעורר שמתעדכן אוטומטית לפי זמני היום והלוח היהודי.</p>
    </header>
    {notice && <p className="ja-notice" role="status">{notice}</p>}
    {!ctx.valid && <p className="notice error" role="alert">בחרו עיר או מיקום כדי לחשב את הזמן.</p>}
    {rules.length === 0
      ? <section className="ja-empty">
        <p className="ja-empty-title">השעון היהודי</p>
        <p>שעון שמתאים את עצמו לזמני היום.</p>
        <button type="button" className="ja-button is-primary ja-add" onClick={() => go('jewish-alarm/new')}><span aria-hidden="true">+</span> שעון חדש</button>
        <p className="ja-note">לדוגמה: 25 דקות לפני הנץ.</p>
      </section>
      : <>
        <NextAlarm next={next} tz={ctx.tz} todayKey={todayKey} />
        {permissionLine}
        <div className="ja-list">{rules.map(rule => <AlarmCard key={rule.id} rule={rule} occurrence={occurrences.get(rule.id)} tz={ctx.tz} todayKey={todayKey} onOpen={() => open(rule)} onToggle={enabled => toggle(rule, enabled)} />)}</div>
        <button type="button" className="ja-button is-primary ja-add" onClick={() => go('jewish-alarm/new')}><span aria-hidden="true">+</span> שעון חדש</button>
      </>}
    {rules.length === 0 && permissionLine}
    <section className="ja-presets" aria-labelledby="ja-presets-title">
      <p className="ja-label" id="ja-presets-title">הצעות שימושיות</p>
      <div className="ja-preset-grid">
        {Object.entries(PRESETS).map(([key, preset]) => <button type="button" key={key} className="ja-preset" onClick={() => (key === 'shabbat' ? setPreparing(true) : go(`jewish-alarm/new/${key}`))}>
          <strong>{preset.label}</strong><small>{preset.note}</small>
        </button>)}
      </div>
    </section>
    {ctx.valid && <p className="ja-method">לפי {ctx.location.name || 'המיקום שנבחר'} · לפי שיטת הזמנים שבחרת · <button type="button" className="ja-link" onClick={() => go('times')}>זמני היום ושיטת החישוב</button></p>}
    {state.horizonEnd && engine && engine !== 'none' && state.permission === 'granted' && <p className="ja-method">השעונים מתוזמנים עד {dayText(civilKeyOf(new Date(state.horizonEnd).getTime(), ctx.tz || 'UTC'), todayKey)} · כל פתיחה של האפליקציה ממשיכה הלאה.</p>}
    {preparing && <ShabbatPreparation settings={settings} onClose={() => setPreparing(false)} />}
  </section>;
}

function NextAlarm({ next, tz, todayKey }) {
  if (!next) return <section className="ja-next is-quiet" aria-label="השעון הבא"><p className="ja-label">השעון הבא</p><p className="ja-next-line">אין שעון פעיל בימים הקרובים.</p></section>;
  const { rule, occurrence } = next;
  const time = timeText(occurrence.at, tz);
  const day = dayText(occurrence.date, todayKey);
  const anchor = rule.mode === 'jewish' ? ANCHORS[rule.jewishAnchorId] : null;
  const ruleLine = rule.mode === 'jewish' ? offsetPhrase(rule.offsetMinutes, rule.jewishAnchorId) : 'שעה קבועה';
  return <section className="ja-next" aria-label={`השעון הבא: ${titleOf(rule)}, ${day} ב־${time}, ${ruleLine}${anchor ? `, ${anchor.short} ${timeText(occurrence.anchorTime, tz)}` : ''}`}>
    <p className="ja-label" aria-hidden="true">השעון הבא · {titleOf(rule)}</p>
    <time className="ja-next-time" dir="ltr" aria-hidden="true">{time}</time>
    <p className="ja-next-line" aria-hidden="true">{day} · {ruleLine}</p>
    {anchor && <p className="ja-next-anchor" aria-hidden="true">{anchor.short}: <time dir="ltr">{timeText(occurrence.anchorTime, tz)}</time></p>}
  </section>;
}

// The honest state of the platform: what rings, what is missing, and the way to fix it.
function PermissionLine({ state, engine, hasEnabled, settings }) {
  const [busy, setBusy] = useState(false);
  const openSettings = async target => { const adapter = await platformAdapter(); await adapter.openSettings?.(target).catch?.(() => {}); };
  const ask = async () => { setBusy(true); await syncJewishAlarms(settings, { ask: true }).catch(() => {}); setBusy(false); };
  if (engine === 'none') return <p className="ja-status">בדפדפן השעון אינו יכול לצלצל כשהדף סגור. באפליקציה באייפון ובאנדרואיד השעון מצלצל גם כשהיא סגורה.</p>;
  if (!hasEnabled || !engine) return null;
  if (state.permission === 'denied') return <p className="ja-status is-warn" role="alert">כדי שהשעון יצלצל יש לאשר שעונים בהגדרות. <button type="button" className="ja-link" onClick={() => openSettings('app')}>פתיחת ההגדרות</button></p>;
  if (state.permission === 'exact-denied') return <p className="ja-status is-warn" role="alert">כדי שהשעון יצלצל בזמן המדויק, Android דורש הרשאה לשעון מדויק. <button type="button" className="ja-link" onClick={() => openSettings('exact')}>פתיחת ההגדרות</button></p>;
  if (state.permission === 'prompt') return <p className="ja-status is-warn" role="alert">לא ניתן להפעיל את השעון בלי הרשאת שעונים. <button type="button" className="ja-link" disabled={busy} onClick={ask}>אישור שעונים</button></p>;
  if (state.error === 'limit') return <p className="ja-status">השעונים הרחוקים יתוזמנו בפתיחה הבאה של האפליקציה.</p>;
  if (engine === 'notifications') return <p className="ja-status">בגרסת iOS זו השעון מופיע כהתראה עם צליל, ואינו גובר על מצב שקט.</p>;
  return null;
}

function ShabbatPreparation({ settings, onClose }) {
  const [chosen, setChosen] = useState([-90, -20]);
  const [done, setDone] = useState('');
  const create = async () => {
    const existing = loadAlarmState().rules;
    let added = 0;
    for (const offset of chosen) {
      const rule = normalizeRule({ ...blankRule(), mode: 'jewish', jewishAnchorId: 'candles-shabbat', offsetMinutes: offset, title: 'הכנות לשבת' });
      if (!rule || findDuplicate(existing, rule)) continue;
      upsertRule(rule);
      existing.push(rule);
      added += 1;
    }
    const adapter = await platformAdapter();
    const permission = adapter.engine === 'none' ? 'unsupported' : await adapter.permission().catch(() => 'prompt');
    await syncJewishAlarms(settings, { ask: added > 0 && permission === 'prompt' }).catch(() => {});
    if (added) onClose(); else setDone('השעונים האלה כבר קיימים ברשימה.');
  };
  return <AlarmSheet title="הכנות לשבת" onClose={onClose}>
    <p>כמה שעונים לפני הדלקת הנרות, בכל ערב שבת. כל אחד שעון נפרד שאפשר לערוך או לכבות.</p>
    <div className="ja-check-list" role="group" aria-label="מתי">
      {SHABBAT_STEPS.map(([offset, label]) => { const on = chosen.includes(offset); return <button type="button" key={offset} aria-pressed={on} className={`ja-check${on ? ' is-on' : ''}`} onClick={() => setChosen(list => (on ? list.filter(item => item !== offset) : [...list, offset]))}>
        <span className="ja-check-box" aria-hidden="true">{on ? '✓' : ''}</span><span>{label}</span>
      </button>; })}
    </div>
    {done && <p className="ja-note" role="status">{done}</p>}
    <div className="ja-sheet-actions">
      <button type="button" className="ja-button" onClick={onClose}>ביטול</button>
      <button type="button" className="ja-button is-primary" disabled={!chosen.length} onClick={create}>יצירת השעונים</button>
    </div>
  </AlarmSheet>;
}
