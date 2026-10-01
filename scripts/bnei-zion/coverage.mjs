// Stage 8 — the coverage report (docs/bnei-zion/coverage.md): first, in Hebrew, the weeks and occasions with no or thin
// material (the owner will look for more); then every parasha, double week, festival and special Shabbat with counts by
// length and kind; then totals, the pieces left out and why, and the classification corrections.
// Usage: node scripts/bnei-zion/coverage.mjs [--pilot]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOLIDAYS, SPECIAL_SHABBATOT } from '../../src/services/torahTaxonomy.mjs';
import { GENERATED_HEADER, PARASHOT, ROOT, paths, readJson, stripPoints } from './lib.mjs';

const THIN = 5;
const DOUBLE_WEEKS = [['ויקהל', 'פקודי'], ['תזריע', 'מצורע'], ['אחרי מות', 'קדושים'], ['בהר', 'בחוקותי'], ['חוקת', 'בלק'], ['מטות', 'מסעי'], ['ניצבים', 'וילך']];

export function coverage({ pilotOnly = false } = {}) {
  const P = paths();
  const ingest = readJson(P.stage('ingest'));
  const ex = readJson(P.stage('extract')).files;
  const seg = readJson(P.stage('segment'));
  const dd = readJson(P.stage('dedupe'));
  const { articles } = readJson(P.stage('validate'));
  const pub = articles.filter(a => a.status === 'published');
  const review = articles.filter(a => a.status === 'review');
  const rejected = articles.filter(a => a.status === 'rejected');
  const sum = k => ex.reduce((s, f) => s + f[k], 0);
  const stats = list => ({
    n: list.length, short: list.filter(a => a.length === 'short').length, medium: list.filter(a => a.length === 'medium').length,
    long: list.filter(a => a.length === 'long').length, story: list.filter(a => a.contentType === 'story').length,
    mashal: list.filter(a => a.contentType === 'mashal').length, table: list.filter(a => a.shabbatTable).length,
  });
  const row = (name, list) => { const s = stats(list); return `| ${name} | ${s.n} | ${s.short} | ${s.medium} | ${s.long} | ${s.story} | ${s.mashal} | ${s.table} |`; };
  const HEAD = '| | סה״כ | קצר (עד 3 דק׳) | בינוני | ארוך (8+ דק׳) | סיפורים | משלים | לשולחן שבת |\n|---|---|---|---|---|---|---|---|';
  const byParasha = p => pub.filter(a => a.parashot.includes(p));
  const byHoliday = h => pub.filter(a => a.holidays.includes(h));
  const bySpecial = s => pub.filter(a => a.specialShabbatot.includes(s));
  const L = [];
  L.push(`# בני ציון — דוח כיסוי${pilotOnly ? ' (פיילוט)' : ''}`, '', `> ${GENERATED_HEADER}`, '', `נוצר ${new Date().toISOString().slice(0, 10)} · \`scripts/bnei-zion/coverage.mjs\``, '');
  // ---- the list the owner asked for, first ----
  L.push('## שבועות ומועדים שחסר בהם חומר', '', `פרשות, מועדים ושבתות מיוחדות **בלי חומר כלל** או עם **פחות מ-${THIN} דברי תורה** שפורסמו. כאן כדאי להשלים חומר.`, '');
  const none = [], thin = [];
  for (const p of PARASHOT) { const n = byParasha(p).length; if (!n) none.push(`פרשת ${p}`); else if (n < THIN) thin.push(`פרשת ${p} (${n})`); }
  for (const h of HOLIDAYS) { const n = byHoliday(h.id).length; if (!n) none.push(h.he); else if (n < THIN) thin.push(`${h.he} (${n})`); }
  for (const s of SPECIAL_SHABBATOT) { const n = bySpecial(s.id).length; if (!n) none.push(s.he); else if (n < THIN) thin.push(`${s.he} (${n})`); }
  L.push(`**אין חומר כלל (${none.length}):** ${none.join(' · ') || '—'}`, '', `**חומר דל — פחות מ-${THIN} (${thin.length}):** ${thin.join(' · ') || '—'}`, '');
  L.push('הערות: שבת מיוחדת משויכת רק לקטעים שעוסקים בה (הפרשה הרגילה נשמרת תמיד), ולכן המספרים שלה נמוכים מאלה של הפרשה שבה היא חלה. קטעים שעוסקים בפרשה ובמועד גם יחד משויכים לשניהם.', '');
  // ---- weeks ----
  L.push('## כל פרשות השבוע', '', HEAD);
  for (const p of PARASHOT) L.push(row(p, byParasha(p)));
  L.push('', '### שבועות של פרשות מחוברות (כל קטע של אחת משתי הפרשות)', '', HEAD);
  for (const [a, b] of DOUBLE_WEEKS) L.push(row(`${a}-${b}`, pub.filter(x => x.parashot.includes(a) || x.parashot.includes(b))));
  L.push('', '## מועדים', '', HEAD);
  for (const h of HOLIDAYS) L.push(row(`${h.he} (${h.id})`, byHoliday(h.id)));
  L.push('', '## שבתות מיוחדות', '', HEAD);
  for (const s of SPECIAL_SHABBATOT) L.push(row(`${s.he} (${s.id})`, bySpecial(s.id)));
  L.push('', '## כללי (ללא שיוך לפרשה או מועד)', '', HEAD, row('כללי', pub.filter(a => !a.parashot.length && !a.holidays.length && !a.specialShabbatot.length)), '');
  const types = {};
  for (const a of pub) types[a.contentType] = (types[a.contentType] || 0) + 1;
  L.push('## לפי סוג', '', '| סוג | קטעים |', '|---|---|', ...Object.entries(types).sort((x, y) => y[1] - x[1]).map(([k, v]) => `| ${k} | ${v} |`), '');
  const topics = {};
  for (const a of pub) for (const t of a.topics) topics[t] = (topics[t] || 0) + 1;
  L.push('## לפי נושא', '', '| נושא | קטעים |', '|---|---|', ...Object.entries(topics).sort((x, y) => y[1] - x[1]).map(([k, v]) => `| ${k} | ${v} |`), `| (ללא נושא מובהק) | ${pub.filter(a => !a.topics.length).length} |`, '');
  // ---- totals ----
  L.push('## Totals', '', '| | |', '|---|---|',
    `| PDFs in the archive manifest | ${ingest.totalInManifest} |`,
    `| excluded (administrative appendix 04_נספחים_אחרים) | ${ingest.excluded.length} |`,
    `| PDFs inspected / processed | ${ex.length} / ${ex.length} |`,
    `| pages | ${sum('pages')} |`,
    `| pages read from the text layer (legacy Q-font encoding, decoded and checked) | ${sum('textLayerOk')} |`,
    `| pages that needed Hebrew OCR | ${sum('ocrPages')} |`,
    `| pages unreadable (nothing published from them) | ${sum('failedPages')} |`,
    `| issues (leaflets) detected | ${seg.files.reduce((s, f) => s + f.issues, 0)} |`,
    `| articles extracted | ${seg.articles.length} |`,
    `| unique articles after de-duplication | ${articles.length} |`,
    `| duplicates merged into sourceAppearances | ${seg.articles.length - articles.length} (incl. ${dd.containedMerged} merges of a shorter printing contained in a longer one) |`,
    `| borderline near-duplicates (kept, both published) | ${dd.borderline.length} pairs |`,
    `| published | ${pub.length} |`, `| review | ${review.length} |`, `| rejected | ${rejected.length} |`, '');
  // ---- left out ----
  L.push('## Left out', '', '### Rejected — cut off mid-sentence in the source (owner: delete) or unreadable', '', '| reason | file | pages | heading |', '|---|---|---|---|');
  for (const a of rejected) L.push(`| ${a.reviewReasons.join(', ')} | ${a.originalPdf.split('/').pop()} | ${a.pageStart}–${a.pageEnd} | ${stripPoints(a.heading || a.title || '').slice(0, 70).replace(/\|/g, '/')} |`);
  L.push('', '### Review (not published until a person looks)', '', '| reason | file | pages | heading |', '|---|---|---|---|');
  for (const a of review) L.push(`| ${a.reviewReasons.join(', ')} | ${a.originalPdf.split('/').pop()} | ${a.pageStart}–${a.pageEnd} | ${stripPoints(a.heading || a.title || '').slice(0, 70).replace(/\|/g, '/')} |`);
  for (const f of ex.filter(x => x.failedPages)) L.push(`| unreadable pages (${f.failedPages}) | ${f.id} | | |`);
  const contacts = seg.articles.reduce((s, a) => s + a.removed.filter(r => r.kind === 'contact').length, 0);
  L.push('', `Private contact sentences removed (phone numbers / e-mail / verification lines — owner's rule): ${contacts} occurrences across all printings.`, '');
  L.push('## Classification', '');
  const notes = {};
  for (const a of articles) for (const n of a.classificationNotes) { const k = n.replace(/ refines folder .*/, ' refines the folder').replace(/ \(parasha \d+, festival \d+\)/, ''); notes[k] = (notes[k] || 0) + 1; }
  for (const [k, n] of Object.entries(notes).sort((x, y) => y[1] - x[1]).slice(0, 40)) L.push(`- ${k.replace(/\|/g, '/')}: ${n}`);
  L.push('');
  writeFileSync(join(ROOT, 'docs', 'bnei-zion', 'coverage.md'), `${L.join('\n')}\n`);
  return { written: 'docs/bnei-zion/coverage.md', none: none.length, thin: thin.length };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('coverage:', JSON.stringify(coverage({ pilotOnly: process.argv.includes('--pilot') })));
