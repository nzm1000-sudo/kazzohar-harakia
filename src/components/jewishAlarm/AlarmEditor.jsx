// השעון היהודי — the editor: one calm page, step by step. The kind of alarm first; then the time (the platform's own
// time picker for a fixed alarm, or a Jewish time and before / at / after it); a live preview on every change; then the
// days, the Shabbat choice, the name, the sound and snooze. Saving asks for the OS permission only then, in context.
import { useMemo, useRef, useState } from 'react';
import { BackLink } from '../LocalNavigation.jsx';
import { JewishAlarmIcon } from '../ToolIcons.jsx';
import JewishTimePicker from './JewishTimePicker.jsx';
import OffsetPicker from './OffsetPicker.jsx';
import { AlarmSheet, AlarmSwitch, Segmented } from './AlarmParts.jsx';
import { ANCHORS, alarmContext, civilKeyOf, wallTimeText, dayText, defaultTitle, deleteRule, draftProblem, findDuplicate, isEventRule, livePreview, loadAlarmState, minutesText, normalizeRule, platformAdapter, previewDays, syncJewishAlarms, timeText, upsertRule, WEEKDAY_LETTERS, WEEKDAY_NAMES, WEEKDAY_SHORT, recurrenceText } from '../../services/jewishAlarm/index.mjs';
import { platformName } from '../../services/jewishAlarm/platform.mjs';

const directionOf = rule => (rule.offsetMinutes === null || rule.offsetMinutes === undefined ? (rule.direction || null) : rule.offsetMinutes < 0 ? 'before' : rule.offsetMinutes > 0 ? 'after' : 'at');

export default function AlarmEditor({ initial, isNew, settings, now, onDone }) {
  // A new alarm's fixed time starts at the time it is now (to the minute, in the app's zone) — not at a preset hour.
  const nowTime = () => wallTimeText(Date.now(), alarmContext(settings).tz);
  const timeTouched = useRef(false);
  const [draft, setDraft] = useState(() => (isNew ? { ...initial, fixedTime: nowTime() } : { ...initial }));
  const [direction, setDirection] = useState(() => directionOf(initial));
  const [choosingAnchor, setChoosingAnchor] = useState(() => !initial.jewishAnchorId);
  const [message, setMessage] = useState('');
  const [asking, setAsking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [testNote, setTestNote] = useState('');
  const [busy, setBusy] = useState(false);
  const ctx = useMemo(() => alarmContext(settings), [settings]);
  const todayKey = ctx.valid ? civilKeyOf(new Date(now).getTime(), ctx.tz) : '';
  const platform = platformName();
  const set = patch => { setMessage(''); setDraft(previous => ({ ...previous, ...patch })); };
  const minutes = draft.offsetMinutes === null || draft.offsetMinutes === undefined ? null : Math.abs(draft.offsetMinutes);
  const anchor = draft.jewishAnchorId ? ANCHORS[draft.jewishAnchorId] : null;
  const eventRule = isEventRule(draft);
  const rule = useMemo(() => normalizeRule({ ...draft, title: draft.title?.trim() || '' }, { allowIncomplete: true }), [draft]);
  const preview = useMemo(() => (rule?.mode && (rule.mode === 'fixed' || (rule.jewishAnchorId && rule.offsetMinutes !== null)) ? livePreview(rule, ctx, now) : null), [rule, ctx, now]);
  const days = useMemo(() => (preview?.occurrence ? previewDays(rule, ctx, now, 7) : []), [preview, rule, ctx, now]);

  const setOffset = (nextDirection, value) => {
    setDirection(nextDirection);
    const signed = nextDirection === 'at' ? 0 : value === null || value === undefined ? null : nextDirection === 'before' ? -Math.abs(value) : Math.abs(value);
    set({ offsetMinutes: signed });
  };
  const chooseAnchor = id => {
    set({ jewishAnchorId: id });
    setChoosingAnchor(false);
  };

  const finish = async ask => {
    setBusy(true);
    try { await syncJewishAlarms(settings, { ask }); } catch { /* the main screen shows the state */ }
    setBusy(false);
    onDone();
  };
  const save = async () => {
    const clean = normalizeRule({ ...rule, title: draft.title?.trim() || '' });
    const problem = draftProblem(rule) || (!clean ? 'לא ניתן לשמור את השעון.' : null);
    if (problem) { setMessage(problem); return; }
    if (findDuplicate(loadAlarmState().rules, clean)) { setMessage('שעון זהה כבר קיים ברשימה.'); return; }
    upsertRule(clean);
    const adapter = await platformAdapter();
    if (adapter.engine !== 'none' && clean.enabled) {
      const state = await adapter.permission().catch(() => 'prompt');
      if (state === 'prompt') { setAsking(true); return; }
    }
    await finish(false);
  };
  const remove = async () => { deleteRule(draft.id); setConfirmDelete(false); await finish(false); };
  const testSound = async () => {
    const adapter = await platformAdapter();
    if (adapter.engine === 'none') { setTestNote('בדיקת צליל אפשרית באפליקציה המותקנת.'); return; }
    const state = await adapter.permission().catch(() => 'prompt');
    if (state !== 'granted') { setTestNote('כדי לבדוק צליל יש לאשר שעונים. אפשר לשמור את השעון ולאשר.'); return; }
    const ok = await adapter.test(draft.sound).catch(() => false);
    setTestNote(ok ? 'השעון יצלצל בעוד כחמש שניות.' : 'לא ניתן היה לבדוק את הצליל כרגע.');
  };

  const title = draft.title?.trim() || defaultTitle(rule || draft);
  return <section className="personal-tools jewish-alarm ja-editor" aria-label={isNew ? 'שעון חדש' : 'עריכת שעון'}>
    <BackLink label="השעון היהודי" onClick={() => history.back()} />
    <header className="ja-editor-head">
      <span className="ja-mark is-small" aria-hidden="true"><JewishAlarmIcon size={24} strokeWidth={1.4} /></span>
      <h1>{isNew ? 'שעון חדש' : title}</h1>
    </header>

    <section className="ja-step-block" aria-labelledby="ja-kind">
      <p className="ja-label" id="ja-kind">סוג השעון</p>
      <Segmented label="סוג השעון" value={draft.mode} onChange={mode => set(mode === 'fixed' && isNew && !timeTouched.current ? { mode, fixedTime: nowTime() } : { mode })} options={[['fixed', 'שעה קבועה', 'כמו שעון רגיל'], ['jewish', 'זמן יהודי', 'לפי זמני היום']]} className="ja-seg-kind" />
    </section>

    {draft.mode === 'fixed' && <section className="ja-step-block" aria-labelledby="ja-time">
      <p className="ja-label" id="ja-time">השעה</p>
      <label className="ja-time-field"><span className="visually-hidden">השעה</span>
        <input type="time" dir="ltr" value={draft.fixedTime} onChange={event => { if (!event.currentTarget.value) return; timeTouched.current = true; set({ fixedTime: event.currentTarget.value }); }} />
      </label>
    </section>}

    {draft.mode === 'jewish' && <section className="ja-step-block" aria-labelledby="ja-anchor">
      <p className="ja-label" id="ja-anchor">הזמן היהודי</p>
      {choosingAnchor || !anchor
        ? <JewishTimePicker value={draft.jewishAnchorId} onChange={chooseAnchor} ctx={ctx} todayKey={todayKey} />
        : <button type="button" className="ja-chosen" onClick={() => setChoosingAnchor(true)} aria-label={`${anchor.label} — לשינוי הזמן`}>
          <span><strong>{anchor.label}</strong><small>{anchor.method}</small></span><span className="ja-chosen-change">שינוי</span>
        </button>}
    </section>}

    {draft.mode === 'jewish' && anchor && !choosingAnchor && <section className="ja-step-block" aria-labelledby="ja-offset">
      <p className="ja-label" id="ja-offset">מתי לצלצל</p>
      <OffsetPicker direction={direction} minutes={minutes} onChange={setOffset} question={direction === 'before' || direction === 'after' ? `כמה זמן ${direction === 'before' ? 'לפני' : 'אחרי'} ${anchor.short}?` : null} />
    </section>}

    {preview && <Preview preview={preview} rule={rule} tz={ctx.tz} todayKey={todayKey} days={days} />}

    {draft.mode && (draft.mode === 'fixed' || anchor) && <section className="ja-step-block" aria-labelledby="ja-days">
      <p className="ja-label" id="ja-days">ימים</p>
      {eventRule
        ? <p className="ja-auto-days">חוזר מעצמו: {recurrenceText(rule)}</p>
        : <>
          <Segmented label="ימים" value={draft.recurrence} onChange={recurrence => set({ recurrence, weekdays: recurrence === 'custom' ? (draft.weekdays?.length && draft.weekdays.length < 7 ? draft.weekdays : [0, 1, 2, 3, 4]) : draft.weekdays })} options={[['daily', 'כל יום'], ['weekdays', 'ימות השבוע'], ['custom', 'בחירת ימים']]} />
          {draft.recurrence === 'custom' && <div className="ja-week" role="group" aria-label="בחירת ימים">
            {WEEKDAY_LETTERS.map((letter, day) => { const on = (draft.weekdays || []).includes(day); return <button type="button" key={letter} aria-pressed={on} aria-label={WEEKDAY_NAMES[day]} className={on ? 'is-on' : ''} onClick={() => set({ weekdays: on ? draft.weekdays.filter(item => item !== day) : [...(draft.weekdays || []), day].sort() })}>{letter}</button>; })}
          </div>}
        </>}
      <div className="ja-row">
        <span><strong>גם בשבת ובחג</strong><small>{draft.ringOnRest ? 'השעון יצלצל גם בשבת ובחג, כפי שבחרת.' : 'כברירת מחדל השעון שותק בשבת ובחג.'}</small></span>
        <AlarmSwitch checked={draft.ringOnRest} onChange={value => set({ ringOnRest: value })} label="להשמיע את השעון גם בשבת ובחג" />
      </div>
    </section>}

    {draft.mode && (draft.mode === 'fixed' || anchor) && <section className="ja-step-block" aria-labelledby="ja-more">
      <p className="ja-label" id="ja-more">פרטים</p>
      <label className="ja-name"><span>שם השעון</span><input value={draft.title || ''} maxLength={60} placeholder={defaultTitle(rule || draft)} onChange={event => set({ title: event.currentTarget.value })} dir="rtl" /></label>
      <p className="ja-sub-label">נודניק</p>
      <Segmented label="נודניק" value={draft.snoozeMinutes} onChange={snoozeMinutes => set({ snoozeMinutes })} options={[[5, '5 דק׳'], [10, '10 דק׳'], [15, '15 דק׳']]} />
      {platform === 'ios'
        ? <p className="ja-note">באייפון יישמע צליל השעון של המערכת.</p>
        : <><p className="ja-sub-label">צליל</p><Segmented label="צליל" value={draft.sound} onChange={sound => set({ sound })} options={[['default', 'ברירת המחדל'], ['gentle', 'עדין'], ['bold', 'בולט']]} /></>}
      {platform === 'android' && <div className="ja-row"><span><strong>רטט</strong></span><AlarmSwitch checked={draft.vibration} onChange={vibration => set({ vibration })} label="רטט" /></div>}
      <button type="button" className="ja-link ja-test" onClick={testSound}>בדיקת צליל</button>
      {testNote && <p className="ja-note" role="status">{testNote}</p>}
    </section>}

    {message && <p className="notice error" role="alert">{message}</p>}
    {draft.mode && <div className="ja-actions">
      <button type="button" className="ja-button is-primary" disabled={busy} onClick={save}>שמירה</button>
      {!isNew && <button type="button" className="ja-button is-danger" onClick={() => setConfirmDelete(true)}>מחיקת השעון</button>}
    </div>}

    {asking && <AlarmSheet title="הרשאת שעונים" onClose={() => { setAsking(false); finish(false); }}>
      <p>{platform === 'android' ? 'כדי שהשעון יצלצל בזמן המדויק גם כשהאפליקציה סגורה, יש לאשר התראות ושעון מדויק.' : 'כדי שהשעון יצלצל גם כשהאפליקציה סגורה, יש לאשר שעונים.'}</p>
      <p className="ja-note">השעונים נשמרים ומחושבים במכשיר בלבד.</p>
      <div className="ja-sheet-actions">
        <button type="button" className="ja-button" onClick={() => { setAsking(false); finish(false); }}>לא עכשיו</button>
        <button type="button" className="ja-button is-primary" onClick={() => { setAsking(false); finish(true); }}>המשך</button>
      </div>
    </AlarmSheet>}
    {confirmDelete && <AlarmSheet title="מחיקת השעון" onClose={() => setConfirmDelete(false)}>
      <p>למחוק את השעון „{title}”?</p>
      <div className="ja-sheet-actions">
        <button type="button" className="ja-button" onClick={() => setConfirmDelete(false)}>ביטול</button>
        <button type="button" className="ja-button is-danger" onClick={remove}>מחיקה</button>
      </div>
    </AlarmSheet>}
  </section>;
}

// "הנץ מחר 06:00 · השעון שלך 05:35 · 25 דקות לפני" — two balanced halves, the relation under them.
function Preview({ preview, rule, tz, todayKey, days }) {
  if (preview.error) return <p className="notice" role="status">{preview.error === 'no-location' ? 'בחרו עיר או מיקום כדי לחשב את הזמן.' : 'הזמן הזה אינו זמין בימים הקרובים.'}</p>;
  const { occurrence, anchor } = preview;
  const day = dayText(occurrence.date, todayKey);
  const alarm = timeText(occurrence.at, tz);
  const offset = Number(rule.offsetMinutes) || 0;
  const relation = rule.mode === 'fixed' ? 'שעה קבועה' : offset === 0 ? 'בזמן' : `${minutesText(offset)} ${offset < 0 ? 'לפני' : 'אחרי'}`;
  const label = rule.mode === 'fixed'
    ? `השעון שלך ${day} ב־${alarm}`
    : `${anchor.short} ${day} ${timeText(occurrence.anchorTime, tz)}, השעון שלך ${alarm}, ${relation}`;
  return <section className="ja-preview" aria-live="polite" aria-label={label}>
    <div className={`ja-preview-pair${rule.mode === 'fixed' ? ' is-single' : ''}`} aria-hidden="true">
      {rule.mode === 'jewish' && <div><small>{anchor.short} {day}</small><time dir="ltr">{timeText(occurrence.anchorTime, tz)}</time></div>}
      <div className="is-alarm"><small>השעון שלך{rule.mode === 'fixed' ? ` ${day}` : ''}</small><time dir="ltr">{alarm}</time></div>
    </div>
    <p className="ja-preview-relation" aria-hidden="true">{relation}{occurrence.detail?.omerDay ? ` · הלילה ${occurrence.detail.omerDay} לעומר` : ''}{occurrence.detail?.fast ? ` · ${occurrence.detail.fast}` : ''}{occurrence.detail?.chanukahNight ? ` · נר ${occurrence.detail.chanukahNight}` : ''}</p>
    {days.length > 0 && <details className="ja-days">
      <summary>{isEventRule(rule) ? 'המועדים הקרובים' : 'הצג את 7 הימים הקרובים'}</summary>
      <ul>{days.map(item => <li key={item.date}>
        <span>{WEEKDAY_SHORT[new Date(`${item.date}T12:00:00Z`).getUTCDay()]} {isEventRule(rule) ? item.date.split('-').slice(1).reverse().map(Number).join('.') : ''}</span>
        {item.status === 'ring' ? <><time dir="ltr">{timeText(item.alarmTime, tz)}</time><small>{rule.mode === 'jewish' ? `${anchor.short} ${timeText(item.anchorTime, tz)}` : ''}</small></>
          : <><time className="is-empty">—</time><small>{item.status === 'rest' ? 'שבת / חג — שותק' : item.status === 'off-day' ? 'לא בימים שנבחרו' : 'אין זמן ביום זה'}</small></>}
      </li>)}</ul>
    </details>}
  </section>;
}
