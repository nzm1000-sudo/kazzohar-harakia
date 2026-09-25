import { useState } from 'react';
import { REVIEW_LABELS, isPractical, listForgottenTopics, resolvePath } from '../services/forgottenAdditions.mjs';
import { BackLink } from '../components/LocalNavigation.jsx';

export default function ForgottenAddition() {
  const [topicId, setTopicId] = useState(null);
  const [path, setPath] = useState([]);
  if (!topicId) {
    return <section className="preparation forgotten">
      <p className="eyebrow">סידור · עזרה מיידית</p>
      <h1>שכחתי תוספת — מה עושים?</h1>
      <p className="intro">בחרו את התוספת ששכחתם. השאלות ממוקדות ומובילות למקורות הרלוונטיים.</p>
      <div className="forgotten-topic-list">
        {listForgottenTopics().map(topic => <button type="button" className="forgotten-topic-row" key={topic.id} onClick={() => { setTopicId(topic.id); setPath([]); }}>
          <span className="forgotten-topic-text"><strong>{topic.title}</strong>{topic.context && <small>{topic.context}</small>}</span>
          <span className="forgotten-topic-arrow" aria-hidden="true">←</span>
        </button>)}
      </div>
      <p className="personal-hint">התוכן מבוסס על מקורות מובנים ואינו נוצר אוטומטית.</p>
    </section>;
  }

  const { topic, steps, current, outcome } = resolvePath(topicId, path);
  return <section className="preparation forgotten">
    <BackLink label="חזרה" onClick={() => (path.length ? setPath(path.slice(0, -1)) : setTopicId(null))} />
    <p className="eyebrow">שכחתי תוספת</p>
    <h1>{topic.title}</h1>
    {steps.length > 0 && <ol className="forgotten-steps">
      {steps.map(step => <li key={step.nodeId}><span>{step.question}</span><strong>{step.answer}</strong></li>)}
    </ol>}
    {current && <div className="forgotten-question">
      <h2>{current.text}</h2>
      <div className="forgotten-options">
        {current.options.map((option, index) => <button type="button" className="personal-primary" key={option.label} onClick={() => setPath([...path, index])}>{option.label}</button>)}
      </div>
    </div>}
    {outcome && <ForgottenOutcome outcome={outcome} onRestart={() => setPath([])} />}
  </section>;
}

function ForgottenOutcome({ outcome, onRestart }) {
  const practical = isPractical(outcome.reviewState);
  return <div className={`forgotten-outcome${practical ? ' practical' : ''}`}>
    <p className={`notice${practical ? '' : ' error'}`} role="status">{REVIEW_LABELS[outcome.reviewState]}</p>
    {!practical && <p className="forgotten-disclaimer">התוכן מוצג כמידע מקורות לבדיקה בלבד, ואינו הנחיה מעשית סופית.</p>}
    <p className="forgotten-summary">{outcome.summary}</p>
    {outcome.detail && <p className="forgotten-detail">{outcome.detail}</p>}
    {outcome.needsRav && <p className="notice error">נדרשים פרטים נוספים. יש לברר מול מורה הוראה לפני מעשה.</p>}
    <dl className="forgotten-sources">
      <dt>מקור עיקרי</dt><dd>{outcome.source.primary}</dd>
      <dt>מקור נוסף</dt><dd>{outcome.source.secondary}</dd>
    </dl>
    <button type="button" className="ghost" onClick={onRestart}>מהתחלה</button>
  </div>;
}
