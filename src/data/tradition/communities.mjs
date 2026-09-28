// Community hierarchy for "המסורת שלי": TraditionFamily → Country/Region → City/Community → SubTradition.
// A subdivision exists only where a source documents it as its own community or custom (sourceIds). Top-level
// families are the traditions the product supports; a family with no sourced records yet is shown as such.
// Nothing here says which tradition binds a person — the hierarchy only describes communities.

export const COMMUNITY_TYPES = ['tradition_family', 'country', 'region', 'city', 'community', 'sub_tradition'];

import { RESEARCH_COMMUNITIES } from './research.mjs';

export const COMMUNITIES = [
  // Babylon / Iraq — Baghdad is documented as its own community with its own customs in the Ben Ish Hai.
  { id: 'iraq', nameHe: 'יהדות בבל (עיראק)', nameEn: 'Iraq / Babylon', type: 'tradition_family', aliases: ['עיראק', 'בבל', 'בבלי', 'בגדאדי', 'Iraq', 'Babylon', 'Babylonian', 'Baghdad Jewish', 'Iraqi'], modernCountries: ['עיראק'], sourceIds: [] },
  { id: 'iraq-baghdad', nameHe: 'בגדאד', nameEn: 'Baghdad', type: 'city', parentId: 'iraq', aliases: ['בגדד', 'בגדאד', 'Baghdad'], description: 'קהילת בגדאד, שמנהגיה מתועדים בספר "בן איש חי" לרבי יוסף חיים, רבה של העיר.', sourceIds: ['ben-ish-hai'] },

  // Sephardi Jerusalem — documented in the Ben Ish Hai ("בעיר הקודש ירושלים נהגו"; the Beit El kabbalists).
  { id: 'jerusalem-sephardi', nameHe: 'ספרדי ירושלים', nameEn: 'Sephardi Jerusalem', type: 'tradition_family', aliases: ['ירושלים', 'ירושלמי', 'ספרדי ירושלים', 'Jerusalem'], sourceIds: ['ben-ish-hai'] },
  { id: 'jerusalem-beit-el', nameHe: 'חסידי בית אל בירושלים', nameEn: 'Beit El kabbalists, Jerusalem', type: 'community', parentId: 'jerusalem-sephardi', aliases: ['בית אל', 'ישיבת בית אל', 'המקובלים', 'Beit El'], description: 'קהל המקובלים במדרש "בית אל" בירושלים, שמנהגיו נזכרים בספר "בן איש חי".', sourceIds: ['ben-ish-hai'] },

  // Ashkenaz — the Rema's glosses record the custom "במדינות אלו".
  { id: 'ashkenaz', nameHe: 'אשכנז', nameEn: 'Ashkenaz', type: 'tradition_family', aliases: ['אשכנזי', 'אשכנזים', 'Ashkenaz', 'Ashkenazi'], description: 'מנהגי אשכנז כפי שרשם אותם הרמ"א בהגהותיו על השולחן ערוך.', sourceIds: ['shulchan-arukh-oc'] },
  { id: 'ashkenaz-lithuania', nameHe: 'ליטא', nameEn: 'Lithuania', type: 'country', parentId: 'ashkenaz', aliases: ['ליטאי', 'Lithuanian', 'Litvish'], sourceIds: [] },
  { id: 'ashkenaz-poland', nameHe: 'פולין', nameEn: 'Poland', type: 'country', parentId: 'ashkenaz', aliases: ['פולני', 'Polish'], sourceIds: [] },
  { id: 'ashkenaz-hungary', nameHe: 'הונגריה', nameEn: 'Hungary', type: 'country', parentId: 'ashkenaz', aliases: ['הונגרי', 'Hungarian'], sourceIds: [] },
  { id: 'ashkenaz-germany', nameHe: 'גרמניה (אשכנז הישנה)', nameEn: 'Germany', type: 'country', parentId: 'ashkenaz', aliases: ['יקה', 'יקים', 'German', 'Yekke'], sourceIds: [] },
  { id: 'chabad', nameHe: 'חב"ד', nameEn: 'Chabad', type: 'tradition_family', aliases: ['חבד', 'ליובאוויטש', 'Chabad', 'Lubavitch'], sourceIds: [] },

  // The traditions the product supports; each awaits sourced records (see the report).
  { id: 'morocco', nameHe: 'יהדות מרוקו', nameEn: 'Morocco', type: 'tradition_family', aliases: ['מרוקו', 'מרוקאי', 'מערב', 'Morocco', 'Moroccan'], sourceIds: [] },
  { id: 'yemen', nameHe: 'יהדות תימן', nameEn: 'Yemen', type: 'tradition_family', aliases: ['תימן', 'תימני', 'Yemen', 'Yemenite', 'Teimani'], sourceIds: [] },
  { id: 'tunisia', nameHe: 'יהדות תוניסיה', nameEn: 'Tunisia', type: 'tradition_family', aliases: ['תוניס', 'תוניסאי', 'Tunisia', 'Tunisian'], sourceIds: [] },
  { id: 'tunisia-djerba', nameHe: 'ג׳רבה', nameEn: 'Djerba', type: 'community', parentId: 'tunisia', aliases: ['גרבה', 'ג\'רבה', 'Djerba', 'Jerba'], sourceIds: [] },
  { id: 'libya', nameHe: 'יהדות לוב', nameEn: 'Libya', type: 'tradition_family', aliases: ['לוב', 'לובי', 'טריפולי', 'Libya', 'Libyan'], sourceIds: [] },
  { id: 'iran', nameHe: 'יהדות פרס (איראן)', nameEn: 'Iran / Persia', type: 'tradition_family', aliases: ['איראן', 'פרס', 'פרסי', 'Iran', 'Persia', 'Persian'], sourceIds: [] },
  { id: 'bukhara', nameHe: 'יהדות בוכרה', nameEn: 'Bukhara', type: 'tradition_family', aliases: ['בוכרה', 'בוכרי', 'Bukhara', 'Bukharan'], sourceIds: [] },
  { id: 'kurdistan', nameHe: 'יהדות כורדיסטן', nameEn: 'Kurdistan', type: 'tradition_family', aliases: ['כורדיסטן', 'כורדי', 'Kurdistan', 'Kurdish'], sourceIds: [] },
  { id: 'syria', nameHe: 'יהדות סוריה', nameEn: 'Syria', type: 'tradition_family', aliases: ['סוריה', 'סורי', 'Syria', 'Syrian'], sourceIds: [] },
  { id: 'syria-aleppo', nameHe: 'חלב (ארם צובה)', nameEn: 'Aleppo', type: 'city', parentId: 'syria', aliases: ['חלב', 'חלבי', 'ארם צובה', 'Aleppo', 'Halabi'], sourceIds: [] },
  { id: 'syria-damascus', nameHe: 'דמשק', nameEn: 'Damascus', type: 'city', parentId: 'syria', aliases: ['דמשק', 'שאמי', 'Damascus', 'Shami'], sourceIds: [] },
  { id: 'turkey', nameHe: 'יהדות טורקיה', nameEn: 'Turkey', type: 'tradition_family', aliases: ['טורקיה', 'טורקי', 'קושטא', 'איזמיר', 'Turkey', 'Turkish', 'Ottoman'], sourceIds: [] },
  { id: 'egypt', nameHe: 'יהדות מצרים', nameEn: 'Egypt', type: 'tradition_family', aliases: ['מצרים', 'מצרי', 'Egypt', 'Egyptian'], sourceIds: [] },
  { id: 'algeria', nameHe: 'יהדות אלג׳יריה', nameEn: 'Algeria', type: 'tradition_family', aliases: ['אלג\'יריה', 'אלגיריה', 'Algeria', 'Algerian'], sourceIds: [] },
  { id: 'cochin', nameHe: 'יהדות קוצ׳ין', nameEn: 'Cochin', type: 'tradition_family', aliases: ['קוצין', 'קוצ\'ין', 'הודו', 'Cochin'], sourceIds: [] },
  { id: 'italy', nameHe: 'יהדות איטליה', nameEn: 'Italy', type: 'tradition_family', aliases: ['איטליה', 'איטלקי', 'Italy', 'Italian'], sourceIds: [] },
  { id: 'romania', nameHe: 'יהדות רומניה', nameEn: 'Romania', type: 'tradition_family', aliases: ['רומניה', 'רומני', 'Romania', 'Romanian'], sourceIds: [] },
  { id: 'georgia', nameHe: 'יהדות גאורגיה', nameEn: 'Georgia', type: 'tradition_family', aliases: ['גאורגיה', 'גרוזיה', 'Georgia', 'Georgian'], sourceIds: [] },
  ...RESEARCH_COMMUNITIES,
];
