# Library content model: relations, anchors and honest coverage

This extends the pack format described in `corpus-gap-report.md` §8.2. It adds three things: relations, anchors and
coverage records. The Zohar corpus is the first user; the Tanakh, Mishnah, Talmud and halacha commentaries reuse it.

## Where things live

| Piece | File |
|---|---|
| Coverage statuses and the coverage record | `src/services/library/integrity.mjs` (`COVERAGE`, `coverageRecord`) |
| Printed pagination (volume · daf · amud → node) | `src/services/library/pagination.mjs` |
| Corpus packs, remote layers, blocked layers | `src/data/library/corpusIndex.mjs` → `src/data/library/corpus/<corpus>.mjs` (generated) |
| Registry (works, editions, acquisition queue) | `src/data/library/registry.mjs` |
| Lookup: a place in a base work → its layers | `src/services/library/relations.mjs` |
| Builders | `scripts/library/build-zohar.mjs` (with `wikisource.mjs`, `clean.mjs`); `scripts/library/build-commentary.mjs` (Tanakh and Mishnah commentaries); `scripts/library/build-talmud.mjs` (the Bavli, Rashi, Tosafot, Rif, remote Rishonim); `scripts/library/build-shulchan-arukh-commentary.mjs` (the Shulchan Arukh's nosei kelim) |
| A Sefaria reference → the local book (Halacha Engine links) | `src/services/library/localRefs.mjs` |
| The Talmud's local layer in the Talmud reader | `src/services/talmudLocal.mjs` (read by `loadAmud` / `loadCommentary` in `src/services/talmud.mjs`) |

## Coverage statuses

`FULL`, `PARTIAL`, `METADATA_ONLY`, `REMOTE_ONLY`, `SCAN_ONLY`, `UNAVAILABLE`, plus two new ones:

- `PERMISSION_REQUIRED`: the work is wanted, but no edition may be redistributed. It is never imported.
- `BLOCKED`: an edition exists but is held back until someone reviews it, for doubtful rights or provenance. Two
  examples: a modern edition recorded as PD, and a translation that says it follows a protected one.

`ACQUISITION_QUEUE` uses the same words. Each entry that names a provider edition has a `match`, so tests can prove the
edition is not packaged.

## Coverage record (per work or layer, computed by the build script)

```json
{ "expectedUnits": 5763, "importedUnits": 5761, "missingUnits": ["Yahel_Ohr_on_Zohar.129.55", "Yahel_Ohr_on_Zohar.1038.5"],
  "coveragePercent": 100, "coverageStatus": "PARTIAL" }
```

- **`expectedUnits`** comes from a structure that does not depend on the text. Examples are Sefaria's `/api/shape` or
  a count of Wikisource pages. A record may say what it counts (`unit: "amud"`) and on what basis
  (`basis: "all 7 Wikisource pages of the transcription"`).
- **`coverageRecord()`** refuses `FULL` whenever anything is missing.
- **`PARTIAL`** is also used when every unit is present but the source marks gaps itself. For the Zohar these are the
  22 pages with `{{להשלים}}`, listed in `incompletePassages`.
- Pages with no text in print, such as a title page, are listed in `noTextInPrint`. They are not counted as missing.
- In the registry, `work.coverage` is the status and `work.coverageDetail` is the whole record.

## Relation (per work)

```json
"relation": { "relationType": "commentary", "baseWorkId": "Zohar", "anchorScheme": "mantua-page" }
```

- **`relationType`** is one of `commentary`, `supercommentary`, `translation`, `parallel`, `quotation` or
  `halachic-descendant`.
- **`anchorScheme`** says how the anchors were made:
  - `mantua-page`: the commentary is organised by the printed page.
  - `sefaria-links`: from Sefaria's links, mapped through the base work's alt-structure.
  - `sefaria-ref`: from the commentary's own Sefaria ref. Used by the Tanakh and Mishnah commentaries
    (`Rashi on Genesis 1:1:1` → `Genesis 1:1`, `Bartenura on Mishnah Berakhot 1:1:1` → `Mishnah Berakhot 1:1`);
    and by the Talmud commentaries (`Rashi on Berakhot 2a:3:1` → `Berakhot 2a:3`, see "The Talmud" below).
  - `seif-markers`: the Shulchan Arukh's commentaries, anchored to the seif by printed markers (see "The Shulchan
    Arukh" below). `siman`: a layer on its own seifim (ערוך השולחן), anchored to the siman only.
  - `sefaria-links-live`: a remote layer that keeps its own structure (the Rosh by perek and siman, the Ran on the
    Rif's pages). It has no page index; the Talmud reader reaches it through Sefaria's live links, in its registered
    edition only.
- A layer whose node numbering matches the base work (Yahel Ohr and Nefesh David are numbered by Zohar page) reuses the
  base work's `pagination` and `sections`.

## Anchors

Each bundled layer has two anchor records.

**Per unit, `<workId>.anchors.json.gz`.** This file is in the same pack and is checksum-verified like a chunk. It holds
one record per unit:

```json
{ "unitId": "Yahel_Ohr_on_Zohar.29.3", "anchorRef": "Zohar.29", "canonicalRef": "Yahel Ohr on Zohar 1:15a:3",
  "baseCanonicalRef": "Zohar 1:15a" }
```

**A compact page index, `anchorNodes`, in the generated index.** Each row is `[baseNode, layerNode, firstUnit,
lastUnit]`, so the reader can decide which tabs to show without loading anything. For a remote layer the row is
`[baseNode, units]`, taken from the provider's shape.

Some units have no anchor, such as addenda and pages outside the base work's pagination. They stay readable in the book
itself and are counted as `unanchoredUnits`.

## Verse commentaries (Tanakh, Mishnah)

- **Node = chapter, unit = comment.** Units are numbered by their place in Sefaria's `/api/shape` of the work, so an id
  never shifts when an edition lacks a comment: the gap is a listed missing unit.
- **Unit fields:** `v` (the verse or mishnah the comment sits on) and, where the edition prints bold opening words,
  `dh` (dibbur hamatchil) kept apart from `text`. The reader shows `dh` in bold; the words are the edition's.
- **Page index:** `anchorNodes` rows are `[chapter, chapter, firstUnit, lastUnit]`; remote rows `[chapter, comments]`.
- **Named parts** (introductions) follow the chapters as their own nodes (`nodeTitles`), readable and unanchored.
- **One file per book or tractate**, so a chapter loads only its own commentary.
- **Tab names follow the base text:** `מקרא` (Tanakh) or `משנה` (Mishnah) instead of `מקור`; parallel/quotation layers
  are `מקורות` beside the Tanakh and `מקבילות` beside the Mishnah (`layerTabNames()` in `relations.mjs`).
- **Order:** layers sort by kind, then by `layerRank` (the commentator's customary place), bundled before remote.
- **Remote refs** use `{chapter}` (`Malbim on Exodus {chapter}`, `{title}, Genesis {chapter}` for a multi-book index);
  a chapter arrives as verses → comments and is returned with `v` on each unit.

## The Talmud

- **Base:** one work per tractate, `Bavli_<Tractate>` (37), in `wikisource-talmud-cc-by-sa`. Node = amud on the
  tractate's pagination (one volume per tractate: node 1 is the first amud — `2a`, or `25b` for Tamid); unit = one
  Gemara segment in Sefaria's segmentation (`Berakhot 2a:3` → `Bavli_Berakhot.1.3`). The build stops unless
  `/api/shape/<Tractate>` and `src/data/talmudCatalog.mjs` agree amud by amud, so every Sefaria ref (Steinsaltz,
  William Davidson, commentary refs) lines up with the local text. Bold in the transcription is kept as `unit.em`
  (character ranges), since pack text carries no markup. The work carries `reader: 'talmud'`: the library opens it in
  the Talmud reader (its modes stay: with explanation, Gemara, study, page image).
- **Rashi, Tosafot:** node = the same amud (same pagination), unit = one comment numbered by its place in the
  commentary's `/api/shape`, `v` = the Gemara segment, `dh` = the opening words (before Sefaria's ` - ` separator).
  Coverage adds the amudim reached against the Gemara (`baseAmudim`, `amudimReached`, `amudPercent`, `gaps` of four
  amudim or more): Rashi on Bava Batra stops at 29a, Tosafot miss stretches of Sanhedrin, Horayot, Keritot…
- **Anchors file, compact:** `{ format: 'rows', title, baseTitle, firstAmud, rows: [[node, unit, segment, comment]] }`
  (~140,000 comments); `loadAnchors()` expands it to the usual `{ unitId, anchorRef, canonicalRef, baseCanonicalRef }`.
- **Rif:** a book per tractate on the Rif's own pages (`Rif_Berakhot`, `onTractate: 'Bavli_Berakhot'`, no relation):
  Sefaria's links from the Rif to the Gemara carry no published licence.
- **Remote Rishonim:** Maharsha (halachot, aggadot), Chiddushei HaRamban, Ritva and the Ran on Nedarim are on the
  Gemara's pages: `refPattern: '{title} {amud}'`, page index `[node, comments]`. The Rosh and the Ran on the Rif keep
  their own structure (`sefaria-links-live`). In the Talmud reader every commentary ref of these titles is fetched with
  `vhe=<registered versionTitle>` and refused unless that edition, still Public Domain, comes back.
- **Reader:** `loadAmud()` reads the Gemara, Rashi and Tosafot from the packs (no network), then adds Steinsaltz and the
  other linked commentaries live (cached and pinnable as before; for a local tractate a pin saves only these live
  layers). Offline, the amud still opens with a notice. The vocalized William Davidson text (CC-BY-NC) stays available
  live, used only when its segment count equals the local one.

## The Shulchan Arukh

- **Base:** the four parts already in `sefaria-shulchan-arukh-pd` (node = siman, unit = seif). Nothing in the base changed.
- **Layers:** node = the same siman, unit = one seif katan numbered by its printed letter (`Mishnah_Berurah.1.3` is
  מ״ב סק״ג), `v` = the seif, `dh` = the opening words. The seif comes from printed markers, never from Sefaria's link
  data: the Wikisource page's own seif headings (משנה ברורה, ביאור הלכה — cross-checked against the Lemberg 1893 markers:
  where the two disagree the comment claims no seif), the `data-commentator`/`data-order` markers of the public-domain
  Lemberg editions of the Shulchan Arukh (באר היטב and the remote layers; used only where that edition divides the siman
  into the same seifim and numbers exactly the comments present), and the print's own `[סעיף …]` (כף החיים).
- **Introductions and named treatises** (הקדמה לסימן רנ״ג, משנת סופרים) are their own nodes after the simanim
  (`nodeTitles`), units with a `title`; the page index places an introduction before its siman's comments and a treatise
  after them. A seif katan of several paragraphs keeps them (`\n` in `text`).
- **Files by siman range:** `edition.parts: [{ from, to, file, checksum, bytes }]`, ≈300 KB gzip each; `loadEditionChunk
  (edition, { node })` loads only the file holding that node, `loadWholeEdition()` all of them (validation only);
  `edition.checksum` is the checksum of the part checksums, for the download state.
- **Anchors file:** `{ format: 'seif-rows', rows: [[siman, sk, seif]] }` → the usual records (`Mishnah Berurah 1:1` →
  `Shulchan Arukh, Orach Chayim 1:1`). **Per-seif counts:** `edition.seifCounts: [[siman, [count per seif]]]` for
  bundled and remote layers; `layersBySeif()` tells the reader which commentaries speak of each seif without loading.
- **Remote layers:** `refPattern: '{title} {chapter}'` (the siman); `unitLabel`, `joinParagraphs` (כף החיים יו״ד) and a
  `seifMap` side file (`remote-seif-maps.json.gz`) give the live text its s"k numbers and seifim. The loader accepts the
  registered licence only: public domain, or — for ערוך השולחן אורח חיים, a Wikisource transcription — CC-BY-SA with
  its credit shown under the text.
- **Reader:** under each seif of the Shulchan Arukh, one quiet line names the commentaries on it and opens the מפרשים tab
  on that seif; the tab groups each commentary by seif (`סעיף ג׳`), each comment with its printed number `(ג)`.

## Printed pagination

Pack ids stay numeric (`Zohar.<node>.<unit>`). The printed page is described once:

```json
"pagination": { "scheme": "daf", "edition": "Mantua 1558–1560",
  "volumes": [{ "n": 1, "title": "חלק א", "first": "1a", "last": "251a" }, …], "extra": ["ליקוטים"] }
```

`paginationNodes()` turns this into the following:

- **Node titles**, such as `חלק א · דף ט״ו ע״א`. The registry fills `nodeTitles` from them, so they are not stored.
- **Refs**, such as `1:15a`.
- **Grid cells** for the table of contents, such as `ט״ו.` and `ט״ו:`.

Parashot are `sections` (`חלק א · בראשית`). A page shared by two parashot opens the later one.

The library search resolves `זוהר ח"א טו ע"א`, `זהר חלק ב דף קכג:` and similar forms to the exact page. The Talmud
local layer can use the same descriptor, one volume per tractate.

## Lookup

```js
layersForRef('Zohar 1:15a')      // or 'Zohar.29'
// → { base: { workId: 'Zohar', node: 29, title: 'חלק א · דף ט״ו ע״א' },
//     translations: [], commentaries: [{ work, relationType, remote, segments: [{ node, from, to }], count }, …],
//     translationNotice: 'טרם קיים תרגום פתוח לקטע זה' }
loadLayerUnits(layer)            // bundled: the anchored units of that page (checksum-verified pack)
loadRemoteLayerUnits(layer, 29)  // remote: live, in the registered edition only
loadAnchors(work)                // the per-unit anchor records
```

`translationNotice` appears only when the work sets `translationSought` and no translation covers the page. It is never
replaced by other text.

## Reader

`LibraryReader` shows a `מקור | תרגום | מפרשים` tab bar. A tab appears only when that kind of layer has text on the
current page, and the bar appears only when there is more than the source. When the work looks for a translation and
none covers the page, the reader shows exactly `טרם קיים תרגום פתוח לקטע זה`.

Works with `pagination` also get these:

- A table of contents by page: volume, then parasha, then a grid of amudim.
- Previous and next buttons that skip pages with no text.
- The parasha name under the heading.
- The attribution line of a CC BY-SA text, shown under that text.

## Remote layers

- **Remote only.** Some commentaries are too large for the bundle, and native download does not work on iOS yet
  (`corpus-gap-report.md` §7.1). These are registered as `REMOTE_ONLY` works with `layerOnly: true` and
  `public: false`, so they appear under the page they explain rather than as books.
- **Pinned edition.** Each one names its provider edition (`versionTitle`) and a `refPattern` such as
  `{title} {volume}:{amud}`.
- **Refusals.** The loader refuses any response whose version title differs, or whose licence is no longer Public
  Domain.

## Pack storage

Every pack file is `*.json.gz`, and the checksum covers the JSON text inside. Devices without `DecompressionStream`
(iOS 15.0–16.3) inflate the same bytes in JavaScript (`inflate.mjs`). A test checks that result against zlib.
