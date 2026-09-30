// Drafting helpers for stage 6 (practical gaps). A batch file lists entries whose rulings are cut verbatim from a
// Yalkut Yosef section by start/end phrases (never retyped), then writes practical/out-P-<batch>.json for verify.mjs.
import { writeFileSync } from 'node:fs';
const { YALKUT_YOSEF } = await import('../../../src/data/yalkutYosef.mjs');
const S = new Map(YALKUT_YOSEF.sections.map(s => [s.id, s]));

// The words of a section from one phrase to another, inclusive, exactly as the book has them.
export const span = (id, from, to) => {
  const section = S.get(id);
  if (!section) throw new Error(`no section ${id}`);
  const text = section.text;
  const a = text.indexOf(from);
  const b = to ? text.indexOf(to, a) : -1;
  if (a < 0 || (to && b < 0)) throw new Error(`${id}: "${from}" … "${to}" not found`);
  return text.slice(a, to ? b + to.length : undefined);
};
export const sup = (sectionId, from, to) => ({ sectionId, excerpt: span(sectionId, from, to) });

// Where a question was found. Q&A pages are leads only: no wording is taken from them.
export const OWNER = { site: 'רשימת הפערים שהגדיר בעל האפליקציה (שאלות מהחיים)' };
export const seen = (site, url) => ({ site, url });

export const E = ({ from, to, ...o }) => ({ variants: [], tags: [], conditions: [], exceptions: [], searchTerms: [], related: [], discovery: [OWNER], askedOn: [], ...o });

export function write(batch, entries) {
  for (const e of entries) {
    if (e.excerpt.length > 400) console.log('LONG excerpt', e.id, e.excerpt.length);
    if (e.shortAnswer.length > 240) console.log('LONG answer', e.id, e.shortAnswer.length);
    e.askedOn = [...new Set([...(e.askedOn || []), ...e.discovery.map(d => d.url).filter(Boolean)])].slice(0, 2);
  }
  writeFileSync(new URL(`./out-P-${batch}.json`, import.meta.url), JSON.stringify(entries, null, 1));
  console.log(`wrote ${entries.length} → out-P-${batch}.json`);
}
