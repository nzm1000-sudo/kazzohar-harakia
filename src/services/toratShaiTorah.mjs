// "תורת ש״י" inside דברי תורה: the owner's own divrei torah on the parasha and the festival (data/toratShai, group
// 'parasha'), read straight from TORAT_SHAI_PIECES — the one source of the text; nothing is copied. Each piece becomes a
// catalog article of the Torah content engine (torahContent.mjs): a stable id (torat-shai:<piece id>), its parashot and
// festivals from its occasion ("פרשת מקץ · חנוכה" → מקץ and חנוכה), the blocks for the reader and plain paragraphs for
// the Shabbat table, search and sharing, and the author's credit. `pinned` puts it first wherever its parasha or festival
// comes (the lists, the week's three, the Shabbat table) — before the archive and the app's own.
// Only the parasha group: the essays ("שלח לחמך") and the prayer ("הודאה") stay in their own category alone.
import { TORAT_SHAI, TORAT_SHAI_PIECES } from '../data/toratShai/index.mjs';
import { HOLIDAYS, canonicalParasha } from './torahTaxonomy.mjs';

export const TORAT_SHAI_COLLECTION = 'torat-shai';
export const TORAT_SHAI_ID_PREFIX = 'torat-shai:';
export const TORAT_SHAI_CREDIT = Object.freeze({
  collection: TORAT_SHAI.title,
  author: TORAT_SHAI.author,
  line: `מאת ${TORAT_SHAI.author} · ${TORAT_SHAI.title}`,
});

export const isToratShaiArticle = item => item?.collection === TORAT_SHAI_COLLECTION;
export const toratShaiArticleId = pieceId => `${TORAT_SHAI_ID_PREFIX}${pieceId}`;

/** A piece's occasion → the engine's names: { parashot: ['מקץ'], holidays: ['chanukah'] }. */
export function occasionScope(occasion) {
  const parashot = [];
  const holidays = [];
  for (const part of String(occasion || '').split('·').map(value => value.trim()).filter(Boolean)) {
    const parasha = canonicalParasha(part);
    if (parasha) { parashot.push(parasha); continue; }
    const holiday = HOLIDAYS.find(item => item.he === part.replace(/^(?:חג|ימי)\s+/, ''));
    if (holiday) holidays.push(holiday.id);
  }
  return { parashot, holidays };
}

// The text as plain paragraphs (the Shabbat table, search, the share image): a quotation with its reference.
export const blockParagraph = block => {
  if (block.type === 'source') return `„${block.text}” (${block.ref})`;
  if (block.type === 'section') return block.title;
  return block.text;
};
// The opening, cut at a word (never mid-word), with "…" when there is more.
const openingOf = (text, limit = 160) => (text.length <= limit ? text : `${text.slice(0, text.lastIndexOf(' ', limit))} …`);
const words = text => String(text || '').split(/\s+/).filter(Boolean).length;

function articleOf(piece) {
  const { parashot, holidays } = occasionScope(piece.occasion);
  const paragraphs = piece.blocks.map(blockParagraph).map(text => String(text || '').trim()).filter(Boolean);
  const firstText = piece.blocks.find(block => block.type === 'text')?.text || paragraphs[0] || '';
  return Object.freeze({
    id: toratShaiArticleId(piece.id),
    pieceId: piece.id,
    title: piece.title,
    heading: null,
    contentType: 'dvar-torah',
    shabbatTable: false,
    length: null,
    parashot,
    holidays,
    specialShabbatot: [],
    topics: [],
    readMinutes: Math.max(1, Math.round(words(paragraphs.join(' ')) / 170)),
    year: null,
    pack: null,
    excerpt: openingOf(firstText),
    collection: TORAT_SHAI_COLLECTION,
    pinned: true,
    author: TORAT_SHAI.author,
    verse: piece.verse || null,
    body: { paragraphs, blocks: piece.blocks, source: { ref: TORAT_SHAI_CREDIT.line, collection: TORAT_SHAI.title, author: TORAT_SHAI.author } },
  });
}

let built = null;
/** The owner's divrei torah on the parasha and the festival, as articles, in the category's own order. */
export function toratShaiArticles() {
  if (!built) built = Object.freeze(TORAT_SHAI_PIECES.filter(piece => piece.group === 'parasha').map(articleOf).filter(item => item.parashot.length || item.holidays.length));
  return built;
}

/** A list with the owner's pieces first (in their own order), everything else in its order after them. */
export const pinnedFirst = list => [...list.filter(item => item?.pinned), ...list.filter(item => !item?.pinned)];
