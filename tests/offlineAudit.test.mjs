// The offline audit: the owner's matrix is computed from the inventory, and the documentation prints exactly it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { offlineAudit, offlineAuditMarkdown, offlineSummary } from '../src/services/torah/offlineAudit.mjs';

test('the documented audit is the computed one', () => {
  const doc = readFileSync(new URL('../docs/library/torah-engine.md', import.meta.url), 'utf8');
  const block = doc.split('<!-- offline-audit:start -->')[1].split('<!-- offline-audit:end -->')[0].trim();
  assert.equal(block, offlineAuditMarkdown(), 'docs/library/torah-engine.md: regenerate the table (offlineAuditMarkdown)');
});

test('core corpora are fully offline — text, global search, book search, exact deep links', () => {
  const rows = Object.fromEntries(offlineAudit().map(row => [row.id, row]));
  for (const id of ['tanakh', 'mishnah', 'mishnah-commentary', 'bavli', 'rashi', 'tosafot', 'rif', 'rambam', 'shulchan-arukh', 'mishnah-berurah', 'biur-halacha', 'yalkut-yosef', 'oneg-shabbat', 'zohar']) {
    const row = rows[id];
    assert.equal(row.textOffline, 'full', id);
    assert.equal(row.globalSearch.builtIn, row.works, `${id}: every work in the built-in index`);
    assert.equal(row.bookSearchOffline, row.works, id);
    assert.equal(row.deepLinkOffline, 'exact', id);
  }
  // The shelves outside the built-in index: text offline, full-text search through their pack (never pretended).
  for (const [id, pack] of [['midrash', 'midrash'], ['chassidut', 'chassidut'], ['responsa', 'responsa'], ['other-shelves', 'machshava']]) {
    assert.equal(rows[id].textOffline, 'full', id);
    assert.equal(rows[id].globalSearch.builtIn, 0, id);
    assert.deepEqual(rows[id].globalSearch.pack, [pack], id);
  }
  assert.equal(rows.bavli.scansOffline, false, 'page scans are online only — said, not hidden');
  const summary = offlineSummary();
  assert.ok(summary.localBooks >= summary.books - 2);
  assert.ok(summary.onlineOnlyLayers > 0 && summary.onlineOnlyNames.length > 0);
});
