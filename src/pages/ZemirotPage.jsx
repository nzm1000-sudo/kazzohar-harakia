import { Fragment } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { BackNavigation, Breadcrumbs } from '../components/LocalNavigation.jsx';
import ReaderNavigation from '../components/ReaderNavigation.jsx';
import HeartToggle from '../components/HeartToggle.jsx';
import { routeFavorite } from '../services/favorites.mjs';

// פיוטים וזמירות לשבת — the Shabbat zemirot, by meal, offline (data/liturgy/zemirot.mjs, Hebrew Wikisource CC BY-SA).
// Routes: siddur-zemirot | siddur-zemirot/<id>. The pack is its own chunk, loaded the first time it is opened.
const loadZemirot = () => import('../data/liturgy/zemirot.mjs').then(module => module.default);
export const zemirotRoute = id => (id ? `siddur-zemirot/${encodeURIComponent(id)}` : 'siddur-zemirot');

// One stanza line: acrostic letters (<b>) stay bold, notes and variants (<small>) quiet. No HTML is injected.
function Line({ markup }) {
  const parts = String(markup || '').split(/(<b>[\s\S]*?<\/b>|<small>[\s\S]*?<\/small>)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('<b>')) return <b key={index}>{part.slice(3, -4)}</b>;
    if (part.startsWith('<small>')) return <small key={index} className="zemer-note">{part.slice(7, -8).replace(/<[^>]+>/g, '')}</small>;
    return <Fragment key={index}>{part.replace(/<[^>]+>/g, '')}</Fragment>;
  });
}

export default function ZemirotPage({ route, go, onBack }) {
  const pack = useResource(loadZemirot, []);
  const [font, setFont] = useLocal('zemirot-font-v1', 24);
  const parts = String(route || '').split('/');
  // siddur-zemirot/g/<meal>: one meal's zemirot; siddur-zemirot/<id>: one zemer.
  const meal = parts[1] === 'g' ? parts[2] : null;
  const id = meal ? '' : decodeURIComponent(parts[1] || '');
  const all = pack.data ? pack.data.groups.flatMap(group => group.items.map(item => ({ ...item, group }))) : [];
  const item = id ? all.find(entry => entry.id === id) : null;
  if (pack.loading) return <section className="zemirot"><p className="loading" role="status">פותחים את הזמירות…</p></section>;
  if (!pack.data) return <section className="zemirot"><BackNavigation label="חזרה לסידור" onClick={onBack} /><p className="notice" role="alert">הזמירות אינן זמינות כרגע.</p></section>;
  if (!item) return <section className="zemirot zemirot-index">
    <BackNavigation label="חזרה לסידור" onClick={onBack} />
    <header className="zemirot-head"><h1>פיוטים וזמירות</h1><span className="gold-divider" aria-hidden="true"><i /></span><p>זמירות לשבת, לפי הסעודות</p></header>
    {pack.data.groups.filter(group => !meal || group.key === meal).map(group => <section key={group.key} className="zemirot-group" aria-label={group.title}>
      <h2>{group.title}</h2>
      <div className="zemirot-grid">{group.items.map(entry => <button type="button" key={`${group.key}:${entry.id}`} onClick={() => go(zemirotRoute(entry.id))}><strong>{entry.title}</strong>{entry.author && <small>{entry.author}</small>}</button>)}</div>
    </section>)}
    <footer className="source-credit"><p>הטקסט: {pack.data.source.attribution} ({pack.data.source.license}); כל פיוט מקושר לדף שלו ולגרסה שנלקחה.</p></footer>
  </section>;
  const list = item.group.items;
  const index = list.findIndex(entry => entry.id === item.id);
  const step = entry => entry && { ...entry, title: entry.title };
  return <section className="zemirot zemirot-reader" style={{ '--zemer-size': `${font}px` }}>
    <Breadcrumbs items={[{ label: 'סידור', onNavigate: () => go('siddur') }, { label: 'פיוטים וזמירות', onNavigate: () => go(zemirotRoute()) }, { label: item.group.title }]} />
    <BackNavigation label="לכל הזמירות" onClick={() => go(zemirotRoute())} />
    <header className="zemirot-head">
      <p className="eyebrow">{item.group.title}</p>
      <div className="reader-title-row"><h1>{item.title}</h1><HeartToggle item={routeFavorite('prayer', zemirotRoute(item.id), `${item.title} · זמירות לשבת`)} /></div>
      {item.author && <p className="zemirot-author">{item.author}</p>}
      <span className="gold-divider" aria-hidden="true"><i /></span>
      <div className="reader-tools"><button type="button" onClick={() => setFont(size => Math.max(18, size - 2))} aria-label="הקטנת גופן">א−</button><button type="button" onClick={() => setFont(size => Math.min(40, size + 2))} aria-label="הגדלת גופן">א+</button></div>
    </header>
    <article className="zemer-text" lang="he">{item.paragraphs.map((paragraph, i) => <p key={i} className="zemer-stanza">{String(paragraph).split(/<br\s*\/?>/i).map((line, j, lines) => <Fragment key={j}><Line markup={line} />{j < lines.length - 1 && <br />}</Fragment>)}</p>)}</article>
    <ReaderNavigation previous={step(list[index - 1])} next={step(list[index + 1])} onSelect={target => go(zemirotRoute(target.id), { replace: true })} endLabel={`סוף ${item.group.title}`} />
    <footer className="source-credit"><p>{pack.data.source.attribution} · {pack.data.source.license} · <a href={item.url} target="_blank" rel="noreferrer">הדף בוויקיטקסט ↗</a></p></footer>
  </section>;
}
