export function isIosEdgeBackGesture({ startX, endX, startY, endY, blocked = false }) {
  const dx = endX - startX;
  const dy = Math.abs(endY - startY);
  return !blocked && startX <= 24 && dx > 45 && dx > dy * 1.2;
}

export function backAction({ overlay = false, source = false, depth = 0 }) {
  if (overlay) return 'overlay';
  return source || depth > 0 ? 'history' : 'none';
}
