// The offline pack format (schema 1) — shared by the builder and the app, so the two can never disagree.
//
// A pack is a directory: manifest.json + files. The manifest says what the pack is and what it may be used for:
//   schemaVersion · packId · displayName · version · contentVersion · contentHash · rightsState · source · provider ·
//   attribution · commercialRestrictions · includedWorks · includedCommentaries · textIncluded · textSize ·
//   lexicalIndexSize · semanticIndexSize · totalDownloadSize · minimumAppVersion · dependencies · createdAt ·
//   index (the lexical index's own manifest) · files [{ path, role, bytes, sha256, checksum }]
// File roles: 'lexical-docs' · 'lexical-shard' (implemented) · 'text' · 'semantic-index' · 'reference-map' ·
// 'commentary-anchors' · 'metadata' (reserved by the schema; an app that does not know a role ignores the file).
// A pack changes without an app update: the catalog (torah-packs/catalog.json) lists the current version of each.
import { RIGHTS, SEARCHABLE_RIGHTS } from './inventory.mjs';
import { NORMALIZER_VERSION } from './hebrew.mjs';
import { FORMAT_VERSION, bytesChecksum } from './indexFormat.mjs';

export const PACK_SCHEMA_VERSION = 1;
export const APP_VERSION = '1.0.0';
export const FILE_ROLES = Object.freeze(['lexical-docs', 'lexical-shard', 'text', 'semantic-index', 'reference-map', 'commentary-anchors', 'metadata']);
export const stopTermsHash = terms => bytesChecksum(new TextEncoder().encode([...terms].sort().join(' ')));

const REQUIRED = ['schemaVersion', 'packId', 'displayName', 'version', 'contentHash', 'rightsState', 'includedWorks', 'lexicalIndexSize', 'totalDownloadSize', 'minimumAppVersion', 'dependencies', 'createdAt', 'files'];
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return Math.sign(d); }
  return 0;
}

// → { ok: true } or { ok: false, reason, code } — an incompatible, unsafe or unknown pack is refused, never half-used.
//   core: { stopTerms } of the built-in index (a pack must use the same stop words, normalizer and binary format)
export function validateManifest(manifest, { core = null, appVersion = APP_VERSION } = {}) {
  if (!manifest || typeof manifest !== 'object') return { ok: false, code: 'CORRUPT', reason: 'manifest missing' };
  for (const field of REQUIRED) if (manifest[field] === undefined || manifest[field] === null) return { ok: false, code: 'CORRUPT', reason: `manifest field ${field} missing` };
  if (manifest.schemaVersion !== PACK_SCHEMA_VERSION) return { ok: false, code: 'SCHEMA', reason: `schema ${manifest.schemaVersion} (this app reads ${PACK_SCHEMA_VERSION})` };
  if (compareVersions(appVersion, manifest.minimumAppVersion) < 0) return { ok: false, code: 'APP_TOO_OLD', reason: `needs app ${manifest.minimumAppVersion}` };
  if (!SEARCHABLE_RIGHTS.has(manifest.rightsState) || manifest.rightsState === RIGHTS.UNKNOWN) return { ok: false, code: 'RIGHTS', reason: `rights ${manifest.rightsState}` };
  if (!Array.isArray(manifest.files) || !manifest.files.every(file => file.path && /^[a-z0-9._-]+$/i.test(file.path) && /^[0-9a-f]{64}$/.test(file.sha256) && Number.isFinite(file.bytes))) return { ok: false, code: 'CORRUPT', reason: 'file list invalid' };
  const index = manifest.index;
  if (index) {
    if (index.normalizerVersion !== NORMALIZER_VERSION || index.formatVersion !== FORMAT_VERSION) return { ok: false, code: 'STALE', reason: 'index built with another normalizer or format' };
    if (core && index.stopTermsHash !== stopTermsHash(core.stopTerms.map(item => (Array.isArray(item) ? item[0] : item)))) return { ok: false, code: 'STALE', reason: 'index built against another built-in index' };
    if (!index.works?.every(row => SEARCHABLE_RIGHTS.has(row[2]))) return { ok: false, code: 'RIGHTS', reason: 'a work in the index is not rights-cleared' };
  }
  return { ok: true };
}

// ---------- SHA-256 ----------
// WebCrypto when the WebView offers it; a small pure implementation otherwise (older WebViews, tests). Same result.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
export function sha256Sync(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const length = bytes.length;
  const padded = new Uint8Array(((length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(length / 0x20000000), false);
  view.setUint32(padded.length - 4, (length << 3) >>> 0, false);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const a = w[i - 15]; const b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return [...h].map(value => value.toString(16).padStart(8, '0')).join('');
}
export async function sha256Hex(bytes) {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle) return [...new Uint8Array(await subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  } catch { /* fall through to the pure implementation */ }
  return sha256Sync(bytes);
}
