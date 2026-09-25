import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src', import.meta.url));
const files = dir => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? (name === 'data' ? [] : files(path)) : /\.(jsx|mjs)$/.test(name) ? [path] : []; });

test('the daily Tehillim entry is labelled "תהילים של היום" everywhere in the UI', () => {
  const offenders = files(src).filter(path => /תהילים להיום|תהילים היום'/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
  assert.match(readFileSync(join(src, 'pages/TodayPage.jsx'), 'utf8'), />לתהילים של היום</);
  assert.match(readFileSync(join(src, 'NewApp.jsx'), 'utf8'), /title: 'תהילים של היום'/);
});
