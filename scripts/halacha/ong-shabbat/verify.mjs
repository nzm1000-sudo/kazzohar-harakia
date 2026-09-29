// Mechanical verification of drafted עונג שבת question records (PROTOCOL.md) against the extracted book.
// Run: node scripts/halacha/ong-shabbat/verify.mjs --book <book.json> <draft.json> [more drafts…]
// Prints every error and warning; exits 1 when any record has an error. The same gate runs in the tests.
import { readFileSync } from 'node:fs';
import { gate, CURRENTNESS_VALUES } from '../../../src/services/ongShabbatGate.mjs';
import { normalizeQuery } from '../../../src/services/halachaSearch.mjs';
import { publishedPracticalQuestions } from '../../../src/data/practicalHalachaQa.mjs';

const args = process.argv.slice(2);
const bookPath = args[args.indexOf('--book') + 1];
const drafts = args.filter((arg, i) => arg !== '--book' && args[i - 1] !== '--book');
const book = JSON.parse(readFileSync(bookPath, 'utf8'));
const units = new Map();
const notes = new Map(book.footnotes.map(note => [note.n, note.text]));
for (const chapter of book.chapters) for (const unit of chapter.units) units.set(`${chapter.n}.${unit.n}`, { chapter: chapter.n, unit, notesText: unit.refs.map(ref => notes.get(ref.n)).join(' ') });

export const CONTEXTS = new Set(['friday', 'shabbat', 'motzei-shabbat', 'meal', 'home', 'daily', 'chanukah', 'purim', 'yom-tov', 'tisha-bav', 'tu-bishvat', 'travel', 'life-cycle']);
export const RULE_TYPES = new Set(['din', 'minhag', 'chumra', 'machloket']);
const existing = new Map(publishedPracticalQuestions().filter(item => !item.sourceBook).map(item => [normalizeQuery(item.question), item.id]));
const seen = new Map();
let failed = 0, total = 0, skipped = 0;
const covered = new Set();
for (const file of drafts) {
  const list = JSON.parse(readFileSync(file, 'utf8'));
  for (const record of list) {
    const where = `${file.split('/').pop()} ${record.id || record.unit}`;
    const found = units.get(record.unit);
    const errors = [], warnings = [];
    if (!found) { console.log(`✗ ${where}: unknown unit ${record.unit}`); failed++; continue; }
    covered.add(record.unit);
    if (record.skip) { skipped++; if (String(record.skip).length < 8) console.log(`✗ ${where}: a skip needs a reason`); continue; }
    total++;
    if (!/^ong-\d+-\d+(?:-[a-z])?$/.test(record.id || '')) errors.push('id must be ong-<chapter>-<n>[-a|-b…]');
    if (!record.id?.startsWith(`ong-${record.unit.replace('.', '-')}`)) errors.push('id must start with ong-<chapter>-<n> of its unit');
    if (!/[?？]$/.test(record.question || '')) errors.push('the question must end with "?"');
    if (!Array.isArray(record.variants) || record.variants.length < 2 || record.variants.length > 6) errors.push('2–6 variants');
    if (!Array.isArray(record.keywords) || record.keywords.length < 2 || record.keywords.length > 10) errors.push('2–10 keywords');
    if (new Set((record.variants || []).map(normalizeQuery)).size !== (record.variants || []).length || (record.variants || []).some(v => normalizeQuery(v) === normalizeQuery(record.question))) errors.push('variants must differ from each other and from the question');
    if (!CURRENTNESS_VALUES.includes(record.currentness)) errors.push('currentness');
    if (!record.currentnessNote) errors.push('currentnessNote: say why');
    if (!RULE_TYPES.has(record.ruleType)) errors.push('ruleType');
    if (!Array.isArray(record.contexts) || !record.contexts.length || record.contexts.some(key => !CONTEXTS.has(key))) errors.push(`contexts from: ${[...CONTEXTS].join(', ')}`);
    if (!record.category || !record.topic) errors.push('category and topic');
    const high = record.currentness === 'HIGH_STAKES_REVIEW';
    if (high && record.shortAnswer) errors.push('a HIGH_STAKES_REVIEW record carries no short answer (the book\'s words only)');
    if (!high && (!record.shortAnswer || record.shortAnswer.length > 260)) errors.push('shortAnswer: 1–260 characters');
    if (record.explanation && record.explanation.length > 420) errors.push('explanation: at most 420 characters');
    if (record.excerpt && (record.excerpt.length < 25 || record.excerpt.length > 700)) errors.push('excerpt: 25–700 characters');
    if (record.dangerExcerpt && !found.unit.text.includes(record.dangerExcerpt)) errors.push('dangerExcerpt is not verbatim in the halacha');
    const verdict = gate({ ...record, conditions: record.conditions || [] }, { unitText: found.unit.text, notesText: found.notesText, chapter: found.chapter });
    errors.push(...verdict.errors); warnings.push(...verdict.warnings);
    const key = normalizeQuery(record.question || '');
    if (existing.has(key)) errors.push(`the same question is already published (${existing.get(key)}); ask it in the book's own terms`);
    if (seen.has(key)) errors.push(`duplicate question (also ${seen.get(key)})`);
    seen.set(key, record.id);
    if (errors.length) { failed++; console.log(`✗ ${where}: ${errors.join(' | ')}`); }
    for (const warning of warnings) console.log(`! ${where}: ${warning}`);
  }
}
console.log(`\n${total} records, ${skipped} skips, ${failed} with errors, ${covered.size} units covered`);
process.exit(failed ? 1 : 0);
