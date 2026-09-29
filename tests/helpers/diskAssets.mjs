// Serves the app's public/ folder to code that fetches it (packs, the Torah index) — the same bytes the phone reads.
import { readFileSync } from 'node:fs';
import { configureIndexLoader } from '../../src/services/torah/searchIndex.mjs';

export function diskFetch(url) {
  const path = decodeURIComponent(String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]).replace(/^\//, '');
  try {
    const bytes = readFileSync(new URL(`../../public/${path}`, import.meta.url));
    return Promise.resolve(new Response(bytes));
  } catch {
    return Promise.resolve(new Response('not found', { status: 404 }));
  }
}
export function installDiskAssets() {
  globalThis.fetch = diskFetch;
  configureIndexLoader({ load: async file => new Uint8Array(readFileSync(new URL(`../../public/torah-index/${file}`, import.meta.url))) });
}
