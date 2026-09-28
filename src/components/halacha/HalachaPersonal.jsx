import { useEffect, useState } from 'react';
import { PRACTICAL_HALACHA_QA_INDEX } from '../../data/practicalHalachaQa.mjs';
import { HALACHA_TRACKS, HALACHA_TRACK_INDEX } from '../../data/halachaTracks.mjs';
import { readCollections, collectionById, createCollection, renameCollection, deleteCollection, toggleInCollection, onCollectionsChange, SUGGESTED_COLLECTIONS } from '../../services/collections.mjs';
import { isLearned, toggleLearned, dueRecall, recalled, trackProgress } from '../../services/halachaLearning.mjs';
import { questionRoute } from './HalachaHubParts.jsx';

export const collectionsRoute = id => (id ? `halacha/collections/${encodeURIComponent(id)}` : 'halacha/collections');
export const trackRoute = id => `halacha/track/${encodeURIComponent(id)}`;

function useCollections() {
  const [list, setList] = useState(() => readCollections());
  useEffect(() => onCollectionsChange(() => setList(readCollections())), []);
  return list;
}

// On a halacha page: "למדתי" and the collections this item sits in.
export function PersonalActions({ item, entryId }) {
  const collections = useCollections();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [learned, setLearned] = useState(() => isLearned(entryId));
  useEffect(() => setLearned(isLearned(entryId)), [entryId]);
  const memberOf = collections.filter(collection => collection.items.some(saved => saved.key === item.key));
  const add = event => { event.preventDefault(); const created = createCollection(name); if (created) { toggleInCollection(created.id, item); setName(''); } };
  return <div className="personal-halacha">
    <div className="personal-halacha-row">
      <button type="button" className={`ghost learned-toggle${learned ? ' is-on' : ''}`} aria-pressed={learned} onClick={() => { toggleLearned(entryId); setLearned(isLearned(entryId)); }}>{learned ? '✓ למדתי' : 'למדתי'}</button>
      <button type="button" className="ghost" aria-expanded={open} onClick={() => setOpen(value => !value)}>{memberOf.length ? `באוספים: ${memberOf.map(collection => collection.name).join(', ')}` : 'הוספה לאוסף'}</button>
    </div>
    {open && <div className="collection-picker">
      {collections.length > 0 && <div className="collection-picker-list">{collections.map(collection => {
        const has = collection.items.some(saved => saved.key === item.key);
        return <button type="button" key={collection.id} className={has ? 'is-on' : ''} aria-pressed={has} onClick={() => toggleInCollection(collection.id, item)}>{has ? '✓ ' : ''}{collection.name}</button>;
      })}</div>}
      <form className="collection-new" onSubmit={add}>
        <label htmlFor="collection-name" className="visually-hidden">שם לאוסף חדש</label>
        <input id="collection-name" value={name} onChange={event => setName(event.target.value)} placeholder="אוסף חדש" list="collection-suggestions" maxLength={40} />
        <datalist id="collection-suggestions">{SUGGESTED_COLLECTIONS.filter(suggestion => !collections.some(collection => collection.name === suggestion)).map(suggestion => <option key={suggestion} value={suggestion} />)}</datalist>
        <button type="submit" disabled={!name.trim()}>הוספה</button>
      </form>
    </div>}
  </div>;
}

export function CollectionsPage({ go }) {
  const collections = useCollections();
  const [name, setName] = useState('');
  return <section className="halacha-flow">
    <p className="eyebrow">אישי</p><h1>האוספים שלי</h1>
    <p className="intro">אוספים נשמרים במכשיר בלבד. הלכה אחת יכולה להיות בכמה אוספים.</p>
    <form className="collection-new" onSubmit={event => { event.preventDefault(); if (createCollection(name)) setName(''); }}>
      <label htmlFor="collection-create" className="visually-hidden">שם לאוסף חדש</label>
      <input id="collection-create" value={name} onChange={event => setName(event.target.value)} placeholder="שם לאוסף חדש, למשל: שבת" maxLength={40} />
      <button type="submit" disabled={!name.trim()}>יצירה</button>
    </form>
    {collections.length === 0 ? <p className="notice">עוד אין אוספים. אפשר ליצור כאן, או מתוך כל דף הלכה.</p>
      : <div className="book-index">{collections.map(collection => <button type="button" className="index-row" key={collection.id} onClick={() => go(collectionsRoute(collection.id))}><span><strong>{collection.name}</strong><small>{collection.items.length === 1 ? 'פריט אחד' : `${collection.items.length} פריטים`}</small></span><span aria-hidden="true">←</span></button>)}</div>}
  </section>;
}

export function CollectionPage({ id, go }) {
  useCollections();
  const collection = collectionById(id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(collection?.name || '');
  const [confirm, setConfirm] = useState(false);
  if (!collection) return <p className="notice">האוסף לא נמצא.</p>;
  return <section className="halacha-flow">
    <p className="eyebrow">אוסף</p>
    {editing ? <form className="collection-new" onSubmit={event => { event.preventDefault(); renameCollection(collection.id, name); setEditing(false); }}>
      <label htmlFor="collection-rename" className="visually-hidden">שם האוסף</label>
      <input id="collection-rename" value={name} onChange={event => setName(event.target.value)} maxLength={40} autoFocus />
      <button type="submit" disabled={!name.trim()}>שמירה</button>
    </form> : <h1>{collection.name}</h1>}
    <div className="personal-halacha-row">
      {!editing && <button type="button" className="ghost" onClick={() => { setName(collection.name); setEditing(true); }}>שינוי שם</button>}
      {!confirm ? <button type="button" className="ghost" onClick={() => setConfirm(true)}>מחיקת האוסף</button>
        : <button type="button" className="ghost danger" onClick={() => { deleteCollection(collection.id); go(collectionsRoute()); }}>למחוק את "{collection.name}"? (הפריטים עצמם לא נמחקים)</button>}
    </div>
    {collection.items.length === 0 ? <p className="notice">האוסף ריק. מוסיפים אליו מתוך דף הלכה, בכפתור "הוספה לאוסף".</p>
      : <div className="book-index">{collection.items.map(item => <div className="index-row collection-item" key={item.key}>
        <button type="button" className="collection-item-open" onClick={() => go(item.open?.route || 'halacha')}><strong>{item.title}</strong>{item.subtitle && <small>{item.subtitle}</small>}</button>
        <button type="button" className="ghost" aria-label={`הוצאה מהאוסף: ${item.title}`} onClick={() => toggleInCollection(collection.id, item)}>הוצאה</button>
      </div>)}</div>}
  </section>;
}

export function TracksList({ go }) {
  return <section className="halacha-hub-list"><h2>מסלולי לימוד</h2><div className="book-index">{HALACHA_TRACKS.map(track => {
    const progress = trackProgress(track);
    return <button type="button" className="index-row" key={track.id} onClick={() => go(trackRoute(track.id))}><span><strong>{track.title}</strong><small>{track.subtitle}{progress.done ? ` · ${progress.done} מתוך ${progress.total}` : ` · ${progress.total} הלכות`}</small></span><span aria-hidden="true">←</span></button>;
  })}</div></section>;
}

export function TrackPage({ id, go }) {
  const track = HALACHA_TRACK_INDEX[id];
  const [, refresh] = useState(0);
  if (!track) return <p className="notice">המסלול לא נמצא.</p>;
  const progress = trackProgress(track);
  return <section className="halacha-flow">
    <p className="eyebrow">מסלול לימוד</p><h1>{track.title}</h1>
    <p className="intro">{track.subtitle}. {progress.done ? `למדת ${progress.done} מתוך ${progress.total}.` : `${progress.total} הלכות, לפי הסדר.`}</p>
    {progress.nextId && <button type="button" className="halacha-routed-flow" onClick={() => go(questionRoute(progress.nextId))}><span className="eyebrow">{progress.done ? 'להמשיך' : 'להתחיל'}</span><strong>{PRACTICAL_HALACHA_QA_INDEX[progress.nextId]?.question}</strong></button>}
    <ol className="track-list">{track.entryIds.map((entryId, index) => {
      const entry = PRACTICAL_HALACHA_QA_INDEX[entryId];
      const done = isLearned(entryId);
      return <li key={entryId} className={done ? 'is-done' : ''}>
        <button type="button" className="track-item" onClick={() => go(questionRoute(entryId))}><span className="track-number" aria-hidden="true">{done ? '✓' : index + 1}</span><span><strong>{entry?.question}</strong><small>{entry?.topic}</small></span></button>
        <button type="button" className="ghost track-mark" aria-pressed={done} onClick={() => { toggleLearned(entryId); refresh(value => value + 1); }}>{done ? '✓ למדתי' : 'למדתי'}</button>
      </li>;
    })}</ol>
  </section>;
}

// A gentle review prompt: one due item, answer revealed on request, no score.
export function RecallCard({ go }) {
  const [id, setId] = useState(() => dueRecall(undefined, Date.now(), key => Boolean(PRACTICAL_HALACHA_QA_INDEX[key])));
  const [shown, setShown] = useState(false);
  const entry = id ? PRACTICAL_HALACHA_QA_INDEX[id] : null;
  if (!entry) return null;
  const close = later => { recalled(id, undefined, Date.now(), { later }); setShown(false); setId(null); };
  return <section className="recall-card" aria-label="חזרה קצרה">
    <p className="eyebrow">חזרה קצרה · מה שלמדת</p>
    <strong>{entry.question}</strong>
    {shown ? <><p className="recall-answer">{entry.shortAnswer}</p><div className="personal-halacha-row"><button type="button" className="ghost" onClick={() => close(false)}>תודה</button><button type="button" className="link" onClick={() => go(questionRoute(entry.id))}>לדף המלא ←</button></div></>
      : <div className="personal-halacha-row"><button type="button" className="ghost" onClick={() => setShown(true)}>הצג תשובה</button><button type="button" className="link" onClick={() => close(true)}>לא עכשיו</button></div>}
  </section>;
}
