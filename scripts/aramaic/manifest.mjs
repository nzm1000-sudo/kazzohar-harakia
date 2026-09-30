// The input fingerprint of the Aramaic engine build (Phase 10): every input that decides the output — the sources'
// content hashes, the reviewed data, the build and runtime code, and the app's texts (by the checksums their pack
// manifests record, and the text of the liturgy modules). Text only, never gzip bytes: identical on every Node version.
// The build writes it with the output's own hash; the CI test recomputes it (fast) and fails when either is stale.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ROOT, PACKS, LITURGY_MODULES, OTHER_MODULES } from './corpora.mjs';
import { DICTIONARY_SOURCES } from '../../src/data/dictionary/sources.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const CODE = ['src/data/dictionary/reviewed.mjs', 'src/data/dictionary/reviewedAramaic.mjs', 'src/data/dictionary/sources.mjs',
  'scripts/dictionary/build-aramaic-engine.mjs', 'scripts/dictionary/lexica/common.mjs', 'scripts/dictionary/lexica/krupnik.mjs', 'scripts/dictionary/lexica/jastrow.mjs', 'scripts/dictionary/lexica/wiktionary.mjs',
  'scripts/dictionary/aramaic/lexicon.mjs', 'scripts/dictionary/aramaic/verbs.mjs', 'scripts/dictionary/aramaic/nominal.mjs', 'scripts/dictionary/aramaic/analyze.mjs', 'scripts/dictionary/aramaic/attestation.mjs',
  'scripts/aramaic/corpora.mjs', 'scripts/aramaic/classify.mjs', 'scripts/aramaic/names.mjs',
  'src/services/wordLookup/normalize.mjs', 'src/services/wordLookup/engine.mjs', 'src/services/wordLookup/aramaic/render.mjs', 'src/services/wordLookup/aramaic/hebrewVerbs.mjs', 'src/services/wordLookup/aramaic/pronominal.mjs', 'src/services/wordLookup/aramaic/profiles.mjs'];

export function buildInputs() {
  const inputs = {};
  for (const s of DICTIONARY_SOURCES.filter(x => x.imported)) inputs[`source:${s.sourceId}`] = s.contentHash;
  for (const f of CODE) inputs[`code:${f}`] = sha(readFileSync(join(ROOT, f), 'utf8'));
  for (const pack of readdirSync(join(ROOT, PACKS)).sort()) {
    const m = join(ROOT, PACKS, pack, 'manifest.json');
    if (!existsSync(m)) continue;
    const manifest = JSON.parse(readFileSync(m, 'utf8'));
    inputs[`pack:${pack}`] = sha((manifest.files || []).map(f => `${f.file}:${f.checksum}:${f.rawBytes || ''}`).sort().join('\n'));
  }
  for (const f of [...LITURGY_MODULES, ...OTHER_MODULES]) if (existsSync(join(ROOT, f))) inputs[`text:${f}`] = sha(readFileSync(join(ROOT, f), 'utf8'));
  return inputs;
}
export const outputHash = () => sha(readFileSync(join(ROOT, 'src/data/dictionary/wordDictionary.mjs'), 'utf8'));
