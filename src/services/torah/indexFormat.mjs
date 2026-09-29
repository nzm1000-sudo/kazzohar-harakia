// Binary layout of the Torah full-text index (shared by the builder and the reader, so the two can never disagree).
//   shard  = 'KZTS' · version · termCount · [len · letters(len) · df · byteLength]* · postings
//            postings of a term = ascending document numbers, delta-coded as unsigned LEB128 varints
//   docs   = 'KZTD' · version · docCount · workCount · [docs · runs · [nodeDelta · units · unitDeltas*]*]* · lengths
//            one byte per document: its length bucket (round(4·log2(words+1)))
// Every file is gzip-compressed; its checksum (FNV-1a over the uncompressed bytes) is recorded in the manifest.
import { decodeTerm, encodeTerm } from './hebrew.mjs';

export const FORMAT_VERSION = 1;
const SHARD_MAGIC = [0x4b, 0x5a, 0x54, 0x53]; // KZTS
const DOCS_MAGIC = [0x4b, 0x5a, 0x54, 0x44]; // KZTD

export class ByteWriter {
  constructor(size = 1 << 16) { this.bytes = new Uint8Array(size); this.length = 0; }
  ensure(extra) {
    if (this.length + extra <= this.bytes.length) return;
    let size = this.bytes.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.bytes.subarray(0, this.length));
    this.bytes = next;
  }
  byte(value) { this.ensure(1); this.bytes[this.length++] = value; }
  varint(value) {
    this.ensure(5);
    let v = value >>> 0;
    while (v >= 0x80) { this.bytes[this.length++] = (v & 0x7f) | 0x80; v >>>= 7; }
    this.bytes[this.length++] = v;
  }
  raw(bytes) { this.ensure(bytes.length); this.bytes.set(bytes, this.length); this.length += bytes.length; }
  result() { return this.bytes.slice(0, this.length); }
}

export function readVarint(bytes, state) {
  let result = 0;
  let shift = 0;
  let byte;
  do {
    byte = bytes[state.at++];
    result += (byte & 0x7f) * 2 ** shift;
    shift += 7;
  } while (byte & 0x80);
  return result;
}

// FNV-1a over bytes (the packs use the same hash over text).
export function bytesChecksum(bytes) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) { hash ^= bytes[i]; hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash.toString(16).padStart(8, '0');
}

// terms: [[term, df, postingBytes]] sorted by term.
export function encodeShard(terms) {
  const out = new ByteWriter();
  SHARD_MAGIC.forEach(byte => out.byte(byte));
  out.byte(FORMAT_VERSION);
  out.varint(terms.length);
  for (const [term, df, postings] of terms) {
    const letters = encodeTerm(term);
    out.byte(letters.length);
    out.raw(letters);
    out.varint(df);
    out.varint(postings.length);
  }
  for (const [, , postings] of terms) out.raw(postings);
  return out.result();
}

// → { terms: string[], df: Uint32Array, offset: Uint32Array, length: Uint32Array, bytes } (postings decoded on demand).
export function decodeShard(bytes) {
  if (SHARD_MAGIC.some((byte, i) => bytes[i] !== byte)) throw new Error('קובץ האינדקס פגום.');
  if (bytes[4] !== FORMAT_VERSION) throw new Error('גרסת האינדקס אינה נתמכת.');
  const state = { at: 5 };
  const count = readVarint(bytes, state);
  const terms = new Array(count);
  const df = new Uint32Array(count);
  const offset = new Uint32Array(count);
  const length = new Uint32Array(count);
  for (let i = 0; i < count; i += 1) {
    const len = bytes[state.at++];
    terms[i] = decodeTerm(bytes, state.at, len);
    state.at += len;
    df[i] = readVarint(bytes, state);
    length[i] = readVarint(bytes, state);
  }
  let at = state.at;
  for (let i = 0; i < count; i += 1) { offset[i] = at; at += length[i]; }
  return { terms, df, offset, length, bytes };
}

export function decodePostings(shard, index) {
  const out = new Uint32Array(shard.df[index]);
  const state = { at: shard.offset[index] };
  let doc = 0;
  for (let i = 0; i < out.length; i += 1) { doc += readVarint(shard.bytes, state); out[i] = doc; }
  return out;
}

// works: [{ runs: [[node, units[]]] }] in index order; lengths: Uint8Array (one bucket per document).
export function encodeDocs(works, lengths) {
  const out = new ByteWriter(1 << 20);
  DOCS_MAGIC.forEach(byte => out.byte(byte));
  out.byte(FORMAT_VERSION);
  out.varint(lengths.length);
  out.varint(works.length);
  for (const work of works) {
    out.varint(work.runs.reduce((sum, [, units]) => sum + units.length, 0));
    out.varint(work.runs.length);
    let node = 0;
    for (const [n, units] of work.runs) {
      out.varint(n - node);
      node = n;
      out.varint(units.length);
      let unit = 0;
      for (const u of units) { out.varint(u - unit); unit = u; }
    }
  }
  out.raw(lengths);
  return out.result();
}

// → { count, workOf: Uint16Array, nodeOf: Uint16Array, unitOf: Uint32Array, lengthOf: Uint8Array, workStart: Uint32Array }
export function decodeDocs(bytes) {
  if (DOCS_MAGIC.some((byte, i) => bytes[i] !== byte)) throw new Error('קובץ האינדקס פגום.');
  const state = { at: 5 };
  const count = readVarint(bytes, state);
  const works = readVarint(bytes, state);
  const workOf = new Uint16Array(count);
  const nodeOf = new Uint16Array(count);
  const unitOf = new Uint32Array(count);
  const workStart = new Uint32Array(works + 1);
  let doc = 0;
  for (let w = 0; w < works; w += 1) {
    workStart[w] = doc;
    readVarint(bytes, state);
    const runs = readVarint(bytes, state);
    let node = 0;
    for (let r = 0; r < runs; r += 1) {
      node += readVarint(bytes, state);
      const units = readVarint(bytes, state);
      let unit = 0;
      for (let u = 0; u < units; u += 1) {
        unit += readVarint(bytes, state);
        workOf[doc] = w; nodeOf[doc] = node; unitOf[doc] = unit;
        doc += 1;
      }
    }
  }
  workStart[works] = doc;
  const lengthOf = bytes.slice(state.at, state.at + count);
  return { count, workOf, nodeOf, unitOf, lengthOf, workStart };
}
export const lengthBucket = words => Math.min(255, Math.round(4 * Math.log2(words + 1)));
export const bucketLength = bucket => 2 ** (bucket / 4) - 1;
