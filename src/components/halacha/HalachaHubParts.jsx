import { useMemo, useState } from 'react';
import { HALACHA_FLOW_INDEX, QUICK_SITUATIONS } from '../../data/halachaFlows.mjs';
import { walkFlow, rabbiQuestionDraft, stepHints } from '../../services/halachaDecision.mjs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../../data/practicalHalachaQa.mjs';
import { RULE_TYPE_LABELS } from '../../services/halachaEngine.mjs';

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

// "מה חשוב לדעת עכשיו": a curated, ordered guide for the day or season.
export function ContextGuide({ guide, go }) {
  if (!guide) return null;
  return <section className="halacha-guide" aria-labelledby="halacha-guide-title">
    <p className="eyebrow">מה חשוב לדעת עכשיו</p>
    <h2 id="halacha-guide-title">{guide.title}</h2>
    <ol className="halacha-guide-steps">{guide.steps.map(step => <GuideStep key={step.label} step={step} go={go} />)}</ol>
  </section>;
}

// Three items per step keep the guide short; the rest open in place.
const GUIDE_STEP_VISIBLE = 3;
function GuideStep({ step, go }) {
  const [open, setOpen] = useState(false);
  const shown = open ? step.entries : step.entries.slice(0, GUIDE_STEP_VISIBLE);
  const hidden = step.entries.length - shown.length;
  return <li className="halacha-guide-step">
      <h3>{step.label}</h3>
      <ul>{shown.map(entry => <li key={entry.id}><button type="button" className="link" onClick={() => go(questionRoute(entry.id))}>{entry.question}</button></li>)}</ul>
      {hidden > 0 && <button type="button" className="link halacha-guide-more" onClick={() => setOpen(true)}>עוד {hidden}</button>}
      {step.flowId && HALACHA_FLOW_INDEX[step.flowId] && <button type="button" className="halacha-guide-flow" onClick={() => go(flowRoute(step.flowId))}>בירור מהיר: {HALACHA_FLOW_INDEX[step.flowId].title} ←</button>}
    </li>;
}

// The router's lead card above the results: a flow to clarify the situation, or the verified answer itself.
export function RoutedLead({ route, go }) {
  if (route?.flow && route.intent === 'situation-needs-clarification') return <button type="button" className="halacha-routed-flow" onClick={() => go(flowRoute(route.flow.id))}>
    <span className="eyebrow">כדי לענות נכון — כמה שאלות קצרות</span>
    <strong>{route.flow.title}</strong><small>{route.flow.subtitle} · בירור מהיר ←</small>
  </button>;
  if (route?.answer) return <button type="button" className="halacha-routed-answer" onClick={() => go(questionRoute(route.answer.id))}>
    <span className="eyebrow">בקיצור</span>
    <strong>{route.answer.question}</strong>
    <span className="halacha-routed-text">{route.answer.shortAnswer}</span>
    <small>{route.answer.sources?.[0]?.work} · {route.answer.sources?.[0]?.citation} · לעמוד המלא ←</small>
  </button>;
  return null;
}

function OutcomeEntry({ entry, go }) {
  const source = entry.sources?.[0];
  return <article className="flow-answer">
    <h3>{entry.question}</h3>
    <p className="flow-answer-text">{entry.shortAnswer}</p>
    <p className="flow-answer-meta">{entry.ruleType && RULE_TYPE_LABELS[entry.ruleType] ? `${RULE_TYPE_LABELS[entry.ruleType]} · ` : ''}{source?.work}, {source?.citation}</p>
    <button type="button" className="link" onClick={() => go(questionRoute(entry.id))}>המקור המלא והלכות קשורות ←</button>
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
  if (handoff) { const target = HALACHA_FLOW_INDEX[handoff]; return <section className="halacha-flow"><p className="eyebrow">בירור מהיר</p><h1>{flow.title}</h1>
    <button type="button" className="halacha-routed-flow" onClick={() => go(flowRoute(handoff))}><strong>{target.title}</strong><small>{target.subtitle} · המשך ←</small></button></section>; }
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
