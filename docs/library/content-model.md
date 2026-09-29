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
| Builders | `scripts/library/build-zohar.mjs` (with `wikisource.mjs`, `clean.mjs`); `scripts/library/build-commentary.mjs` (Tanakh and Mishnah commentaries) |

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
    planned for Talmud commentaries (`Rashi on Berakhot 2a:3:1` → `Berakhot 2a:3`).
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
