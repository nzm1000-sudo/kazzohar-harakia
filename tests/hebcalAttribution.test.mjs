// Hebcal (GPL-2.0) attribution: the About page names the packages, their exact bundled versions, authors, licenses
// and links, and the app ships the packages' own license texts — pinned to the installed files so nothing drifts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { version as installedCoreVersion } from '@hebcal/core';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
// The packages' exports maps hide package.json from require(); read the installed files directly.
const installedFile = (pkg, file) => readFileSync(new URL(`../node_modules/${pkg}/${file}`, import.meta.url), 'utf8');
const installedPackage = pkg => JSON.parse(installedFile(pkg, 'package.json'));
const about = read('../src/pages/AboutPage.jsx');

test('the About page credits Hebcal with the exact bundled versions, authors, licenses and links', () => {
  assert.match(about, /import \{ version as HEBCAL_CORE_VERSION \} from '@hebcal\/core'/, 'the core version comes from the package itself');
  for (const [pkg, key] of [['@hebcal/hdate', 'hdate'], ['@hebcal/noaa', 'noaa']]) {
    const installed = installedPackage(pkg);
    const line = about.match(new RegExp(`${key}: \\{[^}]+\\}`))[0];
    assert.match(line, new RegExp(`version: '${installed.version.replace(/\./g, '\\.')}'`), `${pkg} version matches the installed package`);
    assert.match(line, new RegExp(`license: '${installed.license}'`), `${pkg} license matches the installed package`);
  }
  const core = installedPackage('@hebcal/core');
  assert.equal(core.license, 'GPL-2.0');
  assert.equal(installedCoreVersion, core.version);
  assert.match(about, /author: 'Michael J\. Radwin'/);
  assert.match(about, /Danny Sadinoff/);
  assert.match(about, /https:\/\/www\.hebcal\.com\//);
  assert.match(about, /https:\/\/github\.com\/hebcal\/hebcal-es6/);
  assert.match(about, /gnu\.org\/licenses\/old-licenses\/gpl-2\.0\.html/);
  assert.match(about, /className="about-hebcal"/, 'the block is rendered, not only declared');
});

test('the packages\' own license texts ship in the app, byte-identical to the installed files', () => {
  for (const [pkg, file] of [['@hebcal/core', 'hebcal-core-LICENSE.txt'], ['@hebcal/hdate', 'hebcal-hdate-LICENSE.txt'], ['@hebcal/noaa', 'hebcal-noaa-LICENSE.txt']]) {
    const installed = installedFile(pkg, 'LICENSE');
    assert.equal(read(`../public/licenses/${file}`), installed, `${file} matches ${pkg}/LICENSE`);
    assert.match(about, new RegExp(`licenses/${file.replace(/\./g, '\\.')}`), `${file} is linked from About`);
  }
});
