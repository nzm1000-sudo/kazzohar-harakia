// מצב חו״ל — where the user is (Eretz Yisrael or outside it), detected from the active location, and what that means
// for the second day of Yom Tov, following the app's halachic line (Maran, as ruled by Maran HaRav Ovadia Yosef):
//
//   • A resident of Eretz Yisrael abroad who intends to return keeps ONE day: on the second day he prays the weekday
//     prayers (privately, with tefillin), but does no melacha where there are Jews — שולחן ערוך או״ח תצו, ג; הלכה יומית
//     (על פי פסקי מרן הרב עובדיה יוסף) "דיני יום טוב שני של גלויות" (HalachaID=602) ו"המשך דיני…" (603).
//   • A resident of the diaspora in Eretz Yisrael (even with a home there, while he intends to return) keeps TWO days,
//     "דינם כבני חוץ לארץ לכל דבר" — הלכה יומית 603. (שו״ת חכם צבי סי׳ קסז holds one day; not the app's line.)
//
// So the calendar follows the user's residence ("מעמד הלכתי"), not the place — the default rule ("לפי מרן").
// The override, "לפי המיקום", makes the calendar follow the place automatically (for one who has moved, or follows
// another ruling on his rabbi's instruction). Either way, being abroad is shown clearly.
import { timeZoneLabel } from './timeZoneLabel.mjs';

export const YOM_TOV_RULES = Object.freeze({ MARAN: 'maran', LOCATION: 'location' });
export const DIASPORA_SOURCES = Object.freeze([
  { id: 'sa-496-3', label: 'שולחן ערוך, אורח חיים תצו, ג', note: 'בני ארץ ישראל שבאו לחוץ לארץ — אסורים במלאכה ביום טוב שני בישוב, אפילו דעתם לחזור' },
  { id: 'hy-602', label: 'הלכה יומית: דיני יום טוב שני של גלויות', url: 'https://halachayomit.co.il/he/default.aspx?HalachaID=602', note: 'על פי פסקי מרן הרב עובדיה יוסף — בן ארץ ישראל בחו״ל מתפלל תפילת חול ביחידות ומניח תפילין' },
  { id: 'hy-603', label: 'הלכה יומית: המשך דיני יום טוב שני של גלויות', url: 'https://halachayomit.co.il/he/default.aspx?HalachaID=603', note: 'המלאכה אסורה במקום שיש בו יהודים; בני חו״ל בארץ ישראל — דינם כבני חוץ לארץ לכל דבר' },
  { id: 'chacham-tzvi-167', label: 'שו״ת חכם צבי, סימן קסז', note: 'דעה אחרת: בן חו״ל בארץ ישראל נוהג יום אחד — אינה הדרך של האפליקציה' },
]);

// The land for this purpose: Israel with Judea, Samaria and the Golan, and Gaza; a rough outline (longitude, latitude)
// used only when the location carries no country. Eilat is inside (one day, as practised).
const OUTLINE = [[34.22, 31.32], [34.9, 29.47], [35.03, 29.52], [35.33, 30.3], [35.45, 31.0], [35.57, 31.4], [35.57, 31.8], [35.55, 32.4], [35.64, 32.69], [35.77, 32.74], [35.92, 32.96], [35.86, 33.29], [35.63, 33.28], [35.5, 33.1], [35.1, 33.1], [34.95, 32.82], [34.6, 31.95]];
function insideOutline(longitude, latitude) {
  let inside = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i];
    const [xj, yj] = OUTLINE[j];
    if ((yi > latitude) !== (yj > latitude) && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// true / false, or null when the location says nothing usable.
export function isInEretzYisrael(location) {
  if (!location || typeof location !== 'object') return null;
  const code = String(location.countryCode || location.cc || '').toLowerCase();
  if (code) return code === 'il' || code === 'ps';
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) return insideOutline(longitude, latitude);
  if (typeof location.il === 'boolean') return location.il;
  return null;
}

const residenceOf = settings => settings?.residenceChoice || settings?.halachicResidenceStatus || (settings?.il === false ? 'diaspora' : 'israel');

// Everything the indicator needs, from the saved settings (residence, rule, location).
export function diasporaStatus(settings = {}) {
  const residence = residenceOf(settings);
  const rule = settings?.yomTovRule === YOM_TOV_RULES.LOCATION ? YOM_TOV_RULES.LOCATION : YOM_TOV_RULES.MARAN;
  const here = isInEretzYisrael(settings?.location);
  const abroad = here === false;
  const regime = rule === YOM_TOV_RULES.LOCATION && here !== null ? (here ? 'israel' : 'diaspora') : residence;
  const place = settings?.location?.name || '';
  let headline;
  let detail;
  if (rule === YOM_TOV_RULES.LOCATION) {
    headline = here === null ? 'המיקום אינו ידוע · הלוח לפי המעמד ההלכתי' : here ? 'בארץ ישראל · יום טוב אחד' : 'מצב חו״ל · שני ימים טובים';
    detail = 'הלוח עוקב אחר המיקום הפעיל (בחירה ידנית, לא ברירת המחדל). לפי מרן, הדין נקבע לפי מקום המגורים וכוונת החזרה.';
  } else if (residence === 'israel' && abroad) {
    headline = 'מצב חו״ל · תושב ארץ ישראל';
    detail = 'לפי מרן: בן ארץ ישראל שדעתו לחזור נוהג יום טוב אחד. ביום טוב שני מתפלל תפילת חול ביחידות ומניח תפילין בביתו, ונזהר ממלאכה במקום שיש בו יהודים.';
  } else if (residence === 'diaspora' && here === true) {
    headline = 'בארץ ישראל · תושב חו״ל';
    detail = 'לפי מרן: בני חוץ לארץ בארץ ישראל שדעתם לחזור שומרים שני ימים טובים, כבני חוץ לארץ לכל דבר.';
  } else if (residence === 'diaspora') {
    headline = 'חוץ לארץ · שני ימים טובים';
    detail = 'הלוח לפי מנהג בני חוץ לארץ.';
  } else {
    headline = here === null ? 'ארץ ישראל · יום טוב אחד' : 'בארץ ישראל · יום טוב אחד';
    detail = 'הלוח לפי מנהג בני ארץ ישראל.';
  }
  return { residence, rule, here, abroad, regime, changed: regime !== residence, place, zone: timeZoneLabel(settings?.location?.tzid), headline, detail };
}

// The settings every calendar computation reads: halachicResidenceStatus becomes the effective regime; the user's own
// choice stays in residenceChoice (what the settings screen shows and edits). Unchanged under the default rule.
export function applyYomTovRule(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  const status = diasporaStatus(settings);
  if (!status.changed) return settings;
  return { ...settings, residenceChoice: status.residence, halachicResidenceStatus: status.regime, il: status.regime === 'israel' };
}
