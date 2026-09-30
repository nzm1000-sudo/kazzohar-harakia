// צורת הדף: the best available page image — Vilna, else Bomberg Venice (all of Niddah, some single pages), else
// Munich 95 — named with its edition and holding library, and credited in About.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCAN_EDITIONS, bestScanRecord } from '../src/services/talmud.mjs';

const record = (slug, page, extra = {}) => ({ manuscript_slug: slug, page_id: page, anchorRef: page, image_url: `https://img/${slug}/${page}.jpg`, ...extra });
const VILNA = 'romm-vilna-pressing-(1880-86-ce)';
const BOMBERG = 'bomberg-(venice)-pressing-(1523-ce)';
const MUNICH = 'munich-manuscript-95-(1342-ce)';

test('Vilna first, then Bomberg Venice, then Munich 95', () => {
  assert.deepEqual(SCAN_EDITIONS.map(edition => edition.id), ['vilna', 'bomberg', 'munich']);
  assert.equal(bestScanRecord([record(BOMBERG, 'Berakhot 2a'), record(VILNA, 'Berakhot 2a'), record(MUNICH, 'Berakhot 2a')], 'Berakhot 2a').edition.id, 'vilna');
  // Sefaria's records for Niddah 2a: Bomberg and Munich only.
  const niddah = bestScanRecord([record(BOMBERG, 'Niddah 2a'), record(MUNICH, 'Niddah 2a')], 'Niddah 2a');
  assert.equal(niddah.edition.id, 'bomberg');
  assert.match(niddah.edition.note, /דפוס ונציה/);
  assert.equal(bestScanRecord([record(MUNICH, 'X 3b')], 'X 3b').edition.id, 'munich');
  assert.equal(bestScanRecord([record(BOMBERG, 'Niddah 2b')], 'Niddah 2a'), null, 'never a neighbouring page');
  assert.equal(bestScanRecord([record(VILNA, 'Y 2a', { image_url: '' })], 'Y 2a'), null, 'a record without an image is skipped');
});

test('the page names the edition shown and its library; About credits all of them', () => {
  const page = readFileSync(new URL('../src/pages/TalmudPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /\{isPrimary && scan\.note && <p className="scan-edition-note">\{scan\.note\}<\/p>\}/);
  // The page is named in Hebrew (the tractate and its amud), never by the provider's English id.
  assert.match(page, /`\$\{scan\.heTitle\} · \$\{tractate\.heTitle\} \$\{amudLabel\(amud\)\} · \$\{scan\.holder\} · דרך ספריא`/);
  const about = readFileSync(new URL('../src/pages/AboutPage.jsx', import.meta.url), 'utf8');
  for (const credit of ['דפוס וילנא, האלמנה והאחים ראם (1880–1886) · הספרייה הלאומית', 'דפוס ונציה, דניאל בומברג (1523) · הספרייה הלאומית', 'כתב יד מינכן 95 (1342) · הספרייה הממלכתית של בוואריה']) assert.ok(about.includes(credit), credit);
});
