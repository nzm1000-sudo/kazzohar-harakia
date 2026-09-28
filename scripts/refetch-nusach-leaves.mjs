// Sefaria's plain texts endpoint sometimes answers with a Hebrew version that carries no redistributable licence while
// another version of the same leaf does (Siddur Sefard: "The Metsudah siddur, 1981", CC-BY). For every leaf of a dump
// whose licence is not on the allowlist, this asks Sefaria for the leaf's other Hebrew versions and takes the first
// allowed one — the same words of the same edition family, with a licence the app may bundle.
//   node scripts/refetch-nusach-leaves.mjs --dump /tmp/dump-sefard.json
import { readFileSync, writeFileSync } from 'node:fs';
import { LICENSE_ALLOWLIST, normalizeLicense } from '../src/data/nusach/manifest.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg, i, list) => (arg.startsWith('--') ? [arg.slice(2), list[i + 1]] : null)).filter(Boolean));
const dump = JSON.parse(readFileSync(args.dump, 'utf8'));
const allowed = license => LICENSE_ALLOWLIST.includes(normalizeLicense(license));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let fixed = 0;
for (const [ref, text] of Object.entries(dump.texts)) {
  if (allowed(text.heLicense)) continue;
  const probe = await (await fetch(`https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=hebrew`)).json().catch(() => null);
  const candidate = (probe?.available_versions || []).find(version => version.language === 'he' && allowed(version.license));
  if (!candidate) { console.log('no licensed version:', ref, '·', text.heVersionTitle, '·', text.heLicense); continue; }
  const data = await (await fetch(`https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=hebrew|${encodeURIComponent(candidate.versionTitle)}`)).json().catch(() => null);
  const version = data?.versions?.[0];
  const he = version?.text;
  if (!version || !Array.isArray(he) || !he.length) { console.log('fetch failed:', ref, '·', candidate.versionTitle); continue; }
  dump.texts[ref] = { ...text, he: he.every(Array.isArray) ? he.flat() : he, heVersionTitle: version.versionTitle, heVersionSource: version.versionSource, heLicense: version.license };
  fixed += 1;
  console.log('refetched:', ref, '←', version.versionTitle, '·', version.license);
  await delay(200);
}
writeFileSync(args.dump, JSON.stringify(dump));
console.log('fixed', fixed);
