// "המסורת שלי": deterministic, offline. The structured records are filtered by the user's roots and by the day —
// no model is asked anything at runtime. Only records that pass the publication gate reach the app; family customs
// live in their own private store and are never mixed into the public records.
import { HDate } from '@hebcal/core';
import { COMMUNITIES } from '../data/tradition/communities.mjs';
import { TRADITION_SOURCES } from '../data/tradition/sources.mjs';
import { TRADITION_RECORDS } from '../data/tradition/records.mjs';
import { normalizeHebrew } from '../content.mjs';

export const TRADITION_TYPE_LABELS = {
  halacha: 'הלכה', halachic_custom: 'מנהג הלכתי', prayer_custom: 'מסורת תפילה', prayer_text_variant: 'נוסח תפילה', piyut: 'פיוט',
  melody: 'ניגון', torah_reading: 'קריאת התורה', pronunciation: 'הגייה', holiday_custom: 'מנהג חג', shabbat_custom: 'מנהג שבת',
  food_custom: 'מאכל מסורתי', life_cycle: 'מחזור החיים', wedding: 'חתונה', birth: 'לידה', brit_milah: 'ברית מילה',
  bar_mitzvah: 'בר מצווה', mourning: 'אבלות', synagogue: 'מנהג בית הכנסת', clothing: 'לבוש', language: 'לשון',
  judeo_language: 'שפה יהודית', folk_custom: 'הווי ומורשת', community_history: 'תולדות הקהילה', family_custom: 'מסורת משפחתית', oral_tradition: 'מסורת בעל פה',
};
export const NORMATIVE_LABELS = {
  law: 'דין', halachic_custom: 'מנהג הלכתי', community_custom: 'מנהג קהילתי', family_custom: 'מנהג משפחתי',
  liturgical_custom: 'מנהג בתפילה', cultural_tradition: 'מסורת תרבותית', oral_tradition: 'מסורת בעל פה',
};
// Categories, never a percentage: we have no statistical basis for one.
export const VERIFICATION_LABELS = {
  primary_verified: 'מקור ראשוני', multi_source_verified: 'מאומת ממספר מקורות', single_reliable_source: 'מקור יחיד מהימן',
  oral_documented: 'מסורת בעל פה מתועדת', needs_review: 'דרוש אימות נוסף',
};
export const CONTINUITY_LABELS = {
  documented: 'מתועד שנמשך בארץ ישראל', changed: 'המנהג השתנה', partial: 'נמשך בחלק מהקהילות', unknown: 'לא ידוע אם נמשך בכל הקהילות בארץ ישראל',
};
export const SOURCE_TYPE_LABELS = {
  primary_text: 'טקסט ראשוני', rabbinic_work: 'ספרות רבנית', manuscript: 'כתב יד', academic: 'מחקר', heritage_institute: 'מכון מורשת',
  archive: 'ארכיון', oral_testimony: 'עדות בעל פה', website: 'אתר',
};
export const LICENSE_LABELS = {
  public_domain: 'נחלת הכלל', CC0: 'CC0', CC_BY: 'CC BY', CC_BY_SA: 'CC BY-SA', CC_BY_NC: 'CC BY-NC (לא מסחרי)', copyright: 'זכויות שמורות', unknown: 'זכויות לא ידועות',
};

// ── Communities ──────────────────────────────────────────────────────────────────────────────────────────────
const BY_ID = new Map(COMMUNITIES.map(community => [community.id, community]));
export const communityById = id => BY_ID.get(id) || null;
export const childrenOf = id => COMMUNITIES.filter(community => community.parentId === id);
export const rootCommunities = () => COMMUNITIES.filter(community => !community.parentId);
export function ancestorsOf(id) {
  const chain = [];
  let current = communityById(id);
  while (current?.parentId) { current = communityById(current.parentId); if (current) chain.push(current); }
  return chain;
}
export const communityPath = id => [...ancestorsOf(id).reverse(), communityById(id)].filter(Boolean);
export const communityLabel = id => communityPath(id).map(community => community.nameHe).join(' · ');

// Names and aliases, nikud- and geresh-insensitive: "בבל", "עיראק" and "Babylonian" reach the same family.
const plain = value => normalizeHebrew(String(value || '')).toLowerCase().replace(/[׳'"״`]/g, '').trim();
export function resolveCommunities(query) {
  const needle = plain(query);
  if (!needle) return [];
  return COMMUNITIES.filter(community => [community.nameHe, community.nameEn, ...(community.aliases || [])].some(name => plain(name) === needle || plain(name).includes(needle)));
}

// ── Sources, rights, and the gates ───────────────────────────────────────────────────────────────────────────
const SOURCE_BY_ID = new Map(TRADITION_SOURCES.map(source => [source.id, source]));
export const sourceById = id => SOURCE_BY_ID.get(id) || null;
const OPEN_LICENSES = new Set(['public_domain', 'CC0', 'CC_BY', 'CC_BY_SA']);
// Verbatim text only from sources whose licence allows it; copyright/unknown/non-commercial → citation only.
export const allowsVerbatim = source => Boolean(source && OPEN_LICENSES.has(source.license));
const AI_SOURCE = /chatgpt|gpt|gemini|claude|\bai\b|llm|בינה מלאכותית/i;
const HALACHIC_SOURCE_TYPES = new Set(['primary_text', 'rabbinic_work']);

export function publicationErrors(record, { sources = SOURCE_BY_ID, communities = BY_ID } = {}) {
  const errors = [];
  const citations = record.citations || [];
  if (!citations.length) errors.push('אין מקור');
  for (const citation of citations) {
    const source = sources.get(citation.sourceId);
    if (!source) { errors.push(`מקור לא מוכר: ${citation.sourceId}`); continue; }
    if (AI_SOURCE.test(`${source.title} ${source.author || ''} ${source.publisher || ''}`)) errors.push('מקור אינו יכול להיות מערכת בינה מלאכותית');
    if (!citation.reference) errors.push('חסר מיקום מדויק במקור');
    if (citation.excerpt && !allowsVerbatim(source)) errors.push(`ציטוט מלא אסור ממקור ברישיון ${source.license || 'לא ידוע'}`);
  }
  if (!record.communityIds?.length || record.communityIds.some(id => !communities.get(id))) errors.push('קהילה לא מזוהה');
  if (!record.traditionType || !record.normativeType) errors.push('חסר סוג המנהג');
  if (!record.verificationStatus || record.verificationStatus === 'needs_review') errors.push('דרוש אימות');
  if (!record.rightsStatus || record.rightsStatus === 'unknown') errors.push('מצב הזכויות אינו ידוע');
  if (record.practicalHalacha && !citations.some(citation => HALACHIC_SOURCE_TYPES.has(sources.get(citation.sourceId)?.sourceType))) errors.push('הלכה למעשה דורשת מקור הלכתי');
  return errors;
}
export const canPublish = (record, options) => publicationErrors(record, options).length === 0;

// candidate → review → published: the app reads only records marked published that also pass the gate.
export const PUBLISHED_RECORDS = TRADITION_RECORDS.filter(record => record.status === 'published' && canPublish(record));
export const recordsInStatus = status => TRADITION_RECORDS.filter(record => record.status === status);
export const recordById = id => PUBLISHED_RECORDS.find(record => record.id === id) || null;

// ── Profile: several roots, none declared binding ────────────────────────────────────────────────────────────
export const PROFILE_ROLES = [
  ['central', 'המסורת המרכזית שלי'],
  ['father', 'משפחת אבא'],
  ['mother', 'משפחת אמא'],
  ['spouse', 'מסורת בן/בת הזוג'],
  ['additional', 'מסורת נוספת'],
];
const ROLE_WEIGHT = { central: 0, father: 1, mother: 1, spouse: 2, additional: 2 };
const PROFILE_KEY = 'kz-tradition-profile-v1';
const FAMILY_KEY = 'kz-family-customs-v1';
const storage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const read = (key, fallback, store) => { try { return JSON.parse(store?.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; } };
const write = (key, value, store) => { try { store?.setItem(key, JSON.stringify(value)); } catch { /* storage full or private */ } return value; };
export const EMPTY_PROFILE = { roots: {}, onboarded: false };
export const loadTraditionProfile = (store = storage()) => ({ ...EMPTY_PROFILE, ...read(PROFILE_KEY, EMPTY_PROFILE, store) });
export const saveTraditionProfile = (profile, store = storage()) => write(PROFILE_KEY, profile, store);
export const profileRoots = profile => PROFILE_ROLES.map(([role]) => [role, profile?.roots?.[role]]).filter(([, id]) => id && communityById(id));

// ── Family customs: private by default, their own store, never published ─────────────────────────────────────
export const loadFamilyCustoms = (store = storage()) => read(FAMILY_KEY, [], store).filter(item => item && item.id);
export function addFamilyCustom(custom, store = storage(), now = new Date()) {
  const item = { id: `family-${now.getTime().toString(36)}`, private: true, createdAt: now.toISOString(), title: String(custom.title || '').trim(), practice: String(custom.practice || '').trim(), who: String(custom.who || '').trim(), place: String(custom.place || '').trim(), when: String(custom.when || '').trim(), note: String(custom.note || '').trim(), familySource: String(custom.familySource || '').trim(), media: [] };
  if (!item.title || !item.practice) return loadFamilyCustoms(store);
  return write(FAMILY_KEY, [item, ...loadFamilyCustoms(store)], store);
}
export const removeFamilyCustom = (id, store = storage()) => write(FAMILY_KEY, loadFamilyCustoms(store).filter(item => item.id !== id), store);

// ── Matching: exact city > region > country > tradition family ───────────────────────────────────────────────
// 0 = the record's community is the user's; n = the record describes a wider community n levels up; a record for
// a place inside the user's community (the user chose the country, the record is a city) comes after those.
export function matchLevel(recordCommunityId, userCommunityId) {
  if (recordCommunityId === userCommunityId) return 0;
  const up = ancestorsOf(userCommunityId).findIndex(community => community.id === recordCommunityId);
  if (up >= 0) return up + 1;
  const down = ancestorsOf(recordCommunityId).findIndex(community => community.id === userCommunityId);
  if (down >= 0) return 10 + down;
  return null;
}
export function recordsForProfile(profile, records = PUBLISHED_RECORDS) {
  const roots = profileRoots(profile);
  const matched = [];
  for (const record of records) {
    let best = null;
    for (const [role, userCommunity] of roots) for (const communityId of record.communityIds) {
      const level = matchLevel(communityId, userCommunity);
      if (level === null) continue;
      const score = level * 10 + ROLE_WEIGHT[role];
      if (!best || score < best.score) best = { record, role, level, score, communityId };
    }
    if (best) matched.push(best);
  }
  return matched.sort((a, b) => a.score - b.score || a.record.title.localeCompare(b.record.title, 'he'));
}

// ── The calendar ─────────────────────────────────────────────────────────────────────────────────────────────
export function hebrewDayOf(key) {
  const date = new HDate(new Date(`${key}T12:00:00`));
  return { month: date.getMonth(), day: date.getDate(), leap: HDate.isLeapYear(date.getFullYear()), weekday: new Date(`${key}T12:00:00Z`).getUTCDay() };
}
function triggerMatches(trigger, day) {
  if (trigger.weekday !== undefined) return day.weekday === trigger.weekday;
  if (trigger.dayFrom !== undefined) return day.day >= trigger.dayFrom && day.day <= trigger.dayTo;
  const month = trigger.month === 'adar' ? (day.leap ? 13 : 12) : trigger.month;
  return day.month === month && day.day >= trigger.from && day.day <= trigger.to;
}
export const recordMatchesDay = (record, day) => (record.calendarTriggers || []).some(trigger => triggerMatches(trigger, day));
// Only customs truly tied to this day, for this person's roots — never a random custom to fill the space.
export function todaysRecords(profile, key, records = PUBLISHED_RECORDS) {
  if (!key) return [];
  const day = hebrewDayOf(key);
  return recordsForProfile(profile, records).filter(match => recordMatchesDay(match.record, day));
}

// ── Sections of the home screen ─────────────────────────────────────────────────────────────────────────────
const windowOf = (month, from, to) => ({ month, from, to });
export const YEAR_CYCLE = [
  { id: 'shabbat', title: 'שבת', test: record => (record.calendarTriggers || []).some(t => t.weekday === 6) || record.traditionType === 'shabbat_custom' },
  { id: 'elul', title: 'אלול וראש השנה', windows: [windowOf(6, 1, 29), windowOf(7, 1, 2)] },
  { id: 'yom-kippur', title: 'יום כיפור', windows: [windowOf(7, 9, 10)] },
  { id: 'sukkot', title: 'סוכות', windows: [windowOf(7, 14, 23)] },
  { id: 'chanukah', title: 'חנוכה', windows: [windowOf(9, 25, 30), windowOf(10, 1, 3)] },
  { id: 'purim', title: 'פורים', windows: [windowOf('adar', 11, 15)] },
  { id: 'pesach', title: 'פסח', windows: [windowOf(1, 10, 22)] },
  { id: 'omer', title: 'ספירת העומר ול״ג בעומר', windows: [windowOf(1, 16, 30), windowOf(2, 1, 30), windowOf(3, 1, 5)] },
  { id: 'shavuot', title: 'שבועות', windows: [windowOf(3, 5, 7)] },
  { id: 'bein-hametzarim', title: 'בין המצרים ותשעה באב', windows: [windowOf(4, 17, 29), windowOf(5, 1, 10)] },
];
const overlaps = (trigger, window) => {
  if (trigger.weekday !== undefined || trigger.dayFrom !== undefined) return false;
  const month = t => (t === 'adar' ? 'adar' : Number(t));
  return month(trigger.month) === month(window.month) && trigger.from <= window.to && trigger.to >= window.from;
};
export const inYearSection = (record, section) => (section.test ? section.test(record) : (record.calendarTriggers || []).some(trigger => section.windows.some(window => overlaps(trigger, window))));
export const LIFE_CYCLE = [
  ['birth', 'לידה'], ['brit_milah', 'ברית מילה'], ['zeved_habat', 'זבד הבת'], ['education', 'חינוך'], ['bar_mitzvah', 'בר מצווה'],
  ['engagement', 'אירוסין'], ['wedding', 'חתונה'], ['new_home', 'בית חדש'], ['mourning', 'אבלות'], ['yahrzeit', 'יארצייט'],
];
export const THEMES = [
  ['prayer', 'תפילה ובית הכנסת', record => ['prayer_custom', 'prayer_text_variant', 'synagogue', 'torah_reading'].includes(record.traditionType)],
  ['piyut', 'פיוט וניגון', record => ['piyut', 'melody'].includes(record.traditionType)],
  ['home', 'אוכל ומנהגי הבית', record => ['food_custom', 'folk_custom'].includes(record.traditionType)],
  ['language', 'לשון והגייה', record => ['language', 'judeo_language', 'pronunciation'].includes(record.traditionType)],
  ['halacha', 'מנהגים הלכתיים', record => ['halacha', 'halachic_custom'].includes(record.traditionType)],
];

// ── Compare: the same topic across communities, side by side — no ranking, no verdict ────────────────────────
export function compareTopics(records = PUBLISHED_RECORDS) {
  const byTopic = new Map();
  for (const record of records) if (record.topic) byTopic.set(record.topic, [...(byTopic.get(record.topic) || []), record]);
  return [...byTopic.entries()].filter(([, list]) => new Set(list.flatMap(record => record.communityIds)).size > 1).map(([topic, list]) => ({ topic, records: list }));
}
export const variantsOf = record => (record?.topic ? PUBLISHED_RECORDS.filter(other => other.topic === record.topic && other.id !== record.id) : []);

// ── Search: communities (with aliases), customs, holidays, foods, rabbis, books, keywords ────────────────────
export function searchTraditions(query, records = PUBLISHED_RECORDS) {
  const needle = plain(query);
  if (needle.length < 2) return [];
  const communityHits = new Set(resolveCommunities(query).flatMap(community => [community.id, ...COMMUNITIES.filter(c => ancestorsOf(c.id).some(a => a.id === community.id)).map(c => c.id)]));
  return records.filter(record => {
    if (record.communityIds.some(id => communityHits.has(id))) return true;
    const sources = (record.citations || []).map(citation => { const source = sourceById(citation.sourceId); return `${source?.title || ''} ${source?.author || ''} ${citation.reference}`; });
    const haystack = plain([record.title, record.shortSummary, record.body, ...(record.tags || []), ...sources, ...record.communityIds.map(communityLabel)].join(' '));
    return needle.split(/\s+/).every(term => haystack.includes(term));
  });
}

// ── Counts for the report and the About page ────────────────────────────────────────────────────────────────
export function traditionStats() {
  return {
    communities: COMMUNITIES.filter(c => !c.parentId).length,
    subcommunities: COMMUNITIES.filter(c => c.parentId).length,
    published: PUBLISHED_RECORDS.length,
    review: recordsInStatus('review').length,
    candidate: recordsInStatus('candidate').length,
    sources: TRADITION_SOURCES.length,
  };
}
