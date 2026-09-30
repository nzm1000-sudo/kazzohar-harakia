import { useEffect, useState } from 'react';
import { isFavorite, onFavoritesChange, toggleFavorite } from '../services/favorites.mjs';
import { announce } from './a11yPrimitives.jsx';

// The one heart of the app: a small outlined heart that fills when the item is saved to "מועדפים וסימניות".
// The glyph is small; the tap target keeps the full 44px.
export function useFavorite(item) {
  const [saved, setSaved] = useState(() => (item ? isFavorite(item.key) : false));
  useEffect(() => {
    if (!item) return undefined;
    setSaved(isFavorite(item.key));
    return onFavoritesChange(() => setSaved(isFavorite(item.key)));
  }, [item?.key]);
  return [saved, () => { if (item) { toggleFavorite(item); setSaved(isFavorite(item.key)); } }];
}

export function HeartIcon({ filled }) {
  return <svg className="heart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 20.3s-7.3-4.4-9.2-9.1C1.5 7.9 3.6 4.6 6.9 4.6c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.3 0 5.4 3.3 4.1 6.6-1.9 4.7-9.2 9.1-9.2 9.1z" fill={filled ? 'currentColor' : 'none'} />
  </svg>;
}

export default function HeartToggle({ item, className = '' }) {
  const [saved, toggle] = useFavorite(item);
  if (!item) return null;
  // A toggle keeps one name; its state is aria-pressed ("נבחר" / "לא נבחר"), and the change is announced once.
  const onClick = () => { toggle(); announce(saved ? 'הוסר ממועדפים וסימניות' : 'נשמר במועדפים וסימניות'); };
  return <button type="button" className={`heart-toggle${saved ? ' is-saved' : ''}${className ? ` ${className}` : ''}`} aria-pressed={saved}
    aria-label={`שמירה במועדפים וסימניות: ${item.title}`} title={saved ? 'שמור במועדפים' : 'שמירה במועדפים'} onClick={onClick}>
    <HeartIcon filled={saved} />
  </button>;
}
