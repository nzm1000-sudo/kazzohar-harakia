import { useTorahCatalog } from './useTorah.js';
import { articlesForHoliday, articlesForParasha, torahRoute } from '../../services/torahContent.mjs';
import { holidayIdsFor, holidayLabel, parashotOfReading } from '../../services/torahTaxonomy.mjs';
import ArrowMark from '../ui/ArrowMark.jsx';

const daysBetween = (from, to) => Math.round((new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / 86400000);
const countLabel = count => (count === 1 ? 'דבר תורה אחד' : `${count} דברי תורה`);

/**
 * What the "מה חשוב היום" line offers, from the day's context alone: a festival within three days (the upcoming-holiday
 * mechanism), else from Wednesday the coming Shabbat's parasha. Nothing on Shabbat or on a festival itself — the app does
 * not invite opening it then. Pure (tests call it); null when there is nothing to offer.
 */
export function torahTodayOffer(context, catalog) {
  const key = context?.key;
  if (!key || context?.shabbat || context?.weekday === 6) return null;
  if ((context.events || []).some(event => event.category === 'holiday' && (event.subcat === 'major' || /chag|yom tov/i.test(event.subcat || '')))) return null;
  const holiday = context.upcomingHoliday;
  const holidayKey = holiday?.date?.slice?.(0, 10);
  if (holidayKey) {
    const ahead = daysBetween(key, holidayKey);
    const id = holidayIdsFor(holiday).find(candidate => articlesForHoliday(catalog, candidate).length);
    if (id && ahead >= 1 && ahead <= 3) return { kicker: 'דברי תורה לחג', title: holidayLabel(id), count: articlesForHoliday(catalog, id).length, route: torahRoute.holiday(id) };
  }
  if (![3, 4, 5].includes(context.weekday)) return null;
  // What is read on the coming Shabbat (dayContext.weekReading): a festival Shabbat has no parasha card; on Israel's
  // Shemini Atzeret it is וזאת הברכה.
  const reading = context.weekReading;
  const parashot = parashotOfReading(reading ? (reading.kind === 'parasha' ? reading.name : null) : (context.parasha?.hebrew || context.parasha?.title));
  const count = parashot.length ? articlesForParasha(catalog, parashot).length : 0;
  return count ? { kicker: 'דברי תורה לשבת', title: `פרשת ${parashot.join('־')}`, count, route: torahRoute.parasha(parashot[0]) } : null;
}

// A small line in "מה חשוב היום", in the same form as its neighbours. The index loads only when there is something to offer.
export default function TorahTodayCard({ context, onNav }) {
  const due = Boolean(context?.key) && !context?.shabbat && ([3, 4, 5].includes(context?.weekday) || Boolean(context?.upcomingHoliday));
  const catalog = useTorahCatalog({ enabled: due });
  const offer = due ? torahTodayOffer(context, catalog) : null;
  if (!offer) return null;
  return <button type="button" className="today-feature tc-today" onClick={() => onNav(offer.route)}>
    <span>{offer.kicker}</span><strong>{`${offer.title} · ${countLabel(offer.count)}`}</strong><ArrowMark className="today-go" clayOnly />
  </button>;
}
