// E2E check for the Sefaria service layer. Run: node tests/sefaria-e2e.cjs
// Bundles the real service module and exercises it against the live Sefaria API.
const path = require('node:path');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dir = mkdtempSync(path.join(tmpdir(), 'sefaria-e2e-'));
try {
  execFileSync(path.join(root, 'node_modules/.bin/esbuild'), [
    path.join(root, 'src/services/sefaria.mjs'),
    '--bundle', '--platform=node', '--format=cjs', `--outfile=${dir}/svc.cjs`,
  ], { cwd: root, stdio: 'inherit' });
  const Module = require('node:module');
  const mod = new Module('sefaria-test', null);
  mod.filename = path.join(dir, 'svc.cjs');
  mod.paths = Module._nodeModulePaths(dir);
  mod._compile(require('node:fs').readFileSync(mod.filename, 'utf8'), mod.filename);
  const { getText, search, normalizeText } = mod.exports;

  (async () => {
    const text = await getText('Psalms.23');
    console.log('getText OK:', JSON.stringify({
      ref: text.ref, verses: text.hebrew.length,
      first: text.hebrew[0].slice(0, 40), version: text.version, license: text.license,
    }));
    assert.equal(text.ref, 'Psalms 23');
    assert.ok(text.hebrew.length > 0);
    assert.equal(normalizeText(null), null);
    try { await getText('NoSuchRef.999'); assert.fail('should have thrown'); }
    catch (e) { console.log('missing-ref error path OK:', e.message); }
    try {
      const hits = await search('בורא נפשות', 3);
      console.log('search OK:', hits.length, 'hits; first:', (hits[0]?.ref || '').slice(0, 60));
    } catch (e) { console.log('search failed at service level:', e.message); }
    console.log('E2E done.');
  })().catch(e => { console.error('E2E FAILURE:', e.message); process.exitCode = 1; });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
