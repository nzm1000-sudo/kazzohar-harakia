// Where installed pack files live. One small interface, three places:
//   native (iOS / Android): the app's own Library/NoCloud directory through @capacitor/filesystem — persistent across
//     app updates, never evicted by the WebView, excluded from iCloud backup (it can always be downloaded again)
//   web: IndexedDB (the browser's persistent storage for this site; asked to persist when the browser allows)
//   memory: tests
// Paths are "<packId>/<version>/<file>"; a version directory is written completely before the registry points at it.
//   write(path, bytes) · read(path) → bytes | null · removeDir(prefix) · usage() → bytes · kind
const toBase64 = bytes => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = text => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export function memoryStore({ capacity = Infinity } = {}) {
  const files = new Map();
  const used = () => [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  return {
    kind: 'memory',
    files,
    async write(path, bytes) {
      if (used() + bytes.length > capacity) { const error = new Error('No space left on device'); error.name = 'QuotaExceededError'; throw error; }
      files.set(path, new Uint8Array(bytes));
    },
    async read(path) { return files.has(path) ? files.get(path) : null; },
    async removeDir(prefix) { for (const key of [...files.keys()]) if (key.startsWith(`${prefix}/`)) files.delete(key); },
    async usage(prefix = '') { return [...files].filter(([key]) => key.startsWith(prefix)).reduce((sum, [, bytes]) => sum + bytes.length, 0); },
  };
}

const DB = 'kz-torah-packs';
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
const done = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
export function indexedDbStore() {
  let db = null;
  const tx = async mode => { db ||= await openDb(); return db.transaction('files', mode).objectStore('files'); };
  try { globalThis.navigator?.storage?.persist?.().catch(() => {}); } catch { /* not offered */ }
  return {
    kind: 'indexeddb',
    async write(path, bytes) {
      const store = await tx('readwrite');
      await done(store.put(bytes.slice().buffer, path));
    },
    async read(path) {
      const value = await done((await tx('readonly')).get(path));
      return value ? new Uint8Array(value) : null;
    },
    async removeDir(prefix) {
      await done((await tx('readwrite')).delete(IDBKeyRange.bound(`${prefix}/`, `${prefix}/￿`)));
    },
    async usage(prefix = '') {
      const store = await tx('readonly');
      const values = await done(store.getAll(IDBKeyRange.bound(prefix, `${prefix}￿`)));
      return values.reduce((sum, value) => sum + (value?.byteLength || 0), 0);
    },
  };
}

export function nativeStore(Filesystem, Directory) {
  const directory = Directory.LibraryNoCloud || Directory.Library;
  const root = 'torah-packs';
  return {
    kind: 'native',
    async write(path, bytes) { await Filesystem.writeFile({ path: `${root}/${path}`, data: toBase64(bytes), directory, recursive: true }); },
    async read(path) {
      try { return fromBase64((await Filesystem.readFile({ path: `${root}/${path}`, directory })).data); } catch { return null; }
    },
    async removeDir(prefix) {
      try { await Filesystem.rmdir({ path: `${root}/${prefix}`, directory, recursive: true }); } catch { /* already gone */ }
    },
    async usage(prefix = '') {
      let total = 0;
      const walk = async path => {
        let listing;
        try { listing = await Filesystem.readdir({ path, directory }); } catch { return; }
        for (const entry of listing.files || []) {
          if (entry.type === 'directory') await walk(`${path}/${entry.name}`);
          else total += Number(entry.size) || 0;
        }
      };
      await walk(prefix ? `${root}/${prefix}` : root);
      return total;
    },
  };
}

// The store this device uses: native files when the app runs natively with the plugin, IndexedDB on the web.
let chosen = null;
export async function defaultPackStore() {
  if (chosen) return chosen;
  const cap = globalThis.Capacitor;
  if (cap?.isNativePlatform?.() && cap.isPluginAvailable?.('Filesystem')) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    chosen = nativeStore(Filesystem, Directory);
  } else if (typeof indexedDB !== 'undefined') chosen = indexedDbStore();
  else chosen = memoryStore();
  return chosen;
}
export const setPackStore = store => { chosen = store; };
