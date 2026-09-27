import { formatGregorianDate } from '../civilDate.mjs';
import { WEATHER_ATTRIBUTION } from '../services/weather.mjs';
import { HOUSE_CREDIT, HOUSE_NAME } from '../data/credits.mjs';
import { LICENSES, PUBLIC_WORKS, SOURCES } from '../data/library/registry.mjs';
import { version as HEBCAL_CORE_VERSION } from '@hebcal/core';

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
// Hebcal: the calendar and zmanim engine (GPL-2.0), with its helper packages. Names, versions, licenses and links are the
// packages' own metadata; the full license texts ship in public/licenses/ and a test pins them to the installed files.
export const HEBCAL_CREDITS = Object.freeze({
  core: { name: '@hebcal/core', version: HEBCAL_CORE_VERSION, license: 'GPL-2.0', author: 'Michael J. Radwin', homepage: 'https://hebcal.github.io/api/core/', repo: 'https://github.com/hebcal/hebcal-es6', licenseFile: 'licenses/hebcal-core-LICENSE.txt' },
  hdate: { name: '@hebcal/hdate', version: '0.22.8', license: 'GPL-2.0', author: 'Michael J. Radwin', repo: 'https://github.com/hebcal/hdate-js', licenseFile: 'licenses/hebcal-hdate-LICENSE.txt' },
  noaa: { name: '@hebcal/noaa', version: '0.12.3', license: 'LGPL-2.1', author: 'Michael J. Radwin', homepage: 'https://hebcal.github.io/api/noaa/', repo: 'https://github.com/hebcal/noaa', licenseFile: 'licenses/hebcal-noaa-LICENSE.txt', note: 'fork of KosherZmanim, a port of KosherJava' },
  project: 'https://www.hebcal.com/',
  // From the package README ("History"): Hebcal was created in 1992 by Danny Sadinoff; the ES6/TypeScript library by Michael J. Radwin.
  history: 'Hebcal נוצר ב־1992 על ידי Danny Sadinoff; הספרייה הנוכחית פותחה על ידי Michael J. Radwin.',
  gpl: 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html',
  lgpl: 'https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html',
});
const SOFTWARE_CREDITS = [
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
    <section className="about-house" aria-label={HOUSE_CREDIT}>
      <NitzotzaMark />
      <span className="about-house-from">מבית</span>
      <strong className="about-house-name">״{HOUSE_NAME}״</strong>
      <span className="about-house-line">יעוץ רוחני אסטרטגי</span>
    </section>
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
        <section className="about-hebcal" aria-label="Hebcal">
          <h3>לוח וזמנים: Hebcal</h3>
          <p>חישובי הלוח העברי והזמנים נעשים בספריית <a href={HEBCAL_CREDITS.project} target="_blank" rel="noreferrer">Hebcal</a>. {HEBCAL_CREDITS.history}</p>
          <ul>{[HEBCAL_CREDITS.core, HEBCAL_CREDITS.hdate, HEBCAL_CREDITS.noaa].map(pkg => <li key={pkg.name}><strong>{pkg.name}</strong> {pkg.version} · {pkg.author} · <a href={pkg.license.startsWith('LGPL') ? HEBCAL_CREDITS.lgpl : HEBCAL_CREDITS.gpl} target="_blank" rel="noreferrer">{pkg.license}</a> · <a href={`${BASE}${pkg.licenseFile}`} target="_blank" rel="noreferrer">נוסח הרישיון</a> · <a href={pkg.homepage || pkg.repo} target="_blank" rel="noreferrer">אתר</a> · <a href={pkg.repo} target="_blank" rel="noreferrer">קוד</a>{pkg.note ? ` · ${pkg.note}` : ''}</li>)}</ul>
          <p className="source-credit">האפליקציה חינמית לצמיתות. קוד המקור שלה פתוח: <a href="https://github.com/nzm1000-sudo/kazzohar-harakia" target="_blank" rel="noreferrer">github.com/nzm1000-sudo/kazzohar-harakia</a>.</p>
        </section>
        <section className="about-scans" aria-label="צורת הדף">
          <h3>צורת הדף בתלמוד</h3>
          <p>סריקות הדפים מוצגות דרך ממשק כתבי היד של ספריא, לפי הסדר: דפוס וילנא; ובדפים שאין להם סריקת וילנא (כל מסכת נדה ודפים בודדים) — דפוס ונציה; ואם גם הוא חסר — כתב יד מינכן.</p>
          <ul>
            <li>דפוס וילנא, האלמנה והאחים ראם (1880–1886) · הספרייה הלאומית</li>
            <li>דפוס ונציה, דניאל בומברג (1523) · הספרייה הלאומית</li>
            <li>כתב יד מינכן 95 (1342) · הספרייה הממלכתית של בוואריה</li>
            <li>דפים בודדים מדפוס וילנא · Wikimedia Commons</li>
          </ul>
          <p>הדפוסים וכתב היד הם נחלת הכלל; הסריקות באדיבות הספריות המחזיקות, דרך ספריא.</p>
        </section>
        <section className="about-weather" aria-label="Open-Meteo">
          <h3>מזג אוויר: Open-Meteo</h3>
          <p lang="en" dir="ltr">Weather data by <a href={WEATHER_ATTRIBUTION.url} target="_blank" rel="noreferrer">Open-Meteo.com</a></p>
          <ul>
            <li>הנתונים: <a href={WEATHER_ATTRIBUTION.url} target="_blank" rel="noreferrer">Open-Meteo</a> — ממשק פתוח וחינמי לתחזיות מזג אוויר.</li>
            <li>הרישיון: <a href={WEATHER_ATTRIBUTION.licenseUrl} target="_blank" rel="noreferrer">{WEATHER_ATTRIBUTION.license}</a> (Creative Commons ייחוס 4.0). הנתונים מוצגים כפי שהתקבלו, בעיגול למעלה שלמה.</li>
            <li>המקורות: מודלים מטאורולוגיים של שירותי מזג אוויר לאומיים, שמ־Open-Meteo מאחד; <a href={WEATHER_ATTRIBUTION.sourcesUrl} target="_blank" rel="noreferrer">רשימת המקורות והתנאים המלאה</a>.</li>
            <li>הפרטיות: נשלחות רק הקואורדינטות של המקום שבחרתם, מעוגלות לכקילומטר. הקריאה האחרונה נשמרת במכשיר בלבד.</li>
          </ul>
        </section>
        <section className="about-house-credit" aria-label="קרדיט">
          <h3>קרדיט</h3>
          <p>כזוהר הרקיע · {HOUSE_CREDIT}</p>
        </section>
        <details className="about-credits"><summary>תוכנה וגופנים</summary>
          <ul>{SOFTWARE_CREDITS.map(([name, role, license, url]) => <li key={name}><a href={url} target="_blank" rel="noreferrer">{name}</a> · {role} · {license}</li>)}</ul>
        </details>
      </section>
      <section><h2>פרטיות ואחסון</h2><p><a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">מדיניות הפרטיות המלאה</a> · אין חשבונות, אין אנליטיקה, אין שרת שאוסף מידע.</p><p>העדפות הערכה, המיקום, אזור הזמן, גודל הקריאה, המועדפים וזיכרון הלימוד נשמרים מקומית במכשיר. אין באפליקציה חשבונות, שרת אישי או איסוף אנליטיקה. גם מטמון האפליקציה נשמר מקומית כדי לאפשר פתיחה חוזרת וחזרה בסיסית ללא רשת.</p><p>בקשות לזמנים, לוח, מזג אוויר, חיפוש מיקום ומקורות חיצוניים נשלחות לשירותים המתאימים רק כשנדרש לתוכן שביקשתם. המיקום המדויק נשלח רק לאחר בחירה מפורשת ב״המיקום שלי״; חיפוש עיר ידני אינו דורש הרשאת מיקום.</p></section>
    </div>
  </section>;
}

// The ניצוצא mark, redrawn as a vector from the house logo: five evenly spaced rings around a spark, very faint,
// lightest at the centre and deepening outward so the words stay clear; the outer ring just encloses the credit.
const NITZOTZA_RINGS = [[20, 0.05], [40, 0.075], [60, 0.1], [80, 0.125], [100, 0.15]];
function NitzotzaMark() {
  return <svg className="about-house-mark" viewBox="-102 -102 204 204" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="nitzotza-spark"><stop offset="0" stopColor="var(--accent)" stopOpacity=".16" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></radialGradient>
      <radialGradient id="nitzotza-spark-glow"><stop offset="0" stopColor="#ffe9a8" stopOpacity=".85" /><stop offset=".35" stopColor="#e2b44a" stopOpacity=".35" /><stop offset="1" stopColor="#c9962e" stopOpacity="0" /></radialGradient>
      <radialGradient id="nitzotza-spark-core" cx=".4" cy=".35"><stop offset="0" stopColor="#fffbea" /><stop offset=".45" stopColor="#f3cf6b" /><stop offset="1" stopColor="#b8862a" /></radialGradient>
    </defs>
    <circle r="30" fill="url(#nitzotza-spark)" className="nitzotza-spark" />
    {NITZOTZA_RINGS.map(([r, strength], index) => <circle key={r} r={r} className="nitzotza-ring" style={{ '--ring': strength, animationDelay: `${index * 2}s` }} />)}
    {/* A single gold spark travels the outer ring, very slowly, trailing three tiny twinkles. */}
    <g className="nitzotza-orbit">
      {/* SVG's own rotation, about the rings' centre (0,0) — exact in every engine; absent under reduced motion. */}
      {!prefersReducedMotion() && <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="26s" repeatCount="indefinite" />}
      <circle cx="100" cy="0" r="7" fill="url(#nitzotza-spark-glow)" className="nitzotza-spark-halo" />
      <circle cx="99.25" cy="-12.19" r="1.3" className="nitzotza-spark-trail t1" style={{ '--trail': 0.55 }} />
      <circle cx="97.44" cy="-22.50" r="1.0" className="nitzotza-spark-trail t2" style={{ '--trail': 0.38 }} />
      <circle cx="94.55" cy="-32.56" r="0.75" className="nitzotza-spark-trail t3" style={{ '--trail': 0.22 }} />
      <circle cx="100" cy="0" r="2.3" fill="url(#nitzotza-spark-core)" className="nitzotza-spark-core" />
    </g>
  </svg>;
}

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
