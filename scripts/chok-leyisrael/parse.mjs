// חק לישראל (Torat Emet edition, as exported to Otzaria) → structured days. Pure: text in, data out.
//
// The export is one text file per chumash with a light markup of its own:
//   <h2>פרשת X</h2>                         a parasha
//   <h2>X יום ראשון תורה</h2> … <h2>X ליל שישי תורה</h2> <h2>X יום שישי תורה</h2>   its seven days
//   <h3>נביאים - ישעיה - פרק מב</h3> …       the parts of a day (the Torah part has no heading of its own)
//   (א) <150> verse <90> targum <span style="color:MIXn…"><br/>commentary</span>   a verse line (several verses may share one)
//   <big><b>ב</b></big>                       a new chapter;  <b><small>&nbspשני&nbsp</small>&nbsp</b>  an aliya mark
//   <110> / <100>                             the main text of a Mishnah / Gemara / Zohar / halacha paragraph (a font size)
//   <small><small>…</small></small>           the edition's small line: an instruction, or the source of a halacha/mussar text
// Only markup is changed here: tags become structure; the words are the edition's own. The one exception is mechanical and
// logged (joinedTargumWords): a Targum word glued to the next one by a lost line break is split again, only when certain.

export const DAYS = Object.freeze([
  { key: 'sun', he: 'יום ראשון', weekday: 0 },
  { key: 'mon', he: 'יום שני', weekday: 1 },
  { key: 'tue', he: 'יום שלישי', weekday: 2 },
  { key: 'wed', he: 'יום רביעי', weekday: 3 },
  { key: 'thu', he: 'יום חמישי', weekday: 4 },
  { key: 'fri-night', he: 'ליל שישי', weekday: 5 },
  { key: 'fri', he: 'יום שישי', weekday: 5 },
]);

// The parts of a day, in the edition's order (Friday: the rest of the parasha, its haftarah, then Mishnah… as every day).
export const PARTS = Object.freeze([
  { key: 'torah', he: 'תורה' },
  { key: 'neviim', he: 'נביאים' },
  { key: 'ketuvim', he: 'כתובים' },
  { key: 'haftarah', he: 'הפטרה' },
  { key: 'mishnah', he: 'משנה' },
  { key: 'gemara', he: 'גמרא' },
  { key: 'zohar', he: 'זוהר' },
  { key: 'halacha', he: 'הלכה' },
  { key: 'mussar', he: 'מוסר' },
]);

const PART_BY_HEADING = [
  [/^נביאים/, 'neviim'], [/^כתובים/, 'ketuvim'], [/^הפטרת/, 'haftarah'], [/^משנה/, 'mishnah'], [/^גמרא/, 'gemara'],
  [/^זוהר/, 'zohar'], [/^הלכה/, 'halacha'], [/^מוסר/, 'mussar'],
];
const DAY_RE = /^(.*?)\s*(יום ראשון|יום שני|יום שלישי|יום רביעי|יום חמישי|ליל שישי|יום שישי)(?:\s+תורה)?$/;

const MARKS = /[֑-ׇ]/g;
export const lettersOf = text => String(text).replace(MARKS, '').replace(/[^א-ת]/g, '');

// Inline text: keep only <b>, <small> (the edition's emphasis and small verse numbers) and line breaks ("\n").
export function inline(text) {
  return String(text)
    .replace(/&nbsp;?/g, ' ')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\d{2,3}>/g, '')
    .replace(/<(?!\/?(?:b|small)>)[^>]*>/g, '')
    .replace(/<b>\s*<\/b>|<small>\s*<\/small>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
const onlySmall = text => /^(?:<small>\s*)+([\s\S]*?)(?:\s*<\/small>)+$/.exec(text.trim());

// ---------- Joined Targum words ----------
// A line break lost in the export glued the last word of a Targum line to the first of the next ("שְׁמַיָּאוְיָת").
// Two certain cases are split back, each logged:
//   • reference: the glued letters are exactly two consecutive words of the same verse of Onkelos in the reference
//     edition (the app's Shnayim Mikra pack: Onkelos, Torat Emet via Sefaria) — Torah only;
//   • final letter: a final form (ך ם ן ף ץ) followed by another letter inside one word — never so in the language.
// Nothing else is touched; a word that only looks joined stays as printed.
const FINAL = /[ךםןףץ]/;
function splitAfterLetters(token, count) {
  let seen = 0;
  for (let i = 0; i < token.length; i += 1) {
    if (/[א-ת]/.test(token[i])) {
      seen += 1;
      if (seen === count) {
        let j = i + 1;
        while (j < token.length && /[֑-ׇ]/.test(token[j]) && token[j] !== '־' && token[j] !== '׀' && token[j] !== '׃' && token[j] !== '׆') j += 1;
        return [token.slice(0, j), token.slice(j)];
      }
    }
  }
  return [token, ''];
}
export function fixTargumJoins(targum, referenceWords = null) {
  const changes = [];
  const pairs = new Set();
  const singles = new Set(referenceWords || []);
  if (referenceWords) for (let i = 0; i + 1 < referenceWords.length; i += 1) pairs.add(`${referenceWords[i]}|${referenceWords[i + 1]}`);
  const out = [];
  const queue = String(targum).split(/(\s+)/);
  for (let index = 0; index < queue.length; index += 1) {
    let token = queue[index];
    if (!token || /^\s+$/.test(token)) { out.push(token); continue; }
    let guard = 0;
    while (guard++ < 4) {
      const core = lettersOf(token);
      if (core.length < 3 || singles.has(core)) break;
      let cut = 0;
      let rule = null;
      if (referenceWords) {
        const hits = [];
        for (let k = 1; k < core.length; k += 1) if (pairs.has(`${core.slice(0, k)}|${core.slice(k)}`)) hits.push(k);
        if (hits.length === 1) { cut = hits[0]; rule = 'reference'; }
      }
      if (!cut) {
        const at = core.slice(0, -1).search(FINAL);
        if (at >= 0) { cut = at + 1; rule = 'final-letter'; }
      }
      if (!cut) break;
      const [first, rest] = splitAfterLetters(token, cut);
      if (!rest || !lettersOf(rest)) break;
      changes.push({ rule, before: token, after: `${first} ${rest}` });
      out.push(first, ' ');
      token = rest;
    }
    out.push(token);
  }
  return { text: out.join(''), changes };
}

// ---------- Verse lines (Torah, Nevi'im, Ketuvim) ----------
const VERSE_START = /(?:<big><b>([^<]{1,4})<\/b><\/big>\s*)?\(([א-ת'"]{1,4})\)\s*<150>/g;
const SPAN = /<span[^>]*>([\s\S]*?)<\/span>/g;
const ALIYA = /^\s*<b>\s*<small>\s*(?:&nbsp;?|\s)*([^<]*?)(?:&nbsp;?|\s)*<\/small>(?:&nbsp;?|\s)*<\/b>\s*/;

export function parseVerseLine(line) {
  const tokens = [];
  for (const m of line.matchAll(VERSE_START)) tokens.push({ at: m.index, end: m.index + m[0].length, kind: 'verse', chapter: m[1] || null, n: m[2] });
  for (const m of line.matchAll(SPAN)) tokens.push({ at: m.index, end: m.index + m[0].length, kind: 'span', text: m[1] });
  tokens.sort((a, b) => a.at - b.at);
  const verses = [];
  const lead = line.slice(0, tokens[0]?.at ?? line.length);
  let current = null;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const nextAt = i + 1 < tokens.length ? tokens[i + 1].at : line.length;
    if (token.kind === 'verse') {
      let body = line.slice(token.end, nextAt);
      let aliya = null;
      const mark = ALIYA.exec(body);
      if (mark) { aliya = mark[1].trim(); body = body.slice(mark[0].length); }
      const at90 = body.indexOf('<90>');
      const he = inline(at90 < 0 ? body : body.slice(0, at90));
      const tg = at90 < 0 ? '' : inline(body.slice(at90 + 4));
      current = { t: 'v', ...(token.chapter ? { c: token.chapter.trim() } : {}), n: token.n, ...(aliya ? { a: aliya } : {}), h: he, ...(tg ? { g: tg } : {}) };
      verses.push(current);
    } else {
      const text = inline(token.text);
      if (text && current) current.r = current.r ? `${current.r}\n${text}` : text;
      else if (text) verses.push({ t: 'c', x: text });
      const tail = inline(line.slice(token.end, nextAt));
      if (tail) verses.push({ t: 'p', x: tail });
    }
  }
  return { lead: inline(lead), verses };
}

// ---------- Other parts ----------
// Paragraphs are separated by line breaks — never inside an open <small> or <b> (a haftarah's note runs across one).
const depth = text => (text.match(/<(?:small|b)>/g) || []).length - (text.match(/<\/(?:small|b)>/g) || []).length;
export function splitParagraphs(line) {
  const out = [];
  let open = '';
  for (const piece of line.split(/<br\s*\/?>/)) {
    open = open ? `${open}<br/>${piece}` : piece;
    if (depth(open) <= 0) { out.push(open); open = ''; }
  }
  if (open) out.push(open);
  return out;
}
function partBlocks(kind, line) {
  const blocks = [];
  for (const raw of splitParagraphs(line)) {
    let segment = raw.trim();
    if (!segment) continue;
    const main = /^(?:<1[01]0>\s*)+/.exec(segment);
    if (main) segment = segment.slice(main[0].length).trim();
    if (!segment) continue;
    const small = onlySmall(segment);
    if (small && !/<\/?small>/.test(small[1])) { blocks.push({ t: 'note', x: inline(small[1]) }); continue; }
    // "<100> <small><small>מקור</small></small> text" — the source line of a halacha / mussar text, then its text.
    const lead = /^((?:<small>\s*)+)([^<]*)((?:\s*<\/small>)+)\s*/.exec(segment);
    if (lead && lead[1].split('<small>').length === lead[3].split('</small>').length && lead[1].split('<small>').length > 2) {
      blocks.push({ t: 'note', x: inline(lead[2]) });
      segment = segment.slice(lead[0].length);
      if (!segment.trim()) continue;
    }
    const text = inline(segment);
    if (!text) continue;
    if (main) blocks.push({ t: 'p', x: text });
    else if (kind === 'mishnah' || kind === 'gemara') blocks.push({ t: 'c', x: text });
    else if (kind === 'zohar') blocks.push({ t: 'tr', x: text });
    else blocks.push({ t: 'p', x: text });
  }
  return blocks;
}

// ---------- The whole file ----------
export function parseVolume(source, { volume } = {}) {
  // A commentary <span> that runs over a line break is one line again (its text belongs to the verse before it).
  const lines = [];
  for (const line of String(source).replace(/\r\n?/g, '\n').split('\n')) {
    const last = lines.length - 1;
    const unclosed = last >= 0 && (lines[last].match(/<span\b/g) || []).length > (lines[last].match(/<\/span>/g) || []).length;
    if (unclosed && !/^<h[123]>/.test(line)) lines[last] = `${lines[last]}<br/>${line}`;
    else lines.push(line);
  }
  const intro = [];
  const parashot = [];
  let mode = null;
  let section = null;
  let parasha = null;
  let day = null;
  let part = null;
  const issues = [];
  const startPart = (key, heading = null) => {
    if (key === 'haftarah' && part?.key === 'haftarah') { part.sections.push({ heading, blocks: [] }); return; }
    part = { key, sections: [{ heading, blocks: [] }] };
    day.parts.push(part);
  };
  const blocksOf = () => part.sections[part.sections.length - 1].blocks;
  lines.forEach((line, index) => {
    const at = `${volume || ''}:${index + 1}`;
    const h1 = /^<h1>/.test(line);
    if (h1 || !line.trim()) return;
    const h2 = /^<h2>(.*)<\/h2>\s*$/.exec(line);
    const h3 = /^<h3>(.*)<\/h3>\s*$/.exec(line);
    if (h2) {
      const title = h2[1].trim();
      if (title === 'הקדמות') { mode = 'intro'; return; }
      const parashaTitle = /^פרשת\s+(.+)$/.exec(title);
      if (parashaTitle) { mode = 'parasha'; parasha = { he: parashaTitle[1].trim(), days: [] }; parashot.push(parasha); day = null; part = null; return; }
      if (mode === 'intro') { section = { title, blocks: [] }; intro.push(section); return; }
      const d = DAY_RE.exec(title);
      if (mode === 'parasha' && d) {
        const def = DAYS.find(item => item.he === d[2]);
        day = { key: def.key, parts: [] };
        parasha.days.push(day);
        startPart('torah');
        return;
      }
      issues.push({ at, kind: 'unknown-h2', text: title });
      return;
    }
    if (h3) {
      const title = h3[1].trim();
      if (mode === 'intro') { section.blocks.push({ t: 'h', x: title }); return; }
      const kind = PART_BY_HEADING.find(([re]) => re.test(title))?.[1];
      if (!kind || !day) { issues.push({ at, kind: 'unknown-h3', text: title }); return; }
      startPart(kind, title);
      return;
    }
    if (mode === 'intro') {
      const small = onlySmall(line);
      const text = inline(line);
      if (text) section.blocks.push(small && !/<\/?small>/.test(small[1]) ? { t: 'note', x: inline(small[1]) } : { t: 'p', x: text });
      return;
    }
    if (!day) { issues.push({ at, kind: 'text-outside-day', text: line.slice(0, 80) }); return; }
    const verseKind = part.key === 'torah' || part.key === 'neviim' || part.key === 'ketuvim';
    if (verseKind && /<150>/.test(line)) {
      const { lead, verses } = parseVerseLine(line);
      if (lead) blocksOf().push(onlySmall(lead) ? { t: 'note', x: inline(onlySmall(lead)[1]) } : { t: 'p', x: lead });
      blocksOf().push(...verses);
      return;
    }
    // A commentary on a line of its own belongs to the verse before it.
    const lastVerse = blocksOf()[blocksOf().length - 1];
    if (verseKind && /<span\b/.test(line) && lastVerse?.t === 'v') {
      const { lead, verses } = parseVerseLine(line);
      const notes = verses.filter(block => block.t === 'c').map(block => block.x);
      if (notes.length) lastVerse.r = [lastVerse.r, ...notes].filter(Boolean).join('\n');
      const rest = [lead, ...verses.filter(block => block.t !== 'c').map(block => block.x)].filter(Boolean);
      for (const text of rest) blocksOf().push({ t: 'p', x: text });
      return;
    }
    if (verseKind) {
      const small = onlySmall(line);
      const big = /^<big>([\s\S]*)<\/big>\s*$/.exec(line.trim());
      const text = inline(small ? small[1] : big ? big[1] : line);
      if (text) blocksOf().push({ t: small || big ? 'note' : 'p', x: text });
      return;
    }
    blocksOf().push(...partBlocks(part.key, line));
  });
  // Empty headings of the introductions (the kavanot page the edition does not carry) are dropped, and recorded.
  for (const item of intro) {
    item.blocks = item.blocks.filter((block, i, all) => {
      if (block.t !== 'h') return true;
      const next = all[i + 1];
      if (next && next.t !== 'h') return true;
      issues.push({ at: `${volume || ''}:intro`, kind: 'empty-heading', text: block.x });
      return false;
    });
  }
  return { intro, parashot, issues };
}
