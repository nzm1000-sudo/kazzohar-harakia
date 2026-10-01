import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from './a11yPrimitives.jsx';
import { CloseButton } from './ui/IconButton.jsx';
import TitleOrnament from './ui/TitleOrnament.jsx';

const BASE = import.meta.env.BASE_URL;

// Four paragraphs, each set apart by the shared gold ornament (TitleOrnament, as under the name); the closing prayer stands alone, centred.
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
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  // Focus starts on the close button, Tab stays in the dedication, the page behind is inert, Escape closes, and focus
  // returns to the entry that opened it.
  useModalFocus(dialogRef, open, () => setOpen(false), { initialFocus: '.memorial-close' });

  useEffect(() => {
    if (!open) return undefined;
    const scrollY = window.scrollY;
    const previous = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    const onKeyDown = event => { if (event.key === 'Escape') setOpen(false); };
    const onNativeBack = () => setOpen(false);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('kz-native-close-overlay', onNativeBack);
    return () => {
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
        {/* A still, framed card on the centre axis: the sapling, the dedication and the name, a gold double frame. */}
        <img src={`${BASE}branding/zehavit-memorial-branch.png?v=1`} alt="" aria-hidden="true" />
        <small>לעילוי נשמת אמנו</small>
        <strong>הרבנית זהבית זוהרה <span className="nowrap">בת אסתר ע״ה</span></strong>
      </button>
      {/* The sheet lives on <body> (a portal): no transformed or clipped ancestor of the Today page can shift it or take
          its taps. The close sits on the still frame, outside the scrolling words — never inside the sticky header,
          where iOS WebKit can leave its hit area behind once the words have scrolled. */}
      {open && createPortal(
        <div className="memorial-backdrop" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="memorial-dialog" role="dialog" aria-modal="true" aria-labelledby="memorial-title" ref={dialogRef}>
            <CloseButton buttonRef={closeRef} className="memorial-close" variant="framed" label="סגירת ההקדשה" onClick={() => setOpen(false)} />
            {/* A gold frame that stays put; inside it the words scroll up beneath the portrait and title, which stay in view. */}
            <div className="memorial-scroll">
            <header className="memorial-header">
              {/* A quiet cameo: sketch lines only (transparent paper), thin gold frame, centred. */}
              <figure className="memorial-portrait"><img src={`${BASE}branding/zehavit-portrait.png?v=1`} alt="דיוקן הרבנית זהבית זוהרה בת אסתר ע״ה" /></figure>
              <p>לעילוי נשמת אמנו</p>
              <h2 id="memorial-title">הרבנית זהבית זוהרה <span className="nowrap">בת אסתר ע״ה</span></h2>
              <TitleOrnament className="memorial-ornament" />
            </header>
            <div className="memorial-reading">
              {PARAGRAPHS.map((paragraph, index) => <Fragment key={paragraph}>{index > 0 && <TitleOrnament className="memorial-mark" />}<p>{paragraph}</p></Fragment>)}
              <TitleOrnament className="memorial-mark" />
              <p className="memorial-closing">{CLOSING.map(line => <span key={line}>{line}</span>)}<strong>אמן.</strong></p>
            </div>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
