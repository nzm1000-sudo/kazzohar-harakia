import test from 'node:test';
import assert from 'node:assert/strict';
import { backAction } from '../src/navigation.mjs';

test('back priority closes overlays, then history, and does nothing at root', () => {
  assert.equal(backAction({ overlay: true, source: true, depth: 3 }), 'overlay');
  assert.equal(backAction({ source: true, depth: 0 }), 'history');
  assert.equal(backAction({ depth: 2 }), 'history');
  assert.equal(backAction({ depth: 0 }), 'none');
});
