import { formatGregorianDate } from '../civilDate.mjs';
import { LICENSES, PUBLIC_WORKS, SOURCES } from '../data/library/registry.mjs';

const BASE = import.meta.env.BASE_URL;
const BUILD_ID = import.meta.env.VITE_BUILD_ID || '6ba84d4';
const BUILD_TIMESTAMP = import.meta.env.VITE_BUILD_TIMESTAMP || 'unknown';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
// The privacy policy is published at a stable public address (the same text ships as public/privacy.html).
export const PRIVACY_POLICY_URL = 'https://nzm1000-sudo.github.io/kazzohar-harakia/privacy.html';
const SOURCE_TITLE = { sefaria: 'ספריא', 'tanach-us': 'Tanach.us (UXLC)', 'torat-emet': 'תורת אמת' };
const LICENSE_TITLE = { 'public-domain': 'נחלת הכלל', 'uxlc-free': 'שימוש חופשי (UXLC)', 'cc-by': 'CC BY', 'cc-by-sa': 'CC BY-SA', 'cc-by-nc': 'CC BY-NC', 'cc-by-nc-sa': 'CC BY-NC-SA' };
// Every edition the library shows, grouped: edition · source · license · how many books. Built from the registry,
// so the credits stay true to what is actually bundled or fetched.
export function editionCredits(works = PUBLIC_WORKS) {
  const groups = new Map();
  for (const work of works) for (const edition of work.editions) {
    const title = (edition.heTitle && edition.heTitle !== 'UNKNOWN' ? edition.heTitle : edition.title) || 'מהדורה';
    const key = `${edition.sourceProvider}|${edition.license}|${title}`;
    const group = groups.get(key) || { title, source: SOURCE_TITLE[edition.sourceProvider] || SOURCES[edition.sourceProvider]?.title || edition.sourceProvider, license: LICENSE_TITLE[edition.license] || LICENSES[edition.license]?.title || edition.license, works: 0 };
    group.works += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.works - a.works || a.title.localeCompare(b.title, 'he'));
}
const SOFTWARE_CREDITS = [
  ['@hebcal/core', 'חישובי לוח וזמנים', 'GPL-2.0', 'https://github.com/hebcal/hebcal-es6'],
  ['React', 'ממשק', 'MIT', 'https://react.dev'],
  ['Capacitor', 'עטיפה ל־iOS ול־Android', 'MIT', 'https://capacitorjs.com'],
  ['Heebo · Noto Sans Hebrew · Noto Serif Hebrew', 'גופנים', 'SIL Open Font License 1.1', 'https://fontsource.org'],
];

export default function AboutPage({ onNav }) {
  return <section className="about-page">
    <div className="about-brand">
      <img src={`${BASE}branding/kazzohar-logo-original.jpg`} alt="כזוהר הרקיע" />
    </div>
    <p className="eyebrow">אודות ומקורות</p>
    <h1>כזוהר הרקיע</h1>
    <p className="intro">מרחב עצמאי לזמנים, לוח, תפילה, לימוד ומקורות יהודיים.</p>
    <p className="source-credit">גרסה {APP_VERSION}{import.meta.env.DEV ? ` · Build: ${BUILD_ID} · build time: ${BUILD_TIMESTAMP === 'unknown' ? 'unknown' : formatGregorianDate(BUILD_TIMESTAMP)}` : ''}</p>
    {import.meta.env.DEV && onNav && <button type="button" className="ghost" onClick={() => onNav('debug/jewish-context')}>אבחון הקשר יהודי</button>}
    <div className="about-sections">
      <section><h2>על המיזם</h2><p>כזוהר הרקיע הוא מיזם עצמאי. הוא אינו מוצר רשמי, ואינו מציג עצמו כמוצר או כשירות מטעם ספריא, קורן או מוסד שטיינזלץ.</p></section>
      <section><h2>מקורות</h2><p>חלק מן המקורות והטקסטים באפליקציה נגישים באמצעות <a href="https://www.sefaria.org" target="_blank" rel="noreferrer">ספריא</a>. הייחוס והרישיון של כל מהדורה נשמרים בפרטי המקור, לצד קישור למקור החיצוני.</p><p>מקורות ציבוריים ומהדורות נוספות מוצגים לפי הרישיון והמטא־דאטה שלהם.</p></section>
      <section><h2>תלמוד</h2><p>קורא התלמוד כולל את מהדורת ויליאם דוידסון ואת ביאור הרב עדין אבן־ישראל שטיינזלץ, כאשר הם זמינים דרך המקור. יש לשמור על הייחוס ועל תנאי הרישיון המופיעים בפרטי המקור; מהדורות CC-BY-NC מיועדות לשימוש לא־מסחרי עם ייחוס.</p></section>
      <section><h2>מהדורות ורישיונות</h2>
        <p>בקוראי הסידור והמקורות מופיעים בתחתית הקטע שם המהדורה, הרישיון וקישור למקור. כל המהדורות שבספרייה, לפי מקור ורישיון:</p>
        <details className="about-credits"><summary>כל המהדורות ({editionCredits().length})</summary>
          <ul>{editionCredits().map(item => <li key={`${item.title}-${item.source}-${item.license}`}><strong>{item.title}</strong> · {item.source} · {item.license} · {item.works === 1 ? 'ספר אחד' : `${item.works} ספרים`}</li>)}</ul>
        </details>
        <details className="about-credits"><summary>תוכנה וגופנים</summary>
          <ul>{SOFTWARE_CREDITS.map(([name, role, license, url]) => <li key={name}><a href={url} target="_blank" rel="noreferrer">{name}</a> · {role} · {license}</li>)}</ul>
        </details>
      </section>
      <section><h2>פרטיות ואחסון</h2><p><a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">מדיניות הפרטיות המלאה</a> · אין חשבונות, אין אנליטיקה, אין שרת שאוסף מידע.</p><p>העדפות הערכה, המיקום, אזור הזמן, גודל הקריאה, המועדפים וזיכרון הלימוד נשמרים מקומית במכשיר. אין באפליקציה חשבונות, שרת אישי או איסוף אנליטיקה. גם מטמון האפליקציה נשמר מקומית כדי לאפשר פתיחה חוזרת וחזרה בסיסית ללא רשת.</p><p>בקשות לזמנים, לוח, חיפוש מיקום ומקורות חיצוניים נשלחות לשירותים המתאימים רק כשנדרש לתוכן שביקשתם. המיקום המדויק נשלח רק לאחר בחירה מפורשת ב״המיקום שלי״; חיפוש עיר ידני אינו דורש הרשאת מיקום.</p></section>
    </div>
  </section>;
}
