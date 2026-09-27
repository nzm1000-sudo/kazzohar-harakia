import { useEffect, useState } from 'react';
import { BackLink } from '../components/LocalNavigation.jsx';
import HeartToggle, { HeartIcon } from '../components/HeartToggle.jsx';
import { FAVORITE_GROUPS, onFavoritesChange, readFavorites } from '../services/favorites.mjs';
import { readPersonal, toggleBookmark, toggleFavorite as toggleLibraryFavorite } from '../services/library/personal.mjs';
import { workById } from '../data/library/registry.mjs';
import { libraryRoute, pointLabel } from './LibraryPage.jsx';
import { formatVisibleSourceTitle, isTanakhReference } from '../services/tanakhReferences.mjs';
import TanakhRefText from '../components/TanakhRefText.jsx';
import { formatGregorianDate } from '../civilDate.mjs';
import { MOADIM } from '../data/siddurMoadim.mjs';
import siddurOffline from '../data/siddurOffline.mjs';

// Items saved before titles were kept carry only their reference: name them in Hebrew — the festivals shelf's own
// titles first, then the siddur's Hebrew section names — before falling back to the general reference formatter.
const MOADIM_TITLES = new Map(MOADIM.flatMap(moed => moed.items.flatMap(item => (item.flow || [item]).map(entry => [entry.reference, entry.title]))));
const siddurHebrew = reference => {
  const parts = String(reference).replace(/ \d+-\d+$/, '').split(', ');
  if (parts[0] !== 'Siddur Edot HaMizrach') return null;
  const names = [];
  let nodes = siddurOffline.schema.nodes;
  for (const part of parts.slice(1)) {
    const node = nodes?.find(entry => entry.titles?.some(title => title.lang === 'en' && title.text === part));
    if (!node) return null;
    names.push(node.titles.find(title => title.lang === 'he' && title.primary)?.text?.trim());
    nodes = node.nodes;
  }
  return names.filter(Boolean).filter((name, index, all) => all.indexOf(name) === index).join(' · ') || null;
};
export function favoriteTitle(item) {
  const reference = item.open?.reference;
  if (!reference || /[\u0590-\u05FF]/.test(item.title)) return item.title;
  return MOADIM_TITLES.get(reference) || siddurHebrew(reference) || formatVisibleSourceTitle(item.title, reference);
}

// "מועדפים וסימניות": everything saved with a heart, grouped by kind, each one tap from reopening — plus the
// library's favourite books and its unit bookmarks (kept in the library's own store).
export default function FavoritesPage({ openSource, openPsalm }) {
  const [items, setItems] = useState(readFavorites);
  const [library, setLibrary] = useState(readPersonal);
  useEffect(() => onFavoritesChange(() => setItems(readFavorites())), []);
  const open = item => {
    const target = item.open;
    if (target.type === 'source') return openSource?.(target.reference, target.title, target.mode);
    if (target.type === 'psalm') return openPsalm?.(target.chapter);
    window.location.hash = `#${target.route}`;
  };
  const libraryBooks = library.favorites.map(id => workById(id)).filter(Boolean);
  const libraryMarks = library.bookmarks.map(mark => ({ mark, work: workById(mark.workId) })).filter(entry => entry.work);
  const savedOn = at => (at && !at.startsWith('1970') ? `נשמר ${formatGregorianDate(at.slice(0, 10))}` : '');
  const empty = !items.length && !libraryBooks.length && !libraryMarks.length;
  const Row = ({ title, meta, onOpen, action }) => <div className="favorite-row">
    <button type="button" className="favorite-open" onClick={onOpen}><strong>{title}</strong>{meta && <small>{meta}</small>}</button>
    {action}
  </div>;
  return <section className="personal-tools favorites-page"><BackLink href="#personal-tools" label="כלים אישיים" /><p className="eyebrow">כלים אישיים · מועדפים וסימניות</p><h1>מועדפים וסימניות</h1>
    <p className="intro">כל מה ששמרתם בלב — תפילה, פרק, ספר או דף — נשמר כאן, במכשיר בלבד. לחיצה פותחת; לחיצה על הלב מסירה.</p>
    {empty && <p className="notice favorites-empty">עוד לא נשמר כאן דבר. בכל ספר, תפילה ופרק יש לב קטן ליד הכותרת — לחיצה עליו שומרת.</p>}
    {FAVORITE_GROUPS.map(([kind, label]) => {
      const group = items.filter(item => item.kind === kind);
      if (!group.length) return null;
      return <section className="favorite-group" key={kind}><h2>{label}</h2><div className="favorite-list">
        {group.map(item => <Row key={item.key} title={isTanakhReference(item.open.reference) ? <TanakhRefText text={favoriteTitle(item)} /> : favoriteTitle(item)} meta={[item.subtitle, savedOn(item.at)].filter(Boolean).join(' · ')} onOpen={() => open(item)} action={<HeartToggle item={item} />} />)}
      </div></section>;
    })}
    {libraryBooks.length > 0 && <section className="favorite-group"><h2>ספרים מועדפים</h2><div className="favorite-list">
      {libraryBooks.map(work => <Row key={work.workId} title={work.title} meta={work.author || ''} onOpen={() => { window.location.hash = `#${libraryRoute.work(work.workId)}`; }}
        action={<button type="button" className="heart-toggle is-saved" aria-pressed="true" aria-label={`הסרה מהספרים המועדפים: ${work.title}`} onClick={() => setLibrary(toggleLibraryFavorite(work.workId))}><HeartIcon filled /></button>} />)}
    </div></section>}
    {libraryMarks.length > 0 && <section className="favorite-group"><h2>סימניות בספרייה</h2><div className="favorite-list">
      {libraryMarks.map(({ mark, work }) => <Row key={`${mark.workId}-${mark.node}-${mark.unit}`} title={`${work.title} · ${pointLabel(work, mark.node, mark.unit)}`} meta={savedOn(mark.at)} onOpen={() => { window.location.hash = `#${libraryRoute.read(mark.workId, mark.node, mark.unit)}`; }}
        action={<button type="button" className="heart-toggle is-saved" aria-pressed="true" aria-label={`הסרת הסימנייה: ${work.title}`} onClick={() => setLibrary(toggleBookmark(mark.workId, mark.node, mark.unit))}><HeartIcon filled /></button>} />)}
    </div></section>}
  </section>;
}

