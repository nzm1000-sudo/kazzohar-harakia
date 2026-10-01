// חזרה אליי — about three things to meet again: the user's chidushim, favourites, halachot marked "למדתי", questions
// missed in בחן אותי, and sources returned to. Four answers: זכרתי · צריך חזרה · חזור אליי בהמשך · פתח מקור.
// No numbers, no streaks; the schedule lives in services/leatzmi/review.mjs.
import { useEffect, useState } from 'react';
import { PageHead, leatzmiBack } from './common.jsx';
import { useStudyTimer } from '../../hooks.jsx';
import { getReviewItem, recordReviewResult, reviewSession, seedReviewItems } from '../../services/leatzmi/review.mjs';
import { getChidush, loadChidushim } from '../../services/leatzmi/chidushim.mjs';
import { readFavorites } from '../../services/favorites.mjs';
import { readLearned } from '../../services/halachaLearning.mjs';
import { getLearningMemory } from '../../services/learningMemory.mjs';
import { leatzmiRoute } from '../../services/leatzmi/routes.mjs';

const KIND_LABEL = { chidush: 'חידוש שכתבת', quiz: 'שאלה מן השעשועון', favorite: 'מן המועדפים', halacha: 'הלכה שלמדת', source: 'מקור שחזרת אליו' };

// What returned to: reading positions the app remembers that were opened more than once (or finished).
export function returnedSources(memory) {
  return Object.entries(memory || {}).filter(([, item]) => item?.reference && (item.status === 'in_progress' || item.status === 'completed')).map(([id, item]) => ({ id, title: item.title || '', reference: item.reference, source: item.source || '', chapter: item.chapter ?? null }));
}

export default function ReviewSession({ go, tzid, openSource, openPsalm }) {
  const [halacha, setHalacha] = useState(null);
  const [quizBank, setQuizBank] = useState(null);
  const [items, setItems] = useState(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  useStudyTimer({ workId: 'leatzmi-review', workTitle: 'חזרה אליי', category: 'torah_study', source: 'leatzmi', tzid, enabled: Boolean(items?.length) });
  useEffect(() => {
    let live = true;
    Promise.all([
      import('../../data/practicalHalachaQa.mjs').then(module => module.PRACTICAL_HALACHA_QA_INDEX).catch(() => ({})),
      // בחן אותי keeps answers out of the review queue; the question is read again from its bank to show the answer.
      import('../../data/quiz/index.mjs').then(module => module.loadQuizFiles()).then(files => new Map(Object.values(files || {}).flat().filter(item => item?.id).map(item => [item.id, item]))).catch(() => new Map()),
    ]).then(([pool, bank]) => {
      if (!live) return;
      const learned = Object.keys(readLearned()).filter(id => pool[id]).map(id => ({ id, title: pool[id].question, topic: pool[id].category }));
      try { seedReviewItems({ favorites: readFavorites(), chidushim: loadChidushim(), halacha: learned, returned: returnedSources(getLearningMemory()) }, { limit: 2 }); } catch { /* the session still shows what is due */ }
      setHalacha(pool);
      setQuizBank(bank);
      setItems(reviewSession({ size: 3 }));
    });
    return () => { live = false; };
  }, []);
  const item = items?.[index] || null;
  const next = () => { setRevealed(false); setIndex(value => value + 1); };
  const grade = value => { if (item) recordReviewResult(item.id, value); next(); };
  const open = () => {
    if (!item) return;
    const fresh = getReviewItem(item.id) || item;
    if (fresh.kind === 'chidush') return go(leatzmiRoute.chidush(fresh.refId));
    if (fresh.kind === 'halacha') return go(fresh.payload?.route || `halacha/q/${encodeURIComponent(fresh.refId)}`);
    if (fresh.kind === 'quiz') return go(fresh.payload?.route || 'leatzmi/quiz');
    const target = fresh.kind === 'favorite' ? fresh.payload?.open : { type: fresh.payload?.source === 'tehillim' ? 'psalm' : 'source', reference: fresh.payload?.reference, chapter: fresh.payload?.chapter, title: fresh.title };
    if (target?.type === 'psalm' && target.chapter) return openPsalm?.(target.chapter);
    if (target?.type === 'route' && target.route) return go(target.route);
    if (target?.reference) return openSource?.(target.reference, target.title || fresh.title, target.mode || 'nikud');
  };
  return <div className="lz-review">
    <PageHead title="חזרה אליי" line="מה שכדאי לפגוש שוב, בזמן הנכון." onBack={leatzmiBack(go)} />
    {items === null && <p className="loading" role="status">מכין…</p>}
    {items?.length === 0 && <div className="lz-empty"><p>אין כרגע דבר שמחכה לחזרה.</p><p className="lz-muted">חידושים שכתבת, מועדפים, הלכות שסימנת „למדתי״ ושאלות שהחמצת יחזרו לכאן בעדינות, כל אחד בזמנו.</p></div>}
    {items?.length > 0 && !item && <div className="lz-empty" role="status"><p>זהו להפעם.</p><p className="lz-muted">נתראה בחזרה הבאה.</p><div className="lz-center"><button type="button" className="lz-outline" onClick={() => go('leatzmi', { replace: true })}>ללעצמי</button></div></div>}
    {item && <>
      <ol className="lz-progress" aria-label={`פריט ${index + 1} מתוך ${items.length}`}>{items.map((_, i) => <li key={i} className={i < index ? 'is-done' : i === index ? 'is-current' : ''} />)}</ol>
      <ReviewCard key={item.id} item={item} halacha={halacha} quizBank={quizBank} revealed={revealed} onReveal={() => setRevealed(true)} />
      <div className="lz-grade" role="group" aria-label="איך היה?">
        <button type="button" className="lz-outline" onClick={() => grade('remembered')}>זכרתי</button>
        <button type="button" className="lz-outline" onClick={() => grade('again')}>צריך חזרה</button>
        <button type="button" className="lz-outline" onClick={() => grade('later')}>חזור אליי בהמשך</button>
        <button type="button" className="lz-outline" onClick={open}>פתח מקור</button>
      </div>
    </>}
  </div>;
}

function ReviewCard({ item, halacha, quizBank, revealed, onReveal }) {
  const chidush = item.kind === 'chidush' ? getChidush(item.refId) : null;
  const entry = item.kind === 'halacha' ? halacha?.[item.refId] : null;
  const quiz = item.kind === 'quiz' ? (quizBank?.get(item.payload?.questionId || item.refId) || item.payload) : null;
  const title = chidush?.title || entry?.question || quiz?.q || item.title || '';
  const answer = entry ? entry.shortAnswer : quiz && Array.isArray(quiz.options) && Number.isInteger(quiz.answer) ? quiz.options[quiz.answer] : null;
  return <article className="lz-card" aria-labelledby={`lz-card-${item.id}`}>
    <p className="lz-card-kind">{KIND_LABEL[item.kind] || ''}</p>
    <h2 id={`lz-card-${item.id}`} className="lz-card-title">{title}</h2>
    {chidush?.body && <p className="lz-card-text">{chidush.body.length > 320 ? `${chidush.body.slice(0, 317)}…` : chidush.body}</p>}
    {item.kind === 'favorite' && item.payload?.subtitle && <p className="lz-card-text">{item.payload.subtitle}</p>}
    {answer && (revealed
      ? <div className="lz-answer"><p>{answer}</p>{quiz?.note && <p className="lz-muted">{quiz.note}</p>}</div>
      : <div className="lz-center"><button type="button" className="lz-text-button" onClick={onReveal}>הצגת התשובה</button></div>)}
  </article>;
}
