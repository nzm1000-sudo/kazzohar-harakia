import CompletionButton from './CompletionButton.jsx';
import { recordSiddurCompletion, resolveSiddurCompletion, ACTIVITY_CATEGORY, ACTIVITY_TYPE } from '../services/mitzvotJournal.mjs';

// The words of the button follow what was done: a prayer, a blessing, a reading, the Omer, the Chanukah lights.
const WORDS = {
  prayer: ['סיימתי את התפילה', 'סימון התפילה כהושלמה'],
  blessing: ['סיימתי את הברכה', 'סימון הברכה כהושלמה'],
  reading: ['סיימתי את הקריאה', 'סימון הקריאה כהושלמה'],
  omer: ['סיימתי את הספירה', 'סימון ספירת העומר כהושלמה'],
  lights: ['סיימתי את ההדלקה', 'סימון הדלקת הנרות כהושלמה'],
};
export function completionWords(kind) {
  if (kind.category === ACTIVITY_CATEGORY.BRACHOT || kind.category === ACTIVITY_CATEGORY.BIRKAT_HAMAZON) return WORDS.blessing;
  if (kind.category === ACTIVITY_CATEGORY.OMER_COUNT) return WORDS.omer;
  if (kind.type === ACTIVITY_TYPE.CHANUKAH_LIGHTS) return WORDS.lights;
  if (kind.type === ACTIVITY_TYPE.SIDDUR_READING || kind.type === ACTIVITY_TYPE.MEGILLAH) return WORDS.reading;
  return WORDS.prayer;
}

// "סיימתי" for anything read in the Siddur — a service, Birkat HaMazon, a blessing (ברכות הנהנין, מעין שלוש, בורא
// נפשות…), a prayer of the season. What it records is decided by resolveSiddurCompletion: one entry per service per
// day (per blessing in a collection of separate blessings); Shabbat and Yom Tov offer nothing (null).
export default function PrayerCompletion({ flowKey, tzid = 'Asia/Jerusalem', itemEn = '', title = '', flowTitle = '', perItem = false }) {
  const where = { itemEn, title, flowTitle, perItem };
  const resolved = resolveSiddurCompletion(flowKey, where);
  if (!resolved) return null;
  const [label, ariaLabel] = completionWords(resolved.kind);
  return <CompletionButton
    source="siddur"
    sourceId={resolved.sourceId}
    tzid={tzid || 'Asia/Jerusalem'}
    label={label}
    ariaLabel={ariaLabel}
    record={() => recordSiddurCompletion(flowKey, { occurredAt: new Date(), tzid: tzid || 'Asia/Jerusalem', ...where })}
  />;
}
