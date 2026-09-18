import { useEffect, useRef, useState } from 'react';

const BASE = import.meta.env.BASE_URL;

const PARAGRAPHS = [
  'הרבנית זהבית זוהרה בת אסתר ע״ה הייתה אשת חסד מיוחדת בדורנו — צנועה ועוצמתית, שהקפידה על שמירת המצוות במסירות ובדקדוק יוצאי דופן.',
  'היא הקדישה מעצמה ומזמנה היקר לנשים רבות בכל שעה שנזקקו לה, גם בשעות לא שגרתיות, במסירות ובהקרבה אישית. כאמא וכמגדלור לסובבים אותה, הייתה אוהבת, דואגת ושומרת.',
  'הרבנית הצטיינה בצניעות ובפשטות, ואף נהגה בסגפנות בענייני מאכל וקדושה. הקפדתה על כשרות ועל חסד הייתה מיוחדת ועמוקה. בדרך עבודת ה׳ שלה לימדה אותנו יסודות רוחניים, שממשיכים להשפיע וילוו בעזרת ה׳ דורות רבים.',
  'יותר מכל, חייה היו חיים של זיכוי הרבים — נתינה, מצוות וחסד שהשפיעו על משפחות רבות. אלפי נשים ואנשים חשים שבזכות מעשיה העולם נעשה מקום טוב ומוגן יותר, ואורה הנדיר ממשיך לפעום במעשים הטובים שהותירה אחריה.',
  'זכרה ברוך ומבורך. תהא נשמת הרבנית זהבית זוהרה בת אסתר ע״ה צרורה בצרור החיים, וזכותה תגן עלינו ועל כל עם ישראל. אמן.',
];

export default function MemorialTribute() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const scrollY = window.scrollY;
    const previous = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    const focusFrame = requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      Object.assign(document.body.style, previous);
      window.scrollTo(0, scrollY);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} className="memorial-entry" type="button" onClick={() => setOpen(true)} aria-label="פתיחת הקדשה לזכר הרבנית זהבית זוהרה בת אסתר ע״ה">
        <img src={`${BASE}branding/zehavit-memorial-branch.png?v=1`} alt="" aria-hidden="true" />
        <span><small>לעילוי נשמת אמנו</small><strong>הרבנית זהבית זוהרה בת אסתר ע״ה</strong></span>
        <span className="memorial-entry-mark" aria-hidden="true">←</span>
      </button>
      {open && (
        <div className="memorial-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="memorial-dialog" role="dialog" aria-modal="true" aria-labelledby="memorial-title">
            <button ref={closeRef} className="memorial-close" type="button" onClick={() => setOpen(false)} aria-label="סגירת ההקדשה">×</button>
            <header className="memorial-header">
              <img src={`${BASE}branding/zehavit-memorial-branch.png?v=1`} alt="" aria-hidden="true" />
              <p>לעילוי נשמת אמנו</p>
              <h2 id="memorial-title">הרבנית זהבית זוהרה בת אסתר ע״ה</h2>
            </header>
            <div className="memorial-reading">
              {PARAGRAPHS.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
