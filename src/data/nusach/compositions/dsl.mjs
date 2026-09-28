// The vocabulary of a rite composition (see services/prayer/riteServiceComposer.mjs).
//   sec(id, concept, title, ref, { start, end, range, when, role, continues, rewind, note })
//     id       — unique inside the service (the section's anchor in the reader)
//     concept  — a concept of data/nusach/prayerSchema.mjs (what this part of the prayer IS)
//     title    — the reviewed Hebrew title shown in the reader; '' for a continuation without a title
//     ref      — the full address of the leaf in the rite's pack
//     start    — unpointed words that open the section's first paragraph (default: where the previous section of
//                the same leaf ended); end — words of its last paragraph (default: up to the next section of the leaf)
//     range    — [from, to] paragraph indexes, only when the text offers no reliable words
//     when     — the day condition (riteServiceComposer.WHEN_LABELS), e.g. 'tachanun', 'roshChodesh|fast'
//     role     — 'repetition' | 'congregation' | 'chazzan' | 'minyan' | 'mourners' | 'optional'
//   service(title, sections, { reviewed, missing, conditionsPending, notes })
//     reviewed — the mapping was read through against the text, section by section, and the order checked
//     missing  — [{ concept, why }] required concepts the licensed edition does not provide (SOURCE GAP)
export const sec = (id, concept, title, ref, options = {}) => ({ id, concept, title, ref, ...options });
// A paragraph run of a used leaf that is deliberately not shown, with the reason (the QA requires every paragraph of
// a used leaf to be either in a section or omitted with a reason — nothing disappears silently).
export const omit = (id, ref, options = {}) => ({ id, concept: null, title: '', ref, omit: true, ...options });
export const service = (title, sections, options = {}) => ({ title, sections, reviewed: false, missing: [], ...options });
export const leaf = index => path => `${index}, ${path}`;

// A table printed for every day (the Omer): `perDay: dayBlocks('omerDay', n => /pattern of day n's first line/)` keeps,
// in today's prayer, the paragraphs from day n's first line up to (not including) day n+1's first line. No line
// recognised → nothing is filtered (the whole table stays, never a guess).
export const dayBlocks = (key, firstLineOf, last = 49) => ({
  key,
  select: (plains, n) => {
    const at = plains.findIndex(text => firstLineOf(n).test(text));
    if (at < 0) return [];
    const next = n < last ? plains.findIndex((text, index) => index > at && firstLineOf(n + 1).test(text)) : -1;
    const end = next > at ? next : plains.length;
    return Array.from({ length: end - at }, (_, i) => at + i);
  },
});
