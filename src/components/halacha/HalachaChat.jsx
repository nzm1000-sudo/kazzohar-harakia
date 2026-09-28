import { useEffect, useMemo, useRef, useState } from 'react';
import { PRACTICAL_HALACHA_QA, PRACTICAL_HALACHA_QA_INDEX } from '../../data/practicalHalachaQa.mjs';
import { YALKUT_YOSEF } from '../../data/yalkutYosef.mjs';
import { hebrewNumeral } from '../../services/hebrewNumerals.mjs';
import { RULE_TYPE_LABELS } from '../../services/halachaEngine.mjs';
import { getAppActivity } from '../../services/appActivity.mjs';
import { newConversation, respond } from '../../services/ai/halachaConversation.mjs';
import { defaultModelChain, unavailableReasonLabel } from '../../services/ai/halachaModels.mjs';
import { RabbiDraft, questionRoute } from './HalachaHubParts.jsx';
import GlossaryText from './GlossaryText.jsx';

// "שיחה הלכתית": a multi-turn assistant over the verified corpus. Every visit starts a clean conversation; the last one
// stays on the device for this session only (sessionStorage) and can be resumed with one tap. A sensitive topic is not
// kept at all.
const STORE = 'kz-halacha-chat-v1';
const STARTERS = ['שכחתי יעלה ויבוא', 'אפשר לחמם מרק בשבת?', 'אכלתי בשר, מתי אפשר חלבי?', 'אפשר להתפלל עכשיו?', 'לא זוכר אם ספרתי אתמול'];

let sectionIndex = null;
const sectionById = id => (sectionIndex ||= new Map(YALKUT_YOSEF.sections.map(section => [section.id, section]))).get(id);
const sectionTitle = section => `${section.section.split(/\s*-\s*/)[0].trim()}, סעיף ${hebrewNumeral(section.halachaIndex)}`;

function loadSaved() {
  try { const saved = JSON.parse(sessionStorage.getItem(STORE) || 'null'); if (saved?.conversation && Array.isArray(saved.messages)) return saved; } catch { /* ignore */ }
  return { conversation: newConversation(), messages: [] };
}

const EMPTY = () => ({ conversation: newConversation(), messages: [] });

export default function HalachaChat({ go, openSource, context }) {
  const [state, setState] = useState(EMPTY);
  // The previous conversation, offered (not forced) — e.g. when coming back from a source page.
  const [previous, setPrevious] = useState(() => { const saved = loadSaved(); return saved.messages.length ? saved : null; });
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState({ chain: null, label: null, reason: null });
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const chain = defaultModelChain();
    let cancelled = false;
    (async () => {
      const status = await chain.status();
      if (cancelled) return;
      if (status.available) setModel({ chain, label: status.provider.label, reason: null });
      else {
        const reasons = await Promise.all(chain.providers.map(provider => provider.availability().then(result => result.reason).catch(() => null)));
        setModel({ chain: null, label: null, reason: reasons.find(reason => reason && reason !== 'not-configured') || reasons[0] });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // A question carried over from the Halacha search box starts the conversation.
  useEffect(() => {
    let seed = null;
    try { seed = sessionStorage.getItem('kz-halacha-chat-seed'); sessionStorage.removeItem('kz-halacha-chat-seed'); } catch { /* ignore */ }
    if (seed) sendRef.current?.(seed, { fresh: true });
  }, []);

  useEffect(() => {
    const sensitive = state.messages.some(message => message.response?.sensitive);
    if (!state.messages.length) return;
    try { if (sensitive) sessionStorage.removeItem(STORE); else sessionStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ }
    endRef.current?.scrollIntoView({ block: 'end', behavior: state.messages.length > 2 ? 'smooth' : 'auto' });
  }, [state]);

  const send = async (text, { fresh = false } = {}) => {
    const value = String(text || '').trim();
    if (!value || busy) return;
    setBusy(true);
    setDraft('');
    try {
      const { conversation, response } = await respond(fresh ? newConversation() : state.conversation, value, { context, activity: getAppActivity(), model: model.chain });
      setPrevious(null);
      setState(current => ({ conversation, messages: [...(fresh ? [] : current.messages), { role: 'user', text: value }, { role: 'assistant', response }] }));
    } finally { setBusy(false); }
  };
  const sendRef = useRef(null);
  sendRef.current = send;
  const reset = () => { setState(EMPTY()); setPrevious(null); try { sessionStorage.removeItem(STORE); } catch { /* ignore */ } setDraft(''); inputRef.current?.focus(); };
  const status = model.label ? `עונה מתוך ${PRACTICAL_HALACHA_QA.length} תשובות מאומתות · עם ${model.label}` : `עונה מתוך ${PRACTICAL_HALACHA_QA.length} תשובות מאומתות, על המכשיר${model.reason ? ` · ${unavailableReasonLabel(model.reason)}` : ''}`;

  return <section className="halacha-chat" aria-label="שיחה הלכתית">
    <div className="halacha-chat-head">
      <div><p className="eyebrow">שיחה הלכתית</p><h1>שאל, ונברר יחד.</h1></div>
      {state.messages.length > 0 && <button type="button" className="ghost" onClick={reset}>שיחה חדשה</button>}
    </div>
    <p className="halacha-chat-status">{status}. מה שנכתב כאן נשאר במכשיר. זו אינה פסיקה אישית.</p>
    {state.messages.length === 0 && previous && <button type="button" className="link halacha-chat-resume" onClick={() => { setState(previous); setPrevious(null); }}>להמשיך את השיחה הקודמת: "{previous.messages.find(message => message.role === 'user')?.text?.slice(0, 40)}" ←</button>}
    {state.messages.length === 0 && <div className="halacha-chat-starters" aria-label="דוגמאות">{STARTERS.map(starter => <button type="button" key={starter} onClick={() => send(starter)}>{starter}</button>)}</div>}
    {state.messages.length === 0 && <button type="button" className="halacha-chat-entry halacha-chat-all" onClick={() => go('halacha/all')}><span><strong>כל {PRACTICAL_HALACHA_QA.length} השאלות לפי נושא</strong><small>בוחרים שאלה מהרשימה, והיא נשאלת כאן</small></span><span aria-hidden="true">←</span></button>}
    <ol className="halacha-chat-log">
      {state.messages.map((message, index) => message.role === 'user'
        ? <li key={index} className="chat-user"><p>{message.text}</p></li>
        : <li key={index} className="chat-assistant"><AssistantMessage response={message.response} last={index === state.messages.length - 1} onPick={send} go={go} openSource={openSource} busy={busy} said={state.messages.slice(0, index).filter(item => item.role === 'user').map(item => item.text)} /></li>)}
    </ol>
    <div ref={endRef} />
    <form className="halacha-chat-input" onSubmit={event => { event.preventDefault(); send(draft); }}>
      <label htmlFor="halacha-chat-field" className="visually-hidden">ההודעה שלך</label>
      <input id="halacha-chat-field" ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} placeholder={state.conversation.active ? 'אפשר לענות במילים שלך' : 'מה השאלה?'} autoComplete="off" enterKeyHint="send" />
      <button type="submit" disabled={!draft.trim() || busy}>{busy ? '…' : 'שלח'}</button>
    </form>
  </section>;
}

function EntryCard({ entry, go, muted = false }) {
  const source = entry.sources?.[0];
  return <article className={`chat-entry${muted ? ' chat-entry--related' : ''}`}>
    <h3>{entry.question}</h3>
    <GlossaryText as="p" className="chat-entry-answer" text={entry.shortAnswer} />
    <p className="chat-entry-meta">{entry.ruleType && RULE_TYPE_LABELS[entry.ruleType] ? `${RULE_TYPE_LABELS[entry.ruleType]} · ` : ''}{source?.work}, {source?.citation}</p>
    <button type="button" className="link" onClick={() => go(questionRoute(entry.id))}>המקור המלא ←</button>
  </article>;
}

function AssistantMessage({ response, last, onPick, go, openSource, busy, said = [] }) {
  const entries = useMemo(() => (response.entryIds || []).map(id => PRACTICAL_HALACHA_QA_INDEX[id]).filter(Boolean), [response]);
  const sources = useMemo(() => (response.type === 'sources_only' || response.type === 'refer_to_rabbi' ? (response.sourceIds || []) : []).map(sectionById).filter(Boolean), [response]);
  const related = (response.relatedEntryIds || []).map(id => PRACTICAL_HALACHA_QA_INDEX[id]).filter(Boolean);
  const why = (response.clarification?.whyAsked || []).map(id => PRACTICAL_HALACHA_QA_INDEX[id]).filter(Boolean);
  const showExcerpts = response.type === 'sources_only' && entries.length;
  // What kind of reply this is — a verified answer, a calculation on one, related material, an explanation, or sources.
  const kind = response.calc ? 'חישוב לפי תשובה מאומתת' : { answer: 'תשובה מאומתת', multiple_cases: 'תשובות מאומתות', disagreement: 'תשובה מאומתת · מחלוקת', related: 'הלכות קשורות – לא תשובה לשאלה עצמה', definition: 'הסבר מונח – לא פסק', sources_only: 'מקורות לעיון – אין תשובה מאומתת' }[response.type] || null;
  const muted = response.type === 'related' || response.type === 'definition';
  return <div className="chat-bubble">
    {kind && <p className={`chat-kind${muted || response.type === 'sources_only' ? ' chat-kind--soft' : ''}`}>{kind}</p>}
    {response.notes?.map(note => <p key={note} className="chat-note">{note}</p>)}
    {response.text && <p className="chat-text">{response.text}</p>}
    {response.time?.times?.length > 0 && <dl className="chat-times">{response.time.times.map(row => <div key={row.key}><dt>{row.label}</dt><dd>{row.time}</dd></div>)}</dl>}
    {response.clarification && <div className="chat-clarify">
      <p className="chat-question">{response.clarification.question}</p>
      {response.clarification.options.length > 0 && <div className="chat-options">{response.clarification.options.map(option => <button type="button" key={option} disabled={!last || busy} onClick={() => onPick(option)}>{option}</button>)}</div>}
      {why.length > 0 && <details className="chat-why"><summary>למה זה משנה?</summary>{why.map(entry => <blockquote key={entry.id}>{entry.sources?.[0]?.excerpt || entry.shortAnswer}<cite>{entry.sources?.[0]?.work}, {entry.sources?.[0]?.citation}</cite></blockquote>)}</details>}
    </div>}
    {response.type === 'disagreement' && <p className="notice chat-dispute">יש בזה מחלוקת פוסקים; המקור מביא את הדעות. למעשה כדאי לשאול רב.</p>}
    {showExcerpts ? entries.map(entry => <figure key={entry.id} className="halacha-excerpt"><blockquote>{entry.sources?.[0]?.excerpt || entry.shortAnswer}</blockquote><figcaption>{entry.sources?.map(source => `${source.work}, ${source.citation}`).join(' · ')}</figcaption></figure>)
      : entries.map(entry => <EntryCard key={entry.id} entry={entry} go={go} muted={muted} />)}
    {sources.length > 0 && <div className="book-index">{sources.map(section => <button type="button" className="index-row" key={section.id} onClick={() => openSource(`Yalkut Yosef ${section.id}`, `ילקוט יוסף · ${sectionTitle(section)}`, 'nikud')}><span><strong>ילקוט יוסף · {sectionTitle(section)}</strong><small>{section.section.split(/\s*-\s*/)[1] || ''}</small></span><span aria-hidden="true">←</span></button>)}</div>}
    {related.length > 0 && <div className="chat-related"><p>כדאי לדעת גם</p><ul>{related.map(entry => <li key={entry.id}><button type="button" className="link" onClick={() => go(questionRoute(entry.id))}>{entry.question}</button></li>)}</ul></div>}
    {(response.type === 'refer_to_rabbi' || response.type === 'disagreement') && last && <RabbiDraft topic={response.flow?.title || said[0] || 'שאלה בהלכה'} trail={said.map(text => ({ question: 'כתבתי:', answer: text }))} entries={entries} sources={sources.map(section => ({ id: section.id, title: sectionTitle(section) }))} />}
  </div>;
}
