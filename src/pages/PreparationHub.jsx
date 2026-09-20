import { useEffect, useState } from 'react';
import { timeLabel } from '../services.mjs';
import {
  addCustomTask, isTaskComplete, loadPreparation, markPermissionRequested, moveCustomTask,
  removeCustomTask, renameCustomTask, restoreDefaults, savePreparation, setDefaultTaskDisabled,
  setCustomPreparationReminder, setNotificationCategory, setNotificationsEnabled,
  setPreparationReminderTime, setPreparationReminderTopic, setTaskCompletion, setTaskReminder,
} from '../services/preparationStorage.mjs';
import {
  SHABBAT_GROUPS, SHABBAT_TASKS, shabbatPreparation, timeUntilCandles,
  upcomingShabbatContext, visibleTasks,
} from '../services/preparationPlan.mjs';
import { buildNotifications } from '../services/notificationEngine.mjs';
import { applySchedule, cancelAllScheduled, requestNotificationPermission } from '../services/notifications.mjs';

const REMINDER_OPTIONS = [
  ['none', 'בלי תזכורת'],
  ['morning', 'בבוקר יום שישי'],
  ['two-hours', 'שעתיים לפני'],
  ['one-hour', 'שעה לפני'],
  ['custom', 'זמן מותאם'],
];

export function usePreparation() {
  const [state, setState] = useState(() => loadPreparation());
  const update = updater => setState(current => savePreparation(typeof updater === 'function' ? updater(current) : updater));
  return [state, update];
}

const BackLink = () => <a className="link back-link" href="#preparation">← חזרה להכנות</a>;
const taskDone = (state, plan, task) => isTaskComplete(state, plan.eventKey, task.id);

function progressFor(tasks, state, plan) {
  const completed = tasks.filter(task => taskDone(state, plan, task)).length;
  return { completed, total: tasks.length, remaining: tasks.length - completed };
}

function contextTitle(context) {
  const name = context.parashaName?.replace(/^Parashat\s+/i, '').replace(/^פרשת\s+/, '');
  return name ? `שבת פרשת ${name}` : 'השבת הקרובה';
}

export default function PreparationHub({ route = 'preparation', now, settings, items, onNav }) {
  const [state, update] = usePreparation();
  const tz = settings?.location?.tzid || 'UTC';
  const plan = shabbatPreparation({ now, tz, items });
  const context = upcomingShabbatContext(items, plan.dateKey);
  const tasks = visibleTasks(plan, state);
  const pendingTasks = tasks.filter(task => !taskDone(state, plan, task)).sort((a, b) => (a.priority || 99) - (b.priority || 99));
  const planned = buildNotifications({ now, tz, plan, items, state, remaining: pendingTasks.length, pendingTasks });
  const section = route.split('/')[1] || 'home';

  useEffect(() => {
    if (!state.notifications.enabled) return undefined;
    let active = true;
    applySchedule(state.scheduled || {}, planned).then(result => {
      if (active && result.applied) update(current => ({ ...current, scheduled: result.scheduled }));
    });
    return () => { active = false; };
  }, [state.notifications.enabled, state.notifications.quietMode, JSON.stringify(planned)]);

  const shared = { state, update, plan, context, tasks, pendingTasks, planned, tz, now, onNav };
  if (section === 'tasks') return <TasksPage {...shared} />;
  if (section === 'times') return <ShabbatTimes {...shared} settings={settings} />;
  if (section === 'shabbat') return <MyShabbat {...shared} />;
  if (section === 'spiritual') return <SpiritualPreparation {...shared} />;
  if (section === 'reminders') return <RemindersPage {...shared} />;
  return <HubHome {...shared} />;
}

function HubHome({ state, update, plan, context, tasks, pendingTasks, tz, now }) {
  const progress = progressFor(tasks, state, plan);
  const remaining = timeUntilCandles(now, plan.candles);
  const rows = [
    ['preparation/times', 'זמני השבת', plan.candles ? `הדלקת נרות ${timeLabel(plan.candles, tz)}` : 'זמני השבת הקרובה'],
    ['preparation/tasks', 'הרשימה שלי', `${progress.completed} מתוך ${progress.total} הושלמו`],
    ['preparation/shabbat', 'השבת שלי', context.parashaName || 'פרשה, קריאה ותפילה'],
    ['preparation/spiritual', 'הכנה רוחנית', 'פרשה, לימוד ודבר תורה'],
    ['preparation/reminders', 'תזכורות', state.notifications.enabled && state.notifications.categories.shabbat ? 'פעילות' : 'כבויות'],
  ];
  return <section className="preparation">
    <p className="eyebrow">לקראת השבת</p>
    <h1>הכנות לשבת</h1>
    <section className="prep-shabbat-head">
      <strong>{contextTitle(context)}</strong>
      <span>{plan.candles ? `הדלקת נרות ${timeLabel(plan.candles, tz)}` : 'זמן הדלקת נרות אינו זמין'}</span>
      {remaining && <small>נותרו {remaining}</small>}
    </section>
    <section className="prep-progress" aria-label={`${progress.completed} מתוך ${progress.total} הכנות הושלמו`}>
      <div><strong>הושלמו {progress.completed} מתוך {progress.total} הכנות</strong><span>{progress.remaining ? `${progress.remaining} נשארו` : 'הכול מוכן'}</span></div>
      <progress max={Math.max(progress.total, 1)} value={progress.completed} />
    </section>
    <section className="prep-next">
      <div className="prep-section-title"><h2>ההכנות הבאות</h2><a className="link" href="#preparation/tasks">לכל ההכנות</a></div>
      {pendingTasks.length === 0 ? <p className="notice">כל ההכנות ברשימה הושלמו.</p>
        : <ul className="prep-task-list">{pendingTasks.slice(0, 5).map(task => <TaskCheck key={task.id} task={task} state={state} update={update} plan={plan} />)}</ul>}
    </section>
    <nav className="prep-nav" aria-label="הכנות לשבת">
      {rows.map(([href, title, description]) => <a href={`#${href}`} key={href}><span><strong>{title}</strong><small>{description}</small></span><span aria-hidden="true">←</span></a>)}
    </nav>
  </section>;
}

function TaskCheck({ task, state, update, plan, full = false, onNav }) {
  const done = taskDone(state, plan, task);
  const reminder = state.taskReminders?.[task.id] || { preset: 'none', customAt: '' };
  return <li className={`prep-task${done ? ' done' : ''}`}>
    <label className="prep-task-main">
      <input type="checkbox" checked={done} onChange={() => update(current => setTaskCompletion(current, plan.eventKey, task.id, !done))} />
      <span className="prep-task-title">{task.title}</span>
      <span className="prep-task-state">{done ? 'הושלם' : 'להכנה'}</span>
    </label>
    {full && task.details?.length > 0 && <details className="prep-task-details"><summary>פרטים</summary><ul>{task.details.map(detail => <li key={detail}>{detail}</li>)}</ul></details>}
    {full && task.action && <button type="button" className="link prep-open" onClick={() => onNav?.(task.action)}>לפתיחה</button>}
    {full && (task.reminderEligible || task.custom) && <div className="prep-reminder-control">
      <label><span>תזכורת</span><select value={reminder.preset} onChange={event => { const preset = event.currentTarget.value; update(current => setTaskReminder(current, task.id, preset, reminder.customAt)); }}>
        {REMINDER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {reminder.preset === 'custom' && <input aria-label={`זמן תזכורת עבור ${task.title}`} type="datetime-local" value={reminder.customAt || ''}
        onChange={event => { const customAt = event.currentTarget.value; update(current => setTaskReminder(current, task.id, 'custom', customAt)); }} />}
    </div>}
    {full && (task.custom ? <PersonalTaskActions task={task} update={update} />
      : <button type="button" className="ghost prep-hide" onClick={() => update(current => setDefaultTaskDisabled(current, task.id, true))}>הסתרה</button>)}
  </li>;
}

function PersonalTaskActions({ task, update }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const save = () => { update(current => renameCustomTask(current, task.id, title)); setEditing(false); };
  return <div className="prep-task-actions">
    {editing ? <><input aria-label="שם המשימה" value={title} onChange={event => setTitle(event.currentTarget.value)} /><button type="button" className="ghost" onClick={save}>שמירה</button></>
      : <button type="button" className="ghost" onClick={() => setEditing(true)}>שינוי שם</button>}
    <button type="button" className="ghost" aria-label={`העלה ${task.title}`} onClick={() => update(current => moveCustomTask(current, task.id, -1))}>↑</button>
    <button type="button" className="ghost" aria-label={`הורד ${task.title}`} onClick={() => update(current => moveCustomTask(current, task.id, 1))}>↓</button>
    <button type="button" className="ghost" onClick={() => update(current => removeCustomTask(current, task.id))}>מחיקה</button>
  </div>;
}

function TasksPage({ state, update, plan, tasks, onNav }) {
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState('family');
  const hidden = SHABBAT_TASKS.filter(task => state.disabledDefaults?.[task.id]);
  const add = event => {
    event.preventDefault();
    update(current => addCustomTask(current, { title, group, scope: 'shabbat' }));
    setTitle('');
  };
  return <section className="preparation">
    <BackLink /><p className="eyebrow">הכנות לשבת</p><h1>הרשימה שלי</h1>
    <p className="intro">הרשימה היא כלי מעשי וגמיש. אפשר להתאים אותה לבית שלכם.</p>
    <div className="prep-groups">{SHABBAT_GROUPS.map((section, index) => {
      const grouped = tasks.filter(task => task.group === section.id);
      if (!grouped.length) return null;
      const complete = grouped.filter(task => taskDone(state, plan, task)).length;
      return <details key={section.id} open={index === 0} className="prep-group"><summary><span>{section.label}</span><small>{complete}/{grouped.length}</small></summary>
        <ul className="prep-task-list">{grouped.map(task => <TaskCheck key={task.id} task={task} state={state} update={update} plan={plan} full onNav={onNav} />)}</ul>
      </details>;
    })}</div>
    <section className="prep-personal">
      <h2>משימה אישית</h2>
      <form className="prep-add-task" onSubmit={add}>
        <label className="personal-field"><span>שם המשימה</span><input value={title} onChange={event => setTitle(event.currentTarget.value)} /></label>
        <label className="personal-field"><span>קבוצה</span><select value={group} onChange={event => setGroup(event.currentTarget.value)}>{SHABBAT_GROUPS.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <button className="personal-primary" type="submit" disabled={!title.trim()}>הוספה לרשימה</button>
      </form>
    </section>
    {hidden.length > 0 && <details className="prep-hidden"><summary>משימות שהוסתרו ({hidden.length})</summary>
      <ul className="prep-inline-list">{hidden.map(task => <li key={task.id}><span>{task.title}</span><button type="button" className="ghost" onClick={() => update(current => setDefaultTaskDisabled(current, task.id, false))}>החזרה</button></li>)}</ul>
      <button type="button" className="ghost" onClick={() => update(restoreDefaults)}>החזרת כל משימות ברירת המחדל</button>
    </details>}
  </section>;
}

function ShabbatTimes({ plan, tz, settings }) {
  const times = [
    ['הדלקת נרות', plan.candles], ['שקיעה', plan.sunset], ['צאת שבת', plan.havdalah],
    ...(settings?.showRT ? [['רבנו תם', plan.rabbeinuTam]] : []),
  ];
  return <section className="preparation"><BackLink /><p className="eyebrow">השבת הקרובה</p><h1>זמני השבת</h1>
    <dl className="prep-times">{times.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ? timeLabel(value, tz) : 'לא זמין'}</dd></div>)}</dl>
    <p className="personal-hint">הזמנים מוצגים לפי המיקום והשיטה שנבחרו באפליקציה.</p>
  </section>;
}

function MyShabbat({ context, onNav }) {
  const reading = context.reading || {};
  const rows = [
    ['פרשת השבוע', context.parashaName],
    ['הפטרה', reading.haftarah_sephardic || reading.haftara],
    ['שבת מיוחדת', context.special?.hebrew || context.special?.title],
    ['ראש חודש', context.roshChodesh ? 'חל בשבת' : null],
    ['קריאת התורה', reading.torah],
  ].filter(([, value]) => value);
  return <section className="preparation"><BackLink /><p className="eyebrow">השבת הקרובה</p><h1>השבת שלי</h1>
    {rows.length ? <dl className="prep-context-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      : <p className="notice">פרטי הקריאה לשבת זו עדיין אינם זמינים.</p>}
    <div className="prep-actions"><button type="button" className="personal-primary" onClick={() => onNav?.('parasha')}>פתיחת פרשת השבוע</button><button type="button" className="ghost" onClick={() => onNav?.('siddur')}>לסידור</button></div>
  </section>;
}

function SpiritualPreparation({ onNav }) {
  const entries = [
    ['שניים מקרא ואחד תרגום', 'קריאה ולימוד של פרשת השבוע', 'personal-tools/parasha'],
    ['פרשת השבוע', 'פתיחת הקריאה הקיימת באפליקציה', 'parasha'],
    ['דבר תורה', 'רעיונות ומקור קצר לשולחן שבת', 'shabbat-table'],
    ['תהילים ולימוד לשבת', 'פתיחת ספר תהילים', 'tehillim'],
  ];
  return <section className="preparation"><BackLink /><p className="eyebrow">הכנות לשבת</p><h1>הכנה רוחנית</h1>
    <div className="prep-spiritual">{entries.map(([title, description, route]) => <button type="button" key={title} onClick={() => onNav?.(route)}><span><strong>{title}</strong><small>{description}</small></span><span>לפתיחה</span></button>)}</div>
  </section>;
}

const SUMMARY_TIMES = [
  ['morning', 'יום שישי בבוקר'],
  ['two-hours', 'שעתיים לפני הדלקת נרות'],
  ['one-hour', 'שעה לפני הדלקת נרות'],
];

const SUMMARY_TOPICS = [
  ['candles', 'נרות שבת'],
  ['plata', 'פלטה ומיחם'],
  ['electricity', 'שעוני שבת וחשמל'],
  ['home', 'בית וסעודות'],
  ['family', 'הכנות אישיות ומשפחה'],
  ['spiritual', 'הכנה רוחנית'],
];

function RemindersPage({ state, update, planned }) {
  const [status, setStatus] = useState('');
  const enabled = state.notifications.enabled && state.notifications.categories.shabbat;
  const setEnabled = async selected => {
    if (!selected) {
      await cancelAllScheduled(state.scheduled || {});
      update(current => ({ ...setNotificationCategory(current, 'shabbat', false), scheduled: {} }));
      setStatus('');
      return;
    }
    const permission = await requestNotificationPermission();
    update(current => markPermissionRequested(current));
    if (permission === 'granted') {
      update(current => setNotificationCategory(setNotificationsEnabled(current, true), 'shabbat', true));
      setStatus('');
    } else setStatus(permission === 'unsupported'
      ? 'תזכורות זמינות באפליקציה במכשיר.'
      : 'כדי לקבל תזכורות יש לאפשר התראות ל־K-Zohaar בהגדרות המכשיר.');
  };
  const toggleTime = (reminderId, selected) => update(current => setPreparationReminderTime(current, reminderId, selected));
  const toggleTopic = (topicId, selected) => update(current => setPreparationReminderTopic(current, topicId, selected));
  const times = state.notifications.reminderTimes || [];
  const topics = state.notifications.reminderTopics || [];
  const activeReminders = planned.filter(item => item.category === 'shabbat').length;
  return <section className="preparation prep-reminders"><BackLink /><p className="eyebrow">הכנות לשבת</p><h1>תזכורות לשבת</h1>
    <p className="intro">בחר מתי להזכיר לך ומה חשוב שלא יישכח לפני שבת.</p>
    <label className="prep-enable-reminders"><span><strong>הפעל תזכורות</strong></span><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.currentTarget.checked)} /></label>
    {status && <p className="notice prep-reminder-status" role="status">{status}</p>}
    <fieldset className="prep-reminder-section"><legend>מתי להזכיר לי?</legend>
      {SUMMARY_TIMES.map(([id, label]) => <label key={id}><input type="checkbox" checked={times.includes(id)} onChange={event => toggleTime(id, event.currentTarget.checked)} /><span>{label}</span></label>)}
      <label><input type="checkbox" checked={times.includes('custom')} onChange={event => toggleTime('custom', event.currentTarget.checked)} /><span>זמן נוסף</span></label>
      {times.includes('custom') && <input className="prep-custom-time" aria-label="זמן נוסף" type="datetime-local" value={state.notifications.customReminderAt || ''}
        onChange={event => { const value = event.currentTarget.value; update(current => setCustomPreparationReminder(current, value)); }} />}
    </fieldset>
    <fieldset className="prep-reminder-section"><legend>מה חשוב להזכיר?</legend>
      <div className="prep-reminder-topics">{SUMMARY_TOPICS.map(([id, label]) => <label key={id}><input type="checkbox" checked={topics.includes(id)} onChange={event => toggleTopic(id, event.currentTarget.checked)} /><span>{label}</span></label>)}</div>
    </fieldset>
    <p className="personal-hint prep-active-reminders">{activeReminders ? `תזכורות פעילות: ${activeReminders}` : 'אין תזכורות פעילות'}</p>
  </section>;
}