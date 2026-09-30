// The canonical reference layer. One place in any corpus is a TorahRef:
//   { workId, category, section, segment, anchorRef, commentatorId, baseWorkId, displayRef }
// section / segment are the pack's own node / unit (chapter·verse, amud·segment, siman·seif, siman·seif katan, page·
// paragraph); anchorRef is the base place a commentary explains ("Genesis.1.1"). It extends the library's references
// (search.mjs resolveLibraryReference, relations.mjs anchors) — the same ids, no second numbering. Every searchable unit
// and every resolved reference goes through targetFor(): one deep-link contract for every reader.
import { WORKS, workById } from '../../data/library/registry.mjs';
import { canonicalReferenceText, resolveLibraryReference } from '../library/search.mjs';
import { amudIndex, amudLabel, indexAmud, paginationNodes } from '../library/pagination.mjs';
import { hebrewLocations, hebrewNumeral } from '../hebrewNumerals.mjs';
import { yalkutReference } from '../yalkutYosef.mjs';
import { workIsTalmudBase } from './inventory.mjs';

// ---------- Routes (the readers' address grammar) ----------
// books/r/<work>/<node>[/<unit>][/m[/<layer unit id>]] — "m" opens the reader's מפרשים tab, narrowed to the unit, and
// a layer unit id brings that one comment into view.
export const libraryReadRoute = (workId, node, unit = null, { commentary = false, focus = null } = {}) =>
  `books/r/${encodeURIComponent(workId)}/${node}${unit || commentary ? `/${unit || 0}` : ''}${commentary ? `/m${focus ? `/${encodeURIComponent(focus)}` : ''}` : ''}`;
// talmud/<Tractate>/<amud>[/<segment>[/<rashi|tosafot>]]
export const talmudReadRoute = (tractate, amud, segment = null, layer = null) =>
  `talmud/${encodeURIComponent(tractate)}/${amud}${segment ? `/${segment}${layer ? `/${layer}` : ''}` : ''}`;

// The amud of a node in a work on the Talmud's pagination (one volume per tractate; node 1 = its first amud).
export function amudOf(work, node) {
  const first = work?.editions?.[0]?.pagination?.volumes?.[0]?.first;
  if (!first) return null;
  return indexAmud(amudIndex(first) + node - 1);
}
const TALMUD_LAYER = { rashi: 'rashi', tosafot: 'tosafot' };

// ---------- TorahRef ----------
export function torahRef(work, section, segment = null, { anchor = null } = {}) {
  if (!work) return null;
  const baseWorkId = work.relation?.baseWorkId || null;
  const anchorRef = baseWorkId && anchor ? `${baseWorkId}.${section}.${anchor}` : null;
  return {
    workId: work.workId,
    category: work.primaryCategory,
    section,
    segment,
    anchorRef,
    commentatorId: baseWorkId ? work.workId : null,
    baseWorkId,
    displayRef: displayRef(work, section, segment, { anchor }),
  };
}

const nodeName = (work, node) => work.editions[0].nodeTitles?.[node - 1] || null;
// The reference as a learner writes it: "בראשית א, א" · "ברכות ב ע״א, ג" · "שולחן ערוך, אורח חיים שי״ח, א" ·
// "משנה ברורה שי״ח, ס״ק ג" · "רש״י על בראשית א, א".
export function displayRef(work, node, unit = null, { anchor = null } = {}) {
  if (!work) return '';
  const edition = work.editions?.[0] || {};
  if (work.reader === 'talmud' || workIsTalmudBase(work.relation?.baseWorkId)) {
    const base = work.reader === 'talmud' ? work : workById(work.relation.baseWorkId);
    const amud = amudOf(base, node);
    const tractate = base.shortTitle || base.title;
    const place = `${work.reader === 'talmud' ? '' : `${work.layerTitle || work.title} · `}${tractate} ${amudLabel(amud).replace(/^דף /, '')}`;
    const segment = work.reader === 'talmud' ? unit : anchor;
    return segment ? `${place}, ${hebrewNumeral(segment)}` : place;
  }
  if (edition.pagination) {
    const page = paginationNodes(edition.pagination)[node - 1];
    return `${work.title} · ${page?.title || hebrewNumeral(node)}${unit ? `, ${hebrewNumeral(unit)}` : ''}`;
  }
  const named = nodeName(work, node);
  const skLabel = edition.unitLabel === 'סעיף קטן' ? 'ס״ק ' : '';
  if (work.relation?.anchorScheme === 'sefaria-ref' && anchor) {
    // A commentary on a verse or a mishnah is cited by the place it explains.
    return `${work.title} ${hebrewNumeral(node)}, ${hebrewNumeral(anchor)}`;
  }
  if (named && !/^(?:סימן|פרק) /.test(named)) return `${work.title} · ${named}${unit ? `, ${skLabel}${hebrewNumeral(unit)}` : ''}`;
  return `${work.title} ${hebrewNumeral(node)}${unit ? `, ${skLabel}${hebrewNumeral(unit)}` : ''}`;
}

// ---------- The deep-link contract ----------
// → { route } for a reader in the app, or { source: { reference, title } } for the source reader. Never the library
// home: a place that cannot be addressed exactly returns null (and tests fail on it).
export function targetFor(work, node, unit = null, { anchor = null, unitId = null } = {}) {
  if (!work) return null;
  if (work.reader === 'talmud') {
    const amud = amudOf(work, node);
    return amud ? { route: talmudReadRoute(work.sourceTitle, amud, unit) } : null;
  }
  const baseWorkId = work.relation?.baseWorkId;
  if (baseWorkId && workIsTalmudBase(baseWorkId)) {
    const base = workById(baseWorkId);
    const amud = amudOf(base, node);
    if (!amud) return null;
    return { route: talmudReadRoute(base.sourceTitle, amud, anchor || null, anchor ? TALMUD_LAYER[work.group] || null : null) };
  }
  if (baseWorkId && work.kind === 'pack') {
    const base = workById(baseWorkId);
    // A comment anchored to a place of its base opens there, in the מפרשים tab, with that comment in view. A comment
    // with no anchor (an introduction) opens in the commentary itself.
    if (base && (anchor || work.editions[0].pagination)) return { route: libraryReadRoute(baseWorkId, node, anchor || null, { commentary: true, focus: unitId || `${work.workId}.${node}.${unit}` }) };
    if (work.layerOnly) return base ? { route: libraryReadRoute(baseWorkId, node, null, { commentary: true }) } : null;
    return { route: libraryReadRoute(work.workId, node, unit) };
  }
  if (work.kind === 'pack') return { route: libraryReadRoute(work.workId, node, unit) };
  return null;
}

// ---------- Resolving a typed reference ----------
// "בראשית א:א", "ברכות ב ע״א", "שו״ע או״ח שיח א", "משנה ברורה שיח ס״ק ג", "זוהר ח״א טו ע״א" → { ref, target, label }.
// A canonical reference always outranks keyword results (the search shows it first).
export function resolveTorahRef(query, works = WORKS.filter(work => work.public && !work.layerOnly)) {
  const hit = resolveLibraryReference(query, works);
  if (!hit) return null;
  if (hit.kind === 'route') {
    const m = /^talmud\/([^/]+)\/(\d+[ab])$/.exec(hit.route);
    const tractate = m ? decodeURIComponent(m[1]) : null;
    const base = tractate ? WORKS.find(work => work.reader === 'talmud' && work.sourceTitle === tractate) : null;
    return { ref: base ? { ...torahRef(base, amudIndex(m[2]) - amudIndex(amudOf(base, 1)) + 1), displayRef: `${base.shortTitle || tractate} ${amudLabel(m[2]).replace(/^דף /, '')}` } : null, target: { route: hit.route }, label: base ? `${base.title} ${amudLabel(m[2]).replace(/^דף /, '')}` : hit.label };
  }
  const work = workById(hit.workId);
  if (!work) return null;
  if (!hit.node) return { ref: torahRef(work, 1), target: { route: `books/w/${encodeURIComponent(work.workId)}` }, label: work.title, bookOnly: true };
  const ref = torahRef(work, hit.node, hit.unit);
  // A place in a commentary on the Shulchan Arukh (משנה ברורה שיח ס״ק ג) opens the commentary there.
  return { ref, target: { route: libraryReadRoute(work.workId, hit.node, hit.unit) }, label: ref.displayRef };
}
export { canonicalReferenceText };

// A place in a work outside the packs.
export const yalkutTarget = section => ({ source: { reference: yalkutReference(section.id), title: hebrewLocations(section.label) } });
export const answerTarget = id => ({ route: `halacha/q/${encodeURIComponent(id)}` });
