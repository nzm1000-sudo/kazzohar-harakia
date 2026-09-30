import { useEffect, useMemo, useState } from 'react';
import { HALACHA_FLOW_INDEX, QUICK_SITUATIONS } from '../../data/halachaFlows.mjs';
import { walkFlow, rabbiQuestionDraft, stepHints } from '../../services/halachaDecision.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../../data/practicalHalachaQa.mjs';
import { recordRabbiRoute } from '../../services/halachaGaps.mjs';
import GlossaryText from './GlossaryText.jsx';
import { RULE_TYPE_LABELS, activeContexts } from '../../services/halachaEngine.mjs';
import { SIDDUR_HALACHA, SIDDUR_PRAYER } from '../../data/halachaSiddurLinks.mjs';
import { prayerTimeStatus, timesFromContext } from '../../services/halachaTime.mjs';

// Route helpers shared with HalachaLibrary: a flow keeps its answers in the route, so "back" undoes one answer.
export const flowRoute = (id, path = []) => `halacha/f/${encodeURIComponent(id)}${path.length ? `/${path.join('-')}` : ''}`;
export const questionRoute = id => `halacha/q/${encodeURIComponent(id)}`;

const shareOrCopy = async text => {
  try { if (navigator.share) { await navigator.share({ text }); return 'shared'; } } catch { return 'cancelled'; }
  try { await navigator.clipboard?.writeText(text); return 'copied'; } catch { return 'failed'; }
};

// "בירור מהיר": one tile per guided flow.
export function QuickSituations({ go }) {
  return <section className="halacha-situations" aria-labelledby="halacha-situations-title">
    <h2 id="halacha-situations-title">בירור מהיר</h2>
    <div className="halacha-situation-grid">{QUICK_SITUATIONS.map(id => HALACHA_FLOW_INDEX[id]).filter(Boolean).map(flow =>
      <button type="button" key={flow.id} className="halacha-situation" onClick={() => go(flowRoute(flow.id))}>
        <strong>{flow.title}</strong><small>{flow.subtitle}</small>
      </button>)}</div>
  </section>;
}

// "מה חשוב לדעת עכשיו": a curated, ordered guide for the day or season — one question per tile, every tile the same
// size; "עוד N" opens the rest of that step beneath the grid, so the tiles never change shape.
export function ContextGuide({ guide, go }) {
  const [openStep, setOpenStep] = useState(null);
  if (!guide) return null;
  const steps = guide.steps.filter(step => step.entries.length);
  const open = steps.find(step => step.label === openStep) || null;
  return <section className="halacha-guide" aria-labelledby="halacha-guide-title">
    <p className="eyebrow">מה חשוב לדעת עכשיו</p>
    <h2 id="halacha-guide-title">{guide.title}</h2>
    <ol className={`halacha-guide-tiles${steps.length % 2 ? ' is-odd' : ''}`}>{steps.map((step, index) => {
      const [first, ...rest] = step.entries;
      const isOpen = open?.label === step.label;
      return <li key={step.label} className={`halacha-guide-tile${isOpen ? ' is-open' : ''}`}>
        <span className="halacha-guide-num" data-digit={String(index + 1)} aria-hidden="true">{index + 1}</span>
        <span className="halacha-guide-label">{step.label}</span>
        <button type="button" className="halacha-guide-question" onClick={() => go(questionRoute(first.id))}>{first.question}</button>
        {rest.length > 0 || step.flowId
          ? <button type="button" className="halacha-guide-more" aria-expanded={isOpen} onClick={() => setOpenStep(isOpen ? null : step.label)}>{rest.length ? `עוד ${rest.length}` : 'בירור מהיר'} <span aria-hidden="true">{isOpen ? '˄' : '˅'}</span></button>
          : <span className="halacha-guide-more is-empty" aria-hidden="true" />}
      </li>;
    })}</ol>
    {open && <div className="halacha-guide-panel" role="region" aria-label={open.label}>
      <h3>{open.label}</h3>
      <ul>{open.entries.slice(1).map(entry => <li key={entry.id}><button type="button" className="link" onClick={() => go(questionRoute(entry.id))}>{entry.question}</button></li>)}</ul>
      {open.flowId && HALACHA_FLOW_INDEX[open.flowId] && <button type="button" className="halacha-guide-flow" onClick={() => go(flowRoute(open.flowId))}>בירור מהיר: {HALACHA_FLOW_INDEX[open.flowId].title}<span aria-hidden="true">{'\u00A0'}←</span></button>}
    </div>}
  </section>;
}

// The router's lead card above the results: a flow to clarify the situation, or the verified answer itself.
// A general question ("מתי אומרים הלל?"): the overview and each occasion, all verified — not one word match.
export function ConceptLead({ concept, go }) {
  const entries = [concept.overview, ...concept.occasions].map(id => PRACTICAL_HALACHA_QA_INDEX[id]).filter(Boolean);
  if (!entries.length) return null;
  const [overview, ...occasions] = entries;
  return <section className="halacha-concept" aria-label="התשובה לפי המועד">
    <button type="button" className="halacha-routed-answer" onClick={() => go(questionRoute(overview.id))}>
      <span className="eyebrow">בקיצור · התשובה תלויה ביום</span>
      <strong>{overview.question}</strong>
      <span className="halacha-routed-text">{overview.shortAnswer}</span>
      <small>{overview.sources?.[0]?.work} · {overview.sources?.[0]?.citation} · לעמוד המלא<span aria-hidden="true">{'\u00A0'}←</span></small>
    </button>
    <div className="book-index">{occasions.slice(0, 6).map(entry => <button type="button" className="index-row" key={entry.id} onClick={() => go(questionRoute(entry.id))}><span><strong>{entry.question}</strong><small>תשובה מאומתת</small></span><span aria-hidden="true">←</span></button>)}</div>
  </section>;
}

export function RoutedLead({ route, go }) {
  if (route?.flow && route.intent === 'situation-needs-clarification') return <button type="button" className="halacha-routed-flow" onClick={() => go(flowRoute(route.flow.id))}>
    <span className="eyebrow">כדי לענות נכון — כמה שאלות קצרות</span>
    <strong>{route.flow.title}</strong><small>{route.flow.subtitle} · בירור מהיר<span aria-hidden="true">{'\u00A0'}←</span></small>
  </button>;
  if (route?.answer) return <button type="button" className="halacha-routed-answer" onClick={() => go(questionRoute(route.answer.id))}>
    <span className="eyebrow">בקיצור</span>
    <strong>{route.answer.question}</strong>
    <span className="halacha-routed-text">{route.answer.shortAnswer}</span>
    <small>{route.answer.sources?.[0]?.work} · {route.answer.sources?.[0]?.citation} · לעמוד המלא<span aria-hidden="true">{'\u00A0'}←</span></small>
  </button>;
  return null;
}

function OutcomeEntry({ entry, go }) {
  const source = entry.sources?.[0];
  return <article className="flow-answer">
    <h3>{entry.question}</h3>
    <GlossaryText as="p" className="flow-answer-text" text={entry.shortAnswer} />
    <p className="flow-answer-meta">{entry.ruleType && RULE_TYPE_LABELS[entry.ruleType] ? `${RULE_TYPE_LABELS[entry.ruleType]} · ` : ''}{source?.work}, {source?.citation}</p>
    <button type="button" className="link" onClick={() => go(questionRoute(entry.id))}>המקור המלא והלכות קשורות<span aria-hidden="true">{'\u00A0'}←</span></button>
  </article>;
}

export function RabbiDraft({ topic, trail, entries = [], sources = [] }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState('');
  const text = useMemo(() => rabbiQuestionDraft({ topic, trail, details, entries, sources }), [topic, trail, details, entries, sources]);
  if (!open) return <button type="button" className="ghost rabbi-draft-open" onClick={() => setOpen(true)}>הכן שאלה לרב</button>;
  return <section className="rabbi-draft" aria-label="טיוטת שאלה לרב">
    <h3>שאלה לרב</h3>
    <label className="rabbi-draft-field"><span>מה עוד חשוב לספר? (לא חובה)</span>
      <textarea value={details} onChange={event => setDetails(event.target.value)} rows={3} placeholder="למשל: מתי זה קרה, מה בדיוק היה בסיר, האם כבר עשית משהו" /></label>
    <pre className="rabbi-draft-text">{text}</pre>
    <div className="personal-actions">
      <button type="button" className="ghost" onClick={async () => setStatus(await shareOrCopy(text))}>העתק / שתף</button>
      {status === 'copied' && <span className="rabbi-draft-status" role="status">הועתק</span>}
    </div>
    <p className="rabbi-draft-note">הטיוטה נשארת במכשיר. היא לא נשלחת לשום מקום.</p>
  </section>;
}

// "למה זה משנה?": the verified text that shows this detail changes the answer. Collapsed; the flow stays fast.
function WhyAsked({ ids = [] }) {
  const entries = (ids || []).map(id => PRACTICAL_HALACHA_QA_INDEX[id]).filter(Boolean);
  if (!entries.length) return null;
  return <details className="chat-why flow-why"><summary>למה זה משנה?</summary>{entries.map(entry => <blockquote key={entry.id}>{entry.sources?.[0]?.excerpt || entry.shortAnswer}<cite>{entry.sources?.[0]?.work}, {entry.sources?.[0]?.citation}</cite></blockquote>)}</details>;
}

// A guided flow: the answered steps (tap one to change it), then the next question or the outcome.
export function FlowView({ flowId, path, go, openSource }) {
  const state = walkFlow(flowId, path);
  if (!state) return <p className="notice">הבירור לא נמצא.</p>;
  const { flow, trail, step, outcome, handoff } = state;
  const rabbiKey = outcome?.rabbi ? `${flow.id}/${outcome.key}` : null;
  useEffect(() => { if (rabbiKey) recordRabbiRoute(flow.id, outcome.key); }, [rabbiKey]);
  if (handoff) { const target = HALACHA_FLOW_INDEX[handoff]; return <section className="halacha-flow"><p className="eyebrow">בירור מהיר</p><h1>{flow.title}</h1>
    <button type="button" className="halacha-routed-flow" onClick={() => go(flowRoute(handoff))}><strong>{target.title}</strong><small>{target.subtitle} · המשך<span aria-hidden="true">{'\u00A0'}←</span></small></button></section>; }
  return <section className="halacha-flow">
    <p className="eyebrow">בירור מהיר</p>
    <h1>{flow.title}</h1>
    {trail.length > 0 && <ol className="flow-trail" aria-label="מה ענית עד עכשיו">{trail.map((item, index) =>
      <li key={index}><button type="button" onClick={() => go(flowRoute(flow.id, path.slice(0, index)))} aria-label={`שינוי התשובה: ${item.question} ${item.answer}`}><span>{item.question}</span><strong>{item.answer}</strong></button></li>)}</ol>}
    {step && <fieldset className="flow-step"><legend>{step.question}</legend>
      <div className="flow-options">{step.options.map((option, index) =>
        <button type="button" key={option.label} className="flow-option" onClick={() => go(flowRoute(flow.id, [...path, index]))}>{option.label}</button>)}</div>
      <WhyAsked ids={stepHints(flow.id, state.stepId)?.whyAsked} />
    </fieldset>}
    {outcome && <section className="flow-outcome" aria-live="polite">
      {outcome.entries.length > 0 && <><h2>התשובה</h2>{outcome.entries.map(entry => <OutcomeEntry key={entry.id} entry={entry} go={go} />)}</>}
      {outcome.disagreement && <div className="notice flow-rabbi"><p>יש בזה מחלוקת פוסקים, והמקור אינו מכריע במפורש. למעשה כדאי לשאול רב.</p></div>}
      {outcome.rabbi && <div className="notice flow-rabbi"><p>{outcome.note || 'למקרה הזה אין עדיין תשובה מקוצרת מאומתת במאגר.'}</p><p>כדאי לשאול רב. אפשר להכין כאן את השאלה עם הפרטים שכבר ענית.</p></div>}
      {outcome.sources.length > 0 && <div className="source-group"><h3>המקור שעוסק בזה · לעיון</h3><div className="book-index">{outcome.sources.map(source =>
        <button type="button" className="index-row" key={source.id} onClick={() => openSource(source.ref, `ילקוט יוסף · ${source.title}`, 'nikud')}><span><strong>ילקוט יוסף · {source.title}</strong><small>{source.section}</small></span><span aria-hidden="true">←</span></button>)}</div></div>}
      <RabbiDraft topic={flow.title} trail={trail} entries={outcome.entries} sources={outcome.sources} />
      <button type="button" className="link flow-restart" onClick={() => go(flowRoute(flow.id))}>להתחיל את הבירור מחדש</button>
    </section>}
  </section>;
}

// "הלכה לתפילה": opened from a small link in the Siddur. Today's relevant flows first, the prayer-time window when it
// applies, then the verified halachot of this part of the prayer.
export function SiddurHalachaPage({ sectionKey, prayer, context, go }) {
  const info = SIDDUR_HALACHA[sectionKey];
  if (!info) return <p className="notice">אין עדיין הלכות לחלק הזה בתפילה.</p>;
  const active = activeContexts(context || {});
  const todayFlows = Object.entries(info.today || {}).filter(([key]) => active.has(key)).flatMap(([, ids]) => ids);
  const flows = [...new Set([...todayFlows, ...info.flows])].map(id => HALACHA_FLOW_INDEX[id]).filter(Boolean);
  const timePrayer = info.time === 'prayer' ? SIDDUR_PRAYER[prayer] : info.time;
  const time = timePrayer ? prayerTimeStatus(timePrayer, new Date(), timesFromContext(context || {})) : null;
  const entries = info.entryIds.map(id => PRACTICAL_HALACHA_QA_INDEX[id]).filter(Boolean);
  const hallel = info.showHallel ? context?.prayerContext?.hallel || null : null;
  return <section className="halacha-flow siddur-halacha">
    <p className="eyebrow">הלכה לתפילה{context?.hebrewDate?.label ? ` · ${context.hebrewDate.label}` : ''}</p>
    <h1>{info.title}</h1>
    {hallel && <p className="siddur-halacha-today">היום אומרים: <strong>{hallel}</strong></p>}
    {time && time.status !== 'unknown' && <div className="siddur-halacha-time"><p>השעה {time.now}. {time.summary}</p>{time.times.length > 0 && <dl className="chat-times">{time.times.map(row => <div key={row.key}><dt>{row.label}</dt><dd>{row.time}</dd></div>)}</dl>}</div>}
    {flows.length > 0 && <div className="halacha-followup-list">{flows.map(flow => <button type="button" key={flow.id} className="halacha-guide-flow" onClick={() => go(flowRoute(flow.id))}>בירור מהיר: {flow.title}<span aria-hidden="true">{'\u00A0'}←</span></button>)}</div>}
    <div className="book-index">{entries.map(entry => <button type="button" className="index-row" key={entry.id} onClick={() => go(questionRoute(entry.id))}><span><strong>{entry.question}</strong><em>{entry.shortAnswer}</em></span><span aria-hidden="true">←</span></button>)}</div>
    <button type="button" className="halacha-chat-entry" onClick={() => go('halacha/chat')}><span><strong>שאלה על התפילה הזו</strong><small>השיחה כבר יודעת באיזו תפילה מדובר</small></span><span aria-hidden="true">←</span></button>
  </section>;
}
