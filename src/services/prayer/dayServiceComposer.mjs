// Turns a day plan (services/prayer/dayServicePlan.mjs) into one continuous prayer document.
// Every text comes from a bundled edition, sliced by paragraph index — never retyped:
//   • siddur sections: the Sefaria edition, through the same day-condition engine as the printed reader
//   • festival texts:  data/liturgy/festivalLiturgy.mjs (the same editor's continuation, CC BY-SA)
//   • Torah reading:   the local Torah text (UXLC, data/torahText.mjs), verse by verse, per aliyah
import siddurOffline from '../../data/siddurOffline.mjs';
import torah from '../../data/torahText.mjs';
import { FESTIVAL_LITURGY } from '../../data/liturgy/festivalLiturgy.mjs';
import { normalizeSiddurBlocks } from '../siddurBlocks.mjs';
import { normalizeHebrewText } from '../../hebrewText.mjs';
import { hebrewNumeral } from '../hebrewNumerals.mjs';

export const DAY_SERVICE_PREFIX = 'Smart Siddur, ';
export const isDayServiceReference = reference => String(reference || '').startsWith(DAY_SERVICE_PREFIX);

export function liturgyText(ref) {
  const siddur = siddurOffline.texts[ref];
  if (siddur) return siddur.he || [];
  return FESTIVAL_LITURGY[ref]?.he || null;
}

const BOOKS = new Map(torah.books.map(book => [book.id, book]));
// "Numbers 29:17-29:19" | "Numbers 29:17-19" | "Numbers 29:17"
export function versesFor(reference) {
  const match = /^([A-Za-z_ ]+?)\s+(\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/.exec(String(reference || '').trim());
  if (!match) return [];
  const book = BOOKS.get(match[1].replace(/ /g, '_'));
  if (!book) return [];
  const from = [Number(match[2]), Number(match[3])];
  const to = [match[4] ? Number(match[4]) : from[0], match[5] ? Number(match[5]) : from[1]];
  const key = ([c, v]) => c * 1000 + v;
  return book.verses.filter(([c, v]) => key([c, v]) >= key(from) && key([c, v]) <= key(to))
    .map(([chapter, verse, text]) => ({ chapter, verse, text }));
}

const WEEKDAY_WRAPPER = /לימי החול|ליום חול|ליום החול|לימות החול/;
const block = (sectionId, index, type, text, extra = {}) => ({ id: `${sectionId}.${index}`, type, text, ...extra });

function siddurBlocks(step, context) {
  const all = liturgyText(step.ref);
  if (!all) throw new Error(`day-service: missing text ${step.ref}`);
  // range: [from, to]; ranges: several, in order (paragraph indexes of the edition, inclusive).
  const ranges = step.ranges || [step.range || [0, all.length - 1]];
  // As in the printed reader: plain text per paragraph, the edition's markup alongside it.
  const raw = ranges.flatMap(([from, to]) => all.slice(from, Math.min(to, all.length - 1) + 1).map((markup, offset) => ({ markup, source: from + offset })));
  const paragraphs = raw.map(({ markup, source }) => ({ text: normalizeHebrewText(markup, 'siddur'), source }));
  return normalizeSiddurBlocks(paragraphs, { title: step.title, markup: raw.map(part => part.markup), context })
    // The edition's weekday wrappers ("תפילת שחרית לימי החול") would mislabel a festival service.
    .filter(item => !(item.type === 'heading' && WEEKDAY_WRAPPER.test(item.text)))
    .map((item, index) => block(step.id, index, item.type === 'heading' ? 'heading' : item.type === 'instruction' || item.type === 'rubric' ? 'instruction' : 'recitedText', item.text, { source: item.source }));
}

function torahBlocks(step) {
  const out = [];
  step.aliyot.forEach((aliyah, n) => {
    out.push(block(step.id, out.length, 'aliyah', aliyah.label));
    const verses = versesFor(aliyah.ref);
    if (!verses.length) throw new Error(`day-service: no verses for ${aliyah.ref}`);
    out.push(block(step.id, out.length, 'torah', verses.map(v => `${v.text}`).join(' '), { ref: aliyah.ref, caption: `${hebrewNumeral(verses[0].chapter)}, ${hebrewNumeral(verses[0].verse)}–${hebrewNumeral(verses.at(-1).verse)}`, aliyah: n + 1 }));
  });
  return out;
}

export function composeDayService(plan, context) {
  const sections = [];
  for (const step of plan.steps) {
    const blocks = [];
    if (step.note) blocks.push(block(step.id, 'note', 'note', step.note));
    blocks.push(...(step.kind === 'torah' ? torahBlocks(step) : step.kind === 'note' ? [] : siddurBlocks(step, context)));
    // Consecutive steps of one group (the daily psalm and the day's psalm) read as one section.
    const previous = sections.at(-1);
    if (step.group && previous?.group === step.group) previous.blocks.push(...blocks);
    else sections.push({ id: step.id, title: step.title, kind: step.kind, group: step.group || null, blocks });
  }
  const nonEmpty = sections.filter(section => section.blocks.length);
  return { title: plan.title, dayLabel: plan.dayLabel, status: plan.status, sections: nonEmpty, sources: plan.sources || [] };
}
