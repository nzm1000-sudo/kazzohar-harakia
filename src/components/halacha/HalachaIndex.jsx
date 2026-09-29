import { useMemo } from 'react';
import { useRouteState } from '../../hooks.jsx';
import { initialOpenState, routeForOpenState, toggleOpen, topicKey } from '../../services/halachaIndexRoute.mjs';
import { publishedPracticalQuestions } from '../../data/practicalHalachaQa.mjs';
import { HALACHA_TOPICS } from '../../data/halachaLibrary.mjs';
import { normalizeQuery } from '../../services/halachaSearch.mjs';
import ClearableInput from '../ClearableInput.jsx';

// "כל השאלות": every verified question, by subject and topic. These are exactly the questions the assistant answers,
// in its own wording — tapping one asks it in the conversation, so the answer never depends on phrasing.
const ORDER = HALACHA_TOPICS.map(topic => topic.id);
const titleOf = id => HALACHA_TOPICS.find(topic => topic.id === id)?.title || 'שונות';

export function askInChat(go, text) {
  try { sessionStorage.setItem('kz-halacha-chat-seed', String(text || '').slice(0, 300)); } catch { /* ignore */ }
  go('halacha/chat');
}

export default function HalachaIndex({ go, route }) {
  // The filter and every open group/topic belong to this history entry: Back from an answer returns to them exactly
  // (the scroll position is restored by the app). The latest opened group/topic is also written into the route.
  const [filter, setFilter] = useRouteState('halacha-index-filter', '');
  const [openState, setOpenState] = useRouteState('halacha-index-open', () => initialOpenState(route, null));
  const setOpen = (group, topic, open) => {
    const next = toggleOpen(openState, { group, topic, open });
    const same = next.groups.join('|') === openState.groups.join('|') && next.topics.join('|') === openState.topics.join('|');
    if (same) return;
    setOpenState(next);
    go(routeForOpenState(next), { replace: true, quiet: true });
  };
  const groups = useMemo(() => {
    const byCategory = new Map();
    for (const entry of publishedPracticalQuestions()) {
      if (entry.sensitivity === 'sensitive') continue;
      const category = byCategory.get(entry.category) || new Map();
      const topic = entry.topic || 'כללי';
      category.set(topic, [...(category.get(topic) || []), entry]);
      byCategory.set(entry.category, category);
    }
    return [...byCategory.entries()]
      .sort(([a], [b]) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
      .map(([id, topics]) => ({ id, title: titleOf(id), topics: [...topics.entries()].sort((a, b) => b[1].length - a[1].length), count: [...topics.values()].reduce((sum, list) => sum + list.length, 0) }));
  }, []);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const needle = normalizeQuery(filter);
  const matches = useMemo(() => {
    if (needle.length < 2) return null;
    const words = needle.split(' ');
    return groups.flatMap(group => group.topics.flatMap(([, list]) => list)).filter(entry => { const hay = normalizeQuery(`${entry.question} ${entry.topic}`); return words.every(word => hay.includes(word)); });
  }, [needle, groups]);
  const row = entry => <button type="button" className="index-row halacha-index-q" key={entry.id} onClick={() => askInChat(go, entry.question)}>
    <span><strong>{entry.question}</strong></span><span aria-hidden="true">←</span>
  </button>;

  return <section className="halacha-index" aria-label="מאגר השאלות השלם">
    <p className="eyebrow">הלכה חכמה</p>
    <h1>מאגר השאלות השלם.</h1>
    <p className="intro">{total} שאלות שנותחו ואומתו מול המקור, לפי נושא. לחיצה על שאלה שואלת אותה בשיחה – בדיוק בניסוח שהעוזר מזהה.</p>
    <ClearableInput value={filter} onChange={event => setFilter(event.target.value)} placeholder="סינון: למשל תפילין, בשר, נרות" autoComplete="off" clearLabel="נקה סינון" />
    {matches ? <div className="book-index halacha-index-list">
      <p className="halacha-results-label">{matches.length ? `${matches.length} שאלות` : 'אין שאלה מאומתת עם המילים האלה'}</p>
      {matches.slice(0, 80).map(row)}
    </div> : groups.map(group => <details key={group.id} className="halacha-index-group" open={openState.groups.includes(group.id)} onToggle={event => setOpen(group.id, null, event.currentTarget.open)}>
      <summary><strong>{group.title}</strong><small>{group.count} שאלות</small></summary>
      {group.topics.map(([topic, list]) => <details key={topic} className="halacha-index-topic" open={openState.topics.includes(topicKey(group.id, topic))} onToggle={event => setOpen(group.id, topic, event.currentTarget.open)}>
        <summary><span>{topic}</span><small>{list.length}</small></summary>
        <div className="book-index">{list.map(row)}</div>
      </details>)}
    </details>)}
  </section>;
}
