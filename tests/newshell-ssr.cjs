// SSR repro harness: bundles src/devRenderCheck.jsx (new components + mock props)
// and runs it, surfacing esbuild parse errors and runtime throws with line info.
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const root = path.resolve(__dirname, '..');
const dir = mkdtempSync(path.join(tmpdir(), 'newshell-ssr-'));
const out = path.join(dir, 'check.cjs');
try {
  execFileSync(path.join(root, 'node_modules/.bin/esbuild'), [
    path.join(root, 'src/devRenderCheck.jsx'),
    '--bundle', '--jsx=automatic', '--platform=node', '--format=cjs', `--outfile=${out}`,
  ], { cwd: root, stdio: 'inherit' });
  const mod = new Module('newshell-ssr', null);
  mod.filename = out;
  mod.paths = Module._nodeModulePaths(root);
  mod._compile(fsRead(out), mod.filename);
} catch (error) {
  // esbuild prints parse errors with file:line:col already
  console.error('HARNESS ERROR:', error.message);
  process.exitCode = 1;
} finally {
  try { require('node:fs').rmSync(dir, { recursive: true, force: true }); } catch {}
}
function fsRead(file) { return require('node:fs').readFileSync(file, 'utf8'); }
