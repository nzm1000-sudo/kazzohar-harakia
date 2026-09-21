const KEY = 'kz-bookmarks-v1';

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function write(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function isBookmarked(id) {
  return read().some(bookmark => bookmark.id === id);
}

export function toggleBookmark(bookmark) {
  const current = read();
  const next = current.some(item => item.id === bookmark.id)
    ? current.filter(item => item.id !== bookmark.id)
    : [{ ...bookmark, savedAt: Date.now() }, ...current];
  write(next);
  return next.some(item => item.id === bookmark.id);
}

export function listBookmarks() {
  return read().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}