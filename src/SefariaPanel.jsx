import { useState } from 'react';
import { getText, search, sefariaLink } from './services/sefaria.mjs';

export default function SefariaPanel({ T }) {
  const [probe, setProbe] = useState({ state: 'idle' });
  const [query, setQuery] = useState('בורא נפשות');
  const [results, setResults] = useState({ state: 'idle' });

  const runProbe = async () => {
    setProbe({ state: 'loading' });
    try {
      const text = await getText('Psalms.23');
      setProbe({ state: 'ok', text });
    } catch (error) {
      setProbe({ state: 'error', message: error.message });
    }
  };

  const runSearch = async event => {
    event.preventDefault();
    if (!query.trim()) return;
    setResults({ state: 'loading' });
    try {
      const hits = await search(query);
      setResults({ state: hits.length ? 'ok' : 'empty', hits });
    } catch (error) {
      setResults({ state: 'error', message: error.message });
    }
  };

  return (
    <div className="sefaria-panel" style={{ padding: 14, direction: 'rtl', display: 'grid', gap: 12 }}>
      <section style={{ background: T.card, border: '1px solid ' + T.border, borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>בדיקת חיבור לספרית ספריא</h3>
          <button onClick={runProbe} disabled={probe.state === 'loading'} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid ' + T.gold, background: T.gold, color: '#111', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            {probe.state === 'loading' ? 'בודק…' : 'בדיקה · תהילים כג'}
          </button>
        </div>
        {probe.state === 'ok' && (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 2 }}>{probe.text.hebrew[0]}</p>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: T.muted }}>
              {probe.text.ref} · {probe.text.version} · {probe.text.license} ·{' '}
              <a href={sefariaLink(probe.text.ref)} target="_blank" rel="noreferrer" style={{ color: T.blue }}>מקור בספריא ↗</a>
            </p>
          </div>
        )}
        {probe.state === 'error' && <p className="notice error" role="alert" style={{ marginTop: 10 }}>{probe.message}</p>}
      </section>

      <section style={{ background: T.card, border: '1px solid ' + T.border, borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>חיפוש במקורות</h3>
        <form onSubmit={runSearch} style={{ display: 'flex', gap: 6 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} aria-label="חיפוש בספריא"
            placeholder="לדוגמה: בורא נפשות · יעלה ויבוא"
            style={{ flex: 1, background: 'transparent', border: '1px solid ' + T.border, color: T.text, padding: '8px 12px', borderRadius: 8, fontFamily: 'inherit' }} />
          <button type="submit" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.card, color: T.text, cursor: 'pointer', fontFamily: 'inherit' }}>חיפוש</button>
        </form>
        {results.state === 'loading' && <p className="notice" role="status">מחפש בספריא…</p>}
        {results.state === 'error' && <p className="notice error" role="alert">{results.message}</p>}
        {results.state === 'empty' && <p className="notice">לא נמצאו תוצאות בספריא.</p>}
        {results.state === 'ok' && (
          <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {results.hits.map((hit, i) => (
              <li key={i} style={{ borderTop: '1px solid ' + T.border, paddingTop: 8 }}>
                <a href={hit.link} target="_blank" rel="noreferrer" style={{ color: T.blue, fontSize: 14 }}>
                  {hit.title} · {hit.ref} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
