// Development preview only (VITE_TORAH_FIXTURE=1 npm run dev): the engine reads the hand-made test fixture
// (tests/fixtures/torahContentSample — placeholder text marked "דוגמה לבדיקה") instead of the archive. Imported from one
// dev-only branch of torahContentSource.mjs, which every build removes: this file and the fixture never ship.
import index from '../../tests/fixtures/torahContentSample/index.mjs';
import search from '../../tests/fixtures/torahContentSample/search.mjs';

const urls = import.meta.glob('../../tests/fixtures/torahContentSample/packs/*', { as: 'url', eager: true });
export default {
  loadIndex: async () => index,
  loadSearch: async () => search,
  async loadPack(name, entry) {
    const url = Object.entries(urls).find(([path]) => path.endsWith(`/${entry.file}`))?.[1];
    if (!url) throw new Error('missing fixture pack');
    return new Uint8Array(await (await fetch(url)).arrayBuffer());
  },
};
