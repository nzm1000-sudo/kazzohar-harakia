import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TORAT_SHAI, TORAT_SHAI_GROUPS, TORAT_SHAI_PIECES, parseToratShaiRoute, toratShaiRoute, pieceById, pieceNeighbours } from '../src/data/toratShai/index.mjs';

test('תורת ש״י: every piece is complete, credited and reachable', () => {
  assert.equal(TORAT_SHAI.author, 'הרב שלום יוסף ברבי');
  const ids = new Set();
  for (const piece of TORAT_SHAI_PIECES) {
    assert.ok(!ids.has(piece.id), `duplicate id ${piece.id}`); ids.add(piece.id);
    assert.ok(TORAT_SHAI_GROUPS.some(group => group.key === piece.group), piece.id);
    assert.ok(piece.title && piece.occasion && piece.blocks.length > 3, piece.id);
    for (const block of piece.blocks) {
      assert.ok(['text', 'source', 'section', 'signature'].includes(block.type), piece.id);
      if (block.type === 'source') assert.ok(block.ref, `${piece.id}: a quotation keeps its reference`);
    }
    assert.deepEqual(parseToratShaiRoute(toratShaiRoute.piece(piece.id)), { view: 'piece', id: piece.id });
    assert.equal(pieceById(piece.id), piece);
  }
  assert.deepEqual(parseToratShaiRoute('torat-shai'), { view: 'home' });
  assert.equal(pieceNeighbours(TORAT_SHAI_PIECES[0].id).previous, null);
  assert.equal(pieceNeighbours(TORAT_SHAI_PIECES.at(-1).id).next, null);
});

test('תורת ש״י is a category on the books screen and routed by the app', () => {
  assert.match(readFileSync(new URL('../src/pages/LibraryPage.jsx', import.meta.url), 'utf8'), /go\('torat-shai'\)/);
  assert.match(readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8'), /mode==='torat-shai'/);
});
