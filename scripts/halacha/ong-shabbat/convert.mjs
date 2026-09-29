// Verified drafts (PROTOCOL.md) → src/data/ongShabbatQa.mjs, the עונג שבת records of the Halacha Engine.
// Run: node scripts/halacha/ong-shabbat/convert.mjs --book <book.json> <out-g01.json> … <out-g10.json>
// Every record is re-checked by the gate (src/services/ongShabbatGate.mjs); a record with an error is kept as
// "needs-review" (never published). The book's place (chapter, halacha, page, notes), the unit's text hash and the
// book's own index terms are attached from the extraction, never from the draft. The Yalkut Yosef entries that answer
// the same question are recorded as parallels, to be shown side by side — never merged.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { gate, publicationFor, CURRENTNESS } from '../../../src/services/ongShabbatGate.mjs';
import { normalizeQuery, searchHalacha, isRelevantEntry } from '../../../src/services/halachaSearch.mjs';
import { CONTEXT_LABELS } from '../../../src/services/halachaEngine.mjs';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const args = process.argv.slice(2);
const book = JSON.parse(readFileSync(args[args.indexOf('--book') + 1], 'utf8'));
const drafts = args.filter((arg, i) => arg !== '--book' && args[i - 1] !== '--book');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const notes = new Map(book.footnotes.map(note => [note.n, note.text]));
const units = new Map();
for (const chapter of book.chapters) for (const unit of chapter.units) units.set(`${chapter.n}.${unit.n}`, { chapter, unit });
const indexTerms = new Map();
for (const entry of book.index) if (entry.unit) {
  const key = `${entry.chapter}.${entry.unit}`;
  indexTerms.set(key, [...new Set([...(indexTerms.get(key) || []), entry.term.replace(/[”]/g, '"').replace(/[’]/g, "'")])]);
}
const geresh = label => (label || '').replace(/'/g, '׳').replace(/"/g, '״');
// A paragraph break and a space are the same thing inside a quote (the extraction's paragraphing was refined after some
// drafts were written): the excerpt is re-cut from the final text, whitespace-insensitively, word for word.
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function recut(excerpt, text) {
  if (!excerpt || text.includes(excerpt)) return excerpt;
  const found = text.match(new RegExp(excerpt.trim().split(/\s+/).map(escape).join('\\s+')));
  return found ? found[0] : excerpt;
}

const records = [];
const skips = [];
for (const file of drafts) for (const draft of JSON.parse(readFileSync(file, 'utf8'))) {
  const found = units.get(draft.unit);
  if (!found) throw new Error(`unknown unit ${draft.unit}`);
  if (draft.skip) { skips.push({ unit: draft.unit, title: found.unit.title, reason: draft.skip }); continue; }
  const { chapter, unit } = found;
  draft.excerpt = recut(draft.excerpt, unit.text);
  if (draft.dangerExcerpt) draft.dangerExcerpt = recut(draft.dangerExcerpt, unit.text);
  const verdict = gate({ ...draft, conditions: draft.conditions || [] }, { unitText: unit.text, notesText: unit.refs.map(ref => notes.get(ref.n)).join(' '), chapter: chapter.n });
  const high = draft.currentness === CURRENTNESS.HIGH_STAKES;
  records.push({
    id: draft.id,
    unit: draft.unit, chapter: chapter.n, n: unit.n,
    chapterLabel: geresh(chapter.label), chapterTitle: chapter.title, label: geresh(unit.label), title: unit.title || null, section: unit.section,
    pages: unit.pages,
    question: draft.question,
    variants: draft.variants,
    keywords: draft.keywords,
    indexTerms: indexTerms.get(draft.unit) || [],
    shortAnswer: high ? null : draft.shortAnswer,
    conditions: draft.conditions || [],
    explanation: draft.explanation || null,
    excerpt: draft.excerpt,
    ...(draft.dangerExcerpt ? { dangerExcerpt: draft.dangerExcerpt } : {}),
    ruleType: draft.ruleType,
    currentness: draft.currentness,
    currentnessNote: draft.currentnessNote,
    publication: publicationFor(draft.currentness),
    contexts: draft.contexts,
    category: draft.category,
    topic: draft.topic,
    notes: unit.refs.map(ref => ref.n),
    unitHash: sha256(unit.text),
    answerStatus: verdict.errors.length ? 'needs-review' : 'published',
    ...(verdict.errors.length ? { gateErrors: verdict.errors } : {}),
  });
}
// No two records may ask the same question.
const seen = new Map();
for (const record of records) {
  const key = normalizeQuery(record.question);
  if (seen.has(key)) throw new Error(`duplicate question: ${record.id} / ${seen.get(key)}`);
  seen.set(key, record.id);
}
records.sort((a, b) => a.chapter - b.chapter || a.n - b.n || a.id.localeCompare(b.id));

// Parallels in Yalkut Yosef: published Yalkut entries on the same matter — search finds them for the record's question,
// each is about the other in both directions (the engine's own relevance gate), they sit in the same category, and the
// Yalkut entry is not bound to a season the book's halacha is not about (a Nine Days shower is not a Shabbat shower).
// Shown side by side on the question page; nothing is merged, and no agreement or disagreement is claimed.
const SEASONS = new Set(Object.keys(CONTEXT_LABELS).filter(key => !['friday', 'shabbat', 'motzei-shabbat', 'weekday-morning', 'yom-tov', 'chanukah', 'purim'].includes(key)));
for (const record of records) {
  const asEntry = { question: record.question, variants: record.variants, aliases: record.variants, searchKeywords: [...record.keywords, ...record.indexTerms], topic: record.topic, shortAnswer: record.shortAnswer };
  const found = searchHalacha(record.question, { limit: 8 }).unified
    .filter(item => item.kind === 'question' && !item.item.sourceBook && item.item.category === record.category
      && isRelevantEntry(record.question, item.item) && isRelevantEntry(item.item.question, asEntry)
      && !(item.item.contexts || []).some(key => SEASONS.has(key) && !record.contexts.includes(key)))
    .slice(0, 2).map(item => item.item.id);
  if (found.length) record.yalkutParallels = found;
}

const header = `// עונג שבת (הרב ישראל שריקי, מהדורה ראשונה תשע״ג; באישור המחבר, כל הזכויות שמורות) — the book's halachot as
// question records of the Halacha Engine. Generated by scripts/halacha/ong-shabbat/convert.mjs from drafts written per
// scripts/halacha/ong-shabbat/PROTOCOL.md; do not edit by hand. Three layers per record, never mixed: excerpt (the book's
// exact words, a verbatim span of the halacha whose text hash is unitHash), shortAnswer (derived; null for
// HIGH_STAKES_REVIEW), explanation (plain language, never a quote). Every record passed src/services/ongShabbatGate.mjs
// or is "needs-review" and unpublished. Rabbinic review of the derived answers: pending.
`;
writeFileSync(join(ROOT, 'src/data/ongShabbatQa.mjs'), `${header}export const ONG_SHABBAT_QA = ${JSON.stringify(records)};\nexport const ONG_SHABBAT_SKIPPED = ${JSON.stringify(skips)};\n`);
const count = (key, list = records) => list.reduce((map, record) => ({ ...map, [record[key]]: (map[record[key]] || 0) + 1 }), {});
console.log(JSON.stringify({ records: records.length, skips: skips.length, answerStatus: count('answerStatus'), publication: count('publication'), currentness: count('currentness'), withParallels: records.filter(record => record.yalkutParallels).length, unitsCovered: new Set(records.map(record => record.unit)).size }, null, 1));
for (const record of records.filter(item => item.gateErrors)) console.log('needs-review', record.id, record.gateErrors.join(' | '));
