import { useEffect, useId, useMemo, useRef, useState } from 'react';
import ClearableInput from '../components/ClearableInput.jsx';
import LocationControl from '../components/LocationControl.jsx';
import ManualLocationForm from '../components/ManualLocationForm.jsx';
import DiasporaIndicator from '../components/DiasporaIndicator.jsx';
import Selector from '../components/ui/Selector.jsx';
import TitleOrnament from '../components/ui/TitleOrnament.jsx';
import { AlarmSwitch, Segmented } from '../components/jewishAlarm/AlarmParts.jsx';
import { announce } from '../components/a11yPrimitives.jsx';
import { THEMES } from '../components/Shell.jsx';
import { NUSACHIM } from '../data/nusach/registry.mjs';
import { AccessibilityControls } from './AccessibilityPage.jsx';
import { GROUPS as REMINDER_GROUPS, StatusLine, kindMeta, summaryOf, toggleKind, useReminders } from './MazkirPage.jsx';
import { SETTINGS_SECTIONS, matchingSections, searchSettings } from '../services/settingsSearch.mjs';
import ArrowMark from '../components/ui/ArrowMark.jsx';
import ChallengeSettings from '../components/globalChallenge/ChallengeSettings.jsx';

// הגדרות — the one settings page (owner, 2026-10-02): עוד › הגדרות opens it in one tap. Five sections, each a card with
// a centred title, in this order: נגישות (the full controls, embedded), מיקום (the active place, the halachic residence,
// יום טוב שני, and the manual place by coordinates — moved here from זמנים), נוסח, ערכת צבעים (the eight palettes) and
// התראות (the reminders' switches, their permission, and the screens that hold their details) — and, last, האתגר העולמי
// (participation, the board's opt-in, the nickname, and the erasure of this device's rows on the server).
// A search at the top finds any setting: the sections without a match step aside, and a result jumps to its row and
// marks it for a moment (no movement under reduced motion). Routes: settings · settings/<section id> (opens at it).
// Storage is the app's own, untouched: companion-settings-v2 (setSettings), kz-theme (setTheme), kz-accessibility-v1,
// kz-reminders-v1, kz-global-challenge-v1.

const SECTION_ID = id => `settings-${id}`;
const stillMotion = () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-a11y-motion'));
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])';

// Bring a setting into view, give its first control the focus (so a keyboard or a screen reader can act on it at once),
// and mark it for a moment.
function reveal(selector, { focus = true } = {}) {
  const element = typeof document === 'undefined' ? null : document.querySelector(selector);
  if (!element) return false;
  const details = element.matches('details') ? element : element.querySelector('details');
  if (details && !details.open && element.dataset.setting === 'location-manual') details.open = true;
  const head = document.querySelector('.shell-head-safe')?.getBoundingClientRect().height || 0;
  const top = element.getBoundingClientRect().top + window.scrollY - head - 16;
  window.scrollTo({ top: Math.max(0, top), behavior: stillMotion() ? 'auto' : 'smooth' });
  if (focus) {
    const control = element.matches(FOCUSABLE) ? element : element.querySelector(FOCUSABLE);
    try { (control || element).focus({ preventScroll: true }); } catch { /* an element that cannot take focus */ }
  }
  element.classList.remove('is-found');
  void element.offsetWidth;
  element.classList.add('is-found');
  setTimeout(() => element.classList.remove('is-found'), 1800);
  return true;
}

function Section({ id, title, hidden, children }) {
  return <section id={SECTION_ID(id)} className={`settings-section settings-${id}-section`} aria-labelledby={`${SECTION_ID(id)}-title`} hidden={hidden}>
    <h2 className="settings-section-title" id={`${SECTION_ID(id)}-title`} tabIndex={-1}>{title}</h2>
    {children}
  </section>;
}

export default function SettingsPage({ route = 'settings', settings, setSettings, theme, setTheme, go }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchSettings(query), [query]);
  const searching = query.trim().length > 0;
  const shown = new Set(matchingSections(results));
  const statusId = useId();
  const resultsId = useId();
  // settings/<section>: open at that section (a deep link, or "שינוי מיקום" on זמנים). After the app's own scroll to
  // the top and its focus on the page title.
  const section = String(route).split('/')[1] || '';
  useEffect(() => {
    if (!SETTINGS_SECTIONS.some(item => item.id === section)) return undefined;
    const timer = setTimeout(() => reveal(`#${SECTION_ID(section)}`, { focus: false }), 260);
    return () => clearTimeout(timer);
  }, [section]);
  const jump = entry => {
    // Show every section again (the one jumped to may be the only match, but its neighbours are context), then go.
    setQuery('');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (reveal(`[data-setting="${entry.id}"]`)) announce(`${entry.title} · ${entry.sectionTitle}`);
    }));
  };
  const jumpSection = id => {
    setQuery('');
    requestAnimationFrame(() => reveal(`#${SECTION_ID(id)}`, { focus: false }) && document.getElementById(`${SECTION_ID(id)}-title`)?.focus({ preventScroll: true }));
  };
  const status = !searching ? '' : results.length ? `${results.length === 1 ? 'הגדרה אחת נמצאה' : `${results.length} הגדרות נמצאו`}` : 'לא נמצאה הגדרה. נסו: מיקום, גופן, צבע';
  return <section className="settings-page" aria-labelledby="settings-title">
    <header className="settings-head">
      <h1 id="settings-title">הגדרות</h1>
      <TitleOrnament />
      <p>נגישות, מיקום, נוסח, צבעים, התראות והאתגר העולמי</p>
    </header>

    <div className="settings-search" role="search" aria-label="חיפוש בהגדרות">
      <ClearableInput deferred type="search" enterKeyHint="search" value={query} onChange={event => setQuery(event.target.value)}
        placeholder="חיפוש בהגדרות…" aria-label="חיפוש בהגדרות" clearLabel="נקה חיפוש" aria-describedby={statusId} aria-controls={resultsId}
        onKeyDown={event => { if (event.key === 'Enter' && results[0]) { event.preventDefault(); jump(results[0]); } }} />
      <p id={statusId} className="settings-search-status" role="status" aria-live="polite">{status}</p>
      <ul id={resultsId} className="settings-results" aria-label="תוצאות החיפוש בהגדרות" hidden={!results.length}>
        {results.map(entry => <li key={entry.id}><button type="button" className="settings-result" onClick={() => jump(entry)}>
          <span className="settings-result-title">{entry.title}</span><span className="settings-result-section">{entry.sectionTitle}</span>
          <ArrowMark className="settings-result-go" />
        </button></li>)}
      </ul>
    </div>

    <nav className="settings-jump" aria-label="מקטעי ההגדרות" hidden={searching && results.length > 0}>
      {SETTINGS_SECTIONS.map(item => <button type="button" key={item.id} onClick={() => jumpSection(item.id)} aria-label={item.title}>{item.short}</button>)}
    </nav>

    <Section id="accessibility" title="נגישות" hidden={searching && !shown.has('accessibility')}>
      <div className="settings-card settings-a11y">
        <AccessibilityControls go={go} headingLevel={3} idPrefix="settings-a11y" />
      </div>
    </Section>

    <Section id="location" title="מיקום" hidden={searching && !shown.has('location')}>
      <div className="settings-card loc-form">
        <div data-setting="location-active"><LocationControl settings={settings} setSettings={setSettings} /></div>
        <div className="ui-field settings-field" data-setting="location-status">
          <span className="ui-field-label" aria-hidden="true">מעמד הלכתי</span>
          <Segmented label="מעמד הלכתי" value={settings.residenceChoice || settings.halachicResidenceStatus || (settings.il ? 'israel' : 'diaspora')} onChange={status => setSettings(s => ({ ...s, halachicResidenceStatus: status, residenceChoice: undefined }))} options={[['israel', 'תושב ישראל'], ['diaspora', 'תושב חו״ל']]} />
          <p className="zman-note">המיקום הפעיל קובע זמנים ואזור זמן. הוא אינו משנה את המעמד ההלכתי שבחרת.</p>
        </div>
        <div data-setting="location-diaspora"><DiasporaIndicator settings={settings} setSettings={setSettings} compact /></div>
        <div data-setting="location-manual"><ManualLocationForm settings={settings} setSettings={setSettings} /></div>
      </div>
    </Section>

    <Section id="nusach" title="נוסח" hidden={searching && !shown.has('nusach')}>
      <div className="settings-card" data-setting="nusach">
        <Selector label="נוסח התפילה" value={settings.nusach || 'edot-hamizrach'} onChange={nusach => setSettings(s => ({ ...s, nusach }))} options={NUSACHIM.map(item => [item.id, item.title, item.subtitle])} />
        <p className="zman-note">נוסח ספרד הוא נוסח החסידים; נוסח עדות המזרח הוא נוסח הספרדים ועדות המזרח. הבחירה משנה את נוסח התפילה ואת סדרה בסידור.</p>
      </div>
    </Section>

    <Section id="theme" title="ערכת צבעים" hidden={searching && !shown.has('theme')}>
      <div className="settings-card" data-setting="theme">
        <ThemePicker theme={theme} setTheme={setTheme} />
      </div>
    </Section>

    <Section id="notifications" title="התראות" hidden={searching && !shown.has('notifications')}>
      <div className="settings-card">
        <Notifications settings={settings} go={go} />
      </div>
    </Section>

    <Section id="challenge" title="האתגר העולמי" hidden={searching && !shown.has('challenge')}>
      <div className="settings-card gc-settings">
        <ChallengeSettings />
      </div>
    </Section>
  </section>;
}

// The eight palettes as a radio group: arrows move the choice (right-to-left: ← is the next one), Home / End, and the
// chosen palette is the one tab stop. Each tile shows its clay — the ground with its copper at the centre.
function ThemePicker({ theme, setTheme }) {
  const groupRef = useRef(null);
  const choose = (id, focus = false) => {
    setTheme(id);
    if (focus) requestAnimationFrame(() => groupRef.current?.querySelector(`[data-theme-id="${id}"]`)?.focus());
  };
  const onKeyDown = event => {
    const index = THEMES.findIndex(([id]) => id === theme);
    const step = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 }[event.key];
    const to = event.key === 'Home' ? 0 : event.key === 'End' ? THEMES.length - 1 : step === undefined ? null : (index + step + THEMES.length) % THEMES.length;
    if (to === null) return;
    event.preventDefault();
    choose(THEMES[to][0], true);
  };
  return <div ref={groupRef} className="settings-themes" role="radiogroup" aria-label="ערכת צבעים" onKeyDown={onKeyDown}>
    {THEMES.map(([id, label]) => {
      const on = id === theme;
      return <button type="button" key={id} role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-theme-id={id} className={`settings-theme${on ? ' is-selected' : ''}`} onClick={() => choose(id)}>
        <span className={`theme-swatch theme-${id}`} aria-hidden="true" />
        <span className="settings-theme-name">{label}</span>
      </button>;
    })}
  </div>;
}

// התראות: whether the device lets the reminders through, every reminder's switch (its details are one tap away, in
// המזכיר היהודי), and the screens that hold the rest — the Jewish clock and נר זיכרון.
function Notifications({ settings, go }) {
  const state = useReminders();
  const active = Object.values(state.smart || {}).filter(item => item?.enabled).length + state.events.filter(entry => entry.eve?.enabled || entry.day?.enabled).length;
  return <>
    <div className="settings-notify-status" data-setting="notify-status">
      <p className="settings-notify-count">{active ? `${active} ${active === 1 ? 'תזכורת פעילה' : 'תזכורות פעילות'}` : 'אין עדיין תזכורת פעילה'}</p>
      <StatusLine state={state} settings={settings} />
      <p className="zman-note">תזכורות שקטות, לעולם לא בשבת ובחג. הפרטים נשמרים במכשיר זה בלבד.</p>
    </div>
    <div data-setting="notify-reminders">
      {REMINDER_GROUPS.map(group => <div className="settings-notify-group" key={group.id} role="group" aria-labelledby={`settings-rem-${group.id}`}>
        <h3 className="eyebrow settings-subtitle" id={`settings-rem-${group.id}`}>{group.title}</h3>
        <div className="settings-rows">
          {group.kinds.map(kind => {
            const meta = kindMeta(kind);
            const config = state.smart?.[kind];
            const on = Boolean(config?.enabled);
            return <div className={`settings-row${on ? ' is-on' : ''}`} key={kind}>
              <button type="button" className="settings-row-text" onClick={() => go(`personal-tools/mazkir/k/${kind}`)} aria-label={`${meta.title}: ${on ? summaryOf(kind, config) : 'כבויה'}. לפרטי התזכורת`}>
                <strong>{meta.title}</strong><small>{on ? summaryOf(kind, config) : meta.description}</small>
              </button>
              <AlarmSwitch checked={on} onChange={enabled => toggleKind(settings, kind, enabled)} label={`${meta.title} — ${on ? 'פעילה' : 'כבויה'}`} />
            </div>;
          })}
        </div>
      </div>)}
    </div>
    <div className="settings-links">
      <button type="button" className="index-row" data-setting="notify-mazkir" onClick={() => go('personal-tools/mazkir')}><span>המזכיר היהודי · תאריכים עבריים ופרטים</span><ArrowMark /></button>
      <button type="button" className="index-row" data-setting="notify-alarm" onClick={() => go('jewish-alarm')}><span>השעון היהודי</span><ArrowMark /></button>
      <button type="button" className="index-row" data-setting="notify-memorial" onClick={() => go('personal-tools/memorial')}><span>נר זיכרון</span><ArrowMark /></button>
    </div>
  </>;
}
