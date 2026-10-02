import { useState } from 'react';
import TitleOrnament from '../components/ui/TitleOrnament.jsx';
import { CloseButton, IconButton, Selector, TextSizeControl, Switch, SegmentedControl, SearchField, BackButton } from '../components/ui/index.js';
import { PlusGlyph } from '../components/ui/Glyphs.jsx';
import HeartToggle from '../components/HeartToggle.jsx';
import { ClayIcon, CLAY_GLYPHS } from '../components/ui/ClayIcon.jsx';

// CLAY · the primitives gallery (#debug/clay) — every shared body in every state, for visual QA in all eight palettes.
// Dev server only (NewApp renders it under import.meta.env.DEV); never part of a build.
export default function ClayGallery() {
  const [seg, setSeg] = useState('a');
  const [ja, setJa] = useState('day');
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [pick, setPick] = useState('ashkenaz');
  const [chip, setChip] = useState('all');
  const [text, setText] = useState('תהילים');
  return <div className="clay-gallery" style={{ display: 'grid', gap: 22 }}>
    <BackButton label="חזרה להיום" onClick={() => history.back()} />
    <header style={{ textAlign: 'center' }}><p className="eyebrow">CLAY</p><h1>הגלריה</h1><TitleOrnament /></header>

    <section className="clay-card" style={{ padding: 16, display: 'grid', gap: 12 }} aria-label="סמלים">
      <h2>סמלים</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, justifyItems: 'center' }}>
        {Object.keys(CLAY_GLYPHS).map(name => <span key={name} className="clay-tile" style={{ display: 'grid', placeItems: 'center', width: 46, height: 46 }} title={name}><ClayIcon name={name} size={26} /></span>)}
      </div>
    </section>

    <section className="clay-card" style={{ padding: 16, display: 'grid', gap: 12, justifyItems: 'center' }} aria-label="כפתורים">
      <h2>כפתורים</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" className="personal-primary" style={{ minHeight: 46, padding: '0 22px' }}>שמירה</button>
        <button type="button" className="ghost" style={{ minHeight: 44, padding: '0 16px' }}>ביטול</button>
        <button type="button" className="link">עוד פרטים</button>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <IconButton label="הוספה" variant="framed"><PlusGlyph /></IconButton>
        <CloseButton label="סגירה" variant="framed" />
        <CloseButton label="סגירה שקטה" />
        <button type="button" className="ghost" disabled style={{ minHeight: 44, padding: '0 16px' }}>לא זמין</button>
        <HeartToggle item={{ key: 'gallery-heart', title: 'דוגמה', route: 'debug/clay' }} />
      </div>
      <div className="seg" role="radiogroup" aria-label="תצוגה">
        {[['a', 'טעמים'], ['b', 'ניקוד'], ['c', 'פשוט']].map(([key, label]) => <button key={key} type="button" role="radio" aria-checked={seg === key} className={seg === key ? 'on' : ''} onClick={() => setSeg(key)} style={{ minHeight: 40, padding: '0 16px' }}>{label}</button>)}
      </div>
      <SegmentedControl label="מצב" value={ja} onChange={setJa} options={[['day', 'יום', 'מהבוקר'], ['night', 'לילה', 'מהשקיעה'], ['both', 'שניהם']]} />
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><Switch checked={on} onChange={setOn} label="מופעל" /><Switch checked={off} onChange={setOff} label="כבוי" /></div>
      <TextSizeControl />
    </section>

    <section className="clay-card" style={{ padding: 16, display: 'grid', gap: 12 }} aria-label="בחירה ושדות">
      <h2>בחירה ושדות</h2>
      <Selector label="נוסח התפילה" value={pick} onChange={setPick} options={[['ashkenaz', 'אשכנז'], ['sefard', 'ספרד'], ['edot', 'עדות המזרח']]} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Selector variant="chip" label="סוג" value={chip} defaultValue="all" onChange={setChip} options={[['all', 'הכול'], ['short', 'קצר']]} />
        <Selector variant="chip" label="סדר" value="new" defaultValue="old" onChange={() => {}} options={[['old', 'ישן'], ['new', 'חדש']]} />
      </div>
      <SearchField value={text} onChange={event => setText(event.target.value)} placeholder="חיפוש…" aria-label="חיפוש" clearLabel="נקה" type="search" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="clay-tile clay-press" style={{ minHeight: 44, padding: '0 16px' }}>רגיל</button>
        <span className="mz-chip is-on clay-tile" style={{ display: 'inline-grid', placeItems: 'center', minHeight: 44, padding: '0 16px', border: '1px solid' }}>נבחר</span>
        <span className="badge">תג</span><span className="badge season">עונתי</span>
      </div>
    </section>

    <section aria-label="שורות">
      <h2 style={{ textAlign: 'center' }}>שורות</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        <button type="button" className="index-row"><span><strong>הלכות ברכות</strong><small>12 שאלות</small></span><span aria-hidden="true">←</span></button>
        <button type="button" className="index-row"><span><strong>הלכות שבת</strong><small>48 שאלות</small></span><span aria-hidden="true">←</span></button>
      </div>
      <div className="reading-list" style={{ marginTop: 12 }}>
        <button type="button" className="index-row"><span><strong>שניים מקרא</strong><small>פרשת השבוע</small></span><span aria-hidden="true">←</span></button>
        <button type="button" className="index-row" style={{ borderTop: '1px solid var(--line)' }}><span><strong>דברי תורה</strong><small>לפרשה</small></span><span aria-hidden="true">←</span></button>
      </div>
      <p className="notice">הודעה שקטה: התוכן נשמר במכשיר.</p>
      <details className="clay-details"><summary style={{ padding: '12px 14px' }}>פרטים נוספים</summary><p>תוכן מקופל.</p></details>
      <span className="clay-progress offline-pack-bar" style={{ height: 6, marginTop: 14 }}><span style={{ width: '62%' }} /></span>
    </section>

    <section className="prayer-completion-footer is-rect" aria-label="סיימתי" style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
      <button type="button" className="prayer-complete-btn completion-rect"><span className="completion-rect-label">סיימתי</span></button>
      <p className="prayer-complete-done completion-rect is-yasher"><span className="completion-rect-label">יישר כוח</span></p>
    </section>

    <div className="reading-text" lang="he"><p className="reading-segment siddur-display-prayer" style={{ margin: 0 }}>בָּרוּךְ אַתָּה ה׳ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, אֲשֶׁר בְּדְבָרוֹ מַעֲרִיב עֲרָבִים.</p></div>
    <nav className="reader-navigation" aria-label="ניווט בקריאה">
      <button type="button" className="reader-step previous"><span>הקודם</span><strong>קריאת שמע</strong><b aria-hidden="true">→</b></button>
      <button type="button" className="reader-step next"><span>הבא</span><strong>עמידה</strong><b aria-hidden="true">←</b></button>
    </nav>

    <div className="ja-sheet" role="dialog" aria-label="דוגמת חלון" style={{ margin: '0 auto' }}><h2>חלון</h2><p>גוף צף מעל הרקע.</p><div className="ja-sheet-actions"><button type="button" className="ja-button is-primary" style={{ minHeight: 44 }}>אישור</button><button type="button" className="ja-button" style={{ minHeight: 44 }}>ביטול</button></div></div>
  </div>;
}
