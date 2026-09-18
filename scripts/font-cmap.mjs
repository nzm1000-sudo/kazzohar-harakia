// Diagnostic: which Unicode code points does a WOFF (v1) font actually cover?
// Usage: node scripts/font-cmap.mjs <file.woff> [cpStart cpEnd]
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function woffCodePoints(file) {
  const buf = readFileSync(file);
  const u32 = o => buf.readUInt32BE(o), u16 = o => buf.readUInt16BE(o);
  if (buf.toString('latin1', 0, 4) !== 'wOFF') throw new Error(`${file}: not a WOFF v1 file`);
  const numTables = u16(12);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    const tag = buf.toString('latin1', o, o + 4), offset = u32(o + 4), compLength = u32(o + 8), origLength = u32(o + 12);
    const raw = buf.subarray(offset, offset + compLength);
    tables[tag] = compLength < origLength ? inflateSync(raw) : raw;
  }
  const cmap = tables.cmap;
  const n = cmap.readUInt16BE(2);
  const covered = new Set();
  for (let i = 0; i < n; i++) {
    const off = cmap.readUInt32BE(4 + i * 8 + 4);
    const format = cmap.readUInt16BE(off);
    if (format === 4) {
      const segX2 = cmap.readUInt16BE(off + 6), seg = segX2 / 2;
      for (let s = 0; s < seg; s++) {
        const end = cmap.readUInt16BE(off + 14 + s * 2), start = cmap.readUInt16BE(off + 16 + segX2 + s * 2);
        const delta = cmap.readInt16BE(off + 16 + segX2 * 2 + s * 2), roBase = off + 16 + segX2 * 3 + s * 2, ro = cmap.readUInt16BE(roBase);
        for (let c = start; c <= end && c !== 0xFFFF; c++) {
          let g;
          if (ro === 0) g = (c + delta) & 0xFFFF; else { const gi = roBase + ro + (c - start) * 2; g = cmap.readUInt16BE(gi); if (g) g = (g + delta) & 0xFFFF; }
          if (g) covered.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(off + 12);
      for (let g = 0; g < groups; g++) { const o = off + 16 + g * 12; const s = cmap.readUInt32BE(o), e = cmap.readUInt32BE(o + 4); for (let c = s; c <= e; c++) covered.add(c); }
    }
  }
  return covered;
}

export const hex = cp => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

if (process.argv[1] && /font-cmap\.mjs$/.test(process.argv[1])) {
  const [file, startHex = '0591', endHex = '05F4'] = process.argv.slice(2);
  const covered = woffCodePoints(file);
  const start = parseInt(startHex, 16), end = parseInt(endHex, 16);
  const missing = [], present = [];
  for (let c = start; c <= end; c++) (covered.has(c) ? present : missing).push(hex(c));
  console.log(JSON.stringify({ file, glyphsCovered: covered.size, range: `${startHex}-${endHex}`, present, missing }, null, 1));
}
