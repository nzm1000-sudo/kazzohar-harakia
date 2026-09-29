// The Talmud's local layer: the Gemara (Hebrew Wikisource transcription, CC BY-SA 4.0), Rashi and Tosafot (Vilna
// edition) read from the checksum-verified packs in the app bundle — no network. One file per tractate and per
// commentary, so an amud loads only its own tractate's files. Built by scripts/library/build-talmud.mjs.
// The segmentation is Sefaria's canonical one (checked at build time), so remote layers (Steinsaltz, linked
// commentaries) line up segment for segment with the local text.
import TALMUD from '../data/library/corpus/talmud.mjs';
import { loadEditionChunk } from './library/packs.mjs';
import { amudIndex, amudLabel } from './library/pagination.mjs';
import { hebrewNumeral } from './hebrewNumerals.mjs';

const LICENCE_LABEL = { 'public-domain': 'נחלת הכלל', 'cc-by-sa': 'CC BY-SA 4.0', 'cc-by': 'CC BY' };
const entries = TALMUD.packs.flatMap(pack => pack.works.map(work => ({
  work,
  pack,
  edition: { editionId: `${pack.packId}:${work.workId}`, packId: pack.packId, file: work.file, checksum: work.checksum },
})));
const byWorkId = new Map(entries.map(entry => [entry.work.workId, entry]));
const baseWorkId = title => `Bavli_${String(title).replace(/['’]/g, '').replace(/[^A-Za-z0-9]+/g, '_')}`;

// The local works of one tractate: its Gemara and the commentators anchored to it (in their customary order).
export function localTalmud(tractateTitle) {
  const base = byWorkId.get(baseWorkId(tractateTitle));
  if (!base) return null;
  const commentaries = entries.filter(entry => entry.work.relation?.baseWorkId === base.work.workId).sort((a, b) => a.work.layerRank - b.work.layerRank);
  return { base, commentaries };
}
export const hasLocalTalmud = tractateTitle => Boolean(byWorkId.get(baseWorkId(tractateTitle)));
// The commentator names the reader groups by (Sefaria's link names: רש"י, תוספות) that are local for this tractate.
export const localCommentatorNames = tractateTitle => (localTalmud(tractateTitle)?.commentaries || []).map(entry => entry.work.linkName);

const escapeHtml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Plain pack text → the reader's HTML: escaped, with the transcription's bold (unit.em ranges) as <strong>.
export function segmentHtml(unit) {
  if (!unit.em?.length) return escapeHtml(unit.text);
  let html = '';
  let at = 0;
  for (const [from, to] of unit.em) {
    html += `${escapeHtml(unit.text.slice(at, from))}<strong>${escapeHtml(unit.text.slice(from, to))}</strong>`;
    at = to;
  }
  return html + escapeHtml(unit.text.slice(at));
}
const commentHtml = unit => (unit.dh ? `<b>${escapeHtml(unit.dh)}</b> ${escapeHtml(unit.text)}` : escapeHtml(unit.text));

const nodeOf = (work, amud) => {
  const first = amudIndex(work.pagination.volumes[0].first);
  const index = amudIndex(amud);
  const node = index - first + 1;
  return index < 0 || node < 1 || node > work.expected.length ? null : node;
};

// The credit lines of the local layers of a tractate (the CC BY-SA ones with their source and licence links).
export function localCredits(tractateTitle) {
  const local = localTalmud(tractateTitle);
  if (!local) return null;
  const line = ({ work }) => ({ name: work.layerTitle || 'גמרא', license: work.license, licenseLabel: LICENCE_LABEL[work.license], edition: work.editionHeTitle, attribution: work.attribution || null, sourceLine: work.sourceLine });
  return { base: line(local.base), commentaries: local.commentaries.map(line) };
}

// One amud from the device: segments of the Gemara and, per segment, the local Rashi / Tosafot comments.
// Returns null when the tractate has no local Gemara or the amud is outside it.
export async function loadLocalAmud(tractate, amud, { fetchImpl } = {}) {
  const local = localTalmud(tractate.title);
  if (!local) return null;
  const node = nodeOf(local.base.work, amud);
  if (!node) return null;
  const options = fetchImpl ? { fetchImpl } : {};
  const [baseChunk, ...layerChunks] = await Promise.all([
    loadEditionChunk(local.base.edition, options),
    ...local.commentaries.map(entry => (entry.work.nodes[node - 1] ? loadEditionChunk(entry.edition, options) : null)),
  ]);
  const units = baseChunk.nodes.find(item => item.n === node)?.units || [];
  const count = local.base.work.expected[node - 1];
  const ref = `${tractate.title} ${amud}`;
  const byCommentator = local.commentaries.map((entry, i) => {
    const comments = layerChunks[i]?.nodes.find(item => item.n === node)?.units || [];
    const perSegment = new Map();
    for (const unit of comments) {
      if (!perSegment.has(unit.v)) perSegment.set(unit.v, []);
      perSegment.get(unit.v).push(unit);
    }
    return { entry, perSegment };
  });
  const segments = [];
  for (let n = 1; n <= count; n += 1) {
    const unit = units.find(item => item.n === n);
    const commentaries = [];
    for (const { entry, perSegment } of byCommentator) {
      (perSegment.get(n) || []).forEach((comment, k) => commentaries.push({
        ref: `${entry.work.title} ${amud}:${n}:${k + 1}`,
        commentator: entry.work.linkName,
        anchorRef: `${ref}:${n}`,
        local: true,
      }));
    }
    segments.push({ n, ref: `${ref}:${n}`, gemara: unit ? segmentHtml(unit) : '', missing: !unit, commentaries });
  }
  const base = local.base.work;
  return {
    ref,
    node,
    segments,
    baseVersion: { title: base.editionHeTitle, versionTitle: base.editionTitle, license: 'CC-BY-SA', licenseLabel: 'CC BY-SA 4.0', attribution: base.attribution, local: true },
    localCommentators: local.commentaries.filter(entry => entry.work.nodes[node - 1]).map(entry => entry.work.linkName),
    localCommentatorsOfTractate: local.commentaries.map(entry => entry.work.linkName),
    credits: localCredits(tractate.title),
  };
}

// "Rashi on Berakhot 2a:1:2" → that comment from the device (null when the ref is not a local comment).
const REF = /^(.+) (\d+[ab]):(\d+):(\d+)$/;
export async function loadLocalCommentary(ref, { fetchImpl } = {}) {
  const m = REF.exec(String(ref || ''));
  if (!m) return null;
  const entry = entries.find(item => item.work.relation && item.work.title === m[1]);
  if (!entry) return null;
  const node = nodeOf(entry.work, m[2]);
  if (!node || !entry.work.nodes[node - 1]) return null;
  const chunk = await loadEditionChunk(entry.edition, fetchImpl ? { fetchImpl } : {});
  const segment = Number(m[3]);
  const comment = (chunk.nodes.find(item => item.n === node)?.units || []).filter(unit => unit.v === segment)[Number(m[4]) - 1];
  if (!comment) return null;
  const tractate = entry.work.shortTitle;
  return {
    ref,
    heRef: `${entry.work.layerTitle} · ${tractate} ${amudLabel(m[2]).replace(/^דף /, '')} · קטע ${hebrewNumeral(segment)}`,
    html: [commentHtml(comment)],
    version: entry.work.editionHeTitle,
    license: LICENCE_LABEL[entry.work.license],
    source: entry.work.versionSource,
    attribution: entry.work.attribution || null,
    local: true,
  };
}

// ---------- The second-tier Rishonim: one exact public-domain edition each, read live ----------
const REMOTE = [...(TALMUD.remoteLayers || [])].sort((a, b) => b.title.length - a.title.length);
// The registered edition of a commentary ref ("Chidushei Halachot on Berakhot 2a:3" → Vilna Edition), or null.
export function registeredRemoteEdition(ref) {
  const text = String(ref || '');
  const layer = REMOTE.find(item => text.startsWith(`${item.title} `) || text === item.title);
  return layer ? { title: layer.title, versionTitle: layer.versionTitle, heVersion: layer.heVersion, license: layer.license, recordedLicense: layer.recordedLicense } : null;
}

// Coverage facts the reader and the sources page show (from the build; nothing assumed).
export const TALMUD_LOCAL_SUMMARY = Object.freeze({ base: TALMUD.base, commentators: TALMUD.commentators, remote: TALMUD.remoteCommentators });
