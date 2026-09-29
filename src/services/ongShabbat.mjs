// עונג שבת inside the Halacha Engine: where a question record's halacha sits in the book, and its "מקורות וטעמים".
// Reads only the small generated corpus index (not the whole library registry) and the checksum-verified pack, which
// ships inside the native app and is cached on the web — so a question page works offline.
import ONG_SHABBAT_CORPUS from '../data/library/corpus/ongShabbat.mjs';
import { ONG_SHABBAT_NOTE_LINKS } from '../data/ongShabbatLinks.mjs';
import { loadEditionChunk } from './library/packs.mjs';

export const ONG_WORK_ID = 'Oneg_Shabbat';
export const ONG_NOTES_ID = 'Oneg_Shabbat_Notes';
export const ONG_TITLE = 'עונג שבת';
export const ONG_AUTHOR = 'הרב ישראל שריקי';
export const ONG_EDITION = 'מהדורה ראשונה תשע״ג';
export const ONG_CREDIT = 'עונג שבת · הרב ישראל שריקי · באישור המחבר, כל הזכויות שמורות';

const pack = ONG_SHABBAT_CORPUS.packs[0];
const editionOf = workId => {
  const work = pack.works.find(item => item.workId === workId);
  return { editionId: `${pack.packId}:${workId}`, packId: pack.packId, file: work.file, checksum: work.checksum, bytes: work.bytes };
};
export const ongEdition = () => editionOf(ONG_WORK_ID);
export const ongNotesEdition = () => editionOf(ONG_NOTES_ID);
export const ongNodeTitle = chapter => pack.works[0].nodeTitles[chapter - 1] || null;

// The library address of one halacha: books/r/Oneg_Shabbat/<chapter>/<unit>.
export const ongBookRoute = (chapter, unit) => `books/r/${ONG_WORK_ID}/${chapter}${unit ? `/${unit}` : ''}`;

// "מקורות וטעמים" of one halacha, in the book's order, with the exact links the notes carry (שולחן ערוך, רמב״ם, תלמוד).
export async function ongNotesFor(chapter, unit, options = {}) {
  const chunk = await loadEditionChunk(ongNotesEdition(), options);
  const node = chunk.nodes.find(item => item.n === chapter);
  return (node?.units || []).filter(item => item.v === unit).map(item => ({ ...item, links: ONG_SHABBAT_NOTE_LINKS[item.fn] || [] }));
}

// The halacha itself (title, paragraphs, printed page), for a question page that shows the whole halacha.
export async function ongUnit(chapter, unit, options = {}) {
  const chunk = await loadEditionChunk(ongEdition(), options);
  return chunk.nodes.find(item => item.n === chapter)?.units.find(item => item.n === unit) || null;
}
