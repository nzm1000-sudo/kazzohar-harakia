// Bartenura in the reader: the Mishnah reader's מפרשים tab (CommentaryPanel → layersAt → loadLayerUnits) shows each
// tractate's Bartenura in its vocalized edition wherever one was imported (scripts/library/build-vocalized.mjs), and the
// bundled unvocalized edition only where none exists. Nothing is vocalized by the app; the text is the edition's own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VOCALIZED_EDITIONS, WORKS, workById } from '../src/data/library/registry.mjs';
import { loadEditionChunk } from '../src/services/library/packs.mjs';
import { layersAt, loadLayerUnits } from '../src/services/library/relations.mjs';
import { nikudRatioOf } from '../scripts/library/build-vocalized.mjs';
import { installDiskAssets } from './helpers/diskAssets.mjs';

installDiskAssets();
const unitText = unit => [unit.dh, unit.text].filter(Boolean).join(' ');
const provenance = JSON.parse(readFileSync(new URL('../sources/vocalized/provenance.json', import.meta.url), 'utf8'));
const MISHNAH = WORKS.filter(work => work.primaryCategory === 'mishnah' && work.kind === 'pack');
const bartenuraOf = baseWorkId => WORKS.find(work => work.group === 'bartenura' && work.relation?.baseWorkId === baseWorkId);
// No open vocalized edition: Mikvaot (Torat Emet's is listed without a licence). Avot's bundled edition is vocalized already.
const NOT_VOCALIZED = ['Bartenura_on_Mishnah_Mikvaot'];
const ALREADY_VOCALIZED = ['Bartenura_on_Pirkei_Avot'];

test('Bartenura: every tractate has one, and every one but Mikvaot reads vocalized', () => {
  assert.equal(MISHNAH.length, 63);
  const bartenura = MISHNAH.map(work => bartenuraOf(work.workId));
  assert.ok(bartenura.every(Boolean), 'each tractate has its Bartenura');
  const vocalized = bartenura.filter(work => VOCALIZED_EDITIONS[work.workId]).map(work => work.workId);
  const plain = bartenura.filter(work => !VOCALIZED_EDITIONS[work.workId]).map(work => work.workId).sort();
  assert.equal(vocalized.length, 61, vocalized.join(', '));
  assert.deepEqual(plain, [...ALREADY_VOCALIZED, ...NOT_VOCALIZED].sort());
  // The tractates the owner reported unvocalized are vocalized now.
  for (const id of ['Shabbat', 'Pesachim', 'Sukkah', 'Beitzah', 'Kilayim', 'Sheviit', 'Terumot', 'Bikkurim', 'Zevachim', 'Middot', 'Oholot', 'Berakhot', 'Bava_Kamma']) {
    assert.equal(workById(`Bartenura_on_Mishnah_${id}`).editions[0].nikud, 'vocalized', id);
  }
  // Mikvaot's refusal is recorded with its reason, not hidden.
  assert.match(provenance.rejected.find(item => item.workId === 'Bartenura_on_Mishnah_Mikvaot').reason, /licence/);
});

test('Bartenura: the reader path loads the vocalized edition for every covered tractate, the bundled one elsewhere', async () => {
  const seen = [];
  for (const base of MISHNAH) {
    let letters = '';
    let units = 0;
    for (let node = 1; node <= base.editions[0].expected.length; node += 1) {
      const layer = layersAt(base.workId, node).find(item => item.work.group === 'bartenura');
      if (!layer) continue;
      const edition = layer.work.editions[0];
      const covered = Boolean(VOCALIZED_EDITIONS[layer.work.workId]);
      assert.equal(edition.packId, covered ? 'sefaria-vocalized-cc-by-nc' : layer.work.editions.at(-1).packId, `${layer.work.workId} ${node}: edition`);
      const loaded = await loadLayerUnits(layer);
      units += loaded.length;
      letters += loaded.map(unitText).join(' ');
    }
    const bartenura = bartenuraOf(base.workId);
    assert.ok(units > 0, `${base.workId}: Bartenura shown in the reader`);
    const ratio = nikudRatioOf(letters);
    const vocalized = Boolean(VOCALIZED_EDITIONS[bartenura.workId]) || ALREADY_VOCALIZED.includes(bartenura.workId);
    assert.ok(vocalized ? ratio >= 0.5 : ratio < 0.08, `${bartenura.workId}: ${ratio.toFixed(2)} vowel points per letter in the reader`);
    seen.push(bartenura.workId);
  }
  assert.equal(seen.length, 63);
});

test('Bartenura: a comment the vocalized edition lacks stays exactly as the bundled edition has it, and is named', async () => {
  for (const voc of Object.values(VOCALIZED_EDITIONS)) {
    const kept = voc.verification.carriedOver;
    assert.ok(kept.length <= Math.max(1, Math.floor(0.03 * voc.verification.units)), `${voc.workId}: ${kept.length} kept`);
    if (!kept.length) continue;
    assert.match(voc.attribution.modified, /במהדורה הלא־מנוקדת/, `${voc.workId}: the attribution says so`);
    const work = workById(voc.workId);
    const [vocalized, fallback] = work.editions;
    for (const { unitId } of kept) {
      const node = Number(unitId.split('.').at(-2));
      const find = chunk => chunk.nodes.find(item => item.n === node).units.find(unit => unit.id === unitId);
      assert.deepEqual(find(await loadEditionChunk(vocalized, { node })), find(await loadEditionChunk(fallback, { node })), unitId);
    }
  }
  // Shabbat 24:4:3 is not in the vocalized edition: the reader shows the bundled comment there, the rest vocalized.
  const shabbat = workById('Bartenura_on_Mishnah_Shabbat');
  assert.ok(shabbat.editions[0].verification.carriedOver.some(row => row.address === '24:4:3'));
});
