import { useState } from 'react';
import { listBookmarks, toggleBookmark } from '../services/bookmarks.mjs';

export default function BookmarksPage({ openSource, openPsalm, go }) {
  const [items, setItems] = useState(() => listBookmarks());
  const remove = item => {
    toggleBookmark(item);
    setItems(listBookmarks());
  };
  return <section className="books-page">
    <p className="eyebrow">הספרייה שלי</p>
    <h1>סימניות</h1>
    {!items.length && <p className="notice">עדיין לא נוספו סימניות.</p>}
    <div className="book-index">{items.map(item => <div className="index-row" key={item.id}>
      <button className="link" type="button" onClick={() => {
        if (item.type === 'tehillim') return openPsalm(item.chapter);
        if (item.type === 'talmud') return go(`talmud/${encodeURIComponent(item.reference.split(' ').slice(0, -1).join(' '))}/${item.reference.split(' ').at(-1)}`);
        openSource(item.reference, item.title, 'nikud');
      }}><strong>{item.title}</strong></button>
      <button className="link" type="button" onClick={() => remove(item)}>הסרה</button>
    </div>)}</div>
  </section>;
}