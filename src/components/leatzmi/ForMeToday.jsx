// בשבילי היום — three to five short cards, composed by rules (services/leatzmi/forMe.mjs), the same all day.
import { useEffect, useState } from 'react';
import { PageHead, leatzmiBack } from './common.jsx';
import { useStudyTimer } from '../../hooks.jsx';
import { composeForMe, markCardDone, planForDay, readForMe, sessionMinutes, verseOfDay } from '../../services/leatzmi/forMe.mjs';
import { enqueueReviewItem, readReviewItems, recordReviewResult } from '../../services/leatzmi/review.mjs';
import { createFollowUp, loadChidushim } from '../../services/leatzmi/chidushim.mjs';
import { readLearned } from '../../services/halachaLearning.mjs';
import { civilDateKey } from '../../civilDate.mjs';
import { hebrewNumeral } from '../../services/hebrewNumerals.mjs';
import { leatzmiRoute } from '../../services/leatzmi/routes.mjs';
import { loadDivreiChachamim, sayingForDay } from '../../services/leatzmi/divreiChachamim.mjs';

const ORDINAL = ['א', 'ב', 'ג', 'ד', 'ה'];
const plainNumeral = n => hebrewNumeral(n).replace(/[׳״]/g, '');

async function loadInputs() {
  const [halacha, tehillim, quiz] = await Promise.all([
    import('../../data/practicalHalachaQa.mjs').then(module => module.PRACTICAL_HALACHA_QA).catch(() => []),
    import('../../data/tehillim.json').then(module => module.default?.chapters || []).catch(() => []),
    // בחן אותי's question files (src/data/quiz) — absent or still empty is fine: the card is simply left out.
    import('../../data/quiz/index.mjs').then(module => module.loadQuizFiles()).then(files => Object.values(files || {}).flat().filter(Boolean)).catch(() => []),
  ]);
  const pool = halacha.filter(item => item.quality === 'verified' && item.answerStatus === 'published' && item.sensitivity === 'public' && !item.personal && item.shortAnswer && !(item.conditions || []).length)
    .map(item => ({ id: item.id, question: item.question, shortAnswer: item.shortAnswer, category: item.category }));
  return { pool, tehillim, quiz };
}

export default function ForMeToday({ go, tzid, openPsalm }) {
  const [state, setState] = useState(null);
  const [sage, setSage] = useState(null);
  const day = civilDateKey(new Date(), tzid);
  // דברי חכמים: the day's saying, the same all day and not again for many months (services/leatzmi/divreiChachamim.mjs).
  useEffect(() => { let live = true; loadDivreiChachamim().then(data => { if (live) setSage(sayingForDay(data, day)); }).catch(() => {}); return () => { live = false; }; }, [day]);
  useStudyTimer({ workId: 'leatzmi-today', workTitle: 'בשבילי היום', category: 'torah_study', source: 'leatzmi', tzid, enabled: Boolean(state?.plan?.length) });
  useEffect(() => {
    let live = true;
    const kept = readForMe();
    if (kept.day === day && kept.plan.length) { setState(kept); return undefined; }
    loadInputs().then(({ pool, tehillim, quiz }) => {
      if (!live) return;
      setState(planForDay(day, ({ seenQuiz }) => composeForMe({ day, reviewItems: readReviewItems(), chidushim: loadChidushim(), halachaPool: pool, learnedHalacha: readLearned(), quizPool: quiz, seenQuiz, verse: verseOfDay(tehillim, day) })));
    });
    return () => { live = false; };
  }, [day]);
  const done = index => setState(markCardDone(index));
  if (!state) return <div className="lz-forme"><PageHead title="בשבילי היום" onBack={leatzmiBack(go)} /><p className="loading" role="status">מכין את המפגש של היום…</p></div>;
  const all = state.plan.length > 0 && state.plan.every((_, index) => state.done.includes(index));
  return <div className="lz-forme">
    <PageHead title="בשבילי היום" line={state.plan.length ? `מפגש קצר, כ־${sessionMinutes(state.plan)} דקות.` : null} onBack={leatzmiBack(go)} />
    {sage && <Sage saying={sage} go={go} />}
    {!state.plan.length && <p className="lz-empty">היום אין מה להציע עדיין. חזרו מחר — או כתבו חידוש ראשון.</p>}
    <ol className="lz-forme-list">
      {state.plan.map((card, index) => <li key={index} className={`lz-forme-card${state.done.includes(index) ? ' is-done' : ''}`}>
        <span className="lz-forme-letter" aria-hidden="true">{ORDINAL[index]}</span>
        <ForMeCard card={card} go={go} openPsalm={openPsalm} isDone={state.done.includes(index)} onDone={() => done(index)} />
      </li>)}
    </ol>
    {all && <p className="lz-closing" role="status">זה הכול להיום. יישר כוח.</p>}
  </div>;
}

// דברי חכמים: the words exactly as the book has them, its place, and the edition's licence and attribution.
function Sage({ saying, go }) {
  return <section className="lz-sage" aria-labelledby="lz-sage-title">
    <h2 id="lz-sage-title" className="lz-sage-kind">דברי חכמים</h2>
    <blockquote lang="he">{saying.text}</blockquote>
    <p className="lz-sage-source">{saying.source}</p>
    <div className="lz-card-actions"><button type="button" className="lz-text-button" onClick={() => go(saying.route)}>לפתוח במקור</button></div>
    {/* The attribution in its parts, the edition (often named in English) on a line of its own, so it never scrambles the Hebrew. */}
    <p className="lz-sage-licence" aria-label={saying.attribution}><span><bdi>{saying.licenseTitle}</bdi> · דרך ספריא</span><span className="lz-sage-edition" dir="auto">{saying.edition}</span></p>
  </section>;
}

function ForMeCard({ card, go, openPsalm, isDone, onDone }) {
  const [revealed, setRevealed] = useState(isDone);
  const [chosen, setChosen] = useState(null);
  const finishedButton = !isDone && <button type="button" className="lz-text-button" onClick={onDone}>סיימתי</button>;
  if (card.type === 'halacha') return <section aria-label="הלכה">
    <p className="lz-card-kind">{card.review ? 'הלכה לחזרה' : 'הלכה אחת'}</p>
    <h2 className="lz-card-title">{card.question}</h2>
    {revealed ? <p className="lz-answer">{card.answer}</p> : <button type="button" className="lz-text-button" onClick={() => setRevealed(true)}>הצגת התשובה</button>}
    <div className="lz-card-actions"><button type="button" className="lz-text-button" onClick={() => go(`halacha/q/${encodeURIComponent(card.id)}`)}>לתשובה המלאה ולמקורות</button>{revealed && finishedButton}</div>
  </section>;
  if (card.type === 'quiz-missed' || card.type === 'quiz-new') {
    const question = card.question;
    const answered = chosen !== null;
    const choose = index => {
      if (answered) return;
      setChosen(index);
      const correct = index === question.answer;
      if (card.type === 'quiz-missed') recordReviewResult(card.reviewId, correct ? 'correct' : 'wrong');
      // The same item בחן אותי makes (services/quiz/reviewBridge.mjs): never the answer in the review queue.
      else if (!correct) enqueueReviewItem({ kind: 'quiz', refId: question.id, title: question.q, topic: question.category || '', payload: { questionId: question.id, q: question.q, options: [...question.options], category: question.category, difficulty: question.difficulty, route: `leatzmi/quiz/q/${encodeURIComponent(question.id)}` } });
      onDone();
    };
    return <section aria-label="שאלה">
      <p className="lz-card-kind">{card.type === 'quiz-missed' ? 'שאלה שחוזרת אליך' : 'שאלה חדשה'}</p>
      <h2 className="lz-card-title">{question.q}</h2>
      <div className="lz-options" role="group" aria-label="תשובות">{question.options.map((option, index) => {
        const state = answered ? (index === question.answer ? ' is-right' : index === chosen ? ' is-wrong' : '') : '';
        return <button key={index} type="button" className={`lz-option${state}`} aria-pressed={chosen === index} disabled={answered && index !== chosen && index !== question.answer} onClick={() => choose(index)}>{option}</button>;
      })}</div>
      {answered && <p className="lz-muted" role="status">{chosen === question.answer ? 'נכון.' : `התשובה: ${question.options[question.answer]}.`}{question.note ? ` ${question.note}` : ''}</p>}
    </section>;
  }
  if (card.type === 'verse') return <section aria-label="פסוק">
    <p className="lz-card-kind">פסוק ליום</p>
    <blockquote className="lz-verse" lang="he">{card.text}</blockquote>
    <p className="lz-muted">תהילים {plainNumeral(card.chapter)}, {plainNumeral(card.verse)}</p>
    <div className="lz-card-actions"><button type="button" className="lz-text-button" onClick={() => openPsalm?.(card.chapter)}>לפרק כולו</button>{finishedButton}</div>
  </section>;
  if (card.type === 'chidush') return <section aria-label="חידוש שלך">
    <p className="lz-card-kind">מן החידושים שלך</p>
    <h2 className="lz-card-title">{card.title || 'ללא כותרת'}</h2>
    {card.excerpt && <p className="lz-card-text">{card.excerpt}</p>}
    <div className="lz-card-actions">
      <button type="button" className="lz-text-button" onClick={() => go(leatzmiRoute.chidush(card.chidushId))}>לקריאה</button>
      <button type="button" className="lz-text-button" onClick={() => { const note = createFollowUp(card.chidushId); onDone(); if (note) go(leatzmiRoute.edit(note.id)); }}>מה אני חושב על זה היום?</button>
      {finishedButton}
    </div>
  </section>;
  if (card.type === 'favorite') return <section aria-label="מן המועדפים">
    <p className="lz-card-kind">מן המועדפים</p>
    <h2 className="lz-card-title">{card.title}</h2>
    <div className="lz-card-actions"><button type="button" className="lz-text-button" onClick={() => go('leatzmi/review')}>לחזרה</button>{finishedButton}</div>
  </section>;
  return null;
}
