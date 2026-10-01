// Stage 2 — extraction. Every PDF page → logical-order Hebrew lines with their typography (size, bold, colour, extent).
//   A) the text layer: glyph codes decoded through the Q-font table (lib.mjs), points attached to their letters by
//      geometry, visual order turned into logical order, then CHECKED (Hebrew ratio, unknown glyphs, misplaced final
//      letters = reversed/scrambled text, orphan points). Never assumed readable.
//   B) a page whose text layer fails the check (or has none) is rendered and read by Tesseract with the Hebrew model
//      only ("heb", never English), normalised and checked the same way; if it still fails it is marked needsHebrewOcr
//      and nothing from it is published.
// Usage: node scripts/bnei-zion/extract.mjs [--pilot] [--force]
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Q_IGNORED, Q_LETTERS, Q_MARKS, exists, hebrewStats, isQFont, paths, readJson, writeJson } from './lib.mjs';

const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' };
const isLtrChar = ch => /[0-9A-Za-z@]/.test(ch);

export function classify(code, font) {
  if (code === 32 || code === 0xa0 || code === 9) return { kind: 'space' };
  if (font.kind === 'unicode') {
    if (code >= 0x0591 && code <= 0x05c7 && code !== 0x05be && code !== 0x05c0 && code !== 0x05c3 && code !== 0x05c6) return { kind: 'mark', ch: String.fromCodePoint(code) };
    return { kind: code >= 0x05d0 && code <= 0x05ea ? 'letter' : 'char', ch: String.fromCodePoint(code) };
  }
  if (code >= 0xe0 && code <= 0xfa) return { kind: 'letter', ch: String.fromCodePoint(0x05d0 + code - 0xe0) };
  if (isQFont(font.name)) {
    if (Q_MARKS[code]) return { kind: 'mark', ch: Q_MARKS[code] };
    if (Q_LETTERS[code]) return { kind: 'letter', ch: Q_LETTERS[code] };
    if (Q_IGNORED.has(code)) return { kind: 'ignored' };
    if (code === 0xce) return { kind: 'char', ch: '\u05BE' }; // maqaf (Windows-1255)
    if (code === 0x85) return { kind: 'char', ch: '…' };
    if ((code >= 0x21 && code <= 0x40) || (code >= 0x5b && code <= 0x60) || (code >= 0x7b && code <= 0x7e) || [0x2026, 0x201c, 0x201d, 0x2013, 0x2014, 0xa9].includes(code)) return { kind: 'char', ch: String.fromCodePoint(code) };
    return { kind: 'unknown', ch: '�' };
  }
  // Modern (Unicode) Hebrew fonts — the few files saved straight from Word or Acrobat.
  if (code >= 0xfb1d && code <= 0xfb4f) {
    const parts = String.fromCodePoint(code).normalize('NFKD');
    return { kind: 'letter', ch: parts.normalize('NFC') };
  }
  if (code >= 0x05d0 && code <= 0x05ea) return { kind: 'letter', ch: String.fromCodePoint(code) };
  if (code >= 0x0591 && code <= 0x05c7 && ![0x05be, 0x05c0, 0x05c3, 0x05c6].includes(code)) return { kind: 'mark', ch: String.fromCodePoint(code) };
  if ([0x05be, 0x05f3, 0x05f4, 0x05c3].includes(code)) return { kind: 'char', ch: String.fromCodePoint(code) };
  if (code >= 0x20 && code < 0x7f) return { kind: 'char', ch: String.fromCodePoint(code), latin: /[A-Za-z]/.test(String.fromCodePoint(code)) };
  if ([0xa9, 0x2026, 0x201c, 0x201d, 0x2013, 0x2014, 0xb7].includes(code)) return { kind: 'char', ch: String.fromCodePoint(code) };
  if (code === 0xfffd || (code >= 0x80 && code <= 0xff)) return { kind: 'unknown', ch: '�' };
  return { kind: 'char', ch: String.fromCodePoint(code) };
}

const darkness = color => { if (!color) return 0; const v = parseInt(color, 16); return 765 - (((v >> 16) & 255) + ((v >> 8) & 255) + (v & 255)); };

export function decodePage(page, fonts) {
  const stats = { unknown: 0, ignored: 0, orphanMarks: 0, shadows: 0 };
  const glyphs = [];
  // PrimoPDF writes two junk space glyphs after every vowel point; a space that follows a letter or a punctuation mark in
  // the content stream is a real word space; so is a third space after a point (needed where a bold lead word meets the regular text with almost no gap).
  let junk = 0;
  for (const g of page.glyphs) {
    const [code, fi, size, x0, x1, y0, y1, oy, color, flags, ix0, ix1] = g;
    const font = fonts[fi];
    const c = classify(code, font);
    if (c.kind === 'space') {
      if (junk > 0) junk -= 1; else glyphs.push({ kind: 'space', size, x0, x1, oy });
      continue;
    }
    junk = c.kind === 'mark' ? 2 : 0;
    if (c.kind === 'ignored') { stats.ignored += 1; continue; }
    // Invisible text (white on white — the archive hides verses/segulot this way) is not part of the leaflet's text.
    if (color && /^(?:f[a-f0-9]){3}$/i.test(color)) { stats.invisible = (stats.invisible || 0) + 1; continue; }
    if (c.kind === 'unknown') stats.unknown += 1;
    // A vowel point is placed by its ink (the outline's extent), not by its advance box, which can span a whole letter.
    const ink = c.kind === 'mark' && ix0 != null && ix1 > ix0 ? { x0: ix0, x1: ix1 } : { x0, x1 };
    glyphs.push({ ...c, size, ...ink, y0, y1, oy, color, bold: /bold/i.test(font.name) || Boolean(flags & 16), font: font.name });
  }
  // Lines: by baseline.
  glyphs.sort((a, b) => a.oy - b.oy || a.x0 - b.x0);
  const rows = [];
  for (const g of glyphs) {
    const row = rows.at(-1);
    if (row && Math.abs(g.oy - row.oy) <= Math.max(1.2, 0.3 * Math.min(g.size, row.size))) { row.items.push(g); row.size = Math.max(row.size, g.size); }
    else rows.push({ oy: g.oy, size: g.size, items: [g] });
  }
  const lines = [];
  for (const row of rows) {
    const spaces = row.items.filter(g => g.kind === 'space').map(g => (g.x0 + g.x1) / 2);
    const bases = row.items.filter(g => g.kind !== 'mark' && g.kind !== 'space').sort((a, b) => a.x0 - b.x0);
    const marks = row.items.filter(g => g.kind === 'mark');
    // Shadowed or overprinted ("fake bold") words are drawn two or three times, ~1pt apart: keep one copy, the darker.
    // Two real identical letters in a row are a full letter width apart, so they are never merged.
    const kept = [];
    for (const g of bases) {
      const twin = kept.slice(-6).find(k => k.ch === g.ch && Math.abs(k.x0 - g.x0) < Math.min(0.15 * g.size, 0.5 * (g.x1 - g.x0)) && Math.abs(k.oy - g.oy) < 0.3 * g.size);
      if (twin) { stats.shadows += 1; if (darkness(g.color) > darkness(twin.color)) Object.assign(twin, g, { marks: twin.marks }); continue; }
      kept.push({ ...g, marks: [] });
    }
    const letters = kept.filter(g => g.kind === 'letter');
    for (const m of marks) {
      const cx = (m.x0 + m.x1) / 2;
      let best = null, bestScore = -Infinity;
      for (const l of letters) {
        // The letter under the point's centre wins; otherwise the nearest letter edge.
        const inside = cx >= l.x0 && cx <= l.x1;
        const dist = cx < l.x0 ? l.x0 - cx : cx > l.x1 ? cx - l.x1 : 0;
        // A holam is drawn at its letter's top-left corner: the letter whose left edge is nearest to the dot owns it.
        const score = m.ch === '\u05B9' ? -Math.abs(cx - l.x0) : inside ? Math.min(cx - l.x0, l.x1 - cx) + 1 : -dist;
        if (score > bestScore) { bestScore = score; best = l; }
      }
      if (best && bestScore > -0.35 * m.size) { if (!best.marks.includes(m.ch) && !best.ch.includes(m.ch)) best.marks.push(m.ch); }
      else stats.orphanMarks += 1;
    }
    // Segments: a wide horizontal gap separates independent pieces of text on one baseline (header fields, columns).
    let seg = [];
    const segments = [seg];
    for (let i = 0; i < kept.length; i += 1) {
      const g = kept[i];
      const prev = kept[i - 1];
      if (prev && g.x0 - prev.x1 > Math.max(28, 2.6 * Math.max(g.size, prev.size))) { seg = []; segments.push(seg); }
      seg.push(g);
    }
    for (const s of segments) if (s.length) lines.push(buildLine(s, row.oy, spaces));
  }
  lines.sort((a, b) => a.y - b.y || b.x1 - a.x1);
  return { lines, stats };
}

function buildLine(items, oy, spaces = []) {
  // Visual (left-to-right) tokens with word breaks from the geometry (the space glyphs PrimoPDF writes are unreliable).
  const tokens = [];
  for (let i = 0; i < items.length; i += 1) {
    const g = items[i];
    const prev = items[i - 1];
    const pc = prev && (prev.x0 + prev.x1) / 2, gc = (g.x0 + g.x1) / 2;
    if (prev && (g.x0 - prev.x1 > 0.17 * Math.min(g.size, prev.size) || (g.x0 - prev.x1 > -0.5 && spaces.some(c => c > pc && c < gc && c > prev.x1 - 1.5 && c < g.x0 + 1.5)))) tokens.push({ ch: ' ', space: true });
    const text = (g.ch + g.marks.join('')).normalize('NFC');
    tokens.push({ ch: text, ltr: g.kind === 'char' && isLtrChar(g.ch), g });
  }
  // Logical order: reverse, then restore the left-to-right runs (numbers, Latin, e-mail/web addresses) and mirror brackets.
  const logical = tokens.slice().reverse();
  const out = [];
  for (let i = 0; i < logical.length;) {
    if (logical[i].ltr) {
      let j = i;
      let last = i;
      while (j < logical.length && (logical[j].ltr || (!logical[j].space && logical[j].g?.kind === 'char' && /[.:,/\-@_]/.test(logical[j].ch)))) { if (logical[j].ltr) last = j; j += 1; }
      out.push(...logical.slice(i, last + 1).reverse());
      i = last + 1;
    } else {
      const t = logical[i];
      out.push(t.g?.kind === 'char' && MIRROR[t.ch] ? { ...t, ch: MIRROR[t.ch] } : t);
      i += 1;
    }
  }
  const text = out.map(t => t.ch).join('').replace(/\s+/g, ' ').trim();
  // Typography of the line: letters only.
  const ls = items.filter(g => g.kind === 'letter');
  const pool = ls.length ? ls : items;
  const sizes = pool.map(g => g.size).sort((a, b) => a - b);
  const colorCount = {};
  for (const g of pool) colorCount[g.color || '000000'] = (colorCount[g.color || '000000'] || 0) + 1;
  const color = Object.entries(colorCount).sort((a, b) => b[1] - a[1])[0][0];
  // The bold run at the logical start of the line (a lead-in word such as "אם כך," or "מכאן").
  let lead = '';
  for (const t of out) { if (t.space) { lead += ' '; continue; } if (!t.g?.bold) break; lead += t.ch; }
  return {
    text, y: Math.round(oy * 10) / 10, x0: Math.round(items[0].x0 * 10) / 10, x1: Math.round(items.at(-1).x1 * 10) / 10,
    size: sizes[Math.floor(sizes.length / 2)], bold: Math.round((pool.filter(g => g.bold).length / pool.length) * 100) / 100,
    color, leadBold: lead.trim(), fonts: [...new Set(pool.map(g => g.font))].join('|'),
  };
}

export function pageQuality(lines, stats) {
  const text = lines.map(l => l.text).join('\n');
  const h = hebrewStats(text);
  const reasons = [];
  if (h.heb < 40) reasons.push('few-hebrew-letters');
  if (h.hebRatio < 0.85) reasons.push('low-hebrew-ratio');
  if (h.misplacedRatio > 0.06 && h.finals > 10) reasons.push('misplaced-final-letters');
  if (stats.unknown > Math.max(3, h.heb * 0.003)) reasons.push('unknown-glyphs');
  if (stats.orphanMarks > Math.max(5, h.heb * 0.01)) reasons.push('orphan-points');
  return { ok: reasons.length === 0, reasons, heb: h.heb, hebRatio: Math.round(h.hebRatio * 1000) / 1000, misplacedRatio: Math.round(h.misplacedRatio * 1000) / 1000, unknown: stats.unknown, orphanMarks: stats.orphanMarks };
}

// B) OCR of one page with Tesseract's Hebrew model. Lines come back in logical order; no typography.
export function ocrPage(P, pdf, n, key) {
  const png = join(P.work, 'ocr', `${key}-${n}`);
  const txt = `${png}.txt`;
  if (!exists(txt)) {
    execFileSync('pdftoppm', ['-r', '300', '-gray', '-png', '-singlefile', '-f', String(n), '-l', String(n), pdf, png]);
    execFileSync('tesseract', [`${png}.png`, png, '-l', 'heb', '--psm', '6'], { stdio: 'ignore' });
  }
  const raw = execFileSync('cat', [txt], { encoding: 'utf8' });
  const lines = raw.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).map((text, i) => ({ text, y: i * 14, x0: 0, x1: 0, size: 12, bold: 0, color: '000000', leadBold: '', fonts: 'ocr' }));
  return lines;
}

export function extractAll({ pilotOnly = false, force = false } = {}) {
  const P = paths();
  const ingest = readJson(P.stage('ingest'));
  const report = [];
  for (const item of ingest.items) {
    if (pilotOnly && !item.pilot) continue;
    const out = join(P.work, 'pages', `${item.id}.json`);
    if (!force && exists(out)) { report.push(readJson(out).summary); continue; }
    const dump = readJson(join(P.work, 'glyphs', `${item.id}.json`));
    const pages = [];
    let ocrPages = 0, failed = 0;
    for (const page of dump.pages) {
      const { lines, stats } = decodePage(page, dump.fonts);
      let quality = pageQuality(lines, stats);
      let method = 'text-layer';
      let finalLines = lines;
      if (!quality.ok) {
        const ocr = ocrPage(P, join(P.src, item.path), page.n, item.id);
        const q2 = pageQuality(ocr, { unknown: 0, orphanMarks: 0 });
        ocrPages += 1;
        if (q2.ok && q2.heb > quality.heb) { finalLines = ocr; quality = { ...q2, fromOcr: true, textLayer: quality }; method = 'ocr-heb'; }
        else { quality = { ...quality, needsHebrewOcr: true, ocr: q2 }; failed += 1; }
      }
      pages.push({ n: page.n, w: page.w, h: page.h, method, quality, lines: finalLines });
    }
    const summary = { id: item.id, pages: pages.length, textLayerOk: pages.filter(p => p.method === 'text-layer' && p.quality.ok).length, ocrPages, failedPages: failed };
    writeJson(out, { id: item.id, path: item.path, summary, pages });
    report.push(summary);
  }
  writeJson(P.stage('extract'), { generatedAt: new Date().toISOString(), files: report });
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = extractAll({ pilotOnly: process.argv.includes('--pilot'), force: process.argv.includes('--force') });
  const sum = k => report.reduce((a, r) => a + r[k], 0);
  console.log(`extract: ${report.length} files, ${sum('pages')} pages, text layer ok ${sum('textLayerOk')}, OCR tried ${sum('ocrPages')}, failed ${sum('failedPages')}`);
}
