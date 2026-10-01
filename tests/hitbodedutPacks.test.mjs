import test from 'node:test';
import assert from 'node:assert/strict';
import { createPackManager, formatBytes, PACKS_STATE_KEY, validateManifest } from '../src/services/ambientAudio/offlinePacks.mjs';
import { PACK_MANIFEST } from '../src/services/ambientAudio/packCatalog.mjs';

function memoryStorage() { const map = new Map(); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), map }; }
function memoryFs() { const files = new Map(); return { files, async write(path, bytes) { files.set(path, bytes); }, async remove(dir) { for (const key of [...files.keys()]) if (key.startsWith(`${dir}/`) || key === dir) files.delete(key); } }; }
const pack = (overrides = {}) => ({ id: 'tehillim-voice', title: 'תהילים בקול', license: 'CC BY 4.0', version: '1.0.0', files: [{ path: 'a.m4a', url: 'https://example.org/a.m4a', bytes: 4 }, { path: 'b.m4a', url: 'https://example.org/b.m4a', bytes: 6 }], ...overrides });
const manifest = (...packs) => ({ version: 1, packs });
const fetcher = (bodies, log = []) => async url => { log.push(url); const body = bodies[url]; return body ? { ok: true, status: 200, arrayBuffer: async () => body.buffer } : { ok: false, status: 404 }; };
const bodies = { 'https://example.org/a.m4a': new Uint8Array([1, 2, 3, 4]), 'https://example.org/b.m4a': new Uint8Array([5, 6, 7, 8, 9, 10]) };

test('the shipped catalogue is empty (no recordings yet) → the section stays hidden', () => {
  assert.equal(PACK_MANIFEST.packs.length, 0);
  assert.equal(createPackManager({ manifest: PACK_MANIFEST }).hasPacks, false);
});

test('manifest validation keeps only sound packs and says why', () => {
  assert.equal(validateManifest(manifest(pack())).ok, true);
  assert.equal(validateManifest(manifest(pack())).packs[0].bytes, 10);
  const bad = validateManifest(manifest(
    pack({ id: 'Bad Id' }),
    pack({ id: 'no-license', license: '' }),
    pack({ id: 'http', files: [{ path: 'a.m4a', url: 'http://example.org/a.m4a', bytes: 1 }] }),
    pack({ id: 'escape', files: [{ path: '../evil.m4a', url: 'https://example.org/a', bytes: 1 }] }),
    pack({ id: 'not-audio', files: [{ path: 'run.js', url: 'https://example.org/a', bytes: 1 }] }),
    pack({ id: 'zero', files: [{ path: 'a.m4a', url: 'https://example.org/a', bytes: 0 }] }),
    pack({ id: 'liar', bytes: 99 }),
    pack({ id: 'good' }),
  ));
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.packs.map(p => p.id), ['good']);
  assert.ok(bad.errors.some(e => /https only/.test(e)));
  assert.ok(bad.errors.some(e => /safe relative audio/.test(e)));
  assert.equal(validateManifest({ version: 2, packs: [] }).ok, false);
  assert.equal(validateManifest(null).ok, false);
});

test('no download without explicit consent', async () => {
  const log = [];
  const manager = createPackManager({ manifest: manifest(pack()), fs: memoryFs(), fetcher: fetcher(bodies, log), storage: memoryStorage() });
  await assert.rejects(manager.download('tehillim-voice'), /consent-required/);
  await assert.rejects(manager.download('tehillim-voice', { consent: 'yes' }), /consent-required/);
  assert.equal(log.length, 0, 'nothing was fetched');
});

test('download with progress, size accounting, delete', async () => {
  const fs = memoryFs();
  const storage = memoryStorage();
  const manager = createPackManager({ manifest: manifest(pack()), fs, fetcher: fetcher(bodies), storage });
  assert.equal(manager.list()[0].installed, false);
  assert.equal(manager.list()[0].sizeText, '10 בתים');
  const progress = [];
  const item = await manager.download('tehillim-voice', { consent: true, onProgress: p => progress.push(p.fraction) });
  assert.equal(item.installed, true);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress.every((value, i) => i === 0 || value >= progress[i - 1]), 'progress only moves forward');
  assert.deepEqual([...fs.files.keys()], ['audio-packs/tehillim-voice/a.m4a', 'audio-packs/tehillim-voice/b.m4a']);
  assert.equal(manager.storageUsed().bytes, 10);
  assert.equal(manager.filePath('tehillim-voice', 'a.m4a'), 'audio-packs/tehillim-voice/a.m4a');
  assert.equal(manager.filePath('tehillim-voice', '../x'), null);
  const after = await manager.remove('tehillim-voice');
  assert.equal(after.bytes, 0);
  assert.equal(fs.files.size, 0);
  assert.equal(manager.list()[0].installed, false);
  assert.equal(JSON.parse(storage.getItem(PACKS_STATE_KEY)).installed['tehillim-voice'], undefined);
});

test('a failed download (size, checksum, http) leaves nothing behind', async () => {
  const fs = memoryFs();
  const storage = memoryStorage();
  const wrongSize = createPackManager({ manifest: manifest(pack({ files: [{ path: 'a.m4a', url: 'https://example.org/a.m4a', bytes: 4 }, { path: 'b.m4a', url: 'https://example.org/b.m4a', bytes: 7 }] })), fs, fetcher: fetcher(bodies), storage });
  await assert.rejects(wrongSize.download('tehillim-voice', { consent: true }), /size-mismatch/);
  assert.equal(fs.files.size, 0);
  assert.equal(wrongSize.storageUsed().bytes, 0);
  const sum = createPackManager({ manifest: manifest(pack({ files: [{ path: 'a.m4a', url: 'https://example.org/a.m4a', bytes: 4, sha256: 'f'.repeat(64) }] })), fs, fetcher: fetcher(bodies), storage });
  await assert.rejects(sum.download('tehillim-voice', { consent: true }), /checksum-mismatch/);
  const missing = createPackManager({ manifest: manifest(pack({ files: [{ path: 'a.m4a', url: 'https://example.org/missing.m4a', bytes: 4 }] })), fs, fetcher: fetcher(bodies), storage });
  await assert.rejects(missing.download('tehillim-voice', { consent: true }), /http-404/);
  assert.equal(fs.files.size, 0);
});

test('a streamed body reports progress chunk by chunk', async () => {
  const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4])];
  const streamFetcher = async () => ({ ok: true, body: { getReader: () => { let i = 0; return { read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) }; } } });
  const manager = createPackManager({ manifest: manifest(pack({ files: [{ path: 'a.m4a', url: 'https://example.org/a.m4a', bytes: 4 }] })), fs: memoryFs(), fetcher: streamFetcher, storage: memoryStorage() });
  const seen = [];
  await manager.download('tehillim-voice', { consent: true, onProgress: p => seen.push(p.received) });
  assert.deepEqual(seen, [0, 2, 4, 4]);
});

test('sizes in Hebrew units', () => {
  assert.equal(formatBytes(512), '512 בתים');
  assert.equal(formatBytes(2048), '2 ק״ב');
  assert.equal(formatBytes(12.4 * 1024 * 1024), '12.4 מ״ב');
});
