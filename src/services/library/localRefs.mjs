// A Sefaria reference the Halacha Engine cites ("Shulchan Arukh, Orach Chayim 107:1", "Mishnah Berurah 1:3") → the same
// place in the book on the device, when the library carries it. Only the Shulchan Arukh and its commentaries on the
// device are resolved; anything else (or a place the edition lacks) returns null and keeps opening as before.
import { PUBLIC_WORKS } from '../../data/library/registry.mjs';

const plain = title => String(title || '').replace(/['’]/g, '').trim();
const localBooks = works => new Map(works
  .filter(work => work.kind === 'pack' && work.primaryCategory === 'halacha' && work.group === 'shulchan-arukh')
  .map(work => [plain(work.sourceTitle), work]));
let cache = null;

export function localLibraryRoute(ref, works = PUBLIC_WORKS) {
  const m = /^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*\d+)?)?$/.exec(String(ref || '').trim());
  if (!m) return null;
  const books = works === PUBLIC_WORKS ? (cache ||= localBooks(works)) : localBooks(works);
  const work = books.get(plain(m[1]));
  if (!work) return null;
  const edition = work.editions[0];
  const node = Number(m[2]);
  const unit = m[3] ? Number(m[3]) : null;
  // Only a siman the edition has; a seif (or seif katan) beyond it opens the siman itself.
  if (!edition.nodes[node - 1]) return null;
  const within = unit && unit <= (edition.expected[node - 1] || 0) ? unit : null;
  return `books/r/${encodeURIComponent(work.workId)}/${node}${within ? `/${within}` : ''}`;
}
