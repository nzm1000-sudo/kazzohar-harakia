// Hebrew Wikisource → plain reading text. Markup cleanup only: the words of the transcription are never changed.
// Every template the pages use is handled explicitly (an unknown one stops the build), so nothing is guessed.
// Shared by the Zohar import and later Wikisource imports (Baal HaTurim, Mishnah Berurah…).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const WIKISOURCE_API = 'https://he.wikisource.org/w/api.php';
export const WIKISOURCE_LICENSE = { id: 'cc-by-sa', title: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };
export const pageUrl = title => `https://he.wikisource.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
export const oldidUrl = revid => `https://he.wikisource.org/w/index.php?oldid=${revid}`;

const UA = { 'User-Agent': 'kazzohar-library-import/1.0 (https://github.com/nzm1000-sudo/kazzohar-harakia)' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function apiGet(params, { attempts = 5 } = {}) {
  const url = `${WIKISOURCE_API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: UA });
      if (response.ok) return response.json();
      if (response.status < 500 && response.status !== 429) throw new Error(`${response.status} ${url}`);
    } catch (error) {
      if (attempt === attempts) throw error;
    }
    await sleep(700 * attempt);
  }
  throw new Error(`unreachable: ${url}`);
}

// Page text at a pinned revision (or the latest when no revision is given), cached on disk by revision id.
export async function fetchPages(titles, { cache, revids = {}, offline = false } = {}) {
  mkdirSync(cache, { recursive: true });
  const out = {};
  const pinned = titles.filter(title => revids[title]);
  const latest = titles.filter(title => !revids[title]);
  const fromCache = revid => { const file = join(cache, `rev-${revid}.json`); return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null; };
  const store = page => writeFileSync(join(cache, `rev-${page.revid}.json`), JSON.stringify(page));
  const missing = [];
  for (const title of pinned) {
    const hit = fromCache(revids[title]);
    if (hit) out[title] = hit; else missing.push(revids[title]);
  }
  if (missing.length && offline) throw new Error(`offline: ${missing.length} pinned revisions not cached`);
  for (let i = 0; i < missing.length; i += 50) {
    const data = await apiGet({ action: 'query', prop: 'revisions|info', rvprop: 'ids|timestamp|content', rvslots: 'main', revids: missing.slice(i, i + 50).join('|') });
    for (const page of data.query.pages) for (const rev of page.revisions) {
      const record = { title: page.title, pageid: page.pageid, revid: rev.revid, timestamp: rev.timestamp, content: rev.slots.main.content };
      store(record);
      out[page.title] = record;
    }
  }
  if (latest.length && offline) throw new Error(`offline: ${latest.length} pages have no pinned revision`);
  for (let i = 0; i < latest.length; i += 50) {
    const data = await apiGet({ action: 'query', prop: 'revisions|info', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: latest.slice(i, i + 50).join('|') });
    for (const page of data.query.pages) {
      if (page.missing) throw new Error(`missing page: ${page.title}`);
      const rev = page.revisions[0];
      const record = { title: page.title, pageid: page.pageid, revid: rev.revid, timestamp: rev.timestamp, content: rev.slots.main.content };
      store(record);
      out[page.title] = record;
    }
  }
  for (const title of titles) if (!out[title]) throw new Error(`page not returned: ${title}`);
  return out;
}

export async function listPages(prefix, namespace = 0, filter = 'nonredirects') {
  const titles = [];
  let cont = {};
  do {
    const data = await apiGet({ action: 'query', list: 'allpages', apprefix: prefix, apnamespace: String(namespace), apfilterredir: filter, aplimit: '500', ...cont });
    titles.push(...data.query.allpages.map(page => page.title));
    cont = data.continue || null;
  } while (cont);
  return titles;
}

// ---------- Labeled section transclusion (#קטע), as the extension reads a page ----------
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const stripNoinclude = text => text.replace(/<noinclude>[\s\S]*?<\/noinclude>/g, '').replace(/<\/?(?:includeonly|onlyinclude)>/g, '');
// Every begin marker with this exact name opens a span that runs to the next end marker of the same name (or to the
// end of the page); spans are joined in order. Nested markers of the same name inside a span are ignored.
export function sectionText(pageText, name) {
  const text = stripNoinclude(pageText);
  const begin = new RegExp(`<קטע\\s+התחלה\\s*=\\s*"?${escape(name)}"?\\s*\\/?>`, 'g');
  const end = new RegExp(`<קטע\\s+סוף\\s*=\\s*"?${escape(name)}"?\\s*\\/?>`, 'g');
  const parts = [];
  let found = 0;
  let position = 0;
  for (;;) {
    begin.lastIndex = position;
    const open = begin.exec(text);
    if (!open) break;
    found += 1;
    end.lastIndex = open.index + open[0].length;
    const close = end.exec(text);
    parts.push(text.slice(open.index + open[0].length, close ? close.index : text.length));
    if (!close) break;
    position = close.index + close[0].length;
  }
  return found ? parts.join('\n') : null;
}

// ---------- Templates ----------
const BOOK_REF = (book, chapter, verse) => `(${[book, [chapter, verse].filter(Boolean).join(', ')].filter(Boolean).join(' ')})`;
const arg = (args, i) => (args[i] ?? '').trim();
// Output of each template, as it reads on the page (colours, sizes and links dropped). null = removed from the text.
const TEMPLATES = {
  'צ': args => arg(args, 1),                                     // quotation highlight
  'ממ': args => BOOK_REF(arg(args, 1), arg(args, 2), arg(args, 3)), // verse reference
  'מקור': args => `(${arg(args, 1)})`,
  'שם': args => `(שם ${[arg(args, 2), arg(args, 3)].filter(Boolean).join(', ')})`,
  'הפניה לפסוקים': args => `(${arg(args, 1)} ${arg(args, 2)}, ${[arg(args, 3), arg(args, 4)].filter(Boolean).join('-')})`,
  'מהפניה לפסוקים': args => `(${arg(args, 1)} ${arg(args, 2)}, ${[arg(args, 3), arg(args, 4)].filter(Boolean).join('-')})`,
  'ישעיהו': args => BOOK_REF('ישעיהו', arg(args, 1), arg(args, 2)),
  'ויקרא': args => BOOK_REF('ויקרא', arg(args, 1), arg(args, 2)),
  'מצ': args => `${BOOK_REF(arg(args, 1), arg(args, 2), arg(args, 3))}: ${arg(args, 4)}`,
  'ממ משנה': args => `(משנה, ${arg(args, 1)} ${[arg(args, 2), arg(args, 3)].filter(Boolean).join(', ')})`,
  'ממ רמב"ם': args => `(רמב״ם ${args.slice(1).map(a => a.trim()).filter(Boolean).join(' ')})`,
  'ממ זהר': args => `(ח"${arg(args, 1)} ${arg(args, 2)}, ${arg(args, 3)})`,
  'ממ זהר משולב': () => '',                                       // printed-page marker; the page is the node itself
  'תיקון גירסה': args => `(${arg(args, 1)}) [${arg(args, 2)}]`,     // editor's emendation: printed reading kept, correction in brackets
  'תיקון': args => `(${arg(args, 1)}) [${arg(args, 2)}]`,
  'קו"כ': args => `(${arg(args, 1)}) [${arg(args, 2)}]`,           // ketiv (…) qere […], as in the Tanakh packs
  'כו"ק': args => `(${arg(args, 1)}) [${arg(args, 2)}]`,
  'גמט': args => arg(args, 1),
  'גמט דגש': args => arg(args, 1),
  'קיצור': args => arg(args, 1),
  'ב': args => arg(args, 1),
  'מכפלת גימטריה': args => args.slice(1).map(a => a.trim()).filter(Boolean).join(' '),
  'קטן': args => arg(args, 1),
  'גדול': args => arg(args, 1),
  'רגיל': args => arg(args, 1),
  'קו תחתי': args => arg(args, 1),
  'מר': args => `\n\n${arg(args, 1)}\n\n`,                        // centred line
  'הערה בצד': args => arg(args, 1),
  "'": () => '’',
  'ש': () => '\n\n',                                               // line break → its own paragraph
  'ססס': () => ' ',
  'ררר': () => ' ',
  'רווח קשיח': () => ' ',
  'נק': () => '\n\n',
  'עוגן': () => '',
  'הערה': null,                                                    // editors' footnotes: not part of the text
  'הערות שוליים2': null,
  'להשלים': null,                                                  // "incomplete" banner (counted, see stats.incomplete)
  'פתח ר\' שמעון': () => '',
  'סרגל ניווט': null,
  'תוכן עניינים שטוח': null,
  'דף של זהר': null,
  'מסורת חכמים': null,
  'צמ': args => arg(args, 1),
  'דה מפרש': args => arg(args, 1),                                  // a commentary's opening words (דיבור המתחיל)
  'תב': args => arg(args, 1),
  'כ': () => '',
  'א': args => arg(args, 1),
  'מרכז': args => arg(args, 1),
  'ג': args => arg(args, 1),
  '*': () => ' · ',
};

export function expandTemplates(text, stats = {}, extra = {}) {
  const table = { ...TEMPLATES, ...extra };
  let current = text;
  for (let guard = 0; guard < 50; guard += 1) {
    const next = current.replace(/\{\{([^{}]*)\}\}/g, (match, body) => {
      const args = body.split('|');
      const name = args[0].trim().replace(/_/g, ' ');
      if (!(name in table)) { (stats.unknownTemplates ||= {})[name] = ((stats.unknownTemplates ||= {})[name] || 0) + 1; return ''; }
      (stats.templates ||= {})[name] = (stats.templates[name] || 0) + 1;
      const handler = table[name];
      if (handler === null) { if (name === 'להשלים') stats.incomplete = (stats.incomplete || 0) + 1; if (name === 'הערה') stats.footnotes = (stats.footnotes || 0) + 1; return ''; }
      return handler(args);
    });
    if (next === current) break;
    current = next;
  }
  return current;
}

const ENTITIES = { nbsp: ' ', amp: '&', lt: '‹', gt: '›', quot: '"', apos: "'", thinsp: ' ', ndash: '–', mdash: '—', lrm: '', rlm: '' };

// Raw wikitext → paragraphs of plain text. Headings are dropped (they are the site's section titles, not the text) and
// returned separately; images are dropped and counted.
export function wikitextToParagraphs(raw, stats = {}, extraTemplates = {}) {
  let text = stripNoinclude(raw)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, () => { stats.footnotes = (stats.footnotes || 0) + 1; return ''; })
    .replace(/<references\s*\/?>/g, '')
    .replace(/<קטע\s+(?:התחלה|סוף)\s*=[^>]*>/g, '')
    .replace(/__[A-Zא-ת_]+__/g, '');
  // Links: [[target|label]] → label; files and categories out.
  text = text.replace(/\[\[((?:[^[\]]|\[[^[\]]*\])*)\]\]/g, (match, body) => {
    const [target, ...rest] = body.split('|');
    if (/^(?:קובץ|File|תמונה|Image):/i.test(target.trim())) { stats.images = (stats.images || 0) + 1; return ''; }
    if (/^(?:קטגוריה|Category):/i.test(target.trim())) return '';
    const label = rest.length ? rest.join('|') : target.replace(/^:/, '').replace(/^[^:]+:/, match => (/^(?:W|ויקיפדיה|w):/i.test(match) ? '' : match));
    return label;
  });
  // Tables on these pages are the site's own aids (e.g. a numbered gematria table), not the text: removed and counted.
  text = text.replace(/^\{\|[\s\S]*?^\|\}\s*$/gm, () => { stats.tables = (stats.tables || 0) + 1; return '\n\n'; });
  text = expandTemplates(text, stats, extraTemplates);
  // A quotation highlight opened and never closed on the page: the opener is markup, the words stay.
  text = text.replace(/\{\{\s*צ\s*\|/g, () => { stats.unclosedQuotes = (stats.unclosedQuotes || 0) + 1; return ''; });
  const headings = [];
  text = text.replace(/^(=+)\s*(.*?)\s*\1\s*$/gm, (match, level, title) => { headings.push(title); return '\n\n'; });
  text = text
    .replace(/<br\s*\/?>/gi, '\n\n')
    .replace(/<center>|<\/center>/gi, '\n\n')
    .replace(/<\/?(?:small|big|span|s|sup|sub|b|i|u|font|div|p)(?:\s[^>]*)?>/gi, '')
    .replace(/'''|''/g, '')
    .replace(/^-{4,}\s*$/gm, '\n\n')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => (code[0] === '#' ? String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))) : ENTITIES[code.toLowerCase()] ?? match));
  const paragraphs = [];
  for (const block of text.split(/\n\s*\n/)) {
    // Indented and list lines are separate lines on the page.
    const lines = block.split('\n');
    let current = [];
    const flush = () => { const joined = current.join(' ').replace(/\s+/g, ' ').trim(); if (joined) paragraphs.push(joined); current = []; };
    for (const line of lines) {
      if (/^[:*#;]/.test(line)) { flush(); current.push(line.replace(/^[:*#;]+\s*/, '')); flush(); } else current.push(line);
    }
    flush();
  }
  // A line without a letter (a closing bracket, a bullet) belongs to the paragraph before it; it is never dropped.
  const cleaned = [];
  let pending = '';
  for (let i = 0; i < paragraphs.length; i += 1) paragraphs[i] = paragraphs[i].replace(/^[:*#;]+\s*/, '');
  for (let paragraph of paragraphs) {
    if (/[<>]/.test(paragraph)) { stats.brackets = (stats.brackets || 0) + 1; paragraph = paragraph.replace(/</g, '‹').replace(/>/g, '›'); }
    if (!/[א-ת]/.test(paragraph)) {
      if (/^[\s•·.,:;]*$/.test(paragraph)) continue;
      if (cleaned.length) cleaned[cleaned.length - 1] += ` ${paragraph}`; else pending += `${paragraph} `;
      continue;
    }
    cleaned.push(pending + paragraph);
    pending = '';
  }
  return { paragraphs: cleaned, headings };
}

// Sefaria copies of Wikisource transcriptions sometimes keep the site's markup inside the text (a link, a template's
// unfilled parameter, a list star, a template's closing braces). Markup only is removed; each removal is counted.
export function stripWikiResidue(value, stats = {}) {
  let text = String(value);
  const before = text;
  text = text
    .replace(/\{\{\{\d+\}\}\}/g, '')
    .replace(/\[\[((?:[^[\]]|\[[^[\]]*\])*)\]\]/g, (match, body) => { const [target, ...rest] = body.split('|'); return (rest.length ? rest.join('|') : target.replace(/,.*$/, '')).trim(); })
    .replace(/\}\}/g, '')
    .replace(/^\*\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
    .trim();
  if (text !== before.trim()) stats.wikiResidue = (stats.wikiResidue || 0) + 1;
  return text;
}
