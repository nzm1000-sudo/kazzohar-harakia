import TitleOrnament from '../components/ui/TitleOrnament.jsx';
import { useEffect, useState } from 'react';
import { rabbenuTamAfterSunset } from '../services/zmanimLocal.mjs';
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
import { formatTanakhReferences } from '../services/tanakhReferences.mjs';
import TanakhRefText from '../components/TanakhRefText.jsx';
import { BackLink } from '../components/LocalNavigation.jsx';
import Selector from '../components/ui/Selector.jsx';
import { parashaOfWeek, weekReadingOf } from '../services/weeklyParasha.mjs';
import { parashaDivreiTorah } from '../services/weeklyDivreiTorah.mjs';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { articlesForParasha, currentTorahCatalog, torahRoute } from '../services/torahContent.mjs';
import { parashotOfReading } from '../services/torahTaxonomy.mjs';
import { TORAT_SHAI_CREDIT } from '../services/toratShaiTorah.mjs';
import ArrowMark from '../components/ui/ArrowMark.jsx';

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

// Same local-notification schedule wherever the checklist is shown.
export function usePreparationSchedule({ now, tz, plan, items, state, update, pendingTasks }) {
  const planned = buildNotifications({ now, tz, plan, items, state, remaining: pendingTasks.length, pendingTasks });
  useEffect(() => {
    if (!state.notifications.enabled) return undefined;
    let active = true;
    applySchedule(state.scheduled || {}, planned).then(result => {
      if (active && result.applied) update(current => ({ ...current, scheduled: result.scheduled }));
    });
    return () => { active = false; };
  }, [state.notifications.enabled, state.notifications.quietMode, JSON.stringify(planned)]);
  return planned;
}

// The Shabbat page's entry to the preparations: one card with the progress; it opens every option (#preparation).
// Reminders stay scheduled exactly as with the full list.
export function ShabbatPrepCard({ now, settings, items }) {
  const [state, update] = usePreparation();
  const tz = settings?.location?.tzid || 'UTC';
  const plan = shabbatPreparation({ now, tz, items, location: settings?.location });
  const tasks = visibleTasks(plan, state);
  const pendingTasks = tasks.filter(task => !taskDone(state, plan, task)).sort((a, b) => (a.priority || 99) - (b.priority || 99));
  usePreparationSchedule({ now, tz, plan, items, state, update, pendingTasks });
  const progress = progressFor(tasks, state, plan);
  return <a className="table-preview-card shabbat-prep-card" href="#preparation" aria-label={`הכנות לשבת — ${progress.completed} מתוך ${progress.total} הושלמו. פתיחת כל האפשרויות`}>
    <span className="table-preview-text"><strong>הרשימה, התזכורות וההכנה הרוחנית</strong><small>{progress.remaining ? `הושלמו ${progress.completed} מתוך ${progress.total}${pendingTasks[0] ? ` · הבא: ${pendingTasks[0].title}` : ''}` : 'כל ההכנות הושלמו'}</small></span>
    <ArrowMark className="table-preview-arrow" legacy="‹" />
  </a>;
}

// The Shabbat preparation checklist in its original groups and order, for the Shabbat page.
export function ShabbatChecklist({ now, settings, items }) {
  const [state, update] = usePreparation();
  const tz = settings?.location?.tzid || 'UTC';
  const plan = shabbatPreparation({ now, tz, items, location: settings?.location });
  const tasks = visibleTasks(plan, state);
  const pendingTasks = tasks.filter(task => !taskDone(state, plan, task)).sort((a, b) => (a.priority || 99) - (b.priority || 99));
  usePreparationSchedule({ now, tz, plan, items, state, update, pendingTasks });
  const progress = progressFor(tasks, state, plan);
  const reminders = state.notifications.enabled && state.notifications.categories.shabbat;
  const groups = SHABBAT_GROUPS.map(group => ({ ...group, tasks: tasks.filter(task => (task.group || 'before') === group.id) })).filter(group => group.tasks.length);
  const ungrouped = tasks.filter(task => !SHABBAT_GROUPS.some(group => group.id === (task.group || 'before')));
  return <section className="shabbat-checklist" aria-label="הכנות לשבת">
    <div className="shabbat-checklist-head"><h2>הכנות לשבת</h2><span>{progress.completed} מתוך {progress.total}</span></div>
    {groups.map(group => <div key={group.id} className="shabbat-checklist-group"><h3>{group.label}</h3><ul className="prep-task-list">{group.tasks.map(task => <TaskCheck key={task.id} task={task} state={state} update={update} plan={plan} />)}</ul></div>)}
    {ungrouped.length > 0 && <ul className="prep-task-list">{ungrouped.map(task => <TaskCheck key={task.id} task={task} state={state} update={update} plan={plan} />)}</ul>}
    <div className="shabbat-checklist-links no-print"><button type="button" className="link" onClick={() => window.location.hash = '#preparation/reminders'}>{reminders ? 'תזכורות פעילות' : 'הפעלת תזכורות'}</button><button type="button" className="link" onClick={() => window.location.hash = '#preparation/tasks'}>עריכת הרשימה</button></div>
  </section>;
}

const BackLinkComponent = () => <BackLink href="#preparation" label="חזרה להכנות" />;
const taskDone = (state, plan, task) => isTaskComplete(state, plan.eventKey, task.id);

function progressFor(tasks, state, plan) {
  const completed = tasks.filter(task => taskDone(state, plan, task)).length;
  return { completed, total: tasks.length, remaining: tasks.length - completed };
}

function contextTitle(context) {
  // The calendar's parasha of that Shabbat; without one (a festival Shabbat) the week's reading (weekReadingOf) —
  // the festival itself, never the parasha read a week later.
  if (!context.parashaName && context.weekReading?.kind === 'festival') return `שבת · ${context.weekReading.label}`;
  const name = (context.parashaName || context.weekReading?.label)?.replace(/^Parashat\s+/i, '').replace(/^פרשת\s+/, '');
  return name ? `שבת פרשת ${name}` : 'השבת הקרובה';
}

export default function PreparationHub({ route = 'preparation', now, settings, items, onNav }) {
  const [state, update] = usePreparation();
  const tz = settings?.location?.tzid || 'UTC';
  const plan = shabbatPreparation({ now, tz, items, location: settings?.location });
  // What is read on that Shabbat — the app's one label of the week (services/weeklyParasha.mjs weekReadingOf).
  const context = { ...upcomingShabbatContext(items, plan.dateKey), weekReading: plan.dateKey ? weekReadingOf(plan.dateKey, ilOf(settings)) : null };
  const tasks = visibleTasks(plan, state);
  const pendingTasks = tasks.filter(task => !taskDone(state, plan, task)).sort((a, b) => (a.priority || 99) - (b.priority || 99));
  const planned = usePreparationSchedule({ now, tz, plan, items, state, update, pendingTasks });
  const section = route.split('/')[1] || 'home';

  const shared = { state, update, plan, context, tasks, pendingTasks, planned, tz, now, onNav };
  if (section === 'tasks') return <TasksPage {...shared} />;
  if (section === 'times') return <ShabbatTimes {...shared} settings={settings} />;
  if (section === 'shabbat') return <MyShabbat {...shared} />;
  if (section === 'spiritual') return <SpiritualPreparation {...shared} settings={settings} />;
  if (section === 'dvar-torah') return <DvarTorahForShabbat {...shared} settings={settings} />;
  if (section === 'reminders') return <RemindersPage {...shared} />;
  return <HubHome {...shared} />;
}

function HubHome({ state, update, plan, context, tasks, pendingTasks, tz, now }) {
  const progress = progressFor(tasks, state, plan);
  const remaining = timeUntilCandles(now, plan.candles);
  const rows = [
    ['preparation/times', 'זמני השבת', plan.candles ? `הדלקת נרות ${timeLabel(plan.candles, tz)}` : 'זמני השבת הקרובה'],
    ['preparation/tasks', 'הרשימה שלי', `${progress.completed} מתוך ${progress.total} הושלמו`],
    ['preparation/shabbat', 'השבת שלי', context.parashaName || context.weekReading?.label || 'פרשה, קריאה ותפילה'],
    ['preparation/spiritual', 'הכנה רוחנית', 'פרשה, לימוד ודבר תורה'],
    ['preparation/reminders', 'תזכורות', state.notifications.enabled && state.notifications.categories.shabbat ? 'פעילות' : 'כבויות'],
  ];
  return <section className="preparation">
    <p className="eyebrow">לקראת השבת</p>
    <h1>הכנות לשבת</h1>
    <TitleOrnament />
    <section className="prep-shabbat-head clay-card">
      <strong>{contextTitle(context)}</strong>
      <span>{plan.candles ? `הדלקת נרות ${timeLabel(plan.candles, tz)}` : 'זמן הדלקת נרות אינו זמין'}</span>
      {remaining && <small>נותרו {remaining}</small>}
    </section>
    <section className="prep-progress" aria-label={`${progress.completed} מתוך ${progress.total} הכנות הושלמו`}>
      <div><strong>הושלמו {progress.completed} מתוך {progress.total} הכנות</strong><span>{progress.remaining ? `${progress.remaining} נשארו` : 'הכול מוכן'}</span></div>
      <progress max={Math.max(progress.total, 1)} value={progress.completed} />
    </section>
    <section className="prep-next">
      <div className="prep-section-title"><h2>ההכנות הבאות</h2><a className="link-button" href="#preparation/tasks">לכל ההכנות<ArrowMark size="inline" /></a></div>
      {pendingTasks.length === 0 ? <p className="notice">כל ההכנות ברשימה הושלמו.</p>
        : <ul className="prep-task-list">{pendingTasks.slice(0, 5).map(task => <TaskCheck key={task.id} task={task} state={state} update={update} plan={plan} />)}</ul>}
    </section>
    <nav className="prep-nav" aria-label="הכנות לשבת">
      {rows.map(([href, title, description]) => <a href={`#${href}`} key={href}><span><strong>{title}</strong><small>{description}</small></span><ArrowMark /></a>)}
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
    {full && task.details?.length > 0 && <details className="prep-task-details"><summary>פרטים<ArrowMark dir="down" size="inline" clayOnly /></summary><ul>{task.details.map(detail => <li key={detail}>{detail}</li>)}</ul></details>}
    {full && task.action && <button type="button" className="link prep-open" onClick={() => onNav?.(task.action)}>לפתיחה</button>}
    {full && (task.reminderEligible || task.custom) && <div className="prep-reminder-control">
      <Selector className="prep-reminder-pick" label={`תזכורת עבור ${task.title}`} shownLabel="תזכורת" title="תזכורת" value={reminder.preset} onChange={preset => update(current => setTaskReminder(current, task.id, preset, reminder.customAt))} options={REMINDER_OPTIONS} />
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
      : <button type="button" className="ghost" aria-label={`שינוי שם: ${task.title}`} onClick={() => setEditing(true)}>שינוי שם</button>}
    <button type="button" className="ghost arrow-button" aria-label={`העלה ${task.title}`} onClick={() => update(current => moveCustomTask(current, task.id, -1))}><ArrowMark dir="up" /></button>
    <button type="button" className="ghost arrow-button" aria-label={`הורד ${task.title}`} onClick={() => update(current => moveCustomTask(current, task.id, 1))}><ArrowMark dir="down" /></button>
    <button type="button" className="ghost" aria-label={`מחיקה: ${task.title}`} onClick={() => update(current => removeCustomTask(current, task.id))}>מחיקה</button>
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
      return <details key={section.id} open={index === 0} className="prep-group clay-details"><summary><span>{section.label}</span><small>{complete}/{grouped.length}</small></summary>
        <ul className="prep-task-list">{grouped.map(task => <TaskCheck key={task.id} task={task} state={state} update={update} plan={plan} full onNav={onNav} />)}</ul>
      </details>;
    })}</div>
    <section className="prep-personal">
      <h2>משימה אישית</h2>
      <form className="prep-add-task" onSubmit={add}>
        <label className="personal-field"><span>שם המשימה</span><input value={title} onChange={event => setTitle(event.currentTarget.value)} /></label>
        <Selector className="personal-field" label="קבוצה" value={group} onChange={setGroup} options={SHABBAT_GROUPS.map(item => [item.id, item.label])} />
        <button className="personal-primary" type="submit" disabled={!title.trim()}>הוספה לרשימה</button>
      </form>
    </section>
    {hidden.length > 0 && <details className="prep-hidden clay-details"><summary>משימות שהוסתרו ({hidden.length})</summary>
      <ul className="prep-inline-list">{hidden.map(task => <li key={task.id}><span>{task.title}</span><button type="button" className="ghost" onClick={() => update(current => setDefaultTaskDisabled(current, task.id, false))}>החזרה</button></li>)}</ul>
      <button type="button" className="ghost" onClick={() => update(restoreDefaults)}>החזרת כל משימות ברירת המחדל</button>
    </details>}
  </section>;
}

function ShabbatTimes({ plan, tz, settings }) {
  // Rabbenu Tam (sunset + 72) under the end of Shabbat, in smaller type: the regular end stays the main time.
  const rabbenuTam = plan.havdalah && settings?.location ? rabbenuTamAfterSunset(String(plan.havdalah).slice(0, 10), settings.location) : null;
  const times = [
    ['הדלקת נרות', plan.candles], ['שקיעה', plan.sunset], ['צאת שבת', plan.havdalah, rabbenuTam],
  ];
  return <section className="preparation"><BackLinkComponent /><p className="eyebrow">השבת הקרובה</p><h1>זמני השבת</h1>
    <dl className="prep-times clay-card">{times.map(([label, value, secondary]) => <div key={label}><dt>{label}</dt><dd>{value ? timeLabel(value, tz) : 'לא זמין'}{secondary && <small className="rabbenu-tam-line">רבנו תם · {timeLabel(secondary, tz)}</small>}</dd></div>)}</dl>
    <p className="personal-hint">הזמנים מוצגים לפי המיקום והשיטה שנבחרו באפליקציה.</p>
  </section>;
}

const refNode = value => (formatTanakhReferences(value) ? <TanakhRefText text={formatTanakhReferences(value)} /> : null);

function MyShabbat({ context, onNav }) {
  const reading = context.reading || {};
  const rows = [
    [!context.parashaName && context.weekReading?.kind === 'festival' ? 'קריאת השבת' : 'פרשת השבוע', context.parashaName || context.weekReading?.label],
    ['הפטרה', refNode(reading.haftarah_sephardic || reading.haftara)],
    ['שבת מיוחדת', context.special?.hebrew || context.special?.title],
    ['ראש חודש', context.roshChodesh ? 'חל בשבת' : null],
    ['קריאת התורה', refNode(reading.torah)],
  ].filter(([, value]) => value);
  return <section className="preparation"><BackLinkComponent /><p className="eyebrow">השבת הקרובה</p><h1>השבת שלי</h1>
    {rows.length ? <dl className="prep-context-list clay-card">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      : <p className="notice">פרטי הקריאה לשבת זו עדיין אינם זמינים.</p>}
    <div className="prep-actions"><button type="button" className="personal-primary" onClick={() => onNav?.('parasha')}>פתיחת פרשת השבוע</button><button type="button" className="ghost" onClick={() => onNav?.('siddur')}>לסידור</button></div>
  </section>;
}

// The week's parasha on the device (Israel or the Diaspora, as set): what the rows below open.
const ilOf = settings => (settings?.halachicResidenceStatus || (settings?.il ? 'israel' : 'diaspora')) === 'israel';
const weekParasha = (plan, settings) => (plan?.dateKey ? parashaOfWeek(plan.dateKey, ilOf(settings)) : null);

function SpiritualPreparation({ onNav, plan, settings }) {
  const parasha = weekParasha(plan, settings);
  const entries = [
    ['שניים מקרא ואחד תרגום', parasha ? `פרשת ${parasha.he} · מקרא, מקרא ותרגום` : 'מקרא, מקרא ותרגום אונקלוס', parasha ? `shnayim-mikra/${parasha.id}` : 'shnayim-mikra'],
    ['פרשת השבוע', 'פתיחת הקריאה הקיימת באפליקציה', 'parasha'],
    ['דבר תורה', 'מדברי המפרשים ורעיונות לשולחן', 'preparation/dvar-torah'],
    ['תהילים ולימוד לשבת', 'פתיחת ספר תהילים', 'tehillim'],
  ];
  return <section className="preparation"><BackLinkComponent /><p className="eyebrow">הכנות לשבת</p><h1>הכנה רוחנית</h1>
    <div className="prep-spiritual clay-card">{entries.map(([title, description, route]) => <button type="button" key={title} onClick={() => onNav?.(route)}><span><strong>{title}</strong><small>{description}</small></span><span>לפתיחה</span></button>)}</div>
  </section>;
}

// דבר תורה לשבת: the app's three short divrei torah for the parasha (data/divreiTorah.mjs) and, beside them, excerpts
// from the commentaries bundled in the library — exact, attributed, each one tap from its full text
// (data/dvarTorahExcerpts.mjs, generated from the packs; loaded only here).
const BOOK_HE = { Genesis: 'בראשית', Exodus: 'שמות', Leviticus: 'ויקרא', Numbers: 'במדבר', Deuteronomy: 'דברים' };
function DvarTorahForShabbat({ plan, settings, onNav }) {
  const parasha = weekParasha(plan, settings);
  const [excerpts, setExcerpts] = useState(null);
  useEffect(() => { let live = true; import('../data/dvarTorahExcerpts.mjs').then(module => { if (live) setExcerpts(module.DVAR_TORAH_EXCERPTS); }).catch(() => { if (live) setExcerpts({}); }); return () => { live = false; }; }, []);
  // A combined reading (ויקהל־פקודי) takes three from each of its two parashot.
  const halves = !parasha ? [] : parasha.combined ? parasha.name.split('-').map(name => name.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, '-')) : [parasha.id];
  const list = excerpts ? halves.flatMap(id => (excerpts[id] || []).slice(0, parasha?.combined ? 3 : 6)) : [];
  const ideas = parasha ? parashaDivreiTorah(parasha.he)?.list || [] : [];
  // The owner's own dvar torah on the parasha (תורת ש״י) leads the ideas for the table, one tap from the reader.
  const own = parasha ? articlesForParasha(currentTorahCatalog(), parashotOfReading(parasha.he)).filter(item => item.pinned) : [];
  const book = parasha ? BOOK_HE[parasha.reference.split(' ')[0]] : '';
  return <section className="preparation dt-page"><BackLink href="#preparation/spiritual" label="הכנה רוחנית" />
    <header className="dt-head"><p className="eyebrow">הכנה רוחנית</p><h1>דבר תורה לשבת</h1>{parasha && <p className="dt-parasha">פרשת {parasha.he}</p>}</header>
    {!parasha && <p className="notice">פרשת השבוע אינה זמינה כרגע.</p>}
    {parasha && <>
      <section className="dt-section" aria-labelledby="dt-commentators">
        <h2 id="dt-commentators" className="dt-section-title">מדברי המפרשים</h2>
        <p className="dt-section-intro">פתיחות מתוך המפרשים שבספרייה, על ראש הפרשה ועל ראשי העליות — בלשונם, ללא שינוי.</p>
        {!excerpts && <p className="loading" role="status">טוען…</p>}
        <div className="dt-cards">{list.map(item => <article className="dt-card" key={item.unitId}>
          <header><strong>{item.commentator}</strong><small>{book} {hebrewNumeral(item.chapter)}, {hebrewNumeral(item.verse)}</small></header>
          {item.dh && <p className="dt-dh">{item.dh}</p>}
          <p className="dt-text">{item.text}{item.complete ? '' : ' …'}</p>
          <footer><small>{item.sourceLine}</small><button type="button" className="link" onClick={() => onNav?.(`books/r/${encodeURIComponent(item.workId)}/${item.chapter}/v${item.verse}`)}>{item.complete ? 'לפירוש בספרייה' : 'להמשך בספרייה'}</button></footer>
        </article>)}</div>
        {excerpts && !list.length && <p className="notice">אין עדיין קטעים לפרשה זו.</p>}
      </section>
      {(ideas.length > 0 || own.length > 0) && <section className="dt-section" aria-labelledby="dt-ideas">
        <h2 id="dt-ideas" className="dt-section-title">רעיונות לשולחן השבת</h2>
        <div className="dt-cards">{own.map(item => <article className="dt-card dt-idea dt-own" key={item.id}><header><strong>{item.title}</strong><small>{TORAT_SHAI_CREDIT.collection}</small></header><p className="dt-text dt-plain">{item.excerpt}</p><footer><small>{TORAT_SHAI_CREDIT.line}</small><button type="button" className="link" onClick={() => onNav?.(torahRoute.article(item.id))}>לקריאה המלאה</button></footer></article>)}{ideas.map(idea => <article className="dt-card dt-idea" key={idea.title}><header><strong>{idea.title}</strong></header><p className="dt-text dt-plain">{idea.text}</p><footer><small>{idea.source}</small></footer></article>)}</div>
      </section>}
    </>}
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
  return <section className="preparation prep-reminders"><BackLinkComponent /><p className="eyebrow">הכנות לשבת</p><h1>תזכורות לשבת</h1>
    <p className="intro">בחר מתי להזכיר לך ומה חשוב שלא יישכח לפני שבת.</p>
    <label className="prep-enable-reminders clay-card"><span><strong>הפעל תזכורות</strong></span><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.currentTarget.checked)} /></label>
    {status && <p className="notice prep-reminder-status" role="status">{status}</p>}
    <fieldset className="prep-reminder-section clay-card"><legend>מתי להזכיר לי?</legend>
      {SUMMARY_TIMES.map(([id, label]) => <label key={id}><input type="checkbox" checked={times.includes(id)} onChange={event => toggleTime(id, event.currentTarget.checked)} /><span>{label}</span></label>)}
      <label><input type="checkbox" checked={times.includes('custom')} onChange={event => toggleTime('custom', event.currentTarget.checked)} /><span>זמן נוסף</span></label>
      {times.includes('custom') && <input className="prep-custom-time" aria-label="זמן נוסף" type="datetime-local" value={state.notifications.customReminderAt || ''}
        onChange={event => { const value = event.currentTarget.value; update(current => setCustomPreparationReminder(current, value)); }} />}
    </fieldset>
    <fieldset className="prep-reminder-section clay-card"><legend>מה חשוב להזכיר?</legend>
      <div className="prep-reminder-topics">{SUMMARY_TOPICS.map(([id, label]) => <label key={id}><input type="checkbox" checked={topics.includes(id)} onChange={event => toggleTopic(id, event.currentTarget.checked)} /><span>{label}</span></label>)}</div>
    </fieldset>
    <p className="personal-hint prep-active-reminders">{activeReminders ? `תזכורות פעילות: ${activeReminders}` : 'אין תזכורות פעילות'}</p>
  </section>;
}