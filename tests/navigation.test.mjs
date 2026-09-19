import test from 'node:test';
import assert from 'node:assert/strict';
import { backAction, isIosEdgeBackGesture } from '../src/navigation.mjs';

test('iOS edge swipe accepts a left-edge horizontal gesture', () => {
  assert.equal(isIosEdgeBackGesture({ startX: 12, endX: 90, startY: 200, endY: 214 }), true);
});

test('iOS edge swipe ignores controls, vertical movement, and non-edge touches', () => {
  assert.equal(isIosEdgeBackGesture({ startX: 12, endX: 90, startY: 200, endY: 280, blocked: true }), false);
  assert.equal(isIosEdgeBackGesture({ startX: 12, endX: 90, startY: 200, endY: 280 }), false);
  assert.equal(isIosEdgeBackGesture({ startX: 40, endX: 120, startY: 200, endY: 210 }), false);
});

test('back priority closes overlays, then history, and does nothing at root', () => {
  assert.equal(backAction({ overlay: true, source: true, depth: 3 }), 'overlay');
  assert.equal(backAction({ source: true, depth: 0 }), 'history');
  assert.equal(backAction({ depth: 2 }), 'history');
  assert.equal(backAction({ depth: 0 }), 'none');
});
