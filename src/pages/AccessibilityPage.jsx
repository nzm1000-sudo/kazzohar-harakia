import { useEffect, useState } from 'react';
import { BackNavigation } from '../components/LocalNavigation.jsx';
import { AlarmSwitch, Segmented } from '../components/jewishAlarm/AlarmParts.jsx';
import { useAccessibilityPreferences } from '../services/accessibility/runtime.mjs';
import { LINE_SPACINGS, TEXT_SIZES, getPreferences, readSystem, resetPreferences } from '../services/accessibility/preferences.mjs';
import { announce } from '../components/a11yPrimitives.jsx';
import { CONTACT_EMAIL, mailtoHref } from '../services/contact.mjs';

// נגישות — one discreet section of the settings (הגדרות › נגישות). Every change applies at once, is kept on the
// device, and can be undone with one button ("איפוס להגדרות המכשיר"). The statement (הצהרת נגישות) is its own page.
// Routes: accessibility | accessibility/statement
export const ACCESSIBILITY_REVIEWED = '2026-09-30';

function Row({ title, description, children, id }) {
  return <div className="a11y-row">
    <div className="a11y-row-text"><span id={id} className="a11y-row-title">{title}</span>{description && <small>{description}</small>}</div>
    {children}
  </div>;
}

function Toggle({ title, description, checked, onChange }) {
  return <Row title={title} description={description}><AlarmSwitch checked={checked} onChange={onChange} label={title} /></Row>;
}

// A report the reader can send through any app they choose (mail, messages…): what happened, and the settings in use.
// Nothing is sent by the app, and no address is built into it.
function reportText() {
  const prefs = getPreferences();
  const system = readSystem();
  const settings = [
    `התאמה אוטומטית: ${prefs.auto ? 'פעיל' : 'כבוי'}`,
    `גודל טקסט: ${TEXT_SIZES.find(([id]) => id === prefs.textSize)?.[1] || prefs.textSize}`,
    `מרווח שורות: ${LINE_SPACINGS.find(([id]) => id === prefs.lineSpacing)?.[1] || prefs.lineSpacing}`,
    prefs.bold && 'טקסט מודגש', prefs.contrast && 'ניגודיות גבוהה', prefs.transparency && 'הפחתת שקיפות', prefs.motion && 'הפחתת תנועה',
    !prefs.haptics && 'משוב מישושי כבוי', prefs.focusedReading && 'קריאה ממוקדת',
    system.reduceMotion && 'המכשיר: הפחתת תנועה', system.moreContrast && 'המכשיר: ניגודיות מוגברת', system.reduceTransparency && 'המכשיר: הפחתת שקיפות',
  ].filter(Boolean).join(' · ');
  return `דיווח על בעיית נגישות — כּזוהר הרקיע\n\nמה ניסיתי לעשות:\n\nמה קרה:\n\nבאיזה מסך:\n\nטכנולוגיה מסייעת (VoiceOver, TalkBack, הגדלה…):\n\nהגדרות הנגישות באפליקציה: ${settings}\nמכשיר: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`;
}

// The report goes by e-mail to the address in "יצירת קשר" (אודות), with the subject and a short form filled in; for a
// device without mail, the same form can still be shared or copied (the share sheet, then the clipboard).
export const REPORT_SUBJECT = 'דיווח על בעיית נגישות';
function ReportButton() {
  const [state, setState] = useState('idle');
  let href = mailtoHref({ subject: REPORT_SUBJECT });
  try { href = mailtoHref({ subject: REPORT_SUBJECT, body: reportText() }); } catch { /* the subject alone */ }
  const share = async () => {
    const text = reportText();
    try {
      if (navigator.share) { await navigator.share({ title: REPORT_SUBJECT, text }); setState('shared'); return; }
    } catch (error) { if (error?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); setState('copied'); announce('טופס הדיווח הועתק'); } catch { setState('failed'); }
  };
  return <>
    <a className="index-row a11y-link" href={href}><span>דיווח על בעיית נגישות</span><span aria-hidden="true">←</span></a>
    <button type="button" className="index-row a11y-link a11y-link-quiet" onClick={share}><span>שיתוף או העתקה של טופס הדיווח</span><span aria-hidden="true">←</span></button>
    <p className="zman-note a11y-contact-note">הדיווח נשלח אל <bdi dir="ltr">{CONTACT_EMAIL}</bdi>. פרטי הקשר מופיעים גם ב״יצירת קשר״ בעמוד האודות.</p>
    {state === 'copied' && <p className="zman-note" role="status">טופס הדיווח הועתק. אפשר להדביק אותו בכל הודעה.</p>}
    {state === 'failed' && <p className="zman-note" role="alert">לא ניתן היה לפתוח את השיתוף במכשיר הזה.</p>}
  </>;
}

export default function AccessibilityPage({ route = 'accessibility', go }) {
  if (route === 'accessibility/statement') return <AccessibilityStatement go={go} />;
  return <AccessibilitySettings go={go} />;
}

function AccessibilitySettings({ go }) {
  const [prefs, update] = useAccessibilityPreferences();
  const [resetDone, setResetDone] = useState(false);
  useEffect(() => { setResetDone(false); }, [prefs]);
  const reset = () => { resetPreferences(); setResetDone(true); announce('ההגדרות הוחזרו להגדרות המכשיר'); };
  return <section className="profile-form a11y-settings" aria-labelledby="a11y-title">
    <BackNavigation label="חזרה להגדרות" onClick={() => (Number(history.state?.kzDepth) > 0 ? history.back() : go('settings'))} />
    <h1 id="a11y-title">נגישות</h1>

    <div className="a11y-group">
      <Toggle title="התאמה אוטומטית למכשיר" description="כּזוהר הרקיע מתאימה את עצמה להגדרות הנגישות של המכשיר שלך." checked={prefs.auto} onChange={value => update({ auto: value })} />
    </div>

    <h2 className="eyebrow a11y-group-title" id="a11y-display">תצוגה וקריאה</h2>
    <div className="a11y-group" role="group" aria-labelledby="a11y-display">
      <label className="a11y-row a11y-row-select">
        <span className="a11y-row-text"><span className="a11y-row-title">גודל טקסט</span><small>„מערכת״ עוקב אחר גודל הטקסט שנבחר במכשיר.</small></span>
        <select value={prefs.textSize} onChange={event => update({ textSize: event.target.value })}>
          {TEXT_SIZES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <Row title="מרווח שורות" id="a11y-spacing-title"><Segmented value={prefs.lineSpacing} options={LINE_SPACINGS} onChange={value => update({ lineSpacing: value })} label="מרווח שורות" className="a11y-seg" /></Row>
      <Toggle title="טקסט מודגש" checked={prefs.bold} onChange={value => update({ bold: value })} />
      <Toggle title="ניגודיות גבוהה" description="צבעים עמוקים יותר, קווים ברורים וקישורים מסומנים בקו תחתון." checked={prefs.contrast} onChange={value => update({ contrast: value })} />
      <Toggle title="הפחתת שקיפות" description="משטחים שקופים למחצה הופכים אטומים." checked={prefs.transparency} onChange={value => update({ transparency: value })} />
    </div>

    <h2 className="eyebrow a11y-group-title" id="a11y-motion">תנועה ומשוב</h2>
    <div className="a11y-group" role="group" aria-labelledby="a11y-motion">
      <Toggle title="הפחתת תנועה" description="כשהמכשיר מבקש להפחית תנועה, האפליקציה נענית לכך תמיד." checked={prefs.motion} onChange={value => update({ motion: value })} />
      <Toggle title="משוב מישושי" description="רטט קל בלחיצה על מתגים. משוב הכרחי (כמו מציאת כיוון התפילה) נשאר." checked={prefs.haptics} onChange={value => update({ haptics: value })} />
    </div>

    <h2 className="eyebrow a11y-group-title" id="a11y-reading">קריאה</h2>
    <div className="a11y-group" role="group" aria-labelledby="a11y-reading">
      <Toggle title="קריאה ממוקדת" description="במסכי הקריאה: פחות קישוטים והערות צד, ושורות ברוחב נוח. הטקסט והפעולות נשארים." checked={prefs.focusedReading} onChange={value => update({ focusedReading: value })} />
    </div>

    <div className="a11y-group a11y-actions">
      <button type="button" className="a11y-reset" onClick={reset}>איפוס להגדרות המכשיר</button>
      {resetDone && <p className="zman-note" role="status">ההגדרות הוחזרו להגדרות המכשיר.</p>}
    </div>

    <div className="a11y-group a11y-links">
      <button type="button" className="index-row a11y-link" onClick={() => go('accessibility/statement')}><span>הצהרת נגישות</span><span aria-hidden="true">←</span></button>
      <ReportButton />
    </div>
  </section>;
}

// הצהרת נגישות: what the app does, what it does not yet do, and how to tell us. No claim of full conformance.
function AccessibilityStatement({ go }) {
  return <article className="profile-form a11y-statement" aria-labelledby="a11y-statement-title">
    <BackNavigation label="חזרה לנגישות" onClick={() => (Number(history.state?.kzDepth) > 0 ? history.back() : go('accessibility'))} />
    <h1 id="a11y-statement-title">הצהרת נגישות</h1>
    <p className="zman-note">עודכנה לאחרונה: {new Date(`${ACCESSIBILITY_REVIEWED}T12:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <p>כּזוהר הרקיע נבנית כך שכל אחד יוכל להתפלל, ללמוד ולקרוא בה. אנחנו פועלים לשפר את הנגישות באופן מתמשך, ובודקים אותה בכלים אוטומטיים ובבדיקה ידנית. האפליקציה אינה מצהירה על עמידה מלאה בתקן נגישות.</p>
    <h2>מה נתמך</h2>
    <ul>
      <li>התאמה להגדרות המכשיר: גודל הטקסט של המערכת, הפחתת תנועה, ניגודיות מוגברת והפחתת שקיפות.</li>
      <li>הגדרות באפליקציה: גודל טקסט עד 200%, מרווח שורות, טקסט מודגש, ניגודיות גבוהה, הפחתת שקיפות, הפחתת תנועה, כיבוי משוב מישושי וקריאה ממוקדת.</li>
      <li>קוראי מסך: שמות, תפקידים ומצבים לפקדים, כותרות וציוני דרך במסכי הקריאה, ומעבר מיקוד לחלונות ולכותרת המסך.</li>
      <li>שדות חיפוש עם תווית קבועה וכפתור „נקה חיפוש״, והקלדה שאינה ממתינה לתוצאות.</li>
      <li>אזורי מגע של 44 נקודות לפחות, וחלופה בלחיצה לכל פעולה של גרירה או החלקה.</li>
      <li>ניווט במקלדת חיצונית.</li>
    </ul>
    <h2>מגבלות ידועות</h2>
    <ul>
      <li>הקראת טקסט מנוקד ומוטעם בקוראי מסך תלויה בקול העברי של המכשיר; ניקוד וטעמים עלולים להיקרא באופן חלקי.</li>
      <li>צורות שם ה׳ נכתבות כפי שהן בנוסח, ואינן מוקראות תמיד כפי שנוהגים לומר אותן.</li>
      <li>טקסטים הנטענים מהרשת (ספריא) מוצגים כפי שהם במקור.</li>
      <li>הבדיקה במכשירים עם VoiceOver ו־TalkBack עדיין לא הושלמה בכל המסכים.</li>
    </ul>
    <h2>דיווח על בעיה</h2>
    <p>נתקלת בקושי? אפשר לשלוח דיווח מתוך מסך הנגישות („דיווח על בעיית נגישות״): נפתחת הודעת דואר אל <a className="link" href={mailtoHref({ subject: REPORT_SUBJECT })} dir="ltr">{CONTACT_EMAIL}</a> ובה טופס קצר; אפשר גם לשתף או להעתיק את הטופס ולשלוח אותו בכל דרך אחרת.</p>
    <p>אפשר לפנות אלינו גם דרך ״יצירת קשר״ בעמוד האודות — בדואר או בטלפון.</p>
  </article>;
}
