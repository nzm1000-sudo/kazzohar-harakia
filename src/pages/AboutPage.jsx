import { formatGregorianDate } from '../civilDate.mjs';

const BASE = import.meta.env.BASE_URL;
const BUILD_ID = import.meta.env.VITE_BUILD_ID || '6ba84d4';
const BUILD_TIMESTAMP = import.meta.env.VITE_BUILD_TIMESTAMP || 'unknown';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

export default function AboutPage() {
  return <section className="about-page">
    <div className="about-brand">
      <img src={`${BASE}branding/kazzohar-logo-original.jpg`} alt="כזוהר הרקיע" />
    </div>
    <p className="eyebrow">אודות ומקורות</p>
    <h1>כזוהר הרקיע</h1>
    <p className="intro">מרחב עצמאי לזמנים, לוח, תפילה, לימוד ומקורות יהודיים.</p>
    <p className="source-credit">Build: {BUILD_ID} · build time: {BUILD_TIMESTAMP === 'unknown' ? 'unknown' : formatGregorianDate(BUILD_TIMESTAMP)} · version: {APP_VERSION}</p>
    <div className="about-sections">
      <section><h2>על המיזם</h2><p>כזוהר הרקיע הוא מיזם עצמאי. הוא אינו מוצר רשמי, ואינו מציג עצמו כמוצר או כשירות מטעם ספריא, קורן או מוסד שטיינזלץ.</p></section>
      <section><h2>מקורות</h2><p>חלק מן המקורות והטקסטים באפליקציה נגישים באמצעות <a href="https://www.sefaria.org" target="_blank" rel="noreferrer">ספריא</a>. הייחוס והרישיון של כל מהדורה נשמרים בפרטי המקור, לצד קישור למקור החיצוני.</p><p>מקורות ציבוריים ומהדורות נוספות מוצגים לפי הרישיון והמטא־דאטה שלהם.</p></section>
      <section><h2>תלמוד</h2><p>קורא התלמוד כולל את מהדורת ויליאם דוידסון ואת ביאור הרב עדין אבן־ישראל שטיינזלץ, כאשר הם זמינים דרך המקור. יש לשמור על הייחוס ועל תנאי הרישיון המופיעים בפרטי המקור; מהדורות CC-BY-NC מיועדות לשימוש לא־מסחרי עם ייחוס.</p></section>
      <section><h2>רישיונות</h2><p>פתחו את <strong>פרטי מקור</strong> בכל קורא כדי לראות את שם המהדורה, הרישיון, המקור וקישור הנתונים המתאימים לטקסט שנבחר.</p></section>
      <section><h2>פרטיות ואחסון</h2><p>העדפות הערכה, המיקום, אזור הזמן, גודל הקריאה, המועדפים וזיכרון הלימוד נשמרים מקומית במכשיר. אין באפליקציה חשבונות, שרת אישי או איסוף אנליטיקה. גם מטמון האפליקציה נשמר מקומית כדי לאפשר פתיחה חוזרת וחזרה בסיסית ללא רשת.</p><p>בקשות לזמנים, לוח, חיפוש מיקום ומקורות חיצוניים נשלחות לשירותים המתאימים רק כשנדרש לתוכן שביקשתם. המיקום המדויק נשלח רק לאחר בחירה מפורשת ב״המיקום שלי״; חיפוש עיר ידני אינו דורש הרשאת מיקום. מסמך מפת הפרטיות משמש להכנת הצהרות החנות.</p></section>
    </div>
  </section>;
}
