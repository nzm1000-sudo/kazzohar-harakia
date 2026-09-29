// gunzip in plain JavaScript, for devices without DecompressionStream (iOS 15.0–16.3 WebViews). A compact port of
// tinf / tiny-inflate (Joergen Ibsen, Devon Govett; zlib licence). Content packs are verified by checksum after
// decompression, so a decoding fault can never show wrong text — it only refuses to open.
class Tree {
  constructor() { this.table = new Uint16Array(16); this.trans = new Uint16Array(288); }
}

const fixedLengths = new Tree();
const fixedDistances = new Tree();
const lengthBits = new Uint8Array(30);
const lengthBase = new Uint16Array(30);
const distBits = new Uint8Array(30);
const distBase = new Uint16Array(30);
const codeOrder = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
const codeTree = new Tree();
const lengths = new Uint8Array(288 + 32);
const offsets = new Uint16Array(16);

function buildBitsBase(bits, base, delta, first) {
  for (let i = 0; i < delta; i += 1) bits[i] = 0;
  for (let i = 0; i < 30 - delta; i += 1) bits[i + delta] = (i / delta) | 0;
  for (let i = 0, sum = first; i < 30; i += 1) { base[i] = sum; sum += 1 << bits[i]; }
}

function buildFixedTrees(lt, dt) {
  for (let i = 0; i < 7; i += 1) lt.table[i] = 0;
  lt.table[7] = 24; lt.table[8] = 152; lt.table[9] = 112;
  for (let i = 0; i < 24; i += 1) lt.trans[i] = 256 + i;
  for (let i = 0; i < 144; i += 1) lt.trans[24 + i] = i;
  for (let i = 0; i < 8; i += 1) lt.trans[24 + 144 + i] = 280 + i;
  for (let i = 0; i < 112; i += 1) lt.trans[24 + 144 + 8 + i] = 144 + i;
  for (let i = 0; i < 5; i += 1) dt.table[i] = 0;
  dt.table[5] = 32;
  for (let i = 0; i < 32; i += 1) dt.trans[i] = i;
}

function buildTree(tree, codeLengths, offset, count) {
  for (let i = 0; i < 16; i += 1) tree.table[i] = 0;
  for (let i = 0; i < count; i += 1) tree.table[codeLengths[offset + i]] += 1;
  tree.table[0] = 0;
  for (let i = 0, sum = 0; i < 16; i += 1) { offsets[i] = sum; sum += tree.table[i]; }
  for (let i = 0; i < count; i += 1) if (codeLengths[offset + i]) tree.trans[offsets[codeLengths[offset + i]]++] = i;
}

buildFixedTrees(fixedLengths, fixedDistances);
buildBitsBase(lengthBits, lengthBase, 4, 3);
buildBitsBase(distBits, distBase, 2, 1);
lengthBits[28] = 0;
lengthBase[28] = 258;

function getBit(d) {
  if (!d.bitcount--) { d.tag = d.source[d.index++]; d.bitcount = 7; }
  const bit = d.tag & 1;
  d.tag >>>= 1;
  return bit;
}

function readBits(d, count, base) {
  if (!count) return base;
  while (d.bitcount < 24) { d.tag |= (d.source[d.index++] | 0) << d.bitcount; d.bitcount += 8; }
  const value = d.tag & (0xffff >>> (16 - count));
  d.tag >>>= count;
  d.bitcount -= count;
  return value + base;
}

function decodeSymbol(d, tree) {
  while (d.bitcount < 24) { d.tag |= (d.source[d.index++] | 0) << d.bitcount; d.bitcount += 8; }
  let sum = 0;
  let cur = 0;
  let len = 0;
  let tag = d.tag;
  do {
    cur = 2 * cur + (tag & 1);
    tag >>>= 1;
    len += 1;
    if (len > 15) throw new Error('inflate: bad code');
    sum += tree.table[len];
    cur -= tree.table[len];
  } while (cur >= 0);
  d.tag = tag;
  d.bitcount -= len;
  return tree.trans[sum + cur];
}

function decodeTrees(d, lt, dt) {
  const hlit = readBits(d, 5, 257);
  const hdist = readBits(d, 5, 1);
  const hclen = readBits(d, 4, 4);
  for (let i = 0; i < 19; i += 1) lengths[i] = 0;
  for (let i = 0; i < hclen; i += 1) lengths[codeOrder[i]] = readBits(d, 3, 0);
  buildTree(codeTree, lengths, 0, 19);
  for (let num = 0; num < hlit + hdist;) {
    const sym = decodeSymbol(d, codeTree);
    if (sym === 16) { const prev = lengths[num - 1]; for (let n = readBits(d, 2, 3); n; n -= 1) lengths[num++] = prev; }
    else if (sym === 17) { for (let n = readBits(d, 3, 3); n; n -= 1) lengths[num++] = 0; }
    else if (sym === 18) { for (let n = readBits(d, 7, 11); n; n -= 1) lengths[num++] = 0; }
    else lengths[num++] = sym;
  }
  buildTree(lt, lengths, 0, hlit);
  buildTree(dt, lengths, hlit, hdist);
}

function inflateBlock(d, lt, dt) {
  for (;;) {
    let sym = decodeSymbol(d, lt);
    if (sym === 256) return;
    if (sym < 256) { d.dest[d.length++] = sym; continue; }
    sym -= 257;
    const length = readBits(d, lengthBits[sym], lengthBase[sym]);
    const dist = decodeSymbol(d, dt);
    const from = d.length - readBits(d, distBits[dist], distBase[dist]);
    if (from < 0) throw new Error('inflate: bad distance');
    for (let i = from; i < from + length; i += 1) d.dest[d.length++] = d.dest[i];
  }
}

function inflateStored(d) {
  while (d.bitcount > 8) { d.index -= 1; d.bitcount -= 8; }
  const length = d.source[d.index] | (d.source[d.index + 1] << 8);
  const inverse = d.source[d.index + 2] | (d.source[d.index + 3] << 8);
  if (length !== (~inverse & 0xffff)) throw new Error('inflate: bad stored block');
  d.index += 4;
  d.dest.set(d.source.subarray(d.index, d.index + length), d.length);
  d.index += length;
  d.length += length;
  d.tag = 0;
  d.bitcount = 0;
}

// Raw DEFLATE → bytes; `size` is the exact output length.
export function inflateRaw(source, size) {
  const d = { source, index: 0, tag: 0, bitcount: 0, dest: new Uint8Array(size), length: 0, lt: new Tree(), dt: new Tree() };
  let final = 0;
  do {
    final = getBit(d);
    const type = readBits(d, 2, 0);
    if (type === 0) inflateStored(d);
    else if (type === 1) inflateBlock(d, fixedLengths, fixedDistances);
    else if (type === 2) { decodeTrees(d, d.lt, d.dt); inflateBlock(d, d.lt, d.dt); }
    else throw new Error('inflate: bad block type');
  } while (!final);
  if (d.length !== size) throw new Error('inflate: size mismatch');
  return d.dest;
}

// A single-member gzip file → bytes (RFC 1952 header; ISIZE gives the output length).
export function gunzipBytes(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data[0] !== 0x1f || data[1] !== 0x8b || data[2] !== 8) throw new Error('gunzip: not a gzip file');
  const flags = data[3];
  let offset = 10;
  if (flags & 4) offset += 2 + (data[offset] | (data[offset + 1] << 8));
  if (flags & 8) { while (data[offset++]); }
  if (flags & 16) { while (data[offset++]); }
  if (flags & 2) offset += 2;
  const end = data.length;
  const size = (data[end - 4] | (data[end - 3] << 8) | (data[end - 2] << 16) | (data[end - 1] << 24)) >>> 0;
  return inflateRaw(data.subarray(offset, end - 8), size);
}
