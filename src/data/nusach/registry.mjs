// The prayer rites (נוסחים) the Siddur can show. Four distinct traditions with stable ids; "sefard" is the Chassidic
// Nusach Sefard and never an alias of Edot HaMizrach. Each rite's text lives in its own bundled chunk (loaded on
// demand, offline) — the sources and licences are in manifest.mjs. Adding a rite is adding a row here, a pack and a
// layout; nothing else in the app hard-codes the list.
export const DEFAULT_NUSACH = 'edot-hamizrach';

export const NUSACHIM = [
  { id: 'edot-hamizrach', title: 'עדות המזרח', subtitle: 'קהילות ספרדיות ורבות מקהילות המזרח', index: 'Siddur Edot HaMizrach', load: () => import('../siddurOffline.mjs') },
  // Ashkenaz reads the Metsudah siddur (via Sefaria) and, only for what that edition lacks (במה מדליקין, פרקי אבות, …),
  // Birnbaum's HaSiddur HaShalem (1949, the Hebrew Wikisource transcription, CC BY-SA). Both are Nusach Ashkenaz.
  { id: 'ashkenaz', title: 'אשכנז', subtitle: 'נוסח אשכנז', index: 'Siddur Ashkenaz', load: () => import('./siddurAshkenaz.mjs'), extras: [{ index: 'HaSiddur HaShalem Birnbaum', load: () => import('./siddurAshkenazBirnbaum.mjs') }] },
  { id: 'sefard', title: 'ספרד', subtitle: 'נוסח ספרד החסידי', index: 'Siddur Sefard', load: () => import('./siddurSefard.mjs') },
  // Chabad reads two licensed editions: Siddur Torah Or (weekdays) and the Open Siddur transcription consistent with
  // Siddur Tehillat Hashem (Shabbat, festivals and the rest). Both are Nusach HaAri of the Alter Rebbe.
  { id: 'chabad', title: 'חב״ד', subtitle: 'נוסח האר״י לפי מסורת חב״ד', index: 'Weekday Siddur Chabad', load: () => import('./siddurChabad.mjs'), extras: [{ index: 'Siddur Tehillat Hashem', load: () => import('./siddurChabadTehillatHashem.mjs') }] },
];

export const NUSACH_INDEX = Object.fromEntries(NUSACHIM.map(item => [item.id, item]));
export const NUSACH_IDS = NUSACHIM.map(item => item.id);
export const isNusachId = value => Object.prototype.hasOwnProperty.call(NUSACH_INDEX, value);
// The rite of a settings object; anything unknown (old installs, a typo) is Edot HaMizrach, as it always was.
export const nusachOf = settings => (isNusachId(settings?.nusach) ? settings.nusach : DEFAULT_NUSACH);
export const nusachTitle = id => NUSACH_INDEX[id]?.title || NUSACH_INDEX[DEFAULT_NUSACH].title;
export const nusachLabel = id => `נוסח ${nusachTitle(id)}`;
// "Siddur Ashkenaz, Weekday, Shacharit, …" → 'ashkenaz'
export const nusachForReference = ref => NUSACHIM.find(item => [item.index, ...(item.extras || []).map(extra => extra.index)].some(index => String(ref || '').startsWith(`${index}, `) || String(ref || '') === index))?.id || null;
