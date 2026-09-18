import { useState, useEffect } from 'react';
import { psalmIndex, matches } from './content.mjs';
import { useLocal } from './hooks.jsx';
import ReaderNavigation from './components/ReaderNavigation.jsx';

const SOURCE = 'טקסט מנוקד · נחלת הציבור · tanach.us דרך Sefaria · נאסף 2026-09-18';
const btn = (T, on) => ({ padding: '5px 12px', borderRadius: 18, border: '1px solid ' + T.border, cursor: 'pointer', fontSize: 12, background: on ? T.gold : 'transparent', color: on ? '#111' : T.muted, fontWeight: on ? 700 : 400, fontFamily: 'inherit' });

export default function Tehillim({ T }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [chapter, setChapter] = useLocal('tehillim-position-v1', 1);
  const [favorites, setFavorites] = useLocal('tehillim-favorites-v1', []);
  const [font, setFont] = useLocal('tehillim-font-v1', 22);
  const [q, setQ] = useState('');
  const [shareMsg, setShareMsg] = useState('');
  useEffect(() => {
    let live = true;
    import('./data/tehillim.json').then(m => live && setData(m.default)).catch(() => live && setError('טעינת הטקסט נכשלה'));
    return () => { live = false; };
  }, []);
  const verses = data?.chapters?.[chapter - 1];
  const chapterItem = value => ({ title: `פרק ${psalmIndex[value - 1].title.replace('תהילים ', '')}`, value });
  const changeChapter = value => { setChapter(value); window.scrollTo({ top: 0 }); };
  const hits = q.trim() ? psalmIndex.filter(p => matches(p, q)) : [];
  const share = () => {
    const text = 'תהילים פרק ' + chapter;
    if (navigator.share) navigator.share({ title: text, text }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => setShareMsg('הועתק'), () => setShareMsg(''));
    else setShareMsg('');
  };
  return (
    <div style={{ padding: 14, direction: 'rtl' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <input aria-label="חיפוש פרק תהילים" placeholder="חיפוש פרק (לדוגמה: קכא)" value={q} onChange={e => setQ(e.target.value)}
          style={{ flex: '1 1 170px', background: T.card, border: '1px solid ' + T.border, color: T.text, padding: '7px 12px', borderRadius: 8, fontFamily: 'inherit' }} />
        <button onClick={() => changeChapter(Math.max(1, chapter - 1))} style={btn(T, false)}>→ קודם</button>
        <strong style={{ fontSize: 15, color: T.text, minWidth: 110, textAlign: 'center' }}>תהילים {psalmIndex[chapter - 1].title.replace('תהילים ', '')}</strong>
        <button onClick={() => changeChapter(Math.min(150, chapter + 1))} style={btn(T, false)}>הבא ←</button>
        <button onClick={() => setFavorites(f => f.includes(chapter) ? f.filter(v => v !== chapter) : [...f, chapter])} aria-label="מועדפים" style={btn(T, favorites.includes(chapter))}>{favorites.includes(chapter) ? '♥' : '♡'}</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.muted, fontSize: 12 }}>גודל טקסט
          <input type="range" min="18" max="34" value={font} onChange={e => setFont(Number(e.target.value))} aria-label="גודל טקסט" />
        </label>
      </div>
      {hits.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {hits.slice(0, 12).map(p => <button key={p.chapter} onClick={() => { changeChapter(p.chapter); setQ(''); }} style={btn(T, p.chapter === chapter)}>{p.title}</button>)}
      </div>}
      {favorites.length > 0 && <p style={{ color: T.muted, fontSize: 12, marginBottom: 10 }}>מועדפים: {favorites.slice().sort((a, b) => a - b).map((c, i) =>
        <button key={i} onClick={() => changeChapter(c)} style={{ ...btn(T, false), marginLeft: 4 }}>{c}</button>)}</p>}
      {!data && !error && <p className="notice">טוען טקסט מנוקד…</p>}
      {error && <p className="notice error">{error}</p>}
      {verses && (
        <article className="psalm-text" lang="he" style={{ fontSize: font, lineHeight: 1.9, color: T.text, background: T.card, border: '1px solid ' + T.border, borderRadius: 12, padding: '18px 16px' }}>
          {verses.map((v, i) => <p key={i} style={{ margin: '0 0 10px' }}>{v} <span style={{ color: T.gold, fontSize: '0.7em' }}>({i + 1})</span></p>)}
          <footer style={{ borderTop: '1px solid ' + T.border, marginTop: 12, paddingTop: 8, fontSize: 11, color: T.muted, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{SOURCE}</span>
            <button onClick={share} style={btn(T, false)}>שיתוף</button>
            <span role="status">{shareMsg}</span>
          </footer>
          <ReaderNavigation previous={chapter > 1 ? chapterItem(chapter - 1) : null} next={chapter < 150 ? chapterItem(chapter + 1) : null} onSelect={item => changeChapter(item.value)} endLabel="סיימת את ספר תהילים" />
        </article>
      )}
    </div>
  );
}
