// Stage 3 — segmentation. Extracted lines → leaflets (issues) → articles, each with its exact pages.
// The archive's layout (verified across the pilot): an issue opens with a header page — "בס״ד", a motto, "פרשת השבוע: …",
// the Hebrew and civil date, Shabbat times, haftara, contact line — and the green "בני ציון" masthead. Every piece of
// Torah under it has a heading line (a verse, a saying, a title) set right above a dashed rule ("-------"); a story is
// sometimes headed by a fully bold line without a rule. A collected file ("שנים קודמות") is several issues back to back.
// Nothing here edits words: header/footer lines, page numbers and rules are dropped, lines are joined into paragraphs.
// Usage: node scripts/bnei-zion/segment.mjs [--pilot]
import { join } from 'node:path';
import { exists, paths, readJson, stripPoints, writeJson } from './lib.mjs';

const P_ = '[\\u0591-\\u05C7]*';
// A regular expression for Hebrew words that may carry points: "שבת שלום" matches "שַׁבָּת שָׁלוֹם" as well.
export const pointed = (words, flags = '') => new RegExp(words.split('').map(ch => (/[א-ת]/.test(ch) ? ch + P_ : ch === ' ' ? '\\s+' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join(''), flags);

const isRule = l => /^[-_–—=*·.\s]{8,}$/.test(l.text) && /[-_–—]{6,}/.test(l.text);
const isMasthead = l => l.size >= 22 && /בני\s*ציון/.test(stripPoints(l.text));
const isPageNumber = l => /^\d{1,3}$/.test(l.text.trim()) && l.y < 30;
const isBsd = l => /^בס"ד$|^בס״ד$|^ב"ה$/.test(stripPoints(l.text).trim()) && l.y < 40;
const TERMINAL = /[.!?:;"״'׳)\]…]\s*$/;
const FOOTER_RE = [
  pointed('שבת שלום'), pointed('נא לשמור על קדושת'), pointed('חג שמח'), pointed('חג כשר'), pointed('גמר חתימה'), pointed('שנה טובה'),
];
// A footer greeting is the last sentence(s) of an issue: "שבת שלום (ומבורך / וחג כשר ושמח) לכל בית ישראל! נא לשמור על קדושת הגיליון!"
const GREETING_START = `(?:${pointed('שבת שלום').source}|${pointed('שלום').source}(?=\\s+${pointed('לכל').source})|${pointed('חג').source}\\s+\\S+\\s+${pointed('שמח').source}|${pointed('חג').source}\\s+${pointed('כשר').source}|${pointed('חג שמח').source}|${pointed('גמר חתימה').source}|${pointed('שנה טובה').source}|${pointed('מועדים לשמחה').source})`;
const TRAILING_FOOTER = new RegExp(`\\s*${GREETING_START}[^.]{0,80}?(?:${pointed('לכל').source}\\s+(?:${pointed('בית ישראל').source}|\\S+)|${pointed('לבית ישראל').source})\\s*!?\\s*(?:(?:${pointed('נא').source}\\s+)?${pointed('לשמור על קדושת').source}\\s+\\S+\\s*!?)?\\s*$`);
// A bare greeting closing the last sentence ("…! חג שבועות שמח ושבת שלום").
const TRAILING_GREETING = new RegExp(`(?<=[.!?…"״])\\s*${GREETING_START}(?:\\s+${pointed('ו').source}\\S+(?:\\s+\\S+)?)?\\s*!?\\s*(?:(?:${pointed('נא').source}\\s+)?${pointed('לשמור על קדושת').source}\\s+\\S+\\s*!?)?\\s*$`);
const ONLY_FOOTER = new RegExp(`^\\s*(?:(?:${pointed('נא').source}\\s+)?${pointed('לשמור על קדושת').source}\\s+[^\\s!]+\\s*!?)\\s*(?:${pointed('ב').source}?${pointed('בס').source}["״]${pointed('ד').source})?\\s*$`);

function parseHeader(lines) {
  const text = lines.map(l => stripPoints(l.text)).join('\n');
  const parasha = text.match(/פרש(?:ת|יות)\s+השבוע\s*:\s*([^\n]*?)(?=\s{2,}|\s+לעילוי|\s+כניסת|\s+לרפואת|\s+להצלחת|\n|$)/)?.[1]?.trim() || null;
  const year = text.match(/(?<![א-ת])תש[א-ת]?["״'׳]{1,2}[א-ת](?![א-ת])/)?.[0]?.replace(/["״'׳]{1,2}/, '״') || null;
  const civil = text.match(/\((\d{1,2}\.\d{1,2}\.\d{2,4})\)/)?.[1] || null;
  const dateLine = lines.map(l => stripPoints(l.text)).find(t => /\(\d{1,2}\.\d{1,2}\.\d{2,4}\)/.test(t)) || null;
  const motto = lines.find(l => l.y < 40 && !isBsd(l) && !isPageNumber(l))?.text || null;
  return { parashaLabel: parasha, hebrewYearRaw: year, civilDate: civil, dateLine, motto, headerText: text };
}

// Lines of one PDF → issues → raw articles.
export function segmentDocument(doc) {
  const flat = [];
  for (const page of doc.pages) {
    let masthead = page.lines.findIndex(isMasthead);
    // An issue whose masthead is missing (or drawn as a picture): its header block still names the week, the haftara
    // and the subscription line — the header ends with the last of those near the top of the page.
    if (masthead < 0) {
      let last = -1;
      page.lines.forEach((l, i) => { if (l.y < 170 && /פרש(?:ת|יות) השבוע\s*:|הפטרה\s*:|לקבלת העלון|כניסת (?:השבת|החג)\s*:|יציאת (?:השבת|החג)\s*:/.test(stripPoints(l.text))) last = i; });
      if (last >= 0 && page.lines.slice(0, last + 1).some(l => /פרש(?:ת|יות) השבוע\s*:/.test(stripPoints(l.text)))) masthead = last;
    }
    page.lines.forEach((l, i) => flat.push({ ...l, page: page.n, header: masthead >= 0 && i < masthead, masthead: i === masthead, method: page.method, pageOk: page.quality.ok, pageW: page.w, pageH: page.h }));
  }
  // Issues.
  const issues = [];
  let cur = null;
  for (const l of flat) {
    if (l.header || l.masthead) {
      if (!cur || cur.bodyStarted) { cur = { headerLines: [], body: [], pageStart: l.page, pageEnd: l.page, bodyStarted: false }; issues.push(cur); }
      if (l.header) cur.headerLines.push(l);
      continue;
    }
    if (!cur) { cur = { headerLines: [], body: [], pageStart: l.page, pageEnd: l.page, bodyStarted: false, noHeader: true }; issues.push(cur); }
    cur.bodyStarted = true;
    cur.pageEnd = l.page;
    if (isPageNumber(l) || isBsd(l)) continue;
    cur.body.push(l);
  }
  const out = [];
  issues.forEach((issue, issueIndex) => {
    const header = parseHeader(issue.headerLines);
    const body = issue.body;
    // Body margins (RTL text is right-aligned; the left edge is where a full line ends).
    const fullLeft = median(body.filter(l => l.x1 - l.x0 > 300).map(l => l.x0)) ?? 28;
    // Headings: the line(s) right above a rule; a fully bold short line standing alone.
    const role = body.map(() => 'body');
    body.forEach((l, i) => {
      if (isRule(l)) {
        role[i] = 'rule';
        let k = i - 1;
        let taken = 0;
        while (k >= 0 && role[k] === 'body' && taken < 3) {
          const above = body[k - 1];
          role[k] = 'title';
          taken += 1;
          // Take one more line upward only when this title line continues one above it (that line has no ending) on the same page.
          if (!above || role[k - 1] !== 'body' || above.page !== body[k].page || TERMINAL.test(above.text) || body[k].y - above.y > 2.2 * body[k].size) break;
          k -= 1;
        }
      }
    });
    body.forEach((l, i) => {
      if (role[i] !== 'body') return;
      const prev = body[i - 1];
      const next = body[i + 1];
      const standalone = l.bold >= 0.9 && stripPoints(l.text).length < 110 && l.x0 > fullLeft + 30 && (!prev || role[i - 1] !== 'body' || TERMINAL.test(prev.text) || prev.page !== l.page) && next && role[i + 1] === 'body' && next.bold < 0.9;
      if (standalone) role[i] = 'title';
    });
    // Articles.
    let art = null;
    const arts = [];
    body.forEach((l, i) => {
      if (role[i] === 'rule') return;
      if (role[i] === 'title') {
        if (!art || art.lines.length) { art = { titleLines: [], lines: [] }; arts.push(art); }
        art.titleLines.push(l);
        return;
      }
      if (!art) { art = { titleLines: [], lines: [] }; arts.push(art); }
      art.lines.push(l);
    });
    // A heading broken in two — a short untitled fragment right before a heading (e.g. a quotation whose source line sits
    // above the rule) — is one heading.
    for (let n = arts.length - 2; n >= 0; n -= 1) {
      const a = arts[n], b = arts[n + 1];
      if (!a.titleLines.length && a.lines.length && a.lines.length <= 2 && b.titleLines.length && a.lines.at(-1).page === b.titleLines[0].page) {
        b.titleLines = [...a.lines, ...b.titleLines];
        arts.splice(n, 1);
      }
    }
    for (const a of arts) {
      if (!a.lines.length && !a.titleLines.length) continue;
      const all = [...a.titleLines, ...a.lines];
      const { paragraphs, removed } = paragraphsOf(a.lines, fullLeft);
      out.push({
        issueIndex, issue: { ...header, pageStart: issue.pageStart, pageEnd: issue.pageEnd, noHeader: Boolean(issue.noHeader) },
        title: a.titleLines.map(l => l.text).join(' ').replace(/\s+/g, ' ').trim(),
        titleSource: a.titleLines.length ? 'heading' : 'none',
        paragraphs, removed,
        pageStart: Math.min(...all.map(l => l.page)), pageEnd: Math.max(...all.map(l => l.page)),
        method: all.some(l => l.method === 'ocr-heb') ? 'ocr-heb' : 'text-layer',
        pagesOk: all.every(l => l.pageOk),
        bodySize: median(a.lines.map(l => l.size)), boldShare: a.lines.length ? a.lines.filter(l => l.bold > 0.8).length / a.lines.length : 0,
        lineCount: a.lines.length,
        // Where the article stands on its pages (PDF points from the top), for the side-by-side review.
        regions: [...new Set(all.map(l => l.page))].map(pg => { const ls = all.filter(l => l.page === pg); return { page: pg, y0: Math.min(...ls.map(l => l.y - l.size)), y1: Math.max(...ls.map(l => l.y + 0.3 * l.size)), h: ls[0].pageH }; }),
      });
    }
  });
  return out;
}

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Lines → paragraphs. A paragraph ends on a short line that ends a sentence, or before a line opening with a bold lead
// word (the leaflets' paragraph style). Lines are joined with one space; a line ending in a maqaf/hyphen joins tight.
function paragraphsOf(lines, fullLeft) {
  const removed = [];
  const kept = [];
  for (const l of lines) {
    const t = stripPoints(l.text).trim();
    if (/^\d{1,3}$/.test(t)) { removed.push({ kind: 'page-number', text: l.text, page: l.page }); continue; }
    if (ONLY_FOOTER.test(l.text)) { removed.push({ kind: 'footer', text: l.text, page: l.page }); continue; }
    // The issue's closing greeting: a line of its own, or the tail of the article's last line.
    const m = l.text.match(TRAILING_FOOTER) || l.text.match(TRAILING_GREETING);
    if (m && m.index === 0) { removed.push({ kind: 'footer', text: l.text, page: l.page }); continue; }
    if (m) { removed.push({ kind: 'footer', text: m[0].trim(), page: l.page }); kept.push({ ...l, text: l.text.slice(0, m.index).trim() }); continue; }
    kept.push(l);
  }
  const paras = [];
  let cur = '';
  kept.forEach((l, i) => {
    const next = kept[i + 1];
    let t = l.text;
    if (!cur) cur = t;
    else cur = /[-־]$/.test(cur) && /^[א-ת]/.test(t) ? cur + t : `${cur} ${t}`;
    const shortLine = l.x0 > fullLeft + 25;
    const endPara = !next || (shortLine && TERMINAL.test(t)) || (next && next.leadBold && next.leadBold.length >= 2 && TERMINAL.test(t)) || (next && Math.abs(next.size - l.size) > 0.8 && TERMINAL.test(t));
    if (endPara) { paras.push(cur); cur = ''; }
  });
  if (cur) paras.push(cur);
  // The issue's closing greeting, when typeset on the last line of the last article.
  if (paras.length) {
    const last = paras.at(-1);
    const m = last.match(TRAILING_FOOTER) || last.match(TRAILING_GREETING);
    if (m && m.index > 0) { removed.push({ kind: 'footer', text: m[0].trim() }); paras[paras.length - 1] = last.slice(0, m.index).trim(); }
    else if (m && m.index === 0) { removed.push({ kind: 'footer', text: last }); paras.pop(); }
  }
  return { paragraphs: stripContacts(paras.map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean), removed), removed };
}

// Owner's rule: no private contact details in the app. A sentence holding a phone number or an e-mail address, or a
// verification/contact line ("טלפון לבירורים לאמיתות הסיפור: …"), is removed whole; the rest of the piece stays as printed.
export const PHONE = /(?<!\d)0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}(?!\d)|(?<!\d)05\d[-\s]?\d{7}(?!\d)|(?<!\d)\d{2,3}-\d{7}(?!\d)/;
export const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const CONTACT = /(?:לבירורים|לאימות|לאמיתות הסיפור|ליצירת קשר|לפרטים נוספים|לפרטים|לתרומות|טל['׳]|טלפון|פקס|נייד)\s*[:\-–]?\s*[\d(+]/;
function stripContacts(paras, removed) {
  const out = [];
  for (const p of paras) {
    const plain = stripPoints(p);
    if (!PHONE.test(plain) && !EMAIL.test(plain) && !CONTACT.test(plain)) { out.push(p); continue; }
    const sentences = p.split(/(?<=[.!?…])\s+/);
    const kept = sentences.filter(x => { const t = stripPoints(x); const bad = PHONE.test(t) || EMAIL.test(t) || CONTACT.test(t); if (bad) removed.push({ kind: 'contact', text: x }); return !bad; });
    const joined = kept.join(' ').trim();
    if (joined) out.push(joined);
  }
  return out;
}

export function segmentAll({ pilotOnly = false } = {}) {
  const P = paths();
  const ingest = readJson(P.stage('ingest'));
  const articles = [];
  const files = [];
  for (const item of ingest.items) {
    if (pilotOnly && !item.pilot) continue;
    const file = join(P.work, 'pages', `${item.id}.json`);
    if (!exists(file)) continue;
    const doc = readJson(file);
    const arts = segmentDocument(doc);
    arts.forEach((a, n) => articles.push({ key: `${item.id}#${n + 1}`, pdfId: item.id, originalPdf: item.path, folder: item.folder, manifest: { category: item.category, parasha: item.parasha, holiday: item.holiday, hebrewYear: item.hebrewYear, editionNote: item.editionNote }, ...a }));
    files.push({ id: item.id, path: item.path, issues: new Set(arts.map(a => a.issueIndex)).size, articles: arts.length });
  }
  writeJson(P.stage('segment'), { generatedAt: new Date().toISOString(), files, articles });
  return { files: files.length, issues: files.reduce((a, f) => a + f.issues, 0), articles: articles.length };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('segment:', JSON.stringify(segmentAll({ pilotOnly: process.argv.includes('--pilot') })));
