// עונג שבת (הרב ישראל שריקי, מהדורה ראשונה תשע״ג) as a library work, with its footnotes ("מקורות וטעמים") as a separate
// layer anchored to the halacha each note belongs to. Step 3 of the import (steps 1–2: scripts/library/ong-shabbat/).
// Run: node scripts/library/build-ong-shabbat.mjs --book <book.json> --lines <lines.json> --pdf-sha256 <hex> [--pdf-bytes N]
//
// Rights: used with the author's permission (licence id `author-permission`; see docs/halacha/ong-shabbat-audit.md §M).
// Not Public Domain, not Creative Commons. The PDF itself is never stored in the repository; this script writes:
//   public/library/packs/author-permission-ong-shabbat/  Oneg_Shabbat.json.gz, Oneg_Shabbat_Notes.json.gz (+ anchors)
//   src/data/library/corpus/ongShabbat.mjs               the generated index the registry reads
//   sources/ong-shabbat/provenance.json                  PDF SHA-256, page map, per-unit text hashes, every irregularity
// The words are the book's: lines joined with a space, justification spaces collapsed, footnote markers moved out of the
// text into offsets (fn: [[note, at]]). Nothing is corrected; printed irregularities are listed in the provenance.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { COVERAGE, coverageRecord, validateWorkChunk } from '../../src/services/library/integrity.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const fail = message => { throw new Error(message); };
const bookText = readFileSync(arg('--book') || fail('--book'), 'utf8');
const book = JSON.parse(bookText);
const linesText = readFileSync(arg('--lines') || fail('--lines'), 'utf8');
const PDF_SHA256 = arg('--pdf-sha256') || fail('--pdf-sha256');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const gz = body => gzipSync(Buffer.from(body), { level: 9 });
const BUILT_AT = arg('--built-at') || new Date().toISOString().slice(0, 10);

const PACK_ID = 'author-permission-ong-shabbat';
const WORK_ID = 'Oneg_Shabbat';
const NOTES_ID = 'Oneg_Shabbat_Notes';
const CREDIT = 'עונג שבת · הרב ישראל שריקי · באישור המחבר, כל הזכויות שמורות';
const PROVENANCE = 'sources/ong-shabbat/provenance.json';

// ---------- the base work: chapters א׳–כ״ה (halachot), כ״ו (the blessing table), then פתח דבר ----------
const nodes = [];
const nodeTitles = [];
const unitHashes = {};
const chapterInfo = [];
for (const chapter of book.chapters) {
  const n = chapter.n;
  nodeTitles.push(`פרק ${chapter.label.replace(/'$/, '׳').replace(/"/, '״')} · ${chapter.title}`);
  let lastHead = chapter.title;
  let lastSub = null;
  const units = chapter.units.map(unit => {
    const heads = [];
    if (unit.section && unit.section !== lastHead) { heads.push(unit.section); lastHead = unit.section; lastSub = null; }
    if (unit.subsection && unit.subsection !== lastSub) { heads.push(unit.subsection); lastSub = unit.subsection; }
    const id = `${WORK_ID}.${n}.${unit.n}`;
    unitHashes[id] = sha256(unit.text);
    return {
      id, n: unit.n,
      ...(heads.length ? { head: heads.join(' · ') } : {}),
      ...(unit.label ? { label: unit.label } : {}),
      ...(unit.title ? { title: unit.title } : {}),
      text: unit.text,
      ...(unit.subs.length ? { sh: unit.subs } : {}),
      ...(unit.ems.length ? { em: unit.ems } : {}),
      ...(unit.refs.length ? { fn: unit.refs.map(ref => [ref.n, ref.at]) } : {}),
      p: unit.pages,
    };
  });
  nodes.push({ id: `${WORK_ID}.${n}`, n, units });
  const pages = chapter.units.flatMap(unit => unit.pages);
  chapterInfo.push({ n, label: chapter.label, title: chapter.title, pages: [Math.min(...pages), Math.max(...pages)], sections: chapter.sections.map(section => section.title), halachot: chapter.units.length, footnotes: chapter.units.reduce((total, unit) => total + unit.refs.length, 0) });
}
// Chapter כ״ו: the blessing table (food – first blessing / last blessing), grouped by letter.
{
  const n = book.chapters.length + 1;
  nodeTitles.push('פרק כ״ו · לוח ברכות');
  const units = [{ id: `${WORK_ID}.${n}.1`, n: 1, text: book.blessingTable.intro, p: [277] }];
  let letter = null;
  for (const entry of book.blessingTable.entries) {
    const u = units.length + 1;
    units.push({ id: `${WORK_ID}.${n}.${u}`, n: u, ...(entry.letter !== letter ? { head: entry.letter.replace(/'$/, '׳') } : {}), text: entry.text, ...(entry.em ? { em: [0] } : {}), p: entry.pages });
    letter = entry.letter;
  }
  for (const unit of units) unitHashes[unit.id] = sha256(unit.text);
  nodes.push({ id: `${WORK_ID}.${n}`, n, units });
  chapterInfo.push({ n, label: 'כ"ו', title: 'לוח ברכות', pages: [277, 295], sections: [...new Set(book.blessingTable.entries.map(entry => entry.letter))], entries: book.blessingTable.entries.length, footnotes: 0 });
}
// פתח דבר: paragraphs; a heading line becomes the head of the paragraph after it.
{
  const n = nodes.length + 1;
  nodeTitles.push('פתח דבר');
  const units = [];
  let head = null;
  for (const para of book.front.intro) {
    if (para.kind === 'head') { head = head ? `${head} · ${para.text}` : para.text; continue; }
    const u = units.length + 1;
    units.push({ id: `${WORK_ID}.${n}.${u}`, n: u, ...(head ? { head } : {}), text: para.text, p: [para.page] });
    head = null;
  }
  for (const unit of units) unitHashes[unit.id] = sha256(unit.text);
  nodes.push({ id: `${WORK_ID}.${n}`, n, units });
}

// ---------- the notes layer: "מקורות וטעמים", one node per chapter, each note anchored to its halacha ----------
// One visible, recorded redaction: a private person's mobile number printed in a note (2013) is not carried into the app.
// The note's original text hash stays in the provenance, so the rest of the note is provably the book's.
const REDACTIONS = [{ note: 440, pattern: /05\d-\d{7}/, replacement: '[מספר הטלפון שבספר לא הובא כאן]', why: 'מספר טלפון נייד של אדם פרטי (טכנאי) שנדפס ב־2013; ייתכן שאינו שלו עוד. להחלטת בעל האפליקציה והמחבר.' }];
const redactions = [];
for (const rule of REDACTIONS) {
  const note = book.footnotes.find(item => item.n === rule.note) || fail(`note ${rule.note} missing`);
  if (!rule.pattern.test(note.text)) fail(`note ${rule.note}: nothing to redact`);
  redactions.push({ note: rule.note, originalSha256: sha256(note.text), replacement: rule.replacement, why: rule.why });
  note.text = note.text.replace(rule.pattern, rule.replacement);
}
const noteText = new Map(book.footnotes.map(note => [note.n, note]));
const noteNodes = [];
const anchors = [];
const anchorNodes = [];
const noteHashes = {};
for (const chapter of book.chapters) {
  const units = [];
  for (const unit of chapter.units) for (const ref of unit.refs) {
    const note = noteText.get(ref.n) || fail(`note ${ref.n} missing`);
    const k = units.length + 1;
    const id = `${NOTES_ID}.${chapter.n}.${k}`;
    units.push({ id, n: k, fn: ref.n, v: unit.n, ...(unit.label ? { vl: unit.label } : {}), text: note.text, p: note.pages });
    anchors.push({ unitId: id, anchorRef: `${WORK_ID}.${chapter.n}.${unit.n}`, canonicalRef: `Oneg Shabbat, note ${ref.n}`, baseCanonicalRef: `Oneg Shabbat ${chapter.n}:${unit.n}` });
    noteHashes[id] = sha256(note.text);
  }
  if (units.length) { noteNodes.push({ id: `${NOTES_ID}.${chapter.n}`, n: chapter.n, units }); anchorNodes.push([chapter.n, chapter.n, 1, units.length]); }
}
if (anchors.length !== book.footnotes.length) fail(`anchored ${anchors.length} of ${book.footnotes.length} notes`);

// ---------- write the pack (staging → final) ----------
const staging = join(ROOT, 'public/library/packs', `${PACK_ID}.staging`);
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
const files = [];
const writeJson = (file, data, role = 'text') => {
  const body = JSON.stringify(data);
  const packed = gz(body);
  writeFileSync(join(staging, file), packed);
  const record = { file, role, bytes: packed.length, rawBytes: Buffer.byteLength(body), checksum: checksum(body), sha256: sha256(body) };
  files.push(record);
  return record;
};
const expectedOf = list => list.map(node => ({ n: node.n, units: node.units.length }));
const baseChunk = { workId: WORK_ID, editionId: `${PACK_ID}:${WORK_ID}`, packId: PACK_ID, nodes };
const baseReport = validateWorkChunk(baseChunk, expectedOf(nodes));
if (baseReport.status !== COVERAGE.FULL) fail(`base: ${JSON.stringify(baseReport).slice(0, 400)}`);
const baseFile = writeJson(`${WORK_ID}.json.gz`, baseChunk);
const noteExpected = book.chapters.map(chapter => ({ n: chapter.n, units: noteNodes.find(node => node.n === chapter.n)?.units.length || 0 }));
const notesChunk = { workId: NOTES_ID, editionId: `${PACK_ID}:${NOTES_ID}`, packId: PACK_ID, nodes: noteNodes };
const notesReport = validateWorkChunk(notesChunk, noteExpected);
if (notesReport.status !== COVERAGE.FULL) fail(`notes: ${JSON.stringify(notesReport).slice(0, 400)}`);
const notesFile = writeJson(`${NOTES_ID}.json.gz`, notesChunk);
const anchorsBody = { workId: NOTES_ID, editionId: notesChunk.editionId, relationType: 'commentary', baseWorkId: WORK_ID, anchorScheme: 'footnote-marker', license: 'author-permission', anchors };
const anchorsFile = writeJson(`${NOTES_ID}.anchors.json.gz`, anchorsBody, 'anchors');

const edition = {
  title: 'Oneg Shabbat, first edition 5773 (2013)',
  heTitle: 'עונג שבת · מהדורה ראשונה תשע״ג',
  editor: 'הרב ישראל שריקי',
  notes: 'הטקסט חולץ מקובץ הספר (PDF) לפי מקום כל אות בעמוד, ונבדק מול תוכן העניינים והמפתח של הספר. לא תוקנה מילה; הערות השוליים ("מקורות וטעמים") שמורות כשכבה נפרדת, כל אחת מעוגנת להלכה שבה מופיע מספרה.',
};
const coverageNote = 'עמ׳ 4–11 (מכתבי ההסכמות) מודפסים כתמונה בלבד ואינם בטקסט; עמ׳ 2 (פרטי ההוצאה), 19–36 (תוכן העניינים), 296–312 (מפתח העניינים, משמש לחיפוש ולקישור) ו־313–318 (הקדשות) לא הובאו כטקסט לקריאה.';
const baseWork = {
  workId: WORK_ID, title: 'Oneg Shabbat', heTitle: 'עונג שבת', group: 'sephardic-psak',
  aliases: ['עונג שבת', 'ענג שבת', 'אונג שבת', 'עונג שבת שריקי', 'הרב שריקי', 'שריקי', 'הלכות שבת עונג שבת'],
  authors: ['הרב ישראל שריקי'], compDate: '2013',
  editionTitle: edition.title, editionHeTitle: edition.heTitle, provider: 'author', versionSource: null,
  license: 'author-permission', recordedLicense: 'כל הזכויות שמורות למחבר (בדפוס); בשימוש באישור המחבר',
  licenseVerifiedAt: BUILT_AT,
  attribution: { text: CREDIT },
  sourceLine: CREDIT,
  tabNames: { source: 'לשון הספר', commentary: 'מקורות וטעמים' },
  nodeLabel: 'פרק', unitLabel: 'הלכה', nodeTitles,
  status: baseReport.status, missingUnits: [], file: baseFile.file, bytes: baseFile.bytes, rawBytes: baseFile.rawBytes, checksum: baseFile.checksum,
  nodes: nodes.map(node => node.units.length), expected: nodes.map(node => node.units.length),
  // The work is complete as a text of halachot; the approbation letters (images) are the one part that is not text.
  coverage: coverageRecord({ expectedUnits: baseReport.expectedUnits, importedUnits: baseReport.importedUnits, missingUnits: [], coverageStatus: COVERAGE.PARTIAL, basis: 'every numbered halacha of chapters א׳–כ״ה (checked against the book\'s table of contents), every entry of the blessing table, the introduction', noTextInPrint: ['pp. 4–11: approbation letters, printed as images'], notImported: ['p. 2 imprint', 'pp. 19–36 table of contents', 'pp. 296–312 subject index (used for search)', 'pp. 313–318 dedications'], note: coverageNote }),
};
const notesWork = {
  workId: NOTES_ID, title: 'Oneg Shabbat — Sources and Reasons', heTitle: 'עונג שבת · מקורות וטעמים', shortTitle: 'מקורות וטעמים', layerTitle: 'מקורות וטעמים', layerRank: 1, layerOnly: true,
  group: 'sephardic-psak', aliases: [], authors: ['הרב ישראל שריקי'], compDate: '2013',
  editionTitle: edition.title, editionHeTitle: edition.heTitle, provider: 'author', versionSource: null,
  license: 'author-permission', recordedLicense: baseWork.recordedLicense, licenseVerifiedAt: BUILT_AT,
  attribution: { text: CREDIT }, sourceLine: CREDIT,
  nodeLabel: 'פרק', unitLabel: 'הערה', baseUnitLabel: 'הלכה',
  nodeTitles: book.chapters.map((chapter, i) => nodeTitles[i]),
  status: notesReport.status, missingUnits: [], file: notesFile.file, bytes: notesFile.bytes, rawBytes: notesFile.rawBytes, checksum: notesFile.checksum,
  nodes: noteExpected.map(item => item.units), expected: noteExpected.map(item => item.units),
  relation: { relationType: 'commentary', baseWorkId: WORK_ID, anchorScheme: 'footnote-marker' },
  anchorsFile: anchorsFile.file, anchorsChecksum: anchorsFile.checksum, anchorNodes,
  coverage: coverageRecord({ expectedUnits: book.footnotes.length, importedUnits: notesReport.importedUnits, missingUnits: [], basis: 'footnotes numbered 1–958 through the book; each one is referenced exactly once, in order', anchoredUnits: anchors.length, unanchoredUnits: 0 }),
};
const bytes = files.reduce((total, file) => total + file.bytes, 0);
const pack = {
  packId: PACK_ID, contentVersion: `עונג שבת, מהדורה ראשונה תשע״ג — חולץ ${BUILT_AT}`, family: 'corpus', category: 'halacha', structure: ['chapter', 'halacha'],
  nodeLabel: 'פרק', unitLabel: 'הלכה', policy: 'source', source: 'author', license: 'author-permission', edition, sourceUrl: null,
  retrievedAt: BUILT_AT, bytes, provenance: PROVENANCE, works: [baseWork, notesWork],
};
writeFileSync(join(staging, 'manifest.json'), JSON.stringify({ ...pack, works: undefined, files }, null, 1));
const packDir = join(ROOT, 'public/library/packs', PACK_ID);
rmSync(packDir, { recursive: true, force: true });
renameSync(staging, packDir);

const reports = [
  { workId: WORK_ID, expectedUnits: baseReport.expectedUnits, importedUnits: baseReport.importedUnits, status: baseReport.status, checksum: baseFile.checksum, missing: 0 },
  { workId: NOTES_ID, expectedUnits: notesReport.expectedUnits, importedUnits: notesReport.importedUnits, status: notesReport.status, checksum: notesFile.checksum, missing: 0 },
];
writeFileSync(join(ROOT, 'src/data/library/corpus/ongShabbat.mjs'), `// Generated by scripts/library/build-ong-shabbat.mjs. Do not edit by hand.\nexport default ${JSON.stringify({ generatedAt: BUILT_AT, packs: [pack], remoteLayers: [], blockedLayers: [], reports })};\n`);

// ---------- provenance ----------
const pageMap = [
  { pages: '1', content: 'שער הספר', imported: false },
  { pages: '2', content: 'פרטי ההוצאה: "כל הזכויות שמורות · מהדורה ראשונה תשע״ג", עימוד ועיצוב, טלפונים להשגת הספר', imported: false, why: 'פרטי הוצאה וטלפונים של משפחת המחבר; זכויות היוצרים נרשמו כאן' },
  { pages: '3', content: 'שער ההסכמות (רשימת 8 הסכמות)', imported: false, why: 'הרשימה נשמרה ב־approbations' },
  { pages: '4–11', content: 'מכתבי ההסכמות', imported: false, why: 'מודפסים כתמונה בלבד; אין שכבת טקסט' },
  { pages: '12–18', content: 'פתח דבר', imported: true, node: nodes.length },
  { pages: '19–36', content: 'תוכן העניינים', imported: false, why: 'האפליקציה בונה תוכן משלה; שימש לבדיקת כל כותרת (905 פריטים ממוספרים)' },
  { pages: '37', content: 'שער: הלכות שבת, פרקים א׳–כ״ד', imported: false },
  ...chapterInfo.filter(info => info.n <= 25).map(info => ({ pages: `${info.pages[0]}–${info.pages[1]}`, content: `פרק ${info.label} · ${info.title}`, imported: true, node: info.n, halachot: info.halachot, footnotes: info.footnotes })),
  { pages: '272', content: 'עמוד ריק', imported: false },
  { pages: '273', content: 'שער: דיני ברכות, פרקים כ״ה–כ״ו', imported: false },
  { pages: '277–295', content: 'פרק כ״ו · לוח ברכות', imported: true, node: 26, entries: book.blessingTable.entries.length },
  { pages: '296–312', content: 'מפתח עניינים מפורט', imported: false, why: `${book.index.length} ערכים; משמשים כאוצר מילים לחיפוש ומקושרים להלכה שאליה הם מפנים` },
  { pages: '313–318', content: 'הקדשות (להצלחה, לרפואה, לעילוי נשמת)', imported: false, why: 'שמות אנשים פרטיים; ההחלטה בידי בעל האפליקציה והמחבר' },
  { pages: '319', content: 'עמוד ריק', imported: false },
];
const provenance = {
  work: 'עונג שבת', author: 'הרב ישראל שריקי', edition: 'מהדורה ראשונה תשע״ג', date: 'אור לאלול התשע״ג (פתח דבר); אלול תשע״ג (שער)',
  copyright: 'כל הזכויות שמורות (בדפוס)',
  rightsBasis: 'author-permission',
  permissionStatedBy: 'בעל האפליקציה',
  permissionEvidence: 'written permission to be kept by the owner — not stored in the repo',
  license: 'author-permission',
  licenseNote: 'Used with the author\'s permission. Not Public Domain and not under any Creative Commons licence. The permission covers this work only.',
  credit: CREDIT,
  pdf: { file: 'עונג שבת-חדש-מוצש.pdf', sha256: PDF_SHA256, bytes: Number(arg('--pdf-bytes')) || null, pages: 319, producer: 'Adobe PDF Library 9.0', creator: 'Adobe InDesign CS4 (6.0)', created: '2013-08-04', storedInRepository: false },
  extraction: {
    method: 'scripts/library/ong-shabbat/extract.py (PyMuPDF 1.26.5, glyph positions → visual right-to-left order) → structure.py → scripts/library/build-ong-shabbat.mjs',
    linesSha256: sha256(linesText),
    bookSha256: sha256(bookText),
    normalisation: 'lines joined with one space; runs of justification spaces collapsed; 26 control characters (U+0007) removed; footnote markers moved to offsets (unit.fn). No word changed.',
    checks: ['footnotes 1–958 continuous, each referenced exactly once and in order', 'every numbered item of the table of contents (905) found in its chapter under the same number', 'halacha numbering continuous within every section', 'pages rendered and compared by eye where the extraction order was doubtful (e.g. pp. 47, 63, 121)'],
  },
  approbations: book.front.approbations,
  pageMap,
  chapters: chapterInfo,
  anomalies: book.anomalies,
  tocDiscrepancies: ['תוכן העניינים (עמ׳ 33) מביא את "יולדת – עמ׳ 244" תחת פרק כ׳ בלי כותרת "פרק כ״א"; בגוף הספר (עמ׳ 244) זהו פרק כ״א "דיני יולדת".'],
  indexErrata: book.indexErrata,
  removedControlChars: book.removedControlChars.length,
  redactions,
  files: files.map(({ file, role, bytes: size, rawBytes, checksum: sum, sha256: hash }) => ({ file, role, bytes: size, rawBytes, checksum: sum, sha256: hash })),
  unitHashes,
  noteHashes,
};
mkdirSync(join(ROOT, 'sources/ong-shabbat'), { recursive: true });
writeFileSync(join(ROOT, PROVENANCE), `${JSON.stringify(provenance, null, 1)}\n`);
console.log(JSON.stringify({ units: baseReport.importedUnits, notes: notesReport.importedUnits, bytes, files: files.map(file => [file.file, file.bytes, file.rawBytes]) }, null, 1));
