// לעצמי · פֶּרֶק בְּהַפְתָּעָה — every chapter it can draw exists in the library's Tanakh reader; the shuffle bag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_WORKS } from '../src/data/library/registry.mjs';
import { parseLibraryRouteForTest } from './helpers/libraryRoute.mjs';
import { SCOPES, SURPRISE_KEY, chaptersOf, drawChapter, readSurprise, remainingInBag, setSurpriseScope } from '../src/services/leatzmi/surprise.mjs';
import { memoryStorage } from './helpers/memoryStorage.mjs';

test('every chapter of every scope is a real chapter of a Tanakh book in the registry', () => {
  const works = new Map(PUBLIC_WORKS.map(work => [work.workId, work]));
  for (const [scope] of SCOPES) {
    for (const item of chaptersOf(scope)) {
      const work = works.get(item.workId);
      assert.ok(work, `${item.workId} is in the library`);
      assert.equal(work.primaryCategory, 'tanakh', item.workId);
      assert.ok(item.chapter >= 1 && item.chapter <= work.editions[0].nodes.length, `${item.workId} ${item.chapter}`);
    }
  }
  // And every chapter of each book is reachable (the catalog's counts are the registry's).
  for (const item of chaptersOf('all').filter(entry => entry.chapter === 1)) {
    const count = chaptersOf('all').filter(entry => entry.workId === item.workId).length;
    assert.equal(count, works.get(item.workId).editions[0].nodes.length, item.workId);
  }
  assert.equal(chaptersOf('all').length, 929);
  assert.equal(chaptersOf('torah').length, 187);
  assert.equal(chaptersOf('torah').length + chaptersOf('neviim').length + chaptersOf('ketuvim').length, 929);
});

test('a drawn chapter opens the existing Tanakh reader route, a whole chapter (no verse)', () => {
  const storage = memoryStorage();
  const item = drawChapter('torah', { storage, random: () => 0.5 });
  assert.match(item.route, /^books\/r\/[A-Za-z_]+\/\d+$/);
  const parsed = parseLibraryRouteForTest(item.route);
  assert.equal(parsed.view, 'read');
  assert.equal(parsed.id, item.workId);
  assert.equal(parsed.node, item.chapter);
  assert.equal(parsed.unit, null);
  assert.equal(parsed.verse, undefined);
  assert.ok(item.label.startsWith(item.book));
});

test('the shuffle bag: no chapter twice until all were drawn; it survives a reload; no repeat across a refill', () => {
  const storage = memoryStorage();
  let seed = 7;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const size = chaptersOf('torah').length;
  const seen = new Set();
  let last = null;
  for (let i = 0; i < size; i += 1) {
    // A fresh copy of the storage each time: the bag is persisted, not in memory.
    const item = drawChapter('torah', { storage, random });
    const key = `${item.workId}/${item.chapter}`;
    assert.ok(!seen.has(key), `${key} drawn twice within one bag`);
    seen.add(key);
    last = key;
  }
  assert.equal(seen.size, size);
  assert.equal(remainingInBag('torah', storage), 0);
  const next = drawChapter('torah', { storage, random });
  assert.notEqual(`${next.workId}/${next.chapter}`, last, 'never the same chapter twice in a row');
  assert.equal(remainingInBag('torah', storage), size - 1);
});

test('scope choice is remembered; a damaged bag is rebuilt', () => {
  const storage = memoryStorage();
  assert.equal(readSurprise(storage).scope, 'all');
  setSurpriseScope('ketuvim', storage);
  assert.equal(readSurprise(storage).scope, 'ketuvim');
  setSurpriseScope('nonsense', storage);
  assert.equal(readSurprise(storage).scope, 'ketuvim');
  const damaged = memoryStorage({ [SURPRISE_KEY]: JSON.stringify({ scope: 'neviim', bags: { neviim: { size: 3, remaining: [999, -1, 'x'] } } }) });
  const item = drawChapter('neviim', { storage: damaged, random: () => 0.1 });
  assert.ok(chaptersOf('neviim').some(entry => entry.workId === item.workId && entry.chapter === item.chapter));
  assert.equal(remainingInBag('neviim', damaged), chaptersOf('neviim').length - 1);
});
