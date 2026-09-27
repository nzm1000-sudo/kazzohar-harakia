import { Fragment, useEffect, useRef, useState } from 'react';

const BASE = import.meta.env.BASE_URL;

// Four paragraphs, each set apart by a small gold ornament; the closing prayer stands alone, centred.
const PARAGRAPHS = [
  'הרבנית זהבית זוהרה בת אסתר ע״ה הייתה אשת חסד מיוחדת בדורנו: צנועה ועוצמתית, ושומרת מצוות במסירות ובדקדוק יוצאי דופן.',
  'הרבנית הקדישה מעצמה ומזמנה היקר לנשים רבות, בכל שעה שנזקקו לה — גם בשעות שאינן שגרתיות — במסירות ובהקרבה אישית. כאם וכמגדלור לסובבים אותה, הייתה אוהבת, דואגת ושומרת.',
  'הרבנית הצטיינה בצניעות ובפשטות, ואף נהגה בסגפנות בענייני מאכל וקדושה. הקפדתה על הכשרות ועל החסד הייתה מיוחדת ועמוקה. בדרך עבודת ה׳ שלה לימדה אותנו יסודות רוחניים, הממשיכים להשפיע וילוו, בעזרת ה׳, דורות רבים.',
  'יותר מכול, חייה היו חיים של זיכוי הרבים: נתינה, מצוות וחסד שהשפיעו על משפחות רבות. אלפי נשים ואנשים חשים שבזכות מעשיה נעשה העולם מקום טוב ומוגן יותר, ואורה הנדיר ממשיך לפעום במעשים הטובים שהותירה אחריה.',
];
const CLOSING = [
  'זכרה ברוך ומבורך.',
  'תהא נשמת הרבנית זהבית זוהרה בת אסתר ע״ה',
  'צרורה בצרור החיים,',
  'וזכותה תגן עלינו ועל כל עם ישראל.',
];

export default function MemorialTribute() {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => { if (!open) setCompact(false); }, [open]);
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
    const onNativeBack = () => setOpen(false);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('kz-native-close-overlay', onNativeBack);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('kz-native-close-overlay', onNativeBack);
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
            {/* A gold frame that stays put; inside it the words scroll up beneath the portrait and title, which stay in view. */}
            <div className="memorial-scroll" onScroll={event => setCompact(event.currentTarget.scrollTop > 24)}>
            <header className={`memorial-header${compact ? ' is-compact' : ''}`}>
              <button ref={closeRef} className="memorial-close" type="button" onClick={() => setOpen(false)} aria-label="סגירת ההקדשה">×</button>
              {/* A quiet cameo: sketch lines only (transparent paper), thin gold frame, centred. */}
              <figure className="memorial-portrait"><img src={`${BASE}branding/zehavit-portrait.png?v=1`} alt="דיוקן הרבנית זהבית זוהרה בת אסתר ע״ה" /></figure>
              <p>לעילוי נשמת אמנו</p>
              <h2 id="memorial-title">הרבנית זהבית זוהרה <span className="nowrap">בת אסתר ע״ה</span></h2>
            </header>
            <div className="memorial-reading">
              {PARAGRAPHS.map((paragraph, index) => <Fragment key={paragraph}>{index > 0 && <span className="memorial-divider" aria-hidden="true" />}<p>{paragraph}</p></Fragment>)}
              <span className="memorial-divider" aria-hidden="true" />
              <p className="memorial-closing">{CLOSING.map(line => <span key={line}>{line}</span>)}<strong>אמן.</strong></p>
            </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
